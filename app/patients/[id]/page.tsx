"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/components/translations"
import { 
  ArrowLeft, Calendar, Phone, Mail, MapPin, 
  FileText, Stethoscope, Clock, User, Loader2
} from "lucide-react"

// Import custom components
import { PatientInfoCarousel } from "@/components/patient-info-carousel"
import { PatientMedicalRecords } from "@/components/patient-medical-records"
import { HCU033Form } from "@/components/hcu033-form"

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

export default function PatientDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPatient = async () => {
      // Handle params.id being string or array
      const id = Array.isArray(params.id) ? params.id[0] : params.id
      if (!id) return
      
      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        if (data) {
           const mappedPatient: Patient = {
              id: data.id,
              name: data.first_name,
              lastName: data.last_name,
              email: data.email,
              phone: data.phone,
              address: data.address,
              birthDate: data.birth_date,
              gender: data.gender,
              emergencyContact: data.emergency_contact,
              emergencyPhone: data.emergency_phone,
              allergies: data.allergies,
              medications: data.medications,
              medicalConditions: data.medical_conditions,
              insuranceProvider: data.insurance_provider,
              policyNumber: data.policy_number,
              lastVisit: data.last_visit,
              nextAppointment: data.next_appointment,
              status: data.status || 'active'
           }
           setPatient(mappedPatient)
        }
      } catch (e) {
        console.error("Error fetching patient", e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPatient()
  }, [params.id])

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

  if (isLoading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  if (!patient) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
              <p className="text-lg font-medium text-muted-foreground">Paciente no encontrado</p>
              <Button onClick={() => router.push('/patients')}>Volver a Pacientes</Button>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground animate-in fade-in duration-300">
      {/* Top Navigation Bar */}
      <div className="flex-none border-b bg-card px-6 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/patients')} className="-ml-3 gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
          {/* Patient Header Section */}
          <div className="flex-none bg-card border-b p-6 shadow-sm z-10">
                <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                     <div className="flex items-center gap-5">
                      <Avatar className="h-20 w-20 border-4 border-background shadow-md">
                        <AvatarImage src={`/placeholder.svg?${patient.id}`} alt={`${patient.name} ${patient.lastName}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {patient.name[0]}
                          {patient.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                          {patient.name} {patient.lastName}
                          <Badge variant={patient.status === "active" ? "default" : "secondary"} className="text-sm px-2.5 py-0.5">
                            {patient.status === "active" ? "Activo" : "Inactivo"}
                          </Badge>
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 opacity-70" />
                            {new Date(patient.birthDate).toLocaleDateString("es-ES")} ({calculateAge(patient.birthDate)} años)
                          </span>
                          <span className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${patient.gender === 'male' ? 'bg-blue-400' : 'bg-pink-400'}`} />
                            {patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : "Otro"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-4 w-4 opacity-70" />
                            {patient.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <Button variant="outline" className="flex-1 md:flex-none">
                        <Mail className="h-4 w-4 mr-2" />
                        Mensaje
                      </Button>
                      <Button className="flex-1 md:flex-none">
                        <FileText className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                </div>
          </div>

          {/* Tabs Section */}
          <div className="flex-1 overflow-hidden flex flex-col bg-muted/10">
             <Tabs defaultValue="info" className="flex flex-col h-full">
                <div className="flex-none bg-background border-b px-6">
                    <div className="max-w-7xl mx-auto w-full">
                        <TabsList className="h-auto p-0 bg-transparent gap-8">
                            {['info', 'medical', 'odontogram', 'appointments', 'carousel'].map((tab) => (
                                <TabsTrigger 
                                    key={tab}
                                    value={tab} 
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-4 px-0 text-muted-foreground data-[state=active]:text-primary font-medium transition-all"
                                >
                                    {tab === 'info' && "Información"}
                                    {tab === 'medical' && "Historial Médico"}
                                    {tab === 'odontogram' && "Odontograma"}
                                    {tab === 'appointments' && "Citas"}
                                    {tab === 'carousel' && "Archivos"}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="max-w-7xl mx-auto p-6 space-y-6">
                            <TabsContent value="carousel" className="mt-0 focus-visible:ring-0">
                                <PatientInfoCarousel patient={patient} calculateAge={calculateAge} />
                            </TabsContent>

                            <TabsContent value="info" className="mt-0 space-y-6 focus-visible:ring-0">
                                {/* Personal & Contact Section */}
                                <div className="bg-card rounded-xl border shadow-sm p-6">
                                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                                            <User className="h-5 w-5" />
                                        </div>
                                        Información Personal y Contacto
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre Completo</Label>
                                            <p className="text-base font-medium text-foreground">{patient.name} {patient.lastName}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Nacimiento</Label>
                                            <p className="text-base font-medium text-foreground">{new Date(patient.birthDate).toLocaleDateString("es-ES")}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teléfono</Label>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-base font-medium text-foreground">{patient.phone}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-base font-medium text-foreground">{patient.email || "No registrado"}</p>
                                            </div>
                                        </div>
                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dirección</Label>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-base font-medium text-foreground">{patient.address || "No registrada"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="bg-card rounded-xl border shadow-sm p-6">
                                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                        <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        Contacto de Emergencia
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</Label>
                                            <p className="text-base font-medium text-foreground">{patient.emergencyContact || "No especificado"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teléfono</Label>
                                            <p className="text-base font-medium text-foreground">{patient.emergencyPhone || "No especificado"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Medical & Insurance */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-card rounded-xl border shadow-sm p-6">
                                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                                                <Stethoscope className="h-5 w-5" />
                                            </div>
                                            Datos Médicos
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alergias</Label>
                                                <div>
                                                    {patient.allergies ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                                                            {patient.allergies}
                                                        </span>
                                                    ) : (
                                                        <span className="text-base text-muted-foreground">Ninguna conocida</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condiciones</Label>
                                                <p className="text-base font-medium text-foreground">{patient.medicalConditions || "Ninguna"}</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medicamentos</Label>
                                                <p className="text-base font-medium text-foreground">{patient.medications || "Ninguna"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card rounded-xl border shadow-sm p-6">
                                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            Seguro Médico
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proveedor</Label>
                                                <p className="text-base font-medium text-foreground">{patient.insuranceProvider || "Privado"}</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nº Póliza</Label>
                                                <p className="text-base font-medium font-mono text-foreground">{patient.policyNumber || "N/A"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="medical" className="mt-0 focus-visible:ring-0">
                                <PatientMedicalRecords patientId={patient.id} />
                            </TabsContent>

                            <TabsContent value="odontogram" className="mt-0 focus-visible:ring-0">
                                <HCU033Form patientId={patient.id} patientName={`${patient.name} ${patient.lastName}`} />
                            </TabsContent>

                            <TabsContent value="appointments" className="mt-0 focus-visible:ring-0">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-xl">Historial de Citas</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {patient.lastVisit && (
                                                <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                                                    <div>
                                                        <p className="font-semibold text-foreground">Última Visita</p>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {new Date(patient.lastVisit).toLocaleDateString("es-ES")}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800">Completada</Badge>
                                                </div>
                                            )}
                                            {patient.nextAppointment && (
                                                <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                                                    <div>
                                                        <p className="font-semibold text-foreground">Próxima Cita</p>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {new Date(patient.nextAppointment).toLocaleDateString("es-ES")}
                                                        </p>
                                                    </div>
                                                    <Badge className="bg-primary text-primary-foreground">Programada</Badge>
                                                </div>
                                            )}
                                            {!patient.lastVisit && !patient.nextAppointment && (
                                                <p className="text-muted-foreground text-center py-8">No hay citas registradas</p>
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
      </div>
    </div>
  )
}
