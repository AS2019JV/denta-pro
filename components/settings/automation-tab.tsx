"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Save, Bell, Sparkles, Crown, Gift, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

export function AutomationTab() {
  const { currentClinicId } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<any>({
    loyalty_enabled: false,
    vip_welcome_enabled: true,
    birthday_greet_enabled: true,
    vip_threshold_amount: 1000,
    vip_threshold_appointments: 10,
    vip_message_template: ""
  })

  useEffect(() => {
    fetchSettings()
  }, [currentClinicId])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('clinic_id', currentClinicId)
        .maybeSingle()

      if (data) {
        setSettings(data)
      }
    } catch (error) {
      console.error("Error fetching automation settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          clinic_id: currentClinicId,
          ...settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success("Configuración de automatización guardada correctamente")
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="bg-primary/5 pb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Marketing de Fidelización Automatizado</CardTitle>
              <CardDescription>
                Aumente la retención de sus pacientes mediante campañas automáticas de VIP y felicitaciones.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base font-bold">Activar Módulo de Fidelización</Label>
              <p className="text-sm text-muted-foreground">Habilita el escaneo diario de pacientes para campañas de marketing.</p>
            </div>
            <Switch 
              checked={settings.loyalty_enabled} 
              onCheckedChange={(val) => setSettings({...settings, loyalty_enabled: val})}
            />
          </div>

          <div className={`space-y-8 transition-all duration-300 ${!settings.loyalty_enabled ? "opacity-40 pointer-events-none grayscale" : ""}`}>
            {/* VIP Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-slate-100 shadow-none">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Umbrales VIP</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400">Facturación Acumulada ($)</Label>
                    <Input 
                      type="number" 
                      value={settings.vip_threshold_amount}
                      onChange={(e) => setSettings({...settings, vip_threshold_amount: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400">Número de Citas</Label>
                    <Input 
                      type="number" 
                      value={settings.vip_threshold_appointments}
                      onChange={(e) => setSettings({...settings, vip_threshold_appointments: parseInt(e.target.value)})}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-none">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Notificación de Bienvenida</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Auto-enviar saludo VIP</Label>
                    <Switch 
                      checked={settings.vip_welcome_enabled}
                      onCheckedChange={(val) => setSettings({...settings, vip_welcome_enabled: val})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400">Plantilla de Mensaje</Label>
                    <Textarea 
                      className="text-xs min-h-[80px]"
                      placeholder="Usa {patient_name} y {clinic_name}..."
                      value={settings.vip_message_template}
                      onChange={(e) => setSettings({...settings, vip_message_template: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Special Occasions */}
            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Gift className="h-5 w-5 text-pink-500" />
                        <div>
                            <h4 className="text-sm font-bold">Felicitaciones de Cumpleaños</h4>
                            <p className="text-xs text-muted-foreground">Envía un mensaje automático el día de su cumpleaños.</p>
                        </div>
                    </div>
                    <Switch 
                      checked={settings.birthday_greet_enabled}
                      onCheckedChange={(val) => setSettings({...settings, birthday_greet_enabled: val})}
                    />
                </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="shadow-lg hover:shadow-xl transition-all">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Automatización
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 italic text-xs text-amber-700">
          <Sparkles className="h-4 w-4 flex-none" />
          Pro-Tip: Configura el umbral VIP ligeramente por encima de tu promedio para incentivar a los pacientes a agendar su próxima cita y recibir el beneficio automático.
      </div>
    </div>
  )
}
