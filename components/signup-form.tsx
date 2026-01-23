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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-text">
        {/* Ambient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
           <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-100/40 rounded-full blur-[100px] opacity-70 animate-pulse-slow"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] opacity-70 animate-pulse-slow"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md p-4 relative z-10"
        >
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-white/60 overflow-hidden rounded-3xl">
            <CardHeader className="space-y-4 text-center pt-10 pb-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center ring-1 ring-emerald-100 shadow-sm"
              >
                 <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </motion.div>
              <CardTitle className="text-2xl font-bold text-slate-900">¡Cuenta creada!</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Hemos enviado un enlace de confirmación a: <br/>
                <span className="font-semibold text-slate-900 mt-1 block">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-10">
               <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 text-center border border-slate-100">
                  Por favor revise su bandeja de entrada (y spam). Debe confirmar su correo antes de iniciar sesión.
               </div>
               <Button 
                 className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold transition-all hover:scale-[1.02]"
                 onClick={() => router.push("/login")}
               >
                  Ir a Iniciar Sesión
               </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-text">
       {/* Ambient Background */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-100/40 rounded-full blur-[100px] opacity-70 animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] opacity-70 animate-pulse-slow"></div>
       </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md p-4 relative z-10"
      >
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-white/60 overflow-hidden rounded-3xl">
          <CardHeader className="space-y-2 text-center pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-tr from-teal-50 to-blue-50 rounded-2xl flex items-center justify-center p-3 shadow-inner ring-1 ring-slate-100">
                <img src="/brand-logo.png" alt="Clinia Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">Crear cuenta</CardTitle>
            <CardDescription className="text-slate-500 text-base">
              Ingresa tus datos para registrarte en Clinia
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-700 font-medium ml-1">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="María González"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium ml-1">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@clinia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
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

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20 rounded-full font-bold text-[15px] transition-all duration-300 hover:scale-[1.02] active:scale-95" disabled={isLoading || success}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
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

            <div className="mt-8 text-center">
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
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
