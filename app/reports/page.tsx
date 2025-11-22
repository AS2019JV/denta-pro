"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  PieChart,
  LineChart,
} from "lucide-react"

const monthlyData = [
  { month: "Ene", patients: 65, revenue: 3250, appointments: 78 },
  { month: "Feb", patients: 59, revenue: 2950, appointments: 71 },
  { month: "Mar", patients: 80, revenue: 4000, appointments: 96 },
  { month: "Abr", patients: 81, revenue: 4050, appointments: 97 },
  { month: "May", patients: 56, revenue: 2800, appointments: 67 },
  { month: "Jun", patients: 55, revenue: 2750, appointments: 66 },
  { month: "Jul", patients: 40, revenue: 2000, appointments: 48 },
  { month: "Ago", patients: 70, revenue: 3500, appointments: 84 },
  { month: "Sep", patients: 90, revenue: 4500, appointments: 108 },
  { month: "Oct", patients: 110, revenue: 5500, appointments: 132 },
  { month: "Nov", patients: 95, revenue: 4750, appointments: 114 },
  { month: "Dic", patients: 85, revenue: 4250, appointments: 102 },
]

const treatmentStats = [
  { name: "Limpiezas", count: 145, percentage: 35, revenue: 7250 },
  { name: "Empastes", count: 98, percentage: 25, revenue: 9800 },
  { name: "Endodoncias", count: 45, percentage: 15, revenue: 13500 },
  { name: "Extracciones", count: 32, percentage: 10, revenue: 1600 },
  { name: "Coronas", count: 28, percentage: 8, revenue: 8400 },
  { name: "Implantes", count: 15, percentage: 7, revenue: 15000 },
]

const patientDemographics = [
  { ageGroup: "18-25", count: 45, percentage: 15 },
  { ageGroup: "26-35", count: 78, percentage: 26 },
  { ageGroup: "36-45", count: 92, percentage: 31 },
  { ageGroup: "46-55", count: 56, percentage: 19 },
  { ageGroup: "56-65", count: 23, percentage: 8 },
  { ageGroup: "65+", count: 6, percentage: 2 },
]

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [selectedYear, setSelectedYear] = useState("2025")

  const currentMonth = monthlyData[monthlyData.length - 1]
  const previousMonth = monthlyData[monthlyData.length - 2]

  const patientGrowth = (((currentMonth.patients - previousMonth.patients) / previousMonth.patients) * 100).toFixed(1)
  const revenueGrowth = (((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100).toFixed(1)
  const appointmentGrowth = (
    ((currentMonth.appointments - previousMonth.appointments) / previousMonth.appointments) *
    100
  ).toFixed(1)

  const totalPatients = monthlyData.reduce((sum, month) => sum + month.patients, 0)
  const totalRevenue = monthlyData.reduce((sum, month) => sum + month.revenue, 0)
  const totalAppointments = monthlyData.reduce((sum, month) => sum + month.appointments, 0)
  const avgTreatmentValue = totalRevenue / totalAppointments

  return (
    <div>
      <PageHeader title="Reportes y Análisis">
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPatients}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {Number.parseFloat(patientGrowth) >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                )}
                {Math.abs(Number.parseFloat(patientGrowth))}% vs mes anterior
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {Number.parseFloat(revenueGrowth) >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                )}
                {Math.abs(Number.parseFloat(revenueGrowth))}% vs mes anterior
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Citas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAppointments}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {Number.parseFloat(appointmentGrowth) >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                )}
                {Math.abs(Number.parseFloat(appointmentGrowth))}% vs mes anterior
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgTreatmentValue.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <Activity className="h-3 w-3 mr-1" />
                Por tratamiento
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="patients">Pacientes</TabsTrigger>
            <TabsTrigger value="financial">Financiero</TabsTrigger>
            <TabsTrigger value="treatments">Tratamientos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Tendencia de Pacientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyData.slice(-6).map((month, index) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{month.month}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${(month.patients / 120) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-8">{month.patients}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ingresos Mensuales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyData.slice(-6).map((month, index) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{month.month}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${(month.revenue / 6000) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-16">${month.revenue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patients" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Demografía por Edad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {patientDemographics.map((demo) => (
                      <div key={demo.ageGroup} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{demo.ageGroup} años</span>
                          <span className="font-medium">
                            {demo.count} ({demo.percentage}%)
                          </span>
                        </div>
                        <Progress value={demo.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pacientes Nuevos vs Recurrentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">78%</div>
                      <p className="text-sm text-muted-foreground">Pacientes Recurrentes</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">22%</div>
                      <p className="text-sm text-muted-foreground">Pacientes Nuevos</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Tasa de Retención</span>
                        <span className="font-medium">92%</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Ingresos por Método de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Tarjeta de Crédito</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">45%</Badge>
                        <span className="font-semibold">${(totalRevenue * 0.45).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Efectivo</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">30%</Badge>
                        <span className="font-semibold">${(totalRevenue * 0.3).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Transferencia</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">25%</Badge>
                        <span className="font-semibold">${(totalRevenue * 0.25).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Rentabilidad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Ingresos Brutos</span>
                      <span className="font-semibold text-green-600">${totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Gastos Operativos</span>
                      <span className="font-semibold text-red-600">${(totalRevenue * 0.35).toFixed(0)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Beneficio Neto</span>
                        <span className="font-bold text-primary">${(totalRevenue * 0.65).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Margen de Beneficio</span>
                        <span className="font-medium">65%</span>
                      </div>
                      <Progress value={65} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="treatments" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Tratamientos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {treatmentStats.map((treatment) => (
                      <div key={treatment.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{treatment.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">{treatment.count} tratamientos</span>
                            <span className="font-semibold">${treatment.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={treatment.percentage} className="flex-1 h-2" />
                          <span className="text-sm font-medium w-12">{treatment.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Tratamientos Más Rentables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {treatmentStats
                        .sort((a, b) => b.revenue / b.count - a.revenue / a.count)
                        .slice(0, 5)
                        .map((treatment) => (
                          <div key={treatment.name} className="flex justify-between items-center">
                            <span>{treatment.name}</span>
                            <span className="font-semibold">
                              ${(treatment.revenue / treatment.count).toFixed(0)}/trat.
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tratamientos Más Frecuentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {treatmentStats
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                        .map((treatment) => (
                          <div key={treatment.name} className="flex justify-between items-center">
                            <span>{treatment.name}</span>
                            <Badge variant="secondary">{treatment.count} veces</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
