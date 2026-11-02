"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const tasks = [
  "Crear o buscar un paciente ficticio",
  "Registrar antecedentes y alertas",
  "Programar o reprogramar una cita",
  "Registrar odontograma y evolución en HCU-033",
  "Guardar y reabrir el registro",
]
const feedbackEmail = "soporte@care.cliniaplus.com"

function safeRoute(pathname: string | null): string {
  if (!pathname || !pathname.startsWith("/")) return "/"
  const segments = pathname.split("/").filter(Boolean).map(segment => {
    // Keep route names while removing values that could identify a record.
    if (/^(\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{24})$/i.test(segment)) return ":id"
    return segment.replace(/[^a-zA-Z0-9_-]/g, "")
  }).filter(Boolean)
  return `/${segments.join("/")}`
}

export function PilotWelcome() {
  const pathname = usePathname()
  const [copyStatus, setCopyStatus] = useState("")

  async function copyRoute() {
    setCopyStatus("")
    try {
      await navigator.clipboard.writeText(`Ruta: ${safeRoute(pathname)}`)
      setCopyStatus(`Ruta copiada. Envíala con tus comentarios a ${feedbackEmail}.`)
    } catch {
      setCopyStatus(`No se pudo copiar. Puedes indicar la ruta manualmente a ${feedbackEmail}.`)
    }
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm font-medium text-primary" role="note">
          Entorno de evaluación. Utiliza únicamente datos ficticios
        </p>

        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
            Bienvenida y tareas sugeridas
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <p>Explora el flujo con información inventada y comprueba que los cambios se guardan.</p>
            <ol className="list-decimal space-y-1 pl-5">
              {tasks.map(task => <li key={task}>{task}</li>)}
            </ol>
            <nav aria-label="Accesos del piloto" className="flex flex-wrap gap-3">
              <Link className="text-primary underline underline-offset-4" href="/patients">Pacientes</Link>
              <Link className="text-primary underline underline-offset-4" href="/calendar">Calendario</Link>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline" onClick={copyRoute}>
                Copiar ruta para comentarios
              </Button>
              <a className="text-primary underline underline-offset-4" href={`mailto:${feedbackEmail}?subject=${encodeURIComponent("Comentarios sobre Clinia+")}`}>
                {feedbackEmail}
              </a>
            </div>
            <p className="text-muted-foreground">Cuéntanos dónde te detuviste, qué esperabas y qué te impediría usar Clinia+. Incluye sólo datos ficticios.</p>
            <p className="sr-only" role="status" aria-live="polite">{copyStatus}</p>
            {copyStatus && <p className="text-sm text-muted-foreground" aria-hidden="true">{copyStatus}</p>}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
