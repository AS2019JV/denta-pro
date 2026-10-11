'use client'

import { useEffect, useRef, useState } from 'react'
import { listPendingClinicInvitations, revokeClinicInvitation } from '@/app/actions/manage-invitations'
import type { PendingInvitation } from '@/app/actions/manage-invitations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PendingInvitations({ clinicId, revision }: { clinicId: string; revision: number }) {
  const [rows, setRows] = useState<PendingInvitation[]>([])
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PendingInvitation | null>(null)
  const [working, setWorking] = useState(false)
  const [reload, setReload] = useState(0)
  const mutation = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let current = true
    setLoading(true)
    setRows([])
    setError('')
    void listPendingClinicInvitations(clinicId).then(result => {
      if (!current) return
      if (result.success) setRows(result.invitations)
      else setError(result.error)
    }).catch(() => { if (current) setError('No se pudieron consultar las invitaciones.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [clinicId, revision, reload])

  const revoke = async () => {
    if (!selected || mutation.current) return
    mutation.current = true
    setWorking(true)
    setActionError('')
    try {
      const result = await revokeClinicInvitation(clinicId, selected.id)
      if (!mounted.current) return
      if (!result.success) setActionError(result.error || 'No se pudo confirmar la revocación.')
    } catch {
      if (mounted.current) setActionError('No se pudo confirmar la revocación. Actualiza el estado antes de repetir.')
    } finally {
      mutation.current = false
      if (mounted.current) { setWorking(false); setSelected(null); setReload(value => value + 1) }
    }
  }

  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Invitaciones pendientes">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">Invitaciones pendientes</h2>
      <Button variant="outline" size="sm" disabled={loading || working} onClick={() => setReload(value => value + 1)}>Actualizar invitaciones</Button>
    </div>
    {error && <p role="alert">{error}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {loading ? <p role="status">Consultando invitaciones…</p> : rows.length ? <ul className="space-y-3">
      {rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3">
        <div><p>{row.email}</p><p className="text-sm text-muted-foreground">{row.role === 'receptionist' ? 'Recepción' : 'Doctor'} · Vence {new Date(row.expires_at).toLocaleDateString('es-EC')}</p></div>
        <Button variant="outline" disabled={working} onClick={() => setSelected(row)}>Revocar invitación</Button>
      </li>)}
    </ul> : !error && <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>}
    {rows.length === 100 && <p className="text-sm">Se muestran las últimas 100 invitaciones pendientes.</p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!working && !open) setSelected(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>¿Revocar esta invitación?</DialogTitle><DialogDescription>El enlace de {selected?.email} ya no permitirá unirse a esta clínica. Las membresías ya aceptadas se gestionan desde el equipo.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={working} onClick={() => setSelected(null)}>Volver</Button><Button disabled={working} onClick={() => void revoke()}>{working ? 'Revocando…' : 'Confirmar revocación'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
