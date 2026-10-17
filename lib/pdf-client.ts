// Types are erased at build time; the PDF engine loads only on demand.
import type * as PDF from "@/lib/pdf-generator"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function generatePrescription(data: Parameters<typeof PDF.generatePrescription>[0], shouldPublish: () => boolean = () => true) {
  const pdf = await import("@/lib/pdf-generator")
  if (!shouldPublish()) return
  return pdf.generatePrescription(data)
}

/** Reload and authorize after the deferred engine loads; never publish cached clinical rows. */
export async function exportPersistedPrescription(
  client: SupabaseClient,
  scope: { userId: string; clinicId: string; patientId: string; prescriptionId: string },
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!scope.userId || !scope.clinicId || !scope.patientId || !scope.prescriptionId || !isCurrent()) return false
  const pdf = await import("@/lib/pdf-generator")
  const { prescriptionPdfFromReceipt, HISTORICAL_PRESCRIPTION_MESSAGE } = await import("@/lib/prescription-receipt.mjs")
  if (!isCurrent()) return false
  const [saved, patient] = await Promise.all([
    client.from("prescriptions").select("id,clinic_id,patient_id,doctor_id,issuance_snapshot")
      .eq("id", scope.prescriptionId).eq("clinic_id", scope.clinicId)
      .eq("patient_id", scope.patientId).maybeSingle(),
    client.from("patients").select("id").eq("id", scope.patientId)
      .eq("clinic_id", scope.clinicId).is("deleted_at", null).maybeSingle(),
  ])
  if (!isCurrent()) return false
  if (saved.error || patient.error || !patient.data || !saved.data
    || saved.data.id !== scope.prescriptionId || saved.data.clinic_id !== scope.clinicId
    || saved.data.patient_id !== scope.patientId) {
    throw new Error("No se pudo verificar la receta guardada ni el acceso vigente.")
  }
  const document = prescriptionPdfFromReceipt(saved.data)
  if (!document) throw new Error(HISTORICAL_PRESCRIPTION_MESSAGE)
  const identity = await client.auth.getUser()
  if (!isCurrent()) return false
  if (identity.error || identity.data.user?.id !== scope.userId) {
    throw new Error("No tienes autorización vigente para exportar esta receta.")
  }
  const [role, subscription] = await Promise.all([
    client.rpc("get_clinic_member_role", { check_clinic_id: scope.clinicId }),
    client.rpc("check_subscription_active", { check_clinic_id: scope.clinicId }),
  ])
  if (!isCurrent()) return false
  if (role.error || !["doctor", "clinic_owner"].includes(role.data)
    || subscription.error || subscription.data !== true) {
    throw new Error("No tienes autorización vigente para exportar esta receta.")
  }
  pdf.generatePrescription(document)
  return true
}

// HCU exports have no draft-data fallback. Reload the saved record after the
// deferred engine loads, and verify the caller's scope again before publishing.
export async function generateHCU033(
  loadPersistedData: () => Promise<Parameters<typeof PDF.generateHCU033>[0] | null>,
  shouldPublish: () => boolean,
): Promise<boolean> {
  const pdf = await import("@/lib/pdf-generator")
  if (!shouldPublish()) return false
  const data = await loadPersistedData()
  if (!data || !shouldPublish()) return false
  pdf.generateHCU033(data)
  return true
}

export async function exportPersistedHCU033(
  client: SupabaseClient,
  scope: { userId: string; clinicId: string; patientId: string },
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!scope.userId || !scope.clinicId || !scope.patientId || !isCurrent()) return false
  return generateHCU033(async () => {
    const [saved, patient] = await Promise.all([
      client.from("hcu033_forms").select("id,clinic_id,patient_id,doctor_id,created_at,updated_at,form_data")
        .eq("clinic_id", scope.clinicId).eq("patient_id", scope.patientId)
        .is("deleted_at", null).order("created_at", { ascending: false })
        .order("id", { ascending: false }).limit(1).maybeSingle(),
      client.from("patients").select("id").eq("id", scope.patientId)
        .eq("clinic_id", scope.clinicId).is("deleted_at", null).maybeSingle(),
    ])
    if (!isCurrent()) return null
    if (saved.error || patient.error) throw new Error("No se pudo verificar la ficha guardada. Intenta nuevamente.")
    const record = saved.data
    if (!patient.data || !record || record.clinic_id !== scope.clinicId || record.patient_id !== scope.patientId
      || !record.form_data || typeof record.form_data !== "object" || Array.isArray(record.form_data)) {
      throw new Error("No hay una HCU guardada disponible para este paciente. Guarda y verifica la ficha antes de exportar.")
    }

    // Recheck live identity, membership/profile and subscription after loading
    // the saved clinical row. Ordinary client RLS remains the data boundary.
    const identity = await client.auth.getUser()
    if (!isCurrent()) return null
    if (identity.error || identity.data.user?.id !== scope.userId) {
      throw new Error("No tienes autorización vigente para exportar esta ficha.")
    }
    const [role, subscription] = await Promise.all([
      client.rpc("get_clinic_member_role", { check_clinic_id: scope.clinicId }),
      client.rpc("check_subscription_active", { check_clinic_id: scope.clinicId }),
    ])
    if (!isCurrent()) return null
    if (role.error || !["doctor", "clinic_owner"].includes(role.data) || subscription.error || subscription.data !== true) {
      throw new Error("No tienes autorización vigente para exportar esta ficha.")
    }
    // Provenance comes from the persisted row, never the editable JSON payload.
    // Historical rows may lack metadata; do not reconstruct an author or date.
    return { ...record.form_data, export_metadata: {
      id: record.id, clinic_id: record.clinic_id, patient_id: record.patient_id,
      doctor_id: record.doctor_id ?? null, created_at: record.created_at ?? null,
      updated_at: record.updated_at ?? null,
    } }
  }, isCurrent)
}
