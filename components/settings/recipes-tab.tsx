"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Edit, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

interface Medication {
  name: string
  dosage: string
  duration: string
}

interface Template {
  id: string
  name: string
  data: {
    medications: Medication[]
    indications: string
  }
}

export function RecipesTab() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    medications: [{ name: "", dosage: "", duration: "" }],
    indications: ""
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('prescription_templates')
        .select('*')
        .order('name')
      
      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Error al cargar las plantillas')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        medications: [...template.data.medications],
        indications: template.data.indications
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: "",
        medications: [{ name: "", dosage: "", duration: "" }],
        indications: ""
      })
    }
    setIsDialogOpen(true)
  }

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...formData.medications, { name: "", dosage: "", duration: "" }]
    })
  }

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...formData.medications]
    newMeds[index][field] = value
    setFormData({ ...formData, medications: newMeds })
  }

  const removeMedication = (index: number) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index)
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error("El nombre de la plantilla es obligatorio")
      return
    }

    try {
      const payload = {
        name: formData.name,
        doctor_id: user?.id,
        data: {
          medications: formData.medications,
          indications: formData.indications
        }
      }

      if (editingTemplate) {
        const { error } = await supabase
          .from('prescription_templates')
          .update(payload)
          .eq('id', editingTemplate.id)
        if (error) throw error
        toast.success('Plantilla actualizada exitosamente')
      } else {
        const { error } = await supabase
          .from('prescription_templates')
          .insert([payload])
        if (error) throw error
        toast.success('Plantilla creada exitosamente')
      }

      setIsDialogOpen(false)
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Error al guardar la plantilla')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return
    try {
      const { error } = await supabase
        .from('prescription_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Plantilla eliminada')
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Error al eliminar la plantilla')
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Plantillas de Recetas (Recipes)</CardTitle>
          <CardDescription>Crea y gestiona tus plantillas de recetas médicas y certificados para emitirlas rápidamente.</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Plantilla
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre de Plantilla</TableHead>
              <TableHead>Medicamentos</TableHead>
              <TableHead>Indicaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">Cargando plantillas...</TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  <FileText className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  No tienes plantillas configuradas.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium text-slate-700">{template.name}</TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">
                    {template.data.medications.map(m => m.name).join(', ')}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-[250px] truncate">
                    {template.data.indications}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Receta'}</DialogTitle>
              <DialogDescription>Define los medicamentos e indicaciones por defecto para esta situación clínica.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Nombre de la Situación Clínica</Label>
                <Input 
                  placeholder="Ej. Extracción de Terceros Molares" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Medicamentos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {formData.medications.map((med, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-muted/50 p-2 rounded border">
                      <div className="grid grid-cols-3 gap-2 flex-1">
                        <Input 
                          placeholder="Nombre (Ej. Ibuprofeno 600mg)" 
                          value={med.name}
                          onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                        />
                        <Input 
                          placeholder="Dosis (Ej. 1 tableta c/8h)" 
                          value={med.dosage}
                          onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                        />
                        <Input 
                          placeholder="Duración (Ej. 5 días)" 
                          value={med.duration}
                          onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => removeMedication(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Indicaciones Generales</Label>
                <Textarea 
                  placeholder="Instrucciones para el paciente, dieta, cuidados post-operatorios..."
                  rows={4}
                  value={formData.indications}
                  onChange={(e) => setFormData({...formData, indications: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar Plantilla</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
