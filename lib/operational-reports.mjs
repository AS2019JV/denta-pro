import { addClinicDays, clinicDayKey, clinicDateTimeToInstant } from './agenda.mjs'

export function reportingPeriod(days, today = clinicDayKey()) {
  if (![30, 90, 365].includes(days)) throw new Error('Período inválido')
  return {
    start: clinicDateTimeToInstant(addClinicDays(today, -(days - 1)), '00:00'),
    end: clinicDateTimeToInstant(addClinicDays(today, 1), '00:00'),
  }
}
export function parseOperationalReport(value, clinicId) {
  const count = value => Number.isSafeInteger(value) && value >= 0
  if (!value || value.clinic_id !== clinicId || !value.summary || !value.statuses ||
    !Array.isArray(value.monthly) || !Array.isArray(value.treatments)) throw new Error('Informe inválido')
  const keys = ['appointments','activePatients','newPatients','completed','noShow','cancelled']
  if (keys.some(key => !count(value.summary[key])) ||
    Object.values(value.statuses).some(n => !count(n)) ||
    !['scheduled','confirmed','arrived','completed','cancelled','no_show'].every(key => count(value.statuses[key])) ||
    Object.values(value.statuses).reduce((sum,n) => sum+n,0) !== value.summary.appointments ||
    value.monthly.some(row => !/^\d{4}-\d{2}$/.test(row.month) || !count(row.appointments) || !count(row.newPatients)) ||
    value.monthly.reduce((sum,row) => sum+row.appointments,0) !== value.summary.appointments ||
    value.treatments.some(row => typeof row.name !== 'string' || !count(row.count)) ||
    value.summary.attendanceRate !== null && (typeof value.summary.attendanceRate !== 'number' || value.summary.attendanceRate < 0 || value.summary.attendanceRate > 100)) throw new Error('Informe inconsistente')
  return { clinic_id: value.clinic_id, start: value.start, end: value.end,
    summary: Object.fromEntries([...keys,'attendanceRate'].map(key => [key,value.summary[key]])),
    statuses: Object.fromEntries(['scheduled','confirmed','arrived','completed','cancelled','no_show'].map(key => [key,value.statuses[key]])),
    monthly: value.monthly.map(row => ({month:row.month,appointments:row.appointments,newPatients:row.newPatients})),
    treatments: value.treatments.map(row => ({name:row.name,count:row.count})) }
}
export async function loadOperationalReport(client,clinicId,range,signal) {
  let request=client.rpc('get_clinic_operational_report',{p_clinic_id:clinicId,p_start:range.start,p_end:range.end})
  if(signal) request=request.abortSignal(signal)
  const {data,error}=await request
  if(error) throw new Error('No se pudo cargar el informe')
  return parseOperationalReport(data,clinicId)
}
