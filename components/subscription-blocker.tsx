"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"

export function SubscriptionBlocker() {
  const { user, currentClinicId, logout, isLoading, authError } = useAuth()
  const pathname = usePathname()
  const scope = `${currentClinicId || ''}:${user?.id || ''}:${user?.role || ''}`
  const [result, setResult] = useState<{ scope: string; status: 'checking' | 'allowed' | 'denied' | 'error' }>({ scope: '', status: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setResult({ scope, status: 'checking' })
    if (isLoading || authError || !currentClinicId || !user?.id) return () => controller.abort()
    const checkAccess = async () => {
      try {
        const { data, error } = await supabase.rpc('check_subscription_active', { check_clinic_id: currentClinicId }).abortSignal(controller.signal)
        if (error || typeof data !== 'boolean') throw new Error('No se pudo verificar el acceso')
        if (active) setResult({ scope, status: data ? 'allowed' : 'denied' })
      } catch {
        if (active) setResult({ scope, status: 'error' })
      }
    }
    void checkAccess()
    return () => { active = false; controller.abort() }
  }, [scope, currentClinicId, user?.id, isLoading, authError, pathname, attempt])

  if (isLoading || authError || !currentClinicId || !user?.id) return null
  const status = result.scope === scope ? result.status : 'checking'
  if (status === 'allowed') return null
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden text-center" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{status === 'checking' ? 'Verificando acceso' : status === 'error' ? 'No se pudo verificar el acceso' : 'Acceso no disponible'}</DialogTitle>
          <DialogDescription>
            {status === 'checking' ? 'Espera mientras verificamos el acceso de la clínica.' : status === 'error' ? 'Reintenta la verificación antes de continuar.' : 'Contacta al responsable de la clínica para revisar tu acceso.'}
          </DialogDescription>
        </DialogHeader>
        {status === 'error' && <Button onClick={() => setAttempt(value => value + 1)}>Reintentar</Button>}
        <Button variant="ghost" onClick={() => logout()}>Cerrar sesión</Button>
      </DialogContent>
    </Dialog>
  )
}
