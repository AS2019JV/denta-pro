import 'server-only'
import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { createClient } from '@supabase/supabase-js'

type EmailAction = 'signup' | 'resend' | 'invite' | 'transactional'
type RequestHeaders = { get(name: string): string | null }
type GateResult = { allowed: true } | {
  allowed: false; status: 403 | 429 | 503; message: string; retryAfter?: number
}
const unavailable = (): GateResult => ({ allowed: false, status: 503,
  message: 'El envío de correos no está disponible. Intenta más tarde.' })
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
function httpsOrigin(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && parsed.pathname === '/' && !parsed.search && !parsed.hash
  } catch { return false }
}

/** Reserve a durable budget before any provider side effect. No local fallback. */
export async function consumeEmailBudget(input: {
  action: EmailAction; headers: RequestHeaders; destination: string;
  actorId?: string; clinicId?: string; bearer?: boolean
}): Promise<GateResult> {
  try {
    const secret = process.env.EMAIL_ABUSE_HASH_SECRET
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendKey = process.env.RESEND_API_KEY
    const rawFrom = process.env.RESEND_FROM_EMAIL
    if (rawFrom && /[\r\n]/.test(rawFrom)) return unavailable()
    const from = rawFrom?.trim()
    // Explicit sender configuration is mandatory; provider verification remains
    // a deployment check. Reject header characters and malformed addresses.
    const sender = from?.match(/^(?:[^<>\r\n]+<([^<>\r\n]+)>|([^<>\r\n]+))$/)
    const senderAddress = (sender?.[1] ?? sender?.[2])?.trim()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    // Only this documented ingress is trusted. Self-hosted deployments require
    // an independently verified proxy contract before enabling dispatch.
    if (process.env.CLINIA_EMAIL_ENABLED !== '1' || process.env.VERCEL !== '1'
      || !secret || Buffer.byteLength(secret, 'utf8') < 32 || !url || !key || !resendKey || !appUrl
      || !senderAddress || senderAddress.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)
      || !httpsOrigin(url) || !httpsOrigin(appUrl)) return unavailable()

    if (!(input.action === 'transactional' && input.bearer)
      && input.headers.get('origin') !== new URL(appUrl).origin) {
      return { allowed: false, status: 403, message: 'La solicitud debe venir del sitio autorizado.' }
    }
    // Vercel overwrites this header at its edge. Never trust x-real-ip or the
    // leftmost member of an arbitrary forwarded chain; refuse ambiguity.
    const ip = input.headers.get('x-vercel-forwarded-for')?.trim().toLowerCase()
    if (!ip || !isIP(ip)) return unavailable()
    const destination = input.destination.trim().toLowerCase()
    if (destination.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return unavailable()
    const authenticated = input.action === 'invite' || input.action === 'transactional'
    if (authenticated && (!input.actorId || !uuid.test(input.actorId) || !input.clinicId || !uuid.test(input.clinicId))) return unavailable()
    const digest = (type: string, value: string) => createHmac('sha256', secret).update(`${type}:${value}`).digest('hex')
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const { data, error } = await admin.rpc('consume_email_abuse_budget', {
      p_action: input.action,
      p_ip_hash: digest('ip', ip),
      p_destination_hash: digest('destination', destination),
      p_actor_id: authenticated ? input.actorId : null,
      p_clinic_id: authenticated ? input.clinicId : null,
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.allowed !== 'boolean' || !Number.isInteger(data.retry_after_seconds)) return unavailable()
    if (data.allowed === true && data.retry_after_seconds === 0) return { allowed: true }
    if (data.allowed === false && data.retry_after_seconds >= 1 && data.retry_after_seconds <= 86400) {
      return { allowed: false, status: 429, retryAfter: data.retry_after_seconds,
        message: 'Se alcanzó el límite de solicitudes de correo. Intenta más tarde.' }
    }
    return unavailable()
  } catch { return unavailable() }
}
