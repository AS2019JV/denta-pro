"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SignaturePad } from "@/components/signature-pad"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { OdontogramaInteractive } from "@/components/odontograma-interactive"
import {
  Save,
  FileText,
  User,
  Stethoscope,
  Activity,
  Bluetooth as Tooth,
  ClipboardList,
  Calendar,
  FileSignature,
  Paperclip,
  Download,
  Plus,
  Trash2,

  ArrowLeft,
  Maximize2,
} from "lucide-react"
import { generateHCU033 } from "@/lib/pdf-generator"
import { toast } from "sonner"

interface HCU033FormProps {
  patientId: string
  patientName?: string
  onSave?: (data: any) => void
  isFullScreen?: boolean
  onClose?: () => void
  onExpand?: (currentData: any) => void
  externalData?: any
  onDataChange?: (data: any) => void
}

export function HCU033Form({ patientId, patientName, onSave, isFullScreen, onClose, onExpand, externalData, onDataChange }: HCU033FormProps) {
  const [formData, setFormData] = useState<any>({
    // Sección A: Datos del establecimiento y paciente
    establecimiento: "",
    unicodigo: "",
    historia_numero: "",
    hoja_numero: "",
    fecha: new Date().toISOString().split("T")[0],
    nombre_completo: patientName || "",
    identificacion: "",
    sexo: "",
    fecha_nacimiento: "",
    edad: "",
    direccion: "",
    telefono: "",
    responsable: "",

    // Sección B: Motivo de consulta
    motivo_consulta: "",

    // Sección C: Enfermedad actual
    enfermedad_actual: "",

    // Sección D: Antecedentes
    ant_alergia_antibioticos: false,
    ant_alergia_anestesia: false,
    ant_hemorragias: false,
    ant_vih: false,
    ant_tuberculosis: false,
    ant_asma: false,
    ant_diabetes: false,
    ant_hipertension: false,
    ant_enf_cardiaca: false,
    ant_otros: "",

    // Sección E: Signos vitales
    sv_presion_arterial: "",
    sv_fc: "",
    sv_temp: "",
    sv_fr: "",

    // Sección F: Examen estomatognático
    ex_labios: "",
    ex_mejillas: "",
    ex_encia: "",
    ex_lengua: "",
    ex_paladar: "",
    ex_piso_boca: "",
    ex_carrillos: "",
    ex_dientes: "",
    ex_articulacion: "",
    ex_ganglios: "",
    
    // Section 7: Indicadores de Salud Bucal
    indicadores_higiene: [
        { piezas: ['16', '17', '55'], placa: '', calculo: '', gingivitis: '' },
        { piezas: ['11', '21', '51'], placa: '', calculo: '', gingivitis: '' },
        { piezas: ['26', '27', '65'], placa: '', calculo: '', gingivitis: '' },
        { piezas: ['36', '37', '75'], placa: '', calculo: '', gingivitis: '' },
        { piezas: ['31', '41', '71'], placa: '', calculo: '', gingivitis: '' },
        { piezas: ['46', '47', '85'], placa: '', calculo: '', gingivitis: '' }
    ],
    indicadores_periodontal: "", // Leve, Moderada, Severa
    indicadores_maloclusion: "", // Angle I, II, III
    indicadores_fluorosis: "",   // Leve, Moderada, Severa
    
    // Section 8: Indices CPO-ceo
    indices_cpo: { c: 0, p: 0, o: 0, total: 0 },
    indices_ceo: { c: 0, e: 0, o: 0, total: 0 },

    // Sección G: Odontograma
    odontograma_data: {},
    odontograma_descripcion: "",

    // Sección H: Diagnósticos
    diagnosticos: [],

    // Sección I: Plan terapéutico
    plan_diagnostico: [],
    plan_terapeutico: [],

    // Sección J: Registro de sesiones
    registro_sesiones: [],

    // Sección K: Observaciones finales
    observaciones_finales: "",
    consentimiento_informado: false,
    firma_profesional: null,
    sello_establecimiento: null,

    // Sección L: Adjuntos
    attachments: [],
  })

  const [activeSection, setActiveSection] = useState("A")
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false)

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev, [field]: value }
      if (onDataChange) Promise.resolve().then(() => onDataChange(newData))
      return newData
    })
  }

  // Sync external data changes to local state
  useEffect(() => {
    if (externalData) {
       setFormData((prev: any) => {
          // Rudimentary check to avoid loop, deep equality would be better but stringify is okay for this size
          if (JSON.stringify(prev) !== JSON.stringify(externalData)) {
              return externalData
          }
          return prev
       })
    }
  }, [externalData])

  const addDiagnostico = () => {
    setFormData((prev: any) => ({
      ...prev,
      diagnosticos: [
        ...prev.diagnosticos,
        { fecha: new Date().toISOString().split("T")[0], codigo: "", descripcion: "", clinico: "" },
      ],
    }))
  }

  const removeDiagnostico = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      diagnosticos: prev.diagnosticos.filter((_: any, i: number) => i !== index),
    }))
  }

  const addPlanTerapeutico = () => {
    setFormData((prev: any) => ({
      ...prev,
      plan_terapeutico: [
        ...prev.plan_terapeutico,
        {
          sesion: prev.plan_terapeutico.length + 1,
          fecha: "",
          procedimiento: "",
          dientes_involucrados: "",
          observaciones: "",
        },
      ],
    }))
  }

  const addRegistroSesion = () => {
    setFormData((prev: any) => ({
      ...prev,
      registro_sesiones: [
        ...prev.registro_sesiones,
        {
          fecha: new Date().toISOString(),
          procedimiento: "",
          codigo: "",
          medicamentos: "",
          profesional: "",
          observaciones: "",
        },
      ],
    }))
  }

  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Only fetch if we don't have external data populated yet
    // Or if this is the first load instance.
    // If externalData is provided, we trust it more than DB fetch (which might be stale compared to in-memory edits).
    if (patientId && !externalData) {
      loadFormData()
    }
  }, [patientId, externalData])

  const loadFormData = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('hcu033_forms')
        .select('form_data')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setFormData((prev: any) => {
            const merged = { ...prev, ...data.form_data };
            // Ensure array/object fields are not undefined if missing in DB
            if (!merged.indicadores_higiene) merged.indicadores_higiene = prev.indicadores_higiene;
            if (!merged.indices_cpo) merged.indices_cpo = prev.indices_cpo;
            if (!merged.indices_ceo) merged.indices_ceo = prev.indices_ceo;
            
            if (onDataChange) Promise.resolve().then(() => onDataChange(merged))
            return merged;
        })
      }
    } catch (error) {
      console.error('Error loading form data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('hcu033_forms')
        .insert({
          patient_id: patientId,
          doctor_id: user?.id,
          form_data: formData,
        })

      if (error) throw error
      
      toast.success("Formulario guardado correctamente")
      onSave?.(formData)
    } catch (error) {
      console.error('Error saving form:', error)
      toast.error("Error al guardar el formulario")
    } finally {
      setIsLoading(false)
    }
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  const getSectionId = (section: string) => {
    return isFullScreen ? `section-${section}-fullscreen` : `section-${section}`
  }

  const scrollToSection = (section: string) => {
    setActiveSection(section)
    const elementId = getSectionId(section)
    const element = document.getElementById(elementId)
    
    if (element) {
      // Use standard scrollIntoView now that IDs are unique and scroll-margin is set via CSS classes
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div 
      ref={scrollContainerRef} 
      className={
        isFullScreen 
          ? "fixed inset-0 z-[100] bg-background flex flex-col h-[100dvh] overflow-hidden animate-in fade-in duration-200" 
          : "space-y-6 relative"
      }
    >
      <div className={isFullScreen 
        ? "flex-none border-b px-6 py-4 flex items-center justify-between shadow-sm z-10 bg-background" 
        : "flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b"
      }>
        {isFullScreen ? (
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                </Button>
                <div className="h-6 w-px bg-border hidden sm:block" />
                <div className="hidden sm:block">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            HCU-033
                            <Badge variant="outline" className="font-normal text-xs">Historia Clínica</Badge>
                        </h2>
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-between w-full md:w-auto">
             <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">HCU-033</h2>
                    <Badge variant="outline" className="font-normal">Historia Clínica Odontológica</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Formulario oficial del MSP - Ecuador</p>
             </div>
             {onExpand && (
                 <Button variant="outline" size="sm" className="ml-4 gap-2" onClick={() => onExpand(formData)}>
                     <Maximize2 className="h-4 w-4" />
                     <span className="hidden sm:inline">Expandir</span>
                 </Button>
             )}
            </div>
        )}

        <div className="flex gap-2 w-full md:w-auto md:ml-auto justify-end">
          <Button variant="outline" size="sm" className="h-9" onClick={() => generateHCU033(formData)}>
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button onClick={handleSave} className="h-9">
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>



      <div ref={contentScrollRef} className={isFullScreen ? "flex-1 overflow-y-auto px-6 pb-32 w-full scroll-smooth" : ""}>
         <div className={isFullScreen ? "max-w-7xl mx-auto" : ""}>

        {/* Sticky Key Sections Navigation */}
        <div className={`sticky top-0 z-50 bg-background/95 backdrop-blur border-b mb-6 -mx-2 px-2 overflow-x-auto shadow-sm transition-all`}>
             <div className="flex gap-1 py-2 min-w-max">
               {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(section => (
                   <Button 
                       key={section} 
                       variant={activeSection === section ? "default" : "ghost"} 
                       size="sm"
                       className="h-8 text-xs sm:text-sm"
                       onClick={() => scrollToSection(section)}
                   >
                       {section}
                   </Button>
               ))}
             </div>
        </div>

        <div className="space-y-12">

        {/* Sección A: Datos del establecimiento y paciente */}
        {/* Sección A: Datos del establecimiento y paciente */}
        <div id={getSectionId("A")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                A. Datos del establecimiento y paciente
              </CardTitle>
              <CardDescription>Información administrativa y de identificación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="establecimiento">
                    Establecimiento / Unidad <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.establecimiento} onValueChange={(v) => updateField("establecimiento", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar establecimiento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad-central">Unidad Odontológica Central</SelectItem>
                      <SelectItem value="clinica-norte">Clínica Norte</SelectItem>
                      <SelectItem value="clinica-sur">Clínica Sur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unicodigo">UNICÓDIGO</Label>
                  <Input
                    id="unicodigo"
                    value={formData.unicodigo}
                    onChange={(e) => updateField("unicodigo", e.target.value)}
                    placeholder="UNICÓDIGO (si aplica)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="historia_numero">
                    Número de Historia Clínica <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="historia_numero"
                    value={formData.historia_numero}
                    onChange={(e) => updateField("historia_numero", e.target.value)}
                    placeholder="Ej. HC-00001234"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hoja_numero">Nº hoja</Label>
                  <Input
                    id="hoja_numero"
                    value={formData.hoja_numero}
                    onChange={(e) => updateField("hoja_numero", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha">
                    Fecha del formulario <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => updateField("fecha", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nombre_completo">
                    Nombre completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nombre_completo"
                    value={formData.nombre_completo}
                    onChange={(e) => updateField("nombre_completo", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="identificacion">
                    Cédula / Pasaporte <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="identificacion"
                    value={formData.identificacion}
                    onChange={(e) => updateField("identificacion", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Sexo <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup value={formData.sexo} onValueChange={(v) => updateField("sexo", v)}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="M" id="sexo-m" />
                        <Label htmlFor="sexo-m">Masculino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="F" id="sexo-f" />
                        <Label htmlFor="sexo-f">Femenino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="O" id="sexo-o" />
                        <Label htmlFor="sexo-o">Otro/No reporta</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_nacimiento">
                    Fecha de nacimiento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fecha_nacimiento"
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => {
                      updateField("fecha_nacimiento", e.target.value)
                      // Calcular edad automáticamente
                      const birthDate = new Date(e.target.value)
                      const today = new Date()
                      let age = today.getFullYear() - birthDate.getFullYear()
                      const monthDiff = today.getMonth() - birthDate.getMonth()
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--
                      }
                      updateField("edad", age.toString())
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edad">Edad (años)</Label>
                  <Input id="edad" value={formData.edad} readOnly className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => updateField("direccion", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono / celular</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => updateField("telefono", e.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="responsable">Responsable / Tutor (si aplica)</Label>
                  <Input
                    id="responsable"
                    value={formData.responsable}
                    onChange={(e) => updateField("responsable", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección B: Motivo de consulta */}
        {/* Sección B: Motivo de consulta */}
        <div id={getSectionId("B")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                B. Motivo de consulta
              </CardTitle>
              <CardDescription>Versión del informante</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="motivo_consulta">
                  Motivo de consulta <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="motivo_consulta"
                  value={formData.motivo_consulta}
                  onChange={(e) => updateField("motivo_consulta", e.target.value)}
                  rows={4}
                  placeholder="Describir tal como lo informa el paciente / acompañante"
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección C: Enfermedad actual */}
        {/* Sección C: Enfermedad actual */}
        <div id={getSectionId("C")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                C. Enfermedad o problema actual
              </CardTitle>
              <CardDescription>Cronología, localización, características, intensidad, evolución</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="enfermedad_actual">
                  Descripción de la enfermedad o problema actual <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="enfermedad_actual"
                  value={formData.enfermedad_actual}
                  onChange={(e) => updateField("enfermedad_actual", e.target.value)}
                  rows={6}
                  placeholder="Cronología, inicio, duración, factores asociados"
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección D: Antecedentes */}
        {/* Sección D: Antecedentes */}
        <div id={getSectionId("D")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                D. Antecedentes personales y familiares
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: "ant_alergia_antibioticos", label: "Alergia a antibióticos" },
                  { id: "ant_alergia_anestesia", label: "Alergia a anestesia" },
                  { id: "ant_hemorragias", label: "Hemorragias / trastornos de coagulación" },
                  { id: "ant_vih", label: "VIH / SIDA" },
                  { id: "ant_tuberculosis", label: "Tuberculosis" },
                  { id: "ant_asma", label: "Asma" },
                  { id: "ant_diabetes", label: "Diabetes" },
                  { id: "ant_hipertension", label: "Hipertensión arterial" },
                  { id: "ant_enf_cardiaca", label: "Enfermedad cardíaca" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={item.id}
                      checked={formData[item.id]}
                      onCheckedChange={(checked) => updateField(item.id, checked)}
                    />
                    <Label htmlFor={item.id} className="cursor-pointer">
                      {item.label}
                    </Label>
                  </div>
                ))}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ant_otros">Otra(s) (especificar)</Label>
                  <Input
                    id="ant_otros"
                    value={formData.ant_otros}
                    onChange={(e) => updateField("ant_otros", e.target.value)}
                    placeholder="Describir otras afecciones"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección E: Signos vitales */}
        {/* Sección E: Signos vitales */}
        <div id={getSectionId("E")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                E. Signos vitales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sv_presion_arterial">Presión arterial (mmHg)</Label>
                  <Input
                    id="sv_presion_arterial"
                    value={formData.sv_presion_arterial}
                    onChange={(e) => updateField("sv_presion_arterial", e.target.value)}
                    placeholder="Ej. 120/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sv_fc">Frecuencia cardiaca (lpm)</Label>
                  <Input
                    id="sv_fc"
                    type="number"
                    value={formData.sv_fc}
                    onChange={(e) => updateField("sv_fc", e.target.value)}
                    min="20"
                    max="220"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sv_temp">Temperatura (°C)</Label>
                  <Input
                    id="sv_temp"
                    type="number"
                    step="0.1"
                    value={formData.sv_temp}
                    onChange={(e) => updateField("sv_temp", e.target.value)}
                    min="30"
                    max="45"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sv_fr">Frecuencia respiratoria (rpm)</Label>
                  <Input
                    id="sv_fr"
                    type="number"
                    value={formData.sv_fr}
                    onChange={(e) => updateField("sv_fr", e.target.value)}
                    min="5"
                    max="60"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección F: Examen estomatognático */}
        {/* Sección F: Examen estomatognático */}
        <div id={getSectionId("F")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tooth className="h-5 w-5" />
                F. Examen del sistema estomatognático
              </CardTitle>
              <CardDescription>Observaciones por región anatómica</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: "ex_labios", label: "1. Labios" },
                  { id: "ex_mejillas", label: "2. Mejillas" },
                  { id: "ex_encia", label: "3. Encías" },
                  { id: "ex_lengua", label: "4. Lengua" },
                  { id: "ex_paladar", label: "5. Paladar" },
                  { id: "ex_piso_boca", label: "6. Piso de la boca" },
                  { id: "ex_carrillos", label: "7. Carrillos" },
                  { id: "ex_dientes", label: "8. Dientes (observaciones generales)" },
                  { id: "ex_articulacion", label: "9. Articulación temporomandibular" },
                  { id: "ex_ganglios", label: "10. Ganglios" },
                ].map((item) => (
                  <div key={item.id} className="space-y-2">
                    <Label htmlFor={item.id}>{item.label}</Label>
                    <Textarea
                      id={item.id}
                      value={formData[item.id]}
                      onChange={(e) => updateField(item.id, e.target.value)}
                      rows={2}
                      placeholder="Observaciones..."
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección G: Odontograma */}
        {/* Sección G: Odontograma */}
        <div id={getSectionId("G")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tooth className="h-5 w-5" />
                G. Odontograma (simbología HCU-033)
              </CardTitle>
              <CardDescription>
                Odontograma interactivo con simbología oficial. Usa NumPad para entrada rápida de datos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OdontogramaInteractive
                data={formData.odontograma_data}
                onChange={(data: any) => updateField("odontograma_data", data)}
                patientName={patientName || formData.nombre_completo}
                patientId={patientId}
              />

              <div className="space-y-2">
                <Label htmlFor="odontograma_descripcion">Descripción por diente / observaciones</Label>
                <Textarea
                  id="odontograma_descripcion"
                  value={formData.odontograma_descripcion}
                  onChange={(e) => updateField("odontograma_descripcion", e.target.value)}
                  rows={4}
                  placeholder="Ej. 36: caries mesial. 46: movilidad grado 2"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección G.2: Indicadores de Salud Bucal y CPO-ceo */}
        <div id={getSectionId("G2")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
           <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Indicadores de Salud Bucal
                  </CardTitle>
                  <CardDescription>Higiene oral, enfermedad periodontal, maloclusión, fluorosis e índices CPO/ceo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                  {/* HIGIENE ORAL SIMPLIFICADA */}
                  <div>
                      <h4 className="text-sm font-bold mb-4 uppercase tracking-wide text-muted-foreground border-b pb-1">Higiene Oral Simplificada</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="border p-2 text-left">Piezas Dentales</th>
                                    <th className="border p-2 text-center w-24">Placa (0-3)</th>
                                    <th className="border p-2 text-center w-24">Cálculo (0-3)</th>
                                    <th className="border p-2 text-center w-24">Gingivitis (0-1)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.indicadores_higiene?.map((row: any, i: number) => (
                                    <tr key={i}>
                                        <td className="border p-2 font-medium bg-muted/20">
                                            {row.piezas.join(" - ")}
                                        </td>
                                        <td className="border p-1">
                                            <Input 
                                                className="h-8 text-center" 
                                                maxLength={1}
                                                value={row.placa} 
                                                onChange={e => {
                                                    const newHigiene = [...formData.indicadores_higiene];
                                                    newHigiene[i].placa = e.target.value;
                                                    updateField("indicadores_higiene", newHigiene);
                                                }}
                                            />
                                        </td>
                                        <td className="border p-1">
                                            <Input 
                                                className="h-8 text-center"
                                                maxLength={1} 
                                                value={row.calculo} 
                                                onChange={e => {
                                                    const newHigiene = [...formData.indicadores_higiene];
                                                    newHigiene[i].calculo = e.target.value;
                                                    updateField("indicadores_higiene", newHigiene);
                                                }}
                                            />
                                        </td>
                                        <td className="border p-1">
                                            <Input 
                                                className="h-8 text-center"
                                                maxLength={1} 
                                                value={row.gingivitis} 
                                                onChange={e => {
                                                    const newHigiene = [...formData.indicadores_higiene];
                                                    newHigiene[i].gingivitis = e.target.value;
                                                    updateField("indicadores_higiene", newHigiene);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-muted/50 font-bold">
                                    <td className="border p-2 text-right">TOTALES</td>
                                    <td className="border p-2 text-center">
                                        {formData.indicadores_higiene?.reduce((acc: number, curr: any) => acc + (parseInt(curr.placa) || 0), 0)}
                                    </td>
                                    <td className="border p-2 text-center">
                                        {formData.indicadores_higiene?.reduce((acc: number, curr: any) => acc + (parseInt(curr.calculo) || 0), 0)}
                                    </td>
                                    <td className="border p-2 text-center">
                                        {formData.indicadores_higiene?.reduce((acc: number, curr: any) => acc + (parseInt(curr.gingivitis) || 0), 0)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                      </div>
                  </div>
                  
                  {/* GRID OF OTHER INDICATORS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Enfermedad Periodontal</Label>
                          <Select 
                              value={formData.indicadores_periodontal} 
                              onValueChange={(v) => updateField("indicadores_periodontal", v)}
                          >
                              <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="leve">Leve</SelectItem>
                                  <SelectItem value="moderada">Moderada</SelectItem>
                                  <SelectItem value="severa">Severa</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Mal Oclusión</Label>
                          <Select 
                              value={formData.indicadores_maloclusion} 
                              onValueChange={(v) => updateField("indicadores_maloclusion", v)}
                          >
                              <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="angle1">Angle I</SelectItem>
                                  <SelectItem value="angle2">Angle II</SelectItem>
                                  <SelectItem value="angle3">Angle III</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Fluorosis</Label>
                          <Select 
                              value={formData.indicadores_fluorosis} 
                              onValueChange={(v) => updateField("indicadores_fluorosis", v)}
                          >
                              <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="leve">Leve</SelectItem>
                                  <SelectItem value="moderada">Moderada</SelectItem>
                                  <SelectItem value="severa">Severa</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  
                  {/* INDICES CPO-ceo */}
                  <div>
                      <h4 className="text-sm font-bold mb-4 uppercase tracking-wide text-muted-foreground border-b pb-1">Indices CPO-ceo</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* CPO (D) */}
                          <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                              <span className="font-bold text-emerald-800 block mb-2">D (Indice CPO)</span>
                              <div className="flex items-center gap-2">
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">C</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={formData.indices_cpo?.c}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCPO = { ...formData.indices_cpo, c: val };
                                            newCPO.total = newCPO.c + newCPO.p + newCPO.o;
                                            updateField("indices_cpo", newCPO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">P</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center"
                                        value={formData.indices_cpo?.p}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCPO = { ...formData.indices_cpo, p: val };
                                            newCPO.total = newCPO.c + newCPO.p + newCPO.o;
                                            updateField("indices_cpo", newCPO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">O</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center"
                                        value={formData.indices_cpo?.o}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCPO = { ...formData.indices_cpo, o: val };
                                            newCPO.total = newCPO.c + newCPO.p + newCPO.o;
                                            updateField("indices_cpo", newCPO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center font-bold">
                                      <Label className="text-xs text-emerald-700">TOTAL</Label>
                                      <div className="h-8 flex items-center justify-center bg-white border rounded">
                                          {formData.indices_cpo?.total}
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* ceo (d) */}
                          <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                              <span className="font-bold text-amber-800 block mb-2">d (Indice ceo)</span>
                              <div className="flex items-center gap-2">
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">c</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={formData.indices_ceo?.c}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCEO = { ...formData.indices_ceo, c: val };
                                            newCEO.total = newCEO.c + newCEO.e + newCEO.o;
                                            updateField("indices_ceo", newCEO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">e</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={formData.indices_ceo?.e}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCEO = { ...formData.indices_ceo, e: val };
                                            newCEO.total = newCEO.c + newCEO.e + newCEO.o;
                                            updateField("indices_ceo", newCEO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center">
                                      <Label className="text-xs">o</Label>
                                      <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={formData.indices_ceo?.o}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                            const newCEO = { ...formData.indices_ceo, o: val };
                                            newCEO.total = newCEO.c + newCEO.e + newCEO.o;
                                            updateField("indices_ceo", newCEO);
                                        }}
                                      />
                                  </div>
                                  <div className="flex-1 space-y-1 text-center font-bold">
                                      <Label className="text-xs text-amber-700">TOTAL</Label>
                                      <div className="h-8 flex items-center justify-center bg-white border rounded">
                                          {formData.indices_ceo?.total}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </CardContent>
           </Card>
        </div>

        {/* Sección H: Diagnósticos */}
        {/* Sección H: Diagnósticos */}
        <div id={getSectionId("H")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                H. Diagnósticos / Complicaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={addDiagnostico} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Diagnóstico
              </Button>

              <div className="space-y-4">
                {formData.diagnosticos.map((diag: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Fecha</Label>
                          <Input
                            type="date"
                            value={diag.fecha}
                            onChange={(e) => {
                              const newDiagnosticos = [...formData.diagnosticos]
                              newDiagnosticos[index].fecha = e.target.value
                              updateField("diagnosticos", newDiagnosticos)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Código (CIE)</Label>
                          <Input
                            value={diag.codigo}
                            onChange={(e) => {
                              const newDiagnosticos = [...formData.diagnosticos]
                              newDiagnosticos[index].codigo = e.target.value
                              updateField("diagnosticos", newDiagnosticos)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Diagnóstico / descripción</Label>
                          <Input
                            value={diag.descripcion}
                            onChange={(e) => {
                              const newDiagnosticos = [...formData.diagnosticos]
                              newDiagnosticos[index].descripcion = e.target.value
                              updateField("diagnosticos", newDiagnosticos)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Clínico responsable</Label>
                          <div className="flex gap-2">
                            <Input
                              value={diag.clinico}
                              onChange={(e) => {
                                const newDiagnosticos = [...formData.diagnosticos]
                                newDiagnosticos[index].clinico = e.target.value
                                updateField("diagnosticos", newDiagnosticos)
                              }}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeDiagnostico(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección I: Plan terapéutico */}
        {/* Sección I: Plan terapéutico */}
        <div id={getSectionId("I")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                I. Plan de diagnóstico y plan terapéutico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Exámenes solicitados</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { value: "rx_periapical", label: "Rayos X periapical" },
                    { value: "rx_ortopantomografia", label: "Ortopantomografía" },
                    { value: "biometria", label: "Biometría hemática" },
                    { value: "otro", label: "Otro" },
                  ].map((exam) => (
                    <div key={exam.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={exam.value}
                        checked={formData.plan_diagnostico.includes(exam.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateField("plan_diagnostico", [...formData.plan_diagnostico, exam.value])
                          } else {
                            updateField(
                              "plan_diagnostico",
                              formData.plan_diagnostico.filter((v: string) => v !== exam.value),
                            )
                          }
                        }}
                      />
                      <Label htmlFor={exam.value} className="cursor-pointer">
                        {exam.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Plan terapéutico (por sesiones)</Label>
                  <Button onClick={addPlanTerapeutico} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Sesión
                  </Button>
                </div>

                {formData.plan_terapeutico.map((plan: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="space-y-2">
                          <Label>Sesión #</Label>
                          <Input type="number" value={plan.sesion} readOnly className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha</Label>
                          <Input
                            type="date"
                            value={plan.fecha}
                            onChange={(e) => {
                              const newPlan = [...formData.plan_terapeutico]
                              newPlan[index].fecha = e.target.value
                              updateField("plan_terapeutico", newPlan)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Procedimiento</Label>
                          <Input
                            value={plan.procedimiento}
                            onChange={(e) => {
                              const newPlan = [...formData.plan_terapeutico]
                              newPlan[index].procedimiento = e.target.value
                              updateField("plan_terapeutico", newPlan)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dientes</Label>
                          <Input
                            value={plan.dientes_involucrados}
                            onChange={(e) => {
                              const newPlan = [...formData.plan_terapeutico]
                              newPlan[index].dientes_involucrados = e.target.value
                              updateField("plan_terapeutico", newPlan)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Observaciones</Label>
                          <Input
                            value={plan.observaciones}
                            onChange={(e) => {
                              const newPlan = [...formData.plan_terapeutico]
                              newPlan[index].observaciones = e.target.value
                              updateField("plan_terapeutico", newPlan)
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección J: Registro de sesiones */}
        {/* Sección J: Registro de sesiones */}
        <div id={getSectionId("J")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                J. Registro de sesiones / procedimientos / prescripciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={addRegistroSesion} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Registro
              </Button>

              {formData.registro_sesiones.map((sesion: any, index: number) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Input
                          type="datetime-local"
                          value={sesion.fecha}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].fecha = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedimiento</Label>
                        <Input
                          value={sesion.procedimiento}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].procedimiento = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Código (CUPS/CPT)</Label>
                        <Input
                          value={sesion.codigo}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].codigo = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Medicamentos (dosis)</Label>
                        <Input
                          value={sesion.medicamentos}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].medicamentos = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Profesional</Label>
                        <Input
                          value={sesion.profesional}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].profesional = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Observaciones</Label>
                        <Input
                          value={sesion.observaciones}
                          onChange={(e) => {
                            const newSesiones = [...formData.registro_sesiones]
                            newSesiones[index].observaciones = e.target.value
                            updateField("registro_sesiones", newSesiones)
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sección K: Observaciones finales */}
        {/* Sección K: Observaciones finales */}
        <div id={getSectionId("K")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                K. Observaciones finales / consentimiento / firma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="observaciones_finales">Observaciones finales</Label>
                <Textarea
                  id="observaciones_finales"
                  value={formData.observaciones_finales}
                  onChange={(e) => updateField("observaciones_finales", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consentimiento_informado"
                  checked={formData.consentimiento_informado}
                  onCheckedChange={(checked) => updateField("consentimiento_informado", checked)}
                />
                <Label htmlFor="consentimiento_informado" className="cursor-pointer">
                  Consentimiento informado (adjuntar/registrar)
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Firma del profesional (electrónica / imagen)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[160px] relative bg-muted/5">
                  {formData.firma_profesional ? (
                    <div className="relative w-full max-w-sm">
                      <img 
                        src={formData.firma_profesional} 
                        alt="Firma del profesional" 
                        className="max-h-32 mx-auto mix-blend-multiply"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-0 right-0 h-6 w-6 p-0 bg-white/80 hover:bg-white"
                        onClick={() => updateField("firma_profesional", null)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <FileSignature className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">No hay firma registrada</p>
                      <Button variant="outline" size="sm" onClick={() => setIsSignatureDialogOpen(true)}>
                        <FileSignature className="h-4 w-4 mr-2" />
                        Firmar Documento
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sello / código del establecimiento (imagen)</Label>
                <Input type="file" accept="image/*,application/pdf" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección L: Adjuntos */}
        {/* Sección L: Adjuntos */}
        <div id={getSectionId("L")} className={`space-y-4 ${isFullScreen ? "scroll-mt-36" : "scroll-mt-24"}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                L. Adjuntos / Documentos
              </CardTitle>
              <CardDescription>
                Escanear o adjuntar documentos relevantes (Rx, fotos intraorales, consentimiento firmado)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Paperclip className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
                <Input type="file" multiple accept="application/pdf,image/*" className="max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">Máximo 20 archivos (PDF, imágenes)</p>
              </div>

              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label>Archivos adjuntos</Label>
                  <div className="space-y-2">
                    {formData.attachments.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
         </div>
         </div>
      </div>
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Firma del Profesional</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onSave={(signatureData) => {
              updateField("firma_profesional", signatureData)
              setIsSignatureDialogOpen(false)
            }}
            onCancel={() => setIsSignatureDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
