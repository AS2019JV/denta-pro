const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const PATIENT_TABS = ["info", "medical", "hcu033", "appointments", "recipes", "files"]

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

export function readPatientTab(value) {
  return PATIENT_TABS.includes(value) ? value : "info"
}

export function patientRecipesPath(patientId) {
  return isUuid(patientId) ? `/patients/${patientId}?tab=recipes` : null
}

export function normalizePrescriptionInput(input) {
  if (!input || typeof input !== "object") return null
  const { patientId, clinicId, medications, indications } = input
  if (!isUuid(patientId) || !isUuid(clinicId) || !Array.isArray(medications)) return null
  if (medications.length < 1 || medications.length > 20) return null

  const normalizedMedications = []
  for (const medication of medications) {
    if (!medication || typeof medication !== "object") return null
    const name = typeof medication.name === "string" ? medication.name.trim() : ""
    const dosage = typeof medication.dosage === "string" ? medication.dosage.trim() : ""
    const duration = typeof medication.duration === "string" ? medication.duration.trim() : ""
    if (!name || name.length > 120 || !dosage || dosage.length > 160 || !duration || duration.length > 80) return null
    normalizedMedications.push({ name, dosage, duration })
  }

  if (typeof indications !== "string" || indications.length > 2000) return null
  return { patientId, clinicId, medications: normalizedMedications, indications: indications.trim() }
}

export function isPrescriptionRole(role) {
  return role === "doctor" || role === "clinic_owner"
}

export async function savePrescriptionWithAuthorization(input, dependencies) {
  const payload = normalizePrescriptionInput(input)
  if (!payload) return { success: false, error: "Revisa los medicamentos y las indicaciones antes de continuar." }

  try {
    const user = await dependencies.getUser()
    if (!user?.id) return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }

    const roleResult = await dependencies.getRole(payload.clinicId)
    if (roleResult.error || !isPrescriptionRole(roleResult.role)) return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }

    const profileResult = await dependencies.getProfile(user.id)
    if (profileResult.error || profileResult.status !== "active") return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }

    const patientResult = await dependencies.getPatient(payload.patientId, payload.clinicId)
    if (patientResult.error || !patientResult.exists) return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }

    const insertError = await dependencies.insert({
      patient_id: payload.patientId,
      clinic_id: payload.clinicId,
      doctor_id: user.id,
      data: { medications: payload.medications, indications: payload.indications },
    })
    if (insertError) return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }
    return { success: true }
  } catch {
    return { success: false, error: "No se pudo guardar la receta. Verifica tu acceso y los datos del paciente." }
  }
}
