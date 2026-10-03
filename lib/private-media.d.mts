export type PrivateMediaBucket = 'doctor-avatars' | 'patient-avatars' | 'clinic-branding' | 'patient-files'
export const PRIVATE_MEDIA_TTL: number
export function privateMediaPath(raw: unknown, bucket: PrivateMediaBucket, supabaseUrl?: string): string | null
export function privateMediaUploadPath(bucket: PrivateMediaBucket, uid: string, clinicId: string | undefined, filename: string): string
export function resolvePrivateMedia(client: { storage: { from(bucket: string): { createSignedUrl(path: string, expiresIn: number): PromiseLike<{ data: { signedUrl: string } | null; error: unknown }> } } }, bucket: PrivateMediaBucket, raw: unknown, supabaseUrl: string | undefined, isCurrent?: () => boolean): Promise<string | null>
