"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-context"
import { PageHeader } from "@/components/page-header"
import { User, Briefcase, Lock, Save, Mail, Phone, MapPin, Award, Clock, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user, hasRole } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle() // Use maybeSingle() to avoid errors when profile doesn't exist

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }
      
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: user?.email || "", // Email from auth user usually, but we can store it too
          phone: data.phone || "",
          address: data.address || "",
          specialization: data.specialization || "",
          license_number: data.license_number || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || ""
        })
      } else {
        // Profile doesn't exist yet, use default values
        console.log('Profile not found, using default values')
        setProfile({
          ...profile,
          email: user?.email || ""
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
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
          address: profile.address,
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      
      setIsLoading(true)
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: publicUrl })
      toast.success("Avatar actualizado")
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error("Error al subir imagen")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi Perfil" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-3">
            <div className="relative inline-block group">
              <Avatar className="h-24 w-24 mx-auto border-4 border-background shadow-sm">
                <AvatarImage src={profile.avatar_url || "/placeholder.svg"} alt={profile.full_name} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {profile.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <label 
                htmlFor="avatar-upload" 
                className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
                title="Cambiar foto"
              >
                <Camera className="h-4 w-4" />
                <input 
                  id="avatar-upload"
                  type="file" 
                  accept="image/*"
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={isLoading}
                />
              </label>
            </div>
            <CardTitle className="text-xl mt-3">{profile.full_name}</CardTitle>
            <CardDescription className="capitalize">
              <Badge variant="secondary" className="mt-1">
                {user?.role === "doctor" ? "Doctor" : "Recepción"}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="truncate">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p>{profile.phone || "No especificado"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Ubicación</p>
                  <p className="text-xs">{profile.address || "No especificada"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Forms */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Información Personal
              </TabsTrigger>
              {hasRole("doctor") && (
                <TabsTrigger value="professional" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Información Profesional
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>Actualiza tu información personal y de contacto</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="name"
                            className="pl-10"
                            value={profile.full_name}
                            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-10"
                            value={profile.email}
                            disabled
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            className="pl-10"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="address"
                            className="pl-10"
                            value={profile.address}
                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Guardando..." : "Guardar Cambios"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {hasRole("doctor") && (
              <TabsContent value="professional">
                <Card>
                  <CardHeader>
                    <CardTitle>Información Profesional</CardTitle>
                    <CardDescription>Credenciales y experiencia profesional</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="license">Número de Licencia</Label>
                          <div className="relative">
                            <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="license"
                              className="pl-10"
                              value={profile.license_number}
                              onChange={(e) =>
                                setProfile({ ...profile, license_number: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specialization">Especialización</Label>
                          <Input
                            id="specialization"
                            value={profile.specialization}
                            onChange={(e) =>
                              setProfile({ ...profile, specialization: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="bio">Biografía / Perfil Profesional</Label>
                          <Input
                            id="bio"
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                          />
                        </div>
                      </div>

                      <Separator />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                          <Save className="h-4 w-4 mr-2" />
                          {isLoading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
