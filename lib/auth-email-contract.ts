/** Resend renders signup/invite; Supabase SMTP renders the recovery template. */
export const AUTH_EMAIL_CONTRACT = Object.freeze({
  signup: { provider: 'resend', template: 'emails/signup-confirmation.html', type: 'signup', next: '/dashboard' },
  invite: { provider: 'resend', template: 'server-action', type: 'invite', next: '/dashboard' },
  recovery: { provider: 'supabase-smtp', template: 'emails/reset-password.html', type: 'recovery', next: '/update-password' },
})

export function configuredAuthOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.pathname === '/' && !url.search && !url.hash ? url.origin : null
  } catch { return null }
}

export function validEmailToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_+/.=-]{1,2048}$/.test(value)
}

export function authEmailLink(origin: string, token: string, type: 'signup' | 'invite'): string {
  const configured = configuredAuthOrigin(origin)
  if (!configured || !validEmailToken(token) || !['signup', 'invite'].includes(type)) {
    throw new Error('No se pudo preparar el enlace de autenticación.')
  }
  const url = new URL('/auth/confirm', configured)
  url.searchParams.set('token_hash', token)
  url.searchParams.set('type', type)
  url.searchParams.set('next', AUTH_EMAIL_CONTRACT[type].next)
  return url.href
}
