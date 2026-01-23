"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, CheckCircle2, Building2, User, Mail, Smartphone, Lock, Upload } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SiteHeader } from "@/components/landing/layout/site-header"
import { SiteFooter } from "@/components/landing/layout/site-footer"
import { registerClinic } from "@/app/actions/register-clinic"
import { toast } from "sonner" 

export default function FreeTrialPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Real-time validation state
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)

  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const passwordsMismatch = password && confirmPassword && password !== confirmPassword

  useEffect(() => {
    if (isSubmitted) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [isSubmitted])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden")
        setIsSubmitting(false)
        return
    }

    const formData = new FormData(event.currentTarget)

    try {
      const result = await registerClinic(formData)
      
      if (result?.error) {
        setError(result.error)
        toast.error("Error en el registro", { description: result.error })
      } else {
        setIsSubmitted(true)
        toast.success("¡Cuenta creada exitosamente!")
      }
    } catch (e) {
      console.error(e)
      setError("Ocurrió un error inesperado.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white to-[#F8F9FA]">
      <SiteHeader isHomePage={false} />

      <main className="flex-1 container pt-24 md:pt-32 pb-12">
        {!isSubmitted ? (
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 max-w-7xl mx-auto items-start">
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <div className="inline-flex items-center rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 mb-6 font-subtitle border border-blue-100">
                  <span className="mr-2 h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Prueba Gratuita de 14 Días
                </div>
                <h1 className="text-3xl font-bold tracking-tighter md:text-4xl/tight mb-4 font-title text-primary">
                  Comienza tu transformación digital
                </h1>
                <p className="text-gray-500 font-text text-lg">
                  Crea tu cuenta y configura tu clínica en minutos. Sin tarjeta de crédito requerida.
                </p>
              </motion.div>

              <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-slate-100">
                <CardContent className="p-8 md:p-12">
                  <form onSubmit={handleSubmit} className="space-y-10">
                    
                    {/* Block A: The Human */}
                    <div className="space-y-6 rounded-2xl bg-slate-50/80 p-6 md:p-8 border border-slate-100">
                        <div className="flex items-center gap-4 text-xl font-bold text-slate-800 border-b border-slate-200/60 pb-4 mb-4">
                           <div className="bg-white p-2.5 rounded-xl shadow-sm text-primary ring-1 ring-slate-100">
                             <User className="w-5 h-5" />
                           </div>
                           <h3>Datos de Usuario</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label htmlFor="firstName" className="text-slate-600 font-medium">Nombre</Label>
                                <Input id="firstName" name="firstName" placeholder="Juan" autoComplete="given-name" required className="bg-white h-11" />
                            </div>
                            <div className="space-y-2.5">
                                <Label htmlFor="lastName" className="text-slate-600 font-medium">Apellidos</Label>
                                <Input id="lastName" name="lastName" placeholder="García" autoComplete="family-name" required className="bg-white h-11" />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <Label htmlFor="email" className="text-slate-600 font-medium">Correo Electrónico</Label>
                            <Input id="email" name="email" type="email" placeholder="nombre@ejemplo.com" autoComplete="email" required className="bg-white/50 h-12 border-slate-200 focus:border-blue-500 transition-colors" />
                            <p className="text-xs text-slate-400 pl-1 font-medium">Este será tu usuario para iniciar sesión.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label htmlFor="password" className="text-slate-600 font-medium ml-1">Contraseña</Label>
                                <div className="relative">
                                    <Input 
                                        id="password" 
                                        name="password" 
                                        type="password" 
                                        required 
                                        className="bg-white/50 h-12 border-slate-200 focus:border-blue-500 pr-10 transition-colors"
                                        onChange={(e) => setPassword(e.target.value)} 
                                    />
                                    {password.length > 0 && (
                                        <div className="absolute right-3 top-3.5 text-slate-400">
                                            {password.length >= 8 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Lock className="w-4 h-4" />}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <Label htmlFor="confirmPassword" className="text-slate-600 font-medium ml-1">Confirmar Contraseña</Label>
                                <div className="relative">
                                    <Input 
                                        id="confirmPassword" 
                                        name="confirmPassword" 
                                        type="password" 
                                        autoComplete="new-password" 
                                        required 
                                        className={`bg-white/50 h-12 pr-10 border-slate-200 focus:border-blue-500 transition-colors ${passwordsMismatch ? "border-red-300 focus-visible:ring-red-200" : passwordsMatch ? "border-emerald-300 focus-visible:ring-emerald-200" : ""}`}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    {passwordsMatch && (
                                        <div className="absolute right-3 top-3.5 animate-in fade-in zoom-in">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        </div>
                                    )}
                                </div>
                                {passwordsMismatch && (
                                    <p className="text-xs text-red-500 pl-1 animate-in slide-in-from-top-1 font-medium">Las contraseñas no coinciden</p>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Block B: The Business */}
                    <div className="space-y-6 rounded-2xl bg-slate-50/80 p-6 md:p-8 border border-slate-100">
                        <div className="flex items-center gap-4 text-xl font-bold text-slate-800 border-b border-slate-200/60 pb-4 mb-4">
                           <div className="bg-white p-2.5 rounded-xl shadow-sm text-primary ring-1 ring-slate-100">
                             <Building2 className="w-5 h-5" />
                           </div>
                           <h3>Datos de la Clínica</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label htmlFor="practiceName" className="text-slate-600 font-medium">Nombre de la Clínica</Label>
                                <Input
                                    id="practiceName"
                                    name="practiceName"
                                    placeholder="Clínica Dental García"
                                    autoComplete="organization"
                                    required
                                    className="bg-white h-11"
                                />
                            </div>
                             <div className="space-y-2.5">
                                <Label htmlFor="phone" className="text-slate-600 font-medium">Teléfono de la Clínica</Label>
                                <div className="flex gap-2">
                                    <div className="w-[85px] shrink-0">
                                        <select
                                            name="countryCode"
                                            className="flex h-11 w-full rounded-md border border-input bg-white px-2 py-2 text-xl ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-center cursor-pointer"
                                            defaultValue="+593"
                                        >
                                            <option value="+593">🇪🇨</option>
                                            <option value="+57">🇨🇴</option>
                                            <option value="+52">🇲🇽</option>
                                            <option value="+51">🇵🇪</option>
                                            <option value="+54">🇦🇷</option>
                                            <option value="+1">🇺🇸</option>
                                        </select>
                                    </div>
                                    <Input 
                                        id="phone" 
                                        name="phone" 
                                        type="tel" 
                                        placeholder="99 123 4567" 
                                        autoComplete="tel-national" 
                                        required 
                                        className="bg-white h-11 flex-1 font-medium tracking-wide" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-slate-600 font-medium">Tamaño de la Clínica</Label>
                            <RadioGroup
                                defaultValue="small"
                                name="practiceSize"
                                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            >
                                <div className="relative h-full">
                                    <RadioGroupItem value="small" id="small" className="peer sr-only" />
                                    <Label
                                        htmlFor="small"
                                        className="flex flex-col items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-4 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all text-center h-full shadow-sm"
                                    >
                                        <span className="font-bold text-slate-700 text-lg">1-2</span>
                                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sillones</span>
                                    </Label>
                                </div>
                                <div className="relative h-full">
                                    <RadioGroupItem value="medium" id="medium" className="peer sr-only" />
                                    <Label
                                        htmlFor="medium"
                                        className="flex flex-col items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-4 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all text-center h-full shadow-sm"
                                    >
                                        <span className="font-bold text-slate-700 text-lg">3-5</span>
                                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sillones</span>
                                    </Label>
                                </div>
                                <div className="relative h-full">
                                    <RadioGroupItem value="large" id="large" className="peer sr-only" />
                                    <Label
                                        htmlFor="large"
                                        className="flex flex-col items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-4 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all text-center h-full shadow-sm"
                                    >
                                        <span className="font-bold text-slate-700 text-lg">6+</span>
                                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sillones</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                        
                        <div className="space-y-2.5">
                            <Label htmlFor="logo" className="text-slate-600 font-medium ml-1">Logotipo (Opcional)</Label>
                            <div className="relative group cursor-pointer">
                                <Input 
                                    id="logo" 
                                    name="logo" 
                                    type="file" 
                                    accept="image/*" 
                                    className="peer absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setFileName(file.name);
                                    }} 
                                />
                                <div className={`border border-dashed ${fileName ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-slate-50/50"} rounded-xl p-8 peer-hover:bg-slate-100 peer-hover:border-blue-400 transition-all text-center group-hover:scale-[0.99] duration-200 ease-out`}>
                                    <div className="mx-auto w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 mb-3 ring-1 ring-slate-100 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                                        {fileName ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Upload className="w-6 h-6" />}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {fileName ? fileName : "Haz clic o arrastra tu logo aquí"}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {fileName ? "Archivo seleccionado" : "PNG, JPG (Máx. 2MB)"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Block C: Consent */}
                    <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                         <div className="flex items-center space-x-3">
                             <Checkbox 
                                id="terms" 
                                name="terms" 
                                required 
                                className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shadow-sm"
                             />
                             <Label htmlFor="terms" className="text-sm font-medium leading-normal text-slate-700 cursor-pointer select-none">
                                 Acepto compartir mis datos para la creación de la cuenta clínica.
                             </Label>
                         </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-red-100 p-1.5 rounded-full shrink-0">
                                <span className="block w-2 h-2 bg-red-600 rounded-full"></span>
                            </div>
                            {error}
                        </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-7 text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                          <div className="flex items-center gap-3">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span className="font-medium">Creando tu Clínica...</span>
                          </div>
                      ) : (
                          "Crear Mi Clínica"
                      )}
                    </Button>
                    <p className="text-xs text-center text-gray-400 max-w-sm mx-auto leading-relaxed">
                        Al hacer clic, aceptas nuestros Términos de Servicio. Tu seguridad es nuestra prioridad.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Informativo */}
            <div className="lg:col-span-5 space-y-8 sticky top-32 h-fit">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="relative bg-white/80 rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] ring-1 ring-black/5 backdrop-blur-3xl overflow-hidden">
                  {/* Subtle Grainy Noise or Gradient Mesh could go here, for now using a clean gradient */}
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-blue-50/50 to-purple-50/50 blur-[80px] -z-10 rounded-full mix-blend-multiply opacity-70"></div>
                  
                  <h3 className="font-bold text-xl mb-6 font-title tracking-tight text-slate-900 relative z-10">¿Qué incluye tu prueba?</h3>
                  <ul className="space-y-6 relative z-10">
                    <li className="flex items-start group">
                      <div className="mt-1 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full p-1.5 mr-4 shadow-lg shadow-emerald-500/20 shrink-0 ring-2 ring-white">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle text-slate-900 group-hover:text-emerald-600 transition-colors">Gestión Completa de Pacientes</h4>
                        <p className="text-[15px] text-slate-500 font-text leading-relaxed">
                          Historial clínico, odontogramas y periodontogramas interactivos.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start group">
                      <div className="mt-1 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-1.5 mr-4 shadow-lg shadow-blue-500/20 shrink-0 ring-2 ring-white">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle text-slate-900 group-hover:text-blue-600 transition-colors">Agenda Inteligente</h4>
                        <p className="text-[15px] text-slate-500 font-text leading-relaxed">
                          Recordatorios automáticos por WhatsApp y control de citas.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start group">
                      <div className="mt-1 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full p-1.5 mr-4 shadow-lg shadow-purple-500/20 shrink-0 ring-2 ring-white">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle text-slate-900 group-hover:text-purple-600 transition-colors">Facturación Integrada</h4>
                        <p className="text-[15px] text-slate-500 font-text leading-relaxed">
                          Control de pagos, presupuestos y facturación electrónica simplificada.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="relative bg-white/80 rounded-[2rem] p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] ring-1 ring-black/5 backdrop-blur-3xl overflow-hidden mt-8">
                  <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-gradient-to-tr from-blue-50/50 to-emerald-50/50 blur-[60px] -z-10 rounded-full mix-blend-multiply opacity-70"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-gradient-to-br from-slate-100 to-white rounded-2xl text-slate-700 ring-1 ring-black/5 shadow-sm">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-slate-900 font-title text-lg tracking-tight">Protección de Datos</h4>
                        </div>
                        <p className="text-[15px] text-slate-500 leading-relaxed font-text pl-1">
                           Tus datos están protegidos con encriptación avanzada de grado empresarial.
                        </p>
                    </div>
                </div>

              </motion.div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-start pt-8 md:pt-16 min-h-[70vh] w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="max-w-lg w-full mx-auto"
            >
               <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-xl overflow-hidden rounded-3xl ring-1 ring-slate-200/50">
                  <CardContent className="p-8 md:p-10 text-center space-y-8">
                      {/* Icon Animation */}
                      <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-primary/10 to-blue-50/50 rounded-full flex items-center justify-center shadow-inner mb-4 ring-1 ring-primary/20">
                          <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                          >
                             <div className="relative">
                                <Mail className="h-10 w-10 text-primary" />
                                <div className="absolute -right-2 -top-2 bg-primary rounded-full p-1.5 border-[3px] border-white shadow-sm">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </div>
                             </div>
                          </motion.div>
                      </div>

                      {/* Headline & Body */}
                      <div className="space-y-3">
                          <h1 className="text-3xl md:text-3xl font-bold font-title text-slate-800 tracking-tight">¡Revisa tu correo!</h1>
                          <p className="text-lg text-slate-500 font-text leading-relaxed">
                            Hemos enviado un enlace de confirmación a tu bandeja de entrada.
                          </p>
                      </div>

                      {/* Visual Steps */}
                      <div className="bg-slate-50/80 rounded-2xl p-6 text-left border border-slate-100">
                          <div className="flex gap-4 mb-5 items-start">
                              <div className="bg-white text-primary border border-primary/20 rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-sm shadow-sm ring-2 ring-primary/5">1</div>
                              <div>
                                  <p className="font-semibold text-slate-800 text-sm">Abre el correo de Clinia+</p>
                                  <p className="text-xs text-slate-400 mt-0.5">Podría estar en la carpeta de Spam</p>
                              </div>
                          </div>
                          <div className="flex gap-4 items-start">
                              <div className="bg-white text-primary border border-primary/20 rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-sm shadow-sm ring-2 ring-primary/5">2</div>
                              <div>
                                  <p className="font-semibold text-slate-800 text-sm">Haz clic en "Confirmar mi cuenta"</p>
                                  <p className="text-xs text-slate-400 mt-0.5">Accederás inmediatamente a tu panel</p>
                              </div>
                          </div>
                      </div>

                      {/* Value Proposition Micro-copy */}
                      <p className="text-sm text-center text-slate-400 italic">
                        "El primer paso hacia tu transformación digital"
                      </p>

                      {/* Actions */}
                      <div className="space-y-4">
                        <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white font-title py-7 text-lg shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all rounded-xl transform hover:-translate-y-0.5">
                            <Link href="/login">Ir a Iniciar Sesión</Link>
                        </Button>
                      </div>
                  </CardContent>
               </Card>
            </motion.div>
          </div>
        )}
      </main>

      <SiteFooter simplified={true} />
    </div>
  )
}
