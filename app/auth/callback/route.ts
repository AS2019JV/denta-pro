import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { safeAuthRedirect } from '@/lib/auth-redirect'
import { finishVerifiedEnrollment } from '@/lib/verified-enrollment'

/**
 * Standard Auth Callback Route
 * Handles redirects from Supabase after verification.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeAuthRedirect(searchParams.get('next'))

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
            // Ignore errors in server components/actions
          }
        },
      },
    }
  )

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && (await finishVerifiedEnrollment(supabase, type, token_hash)).success) return NextResponse.redirect(redirectTo)
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if ((!error || type === 'invite' || type === 'signup') && (await finishVerifiedEnrollment(supabase, type, token_hash)).success) return NextResponse.redirect(redirectTo)
  }

  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'Auth callback failed')
  return NextResponse.redirect(redirectTo)
}
