"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { demographicForm, demographicPayload, demographicSaveError, loadDemographicPage, saveDemographic } from "@/lib/patient-demographics.mjs"
import type { DemographicField, DemographicForm, DemographicPatient } from "@/lib/patient-demographics.mjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/page-header"
import { Loader2, Plus, Search, Pencil } from "lucide-react"

const PAGE_SIZE = 12
const fields: { key: DemographicField; label: string; type?: string }[] = [
  { key: "first_name", label: "Nombre" }, { key: "last_name", label: "Apellido" },
  { key: "cedula", label: "Cédula / identificación" }, { key: "medical_record_number", label: "Número de historia" },
  { key: "email", label: "Correo electrónico", type: "email" }, { key: "phone", label: "Teléfono" },
  { key: "birth_date", label: "Fecha de nacimiento", type: "date" }, { key: "gender", label: "Género" },
  { key: "address", label: "Dirección" }, { key: "city", label: "Ciudad" }, { key: "state", label: "Provincia" },
  { key: "occupation", label: "Ocupación" }, { key: "marital_status", label: "Estado civil" },
  { key: "emergency_contact", label: "Contacto de emergencia" }, { key: "emergency_phone", label: "Teléfono de emergencia" }
]

export default function PatientsPage() {
  const { user, currentClinicId, isLoading: authLoading, authError } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const authorized = !authLoading && !authError && !!currentClinicId && !!user?.id &&
    ["doctor", "clinic_owner", "receptionist"].includes(user.role)
  const clinical = user?.role === "doctor" || user?.role === "clinic_owner"
  const scope = authorized ? `${currentClinicId}:${user?.id}:${user?.role}` : ""
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const saveController = useRef<AbortController | null>(null)
  const flagOpened = useRef(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(0)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{ key: string; items: DemographicPatient[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [dialogScope, setDialogScope] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DemographicForm>(() => demographicForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [notice, setNotice] = useState("")
  const queryKey = `${scope}:${debouncedSearch}:${page}`
  const queryRef = useRef(queryKey)
  queryRef.current = queryKey
  const wantsNew = searchParams.get("new") === "1"

  useEffect(() => {
    saveController.current?.abort()
    setSearch(""); setDebouncedSearch(""); setPage(0); setResult(null)
    setDialogScope(""); setEditingId(null); setForm(demographicForm())
    setSaveError(""); setSaving(false); setNotice("")
    flagOpened.current = false
    return () => { saveController.current?.abort() }
  }, [scope])

  useEffect(() => {
    if (!scope) return
    if (wantsNew && !flagOpened.current) {
      flagOpened.current = true
      setEditingId(null); setForm(demographicForm()); setSaveError(""); setDialogScope(scope)
    } else if (!wantsNew && flagOpened.current) {
      flagOpened.current = false
      saveController.current?.abort()
      setDialogScope(""); setSaving(false)
    }
  }, [scope, wantsNew])

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search, scope])

  useEffect(() => {
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && scopeRef.current === scope && queryRef.current === queryKey
    setLoadError(false)
    setLoading(!!scope)
    if (!scope || !currentClinicId) return () => controller.abort()
    const load = async () => {
      try {
        const response = await loadDemographicPage(supabase, currentClinicId, debouncedSearch, page, PAGE_SIZE, controller.signal)
        if (!current() || !response) return
        const lastPage = Math.max(0, Math.ceil(response.total_count / PAGE_SIZE) - 1)
        if (page > lastPage) { setPage(lastPage); return }
        setResult({ key: queryKey, items: response.items, total: response.total_count })
      } catch { if (current()) { setLoadError(true); setResult(null) } }
      finally { if (current()) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [scope, currentClinicId, queryKey, debouncedSearch, page, reload])

  const clearNewFlag = () => {
    if (!wantsNew) return
    const query = new URLSearchParams(searchParams.toString())
    query.delete("new")
    router.replace(`/patients${query.size ? "?" + query.toString() : ""}`, { scroll: false })
  }
  const closeDialog = () => {
    if (saving) return
    setDialogScope(""); setSaveError(""); flagOpened.current = false
    clearNewFlag()
  }
  const openPatient = (patient: DemographicPatient | null) => {
    if (!scope) return
    setEditingId(patient?.id ?? null); setForm(demographicForm(patient))
    setSaveError(""); setDialogScope(scope)
  }
  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!scope || !currentClinicId || saving || dialogScope !== scope || (saveController.current && !saveController.current.signal.aborted)) return
    try { demographicPayload(form) } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Revisa los datos."); return
    }
    const controller = new AbortController()
    saveController.current?.abort()
    saveController.current = controller
    const current = () => !controller.signal.aborted && scopeRef.current === scope
    setSaving(true); setSaveError("")
    try {
      const saved = await saveDemographic(supabase, currentClinicId, form, editingId, controller.signal)
      if (!current() || !saved) return
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "patients", currentClinicId, user!.id, user!.role], exact: true })
      setDialogScope(""); flagOpened.current = false; clearNewFlag()
      setNotice(editingId ? "Datos del paciente actualizados." : "Paciente creado.")
      setReload(value => value + 1)
    } catch (error) { if (current()) setSaveError(demographicSaveError(error)) }
    finally { if (current()) { setSaving(false); saveController.current = null } }
  }

  const visible = result?.key === queryKey ? result : null
  const pending = search.trim() !== debouncedSearch
  const ready = authorized && !loading && !!visible && !pending && !loadError
  const open = !!scope && dialogScope === scope
  const pages = visible ? Math.max(1, Math.ceil(visible.total / PAGE_SIZE)) : 1

  return <div className="p-6 space-y-6">
    <PageHeader title="Pacientes" description="Datos personales y de contacto">
      <Button disabled={!authorized} onClick={() => openPatient(null)}><Plus className="h-4 w-4 mr-2" />Nuevo paciente</Button>
    </PageHeader>
    {authLoading ? <p role="status">Verificando acceso…</p> : !authorized ?
      <p role="alert">No se pudo verificar el acceso a esta clínica.</p> : <>
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar pacientes" placeholder="Buscar por nombre, cédula o contacto" className="pl-9"
            value={search} maxLength={200} onChange={event => setSearch(event.target.value)} />
        </div>
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {loadError ? <div role="alert" className="space-y-3">
          <p>No se pudieron cargar los pacientes.</p><Button onClick={() => setReload(value => value + 1)}>Reintentar</Button>
        </div> : !ready ? <div role="status" className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" />Cargando pacientes…</div> :
          visible!.items.length === 0 ? <p className="py-8 text-muted-foreground">No hay pacientes que coincidan con esta búsqueda.</p> :
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible!.items.map(patient => <Card key={patient.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between gap-3">
                  <h2 className="font-semibold">{patient.first_name} {patient.last_name}</h2>
                  <Badge variant={patient.status === "active" ? "default" : "secondary"}>{patient.status === "active" ? "Activo" : "Inactivo"}</Badge>
                </div>
                <dl className="text-sm space-y-1 text-muted-foreground">
                  <div><dt className="inline">Cédula: </dt><dd className="inline">{patient.cedula || "No registrada"}</dd></div>
                  <div><dt className="inline">Teléfono: </dt><dd className="inline">{patient.phone || "No registrado"}</dd></div>
                  <div><dt className="inline">Correo: </dt><dd className="inline break-all">{patient.email || "No registrado"}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openPatient(patient)}><Pencil className="h-3 w-3 mr-2" />Editar datos</Button>
                  {clinical && <Button size="sm" onClick={() => router.push(`/patients/${patient.id}`)}>Ficha clínica</Button>}
                </div>
              </CardContent>
            </Card>)}
          </div>}
        {visible && <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{visible.total} pacientes · Página {page + 1} de {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!ready || page === 0} onClick={() => setPage(value => value - 1)}>Anterior</Button>
            <Button variant="outline" disabled={!ready || page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
          </div>
        </div>}
      </>}
    <Dialog open={open} onOpenChange={value => { if (!value) closeDialog() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? "Editar datos del paciente" : "Nuevo paciente"}</DialogTitle>
          <DialogDescription>Información personal y de contacto.</DialogDescription></DialogHeader>
        <form onSubmit={handleSave} className="space-y-5">
          <fieldset disabled={saving} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(field => <div key={field.key} className="space-y-2">
              <Label htmlFor={`patient-${field.key}`}>{field.label}</Label>
              <Input id={`patient-${field.key}`} type={field.type || "text"} value={form[field.key]}
                required={field.key === "first_name" || field.key === "last_name"} maxLength={["first_name", "last_name"].includes(field.key) ? 120 : 500}
                onChange={event => setForm(previous => ({ ...previous, [field.key]: event.target.value }))} />
            </div>)}
            <div className="space-y-2"><Label htmlFor="patient-status">Estado</Label>
              <select id="patient-status" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.status}
                onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}>
                <option value="active">Activo</option><option value="inactive">Inactivo</option>
              </select></div>
            <div className="space-y-2"><Label htmlFor="patient-contact">Contacto preferido</Label>
              <select id="patient-contact" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.preferred_contact_method}
                onChange={event => setForm(previous => ({ ...previous, preferred_contact_method: event.target.value }))}>
                <option value="phone">Teléfono</option><option value="email">Correo</option><option value="whatsapp">WhatsApp</option>
              </select></div>
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={closeDialog}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar paciente"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
