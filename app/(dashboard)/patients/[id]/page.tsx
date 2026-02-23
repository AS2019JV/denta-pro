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
  FileText, Stethoscope, Clock, User, Loader2, Receipt,
  AlertTriangle, Heart, ShieldAlert, CreditCard, RefreshCcw, Search,
  MessageCircle, Crown, ShieldCheck, Sparkles, User as UserIcon, Users
} from "lucide-react"
import { getWhatsAppUrl, getClinicWhatsAppMessage } from "@/lib/communication"
import { calculateProfileCompletion, getCompletionColor, getCompletionLabel, getPatientLoyaltyStatus, getLoyaltyBadgeData } from "@/lib/patient-utils"
import { useAuth } from "@/components/auth-context"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
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
import { PatientPayments } from "@/components/patient-payments"
import { PatientPrescriptions } from "@/components/patient-prescriptions"
import { FamilyCenter } from "@/components/family-center"
import { OdontogramPreview } from "@/components/odontogram-preview"

const LoyaltyIcon = ({ name, className }: { name: string, className?: string }) => {
  switch (name) {
    case 'Crown': return <Crown className={cn("h-4 w-4 mr-1.5", className)} />;
    case 'ShieldCheck': return <ShieldCheck className={cn("h-4 w-4 mr-1.5", className)} />;
    case 'Sparkles': return <Sparkles className={cn("h-4 w-4 mr-1.5", className)} />;
    default: return <UserIcon className={cn("h-4 w-4 mr-1.5", className)} />;
  }
}

interface Patient {
  id: string
  name: string
  lastName: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  birthDate: string
  gender?: string
  occupation?: string
  guardianName?: string
  referralSource?: string
  referredBy?: string
  medicalRecordNumber?: string
  clinicalNotes?: string
  emergencyContact?: string
  emergencyPhone?: string
  allergies?: string
  medications?: string
  medicalConditions?: string
  insuranceProvider?: string
  policyNumber?: string
  bloodType?: string
  maritalStatus?: string
  hasDiabetes?: boolean
  hasHypertension?: boolean
  hasHeartDisease?: boolean
  isSmoker?: boolean
  isPregnant?: boolean
  preferredContactMethod?: string
  recallMonths?: number
  accountBalance?: number
  internalNotes?: string
  lastVisit?: string
  nextAppointment?: string
  status: "active" | "inactive"
  avatar_url?: string
  appointments_count?: number
  total_billed?: number
  family_representative_id?: string
  family_relationship?: string
  is_family_head?: boolean
  last_treatment_note?: string
  odontogram_state?: any
}

