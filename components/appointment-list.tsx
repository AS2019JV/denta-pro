"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Check, X, Loader2, MessageCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner" // Assuming sonner or similar toast is used, or will use standard alert for now if not found, but dashboard typically has one. switching to simple console/alert if import fails, but let's try standard UI patterns.
// Actually let's assume shadcn/ui toast or similar. Use console.error for safety if not sure, but I'll stick to simple UI updates.

interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  type: string
  notes: string
  patients?: {
    first_name: string
    last_name: string
    phone?: string
  }
}

export function AppointmentList() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients (
            first_name,
            last_name,
            phone
          )
        `)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error

      setAppointments(data || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
    
    // Subscribe to changes
    const channel = supabase
      .channel('appointments-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const updateStatus = async (id: string, status: 'confirmed' | 'no_show') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      
      // Optimistic update
      setAppointments(prev => prev.map(app => 
        app.id === id ? { ...app, status } : app
      ))

    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const getDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMs = endDate.getTime() - startDate.getTime()
    return Math.round(diffMs / 60000) + " min"
  }

  return (
    <Card className="col-span-12 lg:col-span-4 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-0">
          <CardTitle className="text-base font-medium">Citas de Hoy</CardTitle>
          <CardDescription>
            {loading ? "Cargando..." : `${appointments.length} citas programadas`}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (window.location.href = "/calendar")}>
          <Calendar className="h-5 w-5" />
          <span className="sr-only">Ver Calendario</span>
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-2 flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            No hay citas para hoy
          </div>
        ) : (
          <div className="space-y-4 overflow-auto px-4 py-2 flex-1 scrollbar-hide">
            {appointments.map((appointment) => {
              const patientName = appointment.patients 
                ? `${appointment.patients.first_name} ${appointment.patients.last_name}`
                : "Paciente desconocido"
              
              const startTime = new Date(appointment.start_time)

              return (
                <div key={appointment.id} className="flex items-center group">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={`/placeholder.svg?text=${patientName.charAt(0)}`} alt={patientName} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {patientName.split(" ").map(n => n[0]).join("").substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{patientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(startTime, 'h:mm a')} • {getDuration(appointment.start_time, appointment.end_time)} • {appointment.type || 'Consulta'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {appointment.status === "confirmed" ? (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30" title="Confirmado">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    ) : appointment.status === "no_show" ? (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30" title="No asistió">
                        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                          onClick={() => updateStatus(appointment.id, 'confirmed')}
                          title="Confirmar asistencia"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                          onClick={() => updateStatus(appointment.id, 'no_show')}
                          title="Marcar como No Asistió"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {appointment.patients?.phone && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            onClick={() => window.open(`https://wa.me/${appointment.patients?.phone?.replace(/\D/g, '')}`, '_blank')}
                            title="Enviar WhatsApp"
                          >
                           <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="pt-4 px-4 mt-auto">
          <Button className="w-full" size="sm" onClick={() => (window.location.href = "/calendar")}>
            Ver Calendario Completo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
