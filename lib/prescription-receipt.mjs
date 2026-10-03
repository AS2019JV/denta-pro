import { isUuid, normalizePrescriptionInput } from './prescription-policy.mjs'
export const HISTORICAL_PRESCRIPTION_MESSAGE = 'Esta receta no tiene un comprobante de emisión verificable. La reimpresión requiere revisión de custodia.'
export function prescriptionPdfFromReceipt(record) {
  const s = record?.issuance_snapshot
  if (!s || s.version !== 1 || !isUuid(record.id) || !isUuid(record.clinic_id)
    || !isUuid(record.patient_id) || !isUuid(record.doctor_id)
    || s.prescription_id !== record.id || s.clinic_id !== record.clinic_id
    || s.patient_id !== record.patient_id || s.doctor_id !== record.doctor_id
    || typeof s.issued_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(s.issued_at)
    || !Number.isFinite(Date.parse(s.issued_at))) return null
  for (const [object, fields] of [[s.clinic, ['name','address','phone']],
    [s.patient, ['name','identification']], [s.doctor, ['name','specialization','license_number']]]) {
    if (!object || fields.some(field => typeof object[field] !== 'string') || !object.name.trim()) return null
  }
  const input = normalizePrescriptionInput({ patientId: record.patient_id, clinicId: record.clinic_id,
    medications: s.medications, indications: s.indications })
  if (!input) return null
  return { prescriptionId: record.id, issuedAt: s.issued_at, clinicName: s.clinic.name, clinicAddress: s.clinic.address,
    clinicPhone: s.clinic.phone, patientName: s.patient.name, patientId: s.patient.identification,
    doctorName: s.doctor.name, doctorSpecialty: s.doctor.specialization,
    doctorReg: s.doctor.license_number ? `Registro: ${s.doctor.license_number}` : 'Registro no informado',
    medications: input.medications, indications: input.indications, signature: null }
}
