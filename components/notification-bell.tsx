"use client"

import { Bell } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTranslation } from "@/components/translations"

export function NotificationBell() {
  const [notificationCount, setNotificationCount] = useState(3)
  const { t } = useTranslation()

  const clearNotifications = () => {
    setNotificationCount(0)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-12 w-12 rounded-full">
          <Bell className="h-[1.8rem] w-[1.8rem] transition-colors hover:text-primary" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#28A745] text-[11px] font-medium text-white">
              {notificationCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Notificaciones</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
              onClick={clearNotifications}
            >
              Marcar todo como leído
            </Button>
          </div>
          <div className="space-y-2">
            {notificationCount > 0 ? (
              <>
                <div className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nueva solicitud de cita</p>
                    <p className="text-xs text-muted-foreground">Sarah Johnson solicitó una cita para mañana</p>
                    <p className="mt-1 text-xs text-muted-foreground">hace 10 minutos</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-[#28A745]/20 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-[#28A745]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Resultados de laboratorio disponibles</p>
                    <p className="text-xs text-muted-foreground">
                      Los resultados de laboratorio de Michael Chen están disponibles
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">hace 1 hora</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pago recibido</p>
                    <p className="text-xs text-muted-foreground">
                      Emily Rodriguez completó el pago de su última visita
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">hace 3 horas</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-20 items-center justify-center">
                <p className="text-sm text-muted-foreground">No hay nuevas notificaciones</p>
              </div>
            )}
          </div>
          <div className="border-t pt-2">
            <Button variant="ghost" size="sm" className="w-full justify-center text-xs">
              Ver todas las notificaciones
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
