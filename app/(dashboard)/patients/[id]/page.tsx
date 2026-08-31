"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/components/translations"
import { 
  ArrowLeft, Calendar, Phone, Mail, MapPin, 
  FileText, Stethoscope, Clock, User, Loader2, Receipt,
  AlertTriangle, Heart, ShieldAlert, CreditCard, RefreshCcw, Search,
  MessageCircle, Crown, ShieldCheck, Activity, User as UserIcon, Users,
  PanelLeftClose, PanelLeftOpen
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
    case 'Activity': return <Activity className={cn("h-4 w-4 mr-1.5", className)} />;
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
  const [filesCount, setFilesCount] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleSetSidebarOpen = (open: boolean) => {
    setIsTransitioning(true)
    setIsSidebarOpen(open)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
  }

  const fetchFilesCount = async () => {
     const id = params.id as string
     if (!id) return
     try {
       const { count, error } = await supabase
         .from('patient_files')
         .select('*', { count: 'exact', head: true })
         .eq('patient_id', id)
         .is('deleted_at', null)
       
       if (!error && count !== null) {
         setFilesCount(count)
       }
     } catch (e) {
       console.error("Error fetching files count:", e)
     }
  }

  useEffect(() => {
    fetchFilesCount()
    const fetchPatient = async () => {
      const id = params.id as string
      // Handle params.id being string or array
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!id || !currentClinicId || !uuidRegex.test(currentClinicId)) return
      
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
              status: d.patient_status || 'active',
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

  const formatBirthDateAndAge = (birthDateString?: string) => {
    if (!birthDateString) return "Fecha de nacimiento no registrada"
    const birth = new Date(birthDateString)
    if (isNaN(birth.getTime())) return "Fecha de nacimiento no registrada"
    
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return `${birth.toLocaleDateString("es-ES")} (${age} años)`
  }

  const handleUpdatePatient = async () => {
    const id = params.id as string
    if (!id || !currentClinicId) return
    try {
      setIsLoading(true)
      const { data, error } = await supabase.rpc('get_patients_with_stats', {
         p_clinic_id: currentClinicId,
         p_patient_id: id,
         p_limit: 1
      })

      if (error) throw error

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
            status: d.patient_status || 'active',
            avatar_url: d.avatar_url,
            family_representative_id: d.family_representative_id,
            family_relationship: d.family_relationship,
            is_family_head: d.is_family_head,
            appointments_count: Number(d.appointments_count) || 0,
            total_billed: Number(d.total_billed) || 0,
          }
         setPatient(mappedPatient)
      }
      setIsEditOpen(false)
      // Trigger a count refresh as well
      fetchFilesCount()
    } catch (e) {
      console.error("Error updating patient", e)
    } finally {
      setIsLoading(false)
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
    <div className="flex flex-col min-h-screen bg-background text-foreground animate-in fade-in duration-300">
      {/* Top Navigation Bar */}
      <div className="flex-none border-b bg-card px-6 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/patients')} className="-ml-3 gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver a Pacientes
          </Button>
          <div className="hidden md:block w-px h-4 bg-border" />          {!isSidebarOpen && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSetSidebarOpen(true)} 
              className="gap-1.5 hidden md:flex text-primary hover:text-primary-foreground hover:bg-primary px-2.5 h-8 border border-primary/20 bg-primary/5 rounded-lg animate-in slide-in-from-left duration-250 font-bold"
            >
              <PanelLeftOpen className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs">Mostrar Perfil</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
           {/* Dynamic Patient Stats Summary Widget (shown when sidebar is closed) */}
           {!isSidebarOpen && patient && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-muted/40 border border-slate-200 dark:border-slate-800 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200 text-xs">
                 <Avatar className="h-6 w-6 border shadow-sm flex-shrink-0">
                    <AvatarImage src={patient.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">
                       {patient.name[0]}{patient.lastName[0]}
                    </AvatarFallback>
                 </Avatar>
                 <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-foreground">{patient.name} {patient.lastName}</span>
                    {patient.birthDate && (
                      <span className="text-muted-foreground font-medium">
                         ({formatBirthDateAndAge(patient.birthDate).split(" (")[1]?.replace(")", "") || ""})
                      </span>
                    )}
                 </div>
                 <div className="w-px h-3 bg-border" />
                 <div className="flex items-center gap-1 text-muted-foreground font-semibold">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{patient.phone}</span>
                 </div>
                 <div className="w-px h-3 bg-border" />
                 <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Saldo:</span>
                    <Badge 
                       className={cn(
                          "text-[10px] px-2 py-0 font-extrabold shadow-sm border",
                          Number(patient.accountBalance || 0) > 0 
                            ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                       )}
                    >
                       ${patient.accountBalance || '0.00'}
                    </Badge>
                 </div>
              </div>
           )}

           {/* Primary Top Action: Editar Información Principal */}
           <Button 
             size="sm"
             onClick={() => setIsEditOpen(true)}
             disabled={user?.role === 'receptionist'}
             className="h-8 gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs shadow-sm hover:shadow transition-all"
             title={user?.role === 'receptionist' ? "Solo lectura para recepcionistas" : "Editar información principal del paciente"}
           >
             <UserIcon className="h-3.5 w-3.5" />
             <span>Editar Información Principal</span>
           </Button>

           <div className="text-xs text-muted-foreground font-semibold hidden lg:flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
              Expediente Digital
           </div>
        </div>
      </div>
 
      {/* Main Content Area - Split Architecture with Independent Right Scrolling */}
      <div className="flex-1 flex flex-col md:flex-row md:h-[calc(100vh-49px)] md:overflow-hidden">
         
         {/* Left Sidebar - Profile, Actions & Permanent Critical Info */}
         <div className={cn(
            "flex-none border-b md:border-b-0 md:border-r bg-card flex flex-col shadow-sm custom-scrollbar md:h-full md:overflow-y-auto",
            isTransitioning && "transition-[width,opacity] duration-300 ease-in-out",
            isSidebarOpen 
              ? "w-full md:w-80 lg:w-96 opacity-100" 
              : "w-0 md:w-0 lg:w-0 opacity-0 overflow-hidden border-r-0 border-b-0"
         )}>
            {/* Header / Avatar */}
            <div className="p-6 border-b flex flex-col items-center text-center gap-4 bg-muted/10 relative">
               {/* Sidebar Close Button placed at upper right side of left panel */}
               <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSetSidebarOpen(false)}
                  className="absolute top-3 right-3 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg hidden md:flex items-center justify-center transition-colors"
                  title="Ocultar Perfil"
               >
                  <PanelLeftClose className="h-4 w-4" />
               </Button>
               <AvatarUpload
                 uid={patient.id}
                 url={patient.avatar_url || null}
                 bucket="patient-avatars"
                 size={100}
                 fallbackName={`${patient.name} ${patient.lastName}`}
                 onUpload={async (url) => {
                    await supabase.from('patients').update({ avatar_url: url }).eq('id', patient.id)
                    setPatient(prev => prev ? ({ ...prev, avatar_url: url }) : null)
                 }}
               />
               <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5 flex-wrap">
                    {patient.name} {patient.lastName}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                     <Badge variant={patient.status === "active" ? "default" : "secondary"} className="text-[10px] px-2 py-0">
                       {patient.status === "active" ? "Activo" : "Inactivo"}
                     </Badge>
                     {(() => {
                        const currentClinic = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)?.clinics;
                        const status = getPatientLoyaltyStatus(patient.appointments_count, patient.total_billed, currentClinic?.settings);
                        const badgeData = getLoyaltyBadgeData(status.key, status.style);
                        return (
                          <Badge 
                            className={cn(
                              "text-[10px] px-2 py-0 border uppercase flex items-center transition-all",
                              badgeData.className
                            )}
                          >
                            <LoyaltyIcon name={badgeData.iconName} className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        )
                     })()}
                  </div>
               </div>
            </div>

            {/* Critical Medical Alerts Section */}
            {patient && (patient.hasDiabetes || patient.hasHypertension || patient.hasHeartDisease || patient.allergies || patient.isPregnant) && (
               <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                     <ShieldAlert className="h-4 w-4 animate-pulse text-rose-600 dark:text-rose-500" />
                     Alertas Médicas Críticas
                  </div>
                  <div className="flex flex-wrap gap-1">
                     {patient.hasDiabetes && <Badge className="bg-rose-600 hover:bg-rose-700 text-xs px-2 py-0.5 font-bold">DIABETES</Badge>}
                     {patient.hasHypertension && <Badge className="bg-rose-600 hover:bg-rose-700 text-xs px-2 py-0.5 font-bold">HIPERTENSIÓN</Badge>}
                     {patient.hasHeartDisease && <Badge className="bg-rose-600 hover:bg-rose-700 text-xs px-2 py-0.5 font-bold">CARDIOPATÍA</Badge>}
                     {patient.isPregnant && <Badge className="bg-pink-500 hover:bg-pink-600 text-xs px-2 py-0.5 font-bold">EMBARAZO</Badge>}
                  </div>
                  {patient.allergies && (
                     <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-rose-100 dark:border-rose-900/20 mt-1">
                        ⚠️ Alergias: <span className="font-bold text-rose-700 dark:text-rose-400">{patient.allergies}</span>
                     </div>
                  )}
               </div>
            )}

            {/* Quick Actions Stack */}
            <div className="p-4 border-b space-y-3">
               <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full border-green-200 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 hover:bg-green-100 hover:text-green-800 text-xs gap-1.5 h-9 px-2 shadow-sm"
                    onClick={() => window.open(getWhatsAppUrl(patient.phone || "", getClinicWhatsAppMessage(patient.name, clinicName)), "_blank")}
                  >
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    WhatsApp
                  </Button>
                  <Button className="w-full text-xs gap-1.5 h-9 px-2 shadow-sm hover:shadow-md transition-all" onClick={() => setIsEditOpen(true)}>
                    <UserIcon className="h-4 w-4" />
                    Editar Perfil
                  </Button>
               </div>
               
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

            <Accordion type="multiple" defaultValue={["metrics", "contact", "quality", "highlights"]} className="w-full">
            {/* Core Patient Metrics */}
            <AccordionItem value="metrics" className="border-b">
               <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:no-underline">
                  Métricas Principales
               </AccordionTrigger>
               <AccordionContent className="px-4 pb-4 space-y-3 text-xs">
               <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Edad / Nacimiento</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatBirthDateAndAge(patient.birthDate)}</span>
               </div>
               <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Género</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 capitalize">
                     {patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : "Otro"}
                  </span>
               </div>
               <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Nº Historia Clínica</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{patient.medicalRecordNumber || "---"}</span>
               </div>
               {patient.bloodType && (
                  <div className="flex items-center justify-between border-b pb-2">
                     <span className="text-muted-foreground font-semibold uppercase tracking-wider">Grupo Sanguíneo</span>
                     <Badge variant="outline" className="font-bold border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/20 px-2 py-0 text-[10px]">
                        {patient.bloodType}
                     </Badge>
                  </div>
               )}
               <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider">Saldo de Cuenta</span>
                  <span className={cn(
                     "font-bold",
                     Number(patient.accountBalance || 0) > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                     ${patient.accountBalance || '0.00'}
                  </span>
               </div>
               </AccordionContent>
            </AccordionItem>

            {/* Primary Contact Details */}
            <AccordionItem value="contact" className="border-b">
               <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:no-underline">
                  Contacto Principal
               </AccordionTrigger>
               <AccordionContent className="px-4 pb-4 space-y-3 text-xs">
               <div className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Teléfono Principal</span>
                     <p className="font-semibold text-slate-800 dark:text-slate-100">{patient.phone}</p>
                  </div>
               </div>
               {patient.email && (
                  <div className="flex items-start gap-2.5">
                     <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                     <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Correo Electrónico</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 break-all">{patient.email}</p>
                     </div>
                  </div>
               )}
               {patient.address && (
                  <div className="flex items-start gap-2.5">
                     <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                     <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Dirección Residencia</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                           {patient.address}
                           {(patient.city || patient.state) && (
                              <span className="text-muted-foreground block text-[10px] mt-0.5">
                                 {patient.city}{patient.city && patient.state ? ', ' : ''}{patient.state}
                              </span>
                           )}
                        </p>
                     </div>
                  </div>
               )}
               </AccordionContent>
            </AccordionItem>

            {/* Data Quality Widget */}
            <AccordionItem value="quality" className="border-b">
               <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:no-underline">
                  Expediente Clínico
               </AccordionTrigger>
               <AccordionContent className="px-4 pb-4 space-y-2">
               <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-muted-foreground">Expediente Clínico</span>
                  <span className={cn(
                     "px-1.5 py-0.5 rounded text-[10px] font-extrabold",
                     calculateProfileCompletion(patient) >= 80 ? "bg-green-100 text-green-700" :
                     calculateProfileCompletion(patient) >= 50 ? "bg-blue-100 text-blue-700" :
                     "bg-rose-100 text-rose-700"
                  )}>
                     {getCompletionLabel(calculateProfileCompletion(patient))} {calculateProfileCompletion(patient)}%
                  </span>
               </div>
               <Progress value={calculateProfileCompletion(patient)} className="h-1.5" indicatorClassName={getCompletionColor(calculateProfileCompletion(patient))} />
               </AccordionContent>
            </AccordionItem>

            {/* Clinical Highlights Widget */}
            {(patient.last_treatment_note || patient.odontogram_state) && (
               <AccordionItem value="highlights" className="border-b-0 bg-muted/20">
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:no-underline">
                     Resumen Clínico
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                  {patient.last_treatment_note && (
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Último Tratamiento</span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 italic bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-border/50">
                           {patient.last_treatment_note}
                        </p>
                     </div>
                  )}
                  {patient.odontogram_state && (
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado Dental (Vista Rápida)</span>
                        <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-border/50 flex items-center justify-center">
                           <OdontogramPreview data={patient.odontogram_state || {}} size="sm" />
                        </div>
                     </div>
                  )}
                  </AccordionContent>
               </AccordionItem>
            )}
            </Accordion>
         </div>

         {/* Right Working Area Tabs with Independent Scrolling */}
         <div className="flex-1 flex flex-col bg-muted/5 h-full md:overflow-y-auto custom-scrollbar">
            <Tabs defaultValue="info" className="flex flex-col w-full min-h-full">
               {/* Fixed Tabs List container */}
               <div className="flex-none bg-background/95 backdrop-blur border-b px-6 shadow-sm z-20 sticky top-0">
                  <div className="max-w-7xl mx-auto w-full overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                     <TabsList className="h-auto p-0 bg-transparent gap-3 lg:gap-5 flex whitespace-nowrap min-w-max">
                         {['info', 'medical', 'hcu033', 'appointments', 'recipes', 'payments', 'files'].map((tab) => (
                             <TabsTrigger 
                                 key={tab}
                                 value={tab}
                                 className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-0 text-muted-foreground data-[state=active]:text-primary font-bold text-xs sm:text-sm transition-all"
                             >
                                 {tab === 'info' && "Perfil Completo"}
                                 {tab === 'medical' && "Historial Médico"}
                                 {tab === 'hcu033' && "HCU-033"}
                                 {tab === 'appointments' && "Citas"}
                                 {tab === 'recipes' && "Recetas / Prescripciones"}
                                 {tab === 'payments' && "Pagos"}
                                 {tab === 'files' && (
                                   <div className="flex items-center gap-2">
                                     Archivos
                                     <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-extrabold">{filesCount}</Badge>
                                   </div>
                                 )}
                             </TabsTrigger>
                         ))}
                     </TabsList>
                  </div>
               </div>

               {/* Scrollable Work Area Content */}
               <div className="flex-1">
                  <div className="max-w-7xl mx-auto p-6 space-y-6">
                        <TabsContent value="files" className="mt-0 focus-visible:ring-0">
                            <PatientFiles patientId={patient.id} onFilesChange={fetchFilesCount} />
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
                                    Información de Registro
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
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
                                        <p className="text-base font-medium text-foreground">
                                            {patient.birthDate && !isNaN(new Date(patient.birthDate).getTime()) 
                                                ? new Date(patient.birthDate).toLocaleDateString("es-ES") 
                                                : "No registrada"}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teléfono Principal</Label>
                                        <p className="text-base font-medium text-foreground">{patient.phone}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                                        <p className="text-base font-medium text-foreground break-all">{patient.email || "No registrado"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado Civil</Label>
                                        <p className="text-base font-medium text-foreground capitalize">{patient.maritalStatus || "---"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grupo Sanguíneo</Label>
                                        <Badge variant="outline" className="text-sm font-medium border-rose-200 text-rose-700 bg-rose-50 w-fit">
                                            {patient.bloodType || "---"}
                                        </Badge>
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
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre Contacto</Label>
                                        <p className="text-base font-medium text-foreground">{patient.emergencyContact || "No especificado"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teléfono Emergencia</Label>
                                        <p className="text-base font-medium text-foreground">{patient.emergencyPhone || "No especificado"}</p>
                                    </div>
                                     <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apoderado / Tutor</Label>
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
                                        Datos Médicos de Registro
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
                                            <p className="text-base font-medium text-foreground">{patient.medications || "Ninguno"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card rounded-xl border shadow-sm p-6">
                                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-3 text-foreground">
                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        Seguro Médico y Preferencias
                                    </h3>
                                    <div className="space-y-6">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proveedor de Seguro</Label>
                                            <p className="text-base font-medium text-foreground">{patient.insuranceProvider || "Particular / Privado"}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nº Póliza</Label>
                                            <p className="text-base font-medium font-mono text-foreground">{patient.policyNumber || "N/A"}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ciclo Recall</Label>
                                                <p className="text-base font-medium text-foreground">{patient.recallMonths || 6} Meses</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacto Pref.</Label>
                                                <p className="text-base font-medium text-foreground capitalize">{patient.preferredContactMethod || 'Teléfono'}</p>
                                            </div>
                                        </div>
                                        {patient.internalNotes && (
                                          <div className="space-y-1.5 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                              <Label className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1">
                                                 <AlertTriangle className="h-3 w-3" /> Nota Administrativa Interna
                                              </Label>
                                              <p className="text-sm text-amber-900 italic">{patient.internalNotes}</p>
                                          </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="medical" className="mt-0 focus-visible:ring-0">
                            <PatientMedicalRecords 
                                patientId={patient.id} 
                                onSave={handleUpdatePatient}
                            />
                        </TabsContent>

                        <TabsContent value="hcu033" className="mt-0 focus-visible:ring-0">
                            <HCU033Form 
                                patientId={patient.id} 
                                patientName={`${patient.name} ${patient.lastName}`} 
                                onSave={handleUpdatePatient}
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
            onSave={handleUpdatePatient}
            externalData={hcuData}
            onDataChange={setHcuData}
          />
      )}
      <style jsx global>{`
        /* Modern custom scrollbar styling for patient sidebars */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.25);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.45);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.35);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(75, 85, 99, 0.55);
        }
      `}</style>
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
