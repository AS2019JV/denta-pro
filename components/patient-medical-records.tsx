"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/components/translations"
import { Plus, FileText, Calendar, Stethoscope, Pill, AlertTriangle } from "lucide-react"

interface PatientMedicalRecordsProps {
  patientId: string
}

export function PatientMedicalRecords({ patientId }: PatientMedicalRecordsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState("overview")

  // Mock data - in a real app, this would come from an API
  const medicalData = {
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
        doctor: "Dra. María González",
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
      },
      {
        id: "2",
        date: "2024-01-10",
        tooth: "26",
        treatment: "Empaste",
        status: "Completado",
        notes: "Empaste de composite",
      },
    ],
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
                  {t("allergies")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {medicalData.allergies.map((allergy, index) => (
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
                  {t("medications")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {medicalData.medications.map((medication, index) => (
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
                  {medicalData.conditions.map((condition, index) => (
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
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          </div>
          <div className="space-y-4">
            {medicalData.notes.map((note) => (
              <Card key={note.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {note.type}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(note.date).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <CardDescription>Por: {note.doctor}</CardDescription>
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
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tratamiento
            </Button>
          </div>
          <div className="space-y-4">
            {medicalData.treatments.map((treatment) => (
              <Card key={treatment.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {treatment.treatment} - Diente {treatment.tooth}
                    </CardTitle>
                    <div className="flex items-center gap-2">
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
                    ...medicalData.notes,
                    ...medicalData.treatments.map((t) => ({
                      id: t.id,
                      date: t.date,
                      type: t.treatment,
                      content: `${t.treatment} en diente ${t.tooth}. ${t.notes}`,
                      doctor: "Dra. María González",
                    })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item, index) => (
                      <div key={item.id} className="relative flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{item.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.date).toLocaleDateString("es-ES")}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  )
}
