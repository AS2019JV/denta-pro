"use client"
import { Calendar, CreditCard, Home, Menu, PieChart, Users, MessageSquare, Megaphone } from "lucide-react"
import type React from "react"

import { useRouter, usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"
import { Sidebar } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { NotificationBell } from "@/components/notification-bell"
import { useTranslation } from "@/components/translations"

const navItems = [
  { icon: Home, label: "Dashboard", href: "/", active: false },
  { icon: Users, label: "Patients", href: "/patients", active: false },
  { icon: Calendar, label: "Calendar", href: "/calendar", active: false },
  { icon: CreditCard, label: "Billing", href: "/billing", active: false },
  { icon: PieChart, label: "Reports", href: "/reports", active: false },
  { icon: MessageSquare, label: "Messages", href: "/messages", active: false },
  { icon: Megaphone, label: "Marketing", href: "/marketing", active: false },
]

export interface DashboardProps {
  children?: React.ReactNode
  showPageTitle?: boolean
}

export default function Dashboard({ children, showPageTitle = true }: DashboardProps) {
  const { isExpanded } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()

  // Actualizar estado activo basado en la ruta actual
  const updatedNavItems = navItems.map((item) => ({
    ...item,
    active: pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href)),
  }))

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  // Obtener título de la página actual
  const getCurrentPageTitle = () => {
    const currentItem = updatedNavItems.find((item) => item.active)
    return currentItem ? t(currentItem.label.toLowerCase() as any) : t("dashboard")
  }

  // Verificar si estamos en el panel principal
  const isMainDashboard = pathname === "/"

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Barra lateral */}
      <Sidebar navItems={updatedNavItems} onNavigate={handleNavigation} />

      {/* Contenido principal */}
      <div className={cn("flex flex-1 flex-col transition-all duration-400 ease-in-out")}>
        {/* Encabezado unificado - Escritorio y móvil con ancho aumentado */}
        <header className="sticky top-0 z-30 flex h-16 items-center bg-card px-4 md:px-6">
          <div className="flex w-full max-w-7xl mx-auto items-center justify-between">
            {/* Sección izquierda: Botón de menú/atrás y título de página */}
            <div className="flex items-center gap-3">
              {/* Botón de menú móvil o botón de retroceso */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-12 w-12">
                      <Menu className="h-7 w-7" />
                      <span className="sr-only">Alternar Menú</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-60 bg-card">
                    <nav className="grid gap-2 text-lg font-medium">
                      <h2 className="mb-2 text-xl font-bold text-primary font-montserrat">Clinia +</h2>
                      {updatedNavItems.map((item, index) => (
                        <Button
                          key={index}
                          variant={item.active ? "default" : "ghost"}
                          className={cn(
                            "flex justify-start gap-2",
                            item.active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                          )}
                          onClick={() => handleNavigation(item.href)}
                        >
                          <item.icon className="h-5 w-5" />
                          {t(item.label.toLowerCase() as any)}
                        </Button>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Título de página - mostrado en todos los dispositivos */}
              {showPageTitle && (
                <div>
                  <h1 className="text-lg font-semibold md:text-xl">{getCurrentPageTitle()}</h1>
                  {isMainDashboard && (
                    <p className="text-xs text-muted-foreground md:text-sm">{t("welcomeBack")}, Dr. Johnson</p>
                  )}
                </div>
              )}
            </div>

            {/* Sección derecha: Botones de acción - movidos hacia abajo desde arriba */}
            <div className="flex items-center ml-auto h-full pt-3">
              {/* Alternar tema */}
              <div className="px-2">
                <ThemeToggle />
              </div>

              {/* Grupo de notificaciones - mensajes y notificaciones agrupados */}
              <div className="flex items-center gap-3 px-3 border-l border-r border-border/40 mx-2">
                {/* Mensajes - Oculto en pantallas más pequeñas */}
                <div className="hidden sm:block">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-12 w-12 rounded-full"
                    onClick={() => router.push("/messages")}
                  >
                    <MessageSquare className="h-[1.8rem] w-[1.8rem] transition-colors hover:text-primary" />
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-white">
                      3
                    </span>
                  </Button>
                </div>

                {/* Campana de notificaciones */}
                <NotificationBell />
              </div>

              {/* Navegación de usuario - Oculto en móvil, mostrado en tablet y superior */}
              <div className="hidden sm:flex pl-2">
                <UserNav />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl">
            {/* Contenido de página - ancho aumentado para coincidir con el encabezado */}
            <div className="p-4 md:p-6">{children}</div>
          </div>
        </main>

        {/* Navegación inferior móvil */}
        <div className="sticky bottom-0 z-30 border-t bg-card sm:hidden">
          <nav className="grid grid-cols-6">
            {updatedNavItems.map((item, index) => (
              <Button
                key={index}
                variant="ghost"
                className="flex flex-col items-center gap-1 py-3 text-xs"
                onClick={() => handleNavigation(item.href)}
              >
                <item.icon className={cn("h-5 w-5", item.active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn(item.active ? "text-primary font-medium" : "text-muted-foreground")}>
                  {t(item.label.toLowerCase() as any)}
                </span>
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
