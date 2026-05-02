"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Mail, Phone, Stethoscope, User, Loader2, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { inviteTeamMember } from "@/app/actions/invite-member"
import { Badge } from "@/components/ui/badge"

interface TeamMember {
  id: string
  name: string
  specialty: string
  email: string
  phone: string
  avatar: string
  role: string
  status?: string
}

export default function DentistsPage() {
  const { user, currentClinicId } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState("doctor")
  const [isInviting, setIsInviting] = useState(false)

  const isAdmin = user?.role === "clinic_owner"
  const isReceptionist = user?.role === "receptionist"
  
  // Get clinic size from the membership
  const currentMembership = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)
  const rawSize = currentMembership?.clinics?.size || currentMembership?.clinics?.settings?.practice_size || "1-2"
  
  let maxSeats = 2
  if (rawSize === "3-5") maxSeats = 5
  if (rawSize === "6+" || rawSize === "6-plus") maxSeats = 10

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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('clinic_id', currentClinicId)
      
      if (error) throw error
      
      if (data) {
        setMembers(data.map(p => ({
          id: p.id,
          name: p.full_name || p.email?.split('@')[0] || "Usuario",
          specialty: p.specialization || "Especialista",
          email: p.email || "",
          phone: p.phone || "",
          avatar: p.avatar_url || "",
          role: p.role,
          status: p.status
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
      
      await inviteTeamMember(formData)
      
      toast.success("¡Invitación enviada!")
      setIsInviteOpen(false)
      setInviteEmail("")
      setInviteName("")
      fetchMembers() // Refresh list to show pending
    } catch (error: any) {
      toast.error(error.message || "Error al enviar la invitación")
    } finally {
      setIsInviting(false)
    }
  }

  const handleDelete = async (id: string) => {
     if (!confirm("¿Seguro que deseas eliminar a este miembro?")) return
     // Soft delete or remove clinic_id
     const { error } = await supabase.from('profiles').update({ clinic_id: null }).eq('id', id)
     if (!error) {
       toast.success("Miembro removido")
       fetchMembers()
     } else {
       toast.error("Error al remover")
     }
  }

  const emptySeatsCount = Math.max(0, maxSeats - members.length)
  const emptySeats = Array.from({ length: emptySeatsCount })

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión de Equipo">
         {/* Top right actions if needed */}
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Render Actual Members */}
          {members.map((member) => (
            <Card key={member.id} className="overflow-hidden hover:shadow-xl transition-all duration-500 group border-border/60 bg-card relative">
              <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-blue-600" />
              <CardHeader className="flex flex-row items-center gap-4 pb-3">
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-slate-50 shadow-md transition-transform group-hover:scale-105 duration-500">
                    <AvatarImage src={member.avatar} />
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
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border-none">
                      {member.role === 'clinic_owner' ? 'Dirección' : (member.role === 'receptionist' ? 'Gestión' : 'Especialista')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 pb-6">
                <div className="flex items-center gap-3 text-sm text-slate-500 bg-muted/50/50 p-2 rounded-lg border border-border/50/50">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate font-medium">{member.email || "Sin email"}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-3 text-sm text-slate-500 bg-muted/50/50 p-2 rounded-lg border border-border/50/50">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="truncate font-medium">{member.phone}</span>
                  </div>
                )}
                {member.status === 'pending' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Invitación Pendiente
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-100">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                    Activo en Clínica
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/50/80 p-3 flex justify-end gap-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                {isAdmin && member.id !== user?.id && (
                  <Button variant="ghost" size="sm" className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs" onClick={() => handleDelete(member.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remover del Equipo
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}

          {/* Render Empty Seats (Placeholders) */}
          {isAdmin && emptySeats.map((_, i) => (
            <Card key={`empty-${i}`} className="overflow-hidden border-2 border-dashed border-border bg-muted/50/50 flex flex-col justify-center items-center p-6 transition-all hover:border-teal-300 hover:bg-teal-50/30 group min-h-[220px]">
               <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-card group-hover:shadow-md transition-all">
                 <User className="w-8 h-8 text-slate-300 group-hover:text-teal-500" />
               </div>
               <h3 className="font-semibold text-slate-600 mb-1">Asiento Disponible</h3>
               <p className="text-xs text-slate-400 text-center mb-4">
                 Configuraste una clínica para {rawSize} miembros.
               </p>
               <Button 
                 variant="outline" 
                 className="bg-card border-border text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                 onClick={() => setIsInviteOpen(true)}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Invitar Miembro
               </Button>
            </Card>
          ))}
        </div>
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
                <Label htmlFor="name" className="font-semibold">Nombre del Doctor</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ej. Dra. Valeria"
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
                <select 
                  id="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="doctor">Doctor / Especialista</option>
                  <option value="receptionist">Recepcionista / Asistente</option>
                </select>
              </div>
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
    </div>
  )
}
