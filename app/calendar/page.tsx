"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ChevronLeft, ChevronRight, CalendarIcon, Clock, User, Phone } from "lucide-react"

const daysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const appointments = [
  {
    id: 1,
    patient: "María García",
    time: "09:00",
    duration: 60,
    type: "Limpieza",
    status: "confirmed",
    phone: "+34 666 123 456",
    date: new Date(2025, 2, 15),
  },
  {
    id: 2,
    patient: "Juan Pérez",
    time: "10:30",
    duration: 90,
    type: "Endodoncia",
    status: "pending",
    phone: "+34 666 789 012",
    date: new Date(2025, 2, 15),
  },
  {
    id: 3,
    patient: "Ana López",
    time: "14:00",
    duration: 45,
    type: "Revisión",
    status: "confirmed",
    phone: "+34 666 345 678",
    date: new Date(2025, 2, 16),
  },
  {
    id: 4,
    patient: "Carlos Ruiz",
    time: "16:00",
    duration: 120,
    type: "Implante",
    status: "confirmed",
    phone: "+34 666 901 234",
    date: new Date(2025, 2, 17),
  },
]

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day">("month")

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((apt) => apt.date.toDateString() === date.toDateString())
  }

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-border/20"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const dayAppointments = getAppointmentsForDate(date)
      const isToday = date.toDateString() === new Date().toDateString()
      const isSelected = date.toDateString() === selectedDate.toDateString()

      days.push(
        <div
          key={day}
          className={`h-24 border border-border/20 p-1 cursor-pointer hover:bg-muted/50 transition-colors ${
            isToday ? "bg-primary/10" : ""
          } ${isSelected ? "ring-2 ring-primary" : ""}`}
          onClick={() => setSelectedDate(date)}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>{day}</div>
          <div className="space-y-1">
            {dayAppointments.slice(0, 2).map((apt) => (
              <div
                key={apt.id}
                className={`text-xs p-1 rounded truncate ${
                  apt.status === "confirmed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                }`}
              >
                {apt.time} {apt.patient}
              </div>
            ))}
            {dayAppointments.length > 2 && (
              <div className="text-xs text-muted-foreground">+{dayAppointments.length - 2} más</div>
            )}
          </div>
        </div>,
      )
    }

    return days
  }

  const todayAppointments = getAppointmentsForDate(selectedDate)

  return (
    <div className="space-y-6">
      <PageHeader title="Calendario">
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(value: "month" | "week" | "day") => setView(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="day">Día</SelectItem>
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Programar Nueva Cita</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patient">Paciente</Label>
                    <Input id="patient" placeholder="Nombre del paciente" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" placeholder="+34 666 123 456" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Fecha</Label>
                    <Input id="date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="time">Hora</Label>
                    <Input id="time" type="time" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="treatment">Tratamiento</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tratamiento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleaning">Limpieza</SelectItem>
                      <SelectItem value="checkup">Revisión</SelectItem>
                      <SelectItem value="filling">Empaste</SelectItem>
                      <SelectItem value="extraction">Extracción</SelectItem>
                      <SelectItem value="root-canal">Endodoncia</SelectItem>
                      <SelectItem value="implant">Implante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" placeholder="Notas adicionales..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Cancelar</Button>
                  <Button>Programar Cita</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-0 mb-4">
            {daysOfWeek.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0">{renderCalendarGrid()}</div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Citas del{" "}
              {selectedDate.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No hay citas programadas</p>
            ) : (
              todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`/placeholder.svg?height=40&width=40&text=${apt.patient[0]}`} />
                    <AvatarFallback>{apt.patient[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{apt.patient}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {apt.time} ({apt.duration}min)
                    </div>
                    <Badge variant={apt.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                      {apt.type}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <User className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen del Mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Citas</span>
              <span className="font-semibold">127</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Confirmadas</span>
              <span className="font-semibold text-green-600">98</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pendientes</span>
              <span className="font-semibold text-yellow-600">23</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Canceladas</span>
              <span className="font-semibold text-red-600">6</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
