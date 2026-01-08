"use client"

import { useState, useEffect } from "react"
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
import {
  Search,
  Plus,
  Download,
  Upload,
  Phone,
  Mail,
  Clock,
} from "lucide-react"

interface Patient {
  id: string
  name: string
  lastName: string
  cedula?: string
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

export default function PatientsPage() {
  const { t } = useTranslation()
  const { currentClinicId } = useAuth()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch patients from Supabase
  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        const mappedPatients: Patient[] = data.map((p: any) => ({
          id: p.id,
          name: p.first_name,
          lastName: p.last_name,
          cedula: p.cedula,
          email: p.email,
          phone: p.phone,
          address: p.address,
          birthDate: p.birth_date,
          gender: p.gender,
          status: p.status || 'active',
          lastVisit: p.last_visit,
          nextAppointment: p.next_appointment
        }))
        setPatients(mappedPatients)
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPatients = patients.filter(
    (patient) =>
      `${patient.name} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleAddPatient = (patientData: any) => {
    // Patient is already created in AddPatientForm
    if (patientData) {
      const newPatient: Patient = {
        id: patientData.id,
        name: patientData.first_name,
        lastName: patientData.last_name,
        email: patientData.email,
        phone: patientData.phone,
        address: patientData.address,
        birthDate: patientData.birth_date,
        gender: patientData.gender,
        status: 'active',
      }
      setPatients((prev) => [newPatient, ...prev])
      setIsAddPatientOpen(false)
    }
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
        alert("Error: No se ha detectado la clínica activa. Recarga la página.")
        return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        let importedPatients: any[] = []

        setIsLoading(true)

        if (file.name.endsWith('.json')) {
            importedPatients = JSON.parse(content)
            if (!Array.isArray(importedPatients)) throw new Error("Formato JSON inválido - debe ser un arreglo")
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
            console.log("Detected Headers:", headers, "Delimiter:", delimiter)
            
            importedPatients = rows.slice(1).map(row => {
                const cols = parseCSVLine(row, delimiter)
                const data: any = {}
                
                headers.forEach((header, index) => {
                     const value = cols[index] || ''
                     // Normalize: lowercase and remove accents
                     const h = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                     
                     // Flexible Header Mapping
                     if (h.includes('nombre') || h.includes('name')) data.first_name = value
                     else if (h.includes('apellido') || h.includes('last')) data.last_name = value
                     else if (h.includes('email') || h.includes('correo') || h.includes('mail')) data.email = value
                     else if (h.includes('telef') || h.includes('celular') || h.includes('phone') || h.includes('movil')) data.phone = value
                     else if (h.includes('document') || h.includes('cedula') || h.includes('dni') || h.includes('id')) data.cedula = value
                     else if (h.includes('nacim') || h.includes('birth')) data.birth_date = value
                     else if (h.includes('sex') || h.includes('genero') || h.includes('gender')) data.gender = value.toLowerCase().startsWith('m') ? 'male' : 'female'
                     else if (h.includes('direccion') || h.includes('address')) data.address = value
                     else if (h.includes('ocupacion') || h.includes('occupation')) data.occupation = value
                     else if (h.includes('apoderado') || h.includes('guardian')) data.guardian_name = value
                     else if (h.includes('conoc') || h.includes('fuente') || h.includes('source')) data.referral_source = value
                     else if (h.includes('referencia') || h.includes('referido')) data.referred_by = value
                     else if (h.includes('nota') || h.includes('observacion') || h.includes('clinical')) data.clinical_notes = value
                     else if (h.includes('alergia')) data.allergies = value
                     else if (h.includes('historia') || h.includes('hc') || h.includes('record')) data.medical_record_number = value
                     else if (h.includes('etiqueta') || h.includes('tag')) data.tags = value ? [value] : []
                })
                return data
            })
        }

        // Validate and Transform
        const dbPatients = importedPatients.map(p => ({
           first_name: p.first_name,
           last_name: p.last_name || '',
           cedula: p.cedula,
           email: p.email && p.email.trim() ? p.email.trim() : null, // Handle empty email
           phone: p.phone,
           address: p.address,
           birth_date: parseDate(p.birth_date), // Validate/Fix Date
           gender: p.gender,
           occupation: p.occupation,
           guardian_name: p.guardian_name,
           referral_source: p.referral_source,
           referred_by: p.referred_by,
           clinical_notes: p.clinical_notes,
           medical_record_number: p.medical_record_number,
           tags: p.tags,
           status: 'active', 
           clinic_id: currentClinicId
        })).filter(p => p.first_name)

        if (dbPatients.length > 0) {
            console.log(`Prepared ${dbPatients.length} patients for import`)
            console.log("Sample Patient 1:", dbPatients[0])
        }

        if (dbPatients.length === 0) {
            console.error("Detected Headers:", headers)
            const headerMsg = headers.length > 0 ? `Cabeceras detectadas: ${headers.join(', ')}` : "Formato no reconocido o sin cabeceras."
            throw new Error(`No se encontraron registros válidos (requiere al menos 'Nombre'). ${headerMsg}`)
        }

        // Upsert to Supabase - Batched for Speed (50 records per request)
        console.log(`Starting Batched Supabase upsert (${dbPatients.length} records)...`)
        
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []
        const CHUNK_SIZE = 50

        // Process in chunks
        for (let i = 0; i < dbPatients.length; i += CHUNK_SIZE) {
            const chunk = dbPatients.slice(i, i + CHUNK_SIZE)
            
            // Split by email presence to handle conflict resolution correctly
            const chunkWithEmail = chunk.filter(p => p.email)
            const chunkWithoutEmail = chunk.filter(p => !p.email)

            try {
                // 1. Handle records with email (Potential Upsert)
                if (chunkWithEmail.length > 0) {
                     const { error: upsertError } = await supabase
                        .from('patients')
                        .upsert(chunkWithEmail, { onConflict: 'email', ignoreDuplicates: false })
                     
                     if (upsertError) {
                         console.error(`Error upserting batch (emails):`, upsertError)
                         // Common error: Missing unique constraint
                         if (upsertError.code === '42P10' || upsertError.message.includes("conflict")) {
                             errors.push(`Error de base de datos: Falta restricción UNIQUE en email. Se intentará insertar sin verificar duplicados.`)
                             // Fallback to insert if upsert fails
                             const { error: fallbackError } = await supabase.from('patients').insert(chunkWithEmail)
                             if (fallbackError) {
                                 errorCount += chunkWithEmail.length
                                 errors.push(`Fallback insert failed: ${fallbackError.message}`)
                             } else {
                                 successCount += chunkWithEmail.length
                             }
                         } else {
                             errorCount += chunkWithEmail.length
                             errors.push(`Upsert error: ${upsertError.message}`)
                         }
                     } else {
                         successCount += chunkWithEmail.length
                     }
                }

                // 2. Handle records without email (Insert only, no conflict target possible usually)
                if (chunkWithoutEmail.length > 0) {
                    const { error: insertError } = await supabase
                        .from('patients')
                        .insert(chunkWithoutEmail)
                    
                    if (insertError) {
                        console.error(`Error inserting batch (no-emails):`, insertError)
                        errorCount += chunkWithoutEmail.length
                        errors.push(`Insert error: ${insertError.message}`)
                    } else {
                        successCount += chunkWithoutEmail.length
                    }
                }

            } catch (e: any) {
                 console.error(`Exception in batch ${i}:`, e)
                 errorCount += chunk.length
                 errors.push(e.message)
            }
        }

        console.log(`Import finished. Success: ${successCount}. Errors: ${errorCount}`)

        await fetchPatients()
        
        if (errorCount > 0) {
             const uniqueErrors = Array.from(new Set(errors)).slice(0, 3) // Show first 3 unique errors
             alert(`Importación parcial: ${successCount} ok, ${errorCount} fallidos.\nErrores principales:\n- ${uniqueErrors.join('\n- ')}`)
        } else {
             alert(`Importación exitosa: ${successCount} pacientes procesados.`)
        }
      } catch (error: any) {
        console.error("Error importing database:", error)
        alert("Error crítico al importar: " + error.message)
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
          <Card 
            key={patient.id} 
            className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-transparent hover:border-primary/10"
            onClick={() => router.push(`/patients/${patient.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12 group-hover:scale-105 transition-transform duration-200">
                  <AvatarImage src={`/placeholder.svg?${patient.id}`} alt={`${patient.name} ${patient.lastName}`} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {patient.name[0]}
                    {patient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                    {patient.name} {patient.lastName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant={patient.status === "active" ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-5">
                      {patient.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                    <span className="text-sm">{calculateAge(patient.birthDate)} años</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button
                variant="outline"
                className="w-full bg-transparent group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation() 
                  router.push(`/patients/${patient.id}`)
                }}
              >
                Ver Detalles del Paciente
              </Button>
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
