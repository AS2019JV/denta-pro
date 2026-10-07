"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-context"
import { useTranslation } from "@/components/translations"
import { useSidebar } from "@/components/sidebar-context"
import { usePrivateMediaUrl } from "@/hooks/use-private-media"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  MessageSquare,
  ClipboardList,
  Building2,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const navigation = [
  { name: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "patients", href: "/patients", icon: Users },
  { name: "calendar", href: "/calendar", icon: Calendar },
  { name: "recipes", href: "/recipes", icon: ClipboardList },
  { name: "services", href: "/dashboard/services", icon: Stethoscope },
  { name: "reports", href: "/reports", icon: BarChart3 },
]


const userNavigation = [
  { name: "profile", href: "/profile", icon: User },
  { name: "team", href: "/dentists", icon: Users },
  { name: "clinic", href: "/clinic", icon: Building2 },
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
  const { user, logout, currentClinicId } = useAuth()
  const { t } = useTranslation()
  const { isOpen, setIsOpen, isExpanded, toggleSidebar } = useSidebar()

  const activeMembership = user?.clinic_memberships?.find(m => m.clinic_id === currentClinicId)
  const activeClinicName = activeMembership?.clinics?.name
  const rawLogoUrl = activeMembership?.clinics?.logo_url
  const memberTitle = user?.title
  const displayName = memberTitle ? `${memberTitle} ${user?.name || ''}`.trim() : (user?.name || '')

  const activeClinicLogo = usePrivateMediaUrl('clinic-logo', currentClinicId, rawLogoUrl)
  const resolvedAvatar = usePrivateMediaUrl('doctor-avatar', user?.id, user?.avatar)

  const handleLogout = () => {
    logout()
  }

  const handleItemClick = (href: string, name: string) => {
    setIsOpen(false)
    if (onNavigate) {
      onNavigate(href)
    } else {
      router.push(href)
    }
  }

  // Role-Based Access Control (RBAC) Filtering
  const filteredNavigation = navigation.filter(item => {
    if (user?.role === "clinic_owner" || user?.role === "admin" as any) return true;
    if (user?.role === "doctor") {
        return item.name !== "billing";
    }
    if (user?.role === "receptionist") {
        // Reception uses demographic patients and operational navigation.
        return !["reports", "services", "recipes"].includes(item.name);
    }
    return true;
  });

  const filteredUserNavigation = userNavigation.filter(item => {
    if (user?.role === "clinic_owner" || user?.role === "admin" as any) return true;
    // Clinic settings are admin-only
    if (item.name === "clinic") return false;
    if (user?.role === "receptionist") {
      // Receptionists can see their profile and the Team (dentist list)
      return ["profile", "team"].includes(item.name);
    }
    // Doctors only see their profile
    return item.name === "profile"; 
  });

  // Use provided navItems or fallback to internal navigation
  const itemsToRender = navItems || filteredNavigation.map(item => ({
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
          aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          aria-expanded={isOpen}
          aria-controls="clinic-sidebar"
          className="bg-background/95 backdrop-blur-sm shadow-sm"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        id="clinic-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card/95 backdrop-blur border-r transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col h-full",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isExpanded ? "w-64 lg:w-64" : "w-64 lg:w-20"
        )}
      >
        {/* Personalized Branding: Clinic Name on Left, Logo on Right */}
        <div className={cn(
          "flex items-center justify-between h-16 border-b shrink-0 bg-background/50 relative overflow-hidden group transition-all duration-300",
          isExpanded ? "px-6" : "px-3 lg:justify-center"
        )}>
          {/* Subtle glowing indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/80 to-transparent" />
          
          <div className={cn("flex flex-col min-w-0 pr-2", !isExpanded && "lg:hidden")}>
            <h1 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground truncate font-montserrat tracking-tight leading-tight" title={activeClinicName || "Clinia +"}>
              {activeClinicName || "Clinia +"}
            </h1>
            <span className="text-[9px] text-[#145247] dark:text-[#4FA89A] font-bold tracking-wider uppercase">
              {activeClinicName ? "Mi Consultorio" : "Panel Clínico"}
            </span>
          </div>
          
          {activeClinicLogo ? (
            <div className="relative h-9 w-9 rounded-xl overflow-hidden border border-border/80 shadow-md flex items-center justify-center bg-muted/20 shrink-0 hover:scale-105 transition-transform duration-300" title={activeClinicName || "Clinia +"}>
              <img src={activeClinicLogo} alt="Clinic Logo" className="object-cover h-full w-full" />
            </div>
          ) : (
            <div className="relative h-8 w-8 shrink-0 hover:scale-105 transition-transform duration-300" title="Clinia +">
              <img src="/brand-logo.png" alt="Clinia Logo" className="object-contain" />
            </div>
          )}
        </div>

        {/* User info & Actions */}
        <div className={cn("p-4 border-b bg-muted/20 transition-all duration-300", !isExpanded && "lg:p-2 lg:flex lg:flex-col lg:items-center")}>
          <div className={cn("flex items-center gap-3", !isExpanded && "lg:flex-col lg:gap-1.5 lg:items-center")}>
            <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-muted shadow-sm transition-transform hover:scale-105" title={displayName}>
              <AvatarImage src={resolvedAvatar || "/placeholder.svg"} alt={user?.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className={cn("flex-1 min-w-0", !isExpanded && "lg:hidden")}>
              <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {user?.role === "clinic_owner" 
                    ? "Administrador" 
                    : user?.role === "doctor" 
                        ? t("doctor") 
                        : t("reception")
                }
              </p>
            </div>
            

          </div>
        </div>

          {/* Navigation */}
          <nav className={cn("flex-1 py-4 space-y-2", isExpanded ? "px-4" : "px-4 lg:px-2")}>
            {itemsToRender.filter(item => user?.role !== "receptionist" || !item.href.startsWith("/recipes")).map((item) => {
              const translationKey = item.label.toLowerCase()
              const labelText = t(translationKey as any)
              return (
                <div key={item.label} onClick={() => handleItemClick(item.href, item.label.toLowerCase())}>
                  <Button
                    variant={item.active ? "default" : "ghost"}
                    className={cn(
                      "w-full cursor-pointer transition-all duration-200",
                      isExpanded 
                        ? "justify-start" 
                        : "justify-start lg:justify-center lg:px-2"
                    )}
                    title={!isExpanded ? labelText : undefined}
                  >
                    <item.icon className={cn("h-4 w-4", isExpanded ? "mr-3" : "mr-3 lg:mr-0")} />
                    <span className={cn("truncate", !isExpanded && "lg:hidden")}>
                      {labelText}
                    </span>
                  </Button>
                </div>
              )
            })}
          </nav>

          {/* User navigation */}
          <div className={cn("border-t space-y-2", isExpanded ? "p-4" : "p-4 lg:p-2")}>
            {filteredUserNavigation.map((item) => {
              const isActive = pathname === item.href
              const labelText = t(item.name)
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full cursor-pointer transition-all duration-200",
                      isExpanded 
                        ? "justify-start" 
                        : "justify-start lg:justify-center lg:px-2"
                    )}
                    onClick={() => setIsOpen(false)}
                    title={!isExpanded ? labelText : undefined}
                  >
                    <item.icon className={cn("h-4 w-4", isExpanded ? "mr-3" : "mr-3 lg:mr-0")} />
                    <span className={cn("truncate", !isExpanded && "lg:hidden")}>
                      {labelText}
                    </span>
                  </Button>
                </Link>
              )
            })}
            <Button 
              variant="ghost" 
              className={cn(
                "w-full text-red-600 transition-all duration-200",
                isExpanded ? "justify-start" : "justify-start lg:justify-center lg:px-2"
              )} 
              onClick={handleLogout}
              title={!isExpanded ? t("logout") : undefined}
            >
              <LogOut className={cn("h-4 w-4", isExpanded ? "mr-3" : "mr-3 lg:mr-0")} />
              <span className={cn("truncate", !isExpanded && "lg:hidden")}>
                {t("logout")}
              </span>
            </Button>

            {/* Desktop Collapse/Expand Toggle Button */}
            <div className="hidden lg:block pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className={cn(
                  "w-full text-muted-foreground hover:text-foreground transition-all duration-200",
                  isExpanded ? "justify-start" : "justify-center px-0"
                )}
                title={isExpanded ? "Colapsar menú lateral" : "Expandir menú lateral"}
              >
                {isExpanded ? (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    <span className="text-xs font-medium">Colapsar menú</span>
                  </>
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
