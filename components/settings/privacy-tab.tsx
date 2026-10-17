"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Shield, Download, Trash2, Clock, Info, AlertTriangle, FileText, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { requireClinicalExportAuthority } from "@/lib/clinical-export-authority"

interface DataRightsRequest {
  id: string
  clinic_id: string
  user_id: string | null
  request_type: string
  status: string
  legal_basis: string
  retention_note: string | null
  details: any
  created_at: string
}

export function PrivacyTab() {
  const { currentClinicId, user } = useAuth()
  const authorityRef = useRef({ clinicId: currentClinicId, userId: user?.id, generation: 0 })
  if (authorityRef.current.clinicId !== currentClinicId || authorityRef.current.userId !== user?.id) {
    authorityRef.current = { clinicId: currentClinicId, userId: user?.id, generation: authorityRef.current.generation + 1 }
  }
  useEffect(() => () => {
    authorityRef.current = { ...authorityRef.current, generation: authorityRef.current.generation + 1 }
  }, [])
  const [logs, setLogs] = useState<any[]>([])
  const [rightsRequests, setRightsRequests] = useState<DataRightsRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")

  const fetchLogs = useCallback(async () => {
    const scope = authorityRef.current
    if (!scope.clinicId || !scope.userId) return
    try {
      const { data, error } = await supabase
        .from('clinic_audit_logs')
        .select('*')
        .eq('clinic_id', scope.clinicId)
        .order('timestamp', { ascending: false })
        .limit(10)
      
      if (authorityRef.current.generation !== scope.generation) return
      if (error) {
        console.error("Error fetching logs", error)
      } else {
        setLogs(data || [])
      }
    } catch (err) {
      console.error("Unexpected error fetching audit logs", err)
    }
  }, [])

  const fetchRightsRequests = useCallback(async () => {
    const scope = authorityRef.current
    if (!scope.clinicId || !scope.userId) return
    try {
      const { data, error } = await supabase
        .from('data_rights_requests')
        .select('*')
        .eq('clinic_id', scope.clinicId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (authorityRef.current.generation !== scope.generation) return
      if (error) {
        // If table not yet provisioned in active database, keep empty without crashing
        console.warn("Could not fetch data rights requests:", error.message)
      } else {
        setRightsRequests(data || [])
      }
    } catch (err) {
      console.warn("Unexpected error fetching data rights requests:", err)
    }
  }, [currentClinicId])

  useEffect(() => {
    setLogs([])
    setRightsRequests([])
    if (currentClinicId) {
      setIsLoading(true)
      Promise.all([fetchLogs(), fetchRightsRequests()]).finally(() => {
        setIsLoading(false)
      })
    }
  }, [currentClinicId, user?.id, fetchLogs, fetchRightsRequests])

  /**
   * Statutory Right to Data Portability (Article 17, Ecuadorian LOPDP)
   * Generates interoperable JSON backup and persists traceable compliance record.
   */
  const handleExportData = async () => {
    if (!currentClinicId || isExporting) {
      if (!currentClinicId) {
        toast.error("No se ha identificado la clínica actual")
      }
      return
    }

    try {
      setIsExporting(true)
      const scope = { clinicId: currentClinicId, userId: user?.id || "", generation: authorityRef.current.generation }
      const isCurrent = () => authorityRef.current.generation === scope.generation
        && authorityRef.current.clinicId === scope.clinicId && authorityRef.current.userId === scope.userId
      const assertAuthority = () => requireClinicalExportAuthority(supabase, scope, isCurrent)
      await assertAuthority()
      // Record the request before any bulk clinical read. A failed export remains pending for review.
      const { error: insertError } = await supabase.from('data_rights_requests').insert({
        clinic_id: currentClinicId,
        user_id: user?.id || null,
        request_type: 'portability',
        status: 'pending',
        legal_basis: 'LOPDP Art. 17 (Derecho a la portabilidad)',
        retention_note: 'Solicitud de exportación JSON; entrega pendiente de verificación.',
        details: {
          scope: 'clinic_metadata_export',
          requested_at: new Date().toISOString()
        }
      })
      if (insertError) {
        throw new Error(`No se pudo registrar la solicitud: ${insertError.message}`)
      }
      toast.info("Generando paquete de portabilidad clínica (LOPDP Art. 17)...")

      // PR-07 / M6 FIX: Deterministic paginated table fetch with stable order and fail-closed error checking
      // Resilient to API row caps (stops only when 0 rows are returned)
      async function fetchAllRows(tableName: string, clinicId: string) {
        let allRows: any[] = []
        let from = 0
        const pageSize = 1000
        while (true) {
          if (!isCurrent()) throw new Error("La sesión o clínica cambió durante la exportación.")
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('clinic_id', clinicId)
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1)

          if (!isCurrent()) throw new Error("La sesión o clínica cambió durante la exportación.")
          if (error) {
            throw new Error(`Error en entidad '${tableName}': ${error.message}`)
          }
          if (!data || data.length === 0) {
            break
          }
          allRows = allRows.concat(data)
          from += data.length
        }
        return allRows
      }

      // Fetch all clinical and administrative entities with pagination & strict error propagation
      const [
        patientsData, 
        appointmentsData, 
        servicesData, 
        hcuData, 
        prescriptionsData, 
        notesData, 
        filesData,
        clinicalRecordsData,
        prescriptionTemplatesData
      ] = await Promise.all([
        fetchAllRows('patients', currentClinicId),
        fetchAllRows('appointments', currentClinicId),
        fetchAllRows('services', currentClinicId),
        fetchAllRows('hcu033_forms', currentClinicId),
        fetchAllRows('prescriptions', currentClinicId),
        fetchAllRows('patient_notes', currentClinicId),
        fetchAllRows('patient_files', currentClinicId),
        fetchAllRows('clinical_records', currentClinicId),
        fetchAllRows('prescription_templates', currentClinicId)
      ])

      // Deny publication after revocation or a changed user/clinic, even if all rows arrived.
      await assertAuthority()

      const backupData = {
        meta: {
          software: "Clinia+ SaaS Dental",
          export_date: new Date().toISOString(),
          delivery_scope: 'clinic_metadata_export',
          binary_attachments_included: false,
          consistent_database_snapshot: false,
          binary_delivery_note: 'El presente paquete interoperable JSON contiene registros estructurados y metadatos de archivos. No contiene archivos binarios (imágenes/documentos adjuntos). La entrega de adjuntos binarios requiere un proceso de custodia y entrega por canal seguro independiente.',
          normativa: "Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador) - Art. 17 (Derecho a la Portabilidad)",
          normas_salud: "Ley Orgánica de Salud del Ecuador (Art. 7) y Normas Técnicas MSP (HCU-033)",
          clinic_id: currentClinicId,
          manifest: {
            total_patients: patientsData.length,
            total_appointments: appointmentsData.length,
            total_services: servicesData.length,
            total_hcu033_records: hcuData.length,
            total_prescriptions: prescriptionsData.length,
            total_patient_notes: notesData.length,
            total_patient_files: filesData.length,
            total_clinical_records: clinicalRecordsData.length,
            total_prescription_templates: prescriptionTemplatesData.length,
            binary_attachments_count: 0,
            binary_metadata_records: filesData.length,
            tables_included: [
              'patients',
              'appointments',
              'services',
              'hcu033_forms',
              'prescriptions',
              'patient_notes',
              'patient_files',
              'clinical_records',
              'prescription_templates'
            ],
            package_generated: true,
            rights_request_status: 'pending'
          }
        },
        data: {
          patients: patientsData,
          appointments: appointmentsData,
          services: servicesData,
          hcu033_forms: hcuData,
          prescriptions: prescriptionsData,
          patient_notes: notesData,
          patient_files: filesData,
          clinical_records: clinicalRecordsData,
          prescription_templates: prescriptionTemplatesData
        }
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`
      const downloadAnchor = document.createElement('a')
      const fileName = `clinia_portabilidad_lopdp_art17_${new Date().toISOString().slice(0, 10)}.json`
      downloadAnchor.setAttribute("href", jsonString)
      downloadAnchor.setAttribute("download", fileName)
      if (!isCurrent()) throw new Error("La sesión o clínica cambió durante la exportación.")
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      await fetchRightsRequests()

      toast.success("Descarga iniciada. Solicitud de portabilidad registrada y pendiente de verificación.")
    } catch (err: any) {
      console.error("Error al exportar datos:", err)
      toast.error("Error al generar el respaldo de datos: " + (err.message || "Error de conexión"))
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Statutory Right to Elimination / Suppression (Article 15, Ecuadorian LOPDP)
   * Reconciled with mandatory medical history custody (Ley Orgánica de Salud Art. 7).
   */
  const handleConfirmDeletion = async () => {
    if (!currentClinicId) {
      toast.error("No se ha identificado la clínica actual")
      return
    }

    try {
      setIsSubmittingDeletion(true)

      const { error: insertError } = await supabase.from('data_rights_requests').insert({
        clinic_id: currentClinicId,
        user_id: user?.id || null,
        request_type: 'deletion',
        status: 'pending',
        legal_basis: 'LOPDP Art. 15 (Derecho de eliminación) & Ley Orgánica de Salud Art. 7',
        retention_note: 'La eliminación requiere revisar la base legal y la política de custodia clínica aplicables antes de resolver la solicitud.',
        details: {
          requested_by: user?.email,
          requested_role: user?.role,
          reason: deleteReason.trim() || 'Solicitud de bloqueo/archivado voluntario por titular',
          custody_review_required: true,
          submitted_at: new Date().toISOString()
        }
      })

      if (insertError) {
        throw new Error(`No se pudo registrar la solicitud: ${insertError.message}`)
      }
      await fetchRightsRequests()

      setShowDeleteDialog(false)
      setDeleteReason("")
      toast.info(
        "Solicitud registrada. Un responsable revisará el alcance, la base legal y las obligaciones de custodia antes de resolverla."
      )
    } catch (err: any) {
      console.error("Error al solicitar baja:", err)
      toast.error("Error al registrar solicitud: " + (err.message || "Error de conexión"))
    } finally {
      setIsSubmittingDeletion(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Statutory Regulatory Framework Alert */}
      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="text-blue-900 dark:text-blue-200 font-semibold mb-1">
          Marco Normativo de Protección de Datos y Custodia Clínica (Ecuador)
        </div>
        <AlertDescription className="text-xs text-blue-800/90 dark:text-blue-300/90 space-y-1 mt-1">
          <p>
            <strong>Portabilidad de Datos (Art. 17 LOPDP)</strong>: La solicitud requiere verificar identidad, alcance y formato de entrega.
          </p>
          <p>
            <strong>Derecho de Eliminación / Supresión (Art. 15 LOPDP)</strong>: Puede solicitar la eliminación de datos personales. Un responsable revisará su alcance, la base legal y las obligaciones de custodia aplicables antes de resolverla.
          </p>
          <p className="text-muted-foreground text-[11px] pt-1 border-t border-blue-200/60 dark:border-blue-900/60">
            * Los Artículos 20 y 21 de la LOPDP rigen específicamente el derecho a no ser objeto de decisiones basadas única o parcialmente en valoraciones automatizadas y elaboración de perfiles (*Decisiones y valoraciones automatizadas*).
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Privacidad y Portabilidad de Datos (LOPDP Ecuador)</CardTitle>
          </div>
          <CardDescription>
            Gestione el acceso, portabilidad, seguridad y custodia de datos de salud conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador y la Ley Orgánica de Salud.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LOPDP Article 17: Right to Portability */}
            <div className="p-4 border rounded-xl space-y-3 bg-muted/20">
              <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Download className="h-4 w-4 text-primary" />
                Portabilidad de Datos (Art. 17 LOPDP)
              </h3>
              <p className="text-sm text-muted-foreground">
                Exportación estructurada de registros clínicos y metadatos en formato interoperable JSON. Los archivos binarios adjuntos (imágenes/documentos) no están incrustados en este paquete y requieren un proceso de custodia y entrega por canal seguro independiente.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportData} 
                disabled={isExporting}
                className="w-full font-medium"
              >
                {isExporting ? "Generando metadatos..." : "Descargar registros clínicos y metadatos (JSON)"}
              </Button>
            </div>

            {/* LOPDP Article 15: Right to Elimination / Archival Custody */}
            <div className="p-4 border rounded-xl space-y-3 border-amber-200/60 bg-amber-50/15 dark:border-amber-900/40 dark:bg-amber-950/10">
              <h3 className="font-bold flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Trash2 className="h-4 w-4 text-amber-600" />
                Derecho de Eliminación / Baja (Art. 15 LOPDP)
              </h3>
              <p className="text-sm text-muted-foreground">
                Solicite la revisión de eliminación o bloqueo de datos. Un responsable evaluará las obligaciones de custodia antes de actuar.
              </p>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)} 
                className="w-full bg-amber-700 hover:bg-amber-800 text-white"
              >
                Solicitar Bloqueo / Archivado Clínico
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Log of Statutory Data Rights Requests (R4-B Persistence) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Solicitudes de Derechos LOPDP y Custodia Médica</CardTitle>
          </div>
          <CardDescription>
            Registro estructurado y trazable de solicitudes de derechos ARCO / LOPDP y estado de custodia clínica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo de Solicitud</TableHead>
                <TableHead>Fundamento Legal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Nota de Custodia / Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rightsRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-xs">
                    {new Date(req.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={req.request_type === 'portability' ? 'secondary' : 'outline'} className="capitalize">
                      {req.request_type === 'portability' ? 'Portabilidad' : req.request_type === 'deletion' ? 'Eliminación / Baja' : req.request_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{req.legal_basis}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {req.status === 'completed' ? 'Completado' : req.status === 'pending' ? 'En revisión' : req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {req.retention_note || "Sin observaciones adicionales"}
                  </TableCell>
                </TableRow>
              ))}
              {rightsRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                    {isLoading ? "Cargando solicitudes..." : "No se han emitido solicitudes formales de derechos para esta clínica."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity and Audit Log */}
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
          </Table>
          <div className="mt-4 flex justify-center">
             <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Ver historial completo
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for LOPDP Article 15 Deletion / Custody Archival */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Solicitud de Eliminación y Archivado (Art. 15 LOPDP)</DialogTitle>
            </div>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Conforme al <strong>Artículo 15</strong> de la Ley Orgánica de Protección de Datos Personales (LOPDP), usted puede solicitar la eliminación de su cuenta y datos personales.
              </p>
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> Reconciliación con la Ley Orgánica de Salud:
                </p>
                <p>
                  La conservación de historias clínicas, diagnósticos y recetas se revisará según el tipo de registro y las obligaciones legales aplicables.
                </p>
                <p>
                  La solicitud no elimina registros automáticamente; un responsable verificará si corresponde conservarlos, bloquearlos o eliminarlos.
                </p>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Motivo de la solicitud (Opcional):
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej. Cierre de consultorio, cambio de software"
                  className="w-full text-xs px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmittingDeletion}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeletion}
              disabled={isSubmittingDeletion}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {isSubmittingDeletion ? "Registrando Solicitud..." : "Confirmar Solicitud de Archivado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
