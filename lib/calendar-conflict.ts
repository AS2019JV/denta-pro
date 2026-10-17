import { SupabaseClient } from '@supabase/supabase-js'

export interface ConflictCheckParams {
  supabase: SupabaseClient<any, any, any>
  doctorId: string
  startTime: string | Date
  endTime: string | Date
  clinicId?: string | null
  excludeAppointmentId?: string
}

export interface ConflictCheckResult {
  hasConflict: boolean
  conflicts: Array<{
    id: string
    start_time: string
    end_time: string
    status: string
  }>
  error?: any
}

/**
 * Deterministic in-memory interval overlap calculation:
 * Returns true if [startA, endA) overlaps with [startB, endB).
 * Contiguous boundaries (endA === startB or startA === endB) do NOT overlap.
 */
export function areIntervalsOverlapping(
  startA: Date | string | number,
  endA: Date | string | number,
  startB: Date | string | number,
  endB: Date | string | number
): boolean {
  const sA = new Date(startA).getTime()
  const eA = new Date(endA).getTime()
  const sB = new Date(startB).getTime()
  const eB = new Date(endB).getTime()

  return sA < eB && eA > sB
}

/**
 * Checks if a doctor already has an overlapping appointment in the given clinic.
 * Two intervals [S1, E1) and [S2, E2) overlap iff:
 * S1 < E2 AND E1 > S2
 * Cancelled appointments are excluded.
 */
export async function checkAppointmentConflict({
  supabase,
  doctorId,
  startTime,
  endTime,
  clinicId,
  excludeAppointmentId,
}: ConflictCheckParams): Promise<ConflictCheckResult> {
  const startIso = typeof startTime === 'string' ? startTime : startTime.toISOString()
  const endIso = typeof endTime === 'string' ? endTime : endTime.toISOString()

  let query = supabase
    .from('appointments')
    .select('id, start_time, end_time, status')
    .eq('doctor_id', doctorId)
    .lt('start_time', endIso)
    .gt('end_time', startIso)
    .neq('status', 'cancelled')

  if (clinicId) {
    query = query.eq('clinic_id', clinicId)
  }

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId)
  }

  const { data, error } = await query

  if (error) {
    return { hasConflict: false, conflicts: [], error }
  }

  const conflicts = data || []
  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
