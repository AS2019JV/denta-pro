"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"

import { motion } from "framer-motion"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const { login, signInWithGoogle, user } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      console.log("Login Form: User detected, redirecting...", user.clinic_id)
      if (!user.clinic_id) {
          window.location.href = "/onboarding"
      } else {
          window.location.href = "/dashboard"
      }
    }
  }, [user])

  const [resendSuccess, setResendSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setResendSuccess(false)

    try {
      const { error } = await login(email, password)
      if (error) {
        if (error.message.includes("Email not confirmed")) {
            setError("EmailNotConfirmed") 
        } else if (error.message.includes("Invalid login credentials")) {
             setError("Credenciales inválidas o cuenta no verificada. Por favor revisa tu correo primero.")
        } else {
            setError("Error al iniciar sesión. Por favor verifique sus credenciales.")
            console.error(error)
        }
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
      setIsLoading(true)
      try {
          const { error } = await supabase.auth.resend({
              type: 'signup',
              email: email,
              options: {
                  emailRedirectTo: `${window.location.origin}/dashboard`
              }
          })
          
          if (error) throw error
          setResendSuccess(true)
          setError("")
      } catch (err: any) {
          console.error("Resend error:", err)
          setError(err.message || "Error al reenviar correo")
      } finally {
          setIsLoading(false)
      }
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
            <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">{t("loginTitle")}</CardTitle>
            <CardDescription className="text-slate-500 text-base">{t("loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium ml-1">Email</Label>
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
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Contraseña</Label>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs text-teal-600 font-medium hover:text-teal-700"
                    tabIndex={-1}
                    onClick={() => router.push("/forgot-password")}
                    type="button"
                  >
                    ¿Olvidaste tu contraseña?
                  </Button>
                </div>
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

              {resendSuccess && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
                      ¡Correo enviado! Revise su bandeja de entrada.
                  </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                    {error === "EmailNotConfirmed" ? (
                        <div className="flex flex-col gap-2">
                           <span>El correo no ha sido confirmado.</span>
                           <Button variant="outline" size="sm" onClick={handleResendConfirmation} disabled={isLoading} className="bg-white hover:bg-slate-50 text-xs h-8">
                               {isLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : "Reenviar Confirmación"}
                           </Button>
                        </div>
                    ) : error}
                </motion.div>
              )}

              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20 rounded-full font-bold text-[15px] transition-all duration-300 hover:scale-[1.02] active:scale-95" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  t("login")
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
              disabled={isLoading}
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
                ¿No tienes una cuenta?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold text-teal-600 hover:text-teal-700"
                  onClick={() => router.push("/signup")}
                >
                  Regístrate aquí
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer info */}
        <div className="text-center mt-8 text-xs text-slate-400">
           &copy; {new Date().getFullYear()} Clinia+. Todos los derechos reservados.
        </div>
      </motion.div>
    </div>
  )
}
