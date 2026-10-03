"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { APPOINTMENT_LABELS, clinicDate, clinicDayKey } from "@/lib/agenda.mjs"
import { loadOperationalReport, reportingPeriod } from "@/lib/operational-reports.mjs"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function ReportsPage() {
  const { user, currentClinicId, isLoading, isRevalidating, authError } = useAuth()
  const [days, setDays] = useState(90)
  const [today, setToday] = useState(clinicDayKey)
  const [exporting, setExporting] = useState(false)
  const publication = useRef({ valid: false })
  useEffect(() => {
    const token = { valid: !isRevalidating }
    publication.current = token
    setExporting(false)
    return () => { token.valid = false }
  }, [currentClinicId, user?.id, user?.role, isLoading, isRevalidating, authError])
  useEffect(() => {
    const timer = setInterval(() => setToday(clinicDayKey()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const range = reportingPeriod(days, today)
  const query = useQuery({
    queryKey: ["operational-report", currentClinicId, user?.id, user?.role, range.start, range.end],
    enabled: !!currentClinicId && !!user && !isLoading && !authError,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: ({ signal }) => loadOperationalReport(supabase, currentClinicId!, range, signal),
  })
  const exportPdf = async () => {
    if (!query.data || exporting || query.isError || query.isFetching || isLoading || isRevalidating || authError) return
    const generation = publication.current
    setExporting(true)
    try {
      const { generateReportPDF } = await import("@/lib/reports-pdf")
      if (!generation.valid) return
      generateReportPDF({ period: `Últimos ${days} días · ${clinicDate(range.start)} a ${clinicDate(`${today}T12:00:00-05:00`)}`,
        generatedAt: new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(new Date()),
        summary: query.data.summary, monthlyStats: query.data.monthly, treatments: query.data.treatments,
      })
    } catch { if (generation.valid) toast.error("No se pudo exportar el informe. Reintenta.") }
    finally { if (generation.valid) setExporting(false) }
  }
  const report = query.data
  return <div className="space-y-6">
    <PageHeader title="Informes de pacientes y agenda" description="Conteos de la clínica actual. Fechas en horario de Ecuador.">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="report-period" className="sr-only">Período del informe</Label>
        <Select value={String(days)} onValueChange={value => setDays(Number(value))}>
          <SelectTrigger id="report-period" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="30">Últimos 30 días</SelectItem><SelectItem value="90">Últimos 90 días</SelectItem><SelectItem value="365">Últimos 365 días</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>Actualizar</Button>
        <Button onClick={exportPdf} disabled={!report || query.isError || query.isFetching || isLoading || !!authError || exporting}>{exporting ? "Exportando…" : "Exportar PDF"}</Button>
      </div>
    </PageHeader>
    {isLoading || !user || !currentClinicId || query.isPending ? <p role="status">Cargando informe…</p> : query.isError ? <div role="alert" className="space-y-2"><p>No se pudo cargar el informe.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : report && <>
      <p className="text-sm text-muted-foreground">Desde {clinicDate(range.start)} hasta {clinicDate(`${today}T12:00:00-05:00`)} inclusive. Las citas se cuentan por fecha de inicio; se excluyen registros archivados.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Citas del período", report.summary.appointments],
          ["Pacientes activos", report.summary.activePatients],
          ["Pacientes nuevos", report.summary.newPatients],
          ["Asistencia en citas cerradas", report.summary.attendanceRate === null ? "Sin citas cerradas" : `${report.summary.attendanceRate}%`],
        ].map(([name, value]) => <Card key={name}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{name}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold" data-testid={name === "Citas del período" ? "report-appointments" : undefined}>{value}</p></CardContent></Card>)}
      </div>
      <p className="text-sm text-muted-foreground">Pacientes activos: estado activo actual de la clínica. Nuevos: altas en el período. Asistencia: completadas ÷ (completadas + no asistió); confirmadas, en recepción y canceladas no forman parte de ese porcentaje.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Estado de citas</CardTitle></CardHeader><CardContent><dl className="space-y-3">{Object.entries(report.statuses).map(([status, count]) => <div key={status} className="flex justify-between gap-3"><dt>{APPOINTMENT_LABELS[status as keyof typeof APPOINTMENT_LABELS]}</dt><dd className="font-semibold">{count}</dd></div>)}</dl></CardContent></Card>
        <Card><CardHeader><CardTitle>Tipos de cita más frecuentes</CardTitle></CardHeader><CardContent>{report.treatments.length ? <ol className="space-y-3">{report.treatments.map(item => <li key={item.name} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 font-semibold">{item.count}</span></li>)}</ol> : <p className="text-muted-foreground">Sin citas en este período.</p>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Distribución mensual dentro del período</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Mes</th><th className="py-3">Citas</th><th className="py-3">Pacientes nuevos</th></tr></thead><tbody>{report.monthly.map(row => <tr key={row.month} className="border-b last:border-0"><th scope="row" className="py-3 font-normal">{new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "America/Guayaquil" }).format(new Date(`${row.month}-01T12:00:00-05:00`))}</th><td>{row.appointments}</td><td>{row.newPatients}</td></tr>)}</tbody></table></CardContent></Card>
    </>}
  </div>
}
