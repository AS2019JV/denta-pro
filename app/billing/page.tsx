"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Download, Search, DollarSign, TrendingUp, CreditCard } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Billing {
  id: string
  created_at: string
  patient_id: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  description: string
  due_date: string
  invoice_number: string
  patients?: {
    first_name: string
    last_name: string
  }
}

export default function BillingPage() {
  const [billings, setBillings] = useState<Billing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0
  })

  useEffect(() => {
    fetchBillings()
  }, [])

  const fetchBillings = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('billings')
        .select(`
          *,
          patients (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        setBillings(data)
        calculateStats(data)
      }
    } catch (error) {
      console.error('Error fetching billings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = (data: Billing[]) => {
    const total = data.reduce((acc, curr) => curr.status === 'paid' ? acc + curr.amount : acc, 0)
    const pending = data.reduce((acc, curr) => curr.status === 'pending' ? acc + curr.amount : acc, 0)
    const overdue = data.reduce((acc, curr) => curr.status === 'overdue' ? acc + curr.amount : acc, 0)
    
    setStats({
      totalRevenue: total,
      pendingAmount: pending,
      overdueAmount: overdue
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Facturación y Pagos">
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nueva Factura
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+20.1% del mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Pago</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.pendingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">15 facturas pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${stats.overdueAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Requiere atención inmediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Billings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Facturas Recientes</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar factura..." className="pl-8 w-[250px]" />
              </div>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura #</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Cargando facturas...</TableCell>
                </TableRow>
              ) : billings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">No hay facturas registradas</TableCell>
                </TableRow>
              ) : (
                billings.map((billing) => (
                  <TableRow key={billing.id}>
                    <TableCell className="font-medium">{billing.invoice_number}</TableCell>
                    <TableCell>{billing.patients?.first_name} {billing.patients?.last_name}</TableCell>
                    <TableCell>{format(new Date(billing.created_at), "d MMM, yyyy", { locale: es })}</TableCell>
                    <TableCell>{billing.due_date ? format(new Date(billing.due_date), "d MMM, yyyy", { locale: es }) : '-'}</TableCell>
                    <TableCell>${billing.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        billing.status === 'paid' ? 'default' : 
                        billing.status === 'overdue' ? 'destructive' : 'secondary'
                      }>
                        {billing.status === 'paid' ? 'Pagado' : 
                         billing.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Ver</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
