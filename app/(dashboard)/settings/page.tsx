"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/components/translations"
import { Settings, Bell, Shield, Database, Save, Sun, Moon, Monitor, Users, UserPlus, RefreshCw, CreditCard, Lock, Zap, Building2, Search as SearchIcon, Mail, Phone, History, Stethoscope, ClipboardList } from "lucide-react"
import { SubscriptionTab } from "@/components/settings/subscription-tab"
import { PrivacyTab } from "@/components/settings/privacy-tab"
import { AutomationTab } from "@/components/settings/automation-tab"
import { ClinicTab } from "@/components/settings/clinic-tab"
import { ServicesTab } from "@/components/settings/services-tab"
import { RecipesTab } from "@/components/settings/recipes-tab"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { useTheme } from "next-themes"
import { useAuth } from "@/components/auth-context"
import { APP_CONFIG } from "@/lib/constants"
import { supabase } from "@/lib/supabase"

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  clinic_id: string
}

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("general")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab) setActiveTab(tab)
  }, [])

  const isAdmin = user?.role === "clinic_owner"

  const [generalSettings, setGeneralSettings] = useState({
    language: language,
    theme: theme || "system",
    timeZone: APP_CONFIG.timezone,
    dateFormat: "dd/mm/yyyy",
  })

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [searchMember, setSearchMember] = useState("")
  const [isInviteLoading, setIsInviteLoading] = useState(false)
  const [inviteData, setInviteData] = useState({
    email: "",
    fullName: "",
    role: "doctor"
  })

  useEffect(() => {
    fetchTeamMembers()
  }, [user])

  const fetchTeamMembers = async () => {
    if (!user?.id) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.clinic_id) {
       const { data: members } = await supabase
         .from('profiles')
         .select('*')
         .eq('clinic_id', profile.clinic_id)
       if (members) setTeamMembers(members)
    }
  }

  const handleInviteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviteLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: inviteData
      })
      if (error) throw error
      toast.success(`${t("invite-sent")} ${inviteData.email}`)
      setInviteData({ email: "", fullName: "", role: "doctor" })
      fetchTeamMembers()
    } catch (error: any) {
      toast.error(error.message || "Error al invitar al usuario")
    } finally {
      setIsInviteLoading(false)
    }
  }

  const handleGeneralSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLanguage(generalSettings.language as "es" | "en")
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsLoading(false)
    toast.success("Ajustes generales guardados")
  }

  const filteredMembers = teamMembers.filter(m => 
    m.full_name?.toLowerCase().includes(searchMember.toLowerCase()) || 
    m.email?.toLowerCase().includes(searchMember.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <p className="text-sm font-medium text-teal-600 mb-1">Centro de Control</p>
           <h1 className="text-3xl font-bold tracking-tight text-foreground">Configuración</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-slate-100/80 p-1 border-border h-auto inline-flex whitespace-nowrap">
            <TabsTrigger value="general" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="clinic" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Building2 className="h-4 w-4 text-teal-600" />
                Mi Clínica
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="services" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Stethoscope className="h-4 w-4 text-teal-600" />
                Servicios
              </TabsTrigger>
            )}
            <TabsTrigger value="recipes" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <ClipboardList className="h-4 w-4 text-teal-600" />
              Recetas
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4" />
              Seguridad
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              Equipo
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              Automatización
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4" />
              Suscripción
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="animate-in slide-in-from-bottom-4 duration-300">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Ajustes Generales</CardTitle>
              <CardDescription>Idioma, tema y formatos regionales</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGeneralSettingsSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="language" className="font-semibold text-slate-700">Idioma</Label>
                    <Select
                      value={generalSettings.language}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, language: value as "es" | "en" })}
                    >
                      <SelectTrigger className="h-11 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español (Latinoamérica)</SelectItem>
                        <SelectItem value="en">English (US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-semibold text-slate-700">Tema</Label>
                    <div className="flex p-1 bg-slate-100 rounded-lg border border-border w-full md:w-max">
                      {[
                        { id: 'light', icon: Sun, label: 'Claro' },
                        { id: 'dark', icon: Moon, label: 'Oscuro' },
                        { id: 'system', icon: Monitor, label: 'Sistema' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTheme(item.id)
                            setGeneralSettings({ ...generalSettings, theme: item.id })
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${
                            theme === item.id 
                            ? 'bg-card shadow-sm text-teal-600' 
                            : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="timezone" className="font-semibold text-slate-700">Zona Horaria</Label>
                    <Select
                      value={generalSettings.timeZone}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, timeZone: value })}
                    >
                      <SelectTrigger className="h-11 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Guayaquil">Guayaquil (GMT-5)</SelectItem>
                        <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                        <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="dateformat" className="font-semibold text-slate-700">Fecha</Label>
                    <Select
                      value={generalSettings.dateFormat}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, dateFormat: value })}
                    >
                      <SelectTrigger className="h-11 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/mm/yyyy">DD / MM / YYYY</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM / DD / YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY - MM - DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 h-11 px-8 font-bold">
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "Guardando..." : "Guardar Ajustes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="clinic" className="animate-in slide-in-from-bottom-4 duration-300">
            <ClinicTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="services" className="animate-in slide-in-from-bottom-4 duration-300">
            <ServicesTab />
          </TabsContent>
        )}

        <TabsContent value="recipes" className="animate-in slide-in-from-bottom-4 duration-300">
          <RecipesTab />
        </TabsContent>

        <TabsContent value="notifications" className="animate-in slide-in-from-bottom-4 duration-300">
           <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Canales de Comunicación</CardTitle>
              <CardDescription>Notificaciones del sistema y recordatorios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               {[
                 { id: 'email', label: 'Email', desc: 'Resúmenes y reportes.', icon: Mail },
                 { id: 'push', label: 'Push', desc: 'Alertas en el navegador.', icon: Bell },
                 { id: 'sms', label: 'SMS', desc: 'Alertas críticas.', icon: Phone },
                 { id: 'reminders', label: 'Recordatorios', desc: 'Confirmaciones de citas.', icon: History }
               ].map((item) => (
                 <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50/50 rounded-xl border border-border/50">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center text-slate-400 shadow-sm border border-border/50">
                       <item.icon className="h-5 w-5" />
                     </div>
                     <div className="space-y-0.5">
                       <Label className="text-base font-bold text-foreground/90">{item.label}</Label>
                       <p className="text-xs text-slate-500">{item.desc}</p>
                     </div>
                   </div>
                   <Switch defaultChecked={item.id !== 'sms'} />
                 </div>
               ))}
            </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="team" className="animate-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-6">
            {isAdmin && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Invitar Miembro</CardTitle>
                  <CardDescription>Envía una invitación por correo</CardDescription>
                </CardHeader>
                <CardContent>
                   <form onSubmit={handleInviteUserSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Input 
                        placeholder="Nombre Completo" 
                        value={inviteData.fullName}
                        className="h-11 border-border"
                        onChange={(e) => setInviteData({...inviteData, fullName: e.target.value})}
                      />
                      <Input 
                        placeholder="Correo" 
                        type="email"
                        value={inviteData.email}
                        className="h-11 border-border"
                        onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                      />
                      <Select value={inviteData.role} onValueChange={(val) => setInviteData({...inviteData, role: val})}>
                        <SelectTrigger className="h-11 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinic_owner">Administrador</SelectItem>
                          <SelectItem value="doctor">Especialista</SelectItem>
                          <SelectItem value="receptionist">Gestión</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="submit" disabled={isInviteLoading} className="h-11 bg-slate-900 font-bold">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invitar
                      </Button>
                   </form>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60 shadow-sm">
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <div>
                   <CardTitle>Equipo Actual</CardTitle>
                 </div>
                 <div className="relative w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar..." 
                      className="pl-9 h-10 border-border"
                      value={searchMember}
                      onChange={(e) => setSearchMember(e.target.value)}
                    />
                 </div>
               </CardHeader>
               <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {filteredMembers.map(member => (
                         <TableRow key={member.id} className="border-slate-50">
                           <TableCell className="font-bold text-slate-700">{member.full_name}</TableCell>
                           <TableCell className="text-slate-500">{member.email}</TableCell>
                           <TableCell>
                             <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                               {member.role === 'clinic_owner' ? 'Dirección' : (member.role === 'receptionist' ? 'Gestión' : 'Especialista')}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-8 font-bold text-teal-600">Perfil</Button>
                           </TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                  </Table>
               </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="animate-in slide-in-from-bottom-4 duration-300">
           <AutomationTab />
        </TabsContent>

        <TabsContent value="subscription" className="animate-in slide-in-from-bottom-4 duration-300">
           <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
