import type { AgendaStatus } from './agenda.mjs'
export interface OperationalReport {
  clinic_id: string
  start: string
  end: string
  summary: { appointments: number; activePatients: number; newPatients: number; completed: number; noShow: number; cancelled: number; attendanceRate: number | null }
  statuses: Record<AgendaStatus, number>
  monthly: { month: string; appointments: number; newPatients: number }[]
  treatments: { name: string; count: number }[]
}
export function reportingPeriod(days: number, today?: string): { start: string; end: string }
export function parseOperationalReport(value: unknown, clinicId: string): OperationalReport
export function loadOperationalReport(client: any, clinicId: string, range: { start: string; end: string }, signal?: AbortSignal): Promise<OperationalReport>
