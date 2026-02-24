"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth-context"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { AddPatientForm } from "@/components/add-patient-form"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger as TabsTriggerUI } from "@/components/ui/tabs"
import { 
  Search,
  Plus,
  Download,
  Upload,
  Mail,
  Clock,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  Filter,
  Users,
  History,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Crown,
  MessageCircle,
  User as UserIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getWhatsAppUrl, getClinicWhatsAppMessage } from "@/lib/communication"
import { calculateProfileCompletion, getCompletionColor, getCompletionLabel, getPatientLoyaltyStatus, getLoyaltyBadgeData } from "@/lib/patient-utils"
import { Progress } from "@/components/ui/progress"
import { FamilyCenter } from "@/components/family-center"

const LoyaltyIcon = ({ name, className }: { name: string, className?: string }) => {
  switch (name) {
    case 'Crown': return <Crown className={cn("h-3 w-3 mr-1", className)} />;
    case 'ShieldCheck': return <ShieldCheck className={cn("h-3 w-3 mr-1", className)} />;
    case 'Sparkles': return <Sparkles className={cn("h-3 w-3 mr-1", className)} />;
    default: return <UserIcon className={cn("h-3 w-3 mr-1", className)} />;
  }
}

interface Patient {
  id: string
  name: string
  lastName: string
  cedula?: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  birthDate: string
  gender?: string
  emergencyContact?: string
  emergencyPhone?: string
  allergies?: string
  medications?: string
  medicalConditions?: string
  insuranceProvider?: string
  policyNumber?: string
  bloodType?: string
  maritalStatus?: string
  occupation?: string
  guardianName?: string
  referralSource?: string
  referredBy?: string
  medicalRecordNumber?: string
  clinicalNotes?: string
  tags?: string[]
  lastVisit?: string
  nextAppointment?: string
  status: "active" | "inactive"
  hasDiabetes?: boolean
  hasHypertension?: boolean
  hasHeartDisease?: boolean
  isSmoker?: boolean
  isPregnant?: boolean
  appointments_count?: number
  total_billed?: number
  family_representative_id?: string
  family_relationship?: string
  is_family_head?: boolean
  family_member_count?: number
  avatar_url?: string
}

