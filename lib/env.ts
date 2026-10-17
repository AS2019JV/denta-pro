/** Public configuration only. Never read or return server credentials here. */
type PublicInput = {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  NEXT_PUBLIC_APP_URL?: string
  NEXT_PUBLIC_INVOICE_PROVIDER?: string
  NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY?: string
  NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE?: string
  CLINIA_LOCAL_ACCEPTANCE?: string
  VERCEL?: string
}

function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return true
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false
  try {
    // Configuration privilege only; Supabase verifies the JWT signature.
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role === 'anon'
  } catch { return false }
}

function httpsOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}

export function readPublicEnv(input: PublicInput) {
  const supabaseUrl = input.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const appUrl = input.NEXT_PUBLIC_APP_URL ?? ''
  const publicKey = input.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const localRequested = input.NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE === '1'
  const offlineRequested = input.NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY === '1'
  if (input.VERCEL === '1' && (localRequested || offlineRequested || input.CLINIA_LOCAL_ACCEPTANCE === '1')) {
    throw new Error('Local verification configuration is forbidden on deployed Vercel applications')
  }
  const offline = offlineRequested && !localRequested
    && supabaseUrl === 'http://127.0.0.1:59999' && appUrl === 'http://127.0.0.1:59998'
    && publicKey === 'synthetic-offline-ci-key'
  const local = localRequested && !offlineRequested
    && (typeof window !== 'undefined' || input.CLINIA_LOCAL_ACCEPTANCE === '1')
    && supabaseUrl === 'http://127.0.0.1:56321' && appUrl === 'http://127.0.0.1:3400'
  const invalid: string[] = []
  if ((localRequested && !local) || (offlineRequested && !offline)) invalid.push('local verification mode')
  if (!local && !offline && !httpsOrigin(supabaseUrl)) invalid.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!local && !offline && !httpsOrigin(appUrl)) invalid.push('NEXT_PUBLIC_APP_URL')
  if (!offline && !isPublicKey(publicKey)) invalid.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (invalid.length) throw new Error(`Invalid public configuration: ${invalid.join(', ')}`)
  return Object.freeze({
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_INVOICE_PROVIDER: input.NEXT_PUBLIC_INVOICE_PROVIDER,
  })
}

// Static references allow Next.js to inline only the public values.
export const env = readPublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_INVOICE_PROVIDER: process.env.NEXT_PUBLIC_INVOICE_PROVIDER,
  NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY: process.env.NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY,
  NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE: process.env.NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE,
  CLINIA_LOCAL_ACCEPTANCE: process.env.CLINIA_LOCAL_ACCEPTANCE,
  VERCEL: process.env.VERCEL,
})
