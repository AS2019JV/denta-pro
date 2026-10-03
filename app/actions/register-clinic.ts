'use server'

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { escapeHtml } from '@/lib/html-escape'
import { signupSchema } from '@/lib/signup-validation'
import { headers } from 'next/headers'
import { consumeEmailBudget } from '@/lib/server-email-gate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase Environment Variables: URL or Service Key is undefined')
}

export async function registerClinic(formData: FormData) {
  const input = signupSchema.safeParse({
    title: formData.get('title') ?? undefined,
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    phoneRaw: formData.get('phone') ?? undefined,
    countryCode: formData.get('countryCode') ?? undefined,
    practiceName: formData.get('practiceName'),
    practiceSize: formData.get('practiceSize'),
    address: formData.get('address') ?? undefined,
  })
  if (!input.success) {
    if (input.error.issues.some(issue => issue.path[0] === 'password')) {
      return { error: 'La contraseña debe tener entre 12 y 128 caracteres.' }
    }
    return { error: 'Datos de registro inválidos. Revisa los campos y sus longitudes.' }
  }

  const logoFile = formData.get('logo')
  if (logoFile !== null && (
    typeof logoFile === 'string' ||
    logoFile.size > 2 * 1024 * 1024 ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type)
  )) {
    return { error: 'El logo debe ser PNG, JPEG o WebP y no superar 2 MB.' }
  }

  if (!supabaseUrl || !supabaseServiceKey) {
     return { error: "Server Configuration Error: Missing Database Credentials. Check .env file." }
  }
  const budget = await consumeEmailBudget({ action: 'signup', headers: await headers(), destination: input.data.email })
  if (!budget.allowed) return { error: budget.message }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { title, firstName, lastName, email, password, phoneRaw, countryCode,
    practiceName, practiceSize, address } = input.data
  const phone = `${countryCode} ${phoneRaw}`.trim()

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

  // Display metadata never carries tenant authority. A private server intent
  // binds this Auth ID to a fresh clinic, completed only after confirmation.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // User must verify email
    user_metadata: {
      title: title,
      full_name: fullName,
      phone: phone,
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

  if (!authData?.user?.id) return { error: 'No se pudo confirmar la creación de tu cuenta. Contacta al soporte antes de repetir.' }
  try {
    const { error: intentError } = await supabase.rpc('store_clinic_registration_intent', {
      p_user_id: authData.user.id, p_clinic_id: clinicId, p_email: email,
      p_name: practiceName, p_address: address, p_phone: phone, p_size: practiceSize,
    })
    if (intentError) throw new Error('Unconfirmed registration intent')
  } catch {
    return { error: 'Tu cuenta fue creada, pero no se pudo registrar la clínica. Contacta al soporte antes de repetir.' }
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
          .upload(`${clinicId}/logo.${logoFile.type === 'image/png' ? 'png' : logoFile.type === 'image/jpeg' ? 'jpg' : 'webp'}`, buffer, {
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
    console.warn('Could not generate confirmation link')
    return { error: 'Tu cuenta fue creada, pero no pudimos preparar el correo. Ve a Iniciar Sesión para solicitar un nuevo enlace.', canResend: true }
  } else {
    if (linkData.user?.id !== authData.user.id) {
      return { error: 'No se pudo confirmar que el enlace corresponde a tu solicitud de clínica. Contacta al soporte antes de repetir.' }
    }
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
      
      const templatePath = path.join(process.cwd(), 'emails', 'signup-confirmation.html')
      let htmlContent = fs.readFileSync(templatePath, 'utf8')
      
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      htmlContent = htmlContent.replace(/\{\{ \.SiteURL \}\}/g, () => escapeHtml(siteUrl))
      
      // Ensure the hashed token is properly URL encoded so characters like '+' don't turn into spaces
      const safeTokenHash = encodeURIComponent(tokenHash || '')
      htmlContent = htmlContent.replace(/\{\{ \.TokenHash \}\}/g, () => escapeHtml(safeTokenHash))
      htmlContent = htmlContent.replace(/\{\{ \.Type \}\}/g, 'signup')
      
      // Inject Doctor's name dynamically
      const displayName = title ? `${title} ${firstName}`.trim() : firstName
      htmlContent = htmlContent.replace('¡Te damos la bienvenida a Clinia+!', () => `¡Te damos la bienvenida, ${escapeHtml(displayName)}!`)

      const { error: deliveryError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject: '¡Confirma tu cuenta en Clinia+!',
        html: htmlContent
      })
      if (deliveryError) {
        console.warn('Confirmation email provider rejected delivery')
        return { error: 'Tu cuenta fue creada, pero el correo no se pudo enviar. Ve a Iniciar Sesión para solicitar un nuevo enlace.', canResend: true }
      }
      console.log("Confirmation email sent successfully via Resend.")
    } catch {
      console.error('Confirmation email delivery could not be confirmed')
      return { error: 'Tu cuenta fue creada, pero no pudimos confirmar el envío del correo. Revisa tu bandeja; si no llega, solicita un nuevo enlace desde Iniciar Sesión.', canResend: true }
    }
  }

  // 6. Return Success
  return { success: true }
}
