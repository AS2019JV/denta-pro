export const CLINIC_PREFERENCE_COOKIE: string
export const CLINIC_ROLES: readonly string[]
export type ClinicRole = 'clinic_owner' | 'doctor' | 'receptionist'
export function selectClinicMembership<T extends {clinic_id: string; role: string; status: string}>(profile: {status: string; deleted_at?: string | null; clinic_id?: string | null} | null, memberships: T[], preferredClinic?: string): T | null
