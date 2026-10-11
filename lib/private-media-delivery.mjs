import { boundedBytes } from './bounded-stream.mjs'
import { privateMediaPath } from './private-media.mjs'
import { CLINICAL_MEDIA_LIMIT } from './clinical-media-limits.mjs'
import { privateImageMime } from './private-image-mime.mjs'

export const PRIVATE_IMAGE_BUCKETS = Object.freeze({
  'doctor-avatar': 'doctor-avatars', 'patient-avatar': 'patient-avatars', 'clinic-logo': 'clinic-branding',
})
export const PRIVATE_IMAGE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache', 'Expires': '0', 'Vary': 'Authorization, Cookie',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; sandbox",
})
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const roles = ['doctor', 'clinic_owner', 'receptionist']

// Ordinary caller credentials are the sole authority. Directory/demographic
// projections preserve their narrow RLS contracts for colleagues/receptionists.
export function ordinaryPrivateMediaAuthority(client, bearer, signal, providerOrigin) {
  let pinnedIdentity = null
  return { authorize: async scope => {
    signal.throwIfAborted()
    const identity = bearer ? await client.auth.getUser(bearer) : await client.auth.getUser()
    if (identity.error || !identity.data.user) return null
    let claims
    try { claims = bearer ? await client.auth.getClaims(bearer) : await client.auth.getClaims() }
    catch { signal.throwIfAborted(); return null }
    const uid = identity.data.user.id, sessionId = claims.data?.claims.session_id
    if (claims.error || claims.data?.claims.role !== 'authenticated' || claims.data?.claims.sub !== uid
      || !uuid.test(uid) || typeof sessionId !== 'string' || !uuid.test(sessionId)
      || !Number.isFinite(claims.data?.claims.exp) || claims.data.claims.exp <= Date.now() / 1000) return null
    const key = `${uid}:${sessionId}`
    if (pinnedIdentity !== null && pinnedIdentity !== key) return null
    pinnedIdentity = key
    const [live, profile, role, subscription] = await Promise.all([
      client.rpc('clinia_session_active'),
      client.from('profiles').select('id').eq('id', uid).eq('status', 'active').is('deleted_at', null).maybeSingle(),
      client.rpc('get_clinic_member_role', { check_clinic_id: scope.clinicId }),
      client.rpc('check_subscription_active', { check_clinic_id: scope.clinicId }),
    ])
    if (live.error || live.data !== true || profile.error || !profile.data || role.error || !roles.includes(role.data)
      || subscription.error || subscription.data !== true) return null
    let reference
    if (scope.kind === 'doctor-avatar') {
      const directory = await client.rpc('get_clinic_staff_directory', { p_clinic_id: scope.clinicId })
      if (directory.error || !Array.isArray(directory.data)) return null
      const matches = directory.data.filter(member => member.id === scope.entityId && ['doctor', 'clinic_owner'].includes(member.role))
      if (matches.length !== 1) return null
      reference = matches[0].avatar_url
    } else if (scope.kind === 'patient-avatar') {
      const patients = await client.rpc('get_patient_demographics', {
        p_clinic_id: scope.clinicId, p_patient_id: scope.entityId, p_search: '', p_limit: 1, p_offset: 0,
      })
      if (patients.error || !Array.isArray(patients.data?.items) || patients.data.items.length !== 1) return null
      const patient = patients.data.items[0]
      if (patient.id !== scope.entityId || patient.clinic_id !== scope.clinicId) return null
      reference = patient.avatar_url
    } else {
      if (scope.entityId !== scope.clinicId) return null
      const clinic = await client.from('clinics').select('id,logo_url').eq('id', scope.clinicId).maybeSingle()
      if (clinic.error || clinic.data?.id !== scope.clinicId) return null
      reference = clinic.data.logo_url
    }
    const bucket = PRIVATE_IMAGE_BUCKETS[scope.kind], path = privateMediaPath(reference, bucket, providerOrigin)
    const prefix = scope.kind === 'patient-avatar' ? `${scope.clinicId}/${scope.entityId}/` : `${scope.entityId}/`
    if (!path || !path.startsWith(prefix)) return null
    // Keep the current Storage entitlement as an additional bound when the
    // transport is replaced. This wrapper grants no row/object capability.
    const allowed = await client.rpc('encargo02_storage_access', { p_bucket: bucket, p_name: path, p_write: false })
    if (allowed.error || allowed.data !== true) return null
    signal.throwIfAborted()
    return { userId: uid, sessionId, path }
  } }
}

// Per-process bound includes requests still reading their JSON body.
let inFlight = 0
export function privateMediaDeliveryHandler(dependencies) {
  const origin = new URL(dependencies.appOrigin).origin
  return async request => {
    const denied = status => new Response('No se pudo entregar la imagen.', { status, headers: PRIVATE_IMAGE_HEADERS })
    if (request.method !== 'POST') return denied(405)
    if (['range','if-range','if-none-match','if-modified-since'].some(header => request.headers.has(header))) return denied(400)
    const header = request.headers.get('authorization')
    const bearer = header === null ? null : /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header)?.[1]
    if (header !== null && !bearer) return denied(401)
    if (request.headers.get('origin') !== origin && (!bearer || request.headers.has('origin'))) return denied(403)
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return denied(400)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
    let acquired = false
    try {
      if (inFlight >= 4) return denied(429)
      inFlight++; acquired = true
      let scope
      try { scope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBytes(request.body, 512, signal))) }
      catch { signal.throwIfAborted(); return denied(400) }
      if (!scope || Array.isArray(scope) || Object.keys(scope).sort().join(',') !== 'clinicId,entityId,kind'
        || typeof scope.kind !== 'string' || !Object.hasOwn(PRIVATE_IMAGE_BUCKETS, scope.kind) || !uuid.test(scope.clinicId) || !uuid.test(scope.entityId)
        || typeof scope.clinicId !== 'string' || typeof scope.entityId !== 'string') return denied(400)
      const authority = await dependencies.authority(request, bearer, signal)
      const before = await authority.authorize(scope)
      if (!before) return denied(404)
      const bucket = PRIVATE_IMAGE_BUCKETS[scope.kind]
      const path = privateMediaPath(before.path, bucket, dependencies.providerOrigin)
      const prefix = scope.kind === 'patient-avatar' ? `${scope.clinicId}/${scope.entityId}/` : `${scope.entityId}/`
      if (!path || !path.startsWith(prefix) || (scope.kind === 'clinic-logo' && scope.entityId !== scope.clinicId)) return denied(404)
      const upstream = await dependencies.download(bucket, path, signal)
      if (upstream.status !== 200 || !upstream.body) { await upstream.body?.cancel(); return denied(503) }
      const length = upstream.headers.get('content-length')
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > CLINICAL_MEDIA_LIMIT)) { await upstream.body.cancel(); return denied(503) }
      const bytes = await boundedBytes(upstream.body, CLINICAL_MEDIA_LIMIT, signal)
      if (length !== null && bytes.byteLength !== Number(length)) return denied(503)
      const mime = privateImageMime(bytes, upstream.headers.get('content-type'))
      if (!mime) return denied(503)
      const after = await authority.authorize(scope)
      if (!after || after.path !== before.path || after.userId !== before.userId || after.sessionId !== before.sessionId) return denied(404)
      signal.throwIfAborted()
      return new Response(bytes, { headers: { ...PRIVATE_IMAGE_HEADERS,
        'Content-Type': mime, 'Content-Length': String(bytes.byteLength), 'Content-Disposition': 'inline',
      } })
    } catch { return denied(signal.aborted ? 504 : 503) }
    finally { if (acquired) inFlight-- }
  }
}
