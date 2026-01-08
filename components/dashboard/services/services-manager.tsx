"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, Search, Pencil, Trash2, Clock, Info, CheckCircle2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration_minutes: number
  category?: string
  clinic_id: string
}

// Templates Array
const STANDARD_TEMPLATES: Partial<Service>[] = [
  {
    name: "Consulta General / Diagnóstico",
    price: 20.00,
    duration_minutes: 30,
    category: "General",
    description: "Revisión general, incluye diagnóstico inicial."
  },
  {
    name: "Limpieza Dental (Profilaxis)",
    price: 30.00,
    duration_minutes: 45,
    category: "Preventiva",
    description: "Eliminación de placa y pulido."
  },
  {
    name: "Resina Simple (1 superficie)",
    price: 30.00,
    duration_minutes: 45,
    category: "Restauradora",
    description: "Restauración de caries pequeña o mediana."
  },
  {
    name: "Resina Compuesta/Compleja",
    price: 60.00,
    duration_minutes: 60,
    category: "Restauradora",
    description: "Reconstrucción de partes mayores del diente."
  },
  {
    name: "Extracción Simple",
    price: 40.00,
    duration_minutes: 45,
    category: "Cirugía",
    description: "Extracción no quirúrgica."
  },
  {
    name: "Cirugía de Tercer Molar (Cordal)",
    price: 100.00,
    duration_minutes: 90,
    category: "Cirugía",
    description: "Cirugía de muela del juicio impactada."
  },
  {
    name: "Endodoncia (Tratamiento de Canal)",
    price: 150.00,
    duration_minutes: 90,
    category: "Endodoncia",
    description: "Tratamiento de conductos (precio promedio)."
  },
  {
    name: "Blanqueamiento Dental",
    price: 200.00,
    duration_minutes: 60,
    category: "Cosmética",
    description: "Tratamiento LED/Láser en consultorio."
  },
  {
    name: "Corona de Porcelana/Zirconio",
    price: 300.00,
    duration_minutes: 90,
    category: "Restauradora",
    description: "Alta durabilidad y estética."
  },
  {
    name: "Implante Dental (Fase Quirúrgica)",
    price: 700.00,
    duration_minutes: 90,
    category: "Cirugía",
    description: "Colocación del implante (no incluye corona)."
  },
  {
    name: "Ortodoncia (Control Mensual)",
    price: 30.00,
    duration_minutes: 20,
    category: "Ortodoncia",
    description: "Ajuste y control mensual de brackets."
  }
]

const CATEGORIES = [
  "General",
  "Preventiva",
  "Restauradora",
  "Cosmética",
  "Ortodoncia",
  "Cirugía",
  "Endodoncia",
  "Periodoncia",
  "Pediatría",
  "Otro"
]

