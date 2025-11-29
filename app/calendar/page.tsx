

"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { ModernCalendar } from "@/components/calendar/modern-calendar"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"

export default function CalendarPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients (
            first_name,
            last_name
          ),
          profiles (
            full_name
          )
        `)

      if (error) throw error

      if (data) {
        const mappedAppointments = data.map((apt: any) => ({
          id: apt.id,
          patientName: `${apt.patients?.first_name} ${apt.patients?.last_name}`,
          patientId: apt.patient_id,
          startTime: apt.start_time,
          endTime: apt.end_time,
          treatment: apt.type,
          // Default values for now as they might not be in DB yet
          amount: "$0", 
          color: "#007BFF", 
          dentist: apt.profiles?.full_name || "Doctor",
          notes: apt.notes,
          status: apt.status,
        }))
        setAppointments(mappedAppointments)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAppointment = async (newAppointment: any) => {
    try {
      // Map back to DB format
      const dbAppointment = {
        patient_id: newAppointment.patientId,
        doctor_id: user?.id, // Assign to current user for now
        start_time: newAppointment.startTime,
        end_time: newAppointment.endTime,
        type: newAppointment.treatment,
        notes: newAppointment.notes,
        status: 'scheduled'
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert([dbAppointment])
        .select()

      if (error) throw error

      if (data) {
        fetchAppointments() // Refresh list
      }
    } catch (error) {
      console.error('Error creating appointment:', error)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Calendario" />
      <ModernCalendar 
        appointments={appointments}
        onAppointmentCreate={handleCreateAppointment}
      />
    </div>
  )
}
