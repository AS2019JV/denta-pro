"use client"

import { Label } from "@/components/ui/label"
import { PatientInfoCarousel } from "@/components/patient-info-carousel"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { AddPatientForm } from "@/components/add-patient-form"
import { Odontogram } from "@/components/odontogram"
import { PatientMedicalRecords } from "@/components/patient-medical-records"
import {
  Search,
  Plus,
  Download,
  Upload,
  Phone,
  Mail,
  Calendar,
  MapPin,
  FileText,
  Stethoscope,
  Bluetooth as Tooth,
  Clock,
} from "lucide-react"

interface Patient {
  id: string
  name: string
  lastName: string
  email?: string
  phone: string
  address?: string
  birthDate: string
  gender?: string
  emergencyContact?: string
  emergencyPhone?: string
  allergies?: string
  medications?: string
  medicalConditions?: string
  insuranceProvider?: string
  policyNumber?: string
  lastVisit?: string
  nextAppointment?: string
  status: "active" | "inactive"
}

const initialPatients: Patient[] = [
  {
    id: "1",
    name: "María",
    lastName: "García López",
    email: "maria.garcia@email.com",
    phone: "+34 123 456 789",
    address: "Calle Mayor 123, Madrid",
    birthDate: "1985-03-15",
    gender: "female",
    emergencyContact: "Juan García",
    emergencyPhone: "+34 987 654 321",
    allergies: "Penicilina",
    medications: "Ninguna",
    medicalConditions: "Hipertensión",
    insuranceProvider: "Sanitas",
    policyNumber: "SAN123456",
    lastVisit: "2024-01-15",
    nextAppointment: "2024-02-15",
    status: "active",
  },
  {
    id: "2",
    name: "Carlos",
    lastName: "Rodríguez Martín",
    email: "carlos.rodriguez@email.com",
    phone: "+34 234 567 890",
    address: "Avenida de la Paz 45, Barcelona",
    birthDate: "1978-07-22",
    gender: "male",
    emergencyContact: "Ana Martín",
    emergencyPhone: "+34 876 543 210",
    allergies: "Ninguna conocida",
    medications: "Aspirina",
    medicalConditions: "Diabetes tipo 2",
    insuranceProvider: "Adeslas",
    policyNumber: "ADE789012",
    lastVisit: "2024-01-20",
    nextAppointment: "2024-02-20",
    status: "active",
  },
  {
    id: "3",
    name: "Ana",
    lastName: "Fernández Silva",
    email: "ana.fernandez@email.com",
    phone: "+34 345 678 901",
    address: "Plaza del Sol 8, Valencia",
    birthDate: "1992-11-08",
    gender: "female",
    emergencyContact: "Luis Silva",
    emergencyPhone: "+34 765 432 109",
    allergies: "Látex",
    medications: "Anticonceptivos",
    medicalConditions: "Ninguna",
    insuranceProvider: "DKV",
    policyNumber: "DKV345678",
    lastVisit: "2024-01-10",
    status: "active",
  },
]

