"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useTranslation } from "@/components/translations"
import { Save, X, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { patientSchema, PatientFormValues } from "@/lib/validations"

interface AddPatientFormProps {
  initialData?: any
  onSubmit: (patientData: any) => void
  onCancel: () => void
}

export function AddPatientForm({ initialData, onSubmit, onCancel }: AddPatientFormProps) {
  const { t } = useTranslation()
  const { user, currentClinicId } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
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
      bloodType: initialData?.bloodType || "",
      maritalStatus: initialData?.maritalStatus || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      hasDiabetes: initialData?.hasDiabetes || false,
      hasHypertension: initialData?.hasHypertension || false,
      hasHeartDisease: initialData?.hasHeartDisease || false,
      isSmoker: initialData?.isSmoker || false,
      isPregnant: initialData?.isPregnant || false,
      preferredContactMethod: initialData?.preferredContactMethod || "phone",
      recallMonths: initialData?.recallMonths || 6,
      internalNotes: initialData?.internalNotes || "",
      accountBalance: initialData?.accountBalance || 0,
    },
  })

  // Watch gender for select component
  const genderValue = watch("gender")

  const onFormSubmit = async (values: any) => {
    if (!currentClinicId) {
      toast.error("Error: No has seleccionado una clínica activa.")
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert([
          {
            first_name: values.name,
            last_name: values.lastName,
            email: values.email || null,
            phone: values.phone,
            address: values.address,
            birth_date: values.birthDate,
            gender: values.gender,
            occupation: values.occupation,
            guardian_name: values.guardianName,
            referral_source: values.referralSource,
            referred_by: values.referredBy,
            medical_record_number: values.medicalRecordNumber,
            clinical_notes: values.clinicalNotes,
            emergency_contact: values.emergencyContact,
            emergency_phone: values.emergencyPhone,
            allergies: values.allergies,
            medications: values.medications,
            medical_conditions: values.medicalConditions,
            insurance_provider: values.insuranceProvider,
            policy_number: values.policyNumber,
            blood_type: values.bloodType,
            marital_status: values.maritalStatus,
            city: values.city,
            state: values.state,
            has_diabetes: values.hasDiabetes,
            has_hypertension: values.hasHypertension,
            has_heart_disease: values.hasHeartDisease,
            is_smoker: values.isSmoker,
            is_pregnant: values.isPregnant,
            preferred_contact_method: values.preferredContactMethod,
            recall_months: values.recallMonths,
            internal_notes: values.internalNotes,
            account_balance: values.accountBalance,
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
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
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
                  {...register("medicalRecordNumber")}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">Ocupación</Label>
                <Input
                  id="occupation"
                  {...register("occupation")}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  className={errors.lastName ? "border-red-500" : ""}
                />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                {...register("phone")}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección *</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder="Calle y número"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="Ej: Madrid, CDMX..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado / Provincia</Label>
                <Input
                  id="state"
                  {...register("state")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de Nacimiento *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  {...register("birthDate")}
                  className={errors.birthDate ? "border-red-500" : ""}
                />
                {errors.birthDate && <p className="text-xs text-red-500">{errors.birthDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Género</Label>
                <Select value={genderValue} onValueChange={(value) => setValue("gender", value)}>
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
                {...register("guardianName")}
                placeholder="Para menores de edad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Contacto de Emergencia</Label>
              <Input
                id="emergencyContact"
                {...register("emergencyContact")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Teléfono de Emergencia</Label>
              <Input
                id="emergencyPhone"
                {...register("emergencyPhone")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="referralSource">¿Cómo nos conoció?</Label>
                    <Input
                        id="referralSource"
                        {...register("referralSource")}
                        placeholder="Ej. Instagram, Google..."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="referredBy">Referido por</Label>
                    <Input
                        id="referredBy"
                        {...register("referredBy")}
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
                {...register("clinicalNotes")}
                placeholder="Notas generales del paciente..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">Alergias</Label>
              <Textarea
                id="allergies"
                {...register("allergies")}
                placeholder="Ej: Penicilina, Látex..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medications">Medicamentos</Label>
              <Textarea
                id="medications"
                {...register("medications")}
                placeholder="Medicamentos actuales..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="bloodType">Grupo Sanguíneo</Label>
                 <Select value={watch("bloodType")} onValueChange={(value) => setValue("bloodType", value)}>
                   <SelectTrigger>
                     <SelectValue placeholder="O+..." />
                   </SelectTrigger>
                   <SelectContent>
                     {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(type => (
                       <SelectItem key={type} value={type}>{type}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="maritalStatus">Estado Civil</Label>
                 <Select value={watch("maritalStatus")} onValueChange={(value) => setValue("maritalStatus", value)}>
                   <SelectTrigger>
                     <SelectValue placeholder="Seleccionar..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="single">Soltero/a</SelectItem>
                     <SelectItem value="married">Casado/a</SelectItem>
                     <SelectItem value="divorced">Divorciado/a</SelectItem>
                     <SelectItem value="widowed">Viudo/a</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <Label className="text-rose-600 font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Alertas Clínicas (Antecedentes)
              </Label>
              <div className="grid grid-cols-2 gap-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="hasDiabetes" 
                    checked={watch("hasDiabetes")} 
                    onCheckedChange={(checked) => setValue("hasDiabetes", checked === true)} 
                  />
                  <Label htmlFor="hasDiabetes">Diabetes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="hasHypertension" 
                    checked={watch("hasHypertension")} 
                    onCheckedChange={(checked) => setValue("hasHypertension", checked === true)} 
                  />
                  <Label htmlFor="hasHypertension">Hipertensión</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="hasHeartDisease" 
                    checked={watch("hasHeartDisease")} 
                    onCheckedChange={(checked) => setValue("hasHeartDisease", checked === true)} 
                  />
                  <Label htmlFor="hasHeartDisease">Cardiopatía</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isSmoker" 
                    checked={watch("isSmoker")} 
                    onCheckedChange={(checked) => setValue("isSmoker", checked === true)} 
                  />
                  <Label htmlFor="isSmoker">Fumador/a</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isPregnant" 
                    checked={watch("isPregnant")} 
                    onCheckedChange={(checked) => setValue("isPregnant", checked === true)} 
                  />
                  <Label htmlFor="isPregnant">Embarazo</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medicalConditions">Otras Condiciones Médicas</Label>
              <Textarea
                id="medicalConditions"
                {...register("medicalConditions")}
                placeholder="Condiciones médicas relevantes..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Insurance & Administration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gestión y Seguro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recallMonths">Ciclo Recall (Meses)</Label>
                <Input
                  id="recallMonths"
                  type="number"
                  {...register("recallMonths")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Contacto Pref.</Label>
                <Select value={watch("preferredContactMethod")} onValueChange={(v) => setValue("preferredContactMethod", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Llamada</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Nota Interna / Administrativa</Label>
              <Textarea
                id="internalNotes"
                {...register("internalNotes")}
                placeholder="Solo visible para el personal..."
                rows={2}
              />
            </div>
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="insuranceProvider">Proveedor de Seguro</Label>
              <Input
                id="insuranceProvider"
                {...register("insuranceProvider")}
                placeholder="Ej: Sanitas, Adeslas..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Número de Póliza</Label>
              <Input
                id="policyNumber"
                {...register("policyNumber")}
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
