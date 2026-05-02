'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function resendConfirmationEmail(email: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { error: "Server Configuration Error: Missing Database Credentials." }
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    console.log(`Resending confirmation to ${email}...`)

    // Use generateLink to create a signup confirmation link for the existing user
    // We cast to any to bypass the TS error about missing password (not required for existing users)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
        }
    } as any)

    if (linkError || !linkData?.properties?.action_link) {
        console.error("Could not generate confirmation link:", linkError)
        return { error: "Error al generar el enlace de confirmación." }
    }

    // Extract the hashed_token to manually construct the Next.js API route link
    const actionUrl = new URL(linkData.properties.action_link)
    const tokenHash = linkData.properties.hashed_token
    const redirectUrl = actionUrl.searchParams.get('redirect_to')
    
    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm?token_hash=${tokenHash}&type=signup&next=${encodeURIComponent(redirectUrl || '/dashboard')}`

    // Send the email via Resend
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const fs = require('fs')
    const path = require('path')
    
    const templatePath = path.join(process.cwd(), 'emails', 'signup-confirmation.html')
    let htmlContent = fs.readFileSync(templatePath, 'utf8')
    
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    htmlContent = htmlContent.replace(/\{\{ \.SiteURL \}\}/g, siteUrl)
    
    // Ensure the hashed token is properly URL encoded so characters like '+' don't turn into spaces
    const safeTokenHash = encodeURIComponent(tokenHash || '')
    htmlContent = htmlContent.replace(/\{\{ \.TokenHash \}\}/g, safeTokenHash)
    htmlContent = htmlContent.replace(/\{\{ \.Type \}\}/g, 'signup')
    
    // Inject Doctor's name dynamically if available in user metadata
    const firstName = user.user_metadata?.full_name?.split(' ')[0] || ''
    const title = user.user_metadata?.title || 'Dr.'
    if (firstName) {
        const displayName = title ? `${title} ${firstName}`.trim() : firstName
        htmlContent = htmlContent.replace('¡Te damos la bienvenida a Clinia+!', `¡Te damos la bienvenida, ${displayName}!`)
    }

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Clinia+ <soporte@cliniaplus.com>',
        to: email,
        subject: '¡Confirma tu cuenta en Clinia+!',
        html: htmlContent
    })
    
    console.log("Resent confirmation email successfully via Resend.")
    return { success: true }
    
  } catch (e: any) {
    console.error("Failed to resend confirmation email:", e)
    return { error: e.message || "Ocurrió un error al enviar el correo." }
  }
}
