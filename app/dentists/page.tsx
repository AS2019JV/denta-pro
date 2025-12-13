"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { useAppData } from "@/hooks/use-app-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Mail, Phone, Stethoscope, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function DentistsPage() {
  const { dentists, addDentist, deleteDentist } = useAppData()
  const [isAddOpen, setIsAddOpen] = useState(false)
  
  // Form State
  const [newDentist, setNewDentist] = useState({
    name: "",
    specialty: "",
    email: "",
    phone: "",
    color: "#3b82f6"
  })

  // Colors for dentist identification
  const colors = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#22c55e" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
    { name: "Orange", value: "#f97316" },
    { name: "Teal", value: "#14b8a6" },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addDentist(newDentist)
    setIsAddOpen(false)
    setNewDentist({
      name: "",
      specialty: "",
      email: "",
      phone: "",
      color: "#3b82f6"
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Doctores y Especialistas">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Doctor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Doctor</DialogTitle>
                <DialogDescription>
                  Crea un perfil para un nuevo especialista en la clínica.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nombre
                  </Label>
                  <Input
                    id="name"
                    value={newDentist.name}
                    onChange={(e) => setNewDentist({ ...newDentist, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Dr. Juan Pérez"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="specialty" className="text-right">
                    Especialidad
                  </Label>
                  <Input
                    id="specialty"
                    value={newDentist.specialty}
                    onChange={(e) => setNewDentist({ ...newDentist, specialty: e.target.value })}
                    className="col-span-3"
                    placeholder="Ortodoncia"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newDentist.email}
                    onChange={(e) => setNewDentist({ ...newDentist, email: e.target.value })}
                    className="col-span-3"
                    placeholder="doctor@ejemplo.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    value={newDentist.phone}
                    onChange={(e) => setNewDentist({ ...newDentist, phone: e.target.value })}
                    className="col-span-3"
                    placeholder="555-0000"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="color" className="text-right">
                    Color
                  </Label>
                  <div className="col-span-3 flex gap-2">
                    {colors.map((c) => (
                      <div
                        key={c.value}
                        className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                          newDentist.color === c.value ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setNewDentist({ ...newDentist, color: c.value })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Guardar Doctor</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dentists.map((dentist) => (
          <Card key={dentist.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="h-2 w-full" style={{ backgroundColor: dentist.color }} />
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarImage src={dentist.avatar} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {dentist.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold truncate">{dentist.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Stethoscope className="h-3 w-3" />
                  {dentist.specialty}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{dentist.email || "Sin email"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{dentist.phone || "Sin teléfono"}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 p-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => deleteDentist(dentist.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
              <Button variant="outline" size="sm" className="h-8">
                Ver Perfil
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {dentists.length === 0 && (
           <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
             <User className="h-12 w-12 mb-4 opacity-20" />
             <p className="text-lg font-medium">No hay doctores registrados</p>
             <p className="text-sm max-w-sm mt-1 mb-4">
               Añade doctores y especialistas para gestionar sus horarios y asignar citas.
             </p>
             <Button variant="outline" onClick={() => setIsAddOpen(true)}>
               Añadir Primer Doctor
             </Button>
           </div>
        )}
      </div>
    </div>
  )
}
