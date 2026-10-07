export type PrivateMediaBucket = 'doctor-avatars' | 'patient-avatars' | 'clinic-branding' | 'patient-files'
export function privateMediaPath(raw: unknown, bucket: PrivateMediaBucket, supabaseUrl?: string): string | null
export function privateMediaUploadPath(bucket: PrivateMediaBucket, uid: string, clinicId: string | undefined, filename: string): string