export default function PatientsPage() {
  const { t } = useTranslation()
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)
  const [isPatientDetailsOpen, setIsPatientDetailsOpen] = useState(false)

  const filteredPatients = patients.filter(
    (patient) =>
      `${patient.name} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleAddPatient = (patientData: any) => {
    const newPatient: Patient = {
      id: Date.now().toString(),
      ...patientData,
      status: "active" as const,
      lastVisit: new Date().toISOString().split("T")[0],
    }
    setPatients((prev) => [...prev, newPatient])
    setIsAddPatientOpen(false)
  }

  const exportDatabase = () => {
    const dataStr = JSON.stringify(patients, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)

    const exportFileDefaultName = `pacientes_${new Date().toISOString().split("T")[0]}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  const importDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedPatients = JSON.parse(e.target?.result as string)
          setPatients(importedPatients)
        } catch (error) {
          console.error("Error importing database:", error)
        }
      }
      reader.readAsText(file)
    }
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("patients")}>
        <div className="flex items-center space-x-2">
          <input type="file" accept=".json" onChange={importDatabase} className="hidden" id="import-file" />
          <Button variant="outline" size="sm" onClick={() => document.getElementById("import-file")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {t("import-database")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportDatabase}>
            <Download className="h-4 w-4 mr-2" />
            {t("export-database")}
          </Button>
          <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("add-patient")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>{t("add-patient")}</DialogTitle>
                <DialogDescription>Completa la información del nuevo paciente</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-120px)]">
                <AddPatientForm onSubmit={handleAddPatient} onCancel={() => setIsAddPatientOpen(false)} />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={t("search-patients")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((patient) => (
          <Card key={patient.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={`/placeholder.svg?${patient.id}`} alt={`${patient.name} ${patient.lastName}`} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {patient.name[0]}
                    {patient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">
                    {patient.name} {patient.lastName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant={patient.status === "active" ? "default" : "secondary"}>
                      {patient.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                    <span className="text-sm">{calculateAge(patient.birthDate)} años</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 mr-2" />
                  {patient.phone}
                </div>
                {patient.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 mr-2" />
                    {patient.email}
                  </div>
                )}
                {patient.lastVisit && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    Última visita: {new Date(patient.lastVisit).toLocaleDateString("es-ES")}
                  </div>
                )}
              </div>
              <Dialog
                open={isPatientDetailsOpen && selectedPatient?.id === patient.id}
                onOpenChange={(open) => {
                  setIsPatientDetailsOpen(open)
                  if (!open) setSelectedPatient(null)
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    Ver Detalles del Paciente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                  <DialogHeader className="flex-shrink-0 pb-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <DialogTitle className="text-2xl">
                      {patient.name} {patient.lastName}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-4">
                      <Badge variant={patient.status === "active" ? "default" : "secondary"}>
                        {patient.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                      <span>{calculateAge(patient.birthDate)} años</span>
                      <span>
                        {patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : "Otro"}
                      </span>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="carousel" className="h-full flex flex-col">
                      <TabsList className="grid w-full grid-cols-5 flex-shrink-0 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                        <TabsTrigger value="carousel" className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Vista Rápida
                        </TabsTrigger>
                        <TabsTrigger value="info" className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Información
                        </TabsTrigger>
                        <TabsTrigger value="medical" className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Historial Médico
                        </TabsTrigger>
                        <TabsTrigger value="odontogram" className="flex items-center gap-2">
                          <Tooth className="h-4 w-4" />
                          Odontograma
                        </TabsTrigger>
                        <TabsTrigger value="appointments" className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Citas
                        </TabsTrigger>
                      </TabsList>

                      <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full custom-scrollbar">
                          <div className="p-6 space-y-6">
                            <TabsContent value="carousel" className="mt-0">
                              <PatientInfoCarousel patient={patient} calculateAge={calculateAge} />
                            </TabsContent>

                            <TabsContent value="info" className="mt-0 space-y-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Información Personal</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Nombre</Label>
                                        <p className="text-sm">
                                          {patient.name} {patient.lastName}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">
                                          Fecha de Nacimiento
                                        </Label>
                                        <p className="text-sm">
                                          {new Date(patient.birthDate).toLocaleDateString("es-ES")}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Teléfono</Label>
                                        <p className="text-sm">{patient.phone}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">
                                          Correo Electrónico
                                        </Label>
                                        <p className="text-sm">{patient.email || "No especificado"}</p>
                                      </div>
                                    </div>
                                    {patient.address && (
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                          <MapPin className="h-4 w-4" />
                                          Dirección
                                        </Label>
                                        <p className="text-sm mt-1">{patient.address}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Información de Contacto</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {patient.emergencyContact && (
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">
                                          Contacto de Emergencia
                                        </Label>
                                        <p className="text-sm">{patient.emergencyContact}</p>
                                      </div>
                                    )}
                                    {patient.emergencyPhone && (
                                      <div>
                                        <Label className="text-sm font-medium text-muted-foreground">
                                          Teléfono de Emergencia
                                        </Label>
                                        <p className="text-sm">{patient.emergencyPhone}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Información Médica</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div>
                                      <Label className="text-sm font-medium text-muted-foreground">Alergias</Label>
                                      <p className="text-sm">{patient.allergies || "Ninguna conocida"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium text-muted-foreground">Medicamentos</Label>
                                      <p className="text-sm">{patient.medications || "Ninguna"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium text-muted-foreground">
                                        Condiciones Médicas
                                      </Label>
                                      <p className="text-sm">{patient.medicalConditions || "Ninguna"}</p>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Información del Seguro</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div>
                                      <Label className="text-sm font-medium text-muted-foreground">
                                        Proveedor de Seguro
                                      </Label>
                                      <p className="text-sm">{patient.insuranceProvider || "No especificado"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium text-muted-foreground">
                                        Número de Póliza
                                      </Label>
                                      <p className="text-sm">{patient.policyNumber || "No especificado"}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>

                            <TabsContent value="medical" className="mt-0">
                              <PatientMedicalRecords patientId={patient.id} />
                            </TabsContent>

                            <TabsContent value="odontogram" className="mt-0">
                              <Odontogram />
                            </TabsContent>

                            <TabsContent value="appointments" className="mt-0">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Citas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    {patient.lastVisit && (
                                      <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                          <p className="font-medium">Última Visita</p>
                                          <p className="text-sm text-muted-foreground">
                                            {new Date(patient.lastVisit).toLocaleDateString("es-ES")}
                                          </p>
                                        </div>
                                        <Badge variant="outline">Completada</Badge>
                                      </div>
                                    )}
                                    {patient.nextAppointment && (
                                      <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                          <p className="font-medium">Próxima Cita</p>
                                          <p className="text-sm text-muted-foreground">
                                            {new Date(patient.nextAppointment).toLocaleDateString("es-ES")}
                                          </p>
                                        </div>
                                        <Badge>Programada</Badge>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </TabsContent>
                          </div>
                        </ScrollArea>
                      </div>
                    </Tabs>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center">
              <p className="text-lg font-medium">No se encontraron pacientes</p>
              <p className="text-sm">Intenta con otros términos de búsqueda</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
