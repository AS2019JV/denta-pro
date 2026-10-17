'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export type PendingInvitation = { id: string; email: string; role: 'doctor' | 'receptionist'; expires_at: string }
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

async function ownerClient(clinicId: string) {
  if (!uuid.test(clinicId)) throw new Error('Solicitud no válida.')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !service) throw new Error('No se pudo comprobar el acceso.')
  const store = await cookies()
  const ordinary = createServerClient(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll: values => values.forEach(({ name, value, options }) => store.set(name, value, options)),
  } })
  const identity = await ordinary.auth.getUser()
  if (identity.error || !identity.data.user?.email_confirmed_at) throw new Error('Sesión no válida.')
  // Canonical RPC requires a live session/profile/clinic/member and verified MFA.
  const role = await ordinary.rpc('get_clinic_member_role', { check_clinic_id: clinicId })
  if (role.error || role.data !== 'clinic_owner') throw new Error('Acceso denegado.')
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function listPendingClinicInvitations(clinicId: string): Promise<{ success: true; invitations: PendingInvitation[] } | { success: false; error: string }> {
  try {
    const admin = await ownerClient(clinicId)
    // Explicit projection: no token/hash/URL or caller-selected columns.
    const result = await admin.from('clinic_invitations').select('id,email,role,expires_at')
      .eq('clinic_id', clinicId).eq('status', 'pending').order('created_at', { ascending: false }).limit(100)
    if (result.error || !Array.isArray(result.data)) return { success: false, error: 'No se pudieron consultar las invitaciones.' }
    return { success: true, invitations: result.data.map(({ id, email, role, expires_at }) => ({ id, email, role, expires_at })) }
  } catch { return { success: false, error: 'No se pudo validar el acceso a las invitaciones.' } }
}

export async function revokeClinicInvitation(clinicId: string, invitationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!uuid.test(invitationId)) return { success: false, error: 'Solicitud no válida.' }
    const admin = await ownerClient(clinicId)
    // Existing terminal status; no membership/identity/factor or expiry-clock mutation.
    // The row lock serializes with redemption: an already accepted invite cannot be revoked here.
    const result = await admin.from('clinic_invitations').update({ status: 'expired' })
      .eq('id', invitationId).eq('clinic_id', clinicId).eq('status', 'pending').select('id').maybeSingle()
    if (result.error) return { success: false, error: 'No se pudo confirmar la revocación. Revisa el estado antes de repetir.' }
    if (!result.data) return { success: false, error: 'La invitación ya no está pendiente o no pertenece a esta clínica.' }
    return { success: true }
  } catch { return { success: false, error: 'No se pudo validar el acceso a la invitación.' } }
}
