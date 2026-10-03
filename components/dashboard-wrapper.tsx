"use client"

import React from "react"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const {user, currentClinicId, isLoading, isRevalidating, authError, refreshProfile, logout} = useAuth()
  useRealtimeNotifications()
  // Unmount consumers on scope invalidation; their forms must not survive a
  // session or clinic switch with data from the previous authority.
  if (isLoading) return <main className="flex min-h-screen items-center justify-center" aria-busy="true"><p role="status">Verificando acceso…</p></main>
  if (!user) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
    <p role="alert">{authError || 'No tienes acceso activo a una clínica.'}</p>
    <Button onClick={() => void refreshProfile()}>Reintentar</Button>
    <Button variant="outline" onClick={() => void logout()}>Cerrar sesión</Button>
  </main>
  return <>
    <Dialog open={isRevalidating} onOpenChange={() => {}}>
      <DialogPortal>
        <DialogOverlay className="z-[100] bg-background data-[state=open]:animate-none data-[state=closed]:hidden" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 text-center" aria-busy="true" onEscapeKeyDown={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
          <DialogTitle>Verificando acceso…</DialogTitle>
          <DialogDescription>Conservamos tu formulario mientras comprobamos tus permisos.</DialogDescription>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
    <div key={`${user.id}:${currentClinicId}:${user.role}`} hidden={isRevalidating} inert={isRevalidating || undefined}>{children}</div>
  </>
}
