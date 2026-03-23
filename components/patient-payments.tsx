"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Download, CreditCard, ExternalLink, FileText, Calendar, ChevronDown, CalendarIcon, AlertCircle } from "lucide-react"
import { format, isPast, isToday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { NotificationsService } from "@/lib/notifications"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Billing {
    id: string
    created_at: string
    amount: number
    status: 'pending' | 'paid' | 'cancelled' | 'overdue'
    description: string
    invoice_number: string
    due_date?: string
    invoices?: { pdf_url: string }[]
    appointments?: { 
        id: string
        type: string
        start_time: string 
    }
}

export function PatientPayments({ patientId }: { patientId: string }) {
    const [billings, setBillings] = useState<Billing[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // Modal State
    const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null)
    const [isDashboardOpen, setIsDashboardOpen] = useState(false)
    const [newDueDate, setNewDueDate] = useState<string>("")

    const fetchBillings = async () => {
        try {
            const { data, error } = await supabase
                .from('billings')
                .select(`
                    *,
                    invoices (pdf_url),
                    appointments (id, type, start_time)
                `)
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setBillings((data as any) || [])
        } catch (e) {
            console.error(e)
            toast.error("Error cargando pagos")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchBillings()
    }, [patientId])

    const handleSendReminder = async (billing: Billing) => {
        const { data: patient } = await supabase.from('patients').select('email, phone').eq('id', patientId).single()
        
        await NotificationsService.sendPaymentReminder({
            billingId: billing.id,
            patientEmail: patient?.email,
            patientPhone: patient?.phone,
            amount: billing.amount
        })
        toast.success("Recordatorio enviado")
    }

    const handleAmountClick = (billing: Billing, e: React.MouseEvent) => {
        e.stopPropagation() // Prevent accordion expansion
        setSelectedBilling(billing)
        setNewDueDate(billing.due_date ? format(parseISO(billing.due_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
        setIsDashboardOpen(true)
    }

    const handleUpdateDueDate = async () => {
        if (!selectedBilling) return
        try {
            const { error } = await supabase
                .from('billings')
                .update({ due_date: newDueDate })
                .eq('id', selectedBilling.id)

            if (error) throw error
            
            toast.success("Fecha de vencimiento actualizada")
            setIsDashboardOpen(false)
            fetchBillings()
        } catch (e) {
            console.error(e)
            toast.error("Error actualizando fecha límite")
        }
    }

    const getDynamicStatus = (billing: Billing) => {
        if (billing.status === 'paid') return 'paid'
        if (billing.due_date && isPast(parseISO(billing.due_date)) && !isToday(parseISO(billing.due_date))) {
            // Frontend calculation overriding DB status visually if technically overdue
            return 'overdue'
        }
        return billing.status === 'overdue' ? 'overdue' : 'pending'
    }

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary"/></div>

    return (
        <Card className="border shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-xl flex items-center gap-2">
                   <CreditCard className="w-5 h-5 text-primary" /> Historial de Pagos y Servicios
                </CardTitle>
                <CardDescription>Visualiza los servicios personalizados, tratamientos incluidos y gestiona los plazos de pago.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {billings.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center">
                        <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground font-medium">No hay registros de facturación.</p>
                        <p className="text-sm text-muted-foreground/70">Los servicios se registrarán automáticamente tras confirmar citas.</p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="w-full">
                        {billings.map((billing) => {
                            const dynamicStatus = getDynamicStatus(billing)
                            const isPaid = dynamicStatus === 'paid'
                            const isOverdue = dynamicStatus === 'overdue'
                            const isPending = dynamicStatus === 'pending'
                            
                            return (
                                <AccordionItem value={billing.id} key={billing.id} className="border-b px-6 py-2 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex flex-1 items-center justify-between pr-6">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="font-semibold text-base text-foreground flex items-center gap-2">
                                                    {billing.description}
                                                    {billing.invoice_number && (
                                                       <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                                                          #{billing.invoice_number}
                                                       </Badge>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {format(new Date(billing.created_at), "d MMMM, yyyy", { locale: es })}
                                                </span>
                                            </div>
                                            
                                            <div 
                                              className={cn(
                                                "flex flex-col items-end gap-1 px-4 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95 border",
                                                isPaid && "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                                                isPending && "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
                                                isOverdue && "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 shadow-[0_0_15px_-3px_rgba(225,29,72,0.3)]"
                                              )}
                                              onClick={(e) => handleAmountClick(billing, e)}
                                              title="Haga clic para gestionar plazos e invoice"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isOverdue && <AlertCircle className="w-4 h-4 animate-pulse" />}
                                                    <span className="text-lg font-black tracking-tight">${billing.amount.toFixed(2)}</span>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                                    {isPaid ? 'Pagado' : isOverdue ? 'Vencido' : 'Pendiente'}
                                                </span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    
                                    <AccordionContent className="pb-6">
                                        <div className="bg-white rounded-lg border border-slate-100 p-5 shadow-sm space-y-4">
                                            <h4 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Tratamientos Incluidos</h4>
                                            
                                            {billing.appointments ? (
                                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                       <div className="w-2 h-2 rounded-full bg-primary" />
                                                       <span className="font-medium text-slate-700">{billing.appointments.type}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-medium font-mono bg-white px-2 py-1 rounded shadow-sm border">
                                                       {format(new Date(billing.appointments.start_time), "dd/MM/yyyy HH:mm")}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500 italic px-2">Este servicio es general y no está atado a una cita específica.</p>
                                            )}
                                            
                                            <div className="flex gap-2 justify-end pt-3 border-t mt-4">
                                                {dynamicStatus !== 'paid' && (
                                                    <>
                                                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleSendReminder(billing)}>
                                                            <ExternalLink className="w-4 h-4 mr-1.5" /> Enviar Recordatorio
                                                        </Button>
                                                        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => window.open(`/pay/${billing.id}`, '_blank')}>
                                                            <CreditCard className="w-4 h-4 mr-1.5" /> Portal de Pago
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                )}
            </CardContent>

            {/* Dashboard Modal for Managing Due Dates and Invoices */}
            <Dialog open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Gestión de Cobro</DialogTitle>
                        <DialogDescription>
                            Configure el día final de pago o visualice la factura adjunta.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedBilling && (
                        <div className="py-4 space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border">
                                <div>
                                    <p className="text-sm text-slate-500 font-medium">Total a Pagar</p>
                                    <p className="text-3xl font-black text-slate-800">${selectedBilling.amount.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Estado</p>
                                    <Badge variant={getDynamicStatus(selectedBilling) === 'paid' ? 'default' : getDynamicStatus(selectedBilling) === 'overdue' ? 'destructive' : 'secondary'}>
                                        {getDynamicStatus(selectedBilling) === 'paid' ? 'PAGADO' : getDynamicStatus(selectedBilling) === 'overdue' ? 'VENCIDO' : 'PENDIENTE'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="due_date" className="text-sm font-semibold flex items-center gap-2">
                                   <CalendarIcon className="w-4 h-4 text-primary" /> Día Final de Pago (Pending Day)
                                </Label>
                                <Input 
                                    id="due_date"
                                    type="date" 
                                    value={newDueDate} 
                                    onChange={(e) => setNewDueDate(e.target.value)}
                                    className="h-12 rounded-lg border-slate-300"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Si esta fecha pasa y el pago no se ha realizado, el estado cambiará automáticamente a <strong className="text-rose-600">Vencido</strong>.
                                </p>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                   <FileText className="w-4 h-4 text-primary" /> Factura Adjunta
                                </Label>
                                {selectedBilling.invoices?.[0]?.pdf_url ? (
                                    <div className="border border-slate-200 rounded-lg p-3 flex justify-between items-center bg-white shadow-sm">
                                        <div className="flex items-center gap-3">
                                           <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                                              <FileText className="w-5 h-5" />
                                           </div>
                                           <div>
                                              <p className="font-semibold text-sm">Factura_SRI.pdf</p>
                                              <p className="text-xs text-slate-500">Documento Oficial</p>
                                           </div>
                                        </div>
                                        <Button size="sm" variant="secondary" asChild>
                                            <a href={selectedBilling.invoices[0].pdf_url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir
                                            </a>
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                                        <FileText className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm italic">Sin factura generada aún</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsDashboardOpen(false)}>Cancelar</Button>
                        <Button className="bg-primary hover:bg-primary/90 shadow-md" onClick={handleUpdateDueDate}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
