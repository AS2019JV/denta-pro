"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
    Plus, 
    Search, 
    Trash2, 
    Edit2, 
    Stethoscope, 
    Clock, 
    DollarSign, 
    Sparkles, 
    CheckCircle2,
    Save
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useTranslation } from "@/components/translations"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface Service {
    id: string
    name: string
    description: string
    price: number
    duration_minutes: number
    category: string
}

export function ServicesTab() {
    const { t } = useTranslation()
    const [services, setServices] = useState<Service[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null)

    useEffect(() => {
        fetchServices()
    }, [])

    const fetchServices = async () => {
        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('name')
            
            if (error) throw error
            setServices(data || [])
        } catch (err: any) {
            toast.error("Error al cargar servicios")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveService = async () => {
        if (!editingService?.name || !editingService?.price) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }

        try {
            if (editingService.id) {
                const { error } = await supabase
                    .from('services')
                    .update(editingService)
                    .eq('id', editingService.id)
                if (error) throw error
                toast.success("Servicio actualizado")
            } else {
                const { error } = await supabase
                    .from('services')
                    .insert([editingService])
                if (error) throw error
                toast.success("Servicio creado")
            }
            setIsDialogOpen(false)
            fetchServices()
        } catch (err: any) {
            toast.error("Error al guardar servicio")
        }
    }

    const handleDeleteService = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este servicio?")) return
        try {
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', id)
            if (error) throw error
            toast.success("Servicio eliminado")
            fetchServices()
        } catch (err: any) {
            toast.error("Error al eliminar")
        }
    }

    const filteredServices = services.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-6">
                    <div>
                        <CardTitle className="text-xl">Catálogo de Servicios</CardTitle>
                        <CardDescription>Gestiona los tratamientos y precios de tu clínica</CardDescription>
                    </div>
                    <Button onClick={() => {
                        setEditingService({ duration_minutes: 30, category: 'General' })
                        setIsDialogOpen(true)
                    }} className="bg-teal-600 hover:bg-teal-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Añadir Servicio
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-4 bg-muted/50/50 border-b border-border/50 flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Buscar servicio o categoría..." 
                                className="pl-9 bg-card border-border h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center text-slate-400">Cargando servicios...</div>
                    ) : filteredServices.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                                <Stethoscope className="w-8 h-8 text-slate-300" />
                            </div>
                            <div className="max-w-xs mx-auto">
                                <h3 className="text-foreground font-bold">No hay servicios registrados</h3>
                                <p className="text-slate-500 text-sm mt-1">Crea tu primer servicio para empezar a agendar citas y generar facturas.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredServices.map((service) => (
                                <div key={service.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-foreground/90">{service.name}</h4>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold border-none">
                                                    {service.category}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <div className="flex items-center text-xs text-slate-400 font-medium">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {service.duration_minutes} min
                                                </div>
                                                <div className="flex items-center text-xs text-slate-400 font-medium">
                                                    <DollarSign className="w-3 h-3 mr-1" />
                                                    ${service.price}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => {
                                                setEditingService(service)
                                                setIsDialogOpen(true)
                                            }}
                                            className="h-8 w-8 text-slate-400 hover:text-teal-600"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDeleteService(service.id)}
                                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingService?.id ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
                        <DialogDescription>Configura los detalles del tratamiento</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre del Servicio</Label>
                            <Input 
                                placeholder="Ej. Limpieza Dental Pro" 
                                value={editingService?.name || ""}
                                onChange={(e) => setEditingService({...editingService, name: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Precio ($)</Label>
                                <Input 
                                    type="number" 
                                    value={editingService?.price || ""}
                                    onChange={(e) => setEditingService({...editingService, price: parseFloat(e.target.value)})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Duración (min)</Label>
                                <Input 
                                    type="number" 
                                    value={editingService?.duration_minutes || ""}
                                    onChange={(e) => setEditingService({...editingService, duration_minutes: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Input 
                                placeholder="Ej. Estética, Cirugía..." 
                                value={editingService?.category || ""}
                                onChange={(e) => setEditingService({...editingService, category: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción (Opcional)</Label>
                            <Input 
                                placeholder="Breve descripción del servicio" 
                                value={editingService?.description || ""}
                                onChange={(e) => setEditingService({...editingService, description: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveService} className="bg-teal-600 hover:bg-teal-700">
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Servicio
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <p className="text-xs text-teal-800 font-medium">
                    Los servicios configurados aquí aparecerán automáticamente al agendar citas y generar facturas.
                </p>
            </div>
        </div>
    )
}
