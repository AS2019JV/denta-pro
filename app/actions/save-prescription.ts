"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isUuid, savePrescriptionWithAuthorization } from "@/lib/prescription-policy.mjs"
import { prescriptionPdfFromReceipt, type PersistedPrescriptionReceipt } from "@/lib/prescription-receipt.mjs"

export type SavePrescriptionResult = { success: true; prescription: PersistedPrescriptionReceipt } | { success: false; error: string }

export async function savePrescription(input: unknown): Promise<SavePrescriptionResult> {
  const requestId = input && typeof input === 'object' && 'requestId' in input ? input.requestId : null
  if (!isUuid(requestId)) return { success: false, error: "No se pudo identificar esta emisión. Vuelve a abrir el borrador." }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }

  try {
    const cookieStore = await cookies()
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Middleware refreshes cookies when the server action cannot write them.
          }
        },
      },
    })

    let saved: PersistedPrescriptionReceipt | null = null
    let issuanceAttempted = false
    const result = await savePrescriptionWithAuthorization(input, {
      getUser: async () => {
        const { data, error } = await client.auth.getUser()
        return error ? null : data.user ? { id: data.user.id } : null
      },
      getRole: async (clinicId) => {
        const { data, error } = await client.rpc("get_clinic_member_role", { check_clinic_id: clinicId })
        return { role: data, error }
      },
      getProfile: async (userId) => {
        const { data, error } = await client.from("profiles").select("status").eq("id", userId).maybeSingle()
        return { status: data?.status, error }
      },
      getPatient: async (patientId, clinicId) => {
        const { data, error } = await client.from("patients").select("id")
          .eq("id", patientId).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
        return { exists: Boolean(data), error }
      },
      insert: async (record) => {
        issuanceAttempted = true
        const inserted = await client.from("prescriptions").insert({ ...record, id: requestId })
          .select("id,clinic_id,patient_id,doctor_id,issuance_snapshot").single()
        let data = inserted.data
        if (inserted.error) {
          if (inserted.error.code !== '23505') return inserted.error
          // PK arbitrates concurrent identical retries. Never mutate the issued row.
          const existing = await client.from('prescriptions')
            .select('id,clinic_id,patient_id,doctor_id,issuance_snapshot')
            .eq('id', requestId).eq('clinic_id', record.clinic_id)
            .eq('patient_id', record.patient_id).eq('doctor_id', record.doctor_id).maybeSingle()
          if (existing.error) return existing.error
          data = existing.data
        }
        const pdf = prescriptionPdfFromReceipt(data)
        if (!data || data.id !== requestId || data.clinic_id !== record.clinic_id
          || data.patient_id !== record.patient_id || data.doctor_id !== record.doctor_id || !pdf
          || JSON.stringify(pdf.medications) !== JSON.stringify(record.data.medications)
          || pdf.indications !== record.data.indications) return new Error('Receipt intent mismatch')
        saved = data
        return null
      },
    })
    if (!result.success) return issuanceAttempted
      ? { success: false, error: "No se pudo confirmar la emisión. Revisa el historial antes de volver a emitir." }
      : result
    if (!saved) return { success: false, error: "La emisión no se pudo confirmar. Revisa el historial antes de volver a emitir." }
    return { success: true, prescription: saved }
  } catch {
    return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }
  }
}
