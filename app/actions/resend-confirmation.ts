'use server'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'
import { consumeEmailBudget } from '@/lib/server-email-gate'
import { configuredAuthOrigin, signupResendRedirect } from '@/lib/auth-email-contract'

export async function resendConfirmationEmail(email: string) {
  const input = z.string().trim().max(254).email().safeParse(email)
  if (!input.success) return { error: 'Correo electrónico inválido.' }
  const destination = input.data.toLowerCase()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const appUrl = configuredAuthOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (!url || !publicKey || !appUrl) {
    return { error: 'El envío de correos no está disponible. Intenta más tarde.' }
  }

  const budget = await consumeEmailBudget({ action: 'resend', headers: await headers(), destination })
  if (!budget.allowed) return { error: budget.message }

  try {
    const supabase = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    // Supported existing-account flow: no directory lookup or account creation.
    // Delivery uses the Auth SMTP confirmation template, not the signup Resend renderer.
    const { error } = await supabase.auth.resend({
      type: 'signup', email: destination,
      options: { emailRedirectTo: signupResendRedirect(appUrl) },
    })
    if (error) logger.warn('[Resend Confirmation] Provider outcome not confirmed')
  } catch {
    logger.warn('[Resend Confirmation] Provider outcome not confirmed')
  }

  // Request acknowledgement, never a delivery receipt or account-state claim.
  return { accepted: true as const }
}