export default function PatientsPage() {
  const { t } = useTranslation()
  const { user, currentClinicId } = useAuth()
  const router = useRouter()
  
  const currentClinic = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)?.clinics
  const clinicName = currentClinic?.name || "su Clínica Dental"
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [timeFilter, setTimeFilter] = useState("all")
  const [badgeFilter, setBadgeFilter] = useState("all")
  const [groupByFamily, setGroupByFamily] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 12

  // Fetch patients from Supabase
  useEffect(() => {
    // Reset and fetch when search or filters change
    setPage(0)
    setPatients([])
    fetchPatients(0, searchTerm)
  }, [searchTerm, timeFilter, badgeFilter, groupByFamily, fetchPatients])

  const fetchPatients = useCallback(async (pageNum: number, search: string) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.rpc('get_patients_with_stats', {
        p_clinic_id: currentClinicId,
        p_search: search,
        p_limit: PAGE_SIZE,
        p_offset: pageNum * PAGE_SIZE,
        p_time_filter: timeFilter,
        p_badge_filter: badgeFilter,
        p_group_by_family: groupByFamily
      })

      if (error) throw error
      
      const count = data?.[0]?.total_count || 0

        if (data) {
          const mappedPatients: Patient[] = (data as Record<string, any>[]).map((p) => ({
            id: p.id as string,
            name: p.first_name as string,
            lastName: p.last_name,
            cedula: p.cedula,
            email: p.email,
            phone: p.phone,
            address: p.address,
            city: p.city,
            state: p.state,
            birthDate: p.birth_date,
            gender: p.gender,
            status: p.status || 'active',
            lastVisit: p.last_visit,
            nextAppointment: p.next_appointment,
            emergencyContact: p.emergency_contact,
            emergencyPhone: p.emergency_phone,
            allergies: p.allergies,
            medications: p.medications,
            medicalConditions: p.medical_conditions,
            insuranceProvider: p.insurance_provider,
            policyNumber: p.policy_number,
            bloodType: p.blood_type,
            maritalStatus: p.marital_status,
            occupation: p.occupation,
            guardianName: p.guardian_name,
            referralSource: p.referral_source,
            referredBy: p.referred_by,
            medicalRecordNumber: p.medical_record_number,
            clinicalNotes: p.clinical_notes,
            tags: p.tags || [],
            hasDiabetes: p.has_diabetes,
            hasHypertension: p.has_hypertension,
            hasHeartDisease: p.has_heart_disease,
            isSmoker: p.is_smoker,
            isPregnant: p.is_pregnant,
            family_representative_id: p.family_representative_id,
            family_relationship: p.family_relationship,
            is_family_head: p.is_family_head,
            family_member_count: Number(p.family_member_count) || 1,
            appointments_count: Number(p.appointments_count) || 0,
            total_billed: Number(p.total_billed) || 0,
          }))

        setPatients(prev => pageNum === 0 ? mappedPatients : [...prev, ...mappedPatients])
        setHasMore((pageNum + 1) * PAGE_SIZE < count)
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentClinicId, timeFilter, badgeFilter, groupByFamily, PAGE_SIZE])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPatients(nextPage, searchTerm)
  }

  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)

  const handleAddPatient = (patientData: any) => {
    // Patient is already created in AddPatientForm
    if (patientData) {
      const newPatient: Patient = {
        id: patientData.id,
        name: patientData.first_name,
        lastName: patientData.last_name,
        cedula: patientData.cedula,
        email: patientData.email,
        phone: patientData.phone,
        address: patientData.address,
        city: patientData.city,
        state: patientData.state,
        birthDate: patientData.birth_date,
        gender: patientData.gender,
        status: 'active',
        emergencyContact: patientData.emergency_contact,
        emergencyPhone: patientData.emergency_phone,
        allergies: patientData.allergies,
        medications: patientData.medications,
        medicalConditions: patientData.medical_conditions,
        insuranceProvider: patientData.insurance_provider,
        policyNumber: patientData.policy_number,
        bloodType: patientData.blood_type,
        maritalStatus: patientData.marital_status,
        occupation: patientData.occupation,
        guardianName: patientData.guardian_name,
        referralSource: patientData.referral_source,
        referredBy: patientData.referred_by,
        medicalRecordNumber: patientData.medical_record_number,
        clinicalNotes: patientData.clinical_notes,
        tags: patientData.tags || []
      }
      setPatients((prev) => [newPatient, ...prev])
      setIsAddPatientOpen(false)
    }
  }

  const exportDatabase = (format: 'json' | 'csv' = 'csv') => {
    if (format === 'json') {
      const dataStr = JSON.stringify(patients, null, 2)
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
      const exportFileDefaultName = `pacientes_${new Date().toISOString().split("T")[0]}.json`
      const linkElement = document.createElement("a")
      linkElement.setAttribute("href", dataUri)
      linkElement.setAttribute("download", exportFileDefaultName)
      linkElement.click()
    } else {
      // CSV Export
      const headers = [
        "ID", "Nº HC", "Nombre", "Apellido", "Cedula", "Email", "Telefono", "Direccion", "Ciudad", "Estado",
        "F. Nacimiento", "Genero", "Ocupacion", "Apoderado", "Alergias", "Seguro", "Poliza", "Grupo Sanguineo", "Estado Civil"
      ]
      
      const rows = patients.map(p => [
        p.id, p.medicalRecordNumber || '', p.name, p.lastName, p.cedula || '', p.email || '', p.phone, p.address || '', p.city || '', p.state || '',
        p.birthDate, p.gender || '', p.occupation || '', p.guardianName || '', p.allergies || '', p.insuranceProvider || '', p.policyNumber || '', p.bloodType || '', p.maritalStatus || ''
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `pacientes_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    
    toast.success(`Base de datos exportada en formato ${format.toUpperCase()}`)
  }

  // Helper helper to parse CSV line expecting standard CSV quoting
  const parseCSVLine = (text: string, delimiter: string) => {
    const result = []
    let current = ''
    let inQuote = false
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (char === '"') {
            inQuote = !inQuote
        } else if (char === delimiter && !inQuote) {
            result.push(current.trim().replace(/^"|"$/g, ''))
            current = ''
        } else {
            current += char
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''))
    return result
  }

  const parseDate = (dateStr: string) => {
      if (!dateStr) return null
      // Try YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
      // Try DD/MM/YYYY or DD-MM-YYYY
      const parts = dateStr.split(/[\/\-]/)
      if (parts.length === 3) {
          const day = parts[0].padStart(2, '0')
          const month = parts[1].padStart(2, '0')
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
          return `${year}-${month}-${day}`
      }
      return null
  }

  const importDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!currentClinicId) {
        toast.error("Error: No se ha detectado la clínica activa. Recarga la página.")
        return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        let importedPatients: any[] = []

        setIsLoading(true)

        if (file.name.endsWith('.json')) {
            try {
              importedPatients = JSON.parse(content)
              if (!Array.isArray(importedPatients)) throw new Error("Formato JSON inválido - debe ser un arreglo")
            } catch (err: any) {
              throw new Error(`Error al leer JSON: ${err.message}`)
            }
        } 
        
        let headers: string[] = []
        if (file.name.endsWith('.csv')) {
            const rows = content.split('\n').filter(r => r.trim() !== '')
            if (rows.length < 2) throw new Error("El archivo CSV está vacío o no tiene cabeceras")
            
            // Detect Delimiter
            const firstRow = rows[0]
            const commaCount = (firstRow.match(/,/g) || []).length
            const semiCount = (firstRow.match(/;/g) || []).length
            const delimiter = semiCount > commaCount ? ';' : ','
            
            // Parse headers safely
            headers = parseCSVLine(firstRow, delimiter)
            
            importedPatients = rows.slice(1).map(row => {
                const cols = parseCSVLine(row, delimiter)
                const data: any = {}
                
                headers.forEach((header, index) => {
                     const value = cols[index] || ''
                     // Normalize: lowercase and remove accents
                     const h = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                     
                     // Flexible Header Mapping (Production Strategy for multiple software)
                     if (h.includes('nombre') || h.includes('name') || h === 'nom') data.first_name = value
                     else if (h.includes('apellido') || h.includes('last') || h === 'apell') data.last_name = value
                     else if (h.includes('email') || h.includes('correo') || h.includes('mail')) data.email = value
                     else if (h.includes('telef') || h.includes('celular') || h.includes('phone') || h.includes('movil') || h.includes('tel')) data.phone = value
                     else if (h.includes('document') || h.includes('cedula') || h.includes('dni') || h.includes('id') || h.includes('rut') || h.includes('identificacion')) data.cedula = value
                     else if (h.includes('nacim') || h.includes('birth') || h.includes('f_nac') || h.includes('dob')) data.birth_date = value
                     else if (h.includes('sex') || h.includes('genero') || h.includes('gender')) {
                         const g = value.toLowerCase()
                         data.gender = (g.startsWith('m') || g === 'h') ? 'male' : (g.startsWith('f') || g === 'm') ? 'female' : 'other'
                     }
                     else if (h.includes('direccion') || h.includes('address') || h === 'dir') data.address = value
                     else if (h.includes('ciudad') || h.includes('city') || h.includes('comuna')) data.city = value
                     else if (h.includes('estado') || h.includes('state') || h.includes('region') || h.includes('provincia')) data.state = value
                     else if (h.includes('ocupacion') || h.includes('occupation') || h.includes('profesion')) data.occupation = value
                     else if (h.includes('apoderado') || h.includes('guardian')) data.guardian_name = value
                     else if (h.includes('conoc') || h.includes('fuente') || h.includes('source')) data.referral_source = value
                     else if (h.includes('referencia') || h.includes('referido')) data.referred_by = value
                     else if (h.includes('nota') || h.includes('observacion') || h.includes('clinical')) data.clinical_notes = value
                     else if (h.includes('alergia') || h.includes('allerg')) data.allergies = value
                     else if (h.includes('historia') || h.includes('hc') || h.includes('record') || h.includes('nro_hc')) data.medical_record_number = value
                     else if (h.includes('etiqueta') || h.includes('tag')) data.tags = value ? [value] : []
                     else if (h.includes('sangre') || h.includes('blood')) data.blood_type = value
                     else if (h.includes('civil') || h.includes('marital')) data.marital_status = value
                     else if (h.includes('emergencia') || h.includes('emergency')) {
                         if (h.includes('tel') || h.includes('phon')) data.emergency_phone = value
                         else data.emergency_contact = value
                     }
                     else if (h.includes('seguro') || h.includes('insurance') || h.includes('isapre') || h.includes('fonasa')) data.insurance_provider = value
                     else if (h.includes('poliza') || h.includes('policy')) data.policy_number = value
                     else if (h.includes('medicamento') || h.includes('medicat')) data.medications = value
                     else if (h.includes('condicion') || h.includes('medical_cond')) data.medical_conditions = value
                     else if (h.includes('diabetes')) data.has_diabetes = value.toLowerCase().includes('si') || value === '1' || value.toLowerCase() === 'true'
                     else if (h.includes('hiperten') || h.includes('tension')) data.has_hypertension = value.toLowerCase().includes('si') || value === '1' || value.toLowerCase() === 'true'
                     else if (h.includes('corazon') || h.includes('cardio') || h.includes('heart')) data.has_heart_disease = value.toLowerCase().includes('si') || value === '1' || value.toLowerCase() === 'true'
                     else if (h.includes('fuma') || h.includes('smoke')) data.is_smoker = value.toLowerCase().includes('si') || value === '1' || value.toLowerCase() === 'true'
                     else if (h.includes('embaraz') || h.includes('pregnant')) data.is_pregnant = value.toLowerCase().includes('si') || value === '1' || value.toLowerCase() === 'true'
                     else if (h.includes('pref') || h.includes('contact')) data.preferred_contact_method = value.toLowerCase().includes('wa') ? 'whatsapp' : value.toLowerCase().includes('mail') ? 'email' : 'phone'
                     else if (h.includes('recall') || h.includes('ciclo')) data.recall_months = parseInt(value) || 6
                     else if (h.includes('nota_int') || h.includes('internal')) data.internal_notes = value
                     else if (h.includes('saldo') || h.includes('balance') || h.includes('account')) data.account_balance = parseFloat(value) || 0
                })
                return data
            })
        }

        // Validate and Transform
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        
        const dbPatients = importedPatients.map(p => {
           // Basic field cleanup
           const email = p.email && p.email.trim() ? p.email.trim() : null
           const validEmail = email && emailRegex.test(email) ? email : null
           
            return {
              first_name: p.first_name?.trim(),
              last_name: p.last_name?.trim() || '',
              cedula: p.cedula?.toString().trim() || null,
              email: validEmail,
              phone: p.phone?.toString().trim() || null,
              address: p.address?.trim() || null,
              city: p.city?.trim() || null,
              state: p.state?.trim() || null,
              birth_date: parseDate(p.birth_date),
              gender: p.gender || 'other',
              occupation: p.occupation || null,
              guardian_name: p.guardian_name || null,
              referral_source: p.referral_source || null,
              referred_by: p.referred_by || null,
              clinical_notes: p.clinical_notes || null,
              medical_record_number: p.medical_record_number || null,
              tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []),
              emergency_contact: p.emergency_contact || null,
              emergency_phone: p.emergency_phone || null,
              allergies: p.allergies || null,
              medications: p.medications || null,
              medical_conditions: p.medical_conditions || null,
              insurance_provider: p.insurance_provider || null,
              policy_number: p.policy_number || null,
              blood_type: p.blood_type || null,
              marital_status: p.marital_status || null,
              has_diabetes: p.has_diabetes || false,
              has_hypertension: p.has_hypertension || false,
              has_heart_disease: p.has_heart_disease || false,
              is_smoker: p.is_smoker || false,
              is_pregnant: p.is_pregnant || false,
              preferred_contact_method: p.preferred_contact_method || 'phone',
              recall_months: p.recall_months || 6,
              internal_notes: p.internal_notes || null,
              account_balance: p.account_balance || 0,
              status: 'active', 
              clinic_id: currentClinicId
            }
        }).filter(p => p.first_name)

        if (dbPatients.length === 0) {
            const headerMsg = headers.length > 0 ? `Cabeceras detectadas: ${headers.join(', ')}` : "Formato no reconocido o sin cabeceras."
            throw new Error(`No se encontraron registros válidos (requiere al menos 'Nombre'). ${headerMsg}`)
        }

        logger.info(`Starting batch import of ${dbPatients.length} patients`, { fileName: file.name })
        toast.info(`Iniciando importación de ${dbPatients.length} registros...`)

        // Upsert to Supabase
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []
        const CHUNK_SIZE = 50

        // Process in chunks
        for (let i = 0; i < dbPatients.length; i += CHUNK_SIZE) {
            const chunk = dbPatients.slice(i, i + CHUNK_SIZE)
            
            // Production Strategy: 
            // 1. If 'cedula' is present, use it as Conflict Target for upsert.
            // 2. If 'cedula' is missing, fallback to simple insert.
            
            const withCedula = chunk.filter(p => p.cedula)
            const withoutCedula = chunk.filter(p => !p.cedula)

            try {
                // 1. Handle records with identification (Upsert on cedula + clinic_id)
                if (withCedula.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('patients')
                        .upsert(withCedula, { 
                            onConflict: 'cedula,clinic_id', 
                            ignoreDuplicates: false 
                        })
                     
                    if (upsertError) {
                        logger.error('Import Upsert Error', { error: upsertError, chunkIndex: i })
                        errorCount += withCedula.length
                        errors.push(upsertError.message)
                    } else {
                        successCount += withCedula.length
                    }
                }

                // 2. Handle records without identification (Insert only)
                if (withoutCedula.length > 0) {
                    const { error: insertError } = await supabase
                        .from('patients')
                        .insert(withoutCedula)
                    
                    if (insertError) {
                        logger.error('Import Insert Error', { error: insertError, chunkIndex: i })
                        errorCount += withoutCedula.length
                        errors.push(insertError.message)
                    } else {
                        successCount += withoutCedula.length
                    }
                }
            } catch (e: any) {
                logger.error("Critical error processing chunk", { error: e.message, chunkIndex: i })
                errorCount += chunk.length
                errors.push(e.message)
            }
        }

        await fetchPatients(0, searchTerm)
        
        if (errorCount > 0) {
             const uniqueErrors = Array.from(new Set(errors)).slice(0, 3)
             toast.error(`Importación parcial: ${successCount} ok, ${errorCount} fallidos.`, {
                 description: `Errores: ${uniqueErrors.join(', ')}`,
                 duration: 6000
             })
             logger.warn('Import completed with errors', { successCount, errorCount, errors })
        } else {
             toast.success(`Importación exitosa`, {
                 description: `${successCount} pacientes procesados correctamente.`
             })
             logger.info('Import completed successfully', { total: successCount })
        }
      } catch (error: any) {
        logger.error("Critical error in importDatabase", { error: error.message })
        toast.error("Error crítico al importar", {
            description: error.message
        })
      } finally {
        setIsLoading(false)
        if(event.target) event.target.value = ''
      }
    }
    // Excel CSVs are often ISO-8859-1 in Spanish regions
    reader.readAsText(file, 'ISO-8859-1')
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
          <input type="file" accept=".json,.csv" onChange={importDatabase} className="hidden" id="import-file" />
          <Button variant="outline" size="sm" onClick={() => document.getElementById("import-file")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {t("import-database")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t("export-database")}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportDatabase('csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                <span>Exportar como CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDatabase('json')}>
                <FileJson className="mr-2 h-4 w-4" />
                <span>Exportar como JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Filters Hub */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t("search-patients")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 border-slate-200 focus-visible:ring-blue-500 shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
           {/* View Toggle */}
           <Tabs value={groupByFamily ? "family" : "individual"} onValueChange={(v) => setGroupByFamily(v === "family")} className="bg-slate-100 p-1 rounded-lg">
             <TabsList className="bg-transparent h-8 p-0">
               <TabsTriggerUI value="individual" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-7 px-3 text-xs font-bold gap-1.5">
                 <LayoutGrid className="h-3.5 w-3.5" />
                 Individual
               </TabsTriggerUI>
               <TabsTriggerUI value="family" className="data-[state=active]:bg-white data-[state=active]:shadow-sm h-7 px-3 text-xs font-bold gap-1.5">
                 <Users className="h-3.5 w-3.5" />
                 Familias
               </TabsTriggerUI>
             </TabsList>
           </Tabs>

           {/* Time Filter */}
           <Select value={timeFilter} onValueChange={setTimeFilter}>
             <SelectTrigger className="w-[140px] h-10 bg-white border-slate-200 font-medium text-xs">
               <div className="flex items-center gap-2">
                 <History className="h-3.5 w-3.5 text-slate-400" />
                 <SelectValue placeholder="Tiempo" />
               </div>
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Todos</SelectItem>
               <SelectItem value="recent">Recientes (7d)</SelectItem>
               <SelectItem value="week">Esta semana</SelectItem>
               <SelectItem value="this_month">Este mes</SelectItem>
               <SelectItem value="last_month">Mes pasado</SelectItem>
             </SelectContent>
           </Select>

           {/* Badge Filter */}
           <Select value={badgeFilter} onValueChange={setBadgeFilter}>
             <SelectTrigger className="w-[130px] h-10 bg-white border-slate-200 font-medium text-xs">
                <div className="flex items-center gap-2">
                 <Filter className="h-3.5 w-3.5 text-slate-400" />
                 <SelectValue placeholder="Categoría" />
               </div>
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Categorías</SelectItem>
               <SelectItem value="vip">VIP / Diamante</SelectItem>
               <SelectItem value="regular">Recurrentes</SelectItem>
               <SelectItem value="new">Nuevos</SelectItem>
             </SelectContent>
           </Select>
        </div>
      </div>

      {/* Patients Grid */}
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => {
            const hasAlerts = patient.hasDiabetes || patient.hasHypertension || patient.hasHeartDisease || patient.allergies || patient.isPregnant
            const profileScore = calculateProfileCompletion(patient)
            const scoreColor = getCompletionColor(profileScore)
            const scoreLabel = getCompletionLabel(profileScore)
            
            // Family Card Logic
            const isFamilyCard = groupByFamily;
            
            return (
              <Card 
                key={patient.id}
                className={cn(
                  "group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:border-primary/30",
                  isFamilyCard ? "bg-slate-50 border-blue-100" : "bg-white border-slate-100"
                )}
                onClick={() => {
                   if (!isFamilyCard) {
                     router.push(`/patients/${patient.id}`)
                   }
                }}
              >
                {isFamilyCard && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 group-hover:scale-105 transition-transform duration-200 border-2 border-white shadow-sm">
                        <AvatarImage src={patient.avatar_url || `/placeholder.svg?${patient.id}`} alt={`${patient.name} ${patient.lastName}`} />
                        <AvatarFallback className={cn(
                          "font-bold",
                          isFamilyCard ? "bg-blue-600 text-white" : "bg-primary/10 text-primary"
                        )}>
                          {patient.name[0]}{patient.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {isFamilyCard && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                          <Users className="h-3 w-3 text-blue-600" />
                        </div>
                      )}
                    </div>
                                        <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <CardTitle className="text-lg truncate group-hover:text-primary transition-colors flex items-center gap-2">
                          {isFamilyCard ? `Familia ${patient.lastName}` : `${patient.name} ${patient.lastName}`}
                        </CardTitle>
                        
                        {/* Loyalty/Family Badge */}
                        <div className="flex items-center gap-1">
                          {isFamilyCard && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black text-[10px] animate-pulse">
                              {patient.family_member_count} MIEMBROS
                            </Badge>
                          )}
                          {!isFamilyCard && (() => {
                             const status = getPatientLoyaltyStatus(patient.appointments_count, patient.total_billed, (currentClinic as any)?.settings);
                             const badgeData = getLoyaltyBadgeData(status.key, status.style);
                             return (
                               <Badge 
                                 className={cn(
                                   "text-[10px] px-1.5 py-0 h-4 border uppercase tracking-tighter flex items-center transition-all",
                                   badgeData.className
                                 )}
                               >
                                 <LoyaltyIcon name={badgeData.iconName} />
                                 {status.label}
                               </Badge>
                             )
                          })()}
                        </div>
                        
                        {hasAlerts && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-rose-100 text-rose-600 p-1 rounded-full animate-pulse">
                                <ShieldAlert className="h-4 w-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-rose-600 text-white border-rose-600">
                              <p className="font-bold flex items-center gap-1 mb-1 border-b border-white/20 pb-1">
                                <ShieldAlert className="h-3 w-3" /> ALERTA MÉDICA
                              </p>
                              <ul className="text-xs space-y-0.5 list-disc list-inside">
                                {patient.hasDiabetes && <li>Diabetes</li>}
                                {patient.hasHypertension && <li>Hipertensión</li>}
                                {patient.hasHeartDisease && <li>Cardiopatía</li>}
                                {patient.isPregnant && <li>Embarazo</li>}
                                {patient.allergies && <li>Alergias: {patient.allergies}</li>}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CardDescription className="flex items-center gap-2">
                    <Badge variant={patient.status === "active" ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-5">
                      {patient.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                    
                    <FamilyCenter 
                      patientId={patient.id} 
                      patientName={isFamilyCard ? `Familia ${patient.lastName}` : `${patient.name} ${patient.lastName}`}
                      trigger={
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-6 w-6 transition-colors",
                            isFamilyCard ? "text-blue-600 bg-blue-100 hover:bg-blue-200" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      }
                    />

                    <span className="text-sm">{calculateAge(patient.birthDate)} años</span>
                    {patient.bloodType && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 border-rose-200 text-rose-600 bg-rose-50/50 uppercase">
                        {patient.bloodType}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto font-normal hover:bg-transparent group/phone"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(getWhatsAppUrl(patient.phone || "", getClinicWhatsAppMessage(patient.name, clinicName)), "_blank");
                  }}
                >
                  <div className="flex items-center text-sm text-muted-foreground group-hover/phone:text-green-600 transition-colors">
                    <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                    {patient.phone}
                  </div>
                </Button>
                {patient.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 mr-2" />
                    {patient.email}
                  </div>
                )}
                {patient.tags && patient.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {patient.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full text-secondary-foreground uppercase tracking-wider font-bold">
                        {tag}
                      </span>
                    ))}
                    {patient.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{patient.tags.length - 3}</span>}
                  </div>
                )}
                {patient.lastVisit && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    Última visita: {new Date(patient.lastVisit).toLocaleDateString("es-ES")}
                  </div>
                )}

                {/* Data Quality Score (Gamification) */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-muted-foreground">Calidad de Datos</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded",
                      profileScore >= 80 ? "bg-green-100 text-green-700" :
                      profileScore >= 50 ? "bg-blue-100 text-blue-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      {scoreLabel} {profileScore}%
                    </span>
                  </div>
                  <Progress value={profileScore} className="h-1" indicatorClassName={scoreColor} />
                </div>
              </div>
              <Button
                variant={isFamilyCard ? "default" : "outline"}
                className={cn(
                  "w-full transition-all duration-200 font-bold",
                  isFamilyCard 
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 shadow-lg" 
                    : "bg-transparent group-hover:bg-primary group-hover:text-primary-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation() 
                  if (isFamilyCard) {
                     // In group mode, we want to open family context (handled by trigger but we can force it or just push to head)
                     router.push(`/patients/${patient.id}`)
                  } else {
                     router.push(`/patients/${patient.id}`)
                  }
                }}
              >
                {isFamilyCard ? "Explorar Familia" : "Ver Detalles del Paciente"}
              </Button>
            </CardContent>
          </Card>
        )
      })}
        </div>
      </TooltipProvider>

      {hasMore && (
        <div className="flex justify-center py-8">
            <Button 
                variant="outline" 
                onClick={handleLoadMore} 
                disabled={isLoading}
                className="w-full max-w-xs shadow-sm hover:shadow-md transition-all"
            >
                {isLoading ? "Cargando..." : "Cargar más pacientes"}
            </Button>
        </div>
      )}

      {patients.length === 0 && !isLoading && (
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
