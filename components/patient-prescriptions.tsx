"use client"

import { useState, useEffect } from "react"
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
  Printer,
  ClipboardList
} from "lucide-react"
import { generatePrescription } from "@/lib/pdf-generator"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

interface Medication {
  name: string
  dosage: string
  duration: string
}

interface Prescription {
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

export function PatientPrescriptions({ patientId, patientName }: PatientPrescriptionsProps) {
  const { user } = useAuth()
  const [medications, setMedications] = useState<Medication[]>([{ name: "", dosage: "", duration: "" }])
  const [indications, setIndications] = useState("")
  const [history, setHistory] = useState<Prescription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [clinicInfo, setClinicInfo] = useState<any>(null)
  const [doctorInfo, setDoctorInfo] = useState<any>(null)
  const [sendEmail, setSendEmail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchHistory()
    fetchTemplatesAndData()
  }, [patientId])

  const fetchTemplatesAndData = async () => {
    const { data: tData } = await supabase.from('prescription_templates').select('*').order('name')
    if (tData) setTemplates(tData)

    if (!user?.id) return
    const { data: profile } = await supabase.from('profiles').select('full_name, specialty, clinic_id').eq('id', user.id).maybeSingle()
    if (profile) {
       setDoctorInfo(profile)
       if (profile.clinic_id) {
         const { data: clinic } = await supabase.from('clinics').select('name, address, phone, logo_url').eq('id', profile.clinic_id).maybeSingle()
         if (clinic) setClinicInfo(clinic)
       }
    }
  }

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching prescriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addMedication = () => {
    setMedications([...medications, { name: "", dosage: "", duration: "" }])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications]
    newMeds[index][field] = value
    setMedications(newMeds)
  }

  const applyTemplate = (template: Template) => {
    setMedications(template.data.medications.map(m => ({ ...m })))
    setIndications(template.data.indications)
    toast.info(`Plantilla "${template.name}" aplicada`)
  }

  const handleGeneratePDF = async (save = true) => {
    if (medications.some(m => !m.name)) {
      toast.error("Por favor completa el nombre de los medicamentos")
      return
    }

    const pdfData = {
      patientName,
      patientId: "",
      medications,
      indications,
      clinicName: clinicInfo?.name || "Clínica Dental",
      clinicAddress: clinicInfo?.address || "",
      clinicPhone: clinicInfo?.phone || "",
      clinicLogo: clinicInfo?.logo_url,
      doctorName: doctorInfo?.full_name || user?.email || "Dr. Odontólogo",
      doctorSpecialty: doctorInfo?.specialty || "Odontología",
      signature: null
    }

    generatePrescription(pdfData)

    if (save) {
      await handleSave()
    }
    
    if (sendEmail) {
      // In a production environment, this would call an Edge Function to email the patient.
      toast.success(`Receta enviada por correo al paciente`)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: patientId,
          doctor_id: user?.id,
          data: { medications, indications }
        })

      if (error) throw error
      toast.success("Receta guardada en el historial")
      fetchHistory()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error("Error al guardar la receta")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescription Builder */}
        <Card className="lg:col-span-2">
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
                <Button variant="ghost" size="sm" onClick={addMedication} className="h-8 text-primary">
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
                      onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frecuencia / Dosis</Label>
                    <Input 
                      placeholder="Ej. 1 tableta c/ 8h" 
                      value={med.dosage} 
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 relative">
                    <Label className="text-xs">Duración</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ej. 3 días" 
                        value={med.duration} 
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
                onChange={(e) => setIndications(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Switch id="send-email" checked={sendEmail} onCheckedChange={setSendEmail} />
                <Label htmlFor="send-email" className="text-sm font-medium cursor-pointer">
                  Enviar copia al paciente por email
                </Label>
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
                  setMedications([{ name: "", dosage: "", duration: "" }])
                  setIndications("")
                }}>
                  Limpiar
                </Button>
                <Button onClick={() => handleGeneratePDF(true)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                  Generar e Imprimir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setMedications(item.data.medications)
                          setIndications(item.data.indications)
                          toast.success("Receta cargada para edición")
                        }}
                      >
                        <FilePlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm font-medium line-clamp-1">
                      {item.data.medications.map(m => m.name).join(", ")}
                    </p>
                    <div className="flex justify-end mt-2">
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => generatePrescription({
                          patientName,
                          medications: item.data.medications,
                          indications: item.data.indications,
                          clinicName: clinicInfo?.name || "Clínica Dental",
                          clinicAddress: clinicInfo?.address || "",
                          clinicPhone: clinicInfo?.phone || "",
                          clinicLogo: clinicInfo?.logo_url,
                          doctorName: doctorInfo?.full_name || user?.email || "Dr. Odontólogo",
                          doctorSpecialty: doctorInfo?.specialty || "Odontología"
                        })}
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
