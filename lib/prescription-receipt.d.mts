export interface PersistedPrescriptionReceipt {
  id: string; clinic_id: string; patient_id: string; doctor_id: string; issuance_snapshot: unknown
}
export const HISTORICAL_PRESCRIPTION_MESSAGE: string
export function prescriptionPdfFromReceipt(record: unknown): {
  prescriptionId: string; issuedAt: string; clinicName: string; clinicAddress: string; clinicPhone: string;
  patientName: string; patientId: string; doctorName: string; doctorSpecialty: string;
  doctorReg: string; medications: Array<{name:string;dosage:string;duration:string}>;
  indications: string; signature: null
} | null
