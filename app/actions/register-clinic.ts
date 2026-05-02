'use server'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase Environment Variables: URL or Service Key is undefined')
}

export async function registerClinic(formData: FormData) {
  if (!supabaseUrl || !supabaseServiceKey) {
     return { error: "Server Configuration Error: Missing Database Credentials. Check .env file." }
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Extract Data
  const title = (formData.get('title') as string) || 'Dr.'
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const phoneRaw = formData.get('phone') as string
  const countryCode = formData.get('countryCode') as string || '+593'
  const phone = `${countryCode} ${phoneRaw}`.trim()
  const practiceName = formData.get('practiceName') as string
  const practiceSize = formData.get('practiceSize') as string
  // Address is optional in form but required by DB, stub it if missing
  const address = (formData.get('address') as string) || 'Location Pending' 
  const logoFile = formData.get('logo') as File | null

  const fullName = `${firstName} ${lastName}`.trim()

  // 2.0 Check for Duplicate Clinic Name BEFORE creating anything
  const { data: existingClinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('name', practiceName)
    .single()

  if (existingClinic) {
    return { error: "Ya existe una clínica registrada con este nombre. Por favor, elige otro nombre." }
  }

  // Generate Clinic ID upfront
  const clinicId = randomUUID()

  // 3. Create Auth User with Pending Clinic Data
  // We DO NOT inject into the database yet. We wait for email verification.
  // The 'on_auth_user_verified' trigger will handle the actual creation.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // User must verify email
    user_metadata: {
      title: title,
      full_name: fullName,
      phone: phone,
      role: 'clinic_owner',
      pending_clinic: {
        id: clinicId, // Pass the generated ID
        name: practiceName,
        address: address,
        phone: phone,
        subscription_tier: 'trial',
        practice_size: practiceSize
      }
    }
  })

  // Handle "User already exists" gracefully
  if (authError) {
    const errorMsg = authError.message.toLowerCase()
    if (errorMsg.includes("already registered") || errorMsg.includes("already been registered")) {
        return { error: "Ya te has registrado. Si tu enlace expiró, ve a Iniciar Sesión para enviarte uno nuevo." }
    }
    return { error: authError.message }
  }

  // 4. Handle Logo Upload (if present)
  // We upload to the generated clinicId folder immediately.
  // If the user never verifies, this file becomes orphaned garbage.
  // We can have a cron job to clean up orphaned files later.
  if (logoFile && logoFile.size > 0) {
    try {
        const arrayBuffer = await logoFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        const { error: uploadError } = await supabase
          .storage
          .from('clinic-branding')
          .upload(`${clinicId}/${logoFile.name}`, buffer, {
            contentType: logoFile.type,
            upsert: true
          })
          
        if (uploadError) {
           console.error('Logo upload failed:', uploadError)
        }
    } catch (e) {
        console.error('Error processing logo upload:', e)
    }
  }

  // 5. Trigger the Confirmation Email Explicitly with Resend
  console.log("Generating confirmation link to avoid hash-fragments...")
  
  // Use generateLink to create a deterministic verification URL
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: email,
    password: password,
    options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
    }
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("Could not generate confirmation link:", linkError)
  } else {
    try {
      // The generated action_link goes to Supabase's hosted API.
      // We extract the hashed_token to manually construct the Next.js API route link
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
      
      // Inject Doctor's name dynamically
      const displayName = title ? `${title} ${firstName}`.trim() : firstName
      htmlContent = htmlContent.replace('¡Te damos la bienvenida a Clinia+!', `¡Te damos la bienvenida, ${displayName}!`)

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Clinia+ <soporte@cliniaplus.com>',
        to: email,
        subject: '¡Confirma tu cuenta en Clinia+!',
        html: htmlContent
      })
      console.log("Confirmation email sent successfully via Resend.")
    } catch (e) {
      console.error("Failed to send email via Resend:", e)
    }
  }

  // 6. Return Success
  return { success: true }
}
