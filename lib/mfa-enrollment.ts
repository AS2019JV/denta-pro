import type { SupabaseClient } from '@supabase/supabase-js'

type EnrollmentFactor = { id: string; friendly_name?: string | null }
type RecoveryState = { kind: 'enroll' | 'pending' | 'blocked' } | { kind: 'challenge'; factors: EnrollmentFactor[] }

/** Read-only reconciliation after an unknown provider outcome. Never retries a mutation. */
export async function getEnrollmentRecoveryState(client: Pick<SupabaseClient, 'auth' | 'rpc'>): Promise<RecoveryState> {
  try {
    const [identity, claims, assurance, listed, live] = await Promise.all([
      client.auth.getUser(), client.auth.getClaims(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors(),
      client.rpc('clinia_session_active'),
    ])
    const user = identity.data?.user
    const jwt = claims.data?.claims
    const factors = listed.data?.all
    if (identity.error || !user?.email_confirmed_at || claims.error || !jwt
      || jwt.sub !== user.id || jwt.role !== 'authenticated' || jwt.is_anonymous === true
      || jwt.aal !== 'aal1' || assurance.error || assurance.data?.currentLevel !== 'aal1'
      || live.error || live.data !== true || listed.error || !Array.isArray(factors)) return { kind: 'blocked' }
    const verified = factors.filter(factor => factor.status === 'verified')
    const totp = verified.filter(factor => factor.factor_type === 'totp')
    if (totp.length) return { kind: 'challenge', factors: totp.map(({ id, friendly_name }) => ({ id, friendly_name })) }
    if (verified.length || assurance.data?.nextLevel !== 'aal1') return { kind: 'blocked' }
    return { kind: factors.some(factor => factor.factor_type === 'totp' && factor.status === 'unverified') ? 'pending' : 'enroll' }
  } catch { return { kind: 'blocked' } }
}

/** User-initiated cancellation of an unfinished first TOTP enrollment only.
 * No admin client, caller-supplied factor ID, verified-factor removal or AAL bypass.
 * Supabase additionally requires AAL2 to unenroll a factor verified concurrently.
 */
export async function cancelPendingTotpEnrollment(client: Pick<SupabaseClient, 'auth' | 'rpc'>): Promise<boolean> {
  try {
    const [identity, claims, assurance, listed, live] = await Promise.all([
      client.auth.getUser(), client.auth.getClaims(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors(),
      client.rpc('clinia_session_active'),
    ])
    const user = identity.data?.user
    const jwt = claims.data?.claims
    const factors = listed.data?.all
    if (identity.error || !user?.email_confirmed_at || claims.error || !jwt
      || jwt.sub !== user.id || jwt.role !== 'authenticated' || jwt.aal !== 'aal1'
      || jwt.is_anonymous === true || assurance.error || assurance.data?.currentLevel !== 'aal1'
      || assurance.data?.nextLevel !== 'aal1' || live.error || live.data !== true
      || listed.error || !Array.isArray(factors) || factors.some(factor => factor.status === 'verified')) return false

    const pending = factors.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified')
    if (!pending.length || new Set(pending.map(factor => factor.id)).size !== pending.length) return false

    for (const factor of pending) {
      // Re-read just before each mutation; never use a pending status from page load.
      const current = await client.auth.mfa.listFactors()
      if (current.error || !current.data?.all || current.data.all.some(item => item.status === 'verified')
        || !current.data.all.some(item => item.id === factor.id && item.factor_type === 'totp' && item.status === 'unverified')) return false
      const removed = await client.auth.mfa.unenroll({ factorId: factor.id })
      if (removed.error || removed.data?.id !== factor.id) return false
    }

    const after = await client.auth.mfa.listFactors()
    return !after.error && Array.isArray(after.data?.all)
      && !after.data.all.some(factor => factor.status === 'verified'
        || (factor.factor_type === 'totp' && factor.status === 'unverified'))
  } catch { return false }
}
