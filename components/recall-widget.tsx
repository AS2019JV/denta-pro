"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Phone, Mail, ChevronRight } from "lucide-react"
import { getRecallQueue, RecallPatient } from "@/lib/recall-service"
import { useAuth } from "@/components/auth-context"
import { ScrollArea } from "@/components/ui/scroll-area"

export function RecallWidget() {
  const { currentClinicId } = useAuth()
  const [patients, setPatients] = useState<RecallPatient[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!currentClinicId) return
      try {
        const data = await getRecallQueue(currentClinicId)
        setPatients(data)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentClinicId])

  if (!currentClinicId) return null

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-orange-500" />
            Pacientes por Recordar
          </CardTitle>
          <Badge variant={patients.length > 0 ? "secondary" : "outline"}>
            {patients.length} pendientes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {isLoading ? (
             <div className="p-4 text-sm text-slate-400 text-center">Cargando...</div>
        ) : patients.length === 0 ? (
             <div className="p-8 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                    <CalendarClock size={16} />
                </div>
                Todo al día. No hay pacientes pendientes.
             </div>
        ) : (
            <ScrollArea className="h-[250px]">
                <div className="flex flex-col">
                    {patients.map((p) => (
                        <div key={p.patient_id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-slate-900">{p.first_name} {p.last_name}</span>
                                <span className="text-[10px] text-slate-500">
                                    Última visita: {p.last_visit ? new Date(p.last_visit).toLocaleDateString('es-EC') : 'Nunca'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {(p.phone) && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-slate-400 hover:text-teal-600 hover:bg-teal-50" title="Llamar">
                                        <Phone size={14} />
                                    </Button>
                                )}
                                {(p.email) && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Enviar Email">
                                        <Mail size={14} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
