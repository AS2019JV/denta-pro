'use server'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function registerClinic(formData: FormData) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Extract Data
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const phone = formData.get('phone') as string
  const practiceName = formData.get('practiceName') as string
  const practiceSize = formData.get('practiceSize') as string
  // Address is optional in form but required by DB, stub it if missing
  const address = (formData.get('address') as string) || 'Location Pending' 
  const logoFile = formData.get('logo') as File | null

  const fullName = `${firstName} ${lastName}`.trim()

  // 2. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // User must verify email
    user_metadata: {
      full_name: fullName,
      phone: phone,
    }
  })

  // Handle "User already exists" gracefully if needed, or let error bubble
  if (authError) {
    return { error: authError.message }
  }

  // Trigger the Confirmation Email explicitly
  // Since admin.createUser doesn't trigger it by default for "signup" type (it does for "invite")
  const { error: emailError } = await supabase.auth.resend({ 
    type: 'signup', 
    email: email 
  })
  
  if (emailError) {
    console.warn("Could not send confirmation email:", emailError)
    // We continue, because the user can manually request a resend later
  }



  const userId = authData.user.id

  // 3. Create Clinic (Direct SQL to bypass RPC auth restriction)
  // We use the 14-day trial logic from 20251222_add_trial_support.sql
  const { data: clinicData, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      name: practiceName,
      address: address,
      phone: phone,
      subscription_tier: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
    })
    .select('id')
    .single()

  if (clinicError) {
    // Cleanup user if clinic creation fails? 
    // Ideally yes, but for MVP we might just error. 
    await supabase.auth.admin.deleteUser(userId)
    return { error: `Error creating clinic: ${clinicError.message}` }
  }

  const clinicId = clinicData.id

  // 4. Create Profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      clinic_id: clinicId,
      role: 'clinic_owner',
      full_name: fullName,
      status: 'active'
    })

  if (profileError) {
     // Cleanup
     await supabase.from('clinics').delete().eq('id', clinicId)
     await supabase.auth.admin.deleteUser(userId)
     return { error: `Error creating profile: ${profileError.message}` }
  }

  // 5. Handle Logo Upload (if present)
  if (logoFile && logoFile.size > 0) {
    // Upload to clinic-branding/{clinic_id}/{filename}
    // We need to convert File to ArrayBuffer for supabase-js in node env (usually)
    // But server actions receive File objects which are Blob-like.
    // Supabase-js v2 supports passing the File directly in many envs, 
    // but in Node it might expect Buffer. 
    // safely convert to ArrayBuffer
    const arrayBuffer = await logoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Check if bucket exists (it should via migration)
    const { error: uploadError } = await supabase
      .storage
      .from('clinic-branding')
      .upload(`${clinicId}/${logoFile.name}`, buffer, {
        contentType: logoFile.type,
        upsert: true
      })
      
    if (uploadError) {
       console.error('Logo upload failed:', uploadError)
       // We don't fail the registration for this, just log it.
    }
  }

  // 6. Return Success
  return { success: true }
}
