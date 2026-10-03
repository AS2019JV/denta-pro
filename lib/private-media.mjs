export const PRIVATE_MEDIA_TTL = 300
const buckets = new Set(['doctor-avatars', 'patient-avatars', 'clinic-branding', 'patient-files'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Stored URLs are converted to object paths only for this exact Supabase origin.
// Legacy flat avatars and arbitrary external URLs require a separate migration.
export function privateMediaPath(raw, bucket, supabaseUrl) {
  if (!buckets.has(bucket) || typeof raw !== 'string' || !raw || raw.includes('\\') || raw.includes('..')) return null
  let value = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw), configured = new URL(supabaseUrl)
      if (url.origin !== configured.origin || url.username || url.password) return null
      const prefixes = ['object', 'render/image'].flatMap(kind => ['public', 'sign', 'authenticated'].map(access => `/storage/v1/${kind}/${access}/${bucket}/`))
      const prefix = prefixes.find(prefix => url.pathname.startsWith(prefix))
      if (!prefix) return null
      value = decodeURIComponent(url.pathname.slice(prefix.length))
    } catch { return null }
  }
  if (/[\\?#\x00-\x1f]/.test(value) || value.includes('..') || /%[0-9a-f]{2}/i.test(value)) return null
  const parts = value.split('/'), patient = bucket === 'patient-files' || bucket === 'patient-avatars'
  if (parts.length !== (patient ? 3 : 2) || !uuid.test(parts[0]) || (patient && !uuid.test(parts[1])) || !parts.at(-1)) return null
  return value
}

export function privateMediaUploadPath(bucket, uid, clinicId, filename) {
  const value = bucket === 'patient-avatars' ? `${clinicId}/${uid}/${filename}` : `${uid}/${filename}`
  const path = privateMediaPath(value, bucket)
  if (!path) throw new Error('Ruta de imagen privada no válida.')
  return path
}

export async function resolvePrivateMedia(client, bucket, raw, supabaseUrl, isCurrent = () => true) {
  const path = privateMediaPath(raw, bucket, supabaseUrl)
  if (!path || !isCurrent()) return null
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, PRIVATE_MEDIA_TTL)
    if (!isCurrent() || error || !data?.signedUrl) return null
    // Reject malformed/unexpected provider URLs rather than passing them to img/PDF.
    const signed = new URL(data.signedUrl), configured = new URL(supabaseUrl)
    if (signed.origin !== configured.origin || privateMediaPath(data.signedUrl, bucket, supabaseUrl) !== path) return null
    return data.signedUrl
  } catch { return null }
}
