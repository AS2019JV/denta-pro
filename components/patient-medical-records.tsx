"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Plus, FileText, Calendar, Stethoscope, Pill, AlertTriangle, User } from "lucide-react"

interface PatientMedicalRecordsProps {
  patientId: string
}

export function PatientMedicalRecords({ patientId }: PatientMedicalRecordsProps) {

  const [activeTab, setActiveTab] = useState("overview")
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false)
  const [isAddTreatmentOpen, setIsAddTreatmentOpen] = useState(false)

  // Form states
  const [newNote, setNewNote] = useState({ type: "Consulta", content: "" })
  const [newTreatment, setNewTreatment] = useState({ tooth: "", treatment: "", status: "Programado", notes: "" })


  // Mock data state
  const [data, setData] = useState({
    allergies: ["Penicilina", "Látex"],
    medications: ["Lisinopril 10mg", "Atorvastatin 20mg"],
    conditions: ["Hipertensión", "Colesterol Alto"],
    notes: [
      {
        id: "1",
        date: "2024-01-15",
        type: "Consulta",
        content: "Paciente acude para limpieza regular. Sin complicaciones.",
        doctor: "Dra. María González",
      },
      {
        id: "2",
        date: "2024-01-10",
        type: "Tratamiento",
        content: "Empaste en molar superior derecho. Anestesia local aplicada sin complicaciones.",
        doctor: "Dr. Carlos Ruiz",
      },
    ],
    treatments: [
      {
        id: "1",
        date: "2024-01-15",
        tooth: "16",
        treatment: "Limpieza",
        status: "Completado",
        notes: "Limpieza profunda realizada",
        doctor: "Dra. María González",
      },
      {
        id: "2",
        date: "2024-01-10",
        tooth: "26",
        treatment: "Empaste",
        status: "Completado",
        notes: "Empaste de composite",
        doctor: "Dr. Carlos Ruiz",
      },
    ],
  })

  const handleSaveNote = () => {
    const note = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: newNote.type,
      content: newNote.content,
      doctor: "Dr. Actual", // In a real app, get from auth context
    }
    
    setData(prev => ({
      ...prev,
      notes: [note, ...prev.notes]
    }))
    setNewNote({ type: "Consulta", content: "" })
    setIsAddNoteOpen(false)
  }

  const handleSaveTreatment = () => {
    const treatment = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      tooth: newTreatment.tooth,
      treatment: newTreatment.treatment,
      status: newTreatment.status,
      notes: newTreatment.notes,
      doctor: "Dr. Actual",
    }

    setData(prev => ({
      ...prev,
      treatments: [treatment, ...prev.treatments]
    }))
    setNewTreatment({ tooth: "", treatment: "", status: "Programado", notes: "" })
    setIsAddTreatmentOpen(false)
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="treatments">Tratamientos</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>

        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="bg-red-50/50 dark:bg-red-900/10 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  Alergias
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {data.allergies.map((allergy, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="bg-red-50/50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800"
                    >
                      {allergy}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Medicamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {data.medications.map((medication, index) => (
                    <div key={index} className="text-sm">
                      {medication}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-primary/5 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Condiciones
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {data.conditions.map((condition, index) => (
                    <Badge key={index} variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Notas Clínicas</h3>
            <Button size="sm" onClick={() => setIsAddNoteOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          </div>
          <div className="space-y-4">
            {data.notes.map((note) => (
              <Card key={note.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {note.type}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                       <Badge variant="secondary" className="gap-1 font-normal">
                          <User className="h-3 w-3" />
                          {note.doctor}
                       </Badge>
                       <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(note.date).toLocaleDateString("es-ES")}
                       </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{note.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="treatments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Tratamientos</h3>
            <Button size="sm" onClick={() => setIsAddTreatmentOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tratamiento
            </Button>
          </div>
          <div className="space-y-4">
            {data.treatments.map((treatment) => (
              <Card key={treatment.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {treatment.treatment} - Diente {treatment.tooth}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground border-dashed">
                          <User className="h-3 w-3" />
                          {treatment.doctor}
                      </Badge>
                      <Badge variant={treatment.status === "Completado" ? "default" : "secondary"}>
                        {treatment.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(treatment.date).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{treatment.notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial Completo</CardTitle>
              <CardDescription>Cronología de todas las visitas y tratamientos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-4 top-6 bottom-0 w-0.5 bg-border"></div>
                  {[
                    ...data.notes,
                    ...data.treatments.map((t) => ({
                      id: t.id,
                      date: t.date,
                      type: t.treatment,
                      content: `${t.treatment} en diente ${t.tooth}. ${t.notes}`,
                      doctor: t.doctor,
                    })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item, index) => (
                      <div key={item.id} className="relative flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">{item.type}</p>
                            <Badge variant="outline" className="scale-90 origin-right gap-1 font-normal text-muted-foreground border-transparent bg-muted/50">
                                <User className="h-3 w-3" />
                                {item.doctor}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                              {new Date(item.date).toLocaleDateString("es-ES")}
                          </p>
                          <p className="text-sm text-muted-foreground">{item.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>


      <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Nota Clínica</DialogTitle>
            <DialogDescription>Agregue una nueva nota al historial médico del paciente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newNote.type} onValueChange={(v) => setNewNote({...newNote, type: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consulta">Consulta</SelectItem>
                  <SelectItem value="Urgencia">Urgencia</SelectItem>
                  <SelectItem value="Seguimiento">Seguimiento</SelectItem>
                  <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea 
                placeholder="Escriba los detalles de la nota..." 
                value={newNote.content}
                onChange={(e) => setNewNote({...newNote, content: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddNoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNote}>Guardar Nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTreatmentOpen} onOpenChange={setIsAddTreatmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Tratamiento</DialogTitle>
            <DialogDescription>Registre un nuevo tratamiento dental</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Diente</Label>
                <Input 
                  placeholder="Ej. 18, 24..." 
                  value={newTreatment.tooth}
                  onChange={(e) => setNewTreatment({...newTreatment, tooth: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={newTreatment.status} onValueChange={(v) => setNewTreatment({...newTreatment, status: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Programado">Programado</SelectItem>
                    <SelectItem value="En Progreso">En Progreso</SelectItem>
                    <SelectItem value="Completado">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tratamiento</Label>
              <Input 
                placeholder="Ej. Limpieza, Endodoncia..." 
                value={newTreatment.treatment}
                onChange={(e) => setNewTreatment({...newTreatment, treatment: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas Adicionales</Label>
              <Textarea 
                placeholder="Detalles del procedimiento..." 
                value={newTreatment.notes}
                onChange={(e) => setNewTreatment({...newTreatment, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTreatmentOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTreatment}>Guardar Tratamiento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
