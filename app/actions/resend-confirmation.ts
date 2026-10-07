'use server'

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { logger, maskEmail } from '@/lib/logger'
import { escapeHtml } from '@/lib/html-escape'
import { z } from 'zod'
import { headers } from 'next/headers'
import { consumeEmailBudget } from '@/lib/server-email-gate'
import { configuredAuthOrigin, validEmailToken } from '@/lib/auth-email-contract'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function resendConfirmationEmail(email: string) {
  const input = z.string().trim().max(254).email().safeParse(email)
  if (!input.success) return { error: 'Correo electrónico inválido.' }
  email = input.data.toLowerCase()
  const appUrl = configuredAuthOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (!supabaseUrl || !supabaseServiceKey || !appUrl) {
    return { error: 'El envío de correos no está disponible. Intenta más tarde.' }
  }
  
  const budget = await consumeEmailBudget({ action: 'resend', headers: await headers(), destination: email })
  if (!budget.allowed) return { error: budget.message }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    // Check if the user exists and is not confirmed
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) throw listError
    
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
        // Return success anyway to prevent email enumeration
        return { success: true }
    }

    if (user.email_confirmed_at) {
        return { error: "Este correo ya está confirmado. Por favor, intenta iniciar sesión nuevamente." }
    }

    logger.info('[Resend Confirmation] Resending confirmation to recipient', { email: maskEmail(email) })

    // Use generateLink to create a signup confirmation link for the existing user
    // We cast to any to bypass the TS error about missing password (not required for existing users)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
            redirectTo: `${appUrl}/dashboard`
        }
    } as any)

    if (linkError || !validEmailToken(linkData?.properties?.hashed_token)) {
        logger.error('[Resend Confirmation] Could not generate confirmation link', { error: linkError?.message })
        return { error: "Error al generar el enlace de confirmación." }
    }

    // This template is rendered by Resend, separately from Supabase recovery SMTP.
    const tokenHash = linkData.properties.hashed_token

    // Send the email via Resend
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const templatePath = path.join(process.cwd(), 'emails', 'signup-confirmation.html')
    let htmlContent = fs.readFileSync(templatePath, 'utf8')
    
    const siteUrl = appUrl
    htmlContent = htmlContent.replace(/\{\{ \.SiteURL \}\}/g, () => escapeHtml(siteUrl))
    
    // Ensure the hashed token is properly URL encoded so characters like '+' don't turn into spaces
    const safeTokenHash = encodeURIComponent(tokenHash)
    htmlContent = htmlContent.replace(/\{\{ \.TokenHash \}\}/g, () => escapeHtml(safeTokenHash))
    htmlContent = htmlContent.replace(/\{\{ \.Type \}\}/g, 'signup')
    
    // Inject Doctor's name dynamically if available in user metadata
    const rawName = user.user_metadata?.full_name
    const rawTitle = user.user_metadata?.title
    const firstName = typeof rawName === 'string' ? rawName.slice(0, 200).split(' ')[0] : ''
    const title = typeof rawTitle === 'string' ? rawTitle.slice(0, 32) : 'Dr.'
    if (firstName) {
        const displayName = title ? `${title} ${firstName}`.trim() : firstName
        htmlContent = htmlContent.replace('¡Te damos la bienvenida a Clinia+!', () => `¡Te damos la bienvenida, ${escapeHtml(displayName)}!`)
    }

    const { error: deliveryError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject: '¡Confirma tu cuenta en Clinia+!',
        html: htmlContent
    })
    if (deliveryError) {
      logger.error('[Resend Confirmation] Email provider rejected delivery')
      return { error: 'No se pudo enviar el correo. Intenta solicitar un nuevo enlace más tarde.' }
    }
    
    logger.info('[Resend Confirmation] Confirmation email dispatched successfully')
    return { success: true }
    
  } catch {
    logger.error('[Resend Confirmation] Email delivery could not be confirmed')
    return { error: 'No pudimos confirmar el envío. Revisa tu bandeja; si no llega, solicita otro enlace más tarde.' }
  }
}
