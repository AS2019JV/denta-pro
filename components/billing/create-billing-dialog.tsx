"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface CreateBillingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateBillingDialog({ open, onOpenChange, onSuccess }: CreateBillingDialogProps) {
  const [patients, setPatients] = useState<any[]>([])
  const [isLoadingPatients, setIsLoadingPatients] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    patient_id: "",
    amount: "",
    description: "",
    due_date: ""
  })

  useEffect(() => {
    if (open) {
      fetchPatients()
    }
  }, [open])

  const fetchPatients = async () => {
    setIsLoadingPatients(true)
    const { data } = await supabase.from('patients').select('id, first_name, last_name, cedula').order('last_name')
    if (data) setPatients(data)
    setIsLoadingPatients(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.patient_id || !formData.amount) {
        toast.error("Complete los campos obligatorios")
        return
    }

    try {
        setIsSubmitting(true)
        const { error } = await supabase.from('billings').insert({
            patient_id: formData.patient_id,
            amount: parseFloat(formData.amount),
            description: formData.description || "Servicios Dentales",
            status: "pending",
            due_date: formData.due_date || null,
            invoice_number: `INV-${Date.now()}` // Temporary generation
        })

        if (error) throw error

        toast.success("Factura creada correctamente")
        onSuccess()
        onOpenChange(false)
        setFormData({ patient_id: "", amount: "", description: "", due_date: "" })
    } catch (e) {
        console.error(e)
        toast.error("Error al crear factura")
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Factura / Cobro</DialogTitle>
          <DialogDescription>
            Registre un nuevo cobro pendiente para un paciente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="patient" className="text-right">Paciente</Label>
            <div className="col-span-3">
                <Select value={formData.patient_id} onValueChange={(val) => setFormData({...formData, patient_id: val})}>
                    <SelectTrigger>
                        <SelectValue placeholder={isLoadingPatients ? "Cargando..." : "Seleccionar Paciente"} />
                    </SelectTrigger>
                    <SelectContent>
                        {patients.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.first_name} {p.last_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">Monto ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="col-span-3"
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="desc" className="text-right">Concepto</Label>
            <Input
              id="desc"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="col-span-3"
              placeholder="Ej. Consulta General"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">Vencimiento</Label>
            <Input
              id="date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cobro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
