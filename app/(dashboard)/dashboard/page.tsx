"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users,
  Calendar,
  Clock,
  Mail,
  Plus,
  ChevronDown,
  ChevronUp,
  UserPlus,
  CalendarPlus,
  Zap,
  Check,
  X,
  CalendarClock,
  Send,
  ArrowRight,
  CircleCheckBig,
  Activity,
  FileText,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { supabase } from "@/lib/supabase"
import { Appointment } from "@/types"
import { AsyncPatientSelect } from "@/components/async-patient-select"
import { AppointmentEditor } from "@/components/appointment-editor"
import { clinicDayKey, clinicDate, clinicTime } from "@/lib/agenda.mjs"
import { isPrescriptionRole, patientRecipesPath } from "@/lib/prescription-policy.mjs"
import { usePrivateMediaUrl } from "@/hooks/use-private-media"

export default function DashboardPage() {
  const router = useRouter()
  const { user, currentClinicId, authError } = useAuth()
  const isClinical = user?.role === "doctor" || user?.role === "clinic_owner"
  const scope = `${currentClinicId || ""}:${user?.id || ""}:${user?.role || ""}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const operationController = useRef<AbortController | null>(null)
  const { t } = useTranslation()
  const { appointments, patients, patientTotal, isLoading, hasError, hasAuthority, refreshData } = useDashboardData()

  // Fetch clinic name & logo directly from Supabase so it's always fresh
  const [clinicName, setClinicName] = useState("Clinia +")
  const [clinicLogoPath, setClinicLogoPath] = useState<{ scope: string; raw: string | null } | null>(null)
  const clinicLogoUrl = usePrivateMediaUrl('clinic-branding', clinicLogoPath?.scope === scope ? clinicLogoPath.raw : null)

  // Resolve professional title from profile
  const memberTitle = user?.title || ''

  useEffect(() => {
    const controller = new AbortController()
    setClinicName("Clinia +")
    setClinicLogoPath(null)
    if (!currentClinicId || !user?.id) return
    const fetchClinicBranding = async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('name, logo_url')
        .eq('id', currentClinicId)
        .abortSignal(controller.signal).single()

      if (!controller.signal.aborted && scopeRef.current === scope && !error && data) {
        setClinicName(data.name || "Clinia +")
        setClinicLogoPath({ scope, raw: data.logo_url || null })
      }
    }
    void fetchClinicBranding().catch(() => {})
    return () => controller.abort()
  }, [scope, currentClinicId, user?.id, user?.role])

  const [collapsedSegments, setCollapsedSegments] = useState({
    metrics: false,
    guide: false,
    appointments: false,
    otherMetrics: false,
  })

  useEffect(() => {
    const stored = localStorage.getItem("dashboard_collapsed_segments")
    if (stored) {
      try {
        setCollapsedSegments(JSON.parse(stored))
      } catch (e) {
        console.error("Error loading collapsed segments state:", e)
      }
    }
  }, [])

  const toggleSegment = (segment: keyof typeof collapsedSegments) => {
    const updated = {
      ...collapsedSegments,
      [segment]: !collapsedSegments[segment]
    }
    setCollapsedSegments(updated)
    localStorage.setItem("dashboard_collapsed_segments", JSON.stringify(updated))
  }

  // Dynamic empty state phrases
  const [todayPhrase] = useState(() => {
    const phrases = [
      "Un día tranquilo es perfecto para organizar tu clínica.",
      "No hay citas hoy. ¿Qué tal si revisas el inventario?",
      "Todo al día. Aprovecha para preparar tus próximos casos.",
      "Día libre de citas. ¡Un buen momento para actualizar historias clínicas!"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  })

  const [upcomingPhrase] = useState(() => {
    const phrases = [
      "Tu calendario te está esperando. ¡Agrega nuevas citas!",
      "Aún no hay citas futuras. Es buen momento para marketing.",
      "El futuro está libre. Empieza a agendar pronto.",
      "Invita a tus pacientes a su revisión anual."
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  })

  // Strategic Onboarding progress
  const onboardingSteps = [
    { id: 'profile', title: 'Completa tu perfil profesional', done: !!user?.name && !!user?.phone && !!user?.bio, href: '/profile' },
    { id: 'patients', title: 'Registra tu primer paciente', done: (patientTotal || 0) > 0, href: '/patients' },
    { id: 'calendar', title: 'Agenda y confirma tu primera cita', done: appointments.length > 0, href: '/calendar' },
  ]
  const progressPercent = Math.round((onboardingSteps.filter(s => s.done).length / onboardingSteps.length) * 100)
  const showOnboarding = progressPercent < 100

  // Computed data
  const recentAppointments = appointments
    .filter(a => clinicDayKey(a.start_time) === clinicDayKey())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const upcomingAppointments = appointments
    .filter(a => Date.parse(a.start_time) > Date.now() && (a.status === 'scheduled' || a.status === 'confirmed'))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const displayedUpcomingAppointments = upcomingAppointments.slice(0, 5)

  const allStats = [
    {
      title: t("total-patients"),
      value: patientTotal === undefined ? "No disponible" : patientTotal.toString(),
      change: "", 
      icon: Users,
      color: "text-blue-600",
      href: "/patients"
    },
    {
      title: t("appointments-today"),
      value: recentAppointments.length.toString(),
      change: "",
      icon: Calendar,
      color: "text-emerald-600",
      href: "/calendar"
    },
    {
      title: "Citas futuras (próximos 30 días)",
      value: upcomingAppointments.length.toString(), 
      change: "",
      icon: Clock,
      color: "text-purple-600",
      href: "/calendar"
    },
  ]

  const stats = allStats

  // State
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false)
  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false)
  const [prescriptionPatientId, setPrescriptionPatientId] = useState("")
  const [canIssuePrescription, setCanIssuePrescription] = useState(false)
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false)
  const [isAppointmentDetailsOpen, setIsAppointmentDetailsOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  useEffect(() => {
    let active = true
    setCanIssuePrescription(false)
    setIsNewPrescriptionOpen(false)
    setPrescriptionPatientId("")
    if (!user?.id || !currentClinicId) return () => { active = false }

    const checkPrescriptionAccess = async () => {
      const { data: role, error: roleError } = await supabase.rpc("get_clinic_member_role", {
        check_clinic_id: currentClinicId,
      })
      if (roleError || !isPrescriptionRole(role)) return

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle()
      if (active && !profileError && profile?.status === "active") setCanIssuePrescription(true)
    }

    void checkPrescriptionAccess()
    return () => { active = false }
  }, [user?.id, user?.role, currentClinicId])

  useEffect(() => {
    operationController.current?.abort()
    setIsNewAppointmentOpen(false)
    setIsAppointmentDetailsOpen(false)
    setSelectedAppointment(null)
    setIsSubmittingAppointment(false)
    return () => operationController.current?.abort()
  }, [scope])

  // Handlers
  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsAppointmentDetailsOpen(true)
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedAppointment || !hasAuthority || !currentClinicId || isSubmittingAppointment) return
    const operationScope = scope
    const controller = new AbortController()
    operationController.current = controller
    setIsSubmittingAppointment(true)
    try {
      const { data, error } = await supabase.rpc("save_clinic_appointment", {
        p_clinic_id: currentClinicId, p_appointment_id: selectedAppointment.id, p_data: { status },
      }).abortSignal(controller.signal)
      if (error || !data || typeof data.id !== "string") throw new Error("No se pudo actualizar")
      if (scopeRef.current !== operationScope || controller.signal.aborted) return
      toast.success(status === "confirmed" ? "Cita confirmada" : "Cita cancelada")
      void refreshData()
      setIsAppointmentDetailsOpen(false)
    } catch {
      if (scopeRef.current === operationScope && !controller.signal.aborted) toast.error("No se pudo actualizar la cita. Revisa tu acceso y reintenta.")
    } finally {
      if (scopeRef.current === operationScope) setIsSubmittingAppointment(false)
    }
  }

  const handleSendMessage = () => {
    if (!selectedAppointment || !selectedAppointment.patients?.phone) {
        toast.error("No hay número de teléfono disponible")
        return
    }
    const message = `Hola ${selectedAppointment.patients.first_name}, recordatorio de su cita...`
    window.open(`https://wa.me/${selectedAppointment.patients.phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleSendReminder = () => {
      // Functional placeholder for now
      toast.info("Funcionalidad de envío masivo de correos próximamente")
  }

  if (!isLoading && (hasError || !hasAuthority || authError)) {
    return <div role="alert" className="space-y-3 p-6">
      <p>No se pudo cargar el panel. Revisa el acceso a la clínica y reintenta.</p>
      {hasAuthority && <Button onClick={() => void refreshData()}>Reintentar</Button>}
    </div>
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
            <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>
            ))}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
             <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
         </div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes custom-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-custom-shimmer {
          animation: custom-shimmer 2.2s infinite linear;
        }
        @keyframes slow-pulse {
          0%, 100% { opacity: 1; box-shadow: var(--pulse-shadow); }
          50% { opacity: 0.35; box-shadow: none; }
        }
        .animate-slow-pulse {
          animation: slow-pulse 3.5s ease-in-out infinite;
        }
        .seg-dot-metrics  { --pulse-shadow: 0 0 10px rgba(16,185,129,0.6); }
        .seg-dot-guide    { --pulse-shadow: 0 0 10px rgba(20,82,71,0.6);   }
        .seg-dot-appts    { --pulse-shadow: 0 0 10px rgba(59,130,246,0.6); }
        .seg-dot-other    { --pulse-shadow: 0 0 10px rgba(139,92,246,0.6); }
      `}} />
      <div className="space-y-6">
        {/* Premium Branded Greeting Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-r from-teal-900/90 via-teal-800/80 to-teal-900/90 p-6 sm:p-8 text-white shadow-md">
          {/* Subtle decorative circles */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Clinic Logo — from My Clinic settings */}
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden border border-white/20 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.08)] shrink-0 flex items-center justify-center backdrop-blur-md ring-2 ring-white/10">
                {clinicLogoUrl ? (
                  <img src={clinicLogoUrl} alt={clinicName} className="object-cover h-full w-full" />
                ) : (
                  /* Initials avatar fallback when no logo is uploaded */
                  <span className="text-2xl sm:text-3xl font-black text-white/90 font-montserrat select-none tracking-tight">
                    {clinicName.replace("Clinia +", "C+").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "C+"}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                {/* Clinic name as branded badge */}
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] sm:text-xs font-bold tracking-wide bg-teal-500/30 text-teal-100 border border-teal-400/30 backdrop-blur-sm">
                  {clinicName}
                </span>
                {/* Personalised greeting as main heading */}
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-montserrat truncate leading-tight">
                  ¡Hola, {memberTitle ? `${memberTitle} ` : ''}{user?.name?.split(" ")[0] || 'Doctor'}!
                </h1>
                {/* Professional subtitle — live date */}
                <p className="text-xs text-teal-200/60 font-medium tracking-wide">
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Button 
                onClick={() => setIsNewAppointmentOpen(true)}
                className="bg-[#FAA805] hover:bg-[#FAA805]/95 text-slate-900 font-bold border-0 shadow-md h-11 px-5 rounded-xl transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cita
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="relative overflow-hidden bg-white/10 hover:bg-[#FAA805] border-white/20 hover:border-[#FAA805] text-white hover:text-slate-900 font-bold h-11 px-5 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:shadow-[0_0_20px_rgba(250,168,5,0.4)] group backdrop-blur-md"
                  >
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-custom-shimmer" />
                    <Zap className="h-4 w-4 mr-2 text-[#FAA805] group-hover:text-slate-900 transition-colors duration-300 group-hover:scale-110" />
                    <span className="font-montserrat tracking-wide text-sm">{t("quick-actions")}</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-60 group-hover:rotate-180 transition-transform duration-300" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                {hasAuthority && <DropdownMenuItem 
                  onClick={() => router.push('/patients?new=1')}
                  className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                      <UserPlus className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-medium text-sm">Nuevo Paciente</span>
                      <span className="text-xs text-muted-foreground/80">Registrar paciente</span>
                    </div>
                  </div>
                </DropdownMenuItem>}
                
                {isClinical && canIssuePrescription && <DropdownMenuItem 
                  onClick={() => {
                    setPrescriptionPatientId("")
                    setIsNewPrescriptionOpen(true)
                  }}
                  className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 transition-colors">
                      <FileText className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-medium text-sm">Nueva Receta Médica</span>
                      <span className="text-xs text-muted-foreground/80">Emitir receta o prescripción</span>
                    </div>
                  </div>
                </DropdownMenuItem>}
                
                <DropdownMenuSeparator className="my-2" />
                
                <DropdownMenuItem 
                  onClick={handleSendReminder}
                  className="cursor-pointer py-3 px-3 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 dark:bg-foreground/10 transition-colors">
                      <Mail className="h-4 w-4 text-foreground/60 dark:text-foreground/70" />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-medium text-sm">Enviar Recordatorio</span>
                      <span className="text-xs text-muted-foreground/80">Notificación por email</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Dialog open={isClinical && canIssuePrescription && isNewPrescriptionOpen} onOpenChange={setIsNewPrescriptionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Receta Médica</DialogTitle>
            <DialogDescription>Selecciona al paciente para abrir su editor de recetas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Paciente</Label>
              <AsyncPatientSelect value={prescriptionPatientId} onValueChange={setPrescriptionPatientId} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNewPrescriptionOpen(false)}>Cancelar</Button>
            <Button
              disabled={!isClinical || !canIssuePrescription || !patientRecipesPath(prescriptionPatientId)}
              onClick={() => {
                const destination = patientRecipesPath(prescriptionPatientId)
                if (!canIssuePrescription || !destination) return
                setIsNewPrescriptionOpen(false)
                router.push(destination)
              }}
            >
              Abrir receta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isNewAppointmentOpen && <AppointmentEditor key={scope} open onOpenChange={setIsNewAppointmentOpen} onSuccess={() => { toast.success("Cita creada"); void refreshData() }} />}

      {/* Appointment Details */}
      <Dialog open={isAppointmentDetailsOpen} onOpenChange={setIsAppointmentDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de la Cita</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback>{selectedAppointment.patients?.first_name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-semibold text-lg">{selectedAppointment.patients?.first_name} {selectedAppointment.patients?.last_name}</h3>
                        <Badge variant={selectedAppointment.status === "confirmed" ? "default" : "secondary"}>{selectedAppointment.status}</Badge>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <Label className="text-muted-foreground">Fecha</Label>
                        <p>{clinicDate(selectedAppointment.start_time)}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">Hora</Label>
                        <p>{clinicTime(selectedAppointment.start_time)}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">Tratamiento</Label>
                        <p>{selectedAppointment.type}</p>
                    </div>
                </div>
                {isClinical && selectedAppointment.notes && (
                    <div className="bg-muted p-2 rounded text-sm">
                        {selectedAppointment.notes}
                    </div>
                )}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" disabled={isSubmittingAppointment} onClick={() => handleUpdateStatus('confirmed')}>
                        <Check className="w-4 h-4 mr-1" /> Confirmar
                    </Button>
                    <Button size="sm" variant="destructive" disabled={isSubmittingAppointment} onClick={() => handleUpdateStatus('cancelled')}>
                         <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" variant="secondary" className="ml-auto" onClick={handleSendMessage}>
                         <Send className="w-4 h-4 mr-1" /> Mensaje
                    </Button>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 1. Métricas Clave Segment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full transition-all duration-500 seg-dot-metrics ${collapsedSegments.metrics ? 'bg-muted-foreground/30' : 'bg-emerald-500 animate-slow-pulse'}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 font-montserrat">
              Resumen de la clínica
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSegment('metrics')}
            className="h-6 px-2 rounded-md hover:bg-teal-500/10 text-[10px] font-bold text-muted-foreground hover:text-teal-600 transition-all active:scale-95 flex items-center gap-1 border border-transparent hover:border-teal-500/20"
          >
            {collapsedSegments.metrics ? (
              <>
                <ChevronDown className="w-3 h-3" />
                Mostrar
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                Ocultar
              </>
            )}
          </Button>
        </div>
        
        {!collapsedSegments.metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {stats.map((stat) => (
              <Link href={stat.href} key={stat.title}>
                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full border-border/60 hover:border-teal-500/40 hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                      {stat.change && <p className="text-xs text-muted-foreground mt-1">
                        <span className={stat.change.startsWith("+") ? "text-emerald-500" : "text-rose-500"}>{stat.change}</span> vs mes anterior
                      </p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="h-0.5 bg-gradient-to-r from-transparent via-border/20 to-transparent rounded-full" />
        )}
      </div>

      {/* 2. Guía de Inicio Rápido Segment */}
      {showOnboarding && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-all duration-500 seg-dot-guide ${collapsedSegments.guide ? 'bg-muted-foreground/30' : 'bg-teal-500 animate-slow-pulse'}`} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 font-montserrat">
                Guía de Inicio Rápido
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSegment('guide')}
              className="h-6 px-2 rounded-md hover:bg-teal-500/10 text-[10px] font-bold text-muted-foreground hover:text-teal-600 transition-all active:scale-95 flex items-center gap-1 border border-transparent hover:border-teal-500/20"
            >
              {collapsedSegments.guide ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Mostrar
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Ocultar
                </>
              )}
            </Button>
          </div>
          
          {!collapsedSegments.guide ? (
            <Card className="border-[#E8D9C9] dark:border-neutral-800 shadow-sm bg-gradient-to-br from-white to-[#E8D9C9]/50 dark:from-neutral-900 dark:to-neutral-950 overflow-hidden relative animate-in fade-in duration-300">
               <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <Activity className="w-32 h-32 text-[#145247]" />
               </div>
               <CardHeader>
                 <CardTitle className="text-lg text-foreground/90 dark:text-neutral-50">Configura tu Clínica al 100%</CardTitle>
                 <CardDescription className="dark:text-neutral-400">Completa estos pasos esenciales para iniciar operaciones</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="mb-4 flex items-center gap-4">
                     <div className="flex-1 h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#145247] transition-all duration-1000 ease-out" 
                          style={{ width: `${progressPercent}%` }}
                        />
                     </div>
                     <span className="text-sm font-bold text-slate-700 dark:text-neutral-300">{progressPercent}%</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                     {onboardingSteps.map((step) => (
                        <Link href={step.href} key={step.id}>
                          <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md active:scale-95 active:brightness-90 ${step.done ? 'bg-card/60 dark:bg-neutral-800/50 border-[#E8D9C9]/50 dark:border-neutral-700 opacity-70' : 'bg-card dark:bg-neutral-800 border-[#E8D9C9] dark:border-neutral-700 hover:border-[#145247] dark:hover:border-teal-600'}`}>
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-[#E8D9C9] text-[#145247]' : 'bg-slate-100 dark:bg-neutral-700 text-slate-400 dark:text-neutral-500'}`}>
                                {step.done ? <Activity className="w-4 h-4" /> : <div className="w-2 h-2 bg-current rounded-full" />}
                             </div>
                             <div className="flex-1">
                                <p className={`text-sm font-medium ${step.done ? 'text-slate-500 dark:text-neutral-500 line-through' : 'text-slate-700 dark:text-neutral-100'}`}>{step.title}</p>
                             </div>
                             {!step.done && <ArrowRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </Link>
                     ))}
                  </div>
               </CardContent>
            </Card>
          ) : (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-border/20 to-transparent rounded-full" />
          )}
        </div>
      )}

      {/* 3. Agenda del Día Segment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full transition-all duration-500 seg-dot-appts ${collapsedSegments.appointments ? 'bg-muted-foreground/30' : 'bg-blue-500 animate-slow-pulse'}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 font-montserrat">
              Agenda del Día
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSegment('appointments')}
            className="h-6 px-2 rounded-md hover:bg-teal-500/10 text-[10px] font-bold text-muted-foreground hover:text-teal-600 transition-all active:scale-95 flex items-center gap-1 border border-transparent hover:border-teal-500/20"
          >
            {collapsedSegments.appointments ? (
              <>
                <ChevronDown className="w-3 h-3" />
                Mostrar
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                Ocultar
              </>
            )}
          </Button>
        </div>

        {!collapsedSegments.appointments ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {/* Today Appointments */}
            <Card className="border-border/60 hover:border-blue-500/30 transition-colors">
                <CardHeader>
                    <CardTitle>Citas de Hoy</CardTitle>
                    <CardDescription>Tienes {recentAppointments.length} citas hoy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {recentAppointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
                            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-2">
                               <Activity className="w-6 h-6" />
                            </div>
                            <p className="text-muted-foreground text-sm max-w-[250px]">{todayPhrase}</p>
                        </div>
                    ) : (
                        recentAppointments.map(app => (
                            <div key={app.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(app)}>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback>{app.patients?.first_name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{app.patients?.first_name} {app.patients?.last_name}</p>
                                        <p className="text-xs text-muted-foreground">{app.type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline">{clinicTime(app.start_time)}</Badge>
                                </div>
                            </div>
                        ))
                    )}
                    <Link href="/calendar?view=today">
                        <Button variant="outline" className="w-full mt-4">Ver todas las citas</Button>
                    </Link>
                </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card className="border-border/60 hover:border-blue-500/30 transition-colors">
                <CardHeader>
                    <CardTitle>Próximas Citas</CardTitle>
                    <CardDescription>Siguientes días</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {upcomingAppointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2">
                               <Calendar className="w-6 h-6" />
                            </div>
                            <p className="text-muted-foreground text-sm max-w-[250px]">{upcomingPhrase}</p>
                        </div>
                    ) : (
                        displayedUpcomingAppointments.map(app => (
                            <div key={app.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(app)}>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback>{app.patients?.first_name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{app.patients?.first_name} {app.patients?.last_name}</p>
                                        <p className="text-xs text-muted-foreground">{clinicDate(app.start_time)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-mono">{clinicTime(app.start_time)}</span>
                                </div>
                            </div>
                        ))
                    )}
                     <Link href="/calendar?view=month">
                        <Button className="w-full mt-4">Ver calendario completo</Button>
                    </Link>
                </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-0.5 bg-gradient-to-r from-transparent via-border/20 to-transparent rounded-full" />
        )}
      </div>

      {/* 4. Pacientes Recientes & Actividad Clínica Segment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full transition-all duration-500 seg-dot-other ${collapsedSegments.otherMetrics ? 'bg-muted-foreground/30' : 'bg-teal-500 animate-slow-pulse'}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 font-montserrat">
              Pacientes Recientes &amp; Actividad Clínica
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSegment('otherMetrics')}
            className="h-6 px-2 rounded-md hover:bg-teal-500/10 text-[10px] font-bold text-muted-foreground hover:text-teal-600 transition-all active:scale-95 flex items-center gap-1 border border-transparent hover:border-teal-500/20"
          >
            {collapsedSegments.otherMetrics ? (
              <>
                <ChevronDown className="w-3 h-3" />
                Mostrar
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                Ocultar
              </>
            )}
          </Button>
        </div>

        {!collapsedSegments.otherMetrics ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Recent Patients */}
            <Card className="border-border/60 hover:border-teal-500/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground/90">
                  <Users className="w-5 h-5 text-teal-600" />
                  Pacientes Recientes
                </CardTitle>
                <Link href="/patients">
                  <Button variant="ghost" size="sm" className="text-xs font-bold text-teal-600 hover:text-teal-700">
                    Ver todos ({patientTotal ?? "No disponible"})
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {patients.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No hay pacientes registrados aún.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patients.slice(0, 5).map((p: any) => (
                      <Link 
                        key={p.id} 
                        href={isClinical ? `/patients/${p.id}` : "/patients"}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/40 hover:bg-muted/80 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border/60">
                            <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.cedula ? `C.I: ${p.cedula}` : p.phone || "Sin cédula"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {isClinical ? "Ver Historia HCU" : "Ver pacientes"}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card className="border-border/50 shadow-sm hover:border-violet-500/30 transition-colors">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-teal-600" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Seguimiento de las últimas acciones en la clínica</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {onboardingSteps.filter(s => s.done).map((step) => (
                    <div key={step.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="mt-1 w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                        <CircleCheckBig className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground/90 truncate">
                            {step.id === 'profile' ? 'Identidad Clínica Verificada' :
                             step.id === 'services' ? 'Catálogo de Especialidades Activo' :
                             step.id === 'patients' ? 'Primer paciente registrado' :
                             'Calendario de Citas Operativo'}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Completado</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{step.title}</p>
                      </div>
                    </div>
                  ))}

                  {onboardingSteps.filter(s => s.done).length === 0 && appointments.length === 0 && (
                    <div className="py-10 text-center">
                       <p className="text-sm text-slate-400 italic">No hay actividad reciente. ¡Comienza completando tu perfil!</p>
                    </div>
                  )}

                  {appointments.slice(0, 2).map((app) => (
                    <div key={`app-${app.id}`} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="mt-1 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground/90 truncate">Nueva Cita Programada</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {clinicTime(app.created_at || new Date())}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Paciente: {app.patients?.first_name} {app.patients?.last_name} para {app.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                   <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest">
                     Actividad basada en los registros de pacientes y agenda
                   </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-0.5 bg-gradient-to-r from-transparent via-border/20 to-transparent rounded-full" />
        )}
      </div>
    </div>
  </>
)
}
