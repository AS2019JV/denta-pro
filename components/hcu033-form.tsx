"use client"

import { useState, useEffect } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "lucide-react"

interface HCU033FormProps {
  patientId: string
  patientName?: string
  onSave?: (data: any) => void
  isFullScreen?: boolean
  onClose?: () => void
}

export function HCU033Form({ patientId, patientName, onSave, isFullScreen, onClose }: HCU033FormProps) {
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

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

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
    if (patientId) {
      loadFormData()
    }
  }, [patientId])

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
        setFormData(data.form_data)
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
      
      console.log("Formulario guardado exitosamente")
      onSave?.(formData)
    } catch (error) {
      console.error('Error saving form:', error)
      // Show error toast
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`space-y-6 relative ${isFullScreen ? 'bg-background min-h-screen' : ''}`}>
      <div className={isFullScreen 
        ? "fixed top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-4 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2" 
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
            <div>
            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">HCU-033</h2>
                <Badge variant="outline" className="font-normal">Historia Clínica Odontológica</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Formulario oficial del MSP - Ecuador</p>
            </div>
        )}

        <div className="flex gap-2 w-full md:w-auto md:ml-auto justify-end">
          <Button variant="outline" size="sm" className="h-9">
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

      <div className={isFullScreen ? "pt-20 px-6 pb-10 max-w-7xl mx-auto" : ""}>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <div className="w-full overflow-x-auto pb-2 -mx-2 px-2">
            <TabsList className="inline-flex w-auto h-auto p-1 bg-muted/20">
              <TabsTrigger value="A" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">A. Datos</TabsTrigger>
              <TabsTrigger value="B" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">B. Motivo</TabsTrigger>
              <TabsTrigger value="C" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">C. Enfermedad</TabsTrigger>
              <TabsTrigger value="D" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">D. Antecedentes</TabsTrigger>
              <TabsTrigger value="E" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">E. Signos Vitales</TabsTrigger>
              <TabsTrigger value="F" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">F. Examen</TabsTrigger>
              <TabsTrigger value="G" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">G. Odontograma</TabsTrigger>
              <TabsTrigger value="H" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">H. Diagnósticos</TabsTrigger>
              <TabsTrigger value="I" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">I. Plan</TabsTrigger>
              <TabsTrigger value="J" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">J. Sesiones</TabsTrigger>
              <TabsTrigger value="K" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">K. Firma</TabsTrigger>
              <TabsTrigger value="L" className="px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">L. Adjuntos</TabsTrigger>
            </TabsList>
        </div>

        {/* Sección A: Datos del establecimiento y paciente */}
        <TabsContent value="A" className="space-y-4">
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
        </TabsContent>

        {/* Sección B: Motivo de consulta */}
        <TabsContent value="B" className="space-y-4">
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
        </TabsContent>

        {/* Sección C: Enfermedad actual */}
        <TabsContent value="C" className="space-y-4">
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
        </TabsContent>

        {/* Sección D: Antecedentes */}
        <TabsContent value="D" className="space-y-4">
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
        </TabsContent>

        {/* Sección E: Signos vitales */}
        <TabsContent value="E" className="space-y-4">
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
        </TabsContent>

        {/* Sección F: Examen estomatognático */}
        <TabsContent value="F" className="space-y-4">
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
        </TabsContent>

        {/* Sección G: Odontograma */}
        <TabsContent value="G" className="space-y-4">
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
                onChange={(data) => updateField("odontograma_data", data)}
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
        </TabsContent>

        {/* Sección H: Diagnósticos */}
        <TabsContent value="H" className="space-y-4">
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
        </TabsContent>

        {/* Sección I: Plan terapéutico */}
        <TabsContent value="I" className="space-y-4">
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
        </TabsContent>

        {/* Sección J: Registro de sesiones */}
        <TabsContent value="J" className="space-y-4">
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
        </TabsContent>

        {/* Sección K: Observaciones finales */}
        <TabsContent value="K" className="space-y-4">
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
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Área de firma digital</p>
                  <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                    Firmar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sello / código del establecimiento (imagen)</Label>
                <Input type="file" accept="image/*,application/pdf" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sección L: Adjuntos */}
        <TabsContent value="L" className="space-y-4">
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
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
