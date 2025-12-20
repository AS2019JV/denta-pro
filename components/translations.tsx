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
    dentist: "Dentista",

    // Common
    welcomeBack: "Bienvenido de vuelta",
    doctor: "Doctor",
    reception: "Recepción",
    hello: "Hola",
    
    // Auth
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Iniciar Sesión",
    loginTitle: "Iniciar Sesión en Clinia +",
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

    // Settings Page
    "general-settings": "Configuración General",
    "notification-settings": "Notificaciones",
    "security-settings": "Seguridad",
    "backup-settings": "Respaldos",
    
    // General Settings
    "general-settings-description": "Configuración general de la aplicación",
    language: "Idioma",
    theme: "Tema",
    "time-zone": "Zona Horaria",
    "date-format": "Formato de Fecha",
    
    // Notifications
    "notification-settings-description": "Configura cómo y cuándo recibir notificaciones",
    "email-notifications": "Notificaciones por Email",
    "email-notifications-description": "Recibir notificaciones por correo electrónico",
    "push-notifications": "Notificaciones Push",
    "push-notifications-description": "Recibir notificaciones push en el navegador",
    "sms-notifications": "Notificaciones SMS",
    "sms-notifications-description": "Recibir notificaciones por SMS",
    "appointment-reminders": "Recordatorios de citas",
    "appointment-reminders-description": "Recordatorios automáticos de próximas citas",
    
    // Security
    "security-settings-description": "Configuración de seguridad y acceso",
    "two-factor-auth": "Autenticación de Dos Factores",
    "two-factor-auth-description": "Añadir una capa extra de seguridad",
    "session-timeout": "Tiempo de Sesión",
    "session-timeout-description": "Tiempo de inactividad antes de cerrar sesión automáticamente",
    
    // Backup
    "backup-settings-description": "Configuración de respaldos y recuperación de datos",
    "auto-backup": "Respaldo Automático",
    "auto-backup-description": "Realizar respaldos automáticos",
    "backup-frequency": "Frecuencia de Respaldo",
    "backup-location": "Ubicación de Respaldo",
    "create-backup-now": "Crear respaldo ahora",
    
    // Team Settings
    "team-settings": "Equipo",
    "team-settings-description": "Gestiona los miembros de tu clínica y sus permisos",
    "invite-member": "Invitar Miembro",
    "invite-sent": "Invitación enviada",
    "member-list": "Lista de Miembros",
    "full-name": "Nombre Completo",
    "role": "Rol",
    "actions": "Acciones",
    "invite": "Invitar",
    "inviting": "Invitando...",
    "email-placeholder": "correo@ejemplo.com",
    "name-placeholder": "Dr. Juan Pérez",
    
    // Form States
    saving: "Guardando...",
    lightMode: "Claro",
    darkMode: "Oscuro",
    systemMode: "Sistema",

    // Onboarding
    "onboarding-title": "Comienza tu camino hacia una mejor clínica",
    "onboarding-subtitle": "Obtén acceso completo a todas las funciones durante 14 días. No se requiere tarjeta de crédito.",
    "step-1": "Información Personal",
    "step-2": "Detalles de la Clínica",
    "first-name": "Nombre",
    "last-name": "Apellidos",
    "clinic-name": "Nombre de la Clínica",
    "clinic-size": "Tamaño de la Clínica",
    "software-current": "Software Actual (si lo hay)",
    "software-placeholder": "Selecciona tu software actual",
    "additional-info": "Información Adicional (Opcional)",
    "additional-info-placeholder": "Cuéntanos sobre tus necesidades o desafíos específicos",
    "next-step": "Siguiente Paso",
    "back": "Atrás",
    "start-trial": "Comenzar Prueba Gratuita",
    "size-1-2": "1-2 Profesionales",
    "size-3-5": "3-5 Profesionales",
    "size-6-plus": "6+ Profesionales",
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
    dentist: "Dentist",

    // Common
    welcomeBack: "Welcome back",
    doctor: "Doctor",
    reception: "Reception",
    hello: "Hello",

    // Auth
    email: "Email",
    password: "Password",
    login: "Login",
    loginTitle: "Login to Clinia +",
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

    // Settings Page
    "general-settings": "General Settings",
    "notification-settings": "Notifications",
    "security-settings": "Security",
    "backup-settings": "Backups",
    
    // General Settings
    "general-settings-description": "General application settings",
    language: "Language",
    theme: "Theme",
    "time-zone": "Time Zone",
    "date-format": "Date Format",
    
    // Notifications
    "notification-settings-description": "Configure how and when to receive notifications",
    "email-notifications": "Email Notifications",
    "email-notifications-description": "Receive email notifications",
    "push-notifications": "Push Notifications",
    "push-notifications-description": "Receive push notifications in the browser",
    "sms-notifications": "SMS Notifications",
    "sms-notifications-description": "Receive SMS notifications",
    "appointment-reminders": "Appointment Reminders",
    "appointment-reminders-description": "Automatic reminders for upcoming appointments",
    
    // Security
    "security-settings-description": "Security and access settings",
    "two-factor-auth": "Two-Factor Authentication",
    "two-factor-auth-description": "Add an extra layer of security",
    "session-timeout": "Session Timeout",
    "session-timeout-description": "Inactivity time before automatic logout",
    
    // Backup
    "backup-settings-description": "Backup and data recovery settings",
    "auto-backup": "Auto Backup",
    "auto-backup-description": "Perform automatic backups",
    "backup-frequency": "Backup Frequency",
    "backup-location": "Backup Location",
    "create-backup-now": "Create backup now",

    // Team Settings
    "team-settings": "Team",
    "team-settings-description": "Manage your clinic members and their permissions",
    "invite-member": "Invite Member",
    "invite-sent": "Invitation sent to",
    "member-list": "Member List",
    "full-name": "Full Name",
    "role": "Role",
    "actions": "Actions",
    "invite": "Invite",
    "inviting": "Inviting...",
    "email-placeholder": "email@example.com",
    "name-placeholder": "Dr. John Doe",
    
    // Form States
    saving: "Saving...",
    lightMode: "Light",
    darkMode: "Dark",
    systemMode: "System",

    // Onboarding
    "onboarding-title": "Start your path to a better clinic",
    "onboarding-subtitle": "Get full access to all features for 14 days. No credit card required.",
    "step-1": "Personal Information",
    "step-2": "Clinic Details",
    "first-name": "First Name",
    "last-name": "Last Name",
    "clinic-name": "Clinic Name",
    "clinic-size": "Clinic Size",
    "software-current": "Current Software (if any)",
    "software-placeholder": "Select your current software",
    "additional-info": "Additional Information (Optional)",
    "additional-info-placeholder": "Tell us about your needs or specific challenges",
    "next-step": "Next Step",
    "back": "Back",
    "start-trial": "Start Free Trial",
    "size-1-2": "1-2 Professionals",
    "size-3-5": "3-5 Professionals",
    "size-6-plus": "6+ Professionals",
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
