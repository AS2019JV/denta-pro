"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, CreditCard, Heart, ArrowRight, Loader2, Star, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

interface FamilyMember {
  id: string
  first_name: string
  last_name: string
  phone: string
  avatar_url: string | null
  family_relationship: string | null
  is_family_head: boolean
  family_representative_id: string | null
  appointments_count: number
  total_billed: number
  status: string
}

interface FamilyCenterProps {
  patientId: string
  patientName: string
  trigger?: React.ReactNode
}

export function FamilyCenter({ patientId, patientName, trigger }: FamilyCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      fetchFamily()
    }
  }, [isOpen, patientId])

  const fetchFamily = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_family_unit_with_stats', {
        p_patient_id: patientId
      })
      if (error) throw error
      setFamilyMembers(data || [])
    } catch (err) {
      console.error("Error fetching family:", err)
    } finally {
      setLoading(false)
    }
  }

  // Identify unique billing representatives in this group
  const billers = familyMembers.filter(m => m.is_family_head || m.family_representative_id === null)
  const dependents = familyMembers.filter(m => !m.is_family_head && m.family_representative_id !== null)

  // Color mapping for different family units (by billing rep)
  const groupColors: Record<string, string> = {
    0: "border-blue-500 shadow-blue-100",
    1: "border-purple-500 shadow-purple-100",
    2: "border-emerald-500 shadow-emerald-100",
    3: "border-pink-500 shadow-pink-100",
  }

  const getGroupStyle = (repId: string | null, targetId: string) => {
    const effectiveRepId = repId || targetId
    const index = billers.findIndex(b => b.id === effectiveRepId) % 4
    return groupColors[index] || groupColors[0]
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            Vincular Familia
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-slate-50/95 backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
                Contexto Familiar
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Gestión de parentesco y responsabilidad financiera para {patientName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="font-bold animate-pulse text-sm uppercase tracking-widest">Sincronizando Árbol Familiar...</p>
            </div>
          ) : (
            <div className="space-y-8 mt-4">
              {/* Billing Representatives Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Responsables de Pago</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {billers.map((biller, idx) => (
                    <motion.div
                      key={biller.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        "group relative bg-white rounded-2xl p-4 border-2 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden",
                        getGroupStyle(null, biller.id)
                      )}
                      onClick={() => {
                        setIsOpen(false)
                        router.push(`/patients/${biller.id}`)
                      }}
                    >
                      <div className="absolute top-0 right-0 p-2">
                         <Badge className="bg-amber-100 text-amber-700 border-none font-bold uppercase text-[9px] gap-1 px-2">
                           <Star className="h-3 w-3 fill-amber-500" />
                           TITULAR
                         </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 border-2 border-white ring-2 ring-slate-100">
                          <AvatarImage src={biller.avatar_url || ""} />
                          <AvatarFallback className="bg-slate-100 text-slate-700 font-black">
                            {biller.first_name[0]}{biller.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {biller.first_name} {biller.last_name}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">{biller.phone || "Sin teléfono"}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px] font-bold py-0 h-4">
                              ${biller.total_billed} Pagado
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {billers.length === 0 && (
                    <div className="col-span-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50">
                      <p className="text-sm font-medium italic">No hay representantes de pago asignados.</p>
                      <Button variant="link" size="sm" className="text-blue-600 font-bold">Asignar ahora</Button>
                    </div>
                  )}
                </div>
              </section>

              {/* Dependents Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Carga Familiar / Dependientes</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence mode="popLayout">
                    {dependents.map((member, idx) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: (billers.length + idx) * 0.05 }}
                        className={cn(
                          "group bg-white rounded-xl p-3 border-l-4 border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between",
                          getGroupStyle(member.family_representative_id, member.id)
                        )}
                        onClick={() => {
                          setIsOpen(false)
                          router.push(`/patients/${member.id}`)
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar_url || ""} />
                            <AvatarFallback className="bg-slate-50 text-slate-400 font-bold text-xs">
                              {member.first_name[0]}{member.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {member.first_name} {member.last_name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                               <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none font-bold text-[9px] px-1.5 py-0">
                                 {member.family_relationship || "Miembro"}
                               </Badge>
                               <span className="text-[10px] text-slate-400">{member.appointments_count} citas</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 transform group-hover:translate-x-1 transition-transform" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {dependents.length === 0 && !loading && (
                    <div className="col-span-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50">
                      <p className="text-sm font-medium italic">Sin dependientes vinculados.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 bg-white border-t flex justify-between items-center">
            <p className="text-[11px] text-slate-400 font-medium italic max-w-[60%]">
              * El color del borde indica el grupo administrativo vinculado al mismo responsable de pago.
            </p>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2">
              <Plus className="h-4 w-4" />
              Añadir Familiar
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
