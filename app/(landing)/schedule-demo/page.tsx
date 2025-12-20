"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Calendar, Clock, Users } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/landing/ui/button"
import { Card, CardContent } from "@/components/landing/ui/card"
import { Input } from "@/components/landing/ui/input"
import { Label } from "@/components/landing/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/landing/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/landing/ui/select"
import { Textarea } from "@/components/landing/ui/textarea"
import { SiteHeader } from "@/components/landing/layout/site-header"
import { SiteFooter } from "@/components/landing/layout/site-footer"

export default function ScheduleDemoPage() {
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    practiceName: "",
    practiceSize: "",
    date: "",
    time: "",
    timezone: "CET",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simular llamada API
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
    }, 1500)
  }

  // Generar fechas disponibles (próximos 14 días excluyendo fines de semana)
  const generateAvailableDates = () => {
    const dates = []
    const today = new Date()

    for (let i = 1; i <= 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)

      // Saltar fines de semana (0 = Domingo, 6 = Sábado)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        const formattedDate = date.toISOString().split("T")[0]
        dates.push(formattedDate)
      }
    }

    return dates
  }

  // Generar horarios disponibles
  const availableTimes = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]

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
                  Programa una Demo
                </div>
                <h1 className="text-3xl font-bold tracking-tighter md:text-4xl/tight mb-4 font-title text-primary">
                  Descubre Clinia+ en acción
                </h1>
                <p className="text-gray-500 font-text">
                  Programa una demo personalizada con nuestros especialistas de producto para ver cómo Clinia+ puede
                  transformar tu clínica.
                </p>
              </motion.div>

              <Card className="border-none shadow-lg rounded-xl overflow-hidden">
                <CardContent className="p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
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
                          required
                        />
                      </div>
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

                    <div className="space-y-2">
                      <Label>Tamaño de la Clínica</Label>
                      <RadioGroup
                        defaultValue={formState.practiceSize}
                        onValueChange={(value) => handleSelectChange("practiceSize", value)}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                      >
                        <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="small" id="small" />
                          <Label htmlFor="small" className="cursor-pointer font-text">
                            1-2 Profesionales
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="medium" id="medium" />
                          <Label htmlFor="medium" className="cursor-pointer font-text">
                            3-5 Profesionales
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="large" id="large" />
                          <Label htmlFor="large" className="cursor-pointer font-text">
                            6+ Profesionales
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="date">Fecha Preferida</Label>
                        <Select onValueChange={(value) => handleSelectChange("date", value)} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una fecha" />
                          </SelectTrigger>
                          <SelectContent>
                            {generateAvailableDates().map((date) => (
                              <SelectItem key={date} value={date}>
                                {new Date(date).toLocaleDateString("es-ES", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time">Hora Preferida</Label>
                        <Select onValueChange={(value) => handleSelectChange("time", value)} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una hora" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTimes.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Zona Horaria</Label>
                      <Select
                        defaultValue={formState.timezone}
                        onValueChange={(value) => handleSelectChange("timezone", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tu zona horaria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CET">Hora Central Europea (CET)</SelectItem>
                          <SelectItem value="WET">Hora de Europa Occidental (WET)</SelectItem>
                          <SelectItem value="CEST">Hora de Verano de Europa Central (CEST)</SelectItem>
                          <SelectItem value="GMT">Hora del Meridiano de Greenwich (GMT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">¿Qué te gustaría conocer? (Opcional)</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formState.message}
                        onChange={handleChange}
                        placeholder="Cuéntanos sobre tus intereses específicos o preguntas"
                        rows={3}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white font-subtitle"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Procesando..." : "Programar Demo"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="bg-primary/5 rounded-xl p-6 mb-6">
                  <h3 className="font-medium text-lg mb-4 font-subtitle text-primary">Qué esperar en tu demo</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="mt-1 bg-primary/10 rounded-full p-1 mr-3">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Sesión de 30 Minutos</h4>
                        <p className="text-sm text-gray-500 font-text">
                          Una presentación enfocada de Clinia+ adaptada a las necesidades de tu clínica.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-primary/10 rounded-full p-1 mr-3">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Experto en Producto</h4>
                        <p className="text-sm text-gray-500 font-text">
                          Reunión con un especialista que entiende los flujos de trabajo de clínicas dentales.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="mt-1 bg-primary/10 rounded-full p-1 mr-3">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium font-subtitle">Tour Personalizado</h4>
                        <p className="text-sm text-gray-500 font-text">
                          Conoce las funciones más relevantes para las necesidades específicas de tu clínica.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <Card className="border-none shadow-md rounded-xl overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <img
                        src="/placeholder.svg?height=60&width=60"
                        alt="Dra. Sara Jiménez"
                        className="rounded-full h-14 w-14 object-cover"
                      />
                      <div>
                        <h4 className="font-bold">Dra. Sara Jiménez</h4>
                        <p className="text-gray-500 text-sm">Odontología Familiar, Madrid</p>
                      </div>
                    </div>
                    <p className="text-gray-700 italic mb-4 font-text">
                      "La demo fue increíblemente útil. El equipo me mostró exactamente cómo Clinia+ podía resolver
                      nuestros desafíos de programación, y en una semana de implementarlo, vimos una mejora dramática."
                    </p>
                    <div className="flex text-secondary">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">¡Demo Programada con Éxito!</h1>
            <p className="text-xl text-gray-600 mb-8">
              Gracias por programar una demo con nosotros. Hemos enviado una confirmación a tu correo electrónico con
              todos los detalles.
            </p>
            <div className="bg-[#F8F9FA] rounded-xl p-6 mb-8">
              <h3 className="font-medium mb-4">Detalles de tu Demo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-500">Fecha y Hora</p>
                  <p className="font-medium">
                    {formState.date
                      ? new Date(formState.date).toLocaleDateString("es-ES", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : "Fecha seleccionada"}
                    , {formState.time || "Hora seleccionada"} {formState.timezone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Enlace de la Reunión</p>
                  <p className="font-medium">Recibirás el enlace en tu correo electrónico</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-primary hover:bg-primary/90 text-white font-subtitle">
                <Link href="/">Volver a la Página Principal</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/free-trial">Comenzar Prueba Gratuita</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      <SiteFooter simplified={true} />
    </div>
  )
}

