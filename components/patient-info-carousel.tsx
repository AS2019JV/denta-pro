"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, User, Heart, Shield, Calendar, FileText, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface Patient {
  id: string
  name: string
  lastName: string
  email?: string
  phone: string
  address?: string
  birthDate: string
  gender?: string
  emergencyContact?: string
  emergencyPhone?: string
  allergies?: string
  medications?: string
  medicalConditions?: string
  insuranceProvider?: string
  policyNumber?: string
  lastVisit?: string
  nextAppointment?: string
  status: "active" | "inactive"
}

interface PatientInfoCarouselProps {
  patient: Patient
  calculateAge: (birthDate: string) => number
}

export function PatientInfoCarousel({ patient, calculateAge }: PatientInfoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const cards = [
    {
      icon: User,
      title: "Información Personal",
      color: "bg-blue-500",
      content: [
        { label: "Nombre Completo", value: `${patient.name} ${patient.lastName}` },
        { label: "Edad", value: `${calculateAge(patient.birthDate)} años` },
        {
          label: "Género",
          value: patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : "Otro",
        },
        { label: "Fecha de Nacimiento", value: new Date(patient.birthDate).toLocaleDateString("es-ES") },
      ],
    },
    {
      icon: FileText,
      title: "Contacto",
      color: "bg-green-500",
      content: [
        { label: "Teléfono", value: patient.phone },
        { label: "Email", value: patient.email || "No especificado" },
        { label: "Dirección", value: patient.address || "No especificada" },
      ],
    },
    {
      icon: Heart,
      title: "Información Médica",
      color: "bg-red-500",
      content: [
        { label: "Alergias", value: patient.allergies || "Ninguna conocida" },
        { label: "Medicamentos", value: patient.medications || "Ninguno" },
        { label: "Condiciones", value: patient.medicalConditions || "Ninguna" },
      ],
    },
    {
      icon: Shield,
      title: "Seguro Médico",
      color: "bg-purple-500",
      content: [
        { label: "Proveedor", value: patient.insuranceProvider || "No especificado" },
        { label: "Número de Póliza", value: patient.policyNumber || "No especificado" },
      ],
    },
    {
      icon: Activity,
      title: "Contacto de Emergencia",
      color: "bg-orange-500",
      content: [
        { label: "Nombre", value: patient.emergencyContact || "No especificado" },
        { label: "Teléfono", value: patient.emergencyPhone || "No especificado" },
      ],
    },
    {
      icon: Calendar,
      title: "Historial de Citas",
      color: "bg-cyan-500",
      content: [
        {
          label: "Última Visita",
          value: patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString("es-ES") : "No registrada",
        },
        {
          label: "Próxima Cita",
          value: patient.nextAppointment
            ? new Date(patient.nextAppointment).toLocaleDateString("es-ES")
            : "No programada",
        },
      ],
    },
  ]

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.pageX - (carouselRef.current?.offsetLeft || 0))
    setScrollLeft(carouselRef.current?.scrollLeft || 0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - (carouselRef.current?.offsetLeft || 0)
    const walk = (x - startX) * 2
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = scrollLeft - walk
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const scrollToIndex = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth
      carouselRef.current.scrollTo({
        left: cardWidth * index,
        behavior: "smooth",
      })
      setCurrentIndex(index)
    }
  }

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1
    scrollToIndex(newIndex)
  }

  const handleNext = () => {
    const newIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0
    scrollToIndex(newIndex)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (carouselRef.current && !isDragging) {
        const scrollPosition = carouselRef.current.scrollLeft
        const cardWidth = carouselRef.current.offsetWidth
        const newIndex = Math.round(scrollPosition / cardWidth)
        setCurrentIndex(newIndex)
      }
    }

    const carousel = carouselRef.current
    carousel?.addEventListener("scroll", handleScroll)
    return () => carousel?.removeEventListener("scroll", handleScroll)
  }, [isDragging])

  return (
    <div className="relative w-full">
      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevious} className="z-10 bg-transparent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                currentIndex === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30",
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
        <Button variant="outline" size="icon" onClick={handleNext} className="z-10 bg-transparent">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div key={index} className="flex-shrink-0 w-full snap-center px-2">
              <Card className="h-full border-2 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn("p-3 rounded-lg", card.color)}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">{card.title}</h3>
                  </div>
                  <div className="space-y-4">
                    {card.content.map((item, idx) => (
                      <div key={idx} className="flex flex-col space-y-1">
                        <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                        <span className="text-base">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
