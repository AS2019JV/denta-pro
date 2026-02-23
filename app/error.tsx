"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCcw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production, you would log to an error reporting service like Sentry
    console.error("Global Production Error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
          <p className="text-slate-500">
            Hemos encontrado un error inesperado. Por seguridad, la operación ha sido detenida.
          </p>
          {error.digest && (
            <p className="text-[10px] text-slate-300 font-mono">Error ID: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => reset()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Intentar de nuevo
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="w-full rounded-xl h-12 gap-2"
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </Button>
        </div>
        
        <p className="text-xs text-slate-400">
          Si el problema persiste, contacte a soporte técnico mencionando el Error ID.
        </p>
      </div>
    </div>
  )
}
