"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Plus, 
  Trash2, 
  Download, 
  FileText, 
  History, 
  FilePlus,
  Loader2,
  Printer
} from "lucide-react"
import { toast } from "sonner"
import { savePrescription } from "@/app/actions/save-prescription"
import { isPrescriptionRole, normalizePrescriptionInput } from "@/lib/prescription-policy.mjs"
import { exportPersistedPrescription } from "@/lib/pdf-client"
import type { PersistedPrescriptionReceipt } from "@/lib/prescription-receipt.mjs"

interface Medication {
  name: string
  dosage: string
  duration: string
}

interface Prescription extends PersistedPrescriptionReceipt {
  id: string
  created_at: string
  data: {
    medications: Medication[]
    indications: string
  }
}

interface PatientPrescriptionsProps {
  patientId: string
  patientName: string
}

interface Template {
  id: string
  name: string
  data: {
    medications: Medication[]
    indications: string
  }
}

export function PatientPrescriptions({ patientId }: PatientPrescriptionsProps) {
  const { user, currentClinicId, isRevalidating } = useAuth()
  const userId = user?.id
  const [medications, setMedications] = useState<Medication[]>([{ name: "", dosage: "", duration: "" }])
  const [indications, setIndications] = useState("")
  const [history, setHistory] = useState<Prescription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [refreshSavedHistory, setRefreshSavedHistory] = useState(false)
  const contextKey = `${currentClinicId || ""}:${userId || ""}:${patientId}`
  const contextRef = useRef(contextKey)
  contextRef.current = contextKey
  const generation = useRef(0)
  const saving = useRef(false)
  const draftRequest = useRef<{ context: string; intent: string; id: string } | null>(null)
  const publication = useRef({ valid: false })
  if (isRevalidating) publication.current.valid = false
  useEffect(() => {
    const token = { valid: !isRevalidating }
    publication.current = token
    return () => { token.valid = false }
  }, [contextKey, isRevalidating])
  const [checkedContext, setCheckedContext] = useState<string | null>(null)
  const [authorizedContext, setAuthorizedContext] = useState<string | null>(null)
  const canIssuePrescription = authorizedContext === contextKey && !isRevalidating

  const fetchTemplatesAndData = useCallback(async (isCurrent: () => boolean) => {
    if (!currentClinicId || !userId) return
    const templateResult = await supabase.from('prescription_templates').select('id, name, data').eq('clinic_id', currentClinicId).order('name')
    if (!isCurrent()) return
    setTemplates(templateResult.data || [])
  }, [currentClinicId, userId])

  const fetchHistory = useCallback(async (isCurrent: () => boolean) => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('prescriptions')
        .select('id, created_at, data, clinic_id, patient_id, doctor_id, issuance_snapshot')
        .eq('patient_id', patientId)
        .eq('clinic_id', currentClinicId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (isCurrent()) setHistory(data || [])
    } catch (error) {
      if (isCurrent()) toast.error('No se pudo cargar el historial de recetas.')
    } finally {
      if (isCurrent()) setIsLoading(false)
    }
  }, [currentClinicId, patientId])

  useEffect(() => {
    if (!refreshSavedHistory || isRevalidating || authorizedContext !== contextKey) return
    const token = publication.current
    const request = generation.current
    const isCurrent = () => token.valid && request === generation.current && contextRef.current === contextKey
    void fetchHistory(isCurrent).finally(() => {
      if (isCurrent()) {
        setRefreshSavedHistory(false)
        toast.info("La receta se guardó durante la verificación. Revisa el historial antes de volver a emitirla.")
      }
    })
  }, [refreshSavedHistory, isRevalidating, authorizedContext, contextKey, fetchHistory])

  const addMedication = () => {
    draftRequest.current = null
    setMedications([...medications, { name: "", dosage: "", duration: "" }])
  }

  const removeMedication = (index: number) => {
    draftRequest.current = null
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    if (medications[index][field] !== value) draftRequest.current = null
    const newMeds = [...medications]
    newMeds[index][field] = value
    setMedications(newMeds)
  }

  const applyTemplate = (template: Template) => {
    draftRequest.current = null
    setMedications(template.data.medications.map(m => ({ ...m })))
    setIndications(template.data.indications)
    toast.info(`Plantilla "${template.name}" aplicada`)
  }

  const handleGeneratePDF = async () => {
    if (!canIssuePrescription || saving.current) return
    const request = generation.current
    const token = publication.current
    const isCurrent = () => token.valid && request === generation.current && contextRef.current === contextKey
    if (!normalizePrescriptionInput({ patientId, clinicId: currentClinicId, medications, indications })) {
      toast.error("Completa nombre, dosis y duración de cada medicamento y revisa las indicaciones.")
      return
    }

    const saved = await handleSave()
    if (!saved) return

    if (isCurrent()) {
      try {
        await exportPrescription(saved, isCurrent)
      } catch {
        if (isCurrent()) toast.error("La receta se guardó, pero no se pudo generar el PDF. Consulta el historial antes de volver a emitirla.")
      }
    }
  }

  const exportPrescription = async (record: PersistedPrescriptionReceipt, isCurrent: () => boolean) => {
    if (!isCurrent() || record.clinic_id !== currentClinicId || record.patient_id !== patientId) return
    if (!userId || !currentClinicId) return
    await exportPersistedPrescription(supabase, { userId, clinicId: currentClinicId,
      patientId, prescriptionId: record.id }, isCurrent)
  }

  useEffect(() => {
    const request = ++generation.current
    const isCurrent = () => request === generation.current && contextRef.current === contextKey
    setCheckedContext(null)
    setAuthorizedContext(null)
    setHistory([])
    setTemplates([])
    draftRequest.current = null
    setMedications([{ name: "", dosage: "", duration: "" }])
    setIndications("")
    setIsLoading(false)
    setIsSaving(false)
    setRefreshSavedHistory(false)
    if (!currentClinicId || !userId) {
      setCheckedContext(contextKey)
      return () => { generation.current += 1 }
    }

    const loadAccessAndData = async () => {
      try {
        const [roleResult, profileResult] = await Promise.all([
          supabase.rpc("get_clinic_member_role", { check_clinic_id: currentClinicId }),
          supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
        ])
        if (!isCurrent()) return
        setCheckedContext(contextKey)
        if (roleResult.error || !isPrescriptionRole(roleResult.data) || profileResult.error || profileResult.data?.status !== "active") return
        setAuthorizedContext(contextKey)
        await Promise.all([fetchHistory(isCurrent), fetchTemplatesAndData(isCurrent)])
      } catch {
        if (isCurrent()) {
          setCheckedContext(contextKey)
          setAuthorizedContext(null)
        }
      }
    }

    void loadAccessAndData()
    return () => { generation.current += 1 }
  }, [contextKey, currentClinicId, userId, fetchHistory, fetchTemplatesAndData])

  const handleSave = async () => {
    if (!canIssuePrescription || saving.current || !currentClinicId || !user?.id) {
      toast.error("No se pudo guardar la receta. Verifica tu acceso y los datos del paciente.")
      return false
    }
    const request = generation.current
    const token = publication.current
    const isCurrent = () => token.valid && request === generation.current && contextRef.current === contextKey
    saving.current = true
    try {
      setIsSaving(true)
      const normalized = normalizePrescriptionInput({ patientId, clinicId: currentClinicId, medications, indications })
      if (!normalized) { toast.error("Revisa el contenido de la receta."); return false }
      const intent = JSON.stringify(normalized)
      if (!draftRequest.current || draftRequest.current.context !== contextKey || draftRequest.current.intent !== intent) {
        if (typeof globalThis.crypto?.randomUUID !== 'function') {
          toast.error("No se pudo identificar esta emisión. Abre el sitio autorizado en un navegador compatible.")
          return false
        }
        draftRequest.current = { context: contextKey, intent, id: globalThis.crypto.randomUUID() }
      }
      const result = await savePrescription({ ...normalized, requestId: draftRequest.current.id })
      if (!isCurrent()) {
        if (result.success && contextRef.current === contextKey) setRefreshSavedHistory(true)
        return false
      }
      if (!result.success) {
        toast.error(result.error)
        return false
      }
      toast.success("Receta guardada en el historial")
      await fetchHistory(isCurrent)
      return result.prescription
    } catch {
      if (isCurrent()) toast.error("Error al guardar la receta")
      return false
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  if (!canIssuePrescription) {
    return (
      <Card>
        <CardHeader><CardTitle>Recetas médicas</CardTitle></CardHeader>
        <CardContent>
          {checkedContext !== contextKey ? (
            <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando acceso…</p>
          ) : (
            <p role="status" className="text-muted-foreground">No tienes acceso a las recetas de esta clínica. Solicita ayuda al odontólogo responsable.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 gap-6 ${canIssuePrescription ? "lg:grid-cols-3" : ""}`}>
        {/* Prescription Builder */}
        {canIssuePrescription && <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5" />
              Nueva Receta
            </CardTitle>
            <CardDescription>Prescribir medicamentos e indicaciones para el paciente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Templates Quick Select */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plantillas Rápidas</Label>
              <div className="flex flex-wrap gap-2">
                {templates.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No hay plantillas configuradas.</span>
                ) : (
                  templates.map((t) => (
                    <Button key={t.id} variant="outline" size="sm" onClick={() => applyTemplate(t)} className="h-8 border-teal-200 hover:bg-teal-50 hover:text-teal-700">
                      {t.name}
                    </Button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Medicamentos (Rp.)</Label>
                <Button variant="ghost" size="sm" onClick={addMedication} disabled={medications.length >= 20} className="h-8 text-primary">
                  <Plus className="h-4 w-4 mr-1" /> Agregar
                </Button>
              </div>

              {medications.map((med, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/30 relative group">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre</Label>
                    <Input 
                      placeholder="Ej. Paracetamol 500mg" 
                      value={med.name} 
                      maxLength={120}
                      onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frecuencia / Dosis</Label>
                    <Input 
                      placeholder="Ej. 1 tableta c/ 8h" 
                      value={med.dosage} 
                      maxLength={160}
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 relative">
                    <Label className="text-xs">Duración</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ej. 3 días" 
                        value={med.duration} 
                        maxLength={80}
                        onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                      />
                      {medications.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-red-500"
                          onClick={() => removeMedication(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold">Indicaciones y Cuidados</Label>
              <Textarea 
                placeholder="Indicaciones adicionales, dieta, reposo, etc." 
                rows={4} 
                value={indications}
                maxLength={2000}
                onChange={(e) => { if (indications !== e.target.value) draftRequest.current = null; setIndications(e.target.value) }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">La receta se guarda antes de generar el PDF.</p>

              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
                  draftRequest.current = null
                  setMedications([{ name: "", dosage: "", duration: "" }])
                  setIndications("")
                }}>
                  Limpiar
                </Button>
                <Button onClick={() => handleGeneratePDF()} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                  Generar e Imprimir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>}

        {/* Prescription History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial
            </CardTitle>
            <CardDescription>Recetas emitidas anteriormente.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <FileText className="h-8 w-8 mx-auto opacity-20" />
                <p>No hay historial de recetas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("es-ES")}
                      </span>
                      {canIssuePrescription && <Button
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          draftRequest.current = null
                          setMedications(item.data.medications)
                          setIndications(item.data.indications)
                          toast.success("Contenido cargado para una nueva receta")
                        }}
                      >
                        <FilePlus className="h-3.5 w-3.5" />
                      </Button>}
                    </div>
                    <p className="text-sm font-medium line-clamp-1">
                      {item.data.medications.map(m => m.name).join(", ")}
                    </p>
                    <div className="flex justify-end mt-2">
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => {
                          const token = publication.current
                          const request = generation.current
                          const isCurrent = () => token.valid && request === generation.current && contextRef.current === contextKey
                          void exportPrescription(item, isCurrent).catch((error) => {
                            if (isCurrent()) toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF.")
                          })
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" /> Descargar PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
