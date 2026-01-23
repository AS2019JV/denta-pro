import type React from "react"
import type { Metadata } from "next"
import { Oswald, Work_Sans, Gowun_Batang } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-context"
import { TranslationProvider } from "@/components/translations"
import { Toaster } from "sonner"
import "../(dashboard)/globals.css" // Import globals from dashboard or relative path

const oswald = Oswald({ subsets: ["latin"], variable: "--font-title" })
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-subtitle" })
const gowunBatang = Gowun_Batang({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-text" })

export const metadata: Metadata = {
  title: "Clinia + | Configura tu Clínica",
  description: "Crea tu espacio de trabajo en Clinia +",
}

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${oswald.variable} ${workSans.variable} ${gowunBatang.variable} font-text bg-background`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TranslationProvider>
            <AuthProvider>
                <div className="min-h-screen flex flex-col">
                  {children}
                </div>
                <Toaster />
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
