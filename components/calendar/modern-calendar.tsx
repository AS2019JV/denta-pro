'use client'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '@/components/auth-context'
import { AppointmentEditor } from '@/components/appointment-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import {
  APPOINTMENT_LABELS,
  APPOINTMENT_TRANSITIONS,
  ACTIVE_APPOINTMENT_STATUSES,
  clinicDayKey,
  clinicTime,
  calendarRange,
  moveCalendarDay,
  loadSchedule,
  saveAppointment,
  groupScheduleByDay,
  type AgendaAppointment,
  type AgendaStatus,
} from '@/lib/agenda.mjs'
interface Props {
  initialView?: 'month' | 'week' | 'today'
  propAppointments?: unknown[]
}
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat('es-EC', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(day + 'T12:00:00Z'))
export function ModernCalendar({ initialView = 'month' }: Props) {
  const { user, currentClinicId, isLoading, authError } = useAuth()
  const queryClient = useQueryClient()
  const scope = `${currentClinicId}:${user?.id}:${user?.role}`
  const [day, setDay] = useState(clinicDayKey())
  const [view, setView] = useState<'month' | 'week' | 'today' | 'list'>(initialView)
  const [editor, setEditor] = useState<{ day: string; appointment?: AgendaAppointment } | null>(
    null,
  )
  const [selected, setSelected] = useState<AgendaAppointment | null>(null)
  const [busy, setBusy] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [filter, setFilter] = useState('all')
  const range = useMemo(() => calendarRange(day, view), [day, view])
  const enabled = !!user && !!currentClinicId && !isLoading && !authError
  const schedule = useQuery({
    queryKey: ['agenda', 'schedule', scope, range.start, range.end],
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => loadSchedule(supabase, currentClinicId!, range, signal),
  })
  const items = enabled ? schedule.data || [] : []
  const visible = items.filter((row) => filter === 'all' || row.status === filter)
  const grouped = useMemo(() => groupScheduleByDay(visible, range.days), [visible, range.days])
  useEffect(() => {
    setEditor(null)
    setSelected(null)
    setMutationError('')
  }, [scope])
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['agenda', 'schedule', scope] })
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel(`agenda-${scope}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinicId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['agenda', 'schedule', scope] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scope, currentClinicId, enabled, queryClient])
  const changeStatus = async (status: AgendaStatus) => {
    if (!selected || !user || !currentClinicId || busy) return
    try {
      setBusy(true)
      setMutationError('')
      await saveAppointment(supabase, currentClinicId, { status }, selected.id, user.role)
      setSelected(null)
      invalidate()
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'appointments', currentClinicId, user.id, user.role],
      })
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'No se pudo actualizar la cita.')
    } finally {
      setBusy(false)
    }
  }
  const row = (item: AgendaAppointment, visibleDay: string) => (
    <button
      key={item.id}
      onClick={() => {
        setSelected(item)
        setMutationError('')
      }}
      className="w-full rounded-md border bg-card p-2 text-left text-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="font-medium">
        {clinicDayKey(item.start_time) === visibleDay
          ? clinicTime(item.start_time)
          : 'Continúa · 00:00'}{' '}
        · {item.patients?.first_name} {item.patients?.last_name}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {APPOINTMENT_LABELS[item.status]} · {item.type}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {item.profiles?.full_name || 'Profesional no disponible'}
      </span>
    </button>
  )
  return (
    <section aria-label="Agenda de la clínica" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ecuador continental · America/Guayaquil</p>
        <Button onClick={() => setEditor({ day })} disabled={!enabled}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cita
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Periodo anterior"
          onClick={() => setDay(moveCalendarDay(day, view, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Periodo siguiente"
          onClick={() => setDay(moveCalendarDay(day, view, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setDay(clinicDayKey())}>
          Hoy
        </Button>
        <h2 className="order-first basis-full font-semibold sm:order-none sm:min-w-[12rem] sm:flex-1 sm:basis-auto">{dateLabel(day)}</h2>
        <Label htmlFor="agenda-view" className="sr-only">
          Vista de agenda
        </Label>
        <select
          id="agenda-view"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
        >
          <option value="month">Mes</option>
          <option value="week">Semana</option>
          <option value="today">Día</option>
          <option value="list">Lista · 30 días</option>
        </select>
        <Label htmlFor="agenda-filter" className="sr-only">
          Filtrar por estado
        </Label>
        <select
          id="agenda-filter"
          className="h-10 max-w-full rounded-md border bg-background px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(APPOINTMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {schedule.isPending && enabled ? (
        <p role="status">Cargando agenda…</p>
      ) : schedule.isError ? (
        <div role="alert" className="rounded-md border p-4">
          <p>
            No se pudo cargar la agenda. Tus datos no se han sustituido por un calendario vacío.
          </p>
          <Button variant="outline" onClick={() => void schedule.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {visible.length} citas en el periodo visible
          </p>
          <div
            className={
              view === 'month' || view === 'week'
                ? 'grid grid-cols-1 gap-2 md:grid-cols-7'
                : 'space-y-3'
            }
          >
            {range.days.map((key) => {
              const appointments = grouped.get(key) || []
              if (view === 'list' && !appointments.length) return null
              return (
                <article
                  key={key}
                  className={`min-w-0 rounded-lg border p-2 ${key === clinicDayKey() ? 'border-primary bg-primary/5' : 'bg-card'}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <h3 className="text-xs font-medium">
                      {new Intl.DateTimeFormat('es-EC', {
                        timeZone: 'UTC',
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      }).format(new Date(key + 'T12:00:00Z'))}
                    </h3>
                    <button
                      aria-label={`Nueva cita ${key}`}
                      onClick={() => setEditor({ day: key })}
                      className="rounded p-1 hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-2">{appointments.map((item) => row(item, key))}</div>
                </article>
              )
            })}
          </div>
          {view === 'list' && !visible.length && <p>No hay citas en este periodo.</p>}
        </>
      )}
      {editor && (
        <AppointmentEditor
          key={`${scope}:${editor.appointment?.id || editor.day}`}
          open
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
          appointment={editor.appointment}
          initialDay={editor.day}
        />
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.patients?.first_name} {selected?.patients?.last_name}
            </DialogTitle>
            <DialogDescription>
              {selected &&
                `${dateLabel(clinicDayKey(selected.start_time))} · ${clinicTime(selected.start_time)}–${clinicTime(selected.end_time)} · ${APPOINTMENT_LABELS[selected.status]}`}
            </DialogDescription>
          </DialogHeader>
          <p>{selected?.type}</p>
          <p className="text-sm text-muted-foreground">
            {selected?.profiles?.full_name || 'Profesional no disponible'}
          </p>
          {user?.role !== 'receptionist' && selected?.notes && (
            <p className="whitespace-pre-wrap text-sm">{selected.notes}</p>
          )}
          {mutationError && (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {selected && ACTIVE_APPOINTMENT_STATUSES.includes(selected.status) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditor({ day: clinicDayKey(selected.start_time), appointment: selected })
                  setSelected(null)
                }}
              >
                Reprogramar
              </Button>
            )}
            {selected &&
              APPOINTMENT_TRANSITIONS[selected.status].map((status) => (
                <Button
                  key={status}
                  variant={status === 'cancelled' ? 'outline' : 'default'}
                  disabled={busy}
                  onClick={() => void changeStatus(status)}
                >
                  {APPOINTMENT_LABELS[status]}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
