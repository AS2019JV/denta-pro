"use client"

import type React from "react"
import { useState } from "react"
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
import { toast } from "sonner" // Assuming sonner is used based on package.json

export default function FreeTrialPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // We use native form submission with Server Actions, but we can capture the submit to add loading state
  // and client-side validation if needed.

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    
    // Basic password confirmation check
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    
    if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden")
        setIsSubmitting(false)
        return
    }

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

      <main className="flex-1 container py-12 md:py-20">
        {!isSubmitted ? (
          <div className="grid md:grid-cols-5 gap-8 max-w-6xl mx-auto">
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
                <p className="text-gray-500 font-text">
                  Crea tu cuenta y configura tu clínica en minutos. Sin tarjeta de crédito requerida.
                  Acceso completo a todas las funciones Premium durante el periodo de prueba.
                </p>
              </motion.div>

              <Card className="border-none shadow-lg rounded-xl overflow-hidden">
                <CardContent className="p-8">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* Sección: Información Personal */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-medium text-primary">
                           <User className="w-5 h-5" />
                           <h3>Tus Datos</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Nombre</Label>
                            <Input id="firstName" name="firstName" placeholder="Juan" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Apellidos</Label>
                            <Input id="lastName" name="lastName" placeholder="García" required />
                        </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Corporativo</Label>
                            <Input id="email" name="email" type="email" placeholder="doctor@clinica.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono Móvil</Label>
                            <Input id="phone" name="phone" type="tel" placeholder="612 345 678" required />
                        </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input id="password" name="password" type="password" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                                <Input id="confirmPassword" name="confirmPassword" type="password" required />
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-px bg-border" />

                    {/* Sección: Información de la Clínica */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-medium text-primary">
                           <Building2 className="w-5 h-5" />
                           <h3>Datos de la Clínica</h3>
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="practiceName">Nombre de la Clínica</Label>
                        <Input
                            id="practiceName"
                            name="practiceName"
                            placeholder="Clínica Dental García"
                            required
                        />
                        </div>

                         <div className="space-y-2">
                        <Label htmlFor="address">Dirección / Ciudad (Opcional)</Label>
                        <Input
                            id="address"
                            name="address"
                            placeholder="Madrid, España"
                        />
                        </div>

                        <div className="space-y-2">
                        <Label>Tamaño de la Clínica</Label>
                        <RadioGroup
                            defaultValue="small"
                            name="practiceSize"
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                            <RadioGroupItem value="small" id="small" />
                            <Label htmlFor="small" className="cursor-pointer font-text w-full">
                                1-2 Sillones
                            </Label>
                            </div>
                            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                            <RadioGroupItem value="medium" id="medium" />
                            <Label htmlFor="medium" className="cursor-pointer font-text w-full">
                                3-5 Sillones
                            </Label>
                            </div>
                            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                            <RadioGroupItem value="large" id="large" />
                            <Label htmlFor="large" className="cursor-pointer font-text w-full">
                                6+ Sillones
                            </Label>
                            </div>
                        </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="logo">Logotipo de la Clínica (Opcional)</Label>
                            <div className="flex items-center gap-4">
                                <Input id="logo" name="logo" type="file" accept="image/*" className="cursor-pointer" />
                            </div>
                            <p className="text-xs text-muted-foreground">Recomendado: Imágenes cuadradas (PNG, JPG).</p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white font-subtitle py-6 text-lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                          <div className="flex items-center gap-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Creando tu cuenta...
                          </div>
                      ) : (
                          "Comenzar Prueba Gratuita"
                      )}
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                        Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.
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
                <div className="bg-[#1A1F2C] text-white rounded-xl p-6 mb-6">
                  <h3 className="font-medium text-lg mb-4 font-subtitle">¿Qué incluye tu prueba?</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="mt-1 bg-white/10 rounded-full p-1 mr-3">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Gestión Completa de Pacientes</h4>
                        <p className="text-sm text-gray-400 font-text">
                          Historial clínico, odontogramas y periodontogramas interactivos.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-white/10 rounded-full p-1 mr-3">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Agenda Inteligente</h4>
                        <p className="text-sm text-gray-400 font-text">
                          Recordatorios automáticos por WhatsApp y control de citas.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-white/10 rounded-full p-1 mr-3">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Inteligencia Artificial (NSG)</h4>
                        <p className="text-sm text-gray-400 font-text">
                          Prueba nuestro asistente clínico y financiero impulsado por IA.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white rounded-full shadow-sm">
                             <Lock className="w-5 h-5 text-primary" />
                        </div>
                        <h4 className="font-bold text-primary">Seguridad Garantizada</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Cumplimos con RGPD y HIPAA. Tus datos están encriptados y seguros.
                    </p>
                    <p className="text-xs text-gray-400">
                        No necesitas introducir tarjeta de crédito hasta que decidas continuar después de tus 14 días.
                    </p>
                </div>

              </motion.div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-4 font-title">¡Cuenta Creada con Éxito!</h1>
            <p className="text-xl text-gray-600 mb-8 font-text">
              Hemos enviado un correo de confirmación a tu dirección. 
              <br/>Por favor, revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.
            </p>
            <div className="bg-[#F8F9FA] rounded-xl p-6 mb-8 border border-gray-200">
              <h3 className="font-medium mb-4 text-lg">Próximos Pasos</h3>
               <ol className="text-left space-y-4 list-decimal pl-5 text-gray-600">
                   <li>Abre el email de confirmación de <strong>Clinia+</strong>.</li>
                   <li>Haz clic en el botón <strong>"Confirmar mi cuenta"</strong>.</li>
                   <li>Serás redirigido automáticamente a tu nuevo panel de control.</li>
                   <li>¡Empieza a gestionar tu clínica!</li>
               </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-primary hover:bg-primary/90 text-white font-subtitle px-8">
                <Link href="/login">Ir a Iniciar Sesión</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      <SiteFooter simplified={true} />
    </div>
  )
}
