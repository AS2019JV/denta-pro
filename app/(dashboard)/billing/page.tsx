"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Download, Search, DollarSign, TrendingUp, CreditCard, Stethoscope, Clock, Trash2, FileText, Settings } from "lucide-react"
import { GenerateInvoiceDialog } from "@/components/billing/generate-invoice-dialog"
import { CreateBillingDialog } from "@/components/billing/create-billing-dialog"
import { PaymentMethodsSettings } from "@/components/billing/payment-methods-settings"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useAppData } from "@/hooks/use-app-data"

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
    id: string
    first_name: string
    last_name: string
    cedula?: string
    email?: string
    address?: string
  }
  invoices?: {
    id: string
    invoice_number: string
    status: string
    pdf_url: string
  }[]
}

export default function BillingPage() {
  const [billings, setBillings] = useState<Billing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0
  })

  // Supabase treatments state
  const [treatments, setTreatments] = useState<any[]>([])
  const [isAddTreatmentOpen, setIsAddTreatmentOpen] = useState(false)
  const [newTreatment, setNewTreatment] = useState({
    name: "",
    price: "",
    duration: "30",
    description: ""
  })

  // SRI Invoice State
  const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null)
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isCreateBillingOpen, setIsCreateBillingOpen] = useState(false)

  useEffect(() => {
    fetchBillings()
    fetchTreatments()
  }, [])

  const fetchBillings = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('billings')
        .select(`
          *,
          patients (
            id,
            first_name,
            last_name,
            cedula,
            email,
            address
          ),
          invoices (
            id,
            invoice_number,
            status,
            pdf_url
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
      // Fallback data if needed or just handle error
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

  const fetchTreatments = async () => {
    try {
      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) setTreatments(data)
    } catch (error) {
      console.error('Error fetching treatments:', error)
    }
  }

  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('treatments')
        .insert({
          name: newTreatment.name,
          price: parseFloat(newTreatment.price) || 0,
          duration: parseInt(newTreatment.duration) || 30,
          description: newTreatment.description
        })

      if (error) throw error

      await fetchTreatments()
      setIsAddTreatmentOpen(false)
      setNewTreatment({ name: "", price: "", duration: "30", description: "" })
    } catch (error) {
      console.error('Error adding treatment:', error)
    }
  }

  const deleteTreatment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('treatments')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await fetchTreatments()
    } catch (error) {
      console.error('Error deleting treatment:', error)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Facturación y Servicios" />

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="treatments" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Tratamientos y Precios
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        {/* FACTURAS TAB */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-medium">Gestión de Cobros</h2>
             <Button onClick={() => setIsCreateBillingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nueva Factura
            </Button>
          </div>
          
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
                        <TableCell className="text-right flex items-center justify-end gap-2">
                          {billing.invoices && billing.invoices.length > 0 ? (
                             <Button variant="outline" size="sm" asChild className="h-8">
                                <a href={billing.invoices[0].pdf_url} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-3 w-3" /> SRI
                                </a>
                             </Button>
                          ) : (
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                    setSelectedBilling(billing)
                                    setIsInvoiceDialogOpen(true)
                                }}
                             >
                                <FileText className="mr-2 h-3 w-3" /> Emitir
                             </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRATAMIENTOS TAB */}
        <TabsContent value="treatments" className="space-y-4">
          <div className="flex justify-between items-center">
             <div>
               <h2 className="text-lg font-medium">Catálogo de Tratamientos</h2>
               <p className="text-sm text-muted-foreground">Gestiona los precios y duración de tus servicios.</p>
             </div>
             
             <Dialog open={isAddTreatmentOpen} onOpenChange={setIsAddTreatmentOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Tratamiento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddTreatment}>
                  <DialogHeader>
                    <DialogTitle>Añadir Nuevo Tratamiento</DialogTitle>
                    <DialogDescription>Define el nombre, precio y duración estándar del servicio.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="t-name" className="text-right">Nombre</Label>
                      <Input id="t-name" value={newTreatment.name} onChange={e => setNewTreatment({...newTreatment, name: e.target.value})} className="col-span-3" placeholder="Ej. Limpieza Profunda" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="t-price" className="text-right">Precio ($)</Label>
                      <Input id="t-price" type="number" min="0" step="0.01" value={newTreatment.price} onChange={e => setNewTreatment({...newTreatment, price: e.target.value})} className="col-span-3" placeholder="0.00" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="t-duration" className="text-right">Duración (min)</Label>
                      <Input id="t-duration" type="number" min="15" step="15" value={newTreatment.duration} onChange={e => setNewTreatment({...newTreatment, duration: e.target.value})} className="col-span-3" placeholder="30" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="t-desc" className="text-right">Descripción</Label>
                      <Input id="t-desc" value={newTreatment.description} onChange={e => setNewTreatment({...newTreatment, description: e.target.value})} className="col-span-3" placeholder="Opcional" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Servicio</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
             </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead>Precio Estándar</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay tratamientos configurados. Añade uno para empezar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    treatments.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>${t.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            <Clock className="w-3 h-3 mr-1" />
                            {t.duration} min
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{t.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTreatment(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
             <PaymentMethodsSettings />
        </TabsContent>
        
      </Tabs>


      {selectedBilling && selectedBilling.patients && (
        <GenerateInvoiceDialog 
            open={isInvoiceDialogOpen} 
            onOpenChange={setIsInvoiceDialogOpen}
            billing={selectedBilling}
            patient={selectedBilling.patients}
            onSuccess={() => {
                fetchBillings() // Refresh to show new invoice
                setStats(prev => ({ ...prev })) // Re-calc stats if needed
            }}
        />
      )}

      <CreateBillingDialog 
        open={isCreateBillingOpen}
        onOpenChange={setIsCreateBillingOpen}
        onSuccess={fetchBillings}
      />
    </div>
  )
}
