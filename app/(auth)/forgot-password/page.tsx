"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/components/auth-context"
import { Loader2, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/security`,
      })

      if (error) {
        // Rate limit or other error
        setError(error.message)
      } else {
        setIsSubmitted(true)
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
             <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center p-3">
               <img src="/clinia-logo.png" alt="Clinia Logo" className="w-full h-full object-contain" />
             </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Recuperación de Cuenta</CardTitle>
          <CardDescription className="text-center">
            {isSubmitted 
              ? "Correo enviado con instrucciones" 
              : "Ingrese su correo para restablecer su contraseña"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
             <div className="space-y-6 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-lg text-sm">
                    Hemos enviado un enlace de recuperación a <strong>{email}</strong>. 
                    Por favor revise su bandeja de entrada (y spam).
                </div>
                <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
                    Volver al Inicio de Sesión
                </Button>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Enlace de Recuperación"
                )}
              </Button>
              
              <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/login")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
