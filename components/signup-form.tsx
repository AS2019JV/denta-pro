"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Eye, EyeOff, Loader2, CheckCircle2, Mail, Building2, User, ArrowRight, ShieldCheck, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { registerClinic } from "@/app/actions/register-clinic"
import { toast } from "sonner"

export function SignupForm() {
  const [step, setStep] = useState(1) // 1: Form, 2: Success
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "Dr.",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    practiceName: "",
    practiceSize: "small"
  })

  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Validation
    if (!formData.firstName || !formData.lastName) {
      setError("Por favor, ingresa tu nombre y apellidos completos")
      setIsLoading(false)
      return
    }

    if (!formData.practiceName) {
      setError("El nombre de tu clínica es obligatorio para comenzar")
      setIsLoading(false)
      return
    }

    if (!formData.email || !formData.email.includes("@")) {
      setError("Ingresa un correo electrónico válido")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres para tu seguridad")
      setIsLoading(false)
      return
    }

    try {
      const submissionData = new FormData()
      submissionData.append("title", formData.title)
      submissionData.append("firstName", formData.firstName)
      submissionData.append("lastName", formData.lastName)
      submissionData.append("email", formData.email)
      submissionData.append("password", formData.password)
      submissionData.append("practiceName", formData.practiceName)
      submissionData.append("practiceSize", formData.practiceSize)
      submissionData.append("address", "Ubicación por definir")

      const result = await registerClinic(submissionData)
      
      if (result?.error) {
        setError(result.error)
        toast.error("Error en el registro", { description: result.error })
      } else {
        setStep(2)
        toast.success("¡Cuenta creada exitosamente!")
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-card font-text selection:bg-teal-100 selection:text-teal-900">
      {/* Left Side: Brand & Value Prop (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#0A2E2A] relative overflow-hidden flex-col justify-start gap-y-12 px-12 pt-10 pb-12 text-white">
        {/* Ambient Background Glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Clinia +</span>
          </div>

          <div className="space-y-8 max-w-lg">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl lg:text-5xl font-bold leading-[1.2] tracking-tight"
            >
              Gestión clínica de <span className="text-teal-400">alta precisión</span>.
              <span className="block text-xl lg:text-2xl font-medium text-teal-100/60 mt-4 leading-relaxed">
                Rendimiento superior para especialistas.
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-teal-100/70 leading-relaxed"
            >
              Optimiza el flujo operativo de tu consultorio con tecnología avanzada y un ecosistema digital sin fricciones. Comienza tu experiencia premium de 14 días sin costo.
            </motion.p>

            <div className="space-y-6 pt-4">
              {[
                { icon: Zap, text: "Historial clínico con visualización impecable" },
                { icon: ShieldCheck, text: "Métricas y reportes automatizados" },
                { icon: CheckCircle2, text: "Gestión de citas simplificada" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-800/50 flex items-center justify-center group-hover:bg-teal-500 transition-colors border border-teal-700/50">
                    <item.icon className="w-5 h-5 text-teal-300 group-hover:text-white" />
                  </div>
                  <span className="text-lg font-medium text-teal-50/90">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-teal-800/50 mt-auto lg:mt-0">
          <p className="text-sm text-teal-400/80 font-medium italic">
            "El primer paso hacia tu transformación digital"
          </p>
        </div>
      </div>

      {/* Right Side: Form / Success Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-muted/50">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="form-step"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-xl"
            >
              <div className="mb-10 lg:hidden flex justify-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                    <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xl font-bold text-foreground/90 tracking-tight">Clinia +</span>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Comienza tu prueba gratis</h2>
                <p className="text-slate-500 font-medium">Configura tu cuenta y clínica en menos de 2 minutos.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-700 font-semibold ml-1">Nombre</Label>
                    <div className="flex gap-2">
                      <select 
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="h-12 bg-card border border-border focus:border-teal-500 rounded-xl px-2 text-sm text-slate-700 outline-none w-[80px] shadow-sm cursor-pointer"
                      >
                        <option value="Dr.">Dr.</option>
                        <option value="Dra.">Dra.</option>
                        <option value="Lic.">Lic.</option>
                        <option value="">Ninguno</option>
                      </select>
                      <div className="relative flex-1">
                        <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                          id="firstName"
                          placeholder="Ej. María"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className={`h-12 pl-10 bg-card border-border focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all shadow-sm ${error && !formData.firstName ? 'border-red-300 bg-red-50/20' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-700 font-semibold ml-1">Apellidos</Label>
                    <Input
                      id="lastName"
                      placeholder="Ej. González"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`h-12 bg-card border-border focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all shadow-sm ${error && !formData.lastName ? 'border-red-300 bg-red-50/20' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="practiceName" className="text-slate-700 font-semibold ml-1">Nombre de tu Clínica</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="practiceName"
                      placeholder="Ej. Dental Care Center"
                      value={formData.practiceName}
                      onChange={handleInputChange}
                      className={`h-12 pl-12 bg-card border-border focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all shadow-sm ${error && !formData.practiceName ? 'border-red-300 bg-red-50/20' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold ml-1">Tamaño de la Clínica</Label>
                  <RadioGroup
                    value={formData.practiceSize}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, practiceSize: val }))}
                    className="grid grid-cols-3 gap-3"
                  >
                    {[
                      { value: "small", label: "1-2", sub: "Miembros" },
                      { value: "medium", label: "3-5", sub: "Miembros" },
                      { value: "large", label: "6+", sub: "Miembros" }
                    ].map((item) => (
                      <Label
                        key={item.value}
                        htmlFor={item.value}
                        className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all cursor-pointer bg-card shadow-sm hover:border-teal-200 ${formData.practiceSize === item.value ? 'border-teal-600 bg-teal-50/50' : 'border-border'}`}
                      >
                        <RadioGroupItem value={item.value} id={item.value} className="sr-only" />
                        <span className={`text-lg font-bold ${formData.practiceSize === item.value ? 'text-teal-700' : 'text-slate-700'}`}>{item.label}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{item.sub}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-semibold ml-1">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="doctor@clinia.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`h-12 pl-12 bg-card border-border focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all shadow-sm ${error && !formData.email ? 'border-red-300 bg-red-50/20' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-2 pb-2">
                  <Label htmlFor="password" className="text-slate-700 font-semibold ml-1">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`h-12 bg-card border-border focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all pr-12 shadow-sm ${error && (!formData.password || formData.password.length < 6) ? 'border-red-300 bg-red-50/20' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {error}
                  </motion.div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Creando tu espacio...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Comenzar mi transformación</span>
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </Button>
                
                <p className="text-center text-xs text-slate-400 px-4 leading-relaxed">
                  Al registrarte, aceptas nuestros <a href="#" className="text-teal-600 hover:underline font-bold">Términos de Servicio</a> y <a href="#" className="text-teal-600 hover:underline font-bold">Política de Privacidad</a>. No se requiere tarjeta de crédito.
                </p>

                <div className="pt-4 text-center">
                  <p className="text-sm text-slate-500 font-medium">
                    ¿Ya tienes una cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="text-teal-600 hover:text-teal-700 font-bold underline decoration-teal-600/30 underline-offset-4"
                    >
                      Inicia sesión aquí
                    </button>
                  </p>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="success-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg"
            >
              <Card className="border-0 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] bg-card overflow-hidden rounded-[40px]">
                <div className="h-2 w-full bg-gradient-to-r from-teal-500 to-emerald-500"></div>
                <CardContent className="p-12 text-center">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                    className="mx-auto w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-8 ring-8 ring-teal-50/50"
                  >
                     <div className="w-16 h-16 bg-card rounded-2xl shadow-md flex items-center justify-center border border-teal-50">
                        <Mail className="w-8 h-8 text-teal-600" />
                     </div>
                  </motion.div>

                  <div className="space-y-4 mb-10">
                    <h2 className="text-[36px] font-bold text-foreground tracking-tight leading-tight">¡Bienvenido a la familia Clinia+!</h2>
                    <p className="text-lg text-slate-500 font-medium px-4">
                      Hemos enviado un enlace de confirmación a <span className="text-teal-700 font-bold">{formData.email}</span> para activar tu clínica.
                    </p>
                  </div>

                  <div className="space-y-4 bg-muted/50 p-6 rounded-3xl border border-border/50 text-left mb-10">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-teal-600/20">1</div>
                      <div>
                        <p className="font-bold text-foreground/90">Verifica tu bandeja de entrada</p>
                        <p className="text-xs text-slate-500 font-medium">No olvides revisar la carpeta de Spam</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-teal-600/20">2</div>
                      <div>
                        <p className="font-bold text-foreground/90">Haz clic en el enlace de activación</p>
                        <p className="text-xs text-slate-500 font-medium">Serás redirigido directamente a tu panel</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-slate-200"
                    onClick={() => router.push("/login")}
                  >
                     Regresar al Inicio de Sesión
                  </Button>
                  
                  <p className="mt-8 text-sm text-slate-400 italic font-medium">
                    "Tu viaje hacia una práctica más eficiente comienza hoy"
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
