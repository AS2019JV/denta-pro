"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Download, CreditCard, ExternalLink, FileText } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { NotificationsService } from "@/lib/notifications"

interface Billing {
    id: string
    created_at: string
    amount: number
    status: 'pending' | 'paid' | 'cancelled' | 'overdue'
    description: string
    invoice_number: string
    invoices?: { pdf_url: string }[]
}

export function PatientPayments({ patientId }: { patientId: string }) {
    const [billings, setBillings] = useState<Billing[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchBillings = async () => {
        try {
            const { data, error } = await supabase
                .from('billings')
                .select(`
                    *,
                    invoices (pdf_url)
                `)
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setBillings(data || [])
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
        // Fetch patient email if not passed prop, or assume handled by service or passed prop
        // For simplicity, we just trigger the generic logic
        const { data: patient } = await supabase.from('patients').select('email, phone').eq('id', patientId).single()
        
        await NotificationsService.sendPaymentReminder({
            billingId: billing.id,
            patientEmail: patient?.email,
            patientPhone: patient?.phone,
            amount: billing.amount
        })
        toast.success("Recordatorio enviado")
    }

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin"/></div>

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Facturación y Pagos</CardTitle>
                <CardDescription>Gestione las facturas y estados de pago del paciente.</CardDescription>
            </CardHeader>
            <CardContent>
                {billings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No hay registros de facturación.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Factura #</TableHead>
                                <TableHead>Concepto</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {billings.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{format(new Date(item.created_at), "dd MMM yyyy", { locale: es })}</TableCell>
                                    <TableCell className="font-mono text-xs">{item.invoice_number || '---'}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="font-bold">${item.amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'paid' ? 'default' : item.status === 'pending' ? 'outline' : 'destructive'}>
                                            {item.status === 'paid' ? 'Pagado' : item.status === 'pending' ? 'Pendiente' : item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        {item.status === 'pending' && (
                                            <>
                                                <Button size="sm" variant="ghost" onClick={() => handleSendReminder(item)} title="Enviar Recordatorio">
                                                    <ExternalLink className="w-4 h-4 text-blue-500" />
                                                </Button>
                                                <Button size="sm" onClick={() => window.open(`/pay/${item.id}`, '_blank')}>
                                                    <CreditCard className="w-4 h-4 mr-1" /> Pagar
                                                </Button>
                                            </>
                                        )}
                                        {item.invoices?.[0]?.pdf_url && (
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={item.invoices[0].pdf_url} target="_blank" rel="noopener noreferrer">
                                                    <FileText className="w-4 h-4 mr-1" /> PDF
                                                </a>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
