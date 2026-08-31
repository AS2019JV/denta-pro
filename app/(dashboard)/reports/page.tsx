"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Download,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  BarChart3,
  LineChart as LineChartIcon,
  Trophy,
  Activity,
  Layers
} from "lucide-react"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { format, subMonths, startOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { generateReportPDF } from "@/lib/reports-pdf"

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("6months")
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  
  // Data states
  const [appointments, setAppointments] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  
  // Rankings
  const [attendanceRanking, setAttendanceRanking] = useState<any[]>([])
  const [topServicesRanking, setTopServicesRanking] = useState<any[]>([])

  useEffect(() => {
    fetchData()
    setIsMounted(true)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const sixMonthsAgo = subMonths(startOfMonth(new Date()), 5).toISOString()

      const [
        { data: appointmentsData }, 
        { data: patientsData },
        { data: servicesData }
      ] = await Promise.all([
        supabase.from('appointments')
          .select('*, patients(id, first_name, last_name, phone)')
          .gte('start_time', sixMonthsAgo),
        supabase.from('patients')
          .select('*')
          .gte('created_at', sixMonthsAgo),
        supabase.from('services')
          .select('*')
      ])

      const apps = appointmentsData || []
      const pats = patientsData || []
      const srvs = servicesData || []

      setAppointments(apps)
      setPatients(pats)
      setServices(srvs)

      calculateStats(apps, pats)
      calculateRankings(apps, pats, srvs)

    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (apps: any[], pats: any[]) => {
    const today = new Date()
    const months = eachMonthOfInterval({
      start: subMonths(today, 5),
      end: today
    })

    const stats = months.map(month => {
      const monthApps = apps.filter(a => isSameMonth(new Date(a.start_time), month))
      const monthPatients = pats.filter(p => isSameMonth(new Date(p.created_at), month))
      const confirmedOrCompleted = monthApps.filter(a => ['confirmed', 'completed'].includes(a.status)).length
      const cancelledOrNoShow = monthApps.filter(a => ['cancelled', 'no_show'].includes(a.status)).length

      return {
        month: format(month, 'MMM', { locale: es }),
        date: month,
        totalBookings: monthApps.length,
        newPatients: monthPatients.length,
        activePatients: new Set(monthApps.map(a => a.patient_id)).size,
        confirmed: monthApps.filter(a => a.status === 'confirmed').length,
        completed: monthApps.filter(a => a.status === 'completed').length,
        cancelled: monthApps.filter(a => a.status === 'cancelled').length,
        noShow: monthApps.filter(a => a.status === 'no_show').length,
        scheduled: monthApps.filter(a => a.status === 'scheduled').length,
        attendanceRate: monthApps.length > 0 ? Math.round((confirmedOrCompleted / monthApps.length) * 100) : 0,
        cancellationRate: monthApps.length > 0 ? Math.round((cancelledOrNoShow / monthApps.length) * 100) : 0,
      }
    })

    setMonthlyStats(stats)
  }

  const calculateRankings = (apps: any[], pats: any[], srvs: any[]) => {
    // 1. Patient Attendance Ranking
    const appsByPatient: Record<string, any[]> = {}
    apps.forEach(app => {
      if (!app.patient_id) return
      if (!appsByPatient[app.patient_id]) appsByPatient[app.patient_id] = []
      appsByPatient[app.patient_id].push(app)
    })

    const patientAttendance = Object.keys(appsByPatient).map(patId => {
      const pApps = appsByPatient[patId]
      const patientInfo = pApps[0]?.patients || pats.find(p => p.id === patId)
      if (!patientInfo) return null

      const total = pApps.length
      const attended = pApps.filter(a => ['completed', 'confirmed'].includes(a.status)).length
      const noShows = pApps.filter(a => a.status === 'no_show').length
      const cancelled = pApps.filter(a => a.status === 'cancelled').length

      return {
        id: patId,
        first_name: patientInfo.first_name || 'Paciente',
        last_name: patientInfo.last_name || '',
        phone: patientInfo.phone,
        totalApps: total,
        attended,
        noShows,
        cancelled,
        rate: total > 0 ? Math.round((attended / total) * 100) : 0
      }
    }).filter(Boolean)
      .sort((a: any, b: any) => b.attended - a.attended || b.rate - a.rate)
      .slice(0, 6)

    setAttendanceRanking(patientAttendance)

    // 2. Top Booked Services
    const serviceCounts: Record<string, number> = {}
    apps.forEach(a => {
      const type = a.type || 'Consulta General'
      serviceCounts[type] = (serviceCounts[type] || 0) + 1
    })

    const topServices = Object.entries(serviceCounts).map(([name, count]) => {
      const matchSrv = srvs.find(s => s.name?.toLowerCase() === name?.toLowerCase())
      return {
        name,
        count,
        price: matchSrv?.price || 0,
        estimatedDemand: count * (matchSrv?.price || 30)
      }
    }).sort((a, b) => b.count - a.count).slice(0, 6)

    setTopServicesRanking(topServices)
  }

  // Summary Metrics for current Month / Period
  const currentMonthData = monthlyStats[monthlyStats.length - 1] || {
    totalBookings: 0,
    newPatients: 0,
    activePatients: 0,
    attendanceRate: 0,
    cancellationRate: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    scheduled: 0
  }

  const prevMonthData = monthlyStats[monthlyStats.length - 2] || { totalBookings: 0, attendanceRate: 0 }

  const statusDistributionData = useMemo(() => [
    { name: 'Confirmadas', value: appointments.filter(a => a.status === 'confirmed').length, color: '#10b981' },
    { name: 'Completadas', value: appointments.filter(a => a.status === 'completed').length, color: '#3b82f6' },
    { name: 'Programadas', value: appointments.filter(a => a.status === 'scheduled').length, color: '#f59e0b' },
    { name: 'Canceladas', value: appointments.filter(a => a.status === 'cancelled').length, color: '#ef4444' },
    { name: 'No Asistió', value: appointments.filter(a => a.status === 'no_show').length, color: '#64748b' },
  ].filter(d => d.value > 0), [appointments])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Métricas de Pacientes y Agenda (Bookings)">
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40 h-9 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="year">Año Actual</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm"
            className="h-9 gap-1.5 font-bold shadow-sm"
            onClick={() => generateReportPDF({
              period: selectedPeriod === '6months' ? 'Últimos 6 meses' : 'Año Actual',
              generatedAt: format(new Date(), "dd 'de' MMMM, yyyy HH:mm", { locale: es }),
              summary: {
                revenue: 0,
                appointments: currentMonthData.totalBookings,
                patients: currentMonthData.newPatients,
                activePatients: currentMonthData.activePatients
              },
              monthlyStats: monthlyStats.map(m => ({
                month: m.month,
                revenue: 0,
                appointments: m.totalBookings,
                patients: m.newPatients
              })),
              topPatients: attendanceRanking
            })}
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Exportar Informe PDF</span>
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border">
          <TabsTrigger value="overview" className="gap-2 font-bold text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            Resumen de Citas y Pacientes
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2 font-bold text-xs sm:text-sm">
            <Layers className="h-4 w-4" />
            Demanda por Tratamiento
          </TabsTrigger>
          <TabsTrigger value="rankings" className="gap-2 font-bold text-xs sm:text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Fidelidad y Asistencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Citas (Mes)
                </CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">{currentMonthData.totalBookings}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                  {currentMonthData.totalBookings >= prevMonthData.totalBookings ? (
                    <span className="text-emerald-600 font-bold flex items-center">↑ Creciendo</span>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center">↓ Menor</span>
                  )}
                  vs mes anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tasa de Asistencia
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-emerald-600">
                  {currentMonthData.attendanceRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Citas confirmadas y asistidas
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pacientes Atendidos
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-blue-600">
                  {currentMonthData.activePatients}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Pacientes únicos en agenda
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cancelaciones / Faltas
                </CardTitle>
                <XCircle className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-rose-600">
                  {currentMonthData.cancellationRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Ausencias y cancelaciones
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Evolución de Citas y Nuevos Pacientes
                </CardTitle>
                <CardDescription>Citas programadas vs nuevos registros en los últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '10px', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Bar dataKey="totalBookings" name="Total Citas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="newPatients" name="Nuevos Pacientes" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center bg-muted/20 animate-pulse">Cargando gráfico...</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Distribución de Estados
                </CardTitle>
                <CardDescription>Estado global de citas agendadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full flex items-center justify-center">
                  {isMounted && statusDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center">Sin citas registradas</div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t text-xs">
                  {statusDistributionData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between font-medium">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Ranking de Servicios y Tratamientos Más Agendados
              </CardTitle>
              <CardDescription>Frecuencia de demanda en citas médicas odontológicas</CardDescription>
            </CardHeader>
            <CardContent>
              {topServicesRanking.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">No hay datos de tratamientos agendados aún.</div>
              ) : (
                <div className="space-y-4">
                  {topServicesRanking.map((srv, idx) => (
                    <div key={srv.name} className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-black text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{srv.name}</h4>
                          <p className="text-xs text-muted-foreground">{srv.count} citas programadas con este servicio</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-primary/30 text-primary font-bold">
                          {srv.count} reservas
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rankings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Fidelidad y Asistencia de Pacientes
              </CardTitle>
              <CardDescription>Pacientes con mayor puntualidad y cumplimiento de citas en la clínica</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceRanking.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">No hay datos suficientes de pacientes.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {attendanceRanking.map((patient: any, i: number) => (
                    <div key={patient.id} className="p-3.5 rounded-xl border bg-card hover:border-primary/40 transition-all flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shadow-sm
                          ${i === 0 ? 'bg-amber-100 text-amber-700 border border-amber-300' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                          {i + 1}
                        </div>
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                            {patient.first_name?.[0]}{patient.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm text-foreground">{patient.first_name} {patient.last_name}</p>
                          <p className="text-xs text-muted-foreground">{patient.attended} asistidas | {patient.noShows} faltas | {patient.cancelled} canceladas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-emerald-600">{patient.rate}%</span>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Asistencia</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
