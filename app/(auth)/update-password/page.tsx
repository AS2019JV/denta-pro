"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Check if user has a session (granted by recovery link)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // If no session, they shouldn't be here unless they just clicked the link
        // Supabase /api/auth/confirm handles the session set via cookies
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

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
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        setIsSuccess(true)
        // Auto redirect after 3 seconds
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      }
    } catch (err) {
      setError("Ocurrió un error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFB] p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="w-full max-w-md border-0 shadow-2xl rounded-[32px] text-center p-8">
            <div className="mx-auto w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6">
               <CheckCircle2 className="h-10 w-10 text-teal-600" />
            </div>
            <CardTitle className="text-2xl font-bold mb-2">¡Contraseña Actualizada!</CardTitle>
            <CardDescription className="text-slate-500 mb-6">
              Tu contraseña ha sido cambiada exitosamente. Te redirigiremos al inicio de sesión en unos segundos.
            </CardDescription>
            <Button className="w-full bg-teal-600" onClick={() => router.push("/login")}>
              Ir al Inicio de Sesión
            </Button>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFB] p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-[32px] overflow-hidden">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex justify-center mb-4">
             <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center p-2.5">
               <img src="/brand-logo.png" alt="Clinia+" className="w-full h-full object-contain" />
             </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Nueva Contraseña</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu nueva contraseña para recuperar el acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-slate-50 rounded-xl"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-10 w-10 text-slate-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 bg-slate-50 rounded-xl"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive" className="rounded-xl bg-red-50 border-red-100 text-red-600">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-12 bg-teal-600 hover:bg-teal-700 rounded-xl font-bold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Guardar Contraseña"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
