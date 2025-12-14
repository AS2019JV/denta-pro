"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Download,
  Calendar,
  Users,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  LineChart as LineChartIcon,
  Trophy,
  AlertCircle
} from "lucide-react"
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { generateReportPDF } from "@/lib/reports-pdf"

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)
  
  // Data states
  const [appointments, setAppointments] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [billings, setBillings] = useState<any[]>([])
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  
  // Rankings
  const [attendanceRanking, setAttendanceRanking] = useState<any[]>([])
  const [revenueRanking, setRevenueRanking] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all necessary data
      const [
        { data: appointmentsData }, 
        { data: patientsData },
        { data: billingsData }
      ] = await Promise.all([
        supabase.from('appointments').select('*'),
        supabase.from('patients').select('*'),
        supabase.from('billings').select('*')
      ])

      const apps = appointmentsData || []
      const pats = patientsData || []
      const bills = billingsData || []

      setAppointments(apps)
      setPatients(pats)
      setBillings(bills)

      calculateStats(apps, pats, bills)
      calculateRankings(apps, pats, bills)

    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (apps: any[], pats: any[], bills: any[]) => {
    // Generate last 6 months buckets
    const today = new Date()
    const months = eachMonthOfInterval({
      start: subMonths(today, 5),
      end: today
    })

    const stats = months.map(month => {
      const monthApps = apps.filter(a => isSameMonth(new Date(a.start_time), month))
      const monthBills = bills.filter(b => isSameMonth(new Date(b.created_at), month))
      // Approximate new patients by created_at if available, else standard
      const monthPatients = pats.filter(p => isSameMonth(new Date(p.created_at), month))

      return {
        month: format(month, 'MMM', { locale: es }),
        date: month,
        patients: monthPatients.length, // This refers to NEW patients
        activePatients: new Set(monthApps.map(a => a.patient_id)).size,
        revenue: monthBills.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
        appointments: monthApps.length
      }
    })

    setMonthlyStats(stats)
  }

  const calculateRankings = (apps: any[], pats: any[], bills: any[]) => {
    // 1. Attendance Ranking
    // Score based on completed/confirmed vs no_show
    // +1 for completed, -1 for no_show? Or just % attendance? Let's do % attendance
    const patientAttendance = pats.map(p => {
      const pApps = apps.filter(a => a.patient_id === p.id)
      const total = pApps.length
      if (total === 0) return null

      const attended = pApps.filter(a => ['completed', 'confirmed'].includes(a.status)).length
      const noShows = pApps.filter(a => a.status === 'no_show').length
      
      // Simple score: Attended count (primary) then rate
      return {
        ...p,
        totalApps: total,
        attended,
        noShows,
        rate: (attended / total) * 100
      }
    }).filter(p => p !== null)
    .sort((a, b) => b!.attended - a!.attended) // Sort by number of visits first
    .slice(0, 5)

    setAttendanceRanking(patientAttendance as any[])

    // 2. Revenue Ranking
    const patientRevenue = pats.map(p => {
      const pBills = bills.filter(b => b.patient_id === p.id)
      const total = pBills.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      return {
        ...p,
        totalRevenue: total
      }
    }).filter(p => p.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)

    setRevenueRanking(patientRevenue)
  }

  // Derived current metrics
  const currentMonthData = monthlyStats[monthlyStats.length - 1] || { revenue: 0, appointments: 0, patients: 0 }
  const prevMonthData = monthlyStats[monthlyStats.length - 2] || { revenue: 0, appointments: 0, patients: 0 }

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Reportes y Métricas">
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => generateReportPDF({
            period: selectedPeriod === 'month' ? 'Últimos 6 meses' : 'Año Actual',
            generatedAt: format(new Date(), "dd 'de' MMMM, yyyy HH:mm", { locale: es }),
            summary: {
                revenue: currentMonthData.revenue,
                appointments: currentMonthData.appointments,
                patients: currentMonthData.patients, // New patients
                activePatients: currentMonthData.activePatients
            },
            monthlyStats,
            topPatients: attendanceRanking
          })}>
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="rankings">Ranking de Pacientes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales (Mes)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(currentMonthData.revenue)}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {currentMonthData.revenue >= prevMonthData.revenue ? (
                    <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                  )}
                  vs mes anterior
                </p>
              </CardContent>
            </Card>

            {/* Patients Active */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pacientes Activos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentMonthData.activePatients || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  En el último mes
                </p>
              </CardContent>
            </Card>

            {/* Appointments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Citas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentMonthData.appointments}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Agendadas este mes
                </p>
              </CardContent>
            </Card>

            {/* Avg Ticket */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(currentMonthData.appointments > 0 ? currentMonthData.revenue / currentMonthData.appointments : 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Por cita
                </p>
              </CardContent>
            </Card>
          </div>

            {/* Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Ingresos Mensuales (Últimos 6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs" 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        className="text-xs" 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `$${value}`} 
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Ingresos"]}
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-blue-500" />
                  Citas por Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs" 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        className="text-xs" 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="appointments" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#3b82f6" }}
                        activeDot={{ r: 6 }}
                        name="Citas"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="patients" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#10b981" }}
                        name="Nuevos Pacientes"
                      />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rankings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Ranking de Asistencia */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Ranking de Asistencia
                </CardTitle>
                <CardDescription>Pacientes con más citas asistidas</CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceRanking.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">No hay datos suficientes</div>
                ) : (
                  <div className="space-y-4">
                    {attendanceRanking.map((patient, i) => (
                      <div key={patient.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm 
                            ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-50 text-orange-700'}`}>
                            {i + 1}
                          </div>
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{patient.first_name[0]}{patient.last_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{patient.first_name} {patient.last_name}</p>
                            <p className="text-xs text-muted-foreground">{patient.attended} asistencias | {patient.noShows} faltas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-green-600">{Math.round(patient.rate)}%</span>
                          <p className="text-[10px] text-muted-foreground">Cumplimiento</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking de Ingresos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Ranking de Inversión
                </CardTitle>
                <CardDescription>Pacientes que más han invertido</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueRanking.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">No hay datos de facturación</div>
                ) : (
                  <div className="space-y-4">
                    {revenueRanking.map((patient, i) => (
                      <div key={patient.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm 
                            ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                            {i + 1}
                          </div>
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{patient.first_name[0]}{patient.last_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{patient.first_name} {patient.last_name}</p>
                            <p className="text-xs text-muted-foreground">{patient.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-primary">{formatCurrency(patient.totalRevenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
