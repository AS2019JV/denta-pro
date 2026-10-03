export const CLINIC_TIME_ZONE = 'America/Guayaquil'
export const APPOINTMENT_LABELS = Object.freeze({
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  arrived: 'En recepción',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
})
export const ACTIVE_APPOINTMENT_STATUSES = Object.freeze(['scheduled', 'confirmed', 'arrived'])
export const APPOINTMENT_TRANSITIONS = Object.freeze({
  scheduled: ['confirmed', 'arrived', 'cancelled', 'no_show'],
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
})
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFormatter = new Intl.DateTimeFormat('es-EC', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export function clinicDayKey(instant = new Date()) {
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha inválida')
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function clinicTime(instant) {
  return timeFormatter.format(new Date(instant))
}
export function clinicDateTimeToInstant(day, time) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(day) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('Fecha u hora inválida')
  // Ecuador continental has UTC-05:00 without DST for this scheduling range.
  // Round-trip through the IANA zone also rejects normalized invalid dates.
  const date = new Date(`${day}T${time}:00-05:00`)
  if (!Number.isFinite(date.getTime()) || clinicDayKey(date) !== day || clinicTime(date) !== time)
    throw new Error('Fecha u hora inválida')
  return date.toISOString()
}
export function addClinicDays(day, amount) {
  const date = new Date(clinicDateTimeToInstant(day, '12:00'))
  date.setUTCDate(date.getUTCDate() + amount)
  return clinicDayKey(date)
}
export function calendarRange(day, view) {
  clinicDateTimeToInstant(day, '00:00')
  let first = day,
    days = 1
  const weekday = (value) => (new Date(`${value}T12:00:00Z`).getUTCDay() + 6) % 7
  if (view === 'month') {
    first = day.slice(0, 7) + '-01'
    first = addClinicDays(first, -weekday(first))
    days = 42
  } else if (view === 'week') {
    first = addClinicDays(day, -weekday(day))
    days = 7
  } else if (view === 'list') days = 30
  return {
    start: clinicDateTimeToInstant(first, '00:00'),
    end: clinicDateTimeToInstant(addClinicDays(first, days), '00:00'),
    days: Array.from({ length: days }, (_, i) => addClinicDays(first, i)),
  }
}
export function moveCalendarDay(day, view, direction) {
  if (view !== 'month')
    return addClinicDays(day, direction * (view === 'week' ? 7 : view === 'list' ? 30 : 1))
  const [year, month] = day.split('-').map(Number)
  return clinicDayKey(new Date(Date.UTC(year, month - 1 + direction, 1, 17)))
}
export function clinicDate(instant) {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: CLINIC_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(instant))
}

export function groupScheduleByDay(items, days) {
  const bounds = days.map((day) => ({
    day,
    start: Date.parse(clinicDateTimeToInstant(day, '00:00')),
    end: Date.parse(clinicDateTimeToInstant(addClinicDays(day, 1), '00:00')),
  }))
  const grouped = new Map()
  for (const item of items) {
    const start = Date.parse(item.start_time),
      end = Date.parse(item.end_time)
    for (const bound of bounds)
      if (start < bound.end && end > bound.start) {
        const rows = grouped.get(bound.day) || []
        rows.push(item)
        grouped.set(bound.day, rows)
      }
  }
  return grouped
}

export function editorStatuses(status) {
  return status
    ? [
        status,
        ...APPOINTMENT_TRANSITIONS[status].filter((value) =>
          ACTIVE_APPOINTMENT_STATUSES.includes(value),
        ),
      ]
    : ['scheduled', 'confirmed']
}

export function parseSchedule(value, clinicId) {
  if (
    !value ||
    !Array.isArray(value.items) ||
    !Number.isSafeInteger(value.total_count) ||
    value.total_count !== value.items.length
  )
    throw new Error('No se pudo cargar la agenda completa')
  return value.items.map((row) => {
    if (
      !row ||
      typeof row.id !== 'string' ||
      row.clinic_id !== clinicId ||
      !Object.hasOwn(APPOINTMENT_LABELS, row.status) ||
      !Number.isFinite(Date.parse(row.start_time)) ||
      !Number.isFinite(Date.parse(row.end_time)) ||
      Date.parse(row.end_time) <= Date.parse(row.start_time)
    )
      throw new Error('Respuesta de agenda inválida')
    return {
      id: row.id,
      clinic_id: row.clinic_id,
      patient_id: row.patient_id,
      doctor_id: row.doctor_id,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      type: row.type || 'Consulta odontológica',
      patients: row.patients,
      profiles: row.profiles,
      ...(typeof row.notes === 'string' ? { notes: row.notes } : {}),
    }
  })
}
export async function loadSchedule(client, clinicId, range, signal) {
  if (!clinicId) throw new Error('Clínica requerida')
  const { data, error } = await client
    .rpc('get_clinic_schedule', { p_clinic_id: clinicId, p_start: range.start, p_end: range.end })
    .abortSignal(signal)
  if (error) throw error
  return parseSchedule(data, clinicId)
}
export async function loadClinicians(client, clinicId, signal) {
  if (!clinicId) throw new Error('Clínica requerida')
  const { data, error } = await client
    .rpc('get_clinic_staff_directory', { p_clinic_id: clinicId })
    .abortSignal(signal)
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Respuesta de profesionales inválida')
  return data.filter(
    (row) => row && typeof row.id === 'string' && ['doctor', 'clinic_owner'].includes(row.role),
  )
}
export async function saveAppointment(client, clinicId, input, appointmentId = null, role) {
  if (!clinicId || !['doctor', 'clinic_owner', 'receptionist'].includes(role))
    throw new Error('Acceso no autorizado')
  const payload = {}
  for (const field of ['patient_id', 'doctor_id', 'start_time', 'end_time', 'type', 'status'])
    if (input[field] !== undefined) payload[field] = input[field]
  if (role !== 'receptionist' && input.notes !== undefined) payload.notes = input.notes
  const { data, error } = await client.rpc('save_clinic_appointment', {
    p_clinic_id: clinicId,
    p_data: payload,
    p_appointment_id: appointmentId,
  })
  if (error) {
    if (error.code === '23P01')
      throw new Error('El odontólogo ya tiene una cita en ese horario. Elige otro intervalo.')
    if (error.code === '42501')
      throw new Error('Tu acceso cambió o la cita no está disponible. Verifica tus permisos.')
    if (error.code === '22023') throw new Error('Revisa los datos y el estado de la cita.')
    throw new Error('No se pudo guardar la cita. Reintenta y comprueba la agenda.')
  }
  if (
    !data ||
    typeof data.id !== 'string' ||
    data.clinic_id !== clinicId ||
    (appointmentId && data.id !== appointmentId)
  )
    throw new Error('El servidor no confirmó la cita')
  return data
}
