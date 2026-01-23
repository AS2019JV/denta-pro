"use client"

import { useState } from "react"
import Link from "next/link"
import { HeartPulse, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface SiteHeaderProps {
  activeSection?: string
  scrollToSection?: (sectionId: string) => void
  isHomePage?: boolean
}

export function SiteHeader({ activeSection, scrollToSection, isHomePage = true }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleNavigation = (sectionId: string) => {
    setMobileMenuOpen(false)
    if (scrollToSection) {
      scrollToSection(sectionId)
    }
  }

  const navItems = [
    { id: "features", label: "Características" },
    { id: "testimonials", label: "Testimonios" },
    { id: "pricing", label: "Precios" },
    { id: "contact", label: "Contacto" },
  ]

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isHomePage 
          ? "bg-white/70 backdrop-blur-xl border-b border-white/20 supports-[backdrop-filter]:bg-white/60" 
          : "bg-white/80 backdrop-blur-xl border-b border-gray-100"
      }`}
    >
      <div className="container flex h-16 md:h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-9 h-9 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-teal-600 shadow-md group-hover:shadow-lg transition-all duration-300">
             <img src="/brand-logo.png" alt="Clinia+" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-xl font-title tracking-tight text-slate-800">Clinia<span className="text-primary">+</span></span>
        </Link>
        
        {isHomePage ? (
          <>
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection && scrollToSection(item.id)}
                  className={`text-[15px] font-medium transition-all duration-200 hover:text-slate-900 font-subtitle ${
                    activeSection === item.id ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="hidden md:flex text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-full px-5 font-subtitle"
                asChild
              >
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-full px-6 shadow-lg shadow-teal-900/20 transition-all duration-300 hover:scale-105 hover:shadow-teal-500/30 font-subtitle text-[15px] active:scale-95" asChild>
                <Link href="/free-trial">Prueba gratuita</Link>
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Abrir menú de navegación</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-sm">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2 font-bold text-xl font-title text-primary">
                        <img src="/brand-logo.png" alt="Clinia+" className="h-8 w-auto" />
                        <span>Clinia+</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-6">
                      {navItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNavigation(item.id)}
                          className="flex w-full items-center justify-between py-2 text-lg font-medium font-subtitle text-gray-600 hover:text-secondary"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-auto pt-8 flex flex-col gap-4">
                      <Button variant="outline" className="w-full border-primary text-primary" asChild>
                        <Link href="/login">Iniciar sesión</Link>
                      </Button>
                      <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground" asChild>
                        <Link href="/free-trial">Prueba gratuita</Link>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        ) : (
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-secondary">
            Volver al inicio
          </Link>
        )}
      </div>
    </header>
  )
}

