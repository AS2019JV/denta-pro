"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  Plus, Search, Pencil, Trash2, Clock, Info, CheckCircle2, Copy,
  LayoutGrid, Palette, Settings2, Sparkles, Filter, MoreHorizontal, Check, Zap, Activity 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-context"
import { cn } from "@/lib/utils"

interface ServiceCategory {
  id: string
  name: string
  color: string
}

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration_minutes: number
  category_id?: string
  category_name?: string // Joined name
  clinic_id: string
  color?: string
}

const CATEGORY_COLORS = [
  { name: "Deep Teal", hex: "#145247" },
  { name: "Warm Orange", hex: "#FAA805" },
  { name: "Electric Blue", hex: "#007AFF" },
  { name: "Soft Mint", hex: "#34C759" },
  { name: "Royal Purple", hex: "#5856D6" },
  { name: "Candy Pink", hex: "#FF2D55" },
  { name: "Sun Yellow", hex: "#FFCC00" },
  { name: "Space Gray", hex: "#8E8E93" }
]

const STANDARD_TEMPLATES: any[] = [
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
    name: "Endodoncia",
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
    name: "Ortodoncia (Control)",
    price: 30.00,
    duration_minutes: 20,
    category: "Ortodoncia",
    description: "Ajuste y control mensual de brackets."
  }
]

