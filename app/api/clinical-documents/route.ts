import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { documentDeliveryHandler, type DocumentScope } from '@/lib/clinical-document-delivery.mjs'
import { deliveryTokenCache } from '@/lib/clinical-document-principal.mjs'
import { env } from '@/lib/env'
import { downloadStorageOrigin } from '@/lib/storage-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30
const deliveryToken = deliveryTokenCache()

export async function POST(request: Request) {
  // Per request: neither caller authority nor clinical bytes are shared/cached.
  let delivery: SupabaseClient | null = null
  let transportToken: string | null = null
  let caller: SupabaseClient | null = null
  const guardedFetch = (signal: AbortSignal) => (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal, cache: 'no-store', redirect: 'error' })
  async function machine(signal: AbortSignal) {
    if (delivery) return delivery
    const email = process.env.CLINIA_DOCUMENT_DELIVERY_EMAIL
    const password = process.env.CLINIA_DOCUMENT_DELIVERY_PASSWORD
    const subject = process.env.CLINIA_DOCUMENT_DELIVERY_USER_ID
    if (!email || !password || !subject) throw new Error('Delivery principal unconfigured')
    transportToken = await deliveryToken(subject, async () => {
      // Shared login has its own deadline; canceling one caller cannot cancel
      // another caller's transport login. Each caller still has its own wait.
      const loginSignal = AbortSignal.timeout(10000)
      const loginClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }, global: { fetch: guardedFetch(loginSignal) },
      })
      const login = await loginClient.auth.signInWithPassword({ email, password })
      if (login.error || login.data.user?.id !== subject || !login.data.session) throw new Error('Delivery denied')
      return login.data.session.access_token
    }, signal)
    delivery = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${transportToken}` }, fetch: guardedFetch(signal) },
    })
    return delivery
  }
  const handler = documentDeliveryHandler({
    appOrigin: env.NEXT_PUBLIC_APP_URL, providerOrigin: env.NEXT_PUBLIC_SUPABASE_URL,
    authority: async (_request, bearer, signal) => {
      const store = await cookies()
      const client = bearer ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` }, fetch: guardedFetch(signal) },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }) : createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch: guardedFetch(signal) }, cookies: { getAll: () => store.getAll(), setAll: values => values.forEach(v => store.set(v.name, v.value, v.options)) },
      })
      let pinnedIdentity: string | null = null
      caller = client
      return { authorize: async (scope: DocumentScope) => {
        const identity = bearer ? await client.auth.getUser(bearer) : await client.auth.getUser()
        if (identity.error || !identity.data.user) return null
        // The pinned Auth SDK can throw a plain Error for expired JWTs instead
        // of returning claims.error. Unverifiable claims never establish
        // authority; request cancellation still follows the deadline path.
        let claims
        try { claims = bearer ? await client.auth.getClaims(bearer) : await client.auth.getClaims() }
        catch { signal.throwIfAborted(); return null }
        const uid = identity.data.user?.id, sessionId = claims.data?.claims.session_id
        if (identity.error || claims.error || !uid || typeof sessionId !== 'string' || claims.data?.claims.role !== 'authenticated') return null
        const key = `${uid}:${sessionId}`
        if (pinnedIdentity !== null && pinnedIdentity !== key) return null
        pinnedIdentity = key
        const [live, profile, role, subscription, file, patient] = await Promise.all([
          client.rpc('clinia_session_active'),
          client.from('profiles').select('id').eq('id', uid).eq('status', 'active').is('deleted_at', null).maybeSingle(),
          client.rpc('get_clinic_member_role', { check_clinic_id: scope.clinicId }),
          client.rpc('check_subscription_active', { check_clinic_id: scope.clinicId }),
          client.from('patient_files').select('id,delivery_path,name').eq('id', scope.fileId).eq('clinic_id', scope.clinicId).eq('patient_id', scope.patientId).is('deleted_at', null).maybeSingle(),
          client.from('patients').select('id').eq('id', scope.patientId).eq('clinic_id', scope.clinicId).is('deleted_at', null).maybeSingle(),
        ])
        if (live.error || live.data !== true || profile.error || !profile.data || role.error || !['doctor', 'clinic_owner'].includes(role.data)
          || subscription.error || subscription.data !== true || file.error || !file.data || patient.error || !patient.data) return null
        return { userId: uid, sessionId, path: file.data.delivery_path, name: file.data.name }
      } }
    },
    deliveryActive: async signal => { const check = await (await machine(signal)).rpc('clinia_document_delivery_active'); return !check.error && check.data === true },
    recordAccess: async (scope, path) => {
      if (!caller) return false
      const result = await caller.rpc('clinia_audit_document_delivery', {
        p_clinic_id: scope.clinicId, p_patient_id: scope.patientId, p_file_id: scope.fileId, p_path: path,
      })
      return !result.error && result.data === true
    },
    download: async (path, signal) => {
      const client = await machine(signal), check = await client.rpc('clinia_document_delivery_active')
      if (check.error || check.data !== true) throw new Error('Delivery disabled')
      if (!transportToken) throw new Error('Delivery session absent')
      return downloadStorageOrigin('patient-files', path, transportToken, signal)
    },
  })
  return handler(request)
}
