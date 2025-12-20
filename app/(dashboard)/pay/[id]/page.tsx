"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, Copy, Building2, CreditCard, Upload } from "lucide-react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function PaymentPage() {
    const params = useParams()
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    
    const [billing, setBilling] = useState<any>(null)
    const [methods, setMethods] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if(id) fetchData()
    }, [id])

    const fetchData = async () => {
        try {
            const { data: bill, error } = await supabase.from('billings').select('*, patients(first_name, last_name, email)').eq('id', id).single()
            if (error) throw error
            setBilling(bill)

            const { data: payMethods } = await supabase.from('payment_methods').select('*').eq('is_active', true)
            setMethods(payMethods || [])
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado al portapapeles")
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        
        try {
            setUploading(true)
            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${id}/${fileName}`

            // 1. Upload
            const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file)
            if (uploadError) throw uploadError

            // Get URL - assumption: bucket public or signed url needed. Using public for simplicity or authenticated download.
            // Actually, we'd need a public bucket 'receipts' or generate signed url. Assuming public for now.
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath)

            // 2. Create Payment Record
            await supabase.from('payments').insert({
                billing_id: id,
                amount: billing.amount, // Assuming full payment
                method: 'TRANSFER',
                proof_url: publicUrl,
                status: 'pending' 
            })

            // 3. Update Billing Status? Usually trigger does it, but let's notify user
            toast.success("Comprobante subido. Verificaremos su pago pronto.")
            
            // Reload
            fetchData()

        } catch (e) {
            toast.error("Error subiendo comprobante")
        } finally {
            setUploading(false)
        }
    }

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
    if (!billing) return <div className="h-screen flex items-center justify-center">Factura no encontrada</div>

    if (billing.status === 'paid') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center py-10">
                    <CardContent>
                        <div className="mb-4 flex justify-center text-green-500">
                            <CheckCircle2 className="w-16 h-16" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">¡Pago Completado!</h1>
                        <p className="text-muted-foreground">La factura #{billing.invoice_number} ha sido pagada.</p>
                        <p className="font-bold text-xl mt-4">${billing.amount.toFixed(2)}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const bankMethods = methods.filter(m => m.type === 'BANK_TRANSFER')
    const stripeMethod = methods.find(m => m.type === 'STRIPE')

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                 {/* Header Info */}
                 <div className="text-center space-y-2">
                     <h1 className="text-2xl font-bold">Portal de Pagos Denta-Pro</h1>
                     <p className="text-muted-foreground">Complete el pago para la factura #{billing.invoice_number}</p>
                 </div>

                 <div className="grid md:grid-cols-3 gap-6">
                     {/* Invoice Details */}
                     <Card className="md:col-span-1 h-fit">
                         <CardHeader>
                             <CardTitle>Resumen</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4">
                             <div>
                                 <Label className="text-muted-foreground">Paciente</Label>
                                 <p className="font-medium">{billing.patients?.first_name} {billing.patients?.last_name}</p>
                             </div>
                             <div>
                                 <Label className="text-muted-foreground">Concepto</Label>
                                 <p className="font-medium">{billing.description || 'Servicios Dentales'}</p>
                             </div>
                             <Separator />
                             <div className="flex justify-between items-center">
                                 <span className="font-bold">Total a Pagar</span>
                                 <span className="font-bold text-xl text-primary">${billing.amount.toFixed(2)}</span>
                             </div>
                         </CardContent>
                     </Card>

                     {/* Payment Options */}
                     <Card className="md:col-span-2">
                         <CardHeader>
                             <CardTitle>Método de Pago</CardTitle>
                             <CardDescription>Seleccione una opción segura para realizar el pago.</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <Tabs defaultValue="card" className="w-full">
                                 <TabsList className="grid w-full grid-cols-2">
                                     <TabsTrigger value="card">Tarjeta de Crédito</TabsTrigger>
                                     <TabsTrigger value="transfer">Transferencia</TabsTrigger>
                                 </TabsList>

                                 <TabsContent value="card" className="space-y-4 pt-4">
                                     {stripeMethod ? (
                                         <div className="text-center py-6 space-y-4">
                                             <CreditCard className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                                             <p>Pago seguro procesado por Stripe</p>
                                             {/* Stripe Elements Mock Placeholder */}
                                             <Button className="w-full text-lg" size="lg">
                                                 Pagar ${billing.amount.toFixed(2)} con Tarjeta
                                             </Button>
                                             <p className="text-xs text-muted-foreground">Sus datos están encriptados y seguros.</p>
                                         </div>
                                     ) : (
                                         <div className="text-center py-10 text-muted-foreground">
                                             Pagos con tarjeta no disponibles momentáneamente.
                                         </div>
                                     )}
                                 </TabsContent>

                                 <TabsContent value="transfer" className="space-y-6 pt-4">
                                    {bankMethods.length > 0 ? (
                                        <>
                                            <div className="space-y-4">
                                                {bankMethods.map(bank => (
                                                    <div key={bank.id} className="p-4 border rounded-lg bg-muted/20 space-y-2">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h4 className="font-bold flex items-center gap-2">
                                                                    <Building2 className="w-4 h-4" />
                                                                    {bank.title}
                                                                </h4>
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    {bank.config.account_type} • {bank.config.holder_name}
                                                                </p>
                                                            </div>
                                                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(bank.config.account_number)}>
                                                                <Copy className="w-4 h-4 mr-2" /> Copiar
                                                            </Button>
                                                        </div>
                                                        <p className="font-mono bg-background p-2 rounded border text-center text-lg tracking-wider">
                                                            {bank.config.account_number}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">C.I./RUC: {bank.config.holder_id}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-3 pt-4 border-t">
                                                <Label>Ya realicé la transferencia</Label>
                                                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                                                    <input 
                                                        type="file" 
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                                        accept="image/*,.pdf"
                                                        onChange={handleFileUpload}
                                                        disabled={uploading}
                                                    />
                                                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                                                        <Upload className="w-8 h-8 text-muted-foreground" />
                                                        <p className="font-medium">Subir Comprobante</p>
                                                        <p className="text-xs text-muted-foreground">Click o arrastrar archivo aquí</p>
                                                    </div>
                                                </div>
                                                {uploading && <p className="text-xs text-center animate-pulse">Subiendo...</p>}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground">
                                             No hay cuentas bancarias configuradas.
                                        </div>
                                    )}
                                 </TabsContent>
                             </Tabs>
                         </CardContent>
                     </Card>
                 </div>
            </div>
        </div>
    )
}
