"use client"

import React from "react"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const {user, currentClinicId, isLoading, isRevalidating, logoutStatus, authError, refreshProfile, logout} = useAuth()
  useRealtimeNotifications()
  // Unmount consumers on scope invalidation; their forms must not survive a
  // session or clinic switch with data from the previous authority.
  if (logoutStatus === "pending") return <main className="flex min-h-screen items-center justify-center" aria-busy="true"><p role="status">Cerrando sesión…</p></main>
  if (logoutStatus === "failed") return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
    <p role="alert">{authError}</p>
    <Button onClick={() => void logout()}>Reintentar cierre de sesión</Button>
  </main>
  if (isLoading) return <main className="flex min-h-screen items-center justify-center" aria-busy="true"><p role="status">Verificando acceso…</p></main>
  if (!user) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
    <p role="alert">{authError || 'No tienes acceso activo a una clínica.'}</p>
    <Button onClick={() => void refreshProfile()}>Reintentar</Button>
    <Button variant="outline" onClick={() => void logout()}>Cerrar sesión</Button>
  </main>
  return <>
    {isRevalidating && !authError && <span className="sr-only" role="status">Verificando permisos.</span>}{isRevalidating && authError && <div role="status" className="fixed bottom-3 inset-x-3 z-[200] rounded-md border bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm dark:bg-amber-950 dark:text-amber-100">
      <p>{authError || 'Verificando permisos. El formulario se conserva; espera un momento para continuar.'}</p>
      {authError && <Button size="sm" variant="outline" className="mt-2" onClick={() => void refreshProfile()}>Volver a verificar</Button>}
    </div>}
    <div key={user.id + ':' + currentClinicId + ':' + user.role} aria-busy={isRevalidating} inert={isRevalidating || undefined}>{children}</div>
  </>
}
