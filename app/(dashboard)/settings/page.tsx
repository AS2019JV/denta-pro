"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/components/translations"
import { Settings, Bell, Shield, Save, Sun, Moon, Monitor, CreditCard, Zap, Mail, Phone, History } from "lucide-react"
import { SubscriptionTab } from "@/components/settings/subscription-tab"
import { PrivacyTab } from "@/components/settings/privacy-tab"
import { AutomationTab } from "@/components/settings/automation-tab"

import { toast } from "sonner"

import { useTheme } from "next-themes"
import { useAuth } from "@/components/auth-context"
import { APP_CONFIG } from "@/lib/constants"

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

  const handleGeneralSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLanguage(generalSettings.language as "es" | "en")
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsLoading(false)
    toast.success("Ajustes generales guardados")
  }

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
          <TabsList className="bg-slate-100/80 dark:bg-muted/50 p-1 border-border h-auto inline-flex whitespace-nowrap">
            <TabsTrigger value="general" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4" />
              Seguridad
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
                    <Label htmlFor="language" className="font-semibold text-foreground/80">Idioma</Label>
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
                    <Label className="font-semibold text-foreground/80">Tema</Label>
                    <div className="flex p-1 bg-muted rounded-lg border border-border w-full md:w-max">
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
                            : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="timezone" className="font-semibold text-foreground/80">Zona Horaria</Label>
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
                    <Label htmlFor="dateformat" className="font-semibold text-foreground/80">Fecha</Label>
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
                 <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center text-muted-foreground shadow-sm border border-border/50">
                       <item.icon className="h-5 w-5" />
                     </div>
                     <div className="space-y-0.5">
                       <Label className="text-base font-bold text-foreground/90">{item.label}</Label>
                       <p className="text-xs text-muted-foreground">{item.desc}</p>
                     </div>
                   </div>
                   <Switch defaultChecked={item.id !== 'sms'} />
                 </div>
               ))}
            </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="security" className="animate-in slide-in-from-bottom-4 duration-300">
          <PrivacyTab />
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
