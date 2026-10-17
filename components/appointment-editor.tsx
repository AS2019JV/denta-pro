'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/auth-context'
import { AsyncPatientSelect } from '@/components/async-patient-select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import {
  clinicDayKey,
  clinicTime,
  clinicDateTimeToInstant,
  loadClinicians,
  saveAppointment,
  editorStatuses,
  APPOINTMENT_LABELS,
  type AgendaAppointment,
} from '@/lib/agenda.mjs'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: AgendaAppointment | null
  patientId?: string
  patientName?: string
  initialDay?: string
  onSuccess?: () => void
}
export function AppointmentEditor({
  open,
  onOpenChange,
  appointment,
  patientId: fixedPatient,
  patientName,
  initialDay,
  onSuccess,
}: Props) {
  const { user, currentClinicId, isLoading, authError } = useAuth()
  const queryClient = useQueryClient()
  const scope = `${currentClinicId}:${user?.id}:${user?.role}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const allowed = !!currentClinicId && !!user && !isLoading && !authError
  const clinicians = useQuery({
    queryKey: ['agenda', 'clinicians', scope],
    enabled: open && allowed,
    retry: false,
    staleTime: 60_000,
    queryFn: ({ signal }) => loadClinicians(supabase, currentClinicId!, signal),
  })
  const [patientId, setPatientId] = useState(fixedPatient || appointment?.patient_id || '')
  const [doctorId, setDoctorId] = useState(appointment?.doctor_id || '')
  const [day, setDay] = useState(
    appointment ? clinicDayKey(appointment.start_time) : initialDay || clinicDayKey(),
  )
  const [time, setTime] = useState(appointment ? clinicTime(appointment.start_time) : '09:00')
  const [duration, setDuration] = useState(
    appointment
      ? Math.round((Date.parse(appointment.end_time) - Date.parse(appointment.start_time)) / 60_000)
      : 30,
  )
  const [type, setType] = useState(appointment?.type || 'Consulta odontológica')
  const [status, setStatus] = useState(appointment?.status || 'scheduled')
  const [notes, setNotes] = useState(appointment?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!doctorId && clinicians.data?.length)
      setDoctorId(clinicians.data.find((d) => d.id === user?.id)?.id || clinicians.data[0].id)
  }, [clinicians.data, doctorId, user?.id])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!allowed || !patientId || !clinicians.data?.some((d) => d.id === doctorId)) {
      setError('Selecciona paciente y odontólogo activo.')
      return
    }
    const requestScope = scopeRef.current
    try {
      setSaving(true)
      if (!Number.isInteger(duration) || duration < 5 || duration > 480)
        throw Error('La duración debe ser de 5 a 480 minutos.')
      const start = clinicDateTimeToInstant(day, time),
        end = new Date(Date.parse(start) + duration * 60_000).toISOString()
      await saveAppointment(
        supabase,
        currentClinicId!,
        {
          patient_id: patientId,
          doctor_id: doctorId,
          start_time: start,
          end_time: end,
          type: type.trim(),
          status,
          ...(user?.role !== 'receptionist' ? { notes } : {}),
        },
        appointment?.id || null,
        user!.role,
      )
      if (scopeRef.current !== requestScope) return
      await queryClient.invalidateQueries({ queryKey: ['agenda', 'schedule', scope] })
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', 'appointments', currentClinicId, user?.id, user?.role],
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      if (scopeRef.current === requestScope)
        setError(err instanceof Error ? err.message : 'No se pudo guardar la cita.')
    } finally {
      if (scopeRef.current === requestScope) setSaving(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Reprogramar cita' : 'Nueva cita'}</DialogTitle>
          <DialogDescription>
            Horario de Ecuador continental · America/Guayaquil. {patientName || ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            {!fixedPatient && !appointment && (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <AsyncPatientSelect value={patientId} onValueChange={setPatientId} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="appointment-doctor">Odontólogo</Label>
              <select
                id="appointment-doctor"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                disabled={saving || clinicians.isPending}
              >
                <option value="">Selecciona odontólogo</option>
                {clinicians.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
              {clinicians.isError && (
                <p role="alert" className="text-sm text-destructive">
                  No se pudieron cargar los profesionales.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void clinicians.refetch()}
                  >
                    Reintentar
                  </button>
                </p>
              )}
              {clinicians.isSuccess && !clinicians.data.length && (
                <p role="alert" className="text-sm">
                  No hay odontólogos activos disponibles. Contacta al administrador.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="appointment-day">Fecha</Label>
                <Input
                  id="appointment-day"
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  required
                  min="2000-01-01"
                  max="2099-12-31"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-time">Hora</Label>
                <Input
                  id="appointment-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="appointment-duration">Duración (minutos)</Label>
                <Input
                  id="appointment-duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-status">Estado</Label>
                <select
                  id="appointment-status"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  {editorStatuses(appointment?.status).map((value) => (
                    <option key={value} value={value}>
                      {APPOINTMENT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-type">Motivo de la cita</Label>
              <Input
                id="appointment-type"
                value={type}
                maxLength={120}
                onChange={(e) => setType(e.target.value)}
                required
              />
            </div>
            {user?.role !== 'receptionist' && (
              <div className="space-y-2">
                <Label htmlFor="appointment-notes">Notas clínicas</Label>
                <Textarea
                  id="appointment-notes"
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !allowed || !clinicians.data?.length}>
                {saving ? 'Guardando…' : 'Guardar cita'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
