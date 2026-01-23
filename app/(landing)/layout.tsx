import type React from "react"
import "./globals.css"
import { Oswald, Work_Sans, Gowun_Batang } from "next/font/google"
import { ThemeProvider } from "@/components/landing/theme-provider"
import { Toaster } from "sonner"

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Clinia+ - Modern Dental Practice Management Software</title>
        <meta
          name="description"
          content="Streamline your dental practice with our all-in-one solution. Simplify scheduling, billing, and patient management."
        />
        <link rel="icon" href="/brand-logo.png" />
      </head>
      <body className={`${oswald.variable} ${workSans.variable} ${gowunBatang.variable} font-text`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
