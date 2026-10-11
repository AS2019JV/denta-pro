"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function SubscriptionTab() {
  const { currentClinicId, user, isLoading, authError } = useAuth()
  const query = useQuery({
    queryKey: ["clinic-access-status", currentClinicId, user?.id, user?.role],
    enabled: !!currentClinicId && !!user && !isLoading && !authError,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("check_subscription_active", { check_clinic_id: currentClinicId! }).abortSignal(signal)
      if (error || typeof data !== "boolean") throw new Error("No se pudo verificar el acceso")
      return data
    },
  })
  return <Card>
    <CardHeader><CardTitle>Acceso a la clínica</CardTitle><CardDescription>Estado actual del acceso a Clinia+.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {query.isPending ? <p role="status">Verificando acceso…</p> : query.isError ? <div role="alert"><p>No se pudo verificar el acceso.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : <p className="font-medium">{query.data ? "Acceso habilitado" : "Acceso pendiente de habilitación"}</p>}
      <p className="text-sm text-muted-foreground">Para cambios de acceso, contacta con la administración de tu clínica.</p>
    </CardContent>
  </Card>
}
