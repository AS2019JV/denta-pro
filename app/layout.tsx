import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { AuthWrapper } from "@/components/auth-wrapper"

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
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TranslationProvider>
            <AuthProvider>
              <SidebarProvider>
                <AuthWrapper>
                  {children}
                </AuthWrapper>
              </SidebarProvider>
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
