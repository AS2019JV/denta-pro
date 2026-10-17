import type { SupabaseClient } from '@supabase/supabase-js'
export type PrivateImageKind = 'doctor-avatar' | 'patient-avatar' | 'clinic-logo'
export type PrivateImageBucket = 'doctor-avatars' | 'patient-avatars' | 'clinic-branding'
export type PrivateImageScope = { kind: PrivateImageKind; clinicId: string; entityId: string }
export type PrivateImageAuthority = { userId: string; sessionId: string; path: string }
export const PRIVATE_IMAGE_BUCKETS: Readonly<Record<PrivateImageKind, PrivateImageBucket>>
export const PRIVATE_IMAGE_HEADERS: Readonly<Record<string, string>>
export function ordinaryPrivateMediaAuthority(client: SupabaseClient, bearer: string | null, signal: AbortSignal, providerOrigin: string): {
  authorize(scope: PrivateImageScope): Promise<PrivateImageAuthority | null>
}
export function privateMediaDeliveryHandler(dependencies: {
  appOrigin: string; providerOrigin: string
  authority(request: Request, bearer: string | null, signal: AbortSignal): Promise<{ authorize(scope: PrivateImageScope): Promise<PrivateImageAuthority | null> }>
  download(bucket: PrivateImageBucket, path: string, signal: AbortSignal): Promise<Response>
}): (request: Request) => Promise<Response>
