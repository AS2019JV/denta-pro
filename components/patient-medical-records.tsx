"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OdontogramPreview } from "@/components/odontogram-preview"
import { clinicDate } from "@/lib/agenda.mjs"

interface Props { patientId: string; onOpenClinicalForm: () => void }

/** Read-only projection. Clinical writes use the versioned HCU workflow. */
export function PatientMedicalRecords({ patientId, onOpenClinicalForm }: Props) {
  const { user, currentClinicId, isRevalidating } = useAuth()
  const allowed = !isRevalidating && !!user?.id && !!currentClinicId && ["doctor", "clinic_owner"].includes(user.role)
  const scope = allowed ? `${currentClinicId}:${user?.id}:${user?.role}:${patientId}` : ""
  const currentScope = useRef(scope)
  currentScope.current = scope
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ scope: string; status: 'loading' | 'error' | 'ready'; row: any }>({ scope: '', status: 'loading', row: null })
  useEffect(() => {
    const controller = new AbortController()
    setResult({ scope, status: 'loading', row: null })
    if (!scope) return () => controller.abort()
    const load = async () => {
      try {
        const { data, error } = await supabase.from('hcu033_forms')
          .select('id,clinic_id,patient_id,doctor_id,created_at,form_data')
          .eq('clinic_id', currentClinicId!).eq('patient_id', patientId).is('deleted_at', null)
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .limit(1).abortSignal(controller.signal).maybeSingle()
        if (controller.signal.aborted || currentScope.current !== scope) return
        if (error || (data && (!data.form_data || typeof data.form_data !== 'object' || Array.isArray(data.form_data)))) throw new Error('Unavailable')
        setResult({ scope, status: 'ready', row: data })
      } catch {
        if (!controller.signal.aborted && currentScope.current === scope) setResult({ scope, status: 'error', row: null })
      }
    }
    void load()
    return () => controller.abort()
  }, [scope, currentClinicId, patientId, attempt])
  if (!allowed) return <p role="alert">No hay acceso clínico vigente.</p>
  if (result.scope !== scope || result.status === 'loading') return <p role="status">Cargando historia guardada…</p>
  if (result.status === 'error') return <div role="alert" className="space-y-3"><p>No se pudo cargar la historia guardada.</p><Button onClick={() => setAttempt(value => value + 1)}>Reintentar</Button></div>
  const row = result.row
  const form = row?.form_data
  const sessions = Array.isArray(form?.registro_sesiones) ? form.registro_sesiones : []
  const plans = Array.isArray(form?.plan_terapeutico) ? form.plan_terapeutico : []
  const antecedents = [
    ['ant_alergia_antibioticos', 'Alergia a antibióticos'], ['ant_alergia_anestesia', 'Alergia a anestesia'],
    ['ant_hemorragias', 'Hemorragias'], ['ant_diabetes', 'Diabetes'], ['ant_hipertension', 'Hipertensión'],
    ['ant_enf_cardiaca', 'Enfermedad cardíaca'], ['ant_asma', 'Asma'],
  ].filter(([key]) => form?.[key] === true).map(([, label]) => label)
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Historia clínica guardada</h2><p className="text-sm text-muted-foreground">Consulta y edita antecedentes, odontograma y evolución desde HCU-033.</p></div>
      <Button onClick={onOpenClinicalForm}>{row ? 'Abrir HCU-033' : 'Registrar primera HCU-033'}</Button>
    </div>
    {!row ? <p>Sin historia clínica registrada. No hay antecedentes, notas ni tratamientos precargados.</p> : <>
      <p className="text-sm text-muted-foreground">Último registro: {row.created_at ? clinicDate(row.created_at) : 'Fecha no registrada'}. {row.doctor_id === user?.id ? 'Guardado por tu cuenta.' : row.doctor_id ? 'Guardado por otro profesional autorizado.' : 'Autoría no registrada.'}</p>
      <Card><CardHeader><CardTitle>Antecedentes y alertas</CardTitle></CardHeader><CardContent className="space-y-2">
        <p>{antecedents.length ? antecedents.join(' · ') : 'Sin alertas positivas registradas. Esto no confirma ausencia de antecedentes.'}</p>
        <p className="whitespace-pre-wrap">{form.ant_otros || 'Otros antecedentes: sin registrar.'}</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Odontograma</CardTitle></CardHeader><CardContent>
        {form.odontograma_data && Object.keys(form.odontograma_data).length ? <OdontogramPreview data={form.odontograma_data} /> : <p>Sin odontograma registrado.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Evolución y sesiones</CardTitle></CardHeader><CardContent>
        {sessions.length ? <ol className="space-y-3">{sessions.map((session: any, index: number) => <li key={index} className="border-b pb-3">
          <p className="font-medium">{session.procedimiento || 'Procedimiento sin registrar'}</p>
          <p className="text-sm">{session.fecha?.slice(0, 16).replace('T', ' ') || 'Fecha sin registrar'}</p>
          <p className="whitespace-pre-wrap">{session.observaciones || 'Observaciones sin registrar'}</p>
        </li>)}</ol> : <p>Sin evolución registrada.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Plan de tratamiento</CardTitle></CardHeader><CardContent>
        {plans.length ? <ul className="space-y-2">{plans.map((plan: any, index: number) => <li key={index}>{plan.procedimiento || 'Procedimiento sin registrar'}{plan.dientes_involucrados ? ` · Piezas: ${plan.dientes_involucrados}` : ''}</li>)}</ul> : <p>Sin plan de tratamiento registrado.</p>}
      </CardContent></Card>
    </>}
  </div>
}
