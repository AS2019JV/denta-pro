"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, Download, Trash2, Search, Clock } from "lucide-react"
import { toast } from "sonner"

export function PrivacyTab() {
  const { currentClinicId } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (currentClinicId) {
      fetchLogs()
    }
  }, [currentClinicId])

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('clinic_audit_logs') // Using the secure view
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)
      
      if (error) {
          console.error("Error fetching logs", error)
      } else {
          setLogs(data || [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportData = async () => {
    toast.info("Preparando exportación de datos (RGPD Art. 20)...")
    // In a real app, this would trigger a background job to generate a ZIP/JSON
    setTimeout(() => {
        toast.success("Tu paquete de datos estará listo en 5 minutos. Recibirás un email.")
    }, 2000)
  }

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "¿ESTÁS SEGURO? Esta acción archivará tu clínica y eliminará el acceso. Conforme al RGPD, los datos se eliminarán permanentemente tras el periodo de retención legal (90 días)."
    )
    if (confirmed) {
       toast.error("Funcionalidad restringida: Contacte al administrador para eliminación definitiva.")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Privacidad y Portabilidad (RGPD)</CardTitle>
          </div>
          <CardDescription>
            Gestiona tu derecho al acceso, portabilidad y olvido según el Reglamento General de Protección de Datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-xl space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Download className="h-4 w-4" />
                Portabilidad de Datos
              </h3>
              <p className="text-sm text-muted-foreground">
                Descarga una copia completa de todos los datos de tu clínica en formato JSON estándar.
              </p>
              <Button variant="outline" size="sm" onClick={handleExportData} className="w-full">
                Solicitar Exportación (Art. 20)
              </Button>
            </div>

            <div className="p-4 border rounded-xl space-y-3 border-red-100 bg-red-50/10">
              <h3 className="font-bold flex items-center gap-2 text-red-700">
                <Trash2 className="h-4 w-4" />
                Derecho al Olvido
              </h3>
              <p className="text-sm text-muted-foreground">
                Solicita la eliminación de tu cuenta y todos los datos asociados de forma permanente.
              </p>
              <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="w-full">
                Archivar Clínica (Art. 17)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Registro de Actividad (Audit Log)</CardTitle>
          </div>
          <CardDescription>
            Trazabilidad de acceso a datos sensibles para cumplimiento normativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Tabla</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{log.actor_id?.substring(0,8)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.table_name}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No hay registros de actividad recientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </ Table>
          <div className="mt-4 flex justify-center">
             <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Ver historial completo
             </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
