"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { User, Briefcase, Lock, Save, Mail, Phone, MapPin, Calendar, Award, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function ProfilePage() {
  const { user, hasRole } = useAuth()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "+34 123 456 789",
    address: "Calle Mayor 123, Madrid",
    birthDate: "1985-05-15",
    emergencyContact: "Ana García",
    emergencyPhone: "+34 987 654 321",
  })

  const [professionalInfo, setProfessionalInfo] = useState({
    licenseNumber: "COL12345",
    specialization: "Odontología General",
    experience: "10 años",
    education: "Universidad Complutense de Madrid",
    certifications: "Implantología, Ortodoncia",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handleProfessionalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return
    }
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile")} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-3">
            <div className="relative inline-block">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="outline"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-background"
              >
                <User className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-xl mt-3">{user?.name}</CardTitle>
            <CardDescription className="capitalize">
              <Badge variant="secondary" className="mt-1">
                {user?.role === "doctor" ? t("doctor") : t("reception")}
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
                  <p className="truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p>{personalInfo.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Ubicación</p>
                  <p className="text-xs">{personalInfo.address}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Perfil Completo</span>
                <span className="font-medium">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Profile Forms */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
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
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Seguridad
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>Actualiza tu información personal y de contacto</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePersonalInfoSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="name"
                            className="pl-10"
                            value={personalInfo.name}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })}
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
                            value={personalInfo.email}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
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
                            value={personalInfo.phone}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="birthDate"
                            type="date"
                            className="pl-10"
                            value={personalInfo.birthDate}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, birthDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Dirección</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="address"
                            className="pl-10"
                            value={personalInfo.address}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Contacto de Emergencia</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="emergencyContact">Nombre del Contacto</Label>
                          <Input
                            id="emergencyContact"
                            value={personalInfo.emergencyContact}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, emergencyContact: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="emergencyPhone">Teléfono de Emergencia</Label>
                          <Input
                            id="emergencyPhone"
                            value={personalInfo.emergencyPhone}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, emergencyPhone: e.target.value })}
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
                    <form onSubmit={handleProfessionalInfoSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="license">Número de Licencia</Label>
                          <div className="relative">
                            <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="license"
                              className="pl-10"
                              value={professionalInfo.licenseNumber}
                              onChange={(e) =>
                                setProfessionalInfo({ ...professionalInfo, licenseNumber: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specialization">Especialización</Label>
                          <Input
                            id="specialization"
                            value={professionalInfo.specialization}
                            onChange={(e) =>
                              setProfessionalInfo({ ...professionalInfo, specialization: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience">Años de Experiencia</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="experience"
                              className="pl-10"
                              value={professionalInfo.experience}
                              onChange={(e) => setProfessionalInfo({ ...professionalInfo, experience: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="education">Educación</Label>
                          <Input
                            id="education"
                            value={professionalInfo.education}
                            onChange={(e) => setProfessionalInfo({ ...professionalInfo, education: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="certifications">Certificaciones</Label>
                          <Input
                            id="certifications"
                            placeholder="Separadas por comas"
                            value={professionalInfo.certifications}
                            onChange={(e) =>
                              setProfessionalInfo({ ...professionalInfo, certifications: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <h3 className="text-sm font-medium">Estadísticas Profesionales</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-primary">1,234</p>
                            <p className="text-xs text-muted-foreground">Pacientes Atendidos</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-primary">4.9</p>
                            <p className="text-xs text-muted-foreground">Calificación Promedio</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-primary">10</p>
                            <p className="text-xs text-muted-foreground">Años de Experiencia</p>
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
            )}

            <TabsContent value="password">
              <Card>
                <CardHeader>
                  <CardTitle>Cambiar Contraseña</CardTitle>
                  <CardDescription>Actualiza tu contraseña de acceso al sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Contraseña Actual</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Nueva Contraseña</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Mínimo 8 caracteres, incluye mayúsculas, minúsculas y números
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Recomendaciones de Seguridad
                      </h3>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                        <li>Usa una contraseña única que no uses en otros sitios</li>
                        <li>Incluye una combinación de letras, números y símbolos</li>
                        <li>Cambia tu contraseña regularmente</li>
                        <li>No compartas tu contraseña con nadie</li>
                      </ul>
                    </div>

                    <Separator />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={
                          isLoading ||
                          !passwordData.currentPassword ||
                          !passwordData.newPassword ||
                          passwordData.newPassword !== passwordData.confirmPassword
                        }
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Guardando..." : "Cambiar Contraseña"}
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
