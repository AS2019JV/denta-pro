import type { SupabaseClient } from "@supabase/supabase-js"
export interface PatientDetail {
  id: string
  name: string
  lastName: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  birthDate: string
  gender?: string
  occupation?: string
  guardianName?: string
  referralSource?: string
  referredBy?: string
  medicalRecordNumber?: string
  clinicalNotes?: string
  emergencyContact?: string
  emergencyPhone?: string
  allergies?: string
  medications?: string
  medicalConditions?: string
  bloodType?: string
  maritalStatus?: string
  hasDiabetes?: boolean
  hasHypertension?: boolean
  hasHeartDisease?: boolean
  isSmoker?: boolean
  isPregnant?: boolean
  preferredContactMethod?: string
  recallMonths?: number
  internalNotes?: string
  lastVisit?: string
  nextAppointment?: string
  status: "active" | "inactive"
  avatar_url?: string
  appointments_count?: number
  family_representative_id?: string
  family_relationship?: string
  is_family_head?: boolean
  last_treatment_note?: string
  odontogram_state?: any
}

export function parsePatientDetail(data: unknown, patientId: string, clinicId: string): PatientDetail | null
export function loadPatientDetail(client: Pick<SupabaseClient, "rpc">, clinicId: string, patientId: string, signal: AbortSignal): Promise<PatientDetail | null | undefined>
