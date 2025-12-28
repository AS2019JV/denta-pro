"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from "@/lib/subscription-plans"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, ArrowRight, CreditCard, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"

export function SubscriptionTab() {
  const { currentClinicId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentPlanId, setCurrentPlanId] = useState<string>('trial')
  const [status, setStatus] = useState<string>('trial')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (currentClinicId) {
       fetchSubscription()
    }
  }, [currentClinicId])

  const fetchSubscription = async () => {
    try {
        const { data, error } = await supabase
            .from('clinics')
            .select('subscription_tier, subscription_status, trial_ends_at')
            .eq('id', currentClinicId)
            .single()
        
        if (data) {
            setCurrentPlanId(data.subscription_tier || 'trial')
            setStatus(data.subscription_status || 'trial')
        }
    } catch(err) {
        console.error("Error fetching subscription", err)
    } finally {
        setLoading(false)
    }
  }

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    setProcessingId(plan.id)
    
    try {
        // Mock token generation (In prod: Open Kushki Modal -> Get Token)
        const mockToken = "tok_test_" + Math.random().toString(36).substring(7);
        
        const response = await fetch('/api/payments/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: mockToken,
                planId: plan.id,
                clinicId: currentClinicId
            })
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error);

        toast.success(`¡Suscripción a ${plan.name} activada con éxito!`);
        await fetchSubscription(); 

    } catch (error: any) {
        toast.error("Error en el proceso de pago: " + error.message);
    } finally {
        setProcessingId(null)
    }
  }

  const getColor = (id: string) => {
      switch(id) {
          case 'start': return "from-slate-400 to-slate-500"
          case 'pro': return "from-primary to-blue-600"
          case 'enterprise': return "from-slate-800 to-black"
          default: return "from-gray-400 to-gray-500"
      }
  }

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       
       {/* Current Status Banner */}
       <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 p-1 text-white shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-32 h-32" />
          </div>
          <div className="relative bg-white/10 backdrop-blur-sm p-6 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
             <div>
                <h2 className="text-2xl font-bond font-title flex items-center gap-2">
                   Plan Actual: <span className="uppercase font-black text-white">{currentPlanId}</span>
                </h2>
                <div className="flex items-center gap-2 mt-2">
                    <Badge variant={status === 'active' ? 'secondary' : 'destructive'} className="text-sm px-3 py-1">
                        {status === 'active' ? 'ACTIVO' : status.toUpperCase()}
                    </Badge>
                    {status === 'trial' && (
                        <span className="text-sm font-medium text-orange-200">
                            (Modo de Prueba - Funciones Limitadas)
                        </span>
                    )}
                </div>
             </div>
             {status === 'trial' && (
                 <div className="bg-orange-500/20 px-4 py-2 rounded-lg border border-orange-500/30">
                     <p className="text-sm font-bold text-orange-100">¡Tu prueba expira pronto!</p>
                 </div>
             )}
          </div>
       </div>

       <div className="grid md:grid-cols-3 gap-6 pt-4">
          {SUBSCRIPTION_PLANS.map((plan, index) => {
              const isCurrent = currentPlanId === plan.id;
              const isProcessing = processingId === plan.id;
              const color = getColor(plan.id);
              
              return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="h-full"
                  >
                      <Card className={`h-full border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative group ${isCurrent ? 'ring-2 ring-offset-2 ring-primary' : ''}`}>
                          <div className={`h-2 w-full bg-gradient-to-r ${color}`}></div>
                          
                          {plan.id === 'pro' && !isCurrent && (
                              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                                  RECOMENDADO
                              </div>
                          )}

                          <CardHeader>
                              <CardTitle className="text-2xl font-bold font-title">{plan.name}</CardTitle>
                              <CardDescription className="text-sm font-text">{plan.description}</CardDescription>
                              <div className="mt-4 flex items-baseline">
                                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">${plan.price}</span>
                                  <span className="text-muted-foreground ml-1">/mes</span>
                              </div>
                          </CardHeader>

                          <CardContent className="flex-1 space-y-6">
                              <ul className="space-y-3">
                                  {plan.features.map((feature, i) => (
                                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                                          <span>{feature}</span>
                                      </li>
                                  ))}
                              </ul>
                          </CardContent>

                          <div className="p-6 pt-0 mt-auto">
                              <Button 
                                  className={`w-full h-12 text-base font-medium shadow-md transition-all ${isCurrent ? 'bg-slate-200 text-slate-500 hover:bg-slate-200' : `bg-gradient-to-r ${color} text-white hover:opacity-90`}`}
                                  disabled={isCurrent || !!processingId}
                                  onClick={() => handleUpgrade(plan)}
                              >
                                  {isProcessing ? (
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : isCurrent ? (
                                      <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Plan Activo</span>
                                  ) : (
                                      <span className="flex items-center gap-2">
                                          Seleccionar Plan <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                      </span>
                                  )}
                              </Button>
                          </div>
                      </Card>
                  </motion.div>
              )
          })}
       </div>
       
       <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground pt-8 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
              <CreditCard className="w-4 h-4" />
              <span>Pagos procesados de forma segura vía <strong>Kushki</strong> (PCI Compliant)</span>
          </div>
          <p>© 2024 Denta-Pro. Todos los precios incluyen IVA.</p>
       </div>
    </div>
  )
}
