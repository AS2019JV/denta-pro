"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Printer, Search, Calendar, Stethoscope, ArrowUpRight, Loader2 } from "lucide-react"
import { exportPersistedPrescription } from "@/lib/pdf-client"
import { toast } from "sonner"
import { prescriptionPdfFromReceipt } from "@/lib/prescription-receipt.mjs"

interface PrescriptionRecord {
  id: string
  created_at: string
  patient_id: string
  doctor_id: string
  clinic_id: string
  issuance_snapshot: unknown
  data: {
    medications: Array<{
      name: string
      dosage: string
      duration: string
    }>
    indications: string
    signature?: string | null
  }
  patient?: {
    id: string
    first_name: string
    last_name: string
    cedula: string
  } | null
  doctor?: {
    full_name: string
    license_number: string
    specialization: string
  } | null
}

export function IssuedPrescriptionsList() {
  const { user, currentClinicId, isLoading: authLoading, isRevalidating, authError } = useAuth()
  const scope = !authLoading && !isRevalidating && !authError && currentClinicId && user?.id && ['doctor', 'clinic_owner'].includes(user.role)
    ? `${user.id}:${currentClinicId}:${user.role}` : ''
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const publication = useRef({ scope, valid: true })
  if (publication.current.scope !== scope) {
    publication.current.valid = false
    publication.current = { scope, valid: true }
  }
  const [loadedScope, setLoadedScope] = useState('')
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [reprintingId, setReprintingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const token = publication.current
    token.valid = true
    const current = () => active && !!scope && scopeRef.current === scope
    setPrescriptions([])
    setLoadedScope('')
    if (scope) {
      void fetchIssuedPrescriptions(current).then(() => {
        if (current()) setLoadedScope(scope)
      })
    }
    return () => { active = false; token.valid = false }
  }, [scope, currentClinicId])

  const fetchIssuedPrescriptions = async (current: () => boolean) => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('prescriptions')
        .select(`
          id,
          created_at,
          patient_id,
          doctor_id,
          clinic_id,
          issuance_snapshot,
          data
        `)
        .order('created_at', { ascending: false })

      if (currentClinicId) {
        query = query.eq('clinic_id', currentClinicId)
      }

      const { data, error } = await query

      if (error) throw error
      if (current()) setPrescriptions(((data as any[]) || []).map((rx) => {
        const pdf = prescriptionPdfFromReceipt(rx)
        return { ...rx, patient: pdf ? { id: rx.patient_id, first_name: pdf.patientName, last_name: '', cedula: pdf.patientId } : null,
          doctor: pdf ? { full_name: pdf.doctorName, specialization: pdf.doctorSpecialty,
            license_number: (rx.issuance_snapshot as any).doctor.license_number } : null }
      }))
    } catch (err: any) {
      console.error("Error al cargar historial de recetas:", err)
      if (current()) toast.error("No se pudo cargar el historial de recetas")
    } finally {
      if (current()) setIsLoading(false)
    }
  }

  const handleReprint = async (rx: PrescriptionRecord) => {
    const captured = scope
    const token = publication.current
    const current = () => token.valid && !!captured && scopeRef.current === captured && loadedScope === captured
    if (!current() || rx.clinic_id !== currentClinicId) return
    try {
      setReprintingId(rx.id)
      if (!user?.id || !currentClinicId) return
      await exportPersistedPrescription(supabase, { userId: user.id, clinicId: currentClinicId,
        patientId: rx.patient_id, prescriptionId: rx.id }, current)

      if (current()) toast.success("Receta médica generada en PDF")
    } catch (e: any) {
      console.error("Error al reimprimir receta", e)
      if (current()) toast.error(e instanceof Error ? e.message : "Error al generar el documento PDF")
    } finally {
      if (current()) setReprintingId(null)
    }
  }

  const filteredPrescriptions = (scope && loadedScope === scope ? prescriptions : []).filter((rx) => {
    const search = searchTerm.toLowerCase()
    const patientName = `${rx.patient?.first_name || ""} ${rx.patient?.last_name || ""}`.toLowerCase()
    const cedula = (rx.patient?.cedula || "").toLowerCase()
    const doctorName = (rx.doctor?.full_name || "").toLowerCase()
    const medNames = (rx.data?.medications || []).map(m => m.name.toLowerCase()).join(" ")

    return (
      patientName.includes(search) ||
      cedula.includes(search) ||
      doctorName.includes(search) ||
      medNames.includes(search)
    )
  })

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Historial de Recetas Médicas Emitidas
          </CardTitle>
          <CardDescription>
            Comprobantes de emisión guardados. Las recetas históricas sin comprobante requieren revisión de custodia para reimprimir.
          </CardDescription>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente, cédula o medicamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">Cargando recetas clínicas...</p>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-3">
            <FileText className="h-10 w-10 mx-auto opacity-20" />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              {searchTerm ? "No se encontraron recetas con el criterio de búsqueda." : "No se han emitido recetas médicas aún en este establecimiento."}
            </p>
            <p className="text-xs max-w-md mx-auto text-muted-foreground">
              Para emitir una nueva receta, ingrese a la ficha clínica del paciente y use el módulo &quot;Recetas Médicas&quot;.
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[120px]">Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Médico Odontólogo</TableHead>
                  <TableHead>Medicamentos Prescritos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrescriptions.map((rx) => {
                  const dateStr = new Date(rx.created_at).toLocaleDateString("es-EC", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })
                  const patientFullName = rx.patient
                    ? `${rx.patient.first_name} ${rx.patient.last_name}`
                    : "Paciente no especificado"

                  return (
                    <TableRow key={rx.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {dateStr}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          {rx.patient_id ? (
                            <Link 
                              href={`/patients/${rx.patient_id}`} 
                              className="font-medium text-sm text-primary hover:underline flex items-center gap-1 inline-flex"
                            >
                              {patientFullName}
                              <ArrowUpRight className="h-3 w-3 opacity-60" />
                            </Link>
                          ) : (
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                              {patientFullName}
                            </span>
                          )}
                          {rx.patient?.cedula && (
                            <div className="text-xs text-muted-foreground">
                              Cédula: <span className="font-mono">{rx.patient.cedula}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {rx.doctor?.full_name || "Profesional"}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Stethoscope className="h-3 w-3" />
                            <span>{rx.doctor?.specialization || "Odontología"}</span>
                            {rx.doctor?.license_number && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                {rx.doctor.license_number}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[280px]">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {(rx.data?.medications || []).slice(0, 3).map((m, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                {m.name} {m.dosage ? `(${m.dosage})` : ""}
                              </Badge>
                            ))}
                            {(rx.data?.medications || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(rx.data?.medications || []).length - 3} más
                              </Badge>
                            )}
                          </div>
                          {rx.data?.indications && (
                            <p className="text-xs text-muted-foreground truncate" title={rx.data.indications}>
                              {rx.data.indications}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprint(rx)}
                            disabled={reprintingId === rx.id}
                            className="h-8 gap-1.5 text-xs"
                          >
                            {reprintingId === rx.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5 text-primary" />
                            )}
                            Reimprimir PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
