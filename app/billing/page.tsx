"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Download,
  Filter,
  Plus,
  CreditCard,
  DollarSign,
  FileText,
  Eye,
  Printer,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

const invoices = [
  {
    id: "INV-001",
    patient: "María García",
    date: "2025-03-15",
    amount: 150.0,
    status: "paid",
    treatment: "Limpieza dental",
    paymentMethod: "Tarjeta",
  },
  {
    id: "INV-002",
    patient: "Juan Pérez",
    date: "2025-03-14",
    amount: 450.0,
    status: "pending",
    treatment: "Endodoncia",
    paymentMethod: "Efectivo",
  },
  {
    id: "INV-003",
    patient: "Ana López",
    date: "2025-03-13",
    amount: 75.0,
    status: "paid",
    treatment: "Revisión",
    paymentMethod: "Transferencia",
  },
  {
    id: "INV-004",
    patient: "Carlos Ruiz",
    date: "2025-03-12",
    amount: 1200.0,
    status: "overdue",
    treatment: "Implante dental",
    paymentMethod: "Pendiente",
  },
  {
    id: "INV-005",
    patient: "Laura Martín",
    date: "2025-03-11",
    amount: 200.0,
    status: "paid",
    treatment: "Empaste",
    paymentMethod: "Tarjeta",
  },
]

const payments = [
  {
    id: "PAY-001",
    invoice: "INV-001",
    patient: "María García",
    amount: 150.0,
    date: "2025-03-15",
    method: "Tarjeta de crédito",
    status: "completed",
  },
  {
    id: "PAY-002",
    invoice: "INV-003",
    patient: "Ana López",
    amount: 75.0,
    date: "2025-03-13",
    method: "Transferencia bancaria",
    status: "completed",
  },
  {
    id: "PAY-003",
    invoice: "INV-005",
    patient: "Laura Martín",
    amount: 200.0,
    date: "2025-03-11",
    method: "Tarjeta de débito",
    status: "completed",
  },
]

export default function BillingPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Pagado</Badge>
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pendiente</Badge>
        )
      case "overdue":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Vencido</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const paidAmount = invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0)
  const pendingAmount = invoices.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + inv.amount, 0)
  const overdueAmount = invoices.filter((inv) => inv.status === "overdue").reduce((sum, inv) => sum + inv.amount, 0)

  return (
    <div>
      <PageHeader title="Facturación">
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Factura
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nueva Factura</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="patient">Paciente</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maria">María García</SelectItem>
                      <SelectItem value="juan">Juan Pérez</SelectItem>
                      <SelectItem value="ana">Ana López</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="treatment">Tratamiento</Label>
                    <Input id="treatment" placeholder="Descripción del tratamiento" />
                  </div>
                  <div>
                    <Label htmlFor="amount">Importe</Label>
                    <Input id="amount" type="number" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" placeholder="Notas adicionales..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Cancelar</Button>
                  <Button>Crear Factura</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div>
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +8.2% del mes pasado
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagado</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">€{paidAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {invoices.filter((inv) => inv.status === "paid").length} facturas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">€{pendingAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {invoices.filter((inv) => inv.status === "pending").length} facturas pendientes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencido</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">€{overdueAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                {invoices.filter((inv) => inv.status === "overdue").length} facturas vencidas
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="invoices">
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <TabsList>
              <TabsTrigger value="invoices">Facturas</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="reports">Informes</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar facturas..."
                  className="pl-8 h-9 md:w-[200px] lg:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left p-4 font-medium">Factura</th>
                        <th className="text-left p-4 font-medium">Paciente</th>
                        <th className="text-left p-4 font-medium">Fecha</th>
                        <th className="text-left p-4 font-medium">Tratamiento</th>
                        <th className="text-left p-4 font-medium">Importe</th>
                        <th className="text-left p-4 font-medium">Estado</th>
                        <th className="text-right p-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-muted/30">
                          <td className="p-4 font-medium">{invoice.id}</td>
                          <td className="p-4">{invoice.patient}</td>
                          <td className="p-4 text-muted-foreground">
                            {new Date(invoice.date).toLocaleDateString("es-ES")}
                          </td>
                          <td className="p-4">{invoice.treatment}</td>
                          <td className="p-4 font-medium">€{invoice.amount.toFixed(2)}</td>
                          <td className="p-4">{getStatusBadge(invoice.status)}</td>
                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left p-4 font-medium">ID Pago</th>
                        <th className="text-left p-4 font-medium">Factura</th>
                        <th className="text-left p-4 font-medium">Paciente</th>
                        <th className="text-left p-4 font-medium">Fecha</th>
                        <th className="text-left p-4 font-medium">Método</th>
                        <th className="text-left p-4 font-medium">Importe</th>
                        <th className="text-left p-4 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-muted/30">
                          <td className="p-4 font-medium">{payment.id}</td>
                          <td className="p-4">{payment.invoice}</td>
                          <td className="p-4">{payment.patient}</td>
                          <td className="p-4 text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString("es-ES")}
                          </td>
                          <td className="p-4">{payment.method}</td>
                          <td className="p-4 font-medium">€{payment.amount.toFixed(2)}</td>
                          <td className="p-4">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Completado
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Ingresos por Mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Marzo 2025</span>
                      <span className="font-semibold">€{totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Febrero 2025</span>
                      <span className="font-semibold">€1,890.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Enero 2025</span>
                      <span className="font-semibold">€2,340.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Métodos de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Tarjeta de crédito</span>
                      <span className="font-semibold">45%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Efectivo</span>
                      <span className="font-semibold">30%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Transferencia</span>
                      <span className="font-semibold">25%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
