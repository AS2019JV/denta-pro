"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { PaymentMethod } from "@/types"
import { Loader2, Plus, Trash2, Building2, CreditCard, Smartphone } from "lucide-react"

export function PaymentMethodsSettings() {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newBank, setNewBank] = useState({ bank_name: '', account_type: 'Ahorros', account_number: '', holder_name: '', holder_id: '' })
    const [stripeKey, setStripeKey] = useState('')
    const [payphoneData, setPayphoneData] = useState({ client_id: '', client_secret: '' })

    useEffect(() => {
        fetchMethods()
    }, [])

    const fetchMethods = async () => {
        try {
            setIsLoading(true)
            const { data, error } = await supabase.from('payment_methods').select('*').order('created_at', { ascending: false })
            if (error) throw error
            if (data) setMethods(data)
        } catch (e) {
            console.error(e)
            toast.error("Error cargando métodos de pago")
        } finally {
            setIsLoading(false)
        }
    }

    const addBankTransfer = async () => {
        if (!newBank.bank_name || !newBank.account_number) {
            toast.error("Complete los datos del banco")
            return
        }
        try {
            const { error } = await supabase.from('payment_methods').insert({
                type: 'BANK_TRANSFER',
                title: `${newBank.bank_name} - ${newBank.account_number}`,
                config: newBank,
                is_active: true
            })
            if (error) throw error
            toast.success("Método agregado")
            fetchMethods()
            setNewBank({ bank_name: '', account_type: 'Ahorros', account_number: '', holder_name: '', holder_id: '' })
        } catch (e) {
            toast.error("Error agregando banco")
        }
    }

    const updateStripe = async () => {
        if (!stripeKey) return
        try {
            // Check if exists, update or insert
            const existing = methods.find(m => m.type === 'STRIPE')
            if (existing) {
                await supabase.from('payment_methods').update({ config: { publishable_key: stripeKey } }).eq('id', existing.id)
            } else {
                await supabase.from('payment_methods').insert({
                    type: 'STRIPE',
                    title: 'Stripe Payments',
                    config: { publishable_key: stripeKey },
                    is_active: true
                })
            }
            toast.success("Configuración de Stripe guardada")
            fetchMethods()
        } catch (e) {
             toast.error("Error guardando Stripe")
        }
    }

    // Similar logic for PayPhone/Kushki...

    const deleteMethod = async (id: string) => {
        const { error } = await supabase.from('payment_methods').delete().eq('id', id)
        if (!error) {
            toast.success("Eliminado")
            setMethods(prev => prev.filter(m => m.id !== id))
        }
    }

    const toggleActive = async (id: string, current: boolean) => {
        await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id)
        setMethods(prev => prev.map(m => m.id === id ? { ...m, is_active: !current } : m))
    }

    // if (isLoading) return <Loader2 className="animate-spin" /> // Removed global loader

    const banks = methods.filter(m => m.type === 'BANK_TRANSFER')
    const stripe = methods.find(m => m.type === 'STRIPE')

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                 <h2 className="text-lg font-medium">Configuración de Pasarela de Pagos</h2>
                 {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            
            <Tabs defaultValue="bank" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                    <TabsTrigger value="bank" className="gap-2"><Building2 className="w-4 h-4"/> Transferencia</TabsTrigger>
                    <TabsTrigger value="stripe" className="gap-2"><CreditCard className="w-4 h-4"/> Stripe</TabsTrigger>
                    <TabsTrigger value="payphone" className="gap-2"><Smartphone className="w-4 h-4"/> PayPhone</TabsTrigger>
                </TabsList>

                <TabsContent value="bank" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cuentas Bancarias Locales</CardTitle>
                            <CardDescription>Añade cuentas para que los pacientes depositen.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Banco</Label>
                                    <Input placeholder="Ej. Banco Pichincha" value={newBank.bank_name} onChange={e => setNewBank({...newBank, bank_name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo de Cuenta</Label>
                                    <Input placeholder="Ahorros / Corriente" value={newBank.account_type} onChange={e => setNewBank({...newBank, account_type: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Número de Cuenta</Label>
                                    <Input placeholder="XXXXXXXXXX" value={newBank.account_number} onChange={e => setNewBank({...newBank, account_number: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Titular</Label>
                                    <Input placeholder="Nombre del titular" value={newBank.holder_name} onChange={e => setNewBank({...newBank, holder_name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cédula / RUC</Label>
                                    <Input placeholder="Identificación" value={newBank.holder_id} onChange={e => setNewBank({...newBank, holder_id: e.target.value})} />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={addBankTransfer}><Plus className="w-4 h-4 mr-2"/> Agregar Cuenta</Button>
                        </CardFooter>
                    </Card>

                    <div className="space-y-2">
                        {isLoading && banks.length === 0 && (
                            <div className="p-4 text-center text-muted-foreground text-sm">Cargando cuentas...</div>
                        )}
                        {!isLoading && banks.length === 0 && (
                            <div className="p-4 text-center text-muted-foreground text-sm">No hay cuentas bancarias registradas.</div>
                        )}
                        {banks.map(bank => (
                            <div key={bank.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                                <div>
                                    <p className="font-medium">{bank.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {bank.config.account_type} • {bank.config.holder_name}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={bank.is_active} onCheckedChange={() => toggleActive(bank.id, bank.is_active)} />
                                    <Button variant="ghost" size="icon" onClick={() => deleteMethod(bank.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="stripe" className="space-y-4 pt-4">
                    <Card>
                         <CardHeader>
                            <CardTitle>Conexión Stripe</CardTitle>
                            <CardDescription>Para pagos con tarjeta internacionales.</CardDescription>
                         </CardHeader>
                         <CardContent>
                            <div className="space-y-2">
                                <Label>Publishable Key</Label>
                                <Input 
                                    type="password" 
                                    value={stripe?.config?.publishable_key || stripeKey} 
                                    onChange={e => setStripeKey(e.target.value)} 
                                    placeholder={isLoading ? "Cargando..." : "pk_test_..."}
                                    disabled={isLoading}
                                />
                            </div>
                         </CardContent>
                         <CardFooter>
                             <Button onClick={updateStripe}>Guardar Configuración</Button>
                         </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="payphone" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>PayPhone Ecuador</CardTitle>
                            <CardDescription>Pagos locales con tarjeta de crédito/débito.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="p-4 bg-muted/50 text-center rounded-lg">
                                 <p className="text-sm text-muted-foreground">Próximamente: Integración directa con API PayPhone.</p>
                             </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
