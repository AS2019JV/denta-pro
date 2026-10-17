import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { consumeEmailBudget } from '@/lib/server-email-gate'

// ============================================================================
// SEC-10: Email Endpoint Authentication, Rate Limiting & Relay Defense
// ============================================================================

const ALLOWED_TEMPLATES = [
  'appointment_reminder',
  'welcome',
  'prescription_ready',
  'recall_notice',
] as const

type AllowedTemplate = (typeof ALLOWED_TEMPLATES)[number]
const EMAIL_ROLES = ['clinic_owner', 'doctor', 'receptionist'] as const

const ALLOWED_LINK_HOSTS = [
  'localhost',
  '127.0.0.1',
  'cliniaplus.com',
  'www.cliniaplus.com',
  'denta-pro.vercel.app',
]

function isAllowedLinkHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false
  const host = hostname.toLowerCase().replace(/\.+$/, '')
  if (ALLOWED_LINK_HOSTS.includes(host)) {
    return true
  }
  if (host.endsWith('.cliniaplus.com')) {
    const subdomain = host.slice(0, -'.cliniaplus.com'.length)
    if (
      subdomain.length > 0 &&
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(subdomain)
    ) {
      return true
    }
  }
  // If specific Supabase project URL is configured, allow only that exact project host
  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (configuredSupabaseUrl) {
    try {
      const parsed = new URL(configuredSupabaseUrl)
      if (host === parsed.hostname.toLowerCase().replace(/\.+$/, '')) {
        return true
      }
    } catch {
      // Ignored
    }
  }
  return false
}

function getByteLength(str: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8')
  }
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length
  }
  return encodeURIComponent(str).replace(/%[A-F\d]{2}/gi, 'U').length
}

function findOversizedVariable(obj: Record<string, any>): string | null {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > 2048) {
      return k
    }
    if (v && typeof v === 'object') {
      const nested = findOversizedVariable(v)
      if (nested) return `${k}.${nested}`
    }
  }
  return null
}

/**
 * Escapes unsafe characters for HTML inclusion to prevent template injection
 */
function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Renders approved transactional templates with sanitized variables
 */
