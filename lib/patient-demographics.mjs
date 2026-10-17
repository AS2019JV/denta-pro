export const DEMOGRAPHIC_FIELDS = [
  'first_name', 'last_name', 'cedula', 'email', 'phone', 'birth_date', 'gender',
  'address', 'city', 'state', 'occupation', 'medical_record_number',
  'emergency_contact', 'emergency_phone', 'marital_status', 'status', 'preferred_contact_method'
]

export function demographicForm(patient = null) {
  const form = {}
  for (const field of DEMOGRAPHIC_FIELDS) form[field] = typeof patient?.[field] === 'string' ? patient[field] : ''
  form.status ||= 'active'
  form.preferred_contact_method ||= 'phone'
  return form
}

export function demographicPayload(form, today = new Date()) {
  const payload = {}
  for (const field of DEMOGRAPHIC_FIELDS) {
    if (typeof form[field] !== 'string') throw new Error('Revisa los datos del formulario.')
    const value = form[field].trim()
    if (value.length > 500) throw new Error('Los campos no pueden superar 500 caracteres.')
    payload[field] = value || null
  }
  for (const field of ['first_name', 'last_name']) {
    if (!payload[field] || payload[field].length > 120) throw new Error('Nombre y apellido son obligatorios y admiten hasta 120 caracteres.')
  }
  if (!['active', 'inactive'].includes(payload.status) || !['phone', 'email', 'whatsapp'].includes(payload.preferred_contact_method)) {
    throw new Error('Revisa el estado y el contacto preferido.')
  }
  if (payload.birth_date) {
    const value = payload.birth_date
    const parsed = new Date(value + 'T00:00:00Z')
    const currentDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value || value < '1850-01-01' || value > currentDate) {
      throw new Error('Revisa la fecha de nacimiento.')
    }
  }
  return payload
}

export function projectDemographic(record, clinicId) {
  if (!record || typeof record.id !== 'string' || record.clinic_id !== clinicId ||
      typeof record.first_name !== 'string' || typeof record.last_name !== 'string') throw new Error('Invalid demographic response')
  const result = { id: record.id, clinic_id: record.clinic_id }
  for (const field of DEMOGRAPHIC_FIELDS) {
    const value = record[field]
    if (value !== undefined && value !== null && typeof value !== 'string') throw new Error('Invalid demographic field')
    result[field] = value ?? null
  }
  return result
}

export function parseDemographicPage(data, clinicId, limit) {
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total_count) ||
      data.total_count < data.items.length || data.total_count < 0 || data.items.length > limit) throw new Error('Invalid demographic page')
  return { items: data.items.map(item => projectDemographic(item, clinicId)), total_count: data.total_count }
}

export async function loadDemographicPage(client, clinicId, search, page, limit, signal) {
  const { data, error } = await client.rpc('get_patient_demographics', {
    p_clinic_id: clinicId, p_search: search, p_limit: limit, p_offset: page * limit
  }).abortSignal(signal)
  if (signal.aborted) return undefined
  if (error) throw error
  return parseDemographicPage(data, clinicId, limit)
}

export async function saveDemographic(client, clinicId, form, patientId, signal) {
  const { data, error } = await client.rpc('save_patient_demographics', {
    p_clinic_id: clinicId, p_data: demographicPayload(form), p_patient_id: patientId
  }).abortSignal(signal)
  if (signal.aborted) return undefined
  if (error) throw error
  const result = projectDemographic(data, clinicId)
  if (patientId && result.id !== patientId) throw new Error('Patient scope mismatch')
  return result
}

export function demographicSaveError(error) {
  if (error?.code === '42501') return 'No tienes autorización para guardar estos datos. Verifica tu acceso a la clínica.'
  if (error?.code === '22023') return 'El servidor rechazó los datos. Revisa los campos e inténtalo de nuevo.'
  return 'No se pudo guardar el paciente. Reintenta; tus datos siguen en el formulario.'
}