export function ServicesManager() {
  const { currentClinicId, isLoading: authLoading } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const [currentService, setCurrentService] = useState<Partial<Service>>({
    name: "",
    description: "",
    price: 0,
    duration_minutes: 30,
    category_id: "",
    color: "#145247"
  })

  const [currentCategory, setCurrentCategory] = useState<Partial<ServiceCategory>>({
    name: "",
    color: "#145247"
  })

  const [priceInput, setPriceInput] = useState<string>("0")
  const [durationInput, setDurationInput] = useState<string>("30")

  useEffect(() => {
    if (currentClinicId) {
      fetchData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [currentClinicId, authLoading])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch Categories
      const { data: cats } = await supabase
        .from('service_categories')
        .select('*')
        .eq('clinic_id', currentClinicId)
        .order('name')
      
      setCategories(cats || [])

      // Fetch Services with category names
      const { data: srvs } = await supabase
        .from('services')
        .select('*, service_categories(name)')
        .eq('clinic_id', currentClinicId)
        .order('name')

      setServices((srvs || []).map(s => ({
        ...s,
        category_name: s.service_categories?.name
      })))
    } catch (error) {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCategory = async () => {
    if (!currentCategory.name || !currentClinicId) return
    try {
      const { error } = await supabase
        .from('service_categories')
        .upsert({
          clinic_id: currentClinicId,
          name: currentCategory.name,
          color: currentCategory.color
        })
      if (error) throw error
      toast.success("Categoría guardada")
      setIsCatDialogOpen(false)
      setCurrentCategory({ name: "", color: "#145247" })
      fetchData()
    } catch (e) {
      toast.error("Error al guardar categoría")
    }
  }

  const handleSaveService = async () => {
    if (!currentService.name || !currentClinicId) return

    const price = parseFloat(priceInput) || 0
    const duration = parseInt(durationInput) || 30
    
    // Auto-pick color from category if service color is default
    let finalColor = currentService.color
    if (currentService.category_id) {
       const cat = categories.find(c => c.id === currentService.category_id)
       if (cat) finalColor = cat.color
    }

    try {
      const serviceData = {
        name: currentService.name,
        description: currentService.description,
        price,
        duration_minutes: duration,
        category_id: currentService.category_id,
        color: finalColor,
        clinic_id: currentClinicId
      }

      const { error } = isEditing && currentService.id 
        ? await supabase.from('services').update(serviceData).eq('id', currentService.id)
        : await supabase.from('services').insert([serviceData])

      if (error) throw error
      toast.success(isEditing ? "Servicio actualizado" : "Servicio creado")
      setIsDialogOpen(false)
      fetchData()
    } catch (e) {
      toast.error("Error al guardar servicio")
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!confirm("¿Eliminar este servicio?")) return
    await supabase.from('services').delete().eq('id', id)
    fetchData()
  }

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = activeTab === "all" || s.category_id === activeTab
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4 sm:px-0 select-none animate-in fade-in duration-700">
      {/* Header Section - Modern Apple Style */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-card p-10 rounded-[2.5rem] border border-border/50 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-5xl font-bold tracking-tight text-foreground font-teko leading-none">
            Servicios <span className="text-primary">Profesionales</span>
          </h1>
          <p className="text-slate-400 max-w-md text-sm font-medium">
            Personaliza tu catálogo de tratamientos con los estándares de Clinia+.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={() => setIsTemplatesOpen(true)}
            variant="ghost"
            className="rounded-2xl h-12 px-6 hover:bg-muted/50 transition-all font-bold text-slate-500"
          >
            <Copy className="mr-2 h-4 w-4" /> Plantillas
          </Button>
          <Button 
            onClick={() => {
              setIsEditing(false)
              setCurrentService({ name: "", price: 0, duration_minutes: 30, color: "#145247" })
              setPriceInput("0")
              setDurationInput("30")
              setIsDialogOpen(true)
            }}
            className="rounded-2xl bg-primary hover:bg-primary/95 text-white h-12 px-8 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 font-bold"
          >
            <Plus className="mr-2 h-5 w-5" /> Agregar Nuevo
          </Button>
        </div>
      </header>

      {/* Control Bar - Clean & Professional */}
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
         {/* Categories - Professional Scrollable Pills */}
         <div className="w-full sm:w-auto overflow-hidden relative group">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-1 py-2 mask-linear-right">
                <button 
                    onClick={() => setActiveTab("all")}
                    className={cn(
                        "px-6 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap",
                        activeTab === "all" ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" : "bg-card border-border text-slate-500 hover:border-primary/30"
                    )}
                >
                    Todos
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={cn(
                            "px-6 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-2 whitespace-nowrap",
                            activeTab === cat.id ? "bg-card border-border/50 text-foreground shadow-md" : "bg-card border-border text-slate-500 hover:border-primary/30"
                        )}
                    >
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                    </button>
                ))}
                <button 
                    onClick={() => setIsCatDialogOpen(true)}
                    className="flex-shrink-0 h-8 w-8 rounded-full border border-border flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all ml-2"
                >
                    <Settings2 className="h-4 w-4" />
                </button>
            </div>
         </div>

         <div className="relative group w-full sm:w-80">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
            <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar tratamiento..."
                className="w-full bg-muted/50 border-none h-12 pl-12 pr-6 rounded-2xl text-sm focus:ring-2 focus:ring-primary/10 transition-all font-semibold placeholder:font-normal placeholder:text-slate-300"
            />
         </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 opacity-50">
           {[1,2,3].map(i => <div key={i} className="h-64 bg-muted/50 rounded-[2.5rem] animate-pulse" />)}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-24 text-center space-y-6 bg-muted/50/50 rounded-[3rem] border border-dashed border-border">
           <div className="bg-card h-20 w-20 rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-border/50">
              <LayoutGrid className="h-8 w-8 text-primary/10" />
           </div>
           <div className="space-y-1">
              <h3 className="text-2xl font-bold font-teko">No hay resultados</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Ajusta tu búsqueda o filtros</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredServices.map((service) => (
                <div 
                    key={service.id} 
                    className="group bg-card rounded-[2.5rem] p-8 border border-border/50 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 relative flex flex-col gap-6"
                >
                    {/* Vertical Color Indicator */}
                    <div className="absolute top-10 bottom-10 left-0 w-1 rounded-r-full" style={{ backgroundColor: service.color }} />
                    
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block">
                                {service.category_name || "General"}
                            </span>
                            <h3 className="text-2xl font-bold font-teko text-foreground/90 leading-tight">
                                {service.name}
                            </h3>
                        </div>
                        <div className="text-right">
                             <span className="text-2xl font-bold font-teko text-primary leading-none">${service.price}</span>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-3 flex-1 italic">
                        {service.description || "Inicia tu tratamiento profesional con Clinia+."}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 px-3 py-1 bg-slate-100/50 rounded-full">
                            <Clock className="h-3 w-3" />
                            {service.duration_minutes} MIN
                        </div>
                        
                        <div className="flex gap-1">
                            <button 
                                onClick={() => {
                                    setCurrentService(service)
                                    setPriceInput(service.price.toString())
                                    setDurationInput(service.duration_minutes.toString())
                                    setIsEditing(true)
                                    setIsDialogOpen(true)
                                }}
                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 text-slate-300 hover:bg-slate-100 hover:text-foreground transition-all active:scale-90"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button 
                                onClick={() => handleDeleteService(service.id)}
                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Floating Tooltips or Helpers can go here */}

      {/* 1. Add/Edit Service Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl p-0 border shadow-2xl bg-card overflow-hidden rounded-2xl">
            <DialogTitle className="sr-only">Administrar Servicio</DialogTitle>
            <div className="flex flex-col md:flex-row h-full">
                {/* Left Panel - Visual Preview */}
                <div className="w-full md:w-56 bg-muted/40 p-8 flex flex-col items-center justify-center text-center gap-4 border-r border-border/50">
                    <div className="h-20 w-20 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-500 text-white" style={{ backgroundColor: currentService.color || "#0284c7" }}>
                        <Activity className="h-9 w-9 text-white" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vista Previa</p>
                        <h4 className="text-base font-bold text-foreground line-clamp-2">{currentService.name || "Nuevo Servicio"}</h4>
                        <p className="text-xs font-mono font-bold text-primary">${priceInput || "0.00"}</p>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className="flex-1 p-8 space-y-6">
                    <header>
                        <h2 className="text-xl font-bold text-foreground">
                            {isEditing ? "Editar Servicio / Tratamiento" : "Nuevo Servicio Odontológico"}
                        </h2>
                        <p className="text-muted-foreground text-xs">Especificaciones del procedimiento y catálogo.</p>
                    </header>

                    <div className="grid gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Identidad</Label>
                                <Input 
                                    placeholder="Nombre del servicio..."
                                    className="rounded-2xl bg-muted/50 border-none h-12 px-5 font-semibold placeholder:font-normal focus:ring-2 focus:ring-primary/10"
                                    value={currentService.name}
                                    onChange={(e) => setCurrentService({...currentService, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Categoría</Label>
                                <Select 
                                    value={currentService.category_id} 
                                    onValueChange={v => setCurrentService({...currentService, category_id: v})}
                                >
                                    <SelectTrigger className="rounded-2xl bg-muted/50 border-none h-12 px-5 shadow-none focus:ring-2 focus:ring-primary/10">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-xl">
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                                                    {c.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Inversión ($)</Label>
                                <Input 
                                    type="number"
                                    className="rounded-2xl bg-muted/50 border-none h-12 px-5 font-bold focus:ring-2 focus:ring-primary/10"
                                    value={priceInput}
                                    onChange={(e) => setPriceInput(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Tiempo (Min)</Label>
                                <Input 
                                    type="number"
                                    className="rounded-2xl bg-muted/50 border-none h-12 px-5 font-bold focus:ring-2 focus:ring-primary/10"
                                    value={durationInput}
                                    onChange={(e) => setDurationInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Gama Cromática</Label>
                            <div className="flex flex-wrap gap-2.5 p-3 bg-muted/50/50 rounded-[1.5rem]">
                                {CATEGORY_COLORS.map(c => (
                                    <button 
                                        key={c.hex}
                                        onClick={() => setCurrentService({...currentService, color: c.hex})}
                                        className={cn(
                                            "h-7 w-7 rounded-full transition-all duration-300 hover:scale-125 flex items-center justify-center",
                                            currentService.color === c.hex ? "ring-4 ring-offset-2 ring-slate-100" : "opacity-40"
                                        )}
                                        style={{ backgroundColor: c.hex }}
                                    >
                                        {currentService.color === c.hex && <Check className="h-3 w-3 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                             <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 text-xs">Notas Clínicas</Label>
                             <textarea 
                                className="w-full bg-muted/50 border-none rounded-2xl p-5 text-sm font-medium min-h-[6rem] focus:ring-2 focus:ring-primary/10 transition-all placeholder:font-normal"
                                placeholder="Describe el alcance del tratamiento..."
                                value={currentService.description}
                                onChange={(e) => setCurrentService({...currentService, description: e.target.value})}
                             />
                        </div>
                    </div>

                    <footer className="flex gap-4 pt-4">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 rounded-2xl h-12 text-slate-500 font-bold hover:bg-slate-100 transition-all">
                            Descartar
                        </Button>
                        <Button onClick={handleSaveService} className="flex-[2] rounded-2xl h-12 bg-primary text-white font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                            {isEditing ? "Actualizar Registro" : "Crear Servicio"}
                        </Button>
                    </footer>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* 2. Category Management Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-10 border-none shadow-3xl bg-card">
            <DialogTitle className="sr-only">Administrar Categorías</DialogTitle>
            <header className="space-y-2 mb-8 text-center">
                <div className="h-16 w-16 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto text-primary">
                    <Palette className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-bold font-teko leading-none mt-4">Personalizar Categorías</h2>
                <p className="text-slate-400 text-sm font-medium">Asigna colores únicos a tus grupos de tratamiento.</p>
            </header>

            <div className="space-y-8">
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <Input 
                            placeholder="Nombre de categoría..."
                            className="rounded-2xl bg-muted/50 border-none h-12 px-5 font-bold"
                            value={currentCategory.name}
                            onChange={(e) => setCurrentCategory({...currentCategory, name: e.target.value})}
                        />
                        <Button onClick={handleSaveCategory} className="h-12 w-12 rounded-2xl bg-primary text-white p-0 shadow-lg shadow-primary/20">
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 justify-center py-2">
                        {CATEGORY_COLORS.map(c => (
                            <button 
                                key={c.hex}
                                onClick={() => setCurrentCategory({...currentCategory, color: c.hex})}
                                className={cn(
                                    "h-6 w-6 rounded-full transition-all",
                                    currentCategory.color === c.hex ? "ring-2 ring-primary ring-offset-2 scale-110" : "opacity-40"
                                )}
                                style={{ backgroundColor: c.hex }}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto px-2 scrollbar-hide">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl group transition-all hover:bg-card hover:shadow-md border border-transparent hover:border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                            </div>
                            <button 
                                onClick={async () => {
                                   if(confirm("¿Eliminar categoría? Los servicios asociados quedarán sin categoría.")) {
                                      await supabase.from('service_categories').delete().eq('id', cat.id)
                                      fetchData()
                                   }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-300 hover:text-red-500 transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <Button variant="outline" onClick={() => setIsCatDialogOpen(false)} className="w-full rounded-2xl h-12 font-bold text-slate-500 border-border">
                    Cerrar Ajustes
                </Button>
            </div>
        </DialogContent>
      </Dialog>
      
      {/* 3. Templates Gallery Dialog - Updated titles & styles */}
      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
         <DialogContent className="max-w-4xl w-full rounded-[2.5rem] p-0 border border-white/5 shadow-2xl bg-slate-950 text-white overflow-hidden flex flex-col h-[75vh] max-h-[80vh]">
            {/* Glowing Mesh-Gradient Background Orbs */}
            <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <DialogTitle className="sr-only">Plantillas de Servicios</DialogTitle>
            
            <header className="p-10 bg-slate-900/30 backdrop-blur-md border-b border-white/5 flex justify-between items-center shrink-0 relative z-10">
                <div className="space-y-1">
                    <h2 className="text-4xl font-bold font-teko text-white leading-none tracking-tight">Plantillas de Servicios</h2>
                    <p className="text-teal-400 text-xs font-bold uppercase tracking-widest">Catálogo institucional premium</p>
                </div>



            </header>

            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {(STANDARD_TEMPLATES as any).map((template: any, i: number) => (
                         <div key={i} className="group bg-slate-900/30 backdrop-blur-md rounded-3xl p-6 border border-white/5 transition-all duration-300 hover:border-teal-500/30 hover:bg-slate-900/50 hover:shadow-2xl hover:shadow-teal-950/20 relative flex flex-col gap-4">
                             <div className="flex justify-between items-start">
                                 <Badge className="bg-white/5 text-slate-300 border border-white/5 rounded-full px-3 h-5 text-[10px] font-bold uppercase tracking-wide">
                                    {template.category}
                                 </Badge>
                                 <span className="text-2xl font-bold font-teko text-teal-400">${template.price}</span>
                             </div>
                             
                             <h4 className="text-xl font-bold font-teko text-white leading-tight pr-8 group-hover:text-teal-300 transition-colors">{template.name}</h4>
                             <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic line-clamp-2">
                                {template.description}
                             </p>

                             <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{template.duration_minutes} MIN</span>
                                 <Button 
                                    onClick={async () => {
                                        const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length].hex
                                        let catId = ""
                                        const { data: existing } = await supabase.from('service_categories').select('id').eq('clinic_id', currentClinicId).eq('name', template.category).single()
                                        
                                        if (existing) {
                                            catId = existing.id
                                        } else {
                                            const { data: nCat } = await supabase.from('service_categories').insert({ clinic_id: currentClinicId, name: template.category, color }).select().single()
                                            if (nCat) catId = nCat.id
                                        }

                                        await supabase.from('services').insert({
                                            clinic_id: currentClinicId,
                                            name: template.name,
                                            description: template.description,
                                            price: template.price,
                                            duration_minutes: template.duration_minutes,
                                            category_id: catId,
                                            color: color
                                        })
                                        toast.success("Servicio importado")
                                        fetchData()
                                    }}
                                    className="rounded-xl h-10 px-6 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-lg active:scale-95 text-[11px] hover:shadow-teal-500/20"
                                 >
                                     Importar
                                 </Button>
                             </div>
                         </div>
                     ))}
                </div>
            </div>
            
            <footer className="p-6 bg-slate-950/30 backdrop-blur-md border-t border-white/5 flex justify-center shrink-0 relative z-10">
                <Button variant="ghost" onClick={() => setIsTemplatesOpen(false)} className="rounded-xl h-10 px-8 text-slate-400 font-bold hover:bg-white/5 hover:text-white text-xs transition-all">
                    Cerrar
                </Button>
            </footer>
         </DialogContent>
      </Dialog>
    </div>
  )
}
