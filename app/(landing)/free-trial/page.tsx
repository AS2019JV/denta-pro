"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, CheckCircle2, Building2, User, Mail, Smartphone, Lock, Upload } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

      <main className="flex-1 container py-8 md:py-12">
        {!isSubmitted ? (
          <div className="grid md:grid-cols-5 gap-10 lg:gap-12 max-w-6xl mx-auto">
            <div className="md:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm text-primary mb-4 font-subtitle">
                  <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
                  Prueba Gratuita de 14 Días
                </div>
                <h1 className="text-3xl font-bold tracking-tighter md:text-4xl/tight mb-4 font-title text-primary">
                  Comienza tu transformación digital
                </h1>
                <p className="text-gray-500 font-text text-lg">
                  Crea tu cuenta y configura tu clínica en minutos. Sin tarjeta de crédito requerida.
                </p>
              </motion.div>

              <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardContent className="p-8 md:p-10">
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
                            <Label htmlFor="email" className="text-slate-600 font-medium">Email Corporativo</Label>
                            <Input id="email" name="email" type="email" placeholder="doctor@clinica.com" autoComplete="email" required className="bg-white h-11" />
                            <p className="text-xs text-slate-400 pl-1">Este será tu usuario para iniciar sesión.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label htmlFor="password" className="text-slate-600 font-medium">Contraseña</Label>
                                <div className="relative">
                                    <Input 
                                        id="password" 
                                        name="password" 
                                        type="password" 
                                        required 
                                        className="bg-white h-11 pr-10"
                                        onChange={(e) => setPassword(e.target.value)} 
                                    />
                                    {password.length > 0 && (
                                        <div className="absolute right-3 top-3 text-slate-400">
                                            {password.length >= 8 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Lock className="w-4 h-4" />}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <Label htmlFor="confirmPassword" className="text-slate-600 font-medium">Confirmar Contraseña</Label>
                                <div className="relative">
                                    <Input 
                                        id="confirmPassword" 
                                        name="confirmPassword" 
                                        type="password" 
                                        autoComplete="new-password" 
                                        required 
                                        className={`bg-white h-11 pr-10 ${passwordsMismatch ? "border-red-300 focus-visible:ring-red-200" : passwordsMatch ? "border-green-300 focus-visible:ring-green-200" : ""}`}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    {passwordsMatch && (
                                        <div className="absolute right-3 top-3 animate-in fade-in zoom-in">
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        </div>
                                    )}
                                </div>
                                {passwordsMismatch && (
                                    <p className="text-xs text-red-500 pl-1 animate-in slide-in-from-top-1">Las contraseñas no coinciden</p>
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
                            <Label htmlFor="logo" className="text-slate-600 font-medium">Logotipo (Opcional)</Label>
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
                                <div className={`border-2 border-dashed ${fileName ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50"} rounded-xl p-8 peer-hover:bg-slate-100 peer-hover:border-primary/50 transition-all text-center group-hover:shadow-sm`}>
                                    <div className="mx-auto w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 mb-3 ring-1 ring-slate-100 group-hover:text-primary group-hover:scale-110 transition-all">
                                        {fileName ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Upload className="w-6 h-6" />}
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

                    {/* Block C: The Compliance Handshake */}
                    <div className="space-y-4 p-5 rounded-xl bg-orange-50/80 border border-orange-200/60 shadow-sm">
                         <div className="flex items-start space-x-3">
                             <input 
                                id="terms" 
                                name="terms" 
                                type="checkbox" 
                                required 
                                className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, acepta los términos y condiciones para continuar.')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                             />
                             <div className="space-y-1">
                                 <Label htmlFor="terms" className="text-sm font-semibold leading-snug text-slate-800 cursor-pointer">
                                     Acepto los Términos de Servicio y el Acuerdo BAA (Business Associate Agreement).
                                 </Label>
                                 <p className="text-xs text-gray-500 leading-relaxed">
                                     Confirmo que mi clínica cumple con las normativas locales de protección de datos de salud (HIPAA/RGPD) y autorizo el procesamiento de datos.
                                 </p>
                             </div>
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
                      className="w-full bg-primary hover:bg-primary/90 text-white font-title py-7 text-xl rounded-xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all transform hover:-translate-y-1 active:translate-y-0"
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
            <div className="md:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="bg-[#1A1F2C] text-white rounded-2xl p-6 mb-6 shadow-xl shadow-slate-900/10">
                  <h3 className="font-medium text-lg mb-6 font-subtitle border-b border-white/10 pb-4">¿Qué incluye tu prueba?</h3>
                  <ul className="space-y-5">
                    <li className="flex items-start">
                      <div className="mt-1 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full p-1 mr-4 shadow-lg shadow-green-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle">Gestión Completa de Pacientes</h4>
                        <p className="text-sm text-gray-400 font-text leading-relaxed">
                          Historial clínico, odontogramas y periodontogramas interactivos.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full p-1 mr-4 shadow-lg shadow-blue-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle">Agenda Inteligente</h4>
                        <p className="text-sm text-gray-400 font-text leading-relaxed">
                          Recordatorios automáticos por WhatsApp y control de citas.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-gradient-to-br from-purple-400 to-violet-600 rounded-full p-1 mr-4 shadow-lg shadow-purple-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-1 font-subtitle">Facturación Integrada</h4>
                        <p className="text-sm text-gray-400 font-text leading-relaxed">
                          Control de pagos, presupuestos y facturación electrónica simplificada.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-white rounded-xl shadow-sm text-primary ring-1 ring-primary/10">
                                <Lock className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-primary font-subtitle text-lg">Seguridad Garantizada</h4>
                        </div>
                        <p className="text-sm text-slate-600 mb-4 leading-relaxed font-medium">
                            Cumplimos rigurosamente con RGPD y HIPAA. Tus datos y los de tus pacientes están seguros.
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed bg-white/50 p-3 rounded-lg border border-primary/5">
                            Tu prueba de 14 días es totalmente gratuita y sin compromiso.
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
