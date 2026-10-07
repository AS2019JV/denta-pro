import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { privateMediaDeliveryHandler, ordinaryPrivateMediaAuthority } from '@/lib/private-media-delivery.mjs'
import { downloadPrivateMedia } from '@/lib/private-media-transport'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  let caller: SupabaseClient | null = null
  let explicitBearer: string | null = null
  const handler = privateMediaDeliveryHandler({
    appOrigin: env.NEXT_PUBLIC_APP_URL, providerOrigin: env.NEXT_PUBLIC_SUPABASE_URL,
    authority: async (_request, bearer, signal) => {
      explicitBearer = bearer
      const guardedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal, cache: 'no-store', redirect: 'error' })
      if (bearer) {
        caller = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${bearer}` }, fetch: guardedFetch },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
      } else {
        const store = await cookies()
        caller = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          global: { fetch: guardedFetch },
          cookies: { getAll: () => store.getAll(), setAll: values => values.forEach(value => store.set(value.name, value.value, value.options)) },
        })
      }
      return ordinaryPrivateMediaAuthority(caller, bearer, signal, env.NEXT_PUBLIC_SUPABASE_URL)
    },
    download: (bucket, path, signal) => {
      if (!caller) throw new Error('Image authority absent')
      return downloadPrivateMedia(caller, bucket, path, signal, explicitBearer)
    },
  })
  return handler(request)
}

// Non-POST denials also carry the same no-store headers.
export const GET = POST
export const HEAD = POST
