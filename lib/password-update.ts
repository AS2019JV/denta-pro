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
