"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTranslation } from "@/components/translations"

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { t } = useTranslation()

  // Evitar desajustes de hidratación renderizando solo después del montaje
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && (theme === "dark" || (theme === "system" && resolvedTheme === "dark"))

  const toggleTheme = () => {
    // Forzar cambio explícito de tema
    const newTheme = isDark ? "light" : "dark"
    console.log(`Cambiando tema a: ${newTheme}`)
    setTheme(newTheme)
  }

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-full bg-muted/80 hover:bg-muted overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
      aria-label={isDark ? t("lightMode") : t("darkMode")}
      type="button"
    >
      {isDark ? (
        <Sun className="h-5 w-5 absolute inset-0 m-auto text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 absolute inset-0 m-auto text-slate-700" />
      )}
    </button>
  )
}
