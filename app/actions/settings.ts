'use server'

import { createClient } from '@supabase/supabase-js'

export async function seedClinicServices(clinicId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { error } = await supabase.rpc('seed_default_services', { target_clinic_id: clinicId })
    
    if (error) {
        console.error("Error seeding services:", error)
        return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
