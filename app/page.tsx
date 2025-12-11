"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  Activity,
  Phone,
  Mail,
  Plus,
  ChevronDown,
  UserPlus,
  CalendarPlus,
  MoreVertical,
  Zap
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AddPatientForm } from "@/components/add-patient-form"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useTranslation()

  const stats = [
    {
      title: t("total-patients"),
      value: "1,234",
      change: "+12%",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: t("appointments-today"),
      value: "23",
      change: "+5%",
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: t("monthly-revenue"),
      value: "$45,231",
      change: "+18%",
      icon: DollarSign,
      color: "text-yellow-600",
    },
    {
      title: t("pending-treatments"),
      value: "12",
      change: "-3%",
      icon: Clock,
      color: "text-red-600",
    },
  ]

  const recentAppointments = [
    {
      id: "1",
      patient: "María García",
      time: "09:00",
      type: "Limpieza",
      status: "confirmed",
    },
    {
      id: "2",
      patient: "Carlos Rodríguez",
      time: "10:30",
      type: "Empaste",
      status: "pending",
    },
    {
      id: "3",
      patient: "Ana Fernández",
      time: "14:00",
      type: "Revisión",
      status: "confirmed",
    },
    {
      id: "4",
      patient: "Luis Martín",
      time: "16:30",
      type: "Endodoncia",
      status: "confirmed",
    },
  ]

  const upcomingAppointments = [
    {
      id: "1",
      patient: "Elena Sánchez",
      date: "Mañana",
      time: "09:30",
      type: "Consulta",
    },
    {
      id: "2",
      patient: "Pedro López",
      date: "Mañana",
      time: "11:00",
      type: "Limpieza",
    },
    {
      id: "3",
      patient: "Isabel Ruiz",
      date: "Viernes",
      time: "15:00",
      type: "Corona",
    },
  ]

  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false)


  return (
    <div className="space-y-6">
      <PageHeader title={`¡Hola, ${user?.name?.split(" ")[0]}!`}>
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
              
              <DropdownMenuItem className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                    <Phone className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-sm">Llamar Paciente</span>
                    <span className="text-xs text-muted-foreground/80">Contacto directo</span>
                  </div>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200">
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
                console.log("Patient added:", data)
                setIsAddPatientOpen(false)
              }} 
              onCancel={() => setIsAddPatientOpen(false)} 
            />
          </DialogContent>
        </Dialog>

        {/* New Appointment Dialog */}
        <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nueva Cita</DialogTitle>
              <DialogDescription>
                Programa una nueva cita para un paciente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="patient-name" className="text-right">
                  Paciente
                </Label>
                <Input id="patient-name" placeholder="Buscar paciente..." className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Fecha
                </Label>
                <Input id="date" type="date" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="time" className="text-right">
                  Hora
                </Label>
                <Input id="time" type="time" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Tratamiento
                </Label>
                <Select>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar tratamiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkup">Consulta General</SelectItem>
                    <SelectItem value="cleaning">Limpieza</SelectItem>
                    <SelectItem value="filling">Empaste</SelectItem>
                    <SelectItem value="extraction">Extracción</SelectItem>
                    <SelectItem value="rootcanal">Endodoncia</SelectItem>
                    <SelectItem value="crown">Corona</SelectItem>
                    <SelectItem value="ortho">Ortodoncia</SelectItem>
                    <SelectItem value="emergency">Urgencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notas
                </Label>
                <Textarea id="notes" className="col-span-3" placeholder="Notas adicionales..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>Cancelar</Button>
              <Button onClick={() => {
                console.log("Appointment created")
                setIsNewAppointmentOpen(false)
              }}>Guardar Cita</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer border-l-4 border-l-primary/20 hover:border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className="p-2 rounded-full bg-primary/5">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <span className={`font-medium ${stat.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} mr-1`}>
                  {stat.change}
                </span>
                desde el mes pasado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              Citas de Hoy
            </CardTitle>
            <CardDescription>23 citas programadas para hoy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 border-2 border-background group-hover:border-primary/20 transition-colors">
                    <AvatarImage src={`/placeholder.svg?${appointment.id}`} alt={appointment.patient} />
                    <AvatarFallback className="bg-primary/5 text-primary">
                      {appointment.patient
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{appointment.patient}</p>
                    <p className="text-xs text-muted-foreground">{appointment.type}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={appointment.status === "confirmed" ? "default" : "secondary"} className="text-[10px] px-2 py-0.5 h-5">
                    {appointment.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </Badge>
                  <span className="text-sm font-medium font-mono text-muted-foreground">{appointment.time}</span>
                </div>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-primary">
              Ver todas las citas
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              Próximas Citas
            </CardTitle>
            <CardDescription>Citas programadas para los próximos días</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 border-2 border-background group-hover:border-primary/20 transition-colors">
                    <AvatarImage src={`/placeholder.svg?${appointment.id}`} alt={appointment.patient} />
                    <AvatarFallback className="bg-primary/5 text-primary">
                      {appointment.patient
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{appointment.patient}</p>
                    <p className="text-xs text-muted-foreground">{appointment.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{appointment.date}</p>
                  <p className="text-xs text-muted-foreground font-mono">{appointment.time}</p>
                </div>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-primary">
              Ver calendario completo
            </Button>
          </CardContent>
        </Card>
      </div>


    </div>
  )
}