export function ServicesManager() {
  const { user } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Initialize 'category' to string explicitly to match Select value type
  const [currentService, setCurrentService] = useState<Partial<Service>>({
    name: "",
    description: "",
    price: 0,
    duration_minutes: 30,
    category: "General" 
  })

  useEffect(() => {
    console.log("ServicesManager Effect:", { user, clinic_id: user?.clinic_id })
    
    if (!user) return; // Wait for user

    if (user.clinic_id) {
      fetchServices()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', user!.clinic_id)
        .order('name', { ascending: true })

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Error al cargar servicios')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = async (template: Partial<Service>) => {
      // Direct insertion to DB for the user's clinic
      try {
          const serviceData = {
              ...template,
              clinic_id: user!.clinic_id,
              duration_minutes: Number(template.duration_minutes),
              price: Number(template.price)
          }
          
          const { error } = await supabase.from('services').insert([serviceData]).select()
          
          if(error) {
              console.error("Template Insert Error:", error)
              throw error
          }
          
          toast.success(`Servicio "${template.name}" agregado.`)
          fetchServices()
      } catch(e: any) {
          toast.error("Error al agregar plantilla: " + e.message)
      }
  }

  const handleSave = async () => {
    if (!currentService.name || !user?.clinic_id) {
      toast.error("El nombre es requerido")
      return
    }

    try {
      const serviceData = {
        name: currentService.name,
        description: currentService.description,
        price: Number(currentService.price),
        duration_minutes: Number(currentService.duration_minutes),
        category: currentService.category,
        clinic_id: user.clinic_id
      }

      if (isEditing && currentService.id) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', currentService.id)

        if (error) throw error
        toast.success("Servicio actualizado correctamente")
      } else {
        const { error } = await supabase
          .from('services')
          .insert([serviceData])

        if (error) throw error
        toast.success("Servicio creado correctamente")
      }

      setIsDialogOpen(false)
      resetForm()
      fetchServices()
    } catch (error: any) {
      console.error('Error saving service:', error)
      toast.error(`Error: ${error.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este servicio?")) return

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success("Servicio eliminado")
      fetchServices()
    } catch (error) {
       console.error('Error deleting:', error)
       toast.error("No se pudo eliminar el servicio")
    }
  }

  const resetForm = () => {
    setCurrentService({
      name: "",
      description: "",
      price: 0,
      duration_minutes: 30,
      category: "General"
    })
    setIsEditing(false)
  }

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o categoría..." 
            className="pl-10 h-10 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
            {/* View Templates Button */}
            <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
                <DialogTrigger asChild>
                     <Button variant="outline" className="gap-2">
                        <Copy className="h-4 w-4" /> Plantillas
                     </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Plantillas de Tratamientos Comunes</DialogTitle>
                        <DialogDescription>
                            Selecciona los tratamientos que deseas agregar a tu catálogo. Puedes editar los precios después.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {STANDARD_TEMPLATES.map((template, idx) => (
                            <Card key={idx} className="bg-slate-50 border shadow-sm">
                                <CardHeader className="pb-2 p-4">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="mb-1 text-[10px] bg-white text-slate-500 border-slate-200">
                                            {template.category}
                                        </Badge>
                                        <span className="font-bold text-primary text-sm">${template.price}</span>
                                    </div>
                                    <CardTitle className="text-sm font-semibold text-slate-800 leading-tight">
                                        {template.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <p className="text-xs text-slate-500 line-clamp-2 h-8 mb-3">
                                        {template.description}
                                    </p>
                                    <Button 
                                        size="sm" 
                                        className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-primary hover:border-primary/50 transition-colors text-xs h-8"
                                        onClick={() => {
                                            handleUseTemplate(template)
                                            setIsTemplatesOpen(false) // Optional: keep open to add more? Let's close for feedback
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-1.5" /> Usar Plantilla
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create New Button */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) resetForm()
            }}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                {/* Existing Form Content Remains Exactly Same */}
                <DialogHeader>
                <DialogTitle>{isEditing ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
                <DialogDescription>
                    Configura los detalles del tratamiento. Esto se sincronizará con tu calendario.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Nombre</Label>
                    <Input 
                        id="name" 
                        value={currentService.name} 
                        onChange={(e) => setCurrentService({...currentService, name: e.target.value})} 
                        className="col-span-3" 
                        placeholder="Ej. Limpieza Profunda"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Categoría</Label>
                    <Select 
                        value={currentService.category} 
                        onValueChange={(val) => setCurrentService({...currentService, category: val})}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right">Precio ($)</Label>
                    <Input 
                        id="price" 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={currentService.price} 
                        onChange={(e) => setCurrentService({...currentService, price: parseFloat(e.target.value)})} 
                        className="col-span-3" 
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="duration" className="text-right">Duración (min)</Label>
                    <div className="col-span-3 flex items-center gap-2">
                        <Input 
                            id="duration" 
                            type="number" 
                            step="5"
                            min="5"
                            value={currentService.duration_minutes} 
                            onChange={(e) => setCurrentService({...currentService, duration_minutes: parseInt(e.target.value)})} 
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Para Agenda</span>
                    </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right pt-2">Descripción</Label>
                    <textarea 
                        id="description" 
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
                        value={currentService.description || ""}
                        onChange={(e) => setCurrentService({...currentService, description: e.target.value})}
                        placeholder="Detalles opcionales..."
                    />
                </div>
                </div>
                <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-primary text-white">Guardar</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando servicios...</div>
      ) : filteredServices.length === 0 ? (
        <Card className="bg-slate-50 border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <Copy className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">No hay servicios registrados</h3>
                <p className="text-slate-500 mb-6 max-w-sm">
                    Puedes crear servicios desde cero o usar nuestras plantillas predefinidas.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                        Crear Nuevo
                    </Button>
                    <Button onClick={() => setIsTemplatesOpen(true)} className="bg-primary text-white">
                        <Copy className="mr-2 h-4 w-4" /> Ver Plantillas
                    </Button>
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow group relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                        service.category === 'General' ? 'bg-slate-300' :
                        service.category === 'Ortodoncia' ? 'bg-purple-400' :
                        service.category === 'Cirugía' ? 'bg-red-400' :
                        'bg-primary'
                    }`} />
                    <CardHeader className="pb-3 pl-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <Badge variant="secondary" className="mb-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                                    {service.category}
                                </Badge>
                                <CardTitle className="text-lg font-bold text-slate-800 leading-tight">
                                    {service.name}
                                </CardTitle>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-bold text-primary block">
                                    ${service.price.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pl-6 pb-6">
                        <div className="text-sm text-slate-500 mb-4 h-[40px] overflow-hidden leading-relaxed line-clamp-2">
                             {service.description || "Sin descripción"}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                             <div className="flex items-center text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                                 <Clock className="w-3.5 h-3.5 mr-1.5" />
                                 {service.duration_minutes} min
                             </div>
                             <div className="flex gap-2">
                                 <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 hover:bg-slate-100 text-slate-400 hover:text-primary"
                                    onClick={() => {
                                        setCurrentService(service)
                                        setIsEditing(true)
                                        setIsDialogOpen(true)
                                    }}
                                >
                                     <Pencil className="w-4 h-4" />
                                 </Button>
                                 <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 hover:bg-red-50 text-slate-400 hover:text-red-500"
                                    onClick={() => handleDelete(service.id)}
                                >
                                     <Trash2 className="w-4 h-4" />
                                 </Button>
                             </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  )
}
