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
    hello: "Hola",
    
    // Auth
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Iniciar Sesión",
    loginTitle: "Iniciar Sesión en DentaPro+",
    loginSubtitle: "Ingresa tus credenciales para acceder al sistema",
    rememberSession: "Recordar sesión",

    // Dashboard Stats
    "total-patients": "Total de Pacientes",
    "appointments-today": "Citas de Hoy",
    "monthly-revenue": "Ingresos Mensuales",
    "pending-treatments": "Tratamientos Pendientes",
    "since-last-month": "desde el mes pasado",

    // Appointments
    "todays-appointments": "Citas de Hoy",
    "appointments-scheduled-today": "citas programadas para hoy",
    "upcoming-appointments": "Próximas Citas",
    "appointments-next-days": "Citas programadas para los próximos días",
    "view-all-appointments": "Ver todas las citas",
    "view-full-calendar": "Ver calendario completo",
    "new-appointment": "Nueva Cita",
    confirmed: "Confirmada",
    pending: "Pendiente",
    
    // Appointment Types
    cleaning: "Limpieza",
    filling: "Empaste",
    checkup: "Revisión",
    endodontics: "Endodoncia",
    consultation: "Consulta",
    crown: "Corona",

    // Time
    tomorrow: "Mañana",
    today: "Hoy",
    friday: "Viernes",
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    saturday: "Sábado",
    sunday: "Domingo",

    // Quick Actions
    "quick-actions": "Acciones Rápidas",
    "new-patient": "Nuevo Paciente",
    "add-patient": "Añadir Paciente",
    "schedule-appointment": "Agendar Cita",
    "call-patient": "Llamar Paciente",
    "send-reminder": "Enviar Recordatorio",
    "import-database": "Importar Base de Datos",
    "export-database": "Exportar Base de Datos",
    "search-patients": "Buscar pacientes...",

    // Marketing specific
    campaigns: "Campañas",
    segments: "Segmentación",
    social: "Redes Sociales",
    analytics: "Análisis",

    // Common Actions
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    search: "Buscar",
    filter: "Filtrar",
    export: "Exportar",
    print: "Imprimir",
    add: "Agregar",
    remove: "Quitar",
    close: "Cerrar",
    open: "Abrir",
    yes: "Sí",
    no: "No",
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
    hello: "Hello",

    // Auth
    email: "Email",
    password: "Password",
    login: "Login",
    loginTitle: "Login to DentaPro+",
    loginSubtitle: "Enter your credentials to access the system",
    rememberSession: "Remember session",

    // Dashboard Stats
    "total-patients": "Total Patients",
    "appointments-today": "Appointments Today",
    "monthly-revenue": "Monthly Revenue",
    "pending-treatments": "Pending Treatments",
    "since-last-month": "since last month",

    // Appointments
    "todays-appointments": "Today's Appointments",
    "appointments-scheduled-today": "appointments scheduled for today",
    "upcoming-appointments": "Upcoming Appointments",
    "appointments-next-days": "Appointments scheduled for the next few days",
    "view-all-appointments": "View all appointments",
    "view-full-calendar": "View full calendar",
    "new-appointment": "New Appointment",
    confirmed: "Confirmed",
    pending: "Pending",

    // Appointment Types
    cleaning: "Cleaning",
    filling: "Filling",
    checkup: "Checkup",
    endodontics: "Endodontics",
    consultation: "Consultation",
    crown: "Crown",

    // Time
    tomorrow: "Tomorrow",
    today: "Today",
    friday: "Friday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    saturday: "Saturday",
    sunday: "Sunday",

    // Quick Actions
    "quick-actions": "Quick Actions",
    "new-patient": "New Patient",
    "add-patient": "Add Patient",
    "schedule-appointment": "Schedule Appointment",
    "call-patient": "Call Patient",
    "send-reminder": "Send Reminder",
    "import-database": "Import Database",
    "export-database": "Export Database",
    "search-patients": "Search patients...",

    // Marketing specific
    campaigns: "Campaigns",
    segments: "Segmentation",
    social: "Social Media",
    analytics: "Analytics",

    // Common Actions
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    search: "Search",
    filter: "Filter",
    export: "Export",
    print: "Print",
    add: "Add",
    remove: "Remove",
    close: "Close",
    open: "Open",
    yes: "Yes",
    no: "No",
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
