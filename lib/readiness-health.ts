import 'server-only'

type HealthInput = {
  CLINIA_HEALTH_ENABLED?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
}
export type Readiness = { status: 'ok' | 'unavailable'; scope: 'application-auth' }
const unavailable = (): Readiness => ({ status: 'unavailable', scope: 'application-auth' })

function publicKey(value: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'anon' }
  catch { return false }
}

/** A narrow readiness probe, not clinical, RLS, Storage, email or release proof. */
export async function probeReadiness(input: HealthInput, send: typeof fetch = fetch): Promise<Readiness> {
  if (input.CLINIA_HEALTH_ENABLED !== '1') return unavailable()
  try {
    const origin = new URL(input.NEXT_PUBLIC_SUPABASE_URL || '')
    const key = input.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    // The current product uses hosted Supabase. No custom targets or caller URLs.
    if (origin.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(origin.hostname)
      || origin.port || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || !publicKey(key)) return unavailable()
    const response = await send(origin.origin + '/auth/v1/health', {
      method: 'GET', headers: { apikey: key, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
    })
    if (response.status !== 200 || !/^application\/json\b/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel()
      return unavailable()
    }
    const reader = response.body?.getReader()
    if (!reader) return unavailable()
    const chunks: Uint8Array[] = []; let total = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > 4096) { await reader.cancel(); return unavailable() }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || !('version' in data) || typeof data.version !== 'string' || !data.version
      || !('name' in data) || typeof data.name !== 'string' || !data.name) return unavailable()
    return { status: 'ok', scope: 'application-auth' }
  } catch { return unavailable() }
}