export default function PatientDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { user, currentClinicId } = useAuth()
  
  const currentClinic = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)?.clinics
  const clinicName = currentClinic?.name || "su Clínica Dental"
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
        
        // Use standard query instead of RPC to avoid JWT dependency for clinic_id
        // which can be missing in some session states
        const { data, error } = await supabase.rpc('get_patients_with_stats', {
           p_clinic_id: currentClinicId,
           p_patient_id: id,
           p_limit: 1
        })

        if (error) {
           console.error(`[PatientDetails] Fetch error for ID ${id}:`, error.message);
           throw error;
        }

        if (data && data.length > 0) {
           const d = data[0] as any
           const mappedPatient: Patient = {
              id: d.id,
              name: d.first_name,
              lastName: d.last_name,
              email: d.email,
              phone: d.phone,
              address: d.address,
              birthDate: d.birth_date,
              gender: d.gender,
              occupation: d.occupation,
              guardianName: d.guardian_name,
              referralSource: d.referral_source,
              referredBy: d.referred_by,
              medicalRecordNumber: d.medical_record_number,
              clinicalNotes: d.clinical_notes,
              emergencyContact: d.emergency_contact,
              emergencyPhone: d.emergency_phone,
              last_treatment_note: d.last_treatment_note,
              odontogram_state: d.odontogram_state,
              allergies: d.allergies,
              medications: d.medications,
              medicalConditions: d.medical_conditions,
              insuranceProvider: d.insurance_provider,
              policyNumber: d.policy_number,
              bloodType: d.blood_type,
              maritalStatus: d.marital_status,
              hasDiabetes: d.has_diabetes,
              hasHypertension: d.has_hypertension,
              hasHeartDisease: d.has_heart_disease,
              isSmoker: d.is_smoker,
              isPregnant: d.is_pregnant,
              preferredContactMethod: d.preferred_contact_method,
              recallMonths: d.recall_months,
              accountBalance: d.account_balance,
              internalNotes: d.internal_notes,
              city: d.city,
              state: d.state,
              lastVisit: d.last_visit,
              nextAppointment: d.next_appointment,
              status: d.status || 'active',
              avatar_url: d.avatar_url,
              family_representative_id: d.family_representative_id,
              family_relationship: d.family_relationship,
              is_family_head: d.is_family_head,
              appointments_count: Number(d.appointments_count) || 0,
              total_billed: Number(d.total_billed) || 0,
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
          occupation: updatedData.occupation,
          guardian_name: updatedData.guardianName,
          referral_source: updatedData.referralSource,
          referred_by: updatedData.referredBy,
          medical_record_number: updatedData.medicalRecordNumber,
          clinical_notes: updatedData.clinicalNotes,
          emergency_contact: updatedData.emergencyContact,
          emergency_phone: updatedData.emergencyPhone,
          allergies: updatedData.allergies,
          medications: updatedData.medications,
          medical_conditions: updatedData.medicalConditions,
          insurance_provider: updatedData.insuranceProvider,
          policy_number: updatedData.policyNumber,
          blood_type: updatedData.bloodType,
          marital_status: updatedData.maritalStatus,
          city: updatedData.city,
          state: updatedData.state,
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
          {/* Medical Alert Center (Pro Feature) */}
          {patient && (patient.hasDiabetes || patient.hasHypertension || patient.hasHeartDisease || patient.allergies) && (
            <div className="bg-rose-50 border-b border-rose-100 px-6 py-2 flex items-center gap-4 animate-in slide-in-from-top duration-500 shadow-sm">
               <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <ShieldAlert className="h-4 w-4 animate-pulse" />
                  ALERTA MÉDICA:
               </div>
               <div className="flex flex-wrap gap-2">
                  {patient.hasDiabetes && <Badge className="bg-rose-600 hover:bg-rose-700">DIABETES</Badge>}
                  {patient.hasHypertension && <Badge className="bg-rose-600 hover:bg-rose-700">HIPERTENSIÓN</Badge>}
                  {patient.hasHeartDisease && <Badge className="bg-rose-600 hover:bg-rose-700">CARDIOPATÍA</Badge>}
                  {patient.isPregnant && <Badge className="bg-pink-500 hover:bg-pink-600">EMBARAZO</Badge>}
                  {patient.allergies && (
                    <span className="text-sm font-semibold text-rose-700"> ⚠️ ALERGIAS: {patient.allergies}</span>
                  )}
               </div>
            </div>
          )}

          {/* Data Quality Score (Gamification) */}
          {patient && (
             <div className="bg-card px-6 py-2 border-b flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 flex-1 max-w-md">
                   <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Calidad del Expediente
                   </div>
                   <div className="flex-1">
                      <Progress value={calculateProfileCompletion(patient)} className="h-1.5" indicatorClassName={getCompletionColor(calculateProfileCompletion(patient))} />
                   </div>
                   <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                      calculateProfileCompletion(patient) >= 80 ? "bg-green-100 text-green-700" :
                      calculateProfileCompletion(patient) >= 50 ? "bg-blue-100 text-blue-700" :
                      "bg-rose-100 text-rose-700"
                   }`}>
                      {getCompletionLabel(calculateProfileCompletion(patient))} {calculateProfileCompletion(patient)}%
                   </div>
                </div>
                <div className="hidden md:block text-[10px] text-muted-foreground italic">
                   Complete todos los campos para alcanzar el 100% y mejorar la seguridad clínica.
                </div>
             </div>
          )}

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
                          
                          {(() => {
                             const currentClinic = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)?.clinics;
                             const status = getPatientLoyaltyStatus(patient.appointments_count, patient.total_billed, currentClinic?.settings);
                             const badgeData = getLoyaltyBadgeData(status.key, status.style);
                             return (
                               <Badge 
                                 className={cn(
                                   "text-sm px-2.5 py-0.5 border uppercase flex items-center transition-all",
                                   badgeData.className
                                 )}
                               >
                                 <LoyaltyIcon name={badgeData.iconName} />
                                 {status.label}
                               </Badge>
                             )
                          })()}
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
                          <button 
                            className="flex items-center gap-1.5 hover:text-green-600 transition-colors"
                            onClick={() => window.open(getWhatsAppUrl(patient.phone || "", getClinicWhatsAppMessage(patient.name, clinicName)), "_blank")}
                          >
                            <MessageCircle className="h-4 w-4 opacity-70 text-green-500" />
                            {patient.phone}
                          </button>
                        </div>
                         
                         {/* Last Treatment Note & Odontogram Preview */}
                         {(patient.last_treatment_note || patient.odontogram_state) && (
                            <div className="flex items-center gap-4 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner animate-in fade-in slide-in-from-left-2">
                               <div className="flex flex-col gap-1 pr-4 border-r border-slate-200">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último Tratamiento</span>
                                  <p className="text-sm font-bold text-slate-700 truncate max-w-[300px]">
                                     {patient.last_treatment_note || "Sin notas recientes"}
                                  </p>
                               </div>
                               <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Dental (Vista Rápida)</span>
                                  <OdontogramPreview data={patient.odontogram_state || {}} size="sm" />
                               </div>
                            </div>
                         )}
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <Button 
                        variant="outline" 
                        className="flex-1 md:flex-none border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                        onClick={() => window.open(getWhatsAppUrl(patient.phone || "", getClinicWhatsAppMessage(patient.name, clinicName)), "_blank")}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                      <Button className="flex-1 md:flex-none shadow-sm hover:shadow-md transition-all" onClick={() => setIsEditOpen(true)}>
                        <UserIcon className="h-4 w-4 mr-2" />
                        Editar Perfil
                      </Button>

                      {patient && (
                        <FamilyCenter 
                          patientId={patient.id} 
                          patientName={`${patient.name} ${patient.lastName}`} 
                        />
                      )}
                      
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
                            {['info', 'medical', 'hcu033', 'appointments', 'recipes', 'payments', 'files'].map((tab) => (
                                <TabsTrigger 
                                    key={tab}
                                    value={tab}
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-4 px-0 text-muted-foreground data-[state=active]:text-primary font-medium transition-all"
                                >
                                    {tab === 'info' && "Perfil"}
                                    {tab === 'medical' && "Historial Médico"}
                                    {tab === 'hcu033' && "HCU-033"}
                                    {tab === 'appointments' && "Citas"}
                                    {tab === 'recipes' && "Recetas / Prescripciones"}
                                    {tab === 'payments' && "Pagos"}
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

                            <TabsContent value="payments" className="mt-0 focus-visible:ring-0">
                                <PatientPayments patientId={patient.id} />
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
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nº Historia Clínica</Label>
                                            <p className="text-base font-medium font-mono text-foreground">{patient.medicalRecordNumber || "---"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre Completo</Label>
                                            <p className="text-base font-medium text-foreground">{patient.name} {patient.lastName}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ocupación</Label>
                                            <p className="text-base font-medium text-foreground">{patient.occupation || "---"}</p>
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
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado Civil</Label>
                                            <p className="text-base font-medium text-foreground capitalize">{patient.maritalStatus || "---"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grupo Sanguíneo</Label>
                                            <Badge variant="outline" className="text-sm font-medium border-rose-200 text-rose-700 bg-rose-50">
                                                {patient.bloodType || "---"}
                                            </Badge>
                                        </div>
                                        <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dirección</Label>
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div className="space-y-1">
                                                    <p className="text-base font-medium text-foreground">{patient.address || "No registrada"}</p>
                                                    {(patient.city || patient.state) && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {patient.city}{patient.city && patient.state ? ', ' : ''}{patient.state}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact & Referral */}
                                <div className="bg-card rounded-xl border shadow-sm p-6">
                                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                        <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        Contacto de Emergencia y Referencia
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre Emergencia</Label>
                                            <p className="text-base font-medium text-foreground">{patient.emergencyContact || "No especificado"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teléfono Emergencia</Label>
                                            <p className="text-base font-medium text-foreground">{patient.emergencyPhone || "No especificado"}</p>
                                        </div>
                                         <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apoderado</Label>
                                            <p className="text-base font-medium text-foreground">{patient.guardianName || "N/A"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">¿Cómo nos conoció?</Label>
                                            <p className="text-base font-medium text-foreground">{patient.referralSource || "---"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referido Por</Label>
                                            <p className="text-base font-medium text-foreground">{patient.referredBy || "---"}</p>
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
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nota Clínica Inicial</Label>
                                                <p className="text-base font-medium text-foreground whitespace-pre-wrap">{patient.clinicalNotes || "---"}</p>
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

                                    {/* Financial & Management Overview (Pro) */}
                                    <div className="bg-card rounded-xl border shadow-sm p-6 border-l-4 border-l-primary">
                                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                                                <CreditCard className="h-5 w-5" />
                                            </div>
                                            Gestión y Finanzas
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo de Cuenta</p>
                                                    <p className={`text-2xl font-bold ${Number(patient.accountBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        ${patient.accountBalance || '0.00'}
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="outline" className="h-8">Ver Detalles</Button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ciclo de Recall</Label>
                                                    <div className="flex items-center gap-2">
                                                        <RefreshCcw className="h-4 w-4 text-primary" />
                                                        <p className="text-base font-medium text-foreground">{patient.recallMonths || 6} Meses</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacto Pref.</Label>
                                                    <p className="text-base font-medium text-foreground capitalize">{patient.preferredContactMethod || 'Teléfono'}</p>
                                                </div>
                                            </div>

                                            {patient.internalNotes && (
                                              <div className="space-y-1.5 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                                  <Label className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1">
                                                     <AlertTriangle className="h-3 w-3" /> Nota Administrativa
                                                  </Label>
                                                  <p className="text-sm text-amber-900 line-clamp-2 italic">{patient.internalNotes}</p>
                                              </div>
                                            )}
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

                            <TabsContent value="recipes" className="mt-0 focus-visible:ring-0">
                                <PatientPrescriptions 
                                    patientId={patient.id} 
                                    patientName={`${patient.name} ${patient.lastName}`} 
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
                        {billing.status !== 'paid' && (
                            <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs ml-2 text-blue-600"
                                onClick={() => window.open(`/pay/${billing.id}`, '_blank')}
                            >
                                Pagar
                            </Button>
                        )}
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
