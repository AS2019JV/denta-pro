import { supabase } from "@/lib/supabase"

export interface RecallPatient {
  patient_id: string
  first_name: string
  last_name: string
  last_visit: string | null
  phone: string | null
  email: string | null
  days_overdue: number | null
}

export async function getRecallQueue(clinicId: string): Promise<RecallPatient[]> {
  const { data, error } = await supabase
    .from('recall_queue')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('last_visit', { ascending: true }) // Oldest visits first
    .limit(50) // Limit to 50 for dashboard widget

  if (error) {
    console.error("Error fetching recall queue:", error)
    return []
  }

  return data as RecallPatient[]
}
