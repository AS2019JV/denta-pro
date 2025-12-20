"use client"

import type React from "react"

import { useAuth } from "@/components/auth-context"
import { LoginForm } from "@/components/login-form"
import { Sidebar } from "@/components/sidebar"

import { usePathname } from "next/navigation"

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Allow access to public routes within the specific group
  const publicRoutes = ["/signup", "/login"]
  if (pathname && publicRoutes.some(route => pathname.startsWith(route))) {
    return <>{children}</>
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
