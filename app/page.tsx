"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { Users, Calendar, DollarSign, Clock, Activity, Phone, Mail, Plus } from "lucide-react"

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

  return (
    <div className="space-y-6">
      <PageHeader title={`¡Hola, ${user?.name?.split(" ")[0]}!`}>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cita
        </Button>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.change.startsWith("+") ? "text-green-600" : "text-red-600"}>{stat.change}</span>{" "}
                desde el mes pasado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Citas de Hoy
            </CardTitle>
            <CardDescription>23 citas programadas para hoy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`/placeholder.svg?${appointment.id}`} alt={appointment.patient} />
                    <AvatarFallback>
                      {appointment.patient
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{appointment.patient}</p>
                    <p className="text-xs text-muted-foreground">{appointment.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={appointment.status === "confirmed" ? "default" : "secondary"}>
                    {appointment.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </Badge>
                  <span className="text-sm font-medium">{appointment.time}</span>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full bg-transparent">
              Ver todas las citas
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Próximas Citas
            </CardTitle>
            <CardDescription>Citas programadas para los próximos días</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`/placeholder.svg?${appointment.id}`} alt={appointment.patient} />
                    <AvatarFallback>
                      {appointment.patient
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{appointment.patient}</p>
                    <p className="text-xs text-muted-foreground">{appointment.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{appointment.date}</p>
                  <p className="text-xs text-muted-foreground">{appointment.time}</p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full bg-transparent">
              Ver calendario completo
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Acciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <Plus className="h-6 w-6 mb-2" />
              Nuevo Paciente
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <Calendar className="h-6 w-6 mb-2" />
              Agendar Cita
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <Phone className="h-6 w-6 mb-2" />
              Llamar Paciente
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent">
              <Mail className="h-6 w-6 mb-2" />
              Enviar Recordatorio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
