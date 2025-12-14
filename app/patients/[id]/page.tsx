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
  FileText, Stethoscope, Clock, User, Loader2, Receipt
} from "lucide-react"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle, 
} from "@/components/ui/dialog"
import { AddPatientForm } from "@/components/add-patient-form"
import { PatientFiles } from "@/components/patient-files"
import { PatientMedicalRecords } from "@/components/patient-medical-records"
import { HCU033Form } from "@/components/hcu033-form"
import { AvatarUpload } from "@/components/avatar-upload"

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
  avatar_url?: string
}

export default function PatientDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isHCUOpen, setIsHCUOpen] = useState(false)
  const [hcuData, setHcuData] = useState<any>(null)

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
              status: data.status || 'active',
              avatar_url: data.avatar_url,
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

  const handleUpdatePatient = async (updatedData: any) => {
    if (!patient) return
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          first_name: updatedData.name,
          last_name: updatedData.lastName,
          email: updatedData.email,
          phone: updatedData.phone,
          address: updatedData.address,
          birth_date: updatedData.birthDate,
          gender: updatedData.gender,
          emergency_contact: updatedData.emergencyContact,
          emergency_phone: updatedData.emergencyPhone,
          allergies: updatedData.allergies,
          medications: updatedData.medications,
          medical_conditions: updatedData.medicalConditions,
          insurance_provider: updatedData.insuranceProvider,
          policy_number: updatedData.policyNumber
        })
        .eq('id', patient.id)
      
      if (error) throw error
      
      setPatient({ ...patient, ...updatedData })
      setIsEditOpen(false)
    } catch (e) {
      console.error("Error updating patient", e)
    }
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
                      <AvatarUpload
                        uid={patient.id}
                        url={patient.avatar_url || null}
                        bucket="patient-avatars"
                        size={96}
                        fallbackName={`${patient.name} ${patient.lastName}`}
                        onUpload={async (url) => {
                           // Update patient record with new avatar url
                           await supabase.from('patients').update({ avatar_url: url }).eq('id', patient.id)
                           setPatient(prev => prev ? ({ ...prev, avatar_url: url }) : null)
                        }}
                      />
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
                      <Button variant="outline" className="flex-1 md:flex-none" onClick={() => router.push(`/messages?userId=${patient.id}`)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Mensaje
                      </Button>
                      <Button className="flex-1 md:flex-none" onClick={() => setIsEditOpen(true)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      
                      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                               <DialogTitle>Editar Paciente</DialogTitle>
                               <DialogDescription>Actualizar información del paciente</DialogDescription>
                            </DialogHeader>
                            <AddPatientForm 
                               initialData={patient} 
                               onSubmit={handleUpdatePatient} 
                               onCancel={() => setIsEditOpen(false)} 
                            />
                         </DialogContent>
                      </Dialog>
                    </div>
                </div>
          </div>

          {/* Tabs Section */}
          <div className="flex-1 overflow-hidden flex flex-col bg-muted/10">
             <Tabs defaultValue="info" className="flex flex-col h-full">
                <div className="flex-none bg-background border-b px-6">
                    <div className="max-w-7xl mx-auto w-full">
                        <TabsList className="h-auto p-0 bg-transparent gap-8">
                            {['info', 'medical', 'hcu033', 'appointments', 'files'].map((tab) => (
                                <TabsTrigger 
                                    key={tab}
                                    value={tab}
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-4 px-0 text-muted-foreground data-[state=active]:text-primary font-medium transition-all"
                                >
                                    {tab === 'info' && "Perfil"}
                                    {tab === 'medical' && "Historial Médico"}
                                    {tab === 'hcu033' && "HCU-033"}
                                    {tab === 'appointments' && "Citas"}
                                    {tab === 'files' && (
                                      <div className="flex items-center gap-2">
                                        Archivos
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">3</Badge>
                                      </div>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="max-w-7xl mx-auto p-6 space-y-6">
                            <TabsContent value="files" className="mt-0 focus-visible:ring-0">
                                <PatientFiles />
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

                            <TabsContent value="hcu033" className="mt-0 focus-visible:ring-0">
                                <HCU033Form 
                                    patientId={patient.id} 
                                    patientName={`${patient.name} ${patient.lastName}`} 
                                    onExpand={(currentData) => {
                                      setHcuData(currentData)
                                      setIsHCUOpen(true)
                                    }}
                                    externalData={hcuData}
                                    onDataChange={setHcuData}
                                />
                            </TabsContent>

                            <TabsContent value="appointments" className="mt-0 focus-visible:ring-0">
                                <AppointmentsList patientId={patient.id} />
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </div>
             </Tabs>
          </div>
      </div>

      
      {isHCUOpen && patient && (
          <HCU033Form 
            patientId={patient!.id} 
            patientName={`${patient!.name} ${patient!.lastName}`} 
            isFullScreen={true}
            onClose={() => setIsHCUOpen(false)}
            externalData={hcuData}
            onDataChange={setHcuData}
          />
      )}
    </div>
  )
}

function AppointmentsList({ patientId }: { patientId: string }) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      const { data: apps, error } = await supabase
        .from('appointments')
        .select(`
          *,
          billings (
            id,
            amount,
            status,
            invoice_number
          )
        `)
        .eq('patient_id', patientId)
        .order('start_time', { ascending: false })

      if (apps) {
        setAppointments(apps)
      }
      setLoading(false)
    }

    fetchHistory()
  }, [patientId])

  if (loading) return <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No hay historial de citas.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Historial de Citas e Inversión</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {appointments.map((app) => {
            const billing = app.billings?.[0]
            return (
              <div key={app.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-full ${app.status === 'confirmed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{app.type || 'Consulta General'}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      {new Date(app.start_time).toLocaleDateString("es-ES", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      {' • '}
                      {new Date(app.start_time).toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                   {billing ? (
                     <div className="text-right mr-2">
                        <div className="flex items-center gap-1 text-sm font-medium">
                           <Receipt className="h-3.5 w-3.5 text-muted-foreground"/>
                           <span>Factura #{billing.invoice_number?.slice(-6) || '---'}</span>
                        </div>
                        <Badge variant={billing.status === 'paid' ? 'default' : 'outline'} className="mt-1 text-xs">
                           ${billing.amount} - {billing.status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                     </div>
                   ) : (
                     <Badge variant="secondary" className="mr-2">Sin Factura</Badge>
                   )}
                   
                   <Badge 
                     variant={app.status === 'confirmed' || app.status === 'completed' ? 'default' : 'secondary'}
                     className={app.status === 'no_show' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''}
                   >
                     {app.status === 'confirmed' ? 'Confirmada' : 
                      app.status === 'completed' ? 'Completada' :
                      app.status === 'no_show' ? 'No Asistió' : 
                      'Programada'}
                   </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
