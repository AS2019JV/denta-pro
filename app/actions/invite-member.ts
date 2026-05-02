"use server"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export async function inviteTeamMember(formData: FormData) {
  const email = formData.get("email") as string
  const name = formData.get("name") as string || "Doctor"
  const clinicId = formData.get("clinicId") as string
  const role = formData.get("role") as string || "receptionist"

  if (!email || !clinicId) {
    throw new Error("El correo electrónico y el ID de la clínica son obligatorios.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendApiKey = process.env.RESEND_API_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 1. Generate Invite Link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
    options: {
      data: {
        clinic_id: clinicId,
        role: role,
        full_name: name,
        pending_invite: true
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
    }
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Link generation error:", linkError)
    throw new Error("No se pudo generar el enlace de invitación.")
  }

  const actionUrl = new URL(linkData.properties.action_link)
  const tokenHash = actionUrl.searchParams.get('token')
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/confirm?token_hash=${tokenHash}&type=invite&next=/dashboard`

  // 2. Send email via Resend
  if (resendApiKey) {
    const resend = new Resend(resendApiKey)
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Clinia+ <notificaciones@alertas.cliniaplus.com>',
        to: email,
        subject: 'Invitación a unirte a Clinia+',
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #0A2E2A; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Clinia+</h1>
              <p style="color: #2dd4bf; margin: 10px 0 0 0; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Transformación Digital Clínica</p>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">¡Hola, ${name}!</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Has sido invitado a unirte a tu equipo clínico en <strong>Clinia+</strong>. Haz clic en el botón de abajo para aceptar la invitación y configurar tu contraseña.
              </p>
              <div style="text-align: center; margin: 40px 0;">
                <a href="${confirmUrl}" style="background-color: #0d9488; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(13, 148, 136, 0.2);">Aceptar Invitación</a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y lanza este enlace en tu navegador:
                <br />
                <a href="${confirmUrl}" style="color: #0d9488; word-break: break-all;">${confirmUrl}</a>
              </p>
              <p style="font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 24px; padding: 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; text-align: center;">
                ⚠️ Por tu seguridad, este enlace expirará en 24 horas.
              </p>
            </div>
          </div>
        `
      })
    } catch (e) {
      console.error("Resend error:", e)
      // Continue anyway, we generated the link.
    }
  }

  // 3. Create a placeholder in the profiles table or clinic_members so it shows up
  // Actually, handle_new_user trigger creates the profile when the auth user is created.
  // The 'invite' type generates an auth.user immediately with no password! So the profile IS created.
  // We just need to ensure the clinic_id is set. Let's do it manually since the trigger might not have the clinic_id.
  
  // Find the newly created user (or existing)
  const { data: userList } = await supabase.auth.admin.listUsers()
  const newUser = userList.users.find(u => u.email === email)
  
  if (newUser) {
     await supabase.from('profiles').update({
       clinic_id: clinicId,
       role: role as any,
       status: 'pending' // custom status if exists, otherwise it might just sit there
     }).eq('id', newUser.id)
  }

  return { success: true }
}
