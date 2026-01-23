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
      full_name: fullName,
      phone: phone,
      pending_clinic: {
        id: clinicId, // Pass the generated ID
        name: practiceName,
        address: address,
        phone: phone,
        subscription_tier: 'trial'
      }
    }
  })

  // Handle "User already exists" gracefully if needed, or let error bubble
  if (authError) {
    if (authError.message.includes("User already registered")) {
        return { error: "Este correo electrónico ya está registrado. Por favor, inicia sesión." }
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

  // 5. Trigger the Confirmation Email explicitly
  console.log("Attempting to send confirmation email")
  const { error: emailError } = await supabase.auth.resend({ 
    type: 'signup', 
    email: email,
    options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
    }
  })
  
  if (emailError) {
    console.warn("Could not send confirmation email:", emailError)
  } else {
    console.log("Confirmation email sent successfully via Supabase.")
  }

  // 6. Return Success
  return { success: true }
}
