export function parsePatientDetail(data, patientId, clinicId) {
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total_count) ||
      data.total_count < 0 || data.items.length > 1 || data.total_count < data.items.length) {
    throw new Error('Invalid patient response')
  }
  if (!data.items.length) {
    if (data.total_count !== 0) throw new Error('Incomplete patient response')
    return null
  }
  const d = data.items[0]
  if (!d || d.id !== patientId || d.clinic_id !== clinicId) throw new Error('Patient scope mismatch')
  return {
    id: d.id,
    name: d.first_name || '',
    lastName: d.last_name || '',
    email: d.email,
    phone: d.phone || '',
    address: d.address,
    birthDate: d.birth_date || '',
    gender: d.gender,
    occupation: d.occupation,
    guardianName: d.guardian_name,
    referralSource: d.referral_source,
    referredBy: d.referred_by,
    medicalRecordNumber: d.medical_record_number,
    clinicalNotes: d.clinical_notes,
    emergencyContact: d.emergency_contact,
    emergencyPhone: d.emergency_phone,
    last_treatment_note: d.last_treatment_note,
    odontogram_state: d.odontogram_state,
    allergies: d.allergies,
    medications: d.medications,
    medicalConditions: d.medical_conditions,
    bloodType: d.blood_type,
    maritalStatus: d.marital_status,
    hasDiabetes: d.has_diabetes,
    hasHypertension: d.has_hypertension,
    hasHeartDisease: d.has_heart_disease,
    isSmoker: d.is_smoker,
    isPregnant: d.is_pregnant,
    preferredContactMethod: d.preferred_contact_method,
    recallMonths: d.recall_months,
    internalNotes: d.internal_notes,
    city: d.city,
    state: d.state,
    lastVisit: d.last_visit,
    nextAppointment: d.next_appointment,
    status: d.status || d.patient_status || 'inactive',
    avatar_url: d.avatar_url,
    family_representative_id: d.family_representative_id,
    family_relationship: d.family_relationship,
    is_family_head: d.is_family_head,
    appointments_count: Number(d.appointments_count) || 0,
  }
}

export async function loadPatientDetail(client, clinicId, patientId, signal) {
  const { data, error } = await client.rpc('get_patients_with_stats', {
    p_clinic_id: clinicId, p_patient_id: patientId, p_limit: 1
  }).abortSignal(signal)
  if (signal.aborted) return undefined
  if (error) throw error
  return parsePatientDetail(data, patientId, clinicId)
}
