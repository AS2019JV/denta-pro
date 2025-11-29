import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { AuthWrapper } from "@/components/auth-wrapper"
import { Sidebar } from "@/components/sidebar"

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
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TranslationProvider>
            <AuthProvider>
              <SidebarProvider>
                <AuthWrapper>
                  <div className="flex h-screen bg-background">
                    <Sidebar />
                    <main className="flex-1 overflow-auto">
                      <div className="container mx-auto p-6 lg:p-8">{children}</div>
                    </main>
                  </div>
                </AuthWrapper>
              </SidebarProvider>
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
