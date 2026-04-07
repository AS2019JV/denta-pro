"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/components/auth-context"
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

export function SignupForm() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  // Public signup is always for potential clinic owners
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const { signup, signInWithGoogle } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    // Validation
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await signup(email, password, fullName, "clinic_owner")
      if (error) {
        if (error.message.includes("already registered")) {
          setError("Este correo electrónico ya está registrado")
        } else {
          setError("Error al crear la cuenta. Por favor intente nuevamente.")
        }
        console.error(error)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="h-screen w-full flex flex-col bg-[#F8FAFB] relative overflow-hidden font-text">
        {/* Header matching user screenshot */}
        <header className="w-full px-8 py-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center p-1.5">
               <img src="/brand-logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <span className="font-bold text-xl text-slate-800">Clinia+</span>
          </div>
          <button 
            onClick={() => router.push("/")}
            className="text-sm text-slate-500 hover:text-teal-600 transition-colors font-medium"
          >
            Volver al inicio
          </button>
        </header>

        {/* Ambient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
           <div className="absolute top-[-5%] left-[-5%] w-[500px] h-[500px] bg-teal-100/40 rounded-full blur-[120px] opacity-60"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-blue-100/30 rounded-full blur-[150px] opacity-50"></div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg"
          >
            <Card className="border-0 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.08)] bg-white/90 backdrop-blur-2xl ring-1 ring-white/100 overflow-hidden rounded-[40px]">
              <CardHeader className="space-y-6 text-center pt-10 pb-4">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                  className="mx-auto w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center ring-4 ring-white shadow-inner"
                >
                   <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-teal-50">
                     <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                     </svg>
                   </div>
                </motion.div>
                <div className="space-y-1">
                  <CardTitle className="text-[32px] font-bold text-slate-900 tracking-tight">¡Revisa tu correo!</CardTitle>
                  <CardDescription className="text-base text-slate-500 font-medium pt-2">
                    Hemos enviado un enlace de confirmación a tu bandeja de entrada.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 px-12 pb-12">
                 <div className="space-y-3">
                   <div className="flex items-center gap-4 p-4 bg-teal-50/30 rounded-2xl border border-teal-100/50">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-teal-600 font-bold text-sm border border-teal-50">1</div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">Abre el correo de Clinia+</p>
                        <p className="text-xs text-slate-500">Podría estar en la carpeta de Spam</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 p-4 bg-teal-50/30 rounded-2xl border border-teal-100/50">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-teal-600 font-bold text-sm border border-teal-50">2</div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">Haz clic en "Confirmar mi cuenta"</p>
                        <p className="text-xs text-slate-500">Accederás inmediatamente a tu panel</p>
                      </div>
                   </div>
                 </div>

                 <div className="pt-4 text-center">
                    <p className="text-sm text-slate-400 italic font-medium mb-6">
                      "El primer paso hacia tu transformación digital"
                    </p>
                    <Button 
                      className="w-full h-14 bg-teal-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-slate-200"
                      onClick={() => router.push("/login")}
                    >
                       Ir al Inicio de Sesión
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-text py-12">
       {/* Ambient Background */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-5%] left-[-10%] w-[600px] h-[600px] bg-teal-100/30 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-blue-100/20 rounded-full blur-[150px] opacity-50"></div>
       </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-4 relative z-10"
      >
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-xl ring-1 ring-white/60 overflow-hidden rounded-[32px]">
          <CardHeader className="space-y-2 text-center pt-10 pb-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-teal-50 to-blue-50 rounded-2xl flex items-center justify-center p-3.5 shadow-inner ring-1 ring-slate-100/50">
                <img src="/brand-logo.png" alt="Clinia Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            
            <div className="mb-6 p-3 bg-teal-50 rounded-2xl border border-teal-100/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-700">
               <div className="h-8 w-8 bg-teal-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="h-4 w-4" />
               </div>
               <p className="text-xs text-teal-800 text-left font-medium leading-tight">
                 ¿Eres dueño de clínica? Regístrate y obtén <span className="font-bold underline decoration-teal-300">14 días de prueba gratis</span>.
               </p>
            </div>

            <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">Crear cuenta</CardTitle>
            <CardDescription className="text-slate-500 text-base">
              Comienza a gestionar tu clínica con Clinia+
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-slate-700 font-medium ml-1">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ej. Dra. María González"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700 font-medium ml-1">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@clinia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium ml-1">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:text-slate-600 rounded-lg"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium ml-1">Confirmar contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:text-slate-600 rounded-lg"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3 py-3 border-y border-slate-100 my-2">
                <input
                  id="terms"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 transition-all cursor-pointer accent-teal-600"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, marca esta casilla para continuar.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
                <Label htmlFor="terms" className="text-[13px] text-slate-500 leading-snug cursor-pointer font-normal">
                  Acepto los{" "}
                  <a href="#" className="text-teal-600 hover:underline font-medium">Términos de Servicio</a>
                  {" "}y la{" "}
                  <a href="#" className="text-teal-600 hover:underline font-medium">Política de Privacidad</a>.
                  Al registrarme inicio mi <span className="font-bold text-slate-700">prueba de 14 días</span>.
                </Label>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full h-14 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white shadow-xl shadow-teal-500/20 rounded-2xl font-bold text-base transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]" disabled={isLoading || success}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Comenzar mi prueba gratis"
                )}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium tracking-wide">O continuar con</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-all hover:border-slate-300"
              onClick={async () => {
                setIsLoading(true)
                const { error } = await signInWithGoogle()
                if (error) {
                  setError("Error al iniciar sesión con Google")
                  console.error(error)
                }
                setIsLoading(false)
              }}
              disabled={isLoading || success}
            >
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </Button>

            <div className="mt-8 text-center space-y-4">
              <p className="text-sm text-slate-500">
                ¿Ya tienes una cuenta?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold text-teal-600 hover:text-teal-700"
                  onClick={() => router.push("/login")}
                >
                  Inicia sesión aquí
                </Button>
              </p>
              
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  ¿Eres doctor o recepcionista? No necesitas registrarte. 
                  <br />
                  Pide a tu administrador que te envíe una <strong>invitación por correo</strong> para unirte a tu clínica.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