function renderTemplate(
  tpl: AllowedTemplate,
  vars: Record<string, any> = {}
): { subject: string; html: string } {
  const safeVars = vars || {}
  const patientName = escapeHtml(safeVars.name || safeVars.patientName || 'Estimado(a) Paciente')
  const date = escapeHtml(safeVars.date || safeVars.appointmentDate || '')
  const clinicName = escapeHtml(safeVars.clinicName || 'Clinia+')
  const doctorName = escapeHtml(safeVars.doctorName || '')
  const rawLink = safeVars.link || safeVars.paymentLink || safeVars.url || ''
  let sanitizedLink = ''
  if (typeof rawLink === 'string' && rawLink.trim()) {
    try {
      const parsedUrl = new URL(rawLink.trim())
      if (
        (parsedUrl.protocol === 'https:' ||
          (['localhost', '127.0.0.1'].includes(parsedUrl.hostname) &&
            parsedUrl.protocol === 'http:')) &&
        isAllowedLinkHost(parsedUrl.hostname)
      ) {
        sanitizedLink = escapeHtml(parsedUrl.toString())
      }
    } catch {
      sanitizedLink = ''
    }
  }
  const link = sanitizedLink

  switch (tpl) {
    case 'appointment_reminder':
      return {
        subject: `Recordatorio de Cita - ${clinicName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="margin-bottom: 20px;">
              <span style="font-size: 18px; font-weight: 700; color: #0f172a;">${clinicName}</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">Recordatorio de Cita Odontológica</h2>
            <p>Estimado(a) <strong>${patientName}</strong>,</p>
            <p>Le recordamos que tiene una consulta programada${date ? ` para la fecha: <strong>${date}</strong>` : ''}.</p>
            ${doctorName ? `<p>Profesional tratante: <strong>${doctorName}</strong></p>` : ''}
            <p>Por favor preséntese 10 minutos antes de la hora indicada. Si requiere reprogramar su turno, contáctenos con anticipación.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              Notificación oficial emitida en conformidad con los estándares de confidencialidad clínica y la LOPDP (Ecuador).
            </p>
          </div>
        `,
      }

    case 'welcome':
      return {
        subject: `Bienvenido(a) a ${clinicName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">¡Bienvenido(a) a ${clinicName}!</h2>
            <p>Estimado(a) <strong>${patientName}</strong>,</p>
            <p>Su ficha de paciente ha sido habilitada exitosamente en nuestro sistema de atención odontológica integral.</p>
            <p>Nos comprometemos a brindarle el más alto estándar de cuidado para su salud bucodental.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #64748b;">Atentamente, el equipo clínico de ${clinicName}.</p>
          </div>
        `,
      }

    case 'prescription_ready':
      return {
        subject: `Receta Odontológica Digital - ${clinicName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">Receta Médica Emitida</h2>
            <p>Estimado(a) <strong>${patientName}</strong>,</p>
            <p>Su profesional tratante en <strong>${clinicName}</strong> ha emitido su receta médica digital oficial.</p>
            ${link ? `<p><a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500;">Descargar Receta (PDF)</a></p>` : ''}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #64748b;">Documento médico con validez sanitaria según normativa nacional (MSP / SENESCYT).</p>
          </div>
        `,
      }

    case 'recall_notice':
      return {
        subject: `Control Preventivo Periódico - ${clinicName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">Tiempo para su Control Bucal Semestral</h2>
            <p>Estimado(a) <strong>${patientName}</strong>,</p>
            <p>De acuerdo con su historial clínico en <strong>${clinicName}</strong>, se recomienda realizar su chequeo preventivo periódico y profilaxis dental.</p>
            <p>La prevención regular previene patologías periodontales y caries avanzadas.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #64748b;">Comuníquese con nuestra recepción para agendar su horario preferido.</p>
          </div>
        `,
      }
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.match(/^Bearer ([^\s]+)$/i)?.[1]
    // Explicit Authorization never falls back to an unrelated browser session.
    if (authHeader !== null && !bearer) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Authorization header' }, { status: 401 })
    }
    if (!bearer && request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Forbidden: Same-origin request required' }, { status: 403 })
    }
    // 2. SEC-10: Authenticate Session via createServerClient + cookies() / Bearer
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Authentication service not configured' }, { status: 503 })
    }

    const supabase = bearer ? createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) : createServerClient(supabaseUrl, supabaseAnonKey, {
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
            // Ignored in route handlers
          }
        },
      },
    })

    const { data: identity, error: identityError } = await supabase.auth.getUser(bearer)
    const caller = identity?.user
    if (identityError || !caller?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      )
    }

    // 3. SEC-10: Parse and Validate Payload
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 65536) {
      return NextResponse.json(
        { error: 'Bad Request: Payload exceeds size limit of 64KB' },
        { status: 400 }
      )
    }

    const rawBody = await request.text().catch(() => null)
    if (rawBody === null) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid JSON body' },
        { status: 400 }
      )
    }

    if (getByteLength(rawBody) > 65536) {
      return NextResponse.json(
        { error: 'Bad Request: Payload exceeds size limit of 64KB' },
        { status: 400 }
      )
    }

    let body: any = null
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: 'Bad Request: Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Bad Request: Invalid JSON body' },
        { status: 400 }
      )
    }

    // Invariant: Reject arbitrary caller-supplied HTML
    if (body.html) {
      return NextResponse.json(
        { error: 'Bad Request: Arbitrary HTML messages are forbidden. Enforce pre-approved templates.' },
        { status: 400 }
      )
    }

    if (
      typeof body.message === 'string' &&
      (/<[a-z][\s\S]*>/i.test(body.message) || /<script/i.test(body.message))
    ) {
      return NextResponse.json(
        { error: 'Bad Request: Arbitrary HTML messages are forbidden. Enforce pre-approved templates.' },
        { status: 400 }
      )
    }

    const to = (typeof body.to === 'string' ? body.to : '').trim().toLowerCase()
    const template = (
      typeof body.template === 'string'
        ? body.template
        : typeof body.templateId === 'string'
          ? body.templateId
          : ''
    ).trim()

    if (
      body.variables !== undefined &&
      body.variables !== null &&
      (typeof body.variables !== 'object' || Array.isArray(body.variables))
    ) {
      return NextResponse.json(
        { error: 'Bad Request: Template variables must be an object' },
        { status: 400 }
      )
    }

    if (
      body.templateParams !== undefined &&
      body.templateParams !== null &&
      (typeof body.templateParams !== 'object' || Array.isArray(body.templateParams))
    ) {
      return NextResponse.json(
        { error: 'Bad Request: Template variables must be an object' },
        { status: 400 }
      )
    }

    const variables =
      body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables)
        ? body.variables
        : body.templateParams && typeof body.templateParams === 'object' && !Array.isArray(body.templateParams)
          ? body.templateParams
          : {}

    // Invariant: Reject string variables if any individual variable value exceeds 2048 characters
    const oversizedKey =
      findOversizedVariable(variables) ||
      (body.templateParams && typeof body.templateParams === 'object'
        ? findOversizedVariable(body.templateParams)
        : null)
    if (oversizedKey) {
      return NextResponse.json(
        { error: `Bad Request: Template variable '${oversizedKey}' exceeds maximum length of 2048 characters` },
        { status: 400 }
      )
    }

    // M6-GAP-03: Enforce explicit link destination validation
    const linkContainers: Array<Record<string, any>> = [variables, body]
    if (
      body.templateParams &&
      typeof body.templateParams === 'object' &&
      !Array.isArray(body.templateParams)
    ) {
      linkContainers.push(body.templateParams)
    }
    const linkKeys = ['link', 'paymentLink', 'url'] as const
    for (const container of linkContainers) {
      for (const key of linkKeys) {
        const linkCandidate = container[key]
        if (linkCandidate !== undefined && linkCandidate !== null) {
          if (typeof linkCandidate !== 'string') {
            return NextResponse.json(
              { error: 'Bad Request: Untrusted or invalid link destination host' },
              { status: 400 }
            )
          }
          if (linkCandidate.trim().length > 0) {
            let parsedUrl: URL
            try {
              parsedUrl = new URL(linkCandidate.trim())
            } catch {
              return NextResponse.json(
                { error: 'Bad Request: Untrusted or invalid link destination host' },
                { status: 400 }
              )
            }

            const isHttpLocal =
              parsedUrl.protocol === 'http:' &&
              (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')
            const isHttps = parsedUrl.protocol === 'https:'

            if (
              !(
                parsedUrl.protocol === 'https:' ||
                (['localhost', '127.0.0.1'].includes(parsedUrl.hostname) &&
                  parsedUrl.protocol === 'http:')
              ) ||
              !isAllowedLinkHost(parsedUrl.hostname)
            ) {
              return NextResponse.json(
                { error: 'Bad Request: Untrusted or invalid link destination host' },
                { status: 400 }
              )
            }
          }
        }
      }
    }

    if (!to || !template) {
      return NextResponse.json(
        { error: 'Bad Request: Missing required fields (to, template)' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid recipient email address format' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TEMPLATES.includes(template as AllowedTemplate)) {
      return NextResponse.json(
        {
          error: `Bad Request: Invalid template '${template}'. Allowed: ${ALLOWED_TEMPLATES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Clinic selection is navigation state; only the live role RPC grants access.
    let callerClinicId: unknown = body.clinicId !== undefined ? body.clinicId
      : !bearer ? cookieStore.getAll().find(cookie => cookie.name === 'clinia-clinic')?.value : undefined
    if (callerClinicId === undefined) {
      const { data, error } = await supabase.rpc('get_user_clinic_id')
      if (error) return NextResponse.json({ error: 'Forbidden: Unable to verify clinic' }, { status: 403 })
      callerClinicId = data
    }
    if (typeof callerClinicId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(callerClinicId)) {
      return NextResponse.json({ error: 'Forbidden: Caller is not associated with an active clinic' }, { status: 403 })
    }
    const { data: liveRole, error: authorityError } = await supabase.rpc('get_clinic_member_role', { check_clinic_id: callerClinicId })
    if (authorityError || !EMAIL_ROLES.includes(liveRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Caller is not an active member of this clinic' },
        { status: 403 }
      )
    }

    // 5. SEC-10: Verify Recipient Belongs to Caller's Clinic (Exact Equality Match)
    let isAuthorizedRecipient = false

    const dbClient =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } }
          )
        : supabase

    // A. Check if recipient is a patient of the caller's clinic (exact match, not soft-deleted)
    const patientQuery = dbClient
      .from('patients')
      .select('id, email')
      .eq('clinic_id', callerClinicId)
      .eq('email', to)
      .is('deleted_at', null)

    const { data: patientRecord, error: patientError } = await patientQuery.maybeSingle()
    if (patientError) return NextResponse.json({ error: 'Unable to verify recipient' }, { status: 503 })

    if (patientRecord) {
      isAuthorizedRecipient = true
    }

    // B. Staff recipients require live membership and an active, non-deleted profile.
    if (!isAuthorizedRecipient) {
      const { data: memberRecords, error: memberError } = await dbClient
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', callerClinicId)
        .eq('status', 'active')
      if (memberError) return NextResponse.json({ error: 'Unable to verify recipient' }, { status: 503 })

      if (memberRecords && memberRecords.length > 0) {
        const userIds = memberRecords.map((m: any) => m.user_id)
        const { data: matchedProfile, error: profileError } = await dbClient
          .from('profiles')
          .select('id')
          .in('id', userIds)
          .eq('email', to)
          .eq('status', 'active')
          .is('deleted_at', null)
          .maybeSingle()
        if (profileError) return NextResponse.json({ error: 'Unable to verify recipient' }, { status: 503 })

        if (matchedProfile) {
          isAuthorizedRecipient = true
        }
      }
    }

    if (!isAuthorizedRecipient) {
      return NextResponse.json(
        { error: 'Forbidden: Recipient email is not associated with this clinic' },
        { status: 403 }
      )
    }

    // 6. SEC-10: Render Safe Pre-Approved Template
    const { subject, html } = renderTemplate(template as AllowedTemplate, variables)

    // 7. Dispatch via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.warn('[Email Service] RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 503 }
      )
    }

    const budget = await consumeEmailBudget({ action: 'transactional', headers: request.headers,
      destination: to, actorId: caller.id, clinicId: callerClinicId, bearer: Boolean(bearer) })
    if (!budget.allowed) return NextResponse.json({ error: budget.message }, {
      status: budget.status,
      headers: budget.retryAfter ? { 'Retry-After': String(budget.retryAfter) } : undefined,
    })
    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL!

    const { data, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
    })

    if (sendError) {
      console.error('[Resend Error]', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data,
      messageId: data?.id || `msg_${Date.now()}`,
    })
  } catch (error: any) {
    console.error('[Email Service Error]', error)
    const isDev = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      { error: isDev && error.message ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
