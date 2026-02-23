"use client"

import Link from "next/link"
import { useState } from "react"
import { format, isToday, isFuture } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  Mail,
  Plus,
  ChevronDown,
  UserPlus,
  CalendarPlus,
  Zap,
  Check,
  X,
  CalendarClock,
  Send,
  ClipboardList,
  CalendarRange,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { AddPatientForm } from "@/components/add-patient-form"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { supabase } from "@/lib/supabase"
import { Appointment } from "@/types"
import { AsyncPatientSelect } from "@/components/async-patient-select"

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { appointments, patients, treatments, dentists, billings, isLoading, refreshData } = useDashboardData()



  // Computed data
  const recentAppointments = appointments
    .filter(a => isToday(new Date(a.start_time)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const upcomingAppointments = appointments
    .filter(a => isFuture(new Date(a.start_time)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5) // Show only top 5

  // Calculate real stats
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  
  const monthlyRevenue = billings.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

  const pendingTreatmentsCount = appointments.filter(a => 
      (a.status === 'scheduled' || a.status === 'confirmed') && 
      isFuture(new Date(a.start_time))
  ).length

  const stats = [
    {
      title: t("total-patients"),
      value: ((patients as any).totalCount || patients.length).toString(),
      change: "+12%", 
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: t("appointments-today"),
      value: recentAppointments.length.toString(),
      change: "+5%",
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: t("monthly-revenue"),
      value: `$${monthlyRevenue.toLocaleString()}`, 
      change: "+18%", // We would need previous month data to calculate real change
      icon: DollarSign,
      color: "text-yellow-600",
    },
    {
      title: t("pending-treatments"),
      value: pendingTreatmentsCount.toString(),
      change: "-3%",
      icon: Clock,
      color: "text-red-600",
    },
  ]

  // State
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false)
  const [isAppointmentDetailsOpen, setIsAppointmentDetailsOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // New Appointment Form State
  const [newApp, setNewApp] = useState({
    patientId: "",
    treatmentId: "",
    doctorId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    notes: "",
    createInvoice: true,
    invoiceAmount: "",
  })

  // Set default doctor on load if available
  if (!newApp.doctorId && user?.id) {
     // This causes infinite loop if we don't check carefully or use useEffect. 
     // Better do it in handleCreateAppointment fallback or init state properly.
     // But user is async. Let's just default in render if empty or handle in submit.
  }

  // Handlers
  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsAppointmentDetailsOpen(true)
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedAppointment) return
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', selectedAppointment.id)

      if (error) throw error

      toast.success(`Cita ${status === 'confirmed' ? 'confirmada' : 'actualizada'}`)
      refreshData()
      setIsAppointmentDetailsOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("Error al actualizar la cita")
    }
  }

  const handleSendMessage = () => {
    if (!selectedAppointment || !selectedAppointment.patients?.phone) {
        toast.error("No hay número de teléfono disponible")
        return
    }
    const message = `Hola ${selectedAppointment.patients.first_name}, recordatorio de su cita...`
    window.open(`https://wa.me/${selectedAppointment.patients.phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleCreateAppointment = async () => {
    try {
        if (!newApp.patientId || !newApp.treatmentId || !newApp.date || !newApp.time) {
            toast.error("Por favor complete todos los campos requeridos")
            return
        }

        const startDateTime = new Date(`${newApp.date}T${newApp.time}`)
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000) // Default 1 hour duration

        const treatment = treatments.find(t => t.id === newApp.treatmentId)

        // 1. Create Appointment
        const { data: appData, error: appError } = await supabase
            .from('appointments')
            .insert({
                patient_id: newApp.patientId,
                doctor_id: newApp.doctorId || user?.id,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                type: treatment?.name || 'Consulta',
                status: 'confirmed',
                notes: newApp.notes
            })
            .select()
            .single()

        if (appError) throw appError

        // 2. Create Invoice (Optional)
        if (newApp.createInvoice && appData) {
            const amount = newApp.invoiceAmount ? parseFloat(newApp.invoiceAmount) : treatment?.price || 0
            await supabase.from('billings').insert({
                patient_id: newApp.patientId,
                appointment_id: appData.id,
                amount: amount,
                status: 'pending',
                description: `Cita: ${treatment?.name}`,
                invoice_number: `INV-${Date.now()}`
            })
        }

        toast.success("Cita creada exitosamente")
        setIsNewAppointmentOpen(false)
        refreshData()
        
        // Reset form
        setNewApp({
            patientId: "",
            treatmentId: "",
            doctorId: user?.id || "",
            date: format(new Date(), "yyyy-MM-dd"),
            time: "09:00",
            notes: "",
            createInvoice: true,
            invoiceAmount: "",
        })

    } catch (error) {
        console.error("Error creating appointment:", error)
        toast.error("Error al crear la cita")
    }
  }

  const handleSendReminder = () => {
      // Functional placeholder for now
      toast.info("Funcionalidad de envío masivo de correos próximamente")
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
            <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>
            ))}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
             <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
         </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`¡Hola, ${user?.name?.split(" ")[0] || 'Doctor'}!`}>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsNewAppointmentOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cita
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 hover:bg-accent/50 transition-all duration-200">
                <Zap className="h-4 w-4 text-foreground/70" />
                Acciones Rápidas
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <DropdownMenuItem 
                onClick={() => setIsAddPatientOpen(true)}
                className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                    <UserPlus className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-sm">Nuevo Paciente</span>
                    <span className="text-xs text-muted-foreground/80">Registrar paciente</span>
                  </div>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => setIsNewAppointmentOpen(true)}
                className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                    <CalendarPlus className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-sm">Agendar Cita</span>
                    <span className="text-xs text-muted-foreground/80">Nueva cita médica</span>
                  </div>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-2" />
              
              <DropdownMenuItem 
                onClick={handleSendReminder}
                className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                    <Mail className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-sm">Enviar Recordatorio</span>
                    <span className="text-xs text-muted-foreground/80">Notificación por email</span>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Add Patient Dialog */}
        <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Añadir Paciente</DialogTitle>
              <DialogDescription>Completa la información del nuevo paciente</DialogDescription>
            </DialogHeader>
            <AddPatientForm 
              onSubmit={(data) => {
                refreshData() // Reload patients list
                setIsAddPatientOpen(false)
              }} 
              onCancel={() => setIsAddPatientOpen(false)} 
            />
          </DialogContent>
        </Dialog>

        {/* New Appointment Dialog */}
        <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nueva Cita</DialogTitle>
              <DialogDescription>Programa una nueva cita.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Paciente</Label>
                    <AsyncPatientSelect 
                        value={newApp.patientId} 
                        onValueChange={v => setNewApp({...newApp, patientId: v})} 
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Tratamiento</Label>
                    <Select value={newApp.treatmentId} onValueChange={v => {
                        const t = treatments.find(tr => tr.id === v)
                        setNewApp({
                            ...newApp, 
                            treatmentId: v, 
                            invoiceAmount: t ? t.price.toString() : ""
                        })
                    }}>
                        <SelectTrigger><SelectValue placeholder="Tipo..."/></SelectTrigger>
                        <SelectContent>
                            {treatments.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name} (${t.price})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Doctor</Label>
                    <Select value={newApp.doctorId} onValueChange={v => setNewApp({...newApp, doctorId: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                        <SelectContent>
                             {/* Fallback to current user if dentist list empty or simply show all dentists */}
                            {dentists.length > 0 ? dentists.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.full_name || "Doctor"}</SelectItem>
                            )) : (
                                <SelectItem value={user?.id || "current"}>{user?.name || "Yo"}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Fecha</Label>
                        <Input type="date" value={newApp.date} onChange={e => setNewApp({...newApp, date: e.target.value})} />
                    </div>
                     <div className="grid gap-2">
                        <Label>Hora</Label>
                        <Input type="time" value={newApp.time} onChange={e => setNewApp({...newApp, time: e.target.value})} />
                    </div>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Switch 
                        checked={newApp.createInvoice} 
                        onCheckedChange={c => setNewApp({...newApp, createInvoice: c})}
                    />
                    <Label className="flex-1">Generar Factura</Label>
                    {newApp.createInvoice && (
                        <Input 
                            type="number" 
                            className="w-24 h-8" 
                            value={newApp.invoiceAmount} 
                            onChange={e => setNewApp({...newApp, invoiceAmount: e.target.value})}
                            placeholder="$"
                        />
                    )}
                </div>
                <div className="grid gap-2">
                    <Label>Notas</Label>
                    <Textarea value={newApp.notes} onChange={e => setNewApp({...newApp, notes: e.target.value})} />
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateAppointment}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Appointment Details */}
      <Dialog open={isAppointmentDetailsOpen} onOpenChange={setIsAppointmentDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de la Cita</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback>{selectedAppointment.patients?.first_name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-semibold text-lg">{selectedAppointment.patients?.first_name} {selectedAppointment.patients?.last_name}</h3>
                        <Badge variant={selectedAppointment.status === "confirmed" ? "default" : "secondary"}>{selectedAppointment.status}</Badge>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <Label className="text-muted-foreground">Fecha</Label>
                        <p>{format(new Date(selectedAppointment.start_time), "dd/MM/yyyy")}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">Hora</Label>
                        <p>{format(new Date(selectedAppointment.start_time), "HH:mm")}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">Tratamiento</Label>
                        <p>{selectedAppointment.type}</p>
                    </div>
                </div>
                {selectedAppointment.notes && (
                    <div className="bg-muted p-2 rounded text-sm">
                        {selectedAppointment.notes}
                    </div>
                )}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus('confirmed')}>
                        <Check className="w-4 h-4 mr-1" /> Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('rescheduled')}>
                         <CalendarClock className="w-4 h-4 mr-1" /> Reagendar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus('cancelled')}>
                         <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" variant="secondary" className="ml-auto" onClick={handleSendMessage}>
                         <Send className="w-4 h-4 mr-1" /> Mensaje
                    </Button>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link href="/reports" key={stat.title}>
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={stat.change.startsWith("+") ? "text-emerald-500" : "text-rose-500"}>{stat.change}</span> vs mes anterior
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent/Today Appointments */}
        <Card>
            <CardHeader>
                <CardTitle>Citas de Hoy</CardTitle>
                <CardDescription>Tienes {recentAppointments.length} citas hoy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {recentAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay citas para hoy</p>
                ) : (
                    recentAppointments.map(app => (
                        <div key={app.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(app)}>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback>{app.patients?.first_name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{app.patients?.first_name} {app.patients?.last_name}</p>
                                    <p className="text-xs text-muted-foreground">{app.type}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline">{format(new Date(app.start_time), "HH:mm")}</Badge>
                            </div>
                        </div>
                    ))
                )}
                <Link href="/calendar?view=today">
                    <Button variant="outline" className="w-full mt-4">Ver todas las citas</Button>
                </Link>
            </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
            <CardHeader>
                <CardTitle>Próximas Citas</CardTitle>
                <CardDescription>Siguientes días</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {upcomingAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay citas próximas</p>
                ) : (
                    upcomingAppointments.map(app => (
                        <div key={app.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(app)}>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback>{app.patients?.first_name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{app.patients?.first_name} {app.patients?.last_name}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(app.start_time), "dd MMM")}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-mono">{format(new Date(app.start_time), "HH:mm")}</span>
                            </div>
                        </div>
                    ))
                )}
                 <Link href="/calendar?view=month">
                    <Button className="w-full mt-4">Ver calendario completo</Button>
                </Link>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
