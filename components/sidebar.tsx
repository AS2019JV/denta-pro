"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { useSidebar } from "@/components/sidebar-context"
import { ThemeToggle } from "@/components/theme-toggle"
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
  Megaphone,
  Bell,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const navigation = [
  { name: "dashboard", href: "/", icon: LayoutDashboard },
  { name: "patients", href: "/patients", icon: Users },
  { name: "calendar", href: "/calendar", icon: Calendar },
  { name: "billing", href: "/billing", icon: CreditCard },
  { name: "reports", href: "/reports", icon: BarChart3 },
  { name: "messages", href: "/messages", icon: MessageSquare },
  { name: "marketing", href: "/marketing", icon: Megaphone },
]

const userNavigation = [
  { name: "profile", href: "/profile", icon: User },
  { name: "settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { isOpen, setIsOpen } = useSidebar()

  const handleLogout = () => {
    logout()
  }

  const notifications = [
    { id: 1, message: "Nueva cita programada para mañana", unread: true },
    { id: 2, message: "Recordatorio: Revisión de paciente a las 3 PM", unread: true },
    { id: 3, message: "Pago recibido de María García", unread: false },
  ]

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/95 backdrop-blur-sm"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-primary">DentaPro+</h1>
          </div>

          {/* User info */}
          <div className="p-4 border-b">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role === "doctor" ? t("doctor") : t("reception")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                          {unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {notifications.map((notification) => (
                      <DropdownMenuItem key={notification.id} className="flex items-start gap-2 p-3">
                        <div className="flex-1">
                          <p className={`text-sm ${notification.unread ? "font-medium" : ""}`}>
                            {notification.message}
                          </p>
                        </div>
                        {notification.unread && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link href="/messages">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
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
      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
