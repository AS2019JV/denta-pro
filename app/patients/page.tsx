"use client"

import { useState, useEffect } from "react"
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

  const handleAddPatient = async (patientData: any) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert([
          {
            first_name: patientData.name,
            last_name: patientData.lastName,
            email: patientData.email,
            phone: patientData.phone,
            address: patientData.address,
            birth_date: patientData.birthDate,
            gender: patientData.gender,
            // Add other fields mapping if needed
          },
        ])
        .select()

      if (error) throw error

      if (data) {
        const newPatient: Patient = {
          id: data[0].id,
          name: data[0].first_name,
          lastName: data[0].last_name,
          email: data[0].email,
          phone: data[0].phone,
          address: data[0].address,
          birthDate: data[0].birth_date,
          gender: data[0].gender,
          status: 'active',
        }
        setPatients((prev) => [newPatient, ...prev])
        setIsAddPatientOpen(false)
      }
    } catch (error) {
      console.error('Error adding patient:', error)
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

  const importDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const importedPatients = JSON.parse(e.target?.result as string)
          
          if (!Array.isArray(importedPatients)) throw new Error("Formato inválido")

          setIsLoading(true)
          
          // Map back to DB Columns
          const dbPatients = importedPatients.map((p: any) => ({
             first_name: p.name,
             last_name: p.lastName,
             cedula: p.cedula,
             email: p.email,
             phone: p.phone,
             address: p.address,
             birth_date: p.birthDate,
             gender: p.gender,
             // medical_history: ?
          }))

          // Upsert to Supabase
          const { error } = await supabase.from('patients').upsert(dbPatients, { onConflict: 'cedula' })
          
          if (error) throw error

          await fetchPatients()
          alert("Base de datos importada correctamente")
        } catch (error) {
          console.error("Error importing database:", error)
          alert("Error al importar: Revisa el formato del archivo JSON.")
        } finally {
            setIsLoading(false)
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
