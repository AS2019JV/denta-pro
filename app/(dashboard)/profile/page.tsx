"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-context"
import { PageHeader } from "@/components/page-header"
import { AvatarUpload } from "@/components/avatar-upload"
import { User, Briefcase, Lock, Save, Mail, Phone, MapPin, Award, Clock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user, hasRole } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    specialization: "",
    license_number: "",
    bio: "",
    avatar_url: ""
  })

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
      }
      
      const authName = user?.name || "Especialista"
      const authEmail = user?.email || ""

      if (data) {
        setProfile({
          full_name: data.full_name || authName,
          email: authEmail,
          phone: data.phone || "",
          specialization: data.specialization || "",
          license_number: data.license_number || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || ""
        })
      } else {
        setProfile({
          ...profile,
          full_name: authName,
          email: authEmail
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(prev => ({
        ...prev,
        full_name: user?.name || "Especialista",
        email: user?.email || ""
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          specialization: profile.specialization,
          license_number: profile.license_number,
          bio: profile.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (error) throw error
      toast.success("Perfil actualizado correctamente")
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error("Error al actualizar el perfil")
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleLabel = () => {
    if (user?.role === 'clinic_owner') return "Dirección Clínica"
    if (user?.role === 'doctor') return "Especialista"
    if (user?.role === 'receptionist') return "Gestión Administrativa"
    return "Usuario"
  }

  if (isLoading && !profile.full_name) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-8 w-64 bg-slate-200 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 h-96 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-8 space-y-6">
             <div className="h-10 w-full bg-slate-100 rounded-lg" />
             <div className="h-64 w-full bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <p className="text-sm font-medium text-teal-600 mb-1">Configuración de Cuenta</p>
           <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi Perfil</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Summary */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-teal-500 to-blue-600" />
            <CardHeader className="text-center -mt-12 pb-6">
              <div className="flex justify-center mb-4">
                <div className="p-1 bg-card rounded-full shadow-lg">
                  <AvatarUpload
                    uid={user?.id || 'temp-id'}
                    url={profile.avatar_url || null}
                    bucket="doctor-avatars"
                    size={120}
                    fallbackName={profile.full_name || "Usuario"}
                    onUpload={async (url) => {
                      if (user?.id) {
                        const { error } = await supabase
                          .from('profiles')
                          .update({ avatar_url: url, updated_at: new Date().toISOString() })
                          .eq('id', user.id)
                        
                        if (error) {
                          toast.error("Error al actualizar avatar")
                        } else {
                          setProfile({ ...profile, avatar_url: url })
                          toast.success("Foto de perfil actualizada")
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <CardTitle className="text-xl font-bold text-foreground">{profile.full_name}</CardTitle>
              <div className="flex justify-center mt-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-3 py-1 font-medium">
                  {getRoleLabel()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-5">
              <Separator className="bg-slate-100" />
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Email Profesional</p>
                    <p className="truncate font-medium text-slate-700">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">WhatsApp / Teléfono</p>
                    <p className="font-medium text-slate-700">{profile.phone || "No especificado"}</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
                  <p className="text-xs text-teal-700 font-medium mb-1">Estatus de Cuenta</p>
                  <p className="text-[10px] text-teal-600 leading-relaxed">
                    Tu perfil es visible para tu equipo médico. Mantén tu información actualizada para la gestión de citas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Area */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList className="bg-slate-100/80 p-1 border-border w-full md:w-auto">
              <TabsTrigger value="personal" className="flex items-center gap-2 px-6 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <User className="h-4 w-4" />
                Información Personal
              </TabsTrigger>
              {hasRole("doctor") || hasRole("clinic_owner") ? (
                <TabsTrigger value="professional" className="flex items-center gap-2 px-6 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Briefcase className="h-4 w-4" />
                  Información Profesional
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="personal" className="mt-0 animate-in slide-in-from-bottom-4 duration-300">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Datos de Identidad</CardTitle>
                  <CardDescription>Información esencial para tu registro en Clinia+</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-700 font-medium">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="name"
                            placeholder="Escribe tu nombre completo"
                            className="pl-10 h-11 border-border focus:ring-teal-500 focus:border-teal-500 transition-all"
                            value={profile.full_name}
                            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700 font-medium">Correo Electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-10 h-11 bg-muted/50 border-border text-slate-500 cursor-not-allowed"
                            value={profile.email}
                            disabled
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">El email no puede ser modificado por seguridad</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-slate-700 font-medium">Teléfono / Celular</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="phone"
                            placeholder="+593 99 999 9999"
                            className="pl-10 h-11 border-border focus:ring-teal-500 focus:border-teal-500 transition-all"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 h-11 px-8 font-bold shadow-md shadow-teal-600/20">
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Actualizando..." : "Guardar Perfil"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="professional" className="mt-0 animate-in slide-in-from-bottom-4 duration-300">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Credenciales Clínicas</CardTitle>
                  <CardDescription>Esta información es fundamental para tus recetas y registros médicos</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="license" className="text-slate-700 font-medium">Número de Licencia / Registro SENESCYT</Label>
                        <div className="relative">
                          <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="license"
                            placeholder="Ej. 1025-15-123456"
                            className="pl-10 h-11 border-border focus:ring-teal-500 focus:border-teal-500"
                            value={profile.license_number}
                            onChange={(e) =>
                              setProfile({ ...profile, license_number: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specialization" className="text-slate-700 font-medium">Especialidad Principal</Label>
                        <div className="relative">
                           <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                           <Input
                            id="specialization"
                            placeholder="Ej. Rehabilitación Oral y Estética"
                            className="pl-10 h-11 border-border focus:ring-teal-500 focus:border-teal-500"
                            value={profile.specialization}
                            onChange={(e) =>
                              setProfile({ ...profile, specialization: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="bio" className="text-slate-700 font-medium">Resumen Profesional / Perfil</Label>
                        <Textarea
                          id="bio"
                          placeholder="Describe brevemente tu trayectoria académica y profesional..."
                          className="min-h-[120px] border-border focus:ring-teal-500 focus:border-teal-500 leading-relaxed"
                          value={profile.bio}
                          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        />
                        <p className="text-[10px] text-slate-400">Este resumen puede ser utilizado en tu perfil público para pacientes.</p>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 h-11 px-8 font-bold shadow-md shadow-teal-600/20">
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Actualizando..." : "Guardar Credenciales"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
