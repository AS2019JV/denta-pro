"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Building2, Mail, Phone, MapPin, Globe, FileText, Save, Loader2, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { AvatarUpload } from "@/components/avatar-upload"

export function ClinicTab() {
  const { user, currentClinicId } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [clinicData, setClinicData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    logo_url: "",
    tax_id: "", // RUC / NIT
    website: "",
    specialties: ""
  })

  useEffect(() => {
    if (currentClinicId) {
      fetchClinicData()
    }
  }, [currentClinicId])

  const fetchClinicData = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', currentClinicId)
        .single()

      if (error) throw error

      if (data) {
        setClinicData({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          logo_url: data.logo_url || "",
          tax_id: data.settings?.tax_id || "",
          website: data.settings?.website || "",
          specialties: data.settings?.specialties || ""
        })
      }
    } catch (error) {
      console.error("Error fetching clinic data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.role !== 'clinic_owner') {
      toast.error("Solo la Dirección Clínica puede editar esta información")
      return
    }
    
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          name: clinicData.name,
          email: clinicData.email,
          phone: clinicData.phone,
          address: clinicData.address,
          settings: {
            tax_id: clinicData.tax_id,
            website: clinicData.website,
            specialties: clinicData.specialties,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', currentClinicId)

      if (error) throw error
      toast.success("Información de la clínica actualizada")
    } catch (error: any) {
      toast.error("Error al actualizar: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-64 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  const isEditable = user?.role === 'clinic_owner'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo & Identity Summary */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm overflow-hidden">
          <div className="h-2 w-full bg-teal-600" />
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
               <div className="p-2 bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-teal-400 transition-colors group relative">
                  <AvatarUpload
                    uid={currentClinicId || 'clinic-id'}
                    url={clinicData.logo_url}
                    bucket="clinic-branding"
                    size={140}
                    fallbackName={clinicData.name}
                    onUpload={async (url) => {
                       if (currentClinicId && isEditable) {
                          const { error } = await supabase
                            .from('clinics')
                            .update({ logo_url: url })
                            .eq('id', currentClinicId)
                          
                          if (!error) {
                            setClinicData({ ...clinicData, logo_url: url })
                            toast.success("Logo de la clínica actualizado")
                          }
                       }
                    }}
                  />
                  {!clinicData.logo_url && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 opacity-60">
                       <ImageIcon className="h-8 w-8 mb-1" />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Logo Clínico</span>
                    </div>
                  )}
               </div>
            </div>
            <CardTitle className="text-xl font-bold">{clinicData.name}</CardTitle>
            <CardDescription>Identidad institucional de tu práctica médica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Separator className="bg-slate-100" />
             <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                <p className="text-xs text-amber-800 font-bold mb-1 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  IMPORTANTE
                </p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Esta información aparecerá en tus recetas médicas, facturas y correos electrónicos enviados a pacientes. Asegúrate de que los datos sean oficiales.
                </p>
             </div>
          </CardContent>
        </Card>

        {/* Main Clinic Form */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-600" />
              Información Institucional
            </CardTitle>
            <CardDescription>Datos legales y de contacto de la clínica</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="clinicName" className="text-slate-700 font-medium">Nombre de la Clínica / Consultorio</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="clinicName"
                      disabled={!isEditable}
                      className="pl-10 h-11 border-border focus:ring-teal-500"
                      value={clinicData.name}
                      onChange={(e) => setClinicData({...clinicData, name: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taxId" className="text-slate-700 font-medium">Identificación Fiscal (RUC / NIT)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="taxId"
                      placeholder="Ej. 1792345678001"
                      disabled={!isEditable}
                      className="pl-10 h-11 border-border focus:ring-teal-500"
                      value={clinicData.tax_id}
                      onChange={(e) => setClinicData({...clinicData, tax_id: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicPhone" className="text-slate-700 font-medium">Teléfono de Contacto</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="clinicPhone"
                      placeholder="+593 2 2999 999"
                      disabled={!isEditable}
                      className="pl-10 h-11 border-border focus:ring-teal-500"
                      value={clinicData.phone}
                      onChange={(e) => setClinicData({...clinicData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicEmail" className="text-slate-700 font-medium">Correo Institucional</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="clinicEmail"
                      type="email"
                      placeholder="contacto@tuclinica.com"
                      disabled={!isEditable}
                      className="pl-10 h-11 border-border focus:ring-teal-500"
                      value={clinicData.email}
                      onChange={(e) => setClinicData({...clinicData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="clinicWebsite" className="text-slate-700 font-medium">Sitio Web</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="clinicWebsite"
                      placeholder="https://www.tuclinica.com"
                      disabled={!isEditable}
                      className="pl-10 h-11 border-border focus:ring-teal-500"
                      value={clinicData.website}
                      onChange={(e) => setClinicData({...clinicData, website: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="clinicAddress" className="text-slate-700 font-medium">Dirección Física Completa</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <textarea
                      id="clinicAddress"
                      placeholder="Ej. Av. Amazonas N32-12 y La Niña, Edificio Signature, Piso 4"
                      disabled={!isEditable}
                      className="w-full min-h-[80px] pl-10 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all disabled:opacity-50"
                      value={clinicData.address}
                      onChange={(e) => setClinicData({...clinicData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {isEditable && (
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 h-11 px-10 font-bold shadow-md shadow-teal-600/20">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
