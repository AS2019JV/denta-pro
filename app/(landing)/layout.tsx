import type React from "react"
import "../globals.css"
import { ThemeProvider } from "@/components/landing/theme-provider"
import { Toaster } from "sonner"

export const metadata = {
  title: "Clinia+ - Software de Gestión Dental",
  description: "Gestión dental para tu clínica: pacientes, agenda, historias clínicas y recetas en español.",
  icons: {
    icon: "/brand-logo.png",
  },
  generator: 'v0.app'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-text" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
