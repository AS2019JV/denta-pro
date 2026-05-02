import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Modern Supabase Auth Confirmation Route
 * Handles both Email OTP (token_hash) and PKCE (code) flows.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  console.log('[Auth Confirm] Full Search Params:', Object.fromEntries(searchParams.entries()))
  
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('code')

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // 1. Handle Token Hash (Email OTP flow)
  if (token_hash && type) {
    console.log('[Auth Confirm] Attempting to verify OTP with type:', type, 'and token_hash:', token_hash)
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      console.log('[Auth Confirm] OTP verification successful! Redirecting to:', redirectTo.href)
      // Re-verify if we need to do anything else (e.g. clinic creation trigger should handle it)
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('[Auth Confirm] Auth verification error (OTP):', JSON.stringify(error, null, 2))
    }
  }

  // 2. Handle PKCE Code (Code Exchange flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('Auth verification error (Code):', error)
    }
  }

  // Handle general Auth errors
  redirectTo.pathname = '/login'
  // Look for token expiration keywords in error
  const errorMessage = code ? 'Auth code error' : 'Auth verification failed'
  redirectTo.searchParams.set('error', 'expired') // Pass a generic keyword to frontend
  
  return NextResponse.redirect(redirectTo)
}
