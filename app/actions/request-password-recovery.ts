'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { consumeEmailBudget } from '@/lib/server-email-gate'
import { configuredAuthOrigin, validEmailToken } from '@/lib/auth-email-contract'
import { escapeHtml } from '@/lib/html-escape'

/** Ordinary recovery token from Auth; same verified Resend delivery path as signup. */
export async function requestPasswordRecovery(email: string) {
  const parsed = z.string().trim().max(254).email().safeParse(email)
  if (!parsed.success) return { error: 'Correo electrónico inválido.' }
  const destination = parsed.data.toLowerCase()
  const origin = configuredAuthOrigin(process.env.NEXT_PUBLIC_APP_URL)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!origin || !url || !key) return { error: 'La recuperación no está disponible. Intenta más tarde.' }
  // Shared unauthenticated email quota: no new DB contract or permissive fallback.
  const budget = await consumeEmailBudget({ action: 'resend', headers: await headers(), destination })
  if (!budget.allowed) return { error: budget.message }
  try {
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const { data, error } = await auth.auth.admin.generateLink({ type: 'recovery', email: destination, options: { redirectTo: origin + '/update-password' } })
    if (error || !validEmailToken(data?.properties?.hashed_token)
      || data?.properties?.verification_type !== 'recovery' || data.user?.email?.toLowerCase() !== destination) {
      console.warn('[auth-recovery] link_not_confirmed')
      return { accepted: true as const }
    }
    const token = encodeURIComponent(data.properties.hashed_token)
    let html = fs.readFileSync(path.join(process.cwd(), 'emails', 'reset-password.html'), 'utf8')
    html = html.replace(/\{\{ \.SiteURL \}\}/g, () => escapeHtml(origin))
      .replace(/\{\{ \.TokenHash \}\}/g, () => escapeHtml(token))
    const { Resend } = await import('resend')
    const { error: deliveryError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL!, to: destination,
      subject: 'Restablecer tu contraseña de Clinia+', html,
    })
    if (deliveryError) console.warn('[auth-recovery] delivery_not_confirmed')
  } catch {
    console.warn('[auth-recovery] dispatch_not_confirmed')
  }
  // Identical acknowledgement for missing accounts and provider outcomes; never a delivery claim.
  return { accepted: true as const }
}
