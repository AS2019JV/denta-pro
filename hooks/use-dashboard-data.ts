import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Appointment, Patient, Treatment, Doctor } from "@/types"

export function useDashboardData() {
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['dashboard', 'patients'],
    queryFn: async () => {
      console.log("[Dashboard] Fetching patients...")
      const { data, count, error } = await supabase.from('patients').select('*', { count: 'exact', head: false }).limit(10)
      if (error) {
        console.error("[Dashboard] Patients error:", error.message)
        throw error
      }
      if (data) (data as any).totalCount = count
      return data as Patient[]
    }
  })

  const { data: dentists = [], isLoading: isLoadingDentists } = useQuery({
    queryKey: ['dashboard', 'dentists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'doctor')
      if (error) {
        console.error("[Dashboard] Dentists error:", error.message)
        throw error
      }
      return data as Doctor[]
    }
  })

  const { data: treatments = [], isLoading: isLoadingTreatments } = useQuery({
    queryKey: ['dashboard', 'services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*')
      if (error) {
        console.error("[Dashboard] Services error:", error.message)
        throw error
      }
      return data as Treatment[]
    }
  })

  const { data: appointments = [], isLoading: isLoadingAppointments, refetch: refreshAppointments } = useQuery({
    queryKey: ['dashboard', 'appointments'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data, error } = await supabase.from('appointments')
        .select('*, patients(*), profiles(*)')
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: true })
      
      if (error) {
        console.error("[Dashboard] Appointments error:", error.message)
        throw error
      }
      return (data || []) as unknown as Appointment[]
    }
  })

  const { data: billings = [], isLoading: isLoadingBillings, refetch: refreshBillings } = useQuery({
    queryKey: ['dashboard', 'billings'],
    queryFn: async () => {
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data, error } = await supabase.from('billings').select('*').gte('created_at', firstDayOfMonth)
      if (error) {
        console.error("[Dashboard] Billings error:", error.message)
        throw error
      }
      return data || []
    }
  })

  const isLoading = isLoadingPatients || isLoadingDentists || isLoadingTreatments || isLoadingAppointments || isLoadingBillings

  const refreshData = () => {
    refreshAppointments()
    refreshBillings()
  }

  return {
    appointments,
    patients,
    treatments,
    dentists,
    billings,
    isLoading,
    refreshData
  }
}
