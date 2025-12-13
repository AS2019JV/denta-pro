"use client"

import { useState, useEffect } from "react"

export interface Dentist {
  id: string
  name: string
  specialty: string
  email: string
  phone: string
  color: string
  avatar?: string
}

export interface Treatment {
  id: string
  name: string
  price: number
  description?: string
  duration?: number // in minutes, default suggestion
}

const DEFAULT_DENTISTS: Dentist[] = [
  {
    id: "1",
    name: "Dr. Roberto Martínez",
    specialty: "Ortodoncia",
    email: "roberto@cliniaplus.com",
    phone: "555-0101",
    color: "#3b82f6", // blue
  },
  {
    id: "2",
    name: "Dra. Ana López",
    specialty: "Odontopediatría",
    email: "ana@cliniaplus.com",
    phone: "555-0102",
    color: "#ec4899", // pink
  },
]

const DEFAULT_TREATMENTS: Treatment[] = [
  { id: "1", name: "Consulta General", price: 50, duration: 30 },
  { id: "2", name: "Limpieza Dental", price: 80, duration: 45 },
  { id: "3", name: "Empaste Simple", price: 120, duration: 60 },
  { id: "4", name: "Extracción", price: 150, duration: 45 },
  { id: "5", name: "Blanqueamiento", price: 300, duration: 90 },
]

export function useAppData() {
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize data
  useEffect(() => {
    const loadData = () => {
      // Dentists
      const storedDentists = localStorage.getItem("denta-pro-dentists")
      if (storedDentists) {
        setDentists(JSON.parse(storedDentists))
      } else {
        setDentists(DEFAULT_DENTISTS)
        localStorage.setItem("denta-pro-dentists", JSON.stringify(DEFAULT_DENTISTS))
      }

      // Treatments
      const storedTreatments = localStorage.getItem("denta-pro-treatments")
      if (storedTreatments) {
        setTreatments(JSON.parse(storedTreatments))
      } else {
        setTreatments(DEFAULT_TREATMENTS)
        localStorage.setItem("denta-pro-treatments", JSON.stringify(DEFAULT_TREATMENTS))
      }
      
      setIsLoaded(true)
    }

    loadData()
    
    // Listen for storage changes in other tabs
    window.addEventListener("storage", loadData)
    return () => window.removeEventListener("storage", loadData)
  }, [])

  const addDentist = (dentist: Omit<Dentist, "id">) => {
    const newDentist = { ...dentist, id: crypto.randomUUID() }
    const updated = [...dentists, newDentist]
    setDentists(updated)
    localStorage.setItem("denta-pro-dentists", JSON.stringify(updated))
    return newDentist
  }

  const updateDentist = (id: string, dentist: Partial<Dentist>) => {
    const updated = dentists.map(d => d.id === id ? { ...d, ...dentist } : d)
    setDentists(updated)
    localStorage.setItem("denta-pro-dentists", JSON.stringify(updated))
  }

  const deleteDentist = (id: string) => {
    const updated = dentists.filter(d => d.id !== id)
    setDentists(updated)
    localStorage.setItem("denta-pro-dentists", JSON.stringify(updated))
  }

  const addTreatment = (treatment: Omit<Treatment, "id">) => {
    const newTreatment = { ...treatment, id: crypto.randomUUID() }
    const updated = [...treatments, newTreatment]
    setTreatments(updated)
    localStorage.setItem("denta-pro-treatments", JSON.stringify(updated))
    return newTreatment
  }

  const updateTreatment = (id: string, treatment: Partial<Treatment>) => {
    const updated = treatments.map(t => t.id === id ? { ...t, ...treatment } : t)
    setTreatments(updated)
    localStorage.setItem("denta-pro-treatments", JSON.stringify(updated))
  }

  const deleteTreatment = (id: string) => {
    const updated = treatments.filter(t => t.id !== id)
    setTreatments(updated)
    localStorage.setItem("denta-pro-treatments", JSON.stringify(updated))
  }

  return {
    dentists,
    addDentist,
    updateDentist,
    deleteDentist,
    treatments,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    isLoaded
  }
}
