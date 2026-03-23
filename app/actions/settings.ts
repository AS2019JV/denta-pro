'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function seedClinicServices(clinicId: string) {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // 1. Verify Authentication & Authorization
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check if user belongs to the requested clinic
  const { data: membership } = await supabaseAuth
    .from('clinic_memberships')
    .select('id')
    .eq('clinic_id', clinicId)
    .single()

  if (!membership) {
    return { success: false, error: 'Unauthorized access to this clinic' }
  }

  // 2. Perform Admin Action
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { error } = await supabaseAdmin.rpc('seed_default_services', { target_clinic_id: clinicId })
    
    if (error) {
        console.error("Error seeding services:", error)
        return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
