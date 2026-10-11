import Link from 'next/link'
import { ArrowRight, CalendarDays, Users, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/landing/layout/site-header'
import { SiteFooter } from '@/components/landing/layout/site-footer'

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-24 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:ring-2 focus:ring-primary"
      >
        Ir al contenido
      </a>
      <SiteHeader />
      <main id="contenido">
        <section className="border-b pt-32 pb-20 md:pt-44 md:pb-28">
          <div className="container grid items-center gap-12 px-4 md:px-6 lg:grid-cols-[1.15fr_1fr]">
            <div className="space-y-7">
              <p className="text-sm font-medium text-primary">Gestión dental · Ecuador</p>
              <h1 className="max-w-xl text-balance font-title text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Tu agenda y tus pacientes, en un solo lugar.
              </h1>
              <p className="max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
                Organiza las citas, consulta la ficha del paciente y prepara sus documentos
                clínicos. Una herramienta en español para odontólogos y recepción.
              </p>
              <div className="flex flex-wrap items-center gap-5">
                <Button size="lg" asChild>
                  <Link href="/login" prefetch={false}>
                    Entrar a Clinia+
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <a
                  href="#features"
                  className="rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Conocer la herramienta
                </a>
              </div>
              <p className="text-sm text-muted-foreground">
                Desde la primera cita hasta el seguimiento del paciente.
              </p>
            </div>
            <aside
              aria-label="Cómo se organiza el trabajo"
              className="rounded-2xl border bg-card p-6 sm:p-8"
            >
              <p className="mb-6 text-sm font-medium text-muted-foreground">
                Un recorrido claro para tu equipo
              </p>
              <ol className="space-y-6">
                {[
                  [
                    '01',
                    'Prepara la jornada',
                    'Revisa quién viene, con qué profesional y a qué hora.',
                  ],
                  [
                    '02',
                    'Recibe al paciente',
                    'Actualiza sus datos y registra su llegada en la agenda.',
                  ],
                  [
                    '03',
                    'Continúa la atención',
                    'Abre su ficha y consulta sus registros y recetas.',
                  ],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-4">
                    <span
                      className="pt-1 text-xs font-medium tabular-nums text-primary"
                      aria-hidden="true"
                    >
                      {number}
                    </span>
                    <div>
                      <h2 className="font-subtitle text-lg font-semibold">{title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>
        <section id="features" className="scroll-mt-24 py-20">
          <div className="container grid gap-10 px-4 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-sm font-medium text-primary">Lo esencial para la clínica</p>
              <h2 className="text-balance font-title text-3xl font-semibold tracking-tight">
                Menos pasos para organizar la atención.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                Odontólogos y recepción comparten la agenda. Cada integrante trabaja con la
                información que corresponde a su función.
              </p>
            </div>
            <div className="divide-y">
              {[
                {
                  icon: CalendarDays,
                  title: 'Agenda de la clínica',
                  copy: 'Programa, confirma y reprograma las citas por profesional. Registra llegadas, cancelaciones y ausencias.',
                },
                {
                  icon: Users,
                  title: 'Pacientes fáciles de encontrar',
                  copy: 'Busca al paciente y consulta sus datos de contacto. Mantén su información organizada en una ficha.',
                },
                {
                  icon: FileText,
                  title: 'Documentos clínicos',
                  copy: 'Trabaja con historia clínica odontológica, odontograma y recetas desde la ficha del paciente.',
                },
              ].map(({ icon: Icon, title, copy }) => (
                <article key={title} className="flex gap-4 py-6 first:pt-0">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-subtitle text-lg font-semibold">{title}</h3>
                    <p className="mt-2 max-w-xl text-pretty leading-relaxed text-muted-foreground">
                      {copy}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="contact" className="scroll-mt-24 border-t bg-muted/30 py-16">
          <div className="container flex flex-wrap items-center justify-between gap-7 px-4 md:px-6">
            <div>
              <h2 className="font-title text-2xl font-semibold tracking-tight">
                Tu equipo, con la información a mano.
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Accede a tu clínica o crea una cuenta para comenzar la configuración.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login" prefetch={false}>
                  Iniciar sesión
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/signup" prefetch={false}>
                  Crear cuenta
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter simplified />
    </div>
  )
}
