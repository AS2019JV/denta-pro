import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { safeAuthRedirect } from '@/lib/auth-redirect'
import { finishVerifiedEnrollment } from '@/lib/verified-enrollment'

/**
 * Modern Supabase Auth Confirmation Route
 * Handles both Email OTP (token_hash) and PKCE (code) flows.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeAuthRedirect(searchParams.get('next'))

  logger.info('[Auth Confirm] Confirmation request received', {
    type,
    hasTokenHash: Boolean(token_hash),
    hasCode: Boolean(code),
    next,
  })

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.search = ''

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
    logger.info('[Auth Confirm] Attempting OTP verification', { type })
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if ((!error || type === 'invite' || type === 'signup') && (await finishVerifiedEnrollment(supabase, type, token_hash)).success) {
      logger.info('[Auth Confirm] OTP verification successful', { redirectPath: next })
      return NextResponse.redirect(redirectTo)
    } else {
      logger.error('[Auth Confirm] Auth verification error (OTP)', { error: error?.message || 'Verification failed' })
    }
  }

  // 2. Handle PKCE Code (Code Exchange flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && (await finishVerifiedEnrollment(supabase, type, token_hash)).success) {
      logger.info('[Auth Confirm] Code exchange successful', { redirectPath: next })
      return NextResponse.redirect(redirectTo)
    } else {
      logger.error('[Auth Confirm] Auth verification error (Code)', { error: error?.message || 'Code exchange failed' })
    }
  }

  // Handle general Auth errors
  redirectTo.pathname = '/login'
  // Look for token expiration keywords in error
  const errorMessage = code ? 'Auth code error' : 'Auth verification failed'
  redirectTo.searchParams.set('error', 'expired') // Pass a generic keyword to frontend
  
  return NextResponse.redirect(redirectTo)
}
