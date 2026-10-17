import type React from "react"
import type { Metadata } from "next"
import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { QueryProvider } from "@/components/query-provider"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "sonner"
import { SubscriptionBlocker } from "@/components/subscription-blocker"
import { DashboardWrapper } from "@/components/dashboard-wrapper"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Clinia + | Software Dental Moderno",
  description: "Una interfaz moderna, intuitiva y responsive para software dental Clinia +",
  icons: {
    icon: '/brand-logo.png',
  },
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
            <QueryProvider>
              <AuthProvider>
                <DashboardWrapper>
                  <SubscriptionBlocker />
                  <SidebarProvider>
                    <a 
                      href="#main-content" 
                      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none"
                    >
                      Saltar al contenido principal
                    </a>
                    <div className="flex h-screen bg-background">
                      <Sidebar />
                      <main id="main-content" className="flex-1 overflow-auto focus:outline-none" tabIndex={-1}>
                        <div className="container mx-auto p-6 pt-20 lg:p-8">{children}</div>
                      </main>
                    </div>
                    <Toaster />
                  </SidebarProvider>
                </DashboardWrapper>
              </AuthProvider>
            </QueryProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
