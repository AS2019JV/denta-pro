'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

interface SiteHeaderProps {
  isHomePage?: boolean
}

export function SiteHeader({ isHomePage = true }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navItems = [
    { href: '/#features', label: 'La herramienta' },
    { href: '/#contact', label: 'Comenzar' },
  ]
  return (
    <header className="fixed top-0 z-50 w-full border-b bg-background/95">
      <div className="container flex h-16 items-center justify-between gap-3 px-4 md:h-20 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Clinia+, inicio"
        >
          <img src="/brand-logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <span className="font-title text-lg font-bold tracking-tight sm:text-xl">
            Clinia<span className="text-primary">+</span>
          </span>
        </Link>
        {isHomePage && (
          <nav aria-label="Navegación principal" className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/login" prefetch={false}>
              Iniciar sesión
            </Link>
          </Button>
          {!isHomePage ? (
            <Link
              href="/"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Volver al inicio
            </Link>
          ) : (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Abrir menú de navegación"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,22rem)]">
                <SheetTitle>Clinia+</SheetTitle>
                <nav aria-label="Navegación móvil" className="mt-8 flex flex-col gap-5">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {item.label}
                    </a>
                  ))}
                  <Link
                    href="/signup"
                    prefetch={false}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded py-2 font-medium"
                  >
                    Crear cuenta
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}
