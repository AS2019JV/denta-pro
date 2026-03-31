import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'

// Ensure we ALWAYS have truthy strings to prevent Next.js build crash during prerendering.
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createBrowserClient(
  supabaseUrl, 
  supabaseAnonKey
)
