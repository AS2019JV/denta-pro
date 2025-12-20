
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getInvoiceProvider, SRIInvoice } from "@/lib/invoicing"
import { supabase } from "@/lib/supabase"
import { Loader2, FileText, CheckCircle } from "lucide-react"

interface GenerateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billing: any // Replace with proper type
  patient: any // Replace with proper type
  onSuccess: () => void
}

export function GenerateInvoiceDialog({ open, onOpenChange, billing, patient, onSuccess }: GenerateInvoiceDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    identifier: patient?.cedula || "",
    type: patient?.cedula?.length === 13 ? "RUC" : "CEDULA",
    name: `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim(),
    email: patient?.email || "",
    address: patient?.address || "",
  })

  // Basic validation
  const isValid = formData.identifier && formData.name && formData.email

  const handleGenerate = async () => {
    try {
      setIsLoading(true)

      // 1. Prepare Invoice Data
      const invoiceData: SRIInvoice = {
        status: 'DRAFT',
        environment: 'TEST',
        issueDate: new Date().toISOString().split('T')[0],
        establishment: '001',
        emissionPoint: '001',
        sequential: Math.floor(Math.random() * 999999999).toString().padStart(9, '0'), // Temporary sequential
        
        patientId: patient.id,
        patientName: formData.name,
        patientIdType: formData.type as any,
        patientIndentifier: formData.identifier,
        patientEmail: formData.email,
        patientAddress: formData.address,

        subtotal: billing.amount,
        totalDiscount: 0,
        totalTax: 0, // Assuming 0% for medical services (check Ecuador law, medical is usually 0%)
        total: billing.amount,

        items: [
            {
                code: 'SERV-001',
                description: billing.description || 'Servicios Odontológicos',
                quantity: 1,
                unitPrice: billing.amount,
                discount: 0,
                tax: 0,
                total: billing.amount
            }
        ]
      }

      // 2. Call Provider
      const provider = getInvoiceProvider()
      const result = await provider.generateInvoice(invoiceData)

      // 3. Save to Supabase
      const { error } = await supabase.from('invoices').insert({
        clinic_id: null, // RLS will handle lookup if we implemented it right, or we pass it if we have context. Actually RLS handles insert checks.
        patient_id: patient.id,
        billing_id: billing.id,
        invoice_number: `001-001-${invoiceData.sequential}`,
        sri_authorization_date: result.authorizationDate,
        sri_access_key: result.accessKey,
        xml_content: result.xml,
        pdf_url: result.pdfUrl,
        status: 'AUTHORIZED',
        total_amount: billing.amount,
        items: invoiceData.items
      })

      if (error) throw error

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error generating invoice:", error)
      // Show toast error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generar Factura Electrónica (SRI)</DialogTitle>
          <DialogDescription>
            Confirma los datos del paciente para la facturación.
            Servicios médicos suelen tener tarifa 0% IVA.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Tipo ID</Label>
            <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData({...formData, type: v})}
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="CEDULA">Cédula</SelectItem>
                    <SelectItem value="RUC">RUC</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Identificación</Label>
            <Input 
                value={formData.identifier} 
                onChange={(e) => setFormData({...formData, identifier: e.target.value})} 
                className="col-span-3" 
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Razón Social</Label>
            <Input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                className="col-span-3" 
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Email</Label>
            <Input 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                className="col-span-3" 
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Dirección</Label>
            <Input 
                value={formData.address} 
                onChange={(e) => setFormData({...formData, address: e.target.value})} 
                className="col-span-3" 
            />
          </div>

          <div className="mt-4 p-3 bg-muted rounded-md text-sm flex justify-between items-center">
             <span>Total a Facturar:</span>
             <span className="font-bold text-lg">${billing?.amount?.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={!isValid || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Generando..." : "Emitir Factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
