export type AgendaStatus =
  | 'scheduled'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'no_show'
export interface AgendaAppointment {
  id: string
  clinic_id: string
  patient_id: string
  doctor_id: string | null
  start_time: string
  end_time: string
  status: AgendaStatus
  type: string
  notes?: string
  patients?: { id?: string; first_name: string; last_name: string; phone?: string }
  profiles?: { id: string; full_name: string } | null
}
export interface AgendaClinician {
  id: string
  full_name: string
  role: string
  specialization?: string
}
export const CLINIC_TIME_ZONE: string
export const APPOINTMENT_LABELS: Readonly<Record<AgendaStatus, string>>
export const ACTIVE_APPOINTMENT_STATUSES: readonly AgendaStatus[]
export const APPOINTMENT_TRANSITIONS: Readonly<Record<AgendaStatus, AgendaStatus[]>>
export function clinicDayKey(instant?: string | Date): string
export function clinicTime(instant: string | Date): string
export function clinicDate(instant: string | Date): string
export function groupScheduleByDay(
  items: AgendaAppointment[],
  days: string[],
): Map<string, AgendaAppointment[]>
export function editorStatuses(status?: AgendaStatus): AgendaStatus[]
export function clinicDateTimeToInstant(day: string, time: string): string
export function addClinicDays(day: string, amount: number): string
export function moveCalendarDay(day: string, view: string, direction: number): string
export function calendarRange(
  day: string,
  view: string,
): { start: string; end: string; days: string[] }
export function parseSchedule(value: unknown, clinicId: string): AgendaAppointment[]
export function loadSchedule(
  client: any,
  clinicId: string,
  range: { start: string; end: string },
  signal?: AbortSignal,
): Promise<AgendaAppointment[]>
export function loadClinicians(
  client: any,
  clinicId: string,
  signal?: AbortSignal,
): Promise<AgendaClinician[]>
export function saveAppointment(
  client: any,
  clinicId: string,
  input: Record<string, unknown>,
  appointmentId: string | null,
  role: string,
): Promise<AgendaAppointment>
