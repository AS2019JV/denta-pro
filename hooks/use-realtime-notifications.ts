"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

export function useRealtimeNotifications() {
  const { currentClinicId } = useAuth()

  useEffect(() => {
    if (!currentClinicId) return

    // Subscribe to new appointments
    const channel = supabase
      .channel('clinic-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinicId}`
        },
        (payload) => {
          toast.info("Nueva cita agendada", {
            description: "Se ha registrado una nueva cita en el calendario.",
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentClinicId])
}
