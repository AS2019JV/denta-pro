'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { finishVerifiedEnrollment } from '@/lib/verified-enrollment'
import { SYNTHETIC_PILOT } from '@/lib/pilot-policy'

export async function completeVerifiedEnrollment(type?: string | null, token?: string | null) {
  if (SYNTHETIC_PILOT && (!type || ['signup', 'email'].includes(type))) return { success: false }
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { success: false }
  const client = createServerClient(url, key, { cookies: {
    getAll: () => cookieStore.getAll(),
    setAll(values) { values.forEach(({name,value,options}) => cookieStore.set(name,value,options)) },
  } })
  return finishVerifiedEnrollment(client, type, token)
}
