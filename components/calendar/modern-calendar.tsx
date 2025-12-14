"use client"

import { useState, useEffect, useRef } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Settings, Check, MessageSquare, X, List, Calendar as CalendarIcon, Clock, AlertTriangle, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Appointment as GlobalAppointment, Patient, Doctor, Treatment } from "@/types"

// Extending GlobalAppointment for Calendar specific UI needs if any, or just use it + UI fields
interface CalendarAppointment extends GlobalAppointment {
  patientName: string
  dentistName: string
  color: string
}

interface ModernCalendarProps {
  appointments?: any[] // Accepting standard or mapped format for flexibility, but preferring typed
  onDateSelect?: (date: Date) => void
  onAppointmentClick?: (appointment: any) => void
  onAppointmentCreate?: (appointment: any) => void
  initialView?: "month" | "week" | "today"
}

export function ModernCalendar({
  appointments: propAppointments = [],
  onDateSelect,
  onAppointmentClick,
  onAppointmentCreate,
  initialView = "month",
}: ModernCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // Real data state
  const [dbPatients, setDbPatients] = useState<Patient[]>([])
  const [dbDentists, setDbDentists] = useState<Doctor[]>([])
  const [dbTreatments, setDbTreatments] = useState<Treatment[]>([]) 
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  
  const [view, setView] = useState<"month" | "week" | "today" | "list" | "timeline">(initialView)
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false)
  const [showAppointmentDetails, setShowAppointmentDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null)
  
  // Settings / filters
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [selectedDentists, setSelectedDentists] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [isMonthChanging, setIsMonthChanging] = useState(false)
  const [monthChangeDirection, setMonthChangeDirection] = useState<"left" | "right" | null>(null)
  const [calendarDays, setCalendarDays] = useState<Date[]>([])

  // Feature states
  const [isEditing, setIsEditing] = useState(false)
  const [enableAutomatedMessages, setEnableAutomatedMessages] = useState(true)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [messageContent, setMessageContent] = useState("")

  const [newAppointment, setNewAppointment] = useState({
    patientId: "",
    treatment: "",
    date: format(selectedDate, "yyyy-MM-dd"),
    customStartTime: { hours: 9, minutes: 0 },
    customEndTime: { hours: 10, minutes: 0 },
    notes: "",
    dentistId: "",
    invoiceAmount: "", 
    createInvoice: true 
  })

  // Fetch Data on Mount
  useEffect(() => {
    const fetchData = async () => {
      const { data: pats } = await supabase.from('patients').select('*')
      if (pats) setDbPatients(pats)

      const { data: docs } = await supabase.from('profiles').select('*').eq('role', 'doctor')
      if (docs) {
        setDbDentists(docs)
        if (docs.length > 0) {
          setNewAppointment(prev => ({ ...prev, dentistId: docs[0].id }))
          setSelectedDentists(docs.map(d => d.id))
        }
      }

      const { data: treats } = await supabase.from('treatments').select('*')
      if (treats) {
        setDbTreatments(treats)
        if (treats.length > 0) {
           setNewAppointment(prev => ({ ...prev, treatment: treats[0].id }))
        }
      }

      fetchAppointments()
    }
    fetchData()
  }, [])

  const fetchAppointments = async () => {
    const { data: apps, error } = await supabase.from('appointments').select(`
      *,
      patients (first_name, last_name),
      profiles (full_name)
    `)
    
    if (apps) {
      // Need current treatments to map types?
      const { data: currentTreatments } = await supabase.from('treatments').select('*')

      const mapped: CalendarAppointment[] = apps.map((app: any) => {
        // Find color based on treatment name matching? Or default.
        return {
          ...app,
          status: app.status as any,
          patientName: app.patients ? `${app.patients.first_name} ${app.patients.last_name}` : 'Unknown',
          dentistName: app.profiles ? app.profiles.full_name : 'Unknown',
          color: "#007BFF" 
        }
      })
      setAppointments(mapped)
    }
  }

  // Reload appointments when prop changes
  useEffect(() => {
     // If props are passed, we might want to merge or override? 
     // For now preferring internal fetch for source of truth as per request
  }, [propAppointments])

  // Calendar generation logic
  useEffect(() => {
    if (view === "month") {
      setCalendarDays(generateMonthDays())
    } else if (view === "week") {
      setCalendarDays(generateWeekDays())
    }
  }, [currentDate, view])

  const generateMonthDays = () => {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const startDay = monthStart.getDay()
      const endDay = 6 - monthEnd.getDay()
      const prevMonthDays = startDay > 0 ? eachDayOfInterval({ start: addDays(monthStart, -startDay), end: addDays(monthStart, -1) }) : []
      const nextMonthDays = endDay > 0 ? eachDayOfInterval({ start: addDays(monthEnd, 1), end: addDays(monthEnd, endDay) }) : []
      return [...prevMonthDays, ...days, ...nextMonthDays]
  }

  const generateWeekDays = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) })
  }

  const handleCreateAppointment = async () => {
    try {
      if (!newAppointment.patientId || !newAppointment.dentistId) {
        toast.error("Por favor selecciona un paciente y un dentista")
        return
      }

      const start = new Date(newAppointment.date)
      start.setHours(newAppointment.customStartTime.hours, newAppointment.customStartTime.minutes)
      const end = new Date(newAppointment.date)
      end.setHours(newAppointment.customEndTime.hours, newAppointment.customEndTime.minutes)

      const treatment = dbTreatments.find(t => t.id === newAppointment.treatment)

      const { data: appData, error: appError } = await supabase
        .from('appointments')
        .insert({
          patient_id: newAppointment.patientId,
          doctor_id: newAppointment.dentistId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          type: treatment?.name || 'Consulta',
          status: 'confirmed',
          notes: newAppointment.notes
        })
        .select()
        .single()

      if (appError) throw appError

      if (newAppointment.createInvoice && appData) {
        const amount = newAppointment.invoiceAmount ? parseFloat(newAppointment.invoiceAmount) : treatment?.price || 0
        await supabase.from('billings').insert({
          patient_id: newAppointment.patientId,
          appointment_id: appData.id,
          amount: amount,
          status: 'pending',
          description: `Cita: ${treatment?.name}`,
          invoice_number: `INV-${Date.now()}`
        })
      }

      await fetchAppointments()
      toast.success("Cita creada correctamente")
      setShowNewAppointmentDialog(false)
      
      setNewAppointment({
        patientId: "",
        treatment: dbTreatments[0]?.id || "",
        date: format(new Date(), "yyyy-MM-dd"),
        customStartTime: { hours: 9, minutes: 0 },
        customEndTime: { hours: 10, minutes: 0 },
        notes: "",
        dentistId: dbDentists[0]?.id || "",
        invoiceAmount: "",
        createInvoice: true
      })

    } catch (error) {
      console.error("Error creating appointment:", error)
      toast.error("Error al crear la cita")
    }
  }

  const nextMonth = () => {
    setMonthChangeDirection("right")
    setIsMonthChanging(true)
    setTimeout(() => {
        if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
        else if (view === 'list') setCurrentDate(addDays(currentDate, 7)) // List view jumps a week? Or keep it month based? Let's say month for list.
        else setCurrentDate(addMonths(currentDate, 1))
        
        setIsMonthChanging(false)
    }, 300)
  }
  const prevMonth = () => {
    setMonthChangeDirection("left")
    setIsMonthChanging(true)
    setTimeout(() => {
        if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
        else if (view === 'list') setCurrentDate(subDays(currentDate, 7))
        else setCurrentDate(subMonths(currentDate, 1))

        setIsMonthChanging(false)
    }, 300)
  }
  
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setNewAppointment(prev => ({ ...prev, date: format(date, "yyyy-MM-dd") }))
    if (view === 'month') setShowNewAppointmentDialog(true)
  }

  const handleAppointmentClick = (app: CalendarAppointment) => {
      setSelectedAppointment(app)
      setShowAppointmentDialog(true)
      setIsEditing(false)
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedAppointment) return

    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', selectedAppointment.id)

        if (error) throw error

        setAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? { ...a, status: status as any } : a))
        if (selectedAppointment) {
            setSelectedAppointment({ ...selectedAppointment, status: status as any })
        }
        
        if (status === 'confirmed' && enableAutomatedMessages) {
             const msg = `Hola ${selectedAppointment.patientName}, su cita de ${selectedAppointment.type} ha sido confirmada para el ${format(parseISO(selectedAppointment.start_time), "dd/MM/yyyy 'a las' HH:mm")}.`
             setMessageContent(msg)
             setShowMessageDialog(true)
             setShowAppointmentDialog(false)
        } else {
             toast.success(`Cita ${status === 'confirmed' ? 'confirmada' : 'cancelada'}`)
             setShowAppointmentDialog(false)
        }

    } catch (e) {
        console.error(e)
        toast.error("Error al actualizar la cita")
    }
  }

  const handleSaveEdit = async () => {
      if (!selectedAppointment) return
      try {
          const { error } = await supabase
            .from('appointments')
            .update({ 
                type: selectedAppointment.type,
                notes: selectedAppointment.notes,
                start_time: selectedAppointment.start_time,
                end_time: selectedAppointment.end_time 
            })
            .eq('id', selectedAppointment.id)
            
          if(error) throw error
          
          await fetchAppointments()
          toast.success("Cita actualizada")
          setIsEditing(false)
          setShowAppointmentDialog(false)
      } catch(e) {
          console.error(e)
          toast.error("Error al guardar cambios")
      }
  }

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(a => isSameDay(parseISO(a.start_time), date))
  }

  const filterAppointments = (appts: CalendarAppointment[]) => {
      return appts.filter(a => 
        (filterStatus ? a.status === filterStatus : true) &&
        (searchQuery ? a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) : true) &&
        (selectedDentists.length ? a.doctor_id && selectedDentists.includes(a.doctor_id) : true)
      )
  }

  const renderMonthView = () => (
    <div className={cn("transition-opacity duration-300", isMonthChanging && "opacity-50")}>
       <div className="grid grid-cols-7 gap-1">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
             <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
             const dayAppts = getAppointmentsForDate(day)
             return (
               <div key={i} 
                    className={cn(
                        "h-24 p-1 border rounded-md transition-all hover:shadow-sm cursor-pointer",
                        !isSameMonth(day, currentDate) && "bg-muted/20 opacity-50",
                        isSameDay(day, selectedDate) && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => handleDateSelect(day)}>
                  <div className="flex justify-between">
                     <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, 'd')}</span>
                     {dayAppts.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 px-1">{dayAppts.length}</Badge>}
                  </div>
                  <div className="mt-1 space-y-1 overflow-hidden max-h-[60px]">
                      {dayAppts.slice(0, 3).map((a, idx) => (
                          <div key={idx} className="text-[9px] truncate px-1 rounded" style={{ backgroundColor: `${a.color}20`, color: a.color }}>
                             {format(parseISO(a.start_time), 'HH:mm')} {a.patientName}
                          </div>
                      ))}
                  </div>
               </div>
             )
          })}
       </div>
    </div>
  )

  const renderWeekView = () => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7 AM to 8 PM
    const weekDays = generateWeekDays()

    return (
      <div className="flex flex-col h-[600px] overflow-auto">
        <div className="grid grid-cols-8 border-b sticky top-0 bg-background z-10">
          <div className="p-2 text-center text-xs font-medium text-muted-foreground border-r">Hora</div>
          {weekDays.map((day, i) => (
             <div key={i} className={cn("p-2 text-center text-xs font-medium border-r min-w-[100px]", isToday(day) && "text-primary bg-primary/5")}>
                {format(day, 'EEE d', { locale: es })}
             </div>
          ))}
        </div>
        <div className="grid grid-cols-8 flex-1">
           <div className="border-r">
              {hours.map(hour => (
                  <div key={hour} className="h-20 border-b text-xs text-muted-foreground p-1 text-right relative">
                      <span className="-top-2 relative">{hour}:00</span>
                  </div>
              ))}
           </div>
           {weekDays.map((day, dayIdx) => {
              const dayAppts = getAppointmentsForDate(day)
              return (
                  <div key={dayIdx} className="border-r relative min-h-[1120px]"> {/* 80px * 14 hours */}
                      {/* Grid lines */}
                      {hours.map(h => <div key={h} className="h-20 border-b border-dashed border-gray-100" />)}
                      
                      {/* Apps */}
                      {dayAppts.map((app, idx) => {
                          const start = parseISO(app.start_time)
                          const end = parseISO(app.end_time)
                          const startHour = start.getHours()
                          const startMin = start.getMinutes()
                          const durationMin = (end.getTime() - start.getTime()) / (1000 * 60)
                          
                          // 7 AM is 0px. Each hour is 80px.
                          const top = ((startHour - 7) * 80) + ((startMin / 60) * 80)
                          const height = (durationMin / 60) * 80
                          
                          return (
                              <div 
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); handleAppointmentClick(app) }}
                                className="absolute left-1 right-1 rounded px-2 py-1 text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-l-2 shadow-sm z-10"
                                style={{ 
                                    top: `${top}px`, 
                                    height: `${height}px`,
                                    backgroundColor: `${app.color}15`,
                                    borderLeftColor: app.color,
                                    color: app.color
                                }}
                              >
                                  <div className="font-semibold truncate">{app.patientName}</div>
                                  <div className="opacity-80 truncate text-[10px]">{app.type}</div>
                              </div>
                          )
                      })}
                  </div>
              )
           })}
        </div>
      </div>
    )
  }

  const renderListView = () => {
      // Group by date
      const sorted = [...filterAppointments(appointments)].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      const grouped: { [key: string]: CalendarAppointment[] } = {}
      
      sorted.forEach(app => {
          const dateKey = format(parseISO(app.start_time), 'yyyy-MM-dd')
          if (!grouped[dateKey]) grouped[dateKey] = []
          grouped[dateKey].push(app)
      })
      
      return (
          <div className="space-y-6">
              {Object.keys(grouped).map(dateKey => (
                  <div key={dateKey} className="space-y-2">
                       <h3 className="font-medium text-sm text-muted-foreground sticky top-0 bg-background py-2 z-10 border-b">
                           {format(parseISO(dateKey), "EEEE d 'de' MMMM", { locale: es })}
                       </h3>
                       <div className="space-y-2">
                           {grouped[dateKey].map(app => (
                               <div key={app.id} 
                                   onClick={() => handleAppointmentClick(app)}
                                   className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-sm cursor-pointer bg-card transition-all">
                                   <div className="w-16 text-center">
                                       <div className="text-sm font-bold">{format(parseISO(app.start_time), 'HH:mm')}</div>
                                       <div className="text-xs text-muted-foreground">{format(parseISO(app.end_time), 'HH:mm')}</div>
                                   </div>
                                   <div className="flex-1">
                                       <div className="font-medium">{app.patientName}</div>
                                       <div className="text-sm text-muted-foreground flex items-center gap-2">
                                           <span>{app.type}</span>
                                           <span>•</span>
                                           <span>Dr. {app.dentistName}</span>
                                       </div>
                                   </div>
                                   <Badge variant={app.status === 'confirmed' ? "default" : app.status === 'cancelled' ? "destructive" : "secondary"}>
                                       {app.status === 'confirmed' ? 'Confirmado' : app.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                                   </Badge>
                               </div>
                           ))}
                       </div>
                  </div>
              ))}
              {sorted.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">No hay citas para los filtros seleccionados.</div>
              )}
          </div>
      )
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
         <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4"/></Button>
            <h2 className="text-xl font-semibold w-40 text-center">{format(currentDate, "MMMM yyyy", { locale: es })}</h2>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4"/></Button>
         </div>
         <div className="flex flex-wrap gap-2">
            {(['month', 'week', 'list'] as const).map(v => (
                <Button key={v} variant={view === v ? "default" : "outline"} size="sm" onClick={() => setView(v as any)} className="capitalize">
                    {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Lista'}
                </Button>
            ))}
            <Button variant="outline" size="icon" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4"/>
            </Button>
         </div>
      </div>

      {/* Main View Area */}
      <Card className="p-4 min-h-[500px]">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'list' && renderListView()}
      </Card>
      
      {/* Appointment Details / Edit Dialog */}
      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Cita" : "Detalles de la Cita"}</DialogTitle>
             <DialogDescription>
                {isEditing ? "Modifique los detalles de la cita." : "Información completa de la cita."}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <>
            <div className="grid gap-4 py-4">
                 {!isEditing ? (
                    <>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>{selectedAppointment.patientName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{selectedAppointment.patientName}</h3>
                          <p className="text-sm text-muted-foreground">{selectedAppointment.type}</p>
                        </div>
                        <Badge className={cn("ml-auto", selectedAppointment.status === 'confirmed' ? "bg-green-500" : "bg-blue-500")}>
                            {selectedAppointment.status === 'confirmed' ? 'Confirmada' : selectedAppointment.status === 'cancelled' ? 'Cancelada' : 'Programada'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                              <Label className="text-muted-foreground">Fecha</Label>
                              <p className="font-medium">{format(parseISO(selectedAppointment.start_time), "dd/MM/yyyy")}</p>
                          </div>
                          <div>
                              <Label className="text-muted-foreground">Hora</Label>
                              <p className="font-medium">{format(parseISO(selectedAppointment.start_time), "HH:mm")} - {format(parseISO(selectedAppointment.end_time), "HH:mm")}</p>
                          </div>
                          <div>
                              <Label className="text-muted-foreground">Dentista</Label>
                              <p className="font-medium">{selectedAppointment.dentistName}</p>
                          </div>
                      </div>
                      
                      {selectedAppointment.notes && (
                           <div>
                              <Label className="text-muted-foreground">Notas</Label>
                              <p className="text-sm bg-muted p-2 rounded">{selectedAppointment.notes}</p>
                          </div>
                      )}
                    </>
                 ) : (
                    <div className="grid gap-4">
                         <div className="grid gap-2">
                            <Label>Tratamiento</Label>
                            <Select 
                                value={selectedAppointment.type} 
                                onValueChange={(val) => setSelectedAppointment({...selectedAppointment, type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione tratamiento" />
                                </SelectTrigger>
                                <SelectContent>
                                    {dbTreatments.map(t => (
                                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                    ))}
                                    <SelectItem value="Consulta">Consulta</SelectItem>
                                    <SelectItem value="Limpieza">Limpieza</SelectItem>
                                    <SelectItem value="Urgencia">Urgencia</SelectItem>
                                    <SelectItem value="Ortodoncia">Ortodoncia</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                <Label>Fecha</Label>
                                <Input 
                                    type="date" 
                                    value={format(parseISO(selectedAppointment.start_time), 'yyyy-MM-dd')} 
                                    onChange={(e) => {
                                        const date = e.target.value
                                        const oldStart = parseISO(selectedAppointment.start_time)
                                        const oldEnd = parseISO(selectedAppointment.end_time)
                                        
                                        const newStart = new Date(date)
                                        newStart.setHours(oldStart.getHours(), oldStart.getMinutes())
                                        
                                        const newEnd = new Date(date)
                                        newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes())
                                        
                                        setSelectedAppointment({
                                            ...selectedAppointment, 
                                            start_time: newStart.toISOString(),
                                            end_time: newEnd.toISOString()
                                        })
                                    }} 
                                />
                             </div>
                             <div className="grid gap-2">
                                <Label>Hora Inicio</Label>
                                <Input 
                                    type="time" 
                                    value={format(parseISO(selectedAppointment.start_time), 'HH:mm')} 
                                    onChange={(e) => {
                                        const time = e.target.value
                                        const [h, m] = time.split(':').map(Number)
                                        const newStart = parseISO(selectedAppointment.start_time)
                                        newStart.setHours(h, m)
                                        
                                        // Calculate duration to keep end time consistent or just update start? 
                                        // Let's just update start, and ensure end is >= start
                                        // But usually moving start moves end. Let's move end too.
                                        const duration = parseISO(selectedAppointment.end_time).getTime() - parseISO(selectedAppointment.start_time).getTime()
                                        const newEnd = new Date(newStart.getTime() + duration)

                                        setSelectedAppointment({
                                            ...selectedAppointment, 
                                            start_time: newStart.toISOString(),
                                            end_time: newEnd.toISOString()
                                        })
                                    }} 
                                />
                             </div>
                         </div>
                         <div className="grid gap-2">
                            <Label>Notas</Label>
                            <Textarea value={selectedAppointment.notes || ''} onChange={(e) => setSelectedAppointment({...selectedAppointment, notes: e.target.value})} />
                         </div>
                    </div>
                 )}
            </div>

          <DialogFooter className="flex justify-between sm:justify-between">
              {!isEditing ? (
                 <>
                   <div className="flex gap-2">
                      <Button variant="outline" size="sm" className={cn("gap-2", selectedAppointment.status === 'cancelled' && "bg-red-50 border-red-200 text-red-700")} onClick={() => handleUpdateStatus('cancelled')}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Cancelar</span>
                      </Button>
                      <Button variant="outline" size="sm" className={cn("gap-2", selectedAppointment.status === 'scheduled' && "bg-yellow-50 border-yellow-200 text-yellow-700")} onClick={() => handleUpdateStatus('scheduled')}>
                          <AlertTriangle className="h-4 w-4" />
                          <span className="sr-only">Pendiente</span>
                      </Button>
                      <Button variant="outline" size="sm" className={cn("gap-2", selectedAppointment.status === 'confirmed' && "bg-green-50 border-green-200 text-green-700")} onClick={() => handleUpdateStatus('confirmed')}>
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Confirmar</span>
                      </Button>
                   </div>
                   <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                      </Button>
                      <Button size="sm" onClick={() => setShowAppointmentDialog(false)}>Cerrar</Button>
                   </div>
                 </>
              ) : (
                 <>
                   <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                   <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
                 </>
              )}
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Message Sending Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Enviar Mensaje Automático</DialogTitle>
               <DialogDescription>
                  Confirmación de cita para el paciente.
               </DialogDescription>
            </DialogHeader>
            <div className="py-4">
               <Label>Mensaje</Label>
               <Textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} rows={4} />
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancelar</Button>
               <Button onClick={async () => {
                   try {
                     const response = await fetch('/api/send-email', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                         to: selectedAppointment?.patientId, // In real app, use email from patient object
                         subject: "Confirmación de Cita",
                         message: messageContent
                       })
                     })
                     
                     if (response.ok) {
                        toast.success("Mensaje enviado correctamente")
                     } else {
                        throw new Error("Failed to send")
                     }
                   } catch (e) {
                     console.error(e)
                     toast.error("Error al enviar el mensaje")
                   }
                   setShowMessageDialog(false)
               }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
            <DialogTitle>Nueva Cita</DialogTitle>
            <DialogDescription>
                Crear cita para {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Paciente</Label>
                    <Select value={newAppointment.patientId} onValueChange={v => setNewAppointment({...newAppointment, patientId: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                        <SelectContent>
                            {dbPatients.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Tratamiento</Label>
                    <Select value={newAppointment.treatment} onValueChange={v => {
                        const t = dbTreatments.find(type => type.id === v)
                        setNewAppointment({...newAppointment, treatment: v, invoiceAmount: t ? t.price.toString() : ""})
                    }}>
                        <SelectTrigger><SelectValue placeholder="Tipo..."/></SelectTrigger>
                        <SelectContent>
                            {dbTreatments.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name} (${t.price})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                </div>
                
                 <div className="grid gap-2">
                    <Label>Dentista</Label>
                    <Select value={newAppointment.dentistId} onValueChange={v => setNewAppointment({...newAppointment, dentistId: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                        <SelectContent>
                            {dbDentists.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.full_name || d.avatar_url || "Dentista"}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid flex-row items-center gap-2">
                    <Label className="flex items-center gap-2">
                        <Switch checked={newAppointment.createInvoice} onCheckedChange={c => setNewAppointment({...newAppointment, createInvoice: c})} />
                        Generar Factura Automática
                    </Label>
                    {newAppointment.createInvoice && (
                        <Input 
                            type="number" 
                            placeholder="Monto" 
                            value={newAppointment.invoiceAmount} 
                            onChange={e => setNewAppointment({...newAppointment, invoiceAmount: e.target.value})}
                        />
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label>Hora Inicio</Label>
                         <div className="flex items-center gap-1">
                             <Input type="number" value={newAppointment.customStartTime.hours} onChange={e => setNewAppointment({...newAppointment, customStartTime: {...newAppointment.customStartTime, hours: parseInt(e.target.value)}})} className="w-16"/>
                             :
                             <Input type="number" value={newAppointment.customStartTime.minutes} onChange={e => setNewAppointment({...newAppointment, customStartTime: {...newAppointment.customStartTime, minutes: parseInt(e.target.value)}})} className="w-16"/>
                         </div>
                    </div>
                     <div className="grid gap-2">
                        <Label>Hora Fin</Label>
                         <div className="flex items-center gap-1">
                             <Input type="number" value={newAppointment.customEndTime.hours} onChange={e => setNewAppointment({...newAppointment, customEndTime: {...newAppointment.customEndTime, hours: parseInt(e.target.value)}})} className="w-16"/>
                             :
                             <Input type="number" value={newAppointment.customEndTime.minutes} onChange={e => setNewAppointment({...newAppointment, customEndTime: {...newAppointment.customEndTime, minutes: parseInt(e.target.value)}})} className="w-16"/>
                         </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label>Notas</Label>
                    <Textarea value={newAppointment.notes} onChange={e => setNewAppointment({...newAppointment, notes: e.target.value})} />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleCreateAppointment}>Guardar Cita</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Configuración</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between border p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-primary"/>
                          <div>
                              <p className="font-medium">Mensajes Automáticos</p>
                              <p className="text-sm text-muted-foreground">Enviar recordatorios por Clinia +</p>
                          </div>
                      </div>
                      <Switch checked={enableAutomatedMessages} onCheckedChange={(c) => setEnableAutomatedMessages(c)}/>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  )
}
