"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Plus,
  Filter,
  User,
  Clock,
  Calendar,
  Phone,
  Mail,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Archive,
  Star,
} from "lucide-react"

const conversations = [
  {
    id: 1,
    patient: "María García",
    lastMessage: "Necesito reprogramar mi cita para mañana...",
    time: "10m",
    unread: 2,
    status: "online",
    avatar: "/placeholder.svg?height=40&width=40&text=MG",
  },
  {
    id: 2,
    patient: "Juan Pérez",
    lastMessage: "Gracias por la información sobre el tratamiento",
    time: "1h",
    unread: 0,
    status: "away",
    avatar: "/placeholder.svg?height=40&width=40&text=JP",
  },
  {
    id: 3,
    patient: "Ana López",
    lastMessage: "¿Cuándo estarán listos mis resultados?",
    time: "3h",
    unread: 1,
    status: "offline",
    avatar: "/placeholder.svg?height=40&width=40&text=AL",
  },
  {
    id: 4,
    patient: "Carlos Ruiz",
    lastMessage: "¿Puedo obtener una copia de mi historial?",
    time: "1d",
    unread: 0,
    status: "offline",
    avatar: "/placeholder.svg?height=40&width=40&text=CR",
  },
  {
    id: 5,
    patient: "Laura Martín",
    lastMessage: "¿Tienen disponibilidad la próxima semana?",
    time: "2d",
    unread: 0,
    status: "online",
    avatar: "/placeholder.svg?height=40&width=40&text=LM",
  },
]

const messages = [
  {
    id: 1,
    sender: "patient",
    content: "Buenos días Dr. Johnson, necesito reprogramar mi cita para mañana. No me siento bien.",
    time: "10:24 AM",
    date: "Hoy",
  },
  {
    id: 2,
    sender: "doctor",
    content:
      "Lamento escuchar eso, María. Déjame revisar nuestra disponibilidad. ¿Te funcionaría el viernes a las 2 PM?",
    time: "10:30 AM",
    date: "Hoy",
  },
  {
    id: 3,
    sender: "patient",
    content: "Sí, el viernes a las 2 PM sería perfecto. Gracias por acomodarme.",
    time: "10:32 AM",
    date: "Hoy",
  },
  {
    id: 4,
    sender: "doctor",
    content:
      "¡Excelente! He reprogramado tu cita para el viernes a las 2 PM. Que te mejores pronto, y avísanos si necesitas algo más.",
    time: "10:35 AM",
    date: "Hoy",
  },
  {
    id: 5,
    sender: "patient",
    content: "Muchas gracias por su comprensión. Nos vemos el viernes.",
    time: "10:37 AM",
    date: "Hoy",
  },
]

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0])
  const [searchTerm, setSearchTerm] = useState("")
  const [newMessage, setNewMessage] = useState("")

  const filteredConversations = conversations.filter((conv) =>
    conv.patient.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "away":
        return "bg-yellow-500"
      default:
        return "bg-gray-400"
    }
  }

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Here you would typically send the message to your backend
      console.log("Sending message:", newMessage)
      setNewMessage("")
    }
  }

  return (
    <div className="pt-4">
      <PageHeader title="Mensajes" />
      <div className="grid gap-4 lg:grid-cols-12 h-[calc(100vh-12rem)]">
        {/* Conversations List */}
        <Card className="lg:col-span-4 overflow-hidden">
          <CardHeader className="px-4 py-3 bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mensajes</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-4 w-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Nuevo Mensaje</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="recipient">Destinatario</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar paciente" />
                          </SelectTrigger>
                          <SelectContent>
                            {conversations.map((conv) => (
                              <SelectItem key={conv.id} value={conv.id.toString()}>
                                {conv.patient}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="message">Mensaje</Label>
                        <Textarea id="message" placeholder="Escribe tu mensaje..." rows={4} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline">Cancelar</Button>
                        <Button>Enviar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversaciones..."
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[calc(100vh-20rem)] overflow-y-auto">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedConversation.id === conversation.id ? "bg-muted/30" : ""
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conversation.avatar || "/placeholder.svg"} alt={conversation.patient} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {conversation.patient
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(conversation.status)}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{conversation.patient}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{conversation.time}</span>
                        {conversation.unread > 0 && (
                          <Badge className="h-5 min-w-5 rounded-full px-1.5 bg-primary text-xs">
                            {conversation.unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">{conversation.lastMessage}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-8 overflow-hidden flex flex-col">
          {/* Chat Header */}
          <CardHeader className="px-6 py-4 border-b flex flex-row items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedConversation.avatar || "/placeholder.svg"} alt={selectedConversation.patient} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {selectedConversation.patient
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selectedConversation.patient}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <User className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${getStatusColor(selectedConversation.status)}`}></span>
                  {selectedConversation.status === "online"
                    ? "En línea"
                    : selectedConversation.status === "away"
                      ? "Ausente"
                      : "Desconectado"}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">PT-10045</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">Última visita: 15 Mar, 2025</span>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-center">
              <span className="text-xs text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">Hoy, 10:24 AM</span>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 max-w-[80%] ${
                  message.sender === "doctor" ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className={
                      message.sender === "doctor"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {message.sender === "doctor"
                      ? "DJ"
                      : selectedConversation.patient
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-lg p-3 ${
                    message.sender === "doctor"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted/50 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <span className="text-xs text-muted-foreground self-end mb-1">{message.time}</span>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Escribe tu mensaje..."
                className="flex-1"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Smile className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-9 w-9" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Calendar className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Star className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Tiempo de respuesta: ~5 minutos
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
