export const CLINIC_PREFERENCE_COOKIE = 'clinia-clinic'
export const CLINIC_ROLES = ['clinic_owner', 'doctor', 'receptionist']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A preferred clinic is navigation state, never an authority grant.
export function selectClinicMembership(profile, memberships, preferredClinic) {
  if (!profile || profile.status !== 'active' || profile.deleted_at != null) return null
  const active = memberships.filter(m => m.status === 'active' && uuid.test(m.clinic_id) && CLINIC_ROLES.includes(m.role))
  return active.find(m => m.clinic_id === preferredClinic)
    ?? active.find(m => m.clinic_id === profile.clinic_id)
    ?? active.slice().sort((a, b) => a.clinic_id.localeCompare(b.clinic_id))[0]
    ?? null
}
