"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

import { Button } from "@/components/landing/ui/button"
import { Card, CardContent } from "@/components/landing/ui/card"
import { Input } from "@/components/landing/ui/input"
import { Label } from "@/components/landing/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/landing/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/landing/ui/select"
import { Textarea } from "@/components/landing/ui/textarea"
import { SiteHeader } from "@/components/landing/layout/site-header"
import { SiteFooter } from "@/components/landing/layout/site-footer"

export default function FreeTrialPage() {
  const router = useRouter()
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    practiceName: "",
    practiceSize: "1-2",
    currentSoftware: "",
    message: "",
  })

  const [formStep, setFormStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
       // 1. Sign Up User
       const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formState.email,
          password: formState.password,
          options: {
            data: {
              full_name: `${formState.firstName} ${formState.lastName}`,
              role: 'clinic_owner' // Default as owner in free trial
            }
          }
       })

       if (authError) throw authError
       if (!authData.user) throw new Error("No se pudo crear el usuario")

       // 2. Create Clinic
       const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({
          name: formState.practiceName,
          phone: formState.phone,
          email: formState.email,
          owner_id: authData.user.id,
          size: formState.practiceSize,
          previous_software: formState.currentSoftware,
          onboarding_notes: formState.message
        })
        .select()
        .single()

       if (clinicError) throw clinicError

       // 3. Update Profile with Clinic ID
       const { error: profileError } = await supabase
        .from("profiles")
        .update({
          clinic_id: clinic.id,
          role: 'clinic_owner',
          full_name: `${formState.firstName} ${formState.lastName}`,
          phone: formState.phone
        })
        .eq("id", authData.user.id)

       if (profileError) throw profileError
       
       // Success
       toast.success("Cuenta creada exitosamente!")
       setIsSubmitted(true)
       
       // Optional: Redirect after delay
       setTimeout(() => {
          router.push("/dashboard")
       }, 3000)

    } catch (error: any) {
       console.error(error)
       toast.error(error.message || "Error al registrarse")
    } finally {
       setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white to-[#F8F9FA]">
      <SiteHeader isHomePage={false} />

      <main className="flex-1 container py-12 md:py-20">
        {!isSubmitted ? (
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm text-primary mb-4 font-subtitle">
                <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
                Prueba Gratuita de 14 Días
              </div>
              <h1 className="text-3xl font-bold tracking-tighter md:text-4xl/tight lg:text-5xl mb-4 font-title text-primary">
                Comienza tu camino hacia una mejor clínica
              </h1>
              <p className="text-gray-500 md:text-xl/relaxed max-w-2xl mx-auto font-text">
                Obtén acceso completo a todas las funciones durante 14 días. No se requiere tarjeta de crédito.
              </p>
            </motion.div>

            <Card className="border-none shadow-lg rounded-xl overflow-hidden">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit}>
                  {formStep === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Nombre</Label>
                          <Input
                            id="firstName"
                            name="firstName"
                            value={formState.firstName}
                            onChange={handleChange}
                            placeholder="Juan"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Apellidos</Label>
                          <Input
                            id="lastName"
                            name="lastName"
                            value={formState.lastName}
                            onChange={handleChange}
                            placeholder="García"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formState.email}
                            onChange={handleChange}
                            placeholder="juan@ejemplo.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Teléfono</Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formState.phone}
                            onChange={handleChange}
                            placeholder="612 345 678"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          value={formState.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                          required
                          minLength={6}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="practiceName">Nombre de la Clínica</Label>
                        <Input
                          id="practiceName"
                          name="practiceName"
                          value={formState.practiceName}
                          onChange={handleChange}
                          placeholder="Clínica Dental García"
                          required
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => setFormStep(1)}
                          className="bg-primary hover:bg-primary/90 text-white font-subtitle"
                        >
                          Siguiente Paso
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {formStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <Label>Tamaño de la Clínica</Label>
                        <RadioGroup
                          defaultValue={formState.practiceSize}
                          onValueChange={(value) => handleSelectChange("practiceSize", value)}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                            <RadioGroupItem value="1-2" id="small" />
                            <Label htmlFor="small" className="cursor-pointer font-text">
                              1-2 Profesionales
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                            <RadioGroupItem value="3-5" id="medium" />
                            <Label htmlFor="medium" className="cursor-pointer font-text">
                              3-5 Profesionales
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                            <RadioGroupItem value="6-plus" id="large" />
                            <Label htmlFor="large" className="cursor-pointer font-text">
                              6+ Profesionales
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currentSoftware">Software Actual (si lo hay)</Label>
                        <Select onValueChange={(value) => handleSelectChange("currentSoftware", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu software actual" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ninguno / En papel</SelectItem>
                            <SelectItem value="dentadesk">Dentadesk</SelectItem>
                            <SelectItem value="softdent">Softdent</SelectItem>
                            <SelectItem value="dentalink">Dentalink</SelectItem>
                            <SelectItem value="curve">Curve Dental</SelectItem>
                            <SelectItem value="other">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Información Adicional (Opcional)</Label>
                        <Textarea
                          id="message"
                          name="message"
                          value={formState.message}
                          onChange={handleChange}
                          placeholder="Cuéntanos sobre tus necesidades o desafíos específicos"
                          rows={4}
                        />
                      </div>

                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => setFormStep(0)} className="font-subtitle">
                          Atrás
                        </Button>
                        <Button
                          type="submit"
                          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-subtitle"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Creando cuenta..." : "Comenzar Prueba Gratuita"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </form>
              </CardContent>
            </Card>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Sin Tarjeta de Crédito",
                  description: "Prueba todas las funciones sin riesgo y sin información de pago.",
                },
                {
                  title: "Acceso Completo",
                  description: "Obtén acceso completo a todas las funciones premium durante tu prueba.",
                },
                {
                  title: "Configuración Sencilla",
                  description: "Nuestro equipo te ayudará a comenzar con una incorporación personalizada.",
                },
              ].map((item, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="mt-1 bg-tertiary/10 rounded-full p-1">
                    <CheckCircle className="h-5 w-5 text-tertiary" />
                  </div>
                  <div>
                    <h3 className="font-medium font-subtitle">{item.title}</h3>
                    <p className="text-sm text-gray-500 font-text">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="w-20 h-20 bg-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-tertiary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">¡Bienvenido a Clinia+!</h1>
            <p className="text-xl text-gray-600 mb-8">
              Tu cuenta ha sido creada exitosamente. Redirigiéndote al dashboard...
            </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button asChild className="bg-primary hover:bg-primary/90 text-white font-subtitle">
                  <Link href="/dashboard">Ir al Dashboard</Link>
               </Button>
             </div>
          </motion.div>
        )}
      </main>

      <SiteFooter simplified={true} />
    </div>
  )
}

