"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Mail,
  MessageSquare,
  Users,
  Eye,
  Clock as Click,
  Target,
  Edit,
  Copy,
  ExternalLink,
  Star,
  Heart,
  Share2,
  MessageCircle,
} from "lucide-react"

const campaigns = [
  {
    id: 1,
    name: "Campaña de Limpieza Dental",
    type: "email",
    status: "active",
    sent: 1250,
    opened: 875,
    clicked: 156,
    conversions: 23,
    revenue: 2300,
    startDate: "2025-03-01",
    endDate: "2025-03-31",
  },
  {
    id: 2,
    name: "Promoción Blanqueamiento",
    type: "sms",
    status: "completed",
    sent: 800,
    opened: 720,
    clicked: 98,
    conversions: 15,
    revenue: 1875,
    startDate: "2025-02-15",
    endDate: "2025-02-28",
  },
  {
    id: 3,
    name: "Recordatorio Revisiones",
    type: "email",
    status: "draft",
    sent: 0,
    opened: 0,
    clicked: 0,
    conversions: 0,
    revenue: 0,
    startDate: "2025-03-20",
    endDate: "2025-04-20",
  },
  {
    id: 4,
    name: "Consultas Urgentes WhatsApp",
    type: "whatsapp",
    status: "active",
    sent: 650,
    opened: 620,
    clicked: 145,
    conversions: 28,
    revenue: 3200,
    startDate: "2025-03-05",
    endDate: "2025-03-31",
  },
  {
    id: 5,
    name: "Ofertas Especiales WhatsApp",
    type: "whatsapp",
    status: "active",
    sent: 420,
    opened: 398,
    clicked: 89,
    conversions: 12,
    revenue: 1560,
    startDate: "2025-03-10",
    endDate: "2025-03-25",
  },
]

const socialMetrics = {
  facebook: { followers: 2450, engagement: 4.2, posts: 12, reach: 15600 },
  instagram: { followers: 1890, engagement: 6.8, posts: 18, reach: 12400 },
  twitter: { followers: 890, engagement: 2.1, posts: 8, reach: 4200 },
  linkedin: { followers: 560, engagement: 3.5, posts: 6, reach: 2800 },
}

const patientSegments = [
  { name: "Pacientes Nuevos", count: 145, percentage: 25, color: "bg-blue-500" },
  { name: "Pacientes Regulares", count: 320, percentage: 55, color: "bg-green-500" },
  { name: "Pacientes VIP", count: 58, percentage: 10, color: "bg-purple-500" },
  { name: "Pacientes Inactivos", count: 87, percentage: 15, color: "bg-orange-500" },
]

