"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"

export function SubscriptionBlocker() {
  const { currentClinicId, logout } = useAuth()
  const [isBlocked, setIsBlocked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!currentClinicId) return

    const checkSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('clinics')
          .select('trial_ends_at, bypass_subscription, subscription_tier')
          .eq('id', currentClinicId)
          .single()

        if (error) {
            console.error("Error checking subscription:", error)
            return
        }

        if (data) {
          // 1. Bypass Check
          if (data.bypass_subscription) {
              setIsBlocked(false)
              return
          }

          // 2. Paid Tier Check (Assuming anything other than 'trial' is paid/safe for now)
          if (data.subscription_tier !== 'trial') {
               setIsBlocked(false)
               return
          }

          // 3. Trial Expiration Check
          const now = new Date()
          const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null

          if (trialEnd && now > trialEnd) {
               setIsBlocked(true)
          } else {
               setIsBlocked(false)
          }
        }
      } catch (err) {
          console.error("Subscription check failed", err)
      }
    }

    checkSubscription()
  }, [currentClinicId, pathname])

  // Allow unrestricted access to billing page to process payment
  if (pathname === '/billing' || pathname === '/dashboard/settings') {
      // Logic: Maybe allow Settings to export data? 
      // User request: "blocks navigation" -> "Only for determinate users...".
      // Let's stick to strict blocking except Billing.
      if (pathname === '/billing') return null
  }
  
  if (!isBlocked) return null

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden text-center" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-primary text-xl">
            <Lock className="w-6 h-6" />
            Periodo de Prueba Finalizado
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
             Tu prueba gratuita de 14 días ha expirado. <br/>
             Para continuar accediendo a tus pacientes y datos, activa tu suscripción.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
           <Button onClick={() => router.push('/billing')} size="lg" className="w-full font-bold">
              Activar Suscripción Ahora
           </Button>
           <Button variant="ghost" onClick={() => logout()} className="w-full text-muted-foreground">
              Cerrar Sesión
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
