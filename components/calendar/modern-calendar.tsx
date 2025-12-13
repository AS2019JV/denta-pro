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
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Settings, Check, MessageSquare, X } from "lucide-react"
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
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
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
        setCurrentDate(addMonths(currentDate, 1))
        setIsMonthChanging(false)
    }, 300)
  }
  const prevMonth = () => {
    setMonthChangeDirection("left")
    setIsMonthChanging(true)
    setTimeout(() => {
        setCurrentDate(subMonths(currentDate, 1))
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
                notes: selectedAppointment.notes 
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
          {view !== 'month' && (
             <div className="flex items-center justify-center h-40 text-muted-foreground">
                 Vista {view} simplificada para esta demostración (Funcionalidad completa en Mes)
             </div>
          )}
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
                            <Input value={selectedAppointment.type} onChange={(e) => setSelectedAppointment({...selectedAppointment, type: e.target.value})} />
                         </div>
                         <div className="grid gap-2">
                            <Label>Notas</Label>
                            <Textarea value={selectedAppointment.notes || ''} onChange={(e) => setSelectedAppointment({...selectedAppointment, notes: e.target.value})} />
                         </div>
                    </div>
                 )}
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
              {!isEditing ? (
                 <>
                   <div className="flex gap-2">
                      <Button variant="outline" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleUpdateStatus('cancelled')}>
                          <X className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="text-green-500 hover:text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus('confirmed')}>
                          <Check className="h-4 w-4" />
                      </Button>
                   </div>
                   <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
                      <Button onClick={() => setShowAppointmentDialog(false)}>Cerrar</Button>
                   </div>
                 </>
              ) : (
                 <>
                   <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                   <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
                 </>
              )}
          </DialogFooter>
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