export default function MarketingPage() {
  const [selectedCampaign, setSelectedCampaign] = useState(campaigns[0])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Activa</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Completada</Badge>
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">Borrador</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const totalSent = campaigns.reduce((sum, campaign) => sum + campaign.sent, 0)
  const totalOpened = campaigns.reduce((sum, campaign) => sum + campaign.opened, 0)
  const totalClicked = campaigns.reduce((sum, campaign) => sum + campaign.clicked, 0)
  const totalRevenue = campaigns.reduce((sum, campaign) => sum + campaign.revenue, 0)

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : 0
  const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : 0

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing y Comunicación">
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Nueva Campaña SMS
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Campaña SMS</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sms-name">Nombre de la Campaña</Label>
                  <Input id="sms-name" placeholder="Ej: Recordatorio de Citas" />
                </div>
                <div>
                  <Label htmlFor="sms-segment">Segmento de Pacientes</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los pacientes</SelectItem>
                      <SelectItem value="new">Pacientes nuevos</SelectItem>
                      <SelectItem value="regular">Pacientes regulares</SelectItem>
                      <SelectItem value="inactive">Pacientes inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sms-message">Mensaje</Label>
                  <Textarea
                    id="sms-message"
                    placeholder="Hola {nombre}, te recordamos tu cita del {fecha} a las {hora}..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">160 caracteres máximo</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sms-date">Fecha de Envío</Label>
                    <Input id="sms-date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="sms-time">Hora de Envío</Label>
                    <Input id="sms-time" type="time" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Guardar Borrador</Button>
                  <Button>Programar Envío</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Campaña Email
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Campaña de Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-name">Nombre de la Campaña</Label>
                    <Input id="email-name" placeholder="Ej: Promoción Blanqueamiento" />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Asunto del Email</Label>
                    <Input id="email-subject" placeholder="¡Sonríe más brillante con nuestro blanqueamiento!" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email-segment">Segmento de Pacientes</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los pacientes</SelectItem>
                      <SelectItem value="new">Pacientes nuevos</SelectItem>
                      <SelectItem value="regular">Pacientes regulares</SelectItem>
                      <SelectItem value="vip">Pacientes VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email-content">Contenido del Email</Label>
                  <Textarea id="email-content" placeholder="Estimado/a {nombre}, nos complace ofrecerte..." rows={6} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-date">Fecha de Envío</Label>
                    <Input id="email-date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="email-time">Hora de Envío</Label>
                    <Input id="email-time" type="time" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Guardar Borrador</Button>
                  <Button variant="outline">Vista Previa</Button>
                  <Button>Programar Envío</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                Nueva Campaña WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Campaña WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-name">Nombre de la Campaña</Label>
                  <Input id="whatsapp-name" placeholder="Ej: Ofertas Especiales del Mes" />
                </div>
                <div>
                  <Label htmlFor="whatsapp-segment">Segmento de Pacientes</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los pacientes</SelectItem>
                      <SelectItem value="new">Pacientes nuevos</SelectItem>
                      <SelectItem value="regular">Pacientes regulares</SelectItem>
                      <SelectItem value="vip">Pacientes VIP</SelectItem>
                      <SelectItem value="inactive">Pacientes inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="whatsapp-message">Mensaje</Label>
                  <Textarea
                    id="whatsapp-message"
                    placeholder="Hola {nombre}, tenemos una oferta especial para ti... 🦷✨"
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedes usar emojis y formato de WhatsApp (*negrita*, _cursiva_)
                  </p>
                </div>
                <div>
                  <Label htmlFor="whatsapp-media">Adjuntar Imagen/Video (Opcional)</Label>
                  <Input id="whatsapp-media" type="file" accept="image/*,video/*" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="whatsapp-date">Fecha de Envío</Label>
                    <Input id="whatsapp-date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="whatsapp-time">Hora de Envío</Label>
                    <Input id="whatsapp-time" type="time" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Guardar Borrador</Button>
                  <Button>Programar Envío</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Emails Enviados</h4>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Activa</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Enviados</p>
              <p className="font-semibold">{totalSent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Abiertos</p>
              <p className="font-semibold">{totalOpened.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Clics</p>
              <p className="font-semibold">{totalClicked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ingresos</p>
              <p className="font-semibold">€{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Tasa de Apertura</h4>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Completada</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Enviados</p>
              <p className="font-semibold">{totalSent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Abiertos</p>
              <p className="font-semibold">{totalOpened.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Clics</p>
              <p className="font-semibold">{totalClicked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ingresos</p>
              <p className="font-semibold">€{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">Tasa de Clics</h4>
              <Click className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">Borrador</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Enviados</p>
              <p className="font-semibold">{totalSent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Abiertos</p>
              <p className="font-semibold">{totalOpened.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Clics</p>
              <p className="font-semibold">{totalClicked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ingresos</p>
              <p className="font-semibold">€{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">ROI Marketing</h4>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">N/A</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Enviados</p>
              <p className="font-semibold">{totalSent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Abiertos</p>
              <p className="font-semibold">{totalOpened.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Clics</p>
              <p className="font-semibold">{totalClicked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ingresos</p>
              <p className="font-semibold">€{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="segments">Segmentación</TabsTrigger>
          <TabsTrigger value="social">Redes Sociales</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 bg-primary/5">
                <h4 className="font-medium mb-2">Campañas Activas</h4>
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedCampaign.id === campaign.id ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedCampaign(campaign)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{campaign.name}</h4>
                          {campaign.type === "email" ? (
                            <Mail className="h-4 w-4 text-blue-500" />
                          ) : campaign.type === "sms" ? (
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(campaign.status)}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Enviados</p>
                          <p className="font-semibold">{campaign.sent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Abiertos</p>
                          <p className="font-semibold">{campaign.opened.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Clics</p>
                          <p className="font-semibold">{campaign.clicked.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ingresos</p>
                          <p className="font-semibold">€{campaign.revenue.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
                <h4 className="font-medium mb-2">Detalles de Campaña</h4>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{selectedCampaign.name}</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tasa de Apertura</span>
                        <span className="font-semibold">
                          {selectedCampaign.sent > 0
                            ? ((selectedCampaign.opened / selectedCampaign.sent) * 100).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                      <Progress
                        value={selectedCampaign.sent > 0 ? (selectedCampaign.opened / selectedCampaign.sent) * 100 : 0}
                        className="h-2"
                      />

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tasa de Clics</span>
                        <span className="font-semibold">
                          {selectedCampaign.opened > 0
                            ? ((selectedCampaign.clicked / selectedCampaign.opened) * 100).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          selectedCampaign.opened > 0 ? (selectedCampaign.clicked / selectedCampaign.opened) * 100 : 0
                        }
                        className="h-2"
                      />

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Conversiones</span>
                        <span className="font-semibold">{selectedCampaign.conversions}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">ROI</span>
                        <span className="font-semibold text-green-600">
                          {selectedCampaign.revenue > 0 ? "340%" : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver Reporte
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
              <h4 className="font-medium mb-2">Segmentación de Pacientes</h4>
              <div className="space-y-4">
                {patientSegments.map((segment) => (
                  <div key={segment.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${segment.color}`}></div>
                        <span className="font-medium">{segment.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{segment.count}</span>
                        <span className="text-sm text-muted-foreground ml-1">({segment.percentage}%)</span>
                      </div>
                    </div>
                    <Progress value={segment.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
              <h4 className="font-medium mb-2">Crear Nuevo Segmento</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="segment-name">Nombre del Segmento</Label>
                  <Input id="segment-name" placeholder="Ej: Pacientes de Ortodoncia" />
                </div>
                <div>
                  <Label htmlFor="segment-criteria">Criterios de Segmentación</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar criterio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="age">Edad</SelectItem>
                      <SelectItem value="treatment">Tipo de Tratamiento</SelectItem>
                      <SelectItem value="frequency">Frecuencia de Visitas</SelectItem>
                      <SelectItem value="spending">Gasto Promedio</SelectItem>
                      <SelectItem value="location">Ubicación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="segment-value">Valor del Criterio</Label>
                  <Input id="segment-value" placeholder="Ej: 25-35 años" />
                </div>
                <Button className="w-full">Crear Segmento</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(socialMetrics).map(([platform, metrics]) => (
              <div key={platform} className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="capitalize">{platform}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{metrics.followers.toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground">Seguidores</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Engagement</span>
                      <span className="font-medium">{metrics.engagement}%</span>
                    </div>
                    <Progress value={metrics.engagement * 10} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Posts</p>
                      <p className="font-semibold">{metrics.posts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Alcance</p>
                      <p className="font-semibold">{metrics.reach.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 mt-6">
            <h4 className="font-medium mb-2">Programar Publicación</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="post-platform">Plataforma</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="all">Todas las plataformas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="post-date">Fecha de Publicación</Label>
                  <Input id="post-date" type="datetime-local" />
                </div>
              </div>
              <div>
                <Label htmlFor="post-content">Contenido</Label>
                <Textarea
                  id="post-content"
                  placeholder="¿Sabías que una sonrisa saludable puede mejorar tu confianza? 😊 #SaludDental #Sonrisa"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">Guardar Borrador</Button>
                <Button>Programar Publicación</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
                <h4 className="font-medium mb-2">Rendimiento por Canal</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Email Marketing</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: "75%" }}></div>
                      </div>
                      <span className="font-semibold">75%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>WhatsApp Marketing</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "85%" }}></div>
                      </div>
                      <span className="font-semibold">85%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>SMS Marketing</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: "60%" }}></div>
                      </div>
                      <span className="font-semibold">60%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Redes Sociales</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: "45%" }}></div>
                      </div>
                      <span className="font-semibold">45%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Marketing Directo</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: "30%" }}></div>
                      </div>
                      <span className="font-semibold">30%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
                <h4 className="font-medium mb-2">Métricas de Conversión</h4>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">3.2%</div>
                    <p className="text-sm text-muted-foreground">Tasa de Conversión Global</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Citas Programadas</span>
                      <span className="font-semibold">156</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Tratamientos Iniciados</span>
                      <span className="font-semibold">89</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Valor Promedio</span>
                      <span className="font-semibold">€275</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">ROI Total</span>
                      <span className="font-bold text-green-600">€24,475</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50">
              <h4 className="font-medium mb-2">Tendencias de Marketing</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 border rounded-lg">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold">4.8</div>
                  <p className="text-sm text-muted-foreground">Satisfacción del Cliente</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold">4.6</div>
                  <p className="text-sm text-muted-foreground">Calificación Online</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">92%</div>
                  <p className="text-sm text-muted-foreground">Tasa de Retención</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
