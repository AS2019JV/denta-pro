import type { SupabaseClient } from '@supabase/supabase-js'

/** Only this fixed return flow is supported; never forward arbitrary next URLs. */
export function mfaReturnPath(value: unknown): '/update-password' | '/dashboard' {
  return value === '/update-password' ? '/update-password' : '/dashboard'
}

/** Read-only preflight. The provider remains authoritative for updateUser. */
export async function passwordUpdateAccess(client: Pick<SupabaseClient, 'auth'>): Promise<'ready' | 'mfa' | 'login' | 'blocked'> {
  try {
    const [identity, claims, assurance, listed] = await Promise.all([
      client.auth.getUser(), client.auth.getClaims(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors(),
    ])
    const user = identity.data?.user
    const jwt = claims.data?.claims
    if (identity.error || !user?.email_confirmed_at || claims.error || !jwt
      || jwt.sub !== user.id || jwt.role !== 'authenticated' || jwt.is_anonymous === true) return 'login'
    if (assurance.error || listed.error || !Array.isArray(listed.data?.all)) return 'blocked'
    const current = assurance.data?.currentLevel
    const next = assurance.data?.nextLevel
    if (jwt.aal !== current) return 'blocked'
    const verified = listed.data.all.some(factor => factor.status === 'verified')
    if (verified && next === 'aal2') return current === 'aal2' ? 'ready' : current === 'aal1' ? 'mfa' : 'blocked'
    // First invitation before any verified factor can establish its password.
    // A stale AAL2 token after factor removal cannot use this path.
    return !verified && current === 'aal1' && next === 'aal1' ? 'ready' : 'blocked'
  } catch { return 'blocked' }
}

/** Never render provider messages: they may be empty JSON or contain internals. */
export function passwordUpdateErrorMessage(error: unknown): string {
  const detail = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; name?: unknown } : {}
  if (detail.code === 'same_password') return 'Elige una contraseña diferente de la anterior.'
  if (detail.code === 'weak_password') return 'La contraseña no cumple los requisitos de seguridad. Elige otra más segura de entre 12 y 128 caracteres.'
  if (detail.code === 'reauthentication_needed' || detail.code === 'reauthentication_not_valid'
    || detail.code === 'current_password_required' || detail.code === 'session_not_found'
    || detail.code === 'session_expired' || detail.status === 401) {
    return 'La sesión necesita verificarse de nuevo. Solicita un enlace nuevo de recuperación y completa MFA.'
  }
  if (detail.status === 429 || detail.code === 'over_request_rate_limit') return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
  if (detail.code === 'request_timeout' || detail.name === 'AuthRetryableFetchError'
    || detail.name === 'TypeError' || (typeof detail.status === 'number' && (detail.status === 0 || detail.status >= 500))) {
    return 'No pudimos confirmar el cambio de contraseña por un problema de conexión o del servicio. Antes de repetirlo, intenta iniciar sesión con la nueva contraseña; si no funciona, solicita un enlace nuevo de recuperación.'
  }
  return 'No se pudo actualizar la contraseña. Inténtalo más tarde o contacta con soporte@care.cliniaplus.com.'
}
