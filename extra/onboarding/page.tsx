"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { Loader2, ArrowRight, Building2, CheckCircle2, ShieldCheck, Zap } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    clinicName: "",
    clinicSize: "1-2"
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? null)
    })
  }, [])

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Debes iniciar sesión primero")

      // 1. Create Clinic via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_tenant_clinic', {
        clinic_name: formData.clinicName,
        clinic_address: "Not Provided",
        clinic_phone: "Not Provided"
      })

      if (rpcError) throw rpcError

      // 2. Update Clinic size using the new column
      if (rpcData?.clinic_id) {
          const { error: clinicUpdateError } = await supabase
            .from("clinics")
            .update({
               size: formData.clinicSize,
               settings: { practice_size: formData.clinicSize } // fallback in settings
            })
            .eq("id", rpcData.clinic_id)
            
          if (clinicUpdateError) console.error("Error updating clinic size", clinicUpdateError)
      }

      toast.success("¡Clínica configurada exitosamente!")
      
      await supabase.auth.refreshSession()
      
      router.push("/dashboard")
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al crear la clínica")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-text">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex w-[45%] bg-[#0A2E2A] flex-col justify-between px-12 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-teal-500/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[0%] right-[-20%] w-[80%] h-[80%] bg-emerald-500/20 rounded-full blur-[150px]"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="Clinia Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Clinia +</span>
        </div>

        <div className="relative z-10 space-y-8 mt-8 flex-1 flex flex-col justify-center">
          <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
            Último paso para transformar tu clínica.
          </h1>
          <p className="text-teal-100 text-lg leading-relaxed max-w-md">
            Configura los detalles de tu espacio de trabajo. Esto nos ayudará a adaptar la experiencia a las necesidades de tu equipo.
          </p>

          <div className="space-y-6 mt-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-800/50 border border-teal-700/50 flex items-center justify-center backdrop-blur-sm">
                <CheckCircle2 className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Espacio Privado</h3>
                <p className="text-teal-200 text-sm">Tu información está completamente segura.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-800/50 border border-teal-700/50 flex items-center justify-center backdrop-blur-sm">
                <ShieldCheck className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Roles y Permisos</h3>
                <p className="text-teal-200 text-sm">Invita a tu equipo con los accesos correctos.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative bg-white">
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex justify-center mb-8">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                <img src="/logo.png" alt="Clinia Logo" className="w-10 h-10 object-contain" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configura tu Clínica</h2>
            <p className="text-slate-500 font-medium">Completaremos tu perfil asociado a <span className="text-teal-600 font-bold">{userEmail || 'tu correo'}</span>.</p>
          </div>

          <form onSubmit={handleCreateClinic} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="clinicName" className="text-slate-700 font-semibold ml-1">Nombre de la Clínica</Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  id="clinicName"
                  placeholder="Ej. Dental Care Center"
                  value={formData.clinicName}
                  onChange={(e) => setFormData(prev => ({ ...prev, clinicName: e.target.value }))}
                  className="h-12 pl-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-700 font-semibold ml-1">Tamaño de la Clínica</Label>
              <RadioGroup
                value={formData.clinicSize}
                onValueChange={(val) => setFormData(prev => ({ ...prev, clinicSize: val }))}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: "1-2", label: "1-2", sub: "Miembros" },
                  { value: "3-5", label: "3-5", sub: "Miembros" },
                  { value: "6+", label: "6+", sub: "Miembros" }
                ].map((item) => (
                  <Label
                    key={item.value}
                    htmlFor={item.value}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all cursor-pointer bg-white shadow-sm hover:border-teal-200 ${formData.clinicSize === item.value ? 'border-teal-600 bg-teal-50/50' : 'border-slate-200'}`}
                  >
                    <RadioGroupItem value={item.value} id={item.value} className="sr-only" />
                    <span className={`text-lg font-bold ${formData.clinicSize === item.value ? 'text-teal-700' : 'text-slate-700'}`}>{item.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{item.sub}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
              disabled={loading || !formData.clinicName}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Configurando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Ir a mi panel</span>
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}

