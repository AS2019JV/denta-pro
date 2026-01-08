"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/components/translations"
import { Save, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

interface AddPatientFormProps {
  initialData?: any
  onSubmit: (patientData: any) => void
  onCancel: () => void
}

export function AddPatientForm({ initialData, onSubmit, onCancel }: AddPatientFormProps) {
  const { t } = useTranslation()
  const { user, currentClinicId } = useAuth()
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    lastName: initialData?.lastName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    birthDate: initialData?.birthDate || "",
    gender: initialData?.gender || "",
    occupation: initialData?.occupation || "",
    guardianName: initialData?.guardianName || "",
    referralSource: initialData?.referralSource || "",
    referredBy: initialData?.referredBy || "",
    medicalRecordNumber: initialData?.medicalRecordNumber || "",
    clinicalNotes: initialData?.clinicalNotes || "",
    emergencyContact: initialData?.emergencyContact || "",
    emergencyPhone: initialData?.emergencyPhone || "",
    allergies: initialData?.allergies || "",
    medications: initialData?.medications || "",
    medicalConditions: initialData?.medicalConditions || "",
    insuranceProvider: initialData?.insuranceProvider || "",
    policyNumber: initialData?.policyNumber || "",
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentClinicId) {
      toast.error("Error: No has seleccionado una clínica activa. Por favor selecciona una.")
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('patients')
        .insert([
          {
            first_name: formData.name,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            birth_date: formData.birthDate,
            gender: formData.gender,
            occupation: formData.occupation,
            guardian_name: formData.guardianName,
            referral_source: formData.referralSource,
            referred_by: formData.referredBy,
            medical_record_number: formData.medicalRecordNumber,
            clinical_notes: formData.clinicalNotes,
            emergency_contact: formData.emergencyContact,
            emergency_phone: formData.emergencyPhone,
            allergies: formData.allergies,
            medications: formData.medications,
            medical_conditions: formData.medicalConditions,
            insurance_provider: formData.insuranceProvider,
            policy_number: formData.policyNumber,
            clinic_id: currentClinicId,
          }
        ])
        .select()
        .single()

      if (error) throw error

      toast.success("Paciente registrado correctamente")
      onSubmit(data)
    } catch (error) {
      console.error("Error creating patient:", error)
      toast.error("Error al registrar paciente")
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medicalRecordNumber">Nº Historia Clínica (HC)</Label>
                <Input
                  id="medicalRecordNumber"
                  value={formData.medicalRecordNumber}
                  onChange={(e) => handleInputChange("medicalRecordNumber", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">Ocupación</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange("occupation", e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de Nacimiento *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange("birthDate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Género</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información de Contacto y Referencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
              <Label htmlFor="guardianName">Apoderado / Responsable</Label>
              <Input
                id="guardianName"
                value={formData.guardianName}
                onChange={(e) => handleInputChange("guardianName", e.target.value)}
                placeholder="Para menores de edad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Contacto de Emergencia</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange("emergencyContact", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Teléfono de Emergencia</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) => handleInputChange("emergencyPhone", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="referralSource">¿Cómo nos conoció?</Label>
                    <Input
                        id="referralSource"
                        value={formData.referralSource}
                        onChange={(e) => handleInputChange("referralSource", e.target.value)}
                        placeholder="Ej. Instagram, Google..."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="referredBy">Referido por</Label>
                    <Input
                        id="referredBy"
                        value={formData.referredBy}
                        onChange={(e) => handleInputChange("referredBy", e.target.value)}
                        placeholder="Nombre de quien refirió"
                    />
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Médica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
              <Label htmlFor="clinicalNotes">Nota Clínica Inicial / Observaciones</Label>
              <Textarea
                id="clinicalNotes"
                value={formData.clinicalNotes}
                onChange={(e) => handleInputChange("clinicalNotes", e.target.value)}
                placeholder="Notas generales del paciente..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">Alergias</Label>
              <Textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => handleInputChange("allergies", e.target.value)}
                placeholder="Ej: Penicilina, Látex..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medications">Medicamentos</Label>
              <Textarea
                id="medications"
                value={formData.medications}
                onChange={(e) => handleInputChange("medications", e.target.value)}
                placeholder="Medicamentos actuales..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicalConditions">Condiciones Médicas</Label>
              <Textarea
                id="medicalConditions"
                value={formData.medicalConditions}
                onChange={(e) => handleInputChange("medicalConditions", e.target.value)}
                placeholder="Condiciones médicas relevantes..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Insurance Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del Seguro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insuranceProvider">Proveedor de Seguro</Label>
              <Input
                id="insuranceProvider"
                value={formData.insuranceProvider}
                onChange={(e) => handleInputChange("insuranceProvider", e.target.value)}
                placeholder="Ej: Sanitas, Adeslas..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Número de Póliza</Label>
              <Input
                id="policyNumber"
                value={formData.policyNumber}
                onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                placeholder="Número de póliza..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
