"use client"

import React, { useEffect, useRef } from "react"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const {user, currentClinicId, isLoading, isRevalidating, logoutStatus, authError, refreshProfile, logout} = useAuth()
  useRealtimeNotifications()
  const connectionNotice = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isRevalidating && authError) connectionNotice.current?.focus({ preventScroll: true })
    // AuthProvider restores prior focus after successful same-scope validation.
  }, [isRevalidating, authError])

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
    {isRevalidating && !authError && <span className="sr-only" role="status">Verificando permisos.</span>}{isRevalidating && authError && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/15 backdrop-blur-[1px] p-4">
      <div ref={connectionNotice} role="alertdialog" aria-modal="true" tabIndex={-1}
        aria-labelledby="connection-notice-title" aria-describedby="connection-notice-description"
        className="w-full max-w-sm rounded-xl border border-amber-200 bg-card p-5 text-card-foreground shadow-xl outline-none"
        onKeyDown={event => {
          if (event.key === 'Tab') {
            event.preventDefault()
            connectionNotice.current?.querySelector<HTMLButtonElement>('button')?.focus()
          }
        }}>
        <h2 id="connection-notice-title" className="font-semibold">Conexión interrumpida</h2>
        <div id="connection-notice-description" className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>{authError}</p>
          <p>Los cambios sin guardar se conservan en esta pantalla. Se perderán si recargas o cierras la página.</p>
        </div>
        <Button size="sm" variant="outline" className="mt-4 min-h-11" onClick={() => void refreshProfile()}>Volver a verificar</Button>
      </div>
    </div>}
    <div key={user.id + ':' + currentClinicId + ':' + user.role} aria-busy={isRevalidating} inert={isRevalidating || undefined}>{children}</div>
  </>
}
