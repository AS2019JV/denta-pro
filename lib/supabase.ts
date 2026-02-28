import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'

// Ensure we ALWAYS have truthy strings to prevent Next.js build crash during prerendering.
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') 
  ? env.NEXT_PUBLIC_SUPABASE_URL 
  : 'https://placeholder.supabase.co'
  
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 5
  ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  : 'placeholder_anon_key'

export const supabase = createBrowserClient(
  supabaseUrl, 
  supabaseAnonKey
)
