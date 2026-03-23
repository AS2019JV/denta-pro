import type React from "react"
import "../globals.css"
import { Oswald, Work_Sans, Gowun_Batang } from "next/font/google"
import { ThemeProvider } from "@/components/landing/theme-provider"
import { Toaster } from "sonner"

export const dynamic = 'force-dynamic'
const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-title",
})

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-subtitle",
})

const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-text",
})

export const metadata = {
  title: "Clinia+ - Software de Gestión Dental",
  description: "Moderniza tu clínica dental con nuestra plataforma todo en uno. Simplifica agendamiento, historias clínicas y facturación.",
  icons: {
    icon: "/brand-logo.png",
  },
  generator: 'v0.app'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${oswald.variable} ${workSans.variable} ${gowunBatang.variable} font-text`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
