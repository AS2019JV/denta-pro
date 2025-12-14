import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { format, isToday, isFuture } from "date-fns"
import { Appointment, Patient, Treatment, Doctor } from "@/types"

export function useDashboardData() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [dentists, setDentists] = useState<Doctor[]>([])
  const [billings, setBillings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      
      const [pats, docs, treats, apps, bills] = await Promise.all([
         supabase.from('patients').select('*'),
         supabase.from('profiles').select('*').eq('role', 'doctor'),
         supabase.from('treatments').select('*'),
         supabase.from('appointments').select('*, patients(*), profiles(*)'),
         supabase.from('billings').select('*')
      ])

      if (pats.data) setPatients(pats.data)
      if (docs.data) setDentists(docs.data)
      if (treats.data) setTreatments(treats.data)
      if (bills.data) setBillings(bills.data)
      
      if (apps.data) {
        // Transform if necessary or just cast if types match DB
        setAppointments(apps.data as unknown as Appointment[])
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const refreshData = fetchDashboardData

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
