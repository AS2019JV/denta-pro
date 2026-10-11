export type PatientTab = "info" | "medical" | "hcu033" | "appointments" | "recipes" | "payments" | "files"
export interface NormalizedPrescriptionInput {
  patientId: string
  clinicId: string
  medications: Array<{ name: string; dosage: string; duration: string }>
  indications: string
}
export function isUuid(value: unknown): value is string
export function readPatientTab(value: string | null | undefined): PatientTab
export function patientRecipesPath(patientId: unknown): string | null
export function normalizePrescriptionInput(input: unknown): NormalizedPrescriptionInput | null
export function isPrescriptionRole(role: unknown): role is "doctor" | "clinic_owner"
export function savePrescriptionWithAuthorization(input: unknown, dependencies: {
  getUser: () => Promise<{ id: string } | null>
  getRole: (clinicId: string) => Promise<{ role: unknown; error?: unknown }>
  getProfile: (userId: string) => Promise<{ status: unknown; error?: unknown }>
  getPatient: (patientId: string, clinicId: string) => Promise<{ exists: boolean; error?: unknown }>
  insert: (record: { patient_id: string; clinic_id: string; doctor_id: string; data: { medications: NormalizedPrescriptionInput["medications"]; indications: string } }) => Promise<unknown>
}): Promise<{ success: true } | { success: false; error: string }>
