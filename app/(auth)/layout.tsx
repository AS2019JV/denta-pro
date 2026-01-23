import type React from "react"
import type { Metadata } from "next"
import "../(dashboard)/globals.css" // Import globals from sibling or adjust path. 
// Wait, globals.css is in app/(dashboard)/globals.css. I might need to move it up or import it correctly.
// Let's assume I can import it. The dashboard layout imported "./globals.css".
// I should probably verify where globals.css should live. Typically it's in app/globals.css.
// But current file structure had it in (dashboard).
// For now I'll try to import it from "../(dashboard)/globals.css".

import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Clinia + | Autenticación",
  description: "Ingresa o registrate",
  icons: {
    icon: '/brand-logo.png',
  },
  generator: 'v0.app'
}

export default function AuthLayout({
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
                {children}
                <Toaster />
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
