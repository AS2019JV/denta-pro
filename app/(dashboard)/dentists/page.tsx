"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Plus, Trash2, Mail, Phone, Stethoscope, User, Users, Loader2, Send, 
  Search as SearchIcon, UserPlus, LayoutGrid, Table as TableIcon, X, Check,
  Award, Briefcase, Calendar, ShieldCheck, MapPin
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { inviteTeamMember } from "@/app/actions/invite-member"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

interface TeamMember {
  id: string
  name: string
  specialty: string
  email: string
  phone: string
  avatar: string
  role: string
  status?: string
  license_number?: string
  bio?: string
}

export default function DentistsPage() {
  const { user, currentClinicId } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [searchMember, setSearchMember] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "doctors" | "staff">("all")
  
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState("doctor")
  const [inviteSpecialty, setInviteSpecialty] = useState("")
  const [isInviting, setIsInviting] = useState(false)

  const [generatedLink, setGeneratedLink] = useState("")
  const [isLinkCopyOpen, setIsLinkCopyOpen] = useState(false)

  const [subscriptionTier, setSubscriptionTier] = useState<string>("trial")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const isAdmin = user?.role === "clinic_owner"
  const isReceptionist = user?.role === "receptionist"
  
  // Get clinic size from the membership
  const currentMembership = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)
  const rawSize = currentMembership?.clinics?.size || currentMembership?.clinics?.settings?.practice_size || "1-2"
  
  // Seat structure: Default (Trial) = 10 seats, Start = 3, Pro = 6, Enterprise = 100/unlimited
  let maxSeats = 10
  if (subscriptionTier === 'start') maxSeats = 3
  else if (subscriptionTier === 'pro') maxSeats = 6
  else if (subscriptionTier === 'enterprise') maxSeats = 100
  else {
    // fallback based on size
    if (rawSize === "1-2") maxSeats = 3
    if (rawSize === "3-5") maxSeats = 6
    if (rawSize === "6+" || rawSize === "6-plus") maxSeats = 100
  }

  useEffect(() => {
    if (currentClinicId) {
      fetchMembers()
    } else {
      setIsLoading(false)
    }
  }, [currentClinicId])

  const fetchMembers = async () => {
    setIsLoading(true)
    try {
      // 1. Fetch clinic subscription tier
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('subscription_tier')
        .eq('id', currentClinicId)
        .single()
      
      if (clinicData) {
        setSubscriptionTier(clinicData.subscription_tier || "trial")
      }

      // 2. Fetch profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('clinic_id', currentClinicId)
      
      if (error) throw error
      
      if (data) {
        setMembers(data.map(p => ({
          id: p.id,
          name: p.full_name || p.email?.split('@')[0] || "Usuario",
          specialty: p.specialization || (p.role === 'receptionist' ? 'Gestión Clínica' : 'Especialista'),
          email: p.email || "",
          phone: p.phone || "",
          avatar: p.avatar_url 
            ? (p.avatar_url.startsWith('http') 
                ? p.avatar_url 
                : supabase.storage.from('doctor-avatars').getPublicUrl(p.avatar_url).data.publicUrl)
            : "",
          role: p.role,
          status: p.status,
          license_number: p.license_number || "No registrada",
          bio: p.bio || "Sin biografía profesional registrada."
        })))
      }
    } catch (err) {
      console.error("Error fetching members:", err)
      toast.error("Error al cargar el equipo")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentClinicId) return
    setIsInviting(true)
    
    try {
      const formData = new FormData()
      formData.append("email", inviteEmail)
      formData.append("name", inviteName)
      formData.append("clinicId", currentClinicId)
      formData.append("role", inviteRole)
      formData.append("specialization", inviteSpecialty || (inviteRole === 'doctor' ? 'Odontólogo General' : 'Administrativo'))
      
      const result = await inviteTeamMember(formData)
      
      if (result?.success && result?.inviteLink) {
        setGeneratedLink(result.inviteLink)
        setIsLinkCopyOpen(true)
      }
      
      toast.success("¡Invitación procesada exitosamente!")
      setIsInviteOpen(false)
      setInviteEmail("")
      setInviteName("")
      setInviteSpecialty("")
      fetchMembers() // Refresh list to show pending
    } catch (error: any) {
      toast.error(error.message || "Error al enviar la invitación")
    } finally {
      setIsInviting(false)
    }
  }

  const handleDelete = async (id: string) => {
     if (!confirm("¿Seguro que deseas remover a este miembro del equipo?")) return
     // Remove from clinic
     const { error } = await supabase.from('profiles').update({ clinic_id: null }).eq('id', id)
     if (!error) {
       toast.success("Miembro removido de la clínica")
       fetchMembers()
     } else {
       toast.error("Error al remover miembro")
     }
  }

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name?.toLowerCase().includes(searchMember.toLowerCase()) ||
                          m.email?.toLowerCase().includes(searchMember.toLowerCase())
    if (!matchesSearch) return false

    if (activeTab === "doctors") return m.role === "doctor" || m.role === "clinic_owner"
    if (activeTab === "staff") return m.role === "receptionist"
    return true
  })

  const emptySeatsCount = Math.max(0, maxSeats - members.length)
  const emptySeats = Array.from({ length: emptySeatsCount })

  const getRoleBadge = (role: string) => {
    const config = {
      clinic_owner: { label: "Dirección", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
      receptionist: { label: "Gestión", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
      doctor: { label: "Especialista", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
    }
    const c = config[role as keyof typeof config] || config.doctor
    return (
      <Badge variant="secondary" className={`${c.className} text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border-none`}>
        {c.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <p className="text-sm font-semibold text-teal-600 mb-1">Administración de Personal</p>
           <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Mi Equipo Clínico</h1>
        </div>
        
        {/* View toggle + search + action button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar miembros..."
              className="pl-9 h-10 border-border bg-card"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
            />
          </div>
          
          {/* View mode toggle */}
          <div className="flex p-1 bg-muted rounded-lg border border-border">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "cards"
                  ? "bg-card shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tarjetas
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-card shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>
          
          {isAdmin && (
            <Button
              className="bg-teal-600 hover:bg-teal-700 h-10 font-bold shadow-md shadow-teal-600/20"
              disabled={members.length >= maxSeats}
              onClick={() => setIsInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Miembro
            </Button>
          )}
        </div>
      </div>

      {/* Dynamic Capacity Meter */}
      <div className="bg-card/45 backdrop-blur-md rounded-2xl border border-border/80 p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex-1 w-full space-y-2">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-teal-600" />
              Asientos del Equipo ({subscriptionTier === 'trial' ? 'Prueba 14 Días' : subscriptionTier.toUpperCase()})
            </span>
            <span className="text-foreground">
              {members.length} de {maxSeats === 100 ? "Ilimitados" : maxSeats} Utilizados
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-border/40">
            <div 
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                members.length >= maxSeats
                  ? 'from-rose-500 to-rose-600'
                  : members.length >= maxSeats * 0.8
                  ? 'from-amber-500 to-amber-600'
                  : 'from-teal-500 to-emerald-600'
              }`}
              style={{ width: `${Math.min(100, (members.length / maxSeats) * 100)}%` }}
            />
          </div>
        </div>

        {/* Upgrade alert if limit reached */}
        {members.length >= maxSeats && maxSeats !== 100 && (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 rounded-xl w-full md:w-auto shrink-0 animate-pulse">
            <div className="text-center sm:text-left">
              <p className="text-xs font-black text-rose-700 dark:text-rose-400">
                ¡Límite de Asientos Alcanzado!
              </p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 max-w-[250px] mt-0.5 leading-normal">
                Para agregar más miembros a tu equipo médico, mejora tu plan de suscripción.
              </p>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-4 rounded-lg w-full sm:w-auto shadow-sm shadow-rose-600/10"
                onClick={() => router.push('/settings?tab=subscription')}
              >
                Mejorar Plan
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Premium Team Tabs Filter */}
      <div className="flex border-b border-border/60 pb-px">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${
              activeTab === "all"
                ? "text-teal-600 dark:text-teal-400 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({members.length})
            {activeTab === "all" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("doctors")}
            className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${
              activeTab === "doctors"
                ? "text-teal-600 dark:text-teal-400 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Doctores y Especialistas ({members.filter(m => m.role === 'doctor' || m.role === 'clinic_owner').length})
            {activeTab === "doctors" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${
              activeTab === "staff"
                ? "text-teal-600 dark:text-teal-400 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Personal Administrativo ({members.filter(m => m.role === 'receptionist').length})
            {activeTab === "staff" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : viewMode === "cards" ? (
        /* ============ CARD VIEW ============ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Render Actual Members */}
          {filteredMembers.map((member) => (
            <Card key={member.id} className="overflow-hidden hover:shadow-xl transition-all duration-500 group border-border/60 bg-card relative flex flex-col">
              <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-blue-600" />
              <CardHeader className="flex flex-row items-center gap-4 pb-3">
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-slate-50 shadow-md transition-transform group-hover:scale-105 duration-500">
                    <AvatarImage src={member.avatar} className="object-cover" />
                    <AvatarFallback className="text-xl bg-teal-50 text-teal-700 font-bold">
                      {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.status === 'pending' && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 border-2 border-white rounded-full animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-bold text-foreground truncate group-hover:text-teal-600 transition-colors">
                    {member.name}
                  </CardTitle>
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    {member.specialty}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {getRoleBadge(member.role)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 pb-6 flex-1">
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg border border-border/50">
                  <Mail className="h-4 w-4 text-muted-foreground/70" />
                  <span className="truncate font-medium">{member.email || "Sin email"}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg border border-border/50">
                    <Phone className="h-4 w-4 text-muted-foreground/70" />
                    <span className="truncate font-medium">{member.phone}</span>
                  </div>
                )}
                {member.status === 'pending' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 w-fit">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Invitación Pendiente
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800 w-fit">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                    Activo en Clínica
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/30 px-4 py-3 flex justify-between gap-2 border-t border-border/50 mt-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50 border-teal-200 hover:border-teal-300 font-bold text-xs flex-1 transition-all"
                  onClick={() => {
                    setSelectedMember(member)
                    setIsProfileOpen(true)
                  }}
                >
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  Ver Perfil
                </Button>
                {isAdmin && member.id !== user?.id && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs px-2.5" 
                    onClick={() => handleDelete(member.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}

          {/* Render Empty Seats (Placeholders) */}
          {isAdmin && emptySeats.map((_, i) => (
            <Card key={`empty-${i}`} className="overflow-hidden border-2 border-dashed border-border bg-muted/50 flex flex-col justify-center items-center p-6 transition-all hover:border-teal-300 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 group min-h-[220px]">
               <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-card group-hover:shadow-md transition-all">
                 <User className="w-8 h-8 text-muted-foreground/40 group-hover:text-teal-500" />
               </div>
               <h3 className="font-semibold text-muted-foreground mb-1">Asiento Disponible</h3>
               <p className="text-xs text-muted-foreground/60 text-center mb-4">
                 Configuraste una clínica para {rawSize} miembros.
               </p>
               <Button 
                 variant="outline" 
                 className="bg-card border-border text-teal-600 hover:bg-teal-50 hover:text-teal-700 font-bold"
                 onClick={() => setIsInviteOpen(true)}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Invitar Miembro
               </Button>
            </Card>
          ))}
        </div>
      ) : (
        /* ============ TABLE VIEW ============ */
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-lg">Equipo Actual</CardTitle>
              <CardDescription>{filteredMembers.length} miembros activos · {emptySeatsCount} asientos disponibles</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Miembro</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map(member => (
                  <TableRow key={member.id} className="border-border/30 hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={member.avatar} className="object-cover" />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {member.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">{member.specialty}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell className="text-muted-foreground">{member.phone || "—"}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      {member.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400">
                          <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                          Activo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50 border-teal-200 hover:border-teal-300 font-bold text-xs"
                          onClick={() => {
                            setSelectedMember(member)
                            setIsProfileOpen(true)
                          }}
                        >
                          <User className="h-3.5 w-3.5 mr-1" />
                          Ver Perfil
                        </Button>
                        {isAdmin && member.id !== user?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold text-xs px-2.5" 
                            onClick={() => handleDelete(member.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <User className="h-8 w-8 mx-auto opacity-20 mb-2" />
                      {searchMember ? "No se encontraron miembros" : "No hay miembros en este grupo"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle>Invitar al Equipo</DialogTitle>
              <DialogDescription>
                Envía un enlace de acceso directo al nuevo miembro.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">Nombre Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ej. Dra. Valeria Cabrera"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@clinia.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="font-semibold">Rol del Miembro</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="h-10 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor / Especialista</SelectItem>
                    <SelectItem value="receptionist">Recepcionista / Asistente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "doctor" && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="specialty" className="font-semibold">Especialidad</Label>
                  <div className="relative">
                    <Stethoscope className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="specialty"
                      type="text"
                      placeholder="Ej. Ortodoncia, Odontopediatría"
                      value={inviteSpecialty}
                      onChange={(e) => setInviteSpecialty(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={isInviting || !inviteEmail}>
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profile Detail Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none rounded-3xl bg-card shadow-2xl">
          {selectedMember && (
            <div className="relative">
              {/* Header Gradient */}
              <div className="h-28 bg-gradient-to-r from-teal-500 via-teal-600 to-blue-600 relative">
                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Profile Meta */}
              <div className="px-6 pb-6 text-center -mt-12 relative z-10">
                <div className="flex justify-center mb-3">
                  <div className="p-1.5 bg-card rounded-full shadow-xl">
                    <Avatar className="h-24 w-24 border-2 border-background shadow-md">
                      <AvatarImage src={selectedMember.avatar} className="object-cover" />
                      <AvatarFallback className="text-3xl bg-teal-50 text-teal-700 font-bold">
                        {selectedMember.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-foreground tracking-tight">{selectedMember.name}</h3>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold tracking-wider uppercase mt-1 flex items-center justify-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {selectedMember.specialty}
                </p>
                <div className="flex justify-center mt-2.5">
                  {getRoleBadge(selectedMember.role)}
                </div>

                {/* Main Content Details */}
                <div className="mt-8 space-y-4 text-left border-t border-border/60 pt-6">
                  {/* Email & Phone */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Correo</span>
                      <p className="text-sm font-semibold truncate text-foreground mt-0.5">{selectedMember.email}</p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Teléfono</span>
                      <p className="text-sm font-semibold truncate text-foreground mt-0.5">{selectedMember.phone || "—"}</p>
                    </div>
                  </div>

                  {/* Specialty and Credentials */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/40 space-y-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Licencia Profesional (SENESCYT)</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{selectedMember.license_number || "No registrada"}</p>
                    </div>
                  </div>

                  {/* Professional Biography */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Biografía Profesional</span>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 whitespace-pre-line">
                      {selectedMember.bio || "Sin biografía profesional registrada."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Direct Invitation Link / Share Dialog */}
      <Dialog open={isLinkCopyOpen} onOpenChange={setIsLinkCopyOpen}>
        <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl bg-card border border-border/80 shadow-2xl">
          <DialogHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 mb-3 animate-pulse">
              <Check className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">¡Miembro Invitado Exitosamente!</DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Se ha generado la invitación. También puedes compartir el siguiente enlace directo de registro para un acceso inmediato:
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 bg-muted/60 p-3 rounded-xl border border-border/50">
              <span className="text-xs font-mono truncate flex-1 text-muted-foreground select-all">
                {generatedLink}
              </span>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 shrink-0 font-bold"
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink)
                  toast.success("¡Enlace copiado al portapapeles!")
                }}
              >
                Copiar
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 font-semibold border-teal-200 text-teal-600 hover:bg-teal-50"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(`¡Hola! Aquí tienes tu enlace de invitación para unirte a nuestro equipo en Clinia+: ${generatedLink}`)}`, '_blank')
                }}
              >
                Compartir por WhatsApp
              </Button>
              <Button
                className="flex-1 bg-slate-900 hover:bg-slate-800 font-semibold text-white"
                onClick={() => setIsLinkCopyOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
