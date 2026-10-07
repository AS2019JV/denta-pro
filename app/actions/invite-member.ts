"use server"

import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"
import { Resend } from "resend"
import { escapeHtml } from "@/lib/html-escape"
import { consumeEmailBudget } from "@/lib/server-email-gate"
import { configuredAuthOrigin, validEmailToken, authEmailLink } from "@/lib/auth-email-contract"
import { randomUUID } from "node:crypto"

// SEC-06 INVARIANT: Allowed staff invitation roles (strictly excludes clinic_owner)
const ALLOWED_STAFF_ROLES = ["doctor", "receptionist"] as const
type AllowedRole = (typeof ALLOWED_STAFF_ROLES)[number]

export async function inviteTeamMember(formData: FormData): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendApiKey = process.env.RESEND_API_KEY
  const appUrl = configuredAuthOrigin(process.env.NEXT_PUBLIC_APP_URL)

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !resendApiKey || !appUrl) {
    throw new Error("Configuración del servidor incompleta.")
  }

  // =========================================================================
  // 1. INVARIANT 1: Require Server Session Authentication (auth.getUser())
  // =========================================================================
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Handled by middleware session refresh
        }
      },
    },
  })

  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAuth.auth.getUser()

  if (authError || !caller) {
    throw new Error("401 Unauthorized: Sesión no válida. Inicia sesión para continuar.")
  }

  // =========================================================================
  // 2. INVARIANT 2: Input Parsing & Validation
  // =========================================================================
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === "string" ? value.trim() : ""
  }
  const email = text("email").toLowerCase()
  const name = text("name") || "Colega"
  const clinicId = text("clinicId")
  const roleInput = text("role") || "receptionist"
  const specialization =
    text("specialization") ||
    (roleInput === "doctor" ? "Odontólogo General" : "Personal Administrativo")

  if (!email || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clinicId)
    || email.length > 254 || name.length > 120 || specialization.length > 160) {
    throw new Error("400 Bad Request: El correo electrónico y el ID de la clínica son obligatorios.")
  }

  // Email format verification
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error("400 Bad Request: Formato de correo electrónico inválido.")
  }

  // INVARIANT 3: Role validation against allowed staff enum (reject rogue owner)
  if (!ALLOWED_STAFF_ROLES.includes(roleInput as AllowedRole)) {
    throw new Error(
      `400 Bad Request: Rol no permitido. Solo se puede invitar a: ${ALLOWED_STAFF_ROLES.join(", ")}`
    )
  }
  const role: AllowedRole = roleInput as AllowedRole

  // =========================================================================
  // 3. The canonical RPC checks active, non-deleted profile and live membership.
  // Historical ownership and JWT/profile role fields never grant authority.
  // =========================================================================
  const { data: liveRole, error: authorityError } = await supabaseAuth.rpc(
    "get_clinic_member_role", { check_clinic_id: clinicId }
  )
  if (authorityError || liveRole !== "clinic_owner") {
    throw new Error("403 Forbidden: Acceso denegado. Solo el propietario de la clínica puede invitar miembros.")
  }

  // =========================================================================
  // 4. Privileged Admin Operations (Service Role Client)
  // =========================================================================
  const budget = await consumeEmailBudget({ action: 'invite', headers: await headers(), destination: email,
    actorId: caller.id, clinicId })
  if (!budget.allowed) throw new Error(budget.message)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Check for existing pending invitation for this email & clinic
  const { data: existingInvite, error: lookupError } = await supabaseAdmin
    .from("clinic_invitations")
    .select("id, status, expires_at")
    .eq("clinic_id", clinicId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle()

  if (lookupError) throw new Error("No se pudo verificar la invitación pendiente.")

  if (existingInvite) {
    if (new Date(existingInvite.expires_at).getTime() > Date.now()) {
      throw new Error("Ya existe una invitación pendiente activa para este correo en tu clínica.")
    } else {
      // Mark expired invitation
      const { error: expireError } = await supabaseAdmin
        .from("clinic_invitations")
        .update({ status: "expired" })
        .eq("id", existingInvite.id)
        .eq("clinic_id", clinicId)
        .eq("status", "pending")
        .eq("expires_at", existingInvite.expires_at)
      if (expireError) throw new Error("No se pudo actualizar la invitación pendiente.")
    }
  }

  // Reserve before Auth side effects. The pending-only unique index arbitrates
  // concurrent requests; losing requests never generate a second Auth token.
  const reservationId = randomUUID()
  const reservationToken = randomUUID()
  const { error: insertInviteError } = await supabaseAdmin
    .from("clinic_invitations")
    .insert({
      id: reservationId,
      clinic_id: clinicId,
      email,
      role,
      invited_by: caller.id,
      token: reservationToken,
      status: "pending",
    })
  if (insertInviteError) {
    if (insertInviteError.code === "23505") {
      throw new Error("Ya existe una invitación pendiente activa para este correo en tu clínica.")
    }
    throw new Error("No se pudo registrar la invitación. No se envió el correo.")
  }

  const releaseReservation = async (ownedToken: string): Promise<boolean> => {
    try {
      const { data: expired, error } = await supabaseAdmin
        .from("clinic_invitations")
        .update({ status: "expired" })
        .eq("id", reservationId)
        .eq("clinic_id", clinicId)
        .eq("token", ownedToken)
        .eq("status", "pending")
        .select("id")
        .maybeSingle()
      return !error && Boolean(expired)
    } catch { return false }
  }

  // Auth generation and email transport are separate provider operations.
  // Unconfirmed outcomes keep the reservation for review, never blind retries.
  let linkData, linkError
  try {
    const generated = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: email,
      options: {
        data: {
          clinic_id: clinicId,
          role: role,
          full_name: name,
          specialization: specialization,
          pending_invite: true,
        },
        redirectTo: `${appUrl}/dashboard`,
      },
    })
    linkData = generated.data
    linkError = generated.error
  } catch {
    throw new Error("No se pudo confirmar la generación del enlace; revisa la invitación antes de repetir.")
  }

  if (linkError) {
    if (!await releaseReservation(reservationToken)) {
      throw new Error("El proveedor rechazó la generación del enlace; no se pudo liberar la invitación pendiente. Revísala antes de repetir.")
    }
    throw new Error("El proveedor rechazó la generación del enlace. Puedes volver a intentarlo.")
  }
  if (!validEmailToken(linkData?.properties?.hashed_token)) {
    throw new Error("No se pudo confirmar la generación del enlace; revisa la invitación antes de repetir.")
  }

  const tokenHash = linkData.properties.hashed_token
  const confirmUrl = authEmailLink(appUrl, tokenHash, 'invite')

  try {
    const { data: recorded, error: tokenError } = await supabaseAdmin
      .from("clinic_invitations")
      .update({ token: tokenHash, auth_ready: true })
      .eq("id", reservationId)
      .eq("clinic_id", clinicId)
      .eq("token", reservationToken)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (tokenError || !recorded) throw new Error("Unconfirmed token update")
  } catch {
    throw new Error("No se pudo confirmar el registro del enlace; revisa la invitación antes de repetir. No se envió el correo.")
  }

  // Acceptance is a separate trusted workflow. Never overwrite profile authority.

  // 8. Deliver Invitation via Email (Out of Band Only)
  if (resendApiKey) {
    let deliveryError: unknown
    try {
      const resend = new Resend(resendApiKey)
      const delivery = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject: "Invitación a unirte a Clinia+",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #0A2E2A; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Clinia+</h1>
              <p style="color: #2dd4bf; margin: 10px 0 0 0; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Transformación Digital Clínica</p>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">¡Hola, ${escapeHtml(name)}!</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Has sido invitado a unirte al equipo clínico en <strong>Clinia+</strong> como <strong>${role === "doctor" ? "Especialista Clínico" : "Personal de Recepción"}</strong>.
              </p>
              <div style="text-align: center; margin: 40px 0;">
                <a href="${confirmUrl}" style="background-color: #0d9488; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(13, 148, 136, 0.2);">Aceptar Invitación</a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y abre este enlace en tu navegador:
                <br />
                <a href="${confirmUrl}" style="color: #0d9488; word-break: break-all;">${confirmUrl}</a>
              </p>
              <p style="font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 24px; padding: 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; text-align: center;">
                ⚠️ Por tu seguridad, este enlace expirará en 7 días.
              </p>
            </div>
          </div>
        `,
      })
      deliveryError = delivery.error
    } catch {
      // A transport failure does not prove the provider rejected the message.
      // Preserve the pending invitation to prevent a blind duplicate delivery.
      console.error("[InviteMember] Invitation delivery outcome unknown")
      throw new Error("No se pudo confirmar el envío; revisa la invitación antes de repetir.")
    }
    if (deliveryError) {
      const released = await releaseReservation(tokenHash)
      if (!released) {
        throw new Error("El proveedor rechazó el envío; no se pudo liberar la invitación pendiente. Revísala antes de repetir.")
      }
      throw new Error("El proveedor rechazó el envío de la invitación. Puedes volver a intentarlo.")
    }
  }

  // =========================================================================
  // 5. INVARIANT 5: NEVER return inviteLink, token, or hash in the response!
  // =========================================================================
  return { success: true }
}
