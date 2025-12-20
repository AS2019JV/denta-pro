"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { useSidebar } from "@/components/sidebar-context"

import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  type LucideIcon,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const navigation = [
  { name: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "patients", href: "/patients", icon: Users },
  { name: "calendar", href: "/calendar", icon: Calendar },
  { name: "billing", href: "/billing", icon: CreditCard },
  { name: "reports", href: "/reports", icon: BarChart3 },
  { name: "messages", href: "/messages", icon: MessageSquare },
]


const userNavigation = [
  { name: "profile", href: "/profile", icon: User },
  { name: "dentist", href: "/dentists", icon: User },
  { name: "settings", href: "/settings", icon: Settings },
]

export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  active?: boolean
}

interface SidebarProps {
  navItems?: NavItem[]
  onNavigate?: (href: string) => void
}

export function Sidebar({ navItems, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { isOpen, setIsOpen } = useSidebar()

  const handleLogout = () => {
    logout()
  }

  const handleItemClick = (href: string) => {
    setIsOpen(false)
    if (onNavigate) {
      onNavigate(href)
    } else {
      router.push(href)
    }
  }

  const notifications = [
    { 
      id: 1, 
      type: "appointment",
      title: "Nueva Cita Programada", 
      message: "Paciente: María González - Limpieza dental", 
      time: "Hace 5 min",
      timestamp: "10:30 AM",
      unread: true,
      priority: "high"
    },
    { 
      id: 2, 
      type: "reminder",
      title: "Recordatorio de Cita", 
      message: "Dr. Rodríguez - Paciente en sala de espera", 
      time: "Hace 15 min",
      timestamp: "10:15 AM",
      unread: true,
      priority: "urgent"
    },
    { 
      id: 3, 
      type: "payment",
      title: "Pago Recibido", 
      message: "Factura #1234 - $150.00 pagada exitosamente", 
      time: "Hace 2h",
      timestamp: "8:30 AM",
      unread: false,
      priority: "normal"
    },
    { 
      id: 4, 
      type: "system",
      title: "Actualización del Sistema", 
      message: "Nueva versión disponible con mejoras de seguridad", 
      time: "Ayer",
      timestamp: "Ayer 5:00 PM",
      unread: false,
      priority: "low"
    },
  ]

  const messages = [
    {
      id: 1,
      sender: "Dr. Ana Martínez",
      avatar: "/placeholder.svg",
      message: "¿Podemos revisar el caso del paciente González?",
      time: "Hace 10 min",
      timestamp: "10:20 AM",
      unread: true,
      online: true
    },
    {
      id: 2,
      sender: "Recepción",
      avatar: "/placeholder.svg",
      message: "Paciente canceló cita de las 3:00 PM",
      time: "Hace 30 min",
      timestamp: "10:00 AM",
      unread: true,
      online: true
    },
    {
      id: 3,
      sender: "Dr. Carlos Ruiz",
      avatar: "/placeholder.svg",
      message: "Gracias por la información del tratamiento",
      time: "Hace 2h",
      timestamp: "8:30 AM",
      unread: false,
      online: false
    },
  ]

  const unreadCount = notifications.filter((n) => n.unread).length
  const unreadMessagesCount = messages.filter((m) => m.unread).length

  // Use provided navItems or fallback to internal navigation
  const itemsToRender = navItems || navigation.map(item => ({
    icon: item.icon,
    label: item.name,
    href: item.href,
    active: pathname === item.href
  }))

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/95 backdrop-blur-sm shadow-sm"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-card/95 backdrop-blur border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          flex flex-col h-full
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b shrink-0 bg-background/50">
          <div className="relative h-8 w-8">
            <img src="/clinia-logo.png" alt="Clinia Logo" className="object-contain" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Clinia +
          </h1>
        </div>

        {/* User info & Actions */}
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-muted shadow-sm transition-transform hover:scale-105">
              <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {user?.role === "doctor" ? t("doctor") : t("reception")}
              </p>
            </div>
            
            {/* Notification & Message Icons - Professional SaaS Design */}
            <div className="flex items-center gap-1">
              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-lg relative hover:bg-primary/10 transition-all duration-200 group border border-transparent hover:border-primary/20"
                  >
                    <Bell className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-secondary text-[9px] font-bold text-secondary-foreground items-center justify-center shadow-sm">
                          {unreadCount}
                        </span>
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-96 p-0 overflow-hidden shadow-2xl border-primary/20 rounded-2xl">
                   {/* Header */}
                   <div className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10">
                       <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2.5">
                             <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                               <Bell className="h-4 w-4 text-primary" />
                             </div>
                             <div>
                               <h3 className="font-semibold text-base text-foreground">Notificaciones</h3>
                               <p className="text-xs text-muted-foreground">Tienes {unreadCount} sin leer</p>
                             </div>
                           </div>
                           {unreadCount > 0 && (
                             <Badge className="text-[10px] h-6 px-2 bg-secondary text-secondary-foreground font-semibold">
                               {unreadCount} nuevas
                             </Badge>
                           )}
                       </div>
                   </div>
                   
                   {/* Notifications List - Minimalist */}
                   <div className="max-h-[400px] overflow-y-auto">
                      {notifications.map((notification) => (
                      <DropdownMenuItem 
                        key={notification.id} 
                        className={`cursor-pointer p-4 border-b last:border-0 transition-all duration-200 gap-3 items-start ${
                          notification.unread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                        }`}
                      >
                         {/* Simple Priority Indicator */}
                         <div className="flex flex-col items-center gap-1 pt-1">
                           <div className={`h-2 w-2 rounded-full flex-shrink-0 transition-all ${
                             notification.priority === "urgent" ? "bg-red-500 shadow-sm shadow-red-500/50 animate-pulse" :
                             notification.priority === "high" ? "bg-secondary shadow-sm shadow-secondary/50" :
                             notification.priority === "normal" ? "bg-primary/50" :
                             "bg-muted-foreground/30"
                           }`} />
                         </div>
                         
                         <div className="space-y-1.5 flex-1 min-w-0">
                           <p className={`text-sm font-semibold leading-tight ${
                             notification.unread ? "text-foreground" : "text-muted-foreground"
                           }`}>
                             {notification.title}
                           </p>
                           <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                             {notification.message}
                           </p>
                           <p className="text-[10px] text-muted-foreground/70 pt-0.5">
                             {notification.time}
                           </p>
                         </div>
                      </DropdownMenuItem>
                      ))}
                   </div>
                   
                   {/* Footer */}
                   <div className="p-3 border-t bg-gradient-to-t from-muted/10 to-transparent flex gap-2">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="flex-1 text-xs h-9 text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 font-medium"
                       >
                           Marcar todas como leídas
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="flex-1 text-xs h-9 hover:bg-muted transition-all duration-200 font-medium"
                       >
                           Ver todas
                       </Button>
                   </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Messages Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-lg relative hover:bg-primary/10 transition-all duration-200 group border border-transparent hover:border-primary/20"
                  >
                    <MessageSquare className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-secondary text-[9px] font-bold text-secondary-foreground items-center justify-center shadow-sm">
                          {unreadMessagesCount}
                        </span>
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-96 p-0 overflow-hidden shadow-2xl border-primary/20 rounded-2xl">
                   {/* Header */}
                   <div className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10">
                       <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2.5">
                             <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                               <MessageSquare className="h-4 w-4 text-primary" />
                             </div>
                             <div>
                               <h3 className="font-semibold text-base text-foreground">Mensajes</h3>
                               <p className="text-xs text-muted-foreground">{unreadMessagesCount} sin leer</p>
                             </div>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="sm"
                             className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                             onClick={() => router.push("/messages")}
                           >
                             Ver todos
                           </Button>
                       </div>
                   </div>
                   
                   {/* Messages List */}
                   <div className="max-h-[400px] overflow-y-auto">
                      {messages.map((message) => (
                      <DropdownMenuItem 
                        key={message.id} 
                        className={`cursor-pointer p-4 border-b last:border-0 transition-all duration-200 gap-3 items-start ${
                          message.unread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                        }`}
                        onClick={() => router.push("/messages")}
                      >
                         {/* Avatar with Online Status */}
                         <div className="relative flex-shrink-0">
                           <Avatar className="h-10 w-10 border-2 border-background">
                             <AvatarImage src={message.avatar} alt={message.sender} />
                             <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                               {message.sender.split(" ").map(n => n[0]).join("")}
                             </AvatarFallback>
                           </Avatar>
                           {message.online && (
                             <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                           )}
                         </div>
                         
                         <div className="space-y-1 flex-1 min-w-0">
                           <div className="flex items-start justify-between gap-2">
                             <p className={`text-sm font-semibold leading-tight ${
                               message.unread ? "text-foreground" : "text-muted-foreground"
                             }`}>
                               {message.sender}
                             </p>
                             <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
                               {message.time}
                             </span>
                           </div>
                           <p className={`text-xs leading-relaxed line-clamp-2 ${
                             message.unread ? "text-foreground font-medium" : "text-muted-foreground"
                           }`}>
                             {message.message}
                           </p>
                           {message.unread && (
                             <div className="flex items-center gap-1.5 pt-1">
                               <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                               <span className="text-[10px] text-secondary font-semibold">Nuevo</span>
                             </div>
                           )}
                         </div>
                      </DropdownMenuItem>
                      ))}
                   </div>
                   
                   {/* Footer */}
                   <div className="p-3 border-t bg-gradient-to-t from-muted/10 to-transparent">
                       <Button 
                         variant="default" 
                         size="sm" 
                         className="w-full text-xs h-9 bg-primary hover:bg-primary/90 transition-all duration-200 font-medium"
                         onClick={() => router.push("/messages")}
                       >
                           Abrir Mensajes
                       </Button>
                   </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {itemsToRender.map((item) => {
              // Handle label vs name for translation key
              // If label is "Dashboard" (capitalized), we might need to lowercase it for translation key if that's what t() expects
              // Based on dashboard.tsx: t(item.label.toLowerCase())
              // Based on sidebar.tsx original: t(item.name) where name was "dashboard"
              const translationKey = item.label.toLowerCase()
              
              return (
                <div key={item.label} onClick={() => handleItemClick(item.href)}>
                  <Button
                    variant={item.active ? "default" : "ghost"}
                    className="w-full justify-start cursor-pointer"
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {t(translationKey as any)}
                  </Button>
                </div>
              )
            })}
          </nav>

          {/* User navigation */}
          <div className="p-4 border-t space-y-2">
            {userNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {t(item.name)}
                  </Button>
                </Link>
              )
            })}
            <Button variant="ghost" className="w-full justify-start text-red-600" onClick={handleLogout}>
              <LogOut className="mr-3 h-4 w-4" />
              {t("logout")}
            </Button>
          </div>

      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
