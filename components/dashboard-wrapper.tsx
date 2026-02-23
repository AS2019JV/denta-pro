"use client"

import React from "react"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  useRealtimeNotifications()
  return <>{children}</>
}
