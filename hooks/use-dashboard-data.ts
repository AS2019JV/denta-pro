import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { Appointment, Patient } from "@/types"
import { clinicDayKey, calendarRange } from "@/lib/agenda.mjs"

export function parseDashboardPage<T>(value: unknown): { items: T[]; total_count: number } {
  const page = value as { items?: unknown; total_count?: unknown } | null
  if (!page || !Array.isArray(page.items) || page.items.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string') || !Number.isSafeInteger(page.total_count) || Number(page.total_count) < page.items.length) {
    throw new Error("Respuesta del servidor inválida")
  }
  return { items: page.items as T[], total_count: Number(page.total_count) }
}

export function useDashboardData() {
  const { user, currentClinicId, isLoading: authLoading, authError } = useAuth()
  const enabled = !authLoading && !authError && !!currentClinicId && !!user?.id && ['doctor', 'clinic_owner', 'receptionist'].includes(user.role)
  const scope = [currentClinicId, user?.id, user?.role]
  const {start: rangeStart, end: rangeEnd} = calendarRange(clinicDayKey(), 'list')
  const patientsQuery = useQuery({
    queryKey: ['dashboard', 'patients', ...scope], enabled, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_patient_demographics', { p_clinic_id: currentClinicId!, p_search: '', p_limit: 10, p_offset: 0, p_patient_id: null }).abortSignal(signal)
      if (error) throw error
      return parseDashboardPage<Pick<Patient, 'id' | 'first_name' | 'last_name' | 'cedula' | 'phone'>>(data)
    },
  })
  const appointmentsQuery = useQuery({
    queryKey: ['dashboard', 'appointments', ...scope, rangeStart, rangeEnd], enabled, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_clinic_schedule', { p_clinic_id: currentClinicId!, p_start: rangeStart, p_end: rangeEnd }).abortSignal(signal)
      if (error) throw error
      return parseDashboardPage<Appointment>(data)
    },
  })
  const queries = [patientsQuery, appointmentsQuery]
  const hasError = !!authError || (enabled && queries.some(query => query.isError))
  const refreshData = () => {
    if (!enabled) return
    return Promise.all(queries.map(query => query.refetch()))
  }
  return {
    patients: enabled ? patientsQuery.data?.items || [] : [],
    patientTotal: enabled ? patientsQuery.data?.total_count : undefined,
    appointments: enabled ? appointmentsQuery.data?.items || [] : [],
    isLoading: authLoading || (enabled && !hasError && queries.some(query => query.isPending)),
    hasError, hasAuthority: enabled, refreshData,
  }
}
