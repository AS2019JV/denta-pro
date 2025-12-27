import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "sonner"
import { SubscriptionBlocker } from "@/components/subscription-blocker"

export const metadata: Metadata = {
  title: "Clinia + | Software Dental Moderno",
  description: "Una interfaz moderna, intuitiva y responsive para software dental Clinia +",
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-EC" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TranslationProvider>
            <AuthProvider>
              <SubscriptionBlocker />
              <SidebarProvider>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <main className="flex-1 overflow-auto">
                    <div className="container mx-auto p-6 lg:p-8">{children}</div>
                  </main>
                </div>
                <Toaster />
              </SidebarProvider>
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
