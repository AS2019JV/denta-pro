"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

type Language = "es" | "en"

interface TranslationContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations = {
  es: {
    // Navigation
    dashboard: "Panel",
    patients: "Pacientes",
    calendar: "Calendario",
    billing: "Facturación",
    reports: "Reportes",
    messages: "Mensajes",
    marketing: "Marketing",
    profile: "Perfil",
    settings: "Configuración",
    logout: "Cerrar Sesión",

    // Common
    welcomeBack: "Bienvenido de vuelta",
    doctor: "Doctor",
    reception: "Recepción",

    // Auth
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Iniciar Sesión",
    loginTitle: "Iniciar Sesión en DentaPro+",
    loginSubtitle: "Ingresa tus credenciales para acceder al sistema",

    // Marketing specific
    campaigns: "Campañas",
    segments: "Segmentación",
    social: "Redes Sociales",
    analytics: "Análisis",
  },
  en: {
    // Navigation
    dashboard: "Dashboard",
    patients: "Patients",
    calendar: "Calendar",
    billing: "Billing",
    reports: "Reports",
    messages: "Messages",
    marketing: "Marketing",
    profile: "Profile",
    settings: "Settings",
    logout: "Logout",

    // Common
    welcomeBack: "Welcome back",
    doctor: "Doctor",
    reception: "Reception",

    // Auth
    email: "Email",
    password: "Password",
    login: "Login",
    loginTitle: "Login to DentaPro+",
    loginSubtitle: "Enter your credentials to access the system",

    // Marketing specific
    campaigns: "Campaigns",
    segments: "Segmentation",
    social: "Social Media",
    analytics: "Analytics",
  },
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("es")

  const t = (key: string): string => {
    return translations[language][key as keyof (typeof translations)[typeof language]] || key
  }

  return <TranslationContext.Provider value={{ language, setLanguage, t }}>{children}</TranslationContext.Provider>
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}
