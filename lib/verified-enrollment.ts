import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Ordinary authenticated client only; the DB derives identity and authority. */
export async function finishVerifiedEnrollment(client: SupabaseClient, type?: string | null, token?: string | null) {
  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user?.email_confirmed_at || !user.email) return { success: false as const }
    if (type === 'invite') {
      if (typeof token !== 'string' || token.length < 1 || token.length > 512) return { success: false as const }
      const result = await client.rpc('redeem_verified_clinic_invitation', { p_token: token })
      return { success: !result.error && typeof result.data === 'string' }
    }
    if (type && !['signup', 'email'].includes(type)) {
      return { success: ['recovery', 'magiclink', 'email_change'].includes(type) }
    }
    const result = await client.rpc('complete_verified_clinic_registration')
    // NULL is the expected no-op for an existing account without an intent.
    return { success: !result.error && (result.data === null || typeof result.data === 'string') }
  } catch { return { success: false as const } }
}
