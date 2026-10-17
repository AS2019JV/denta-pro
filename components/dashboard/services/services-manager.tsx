"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Treatment {
  id: string
  clinic_id: string
  name: string
  description: string | null
  duration_minutes: number
  is_active: boolean
  color: string | null
}
const PAGE_SIZE = 50
const COLUMNS = "id,clinic_id,name,description,duration_minutes,is_active,color"

export function ServicesManager() {
  const { currentClinicId, user, isLoading, isRevalidating, authError } = useAuth()
  const queryClient = useQueryClient()
  const [draftSearch, setDraftSearch] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Treatment | null>(null)
  const [saving, setSaving] = useState(false)
  const publication = useRef({ valid: false })
  if (isRevalidating) publication.current.valid = false
  const scope = `${currentClinicId || ""}:${user?.id || ""}:${user?.role || ""}`
  const canEdit = user?.role === "clinic_owner"
  useEffect(() => {
    const token = { valid: !isRevalidating }
    publication.current = token
    return () => { token.valid = false }
  }, [scope, isLoading, isRevalidating, authError])
  useEffect(() => {
    setEditing(null); setSaving(false); setPage(0); setSearch(""); setDraftSearch("")
  }, [scope, isLoading, authError])
  const query = useQuery({
    queryKey: ["operational-treatments", scope, page, search],
    enabled: !!currentClinicId && !!user && !isLoading && !authError,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      let request = supabase.from("services").select(COLUMNS, { count: "exact" })
        .eq("clinic_id", currentClinicId!).order("name").order("id")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (search) request = request.ilike("name", `%${search}%`)
      const { data, error, count } = await request.abortSignal(signal)
      if (error || count === null || !data || data.some(item => item.clinic_id !== currentClinicId)) throw new Error("No se pudo cargar el catálogo")
      return { items: data as Treatment[], total: count }
    },
  })
  const save = async () => {
    if (!editing || !currentClinicId || !canEdit || saving || isRevalidating) return
    const submitted = editing
    const generation = publication.current
    if (!submitted.name.trim() || submitted.name.trim().length > 120 ||
      !Number.isInteger(submitted.duration_minutes) || submitted.duration_minutes < 5 || submitted.duration_minutes > 480 ||
      (submitted.description || "").length > 2000) {
      toast.error("Revisa el nombre y la duración (5 a 480 minutos)"); return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.from("services").update({
        name: submitted.name.trim(), description: submitted.description?.trim() || null,
        duration_minutes: submitted.duration_minutes, is_active: submitted.is_active,
      }).eq("id", submitted.id).eq("clinic_id", currentClinicId).select("id").maybeSingle()
      if (!generation.valid) return
      if (error || data?.id !== submitted.id) throw new Error("El cambio no se confirmó")
      toast.success("Tratamiento actualizado")
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ["operational-treatments", scope] })
    } catch { if (generation.valid) toast.error("No se pudo guardar. Conservamos tus cambios para reintentar.") }
    finally { setSaving(false) }
  }
  if (isLoading || !user || !currentClinicId) return <p role="status">Verificando acceso…</p>
  return <div className="space-y-5">
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSearch(draftSearch.trim()); setPage(0) }}>
      <Label htmlFor="treatment-search" className="sr-only">Buscar tratamiento</Label>
      <Input id="treatment-search" className="min-w-0 flex-1" maxLength={120} value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder="Buscar tratamiento" />
      <Button type="submit" variant="outline">Buscar</Button>
    </form>
    <p className="text-sm text-muted-foreground">El motivo y tipo de cita se registran directamente en la agenda. Este catálogo conserva las duraciones de referencia.</p>
    {query.isPending ? <p role="status">Cargando tratamientos…</p> : query.isError ? <div role="alert" className="space-y-2"><p>No se pudo cargar el catálogo.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : <>
      {query.data.items.length === 0 ? <p className="py-8 text-muted-foreground">No hay tratamientos para esta búsqueda.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.items.map(item => <Card key={item.id}><CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2"><h2 className="min-w-0 break-words font-semibold">{item.name}</h2><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Activo" : "Archivado"}</Badge></div>
          {item.description && <p className="break-words text-sm text-muted-foreground">{item.description}</p>}
          <p className="text-sm">Duración: {item.duration_minutes} minutos</p>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing({ ...item })} aria-label={`Editar ${item.name}`}>Editar</Button>}
        </CardContent></Card>)}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>{query.data.total} tratamientos · Página {page + 1}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>Anterior</Button><Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= query.data.total || query.isFetching} onClick={() => setPage(value => value + 1)}>Siguiente</Button></div>
      </div>
    </>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !saving) setEditing(null) }}>
      <DialogContent><DialogHeader><DialogTitle>Editar tratamiento</DialogTitle><DialogDescription>Actualiza el nombre, duración o estado del catálogo.</DialogDescription></DialogHeader>
        {editing && <form onSubmit={event => { event.preventDefault(); void save() }}><fieldset disabled={saving} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="treatment-name">Nombre</Label><Input id="treatment-name" value={editing.name} maxLength={120} required onChange={event => setEditing({ ...editing, name: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="treatment-duration">Duración en minutos</Label><Input id="treatment-duration" type="number" min={5} max={480} step={1} required value={editing.duration_minutes} onChange={event => setEditing({ ...editing, duration_minutes: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="treatment-description">Descripción</Label><Input id="treatment-description" value={editing.description || ""} maxLength={2000} onChange={event => setEditing({ ...editing, description: event.target.value })} /></div>
          <div className="flex items-center gap-3"><Switch id="treatment-active" checked={editing.is_active} onCheckedChange={value => setEditing({ ...editing, is_active: value })} /><Label htmlFor="treatment-active">Tratamiento activo</Label></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">{saving ? "Guardando…" : "Guardar"}</Button></DialogFooter>
        </fieldset></form>}
      </DialogContent>
    </Dialog>
  </div>
}
