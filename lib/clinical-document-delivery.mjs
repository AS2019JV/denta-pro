import { privateMediaPath } from './private-media.mjs'
import { boundedBytes } from './bounded-stream.mjs'
export { boundedBytes } from './bounded-stream.mjs'

export const DOCUMENT_LIMIT = 10 * 1024 * 1024
export const DOCUMENT_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache', 'Expires': '0', 'Vary': 'Authorization, Cookie',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
})
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
// Per process bound, including authority requests and buffered documents.
let inFlight = 0
const MAX_IN_FLIGHT = 4
/** Authorization is performed before fetching and again before publishing.
 * Dependency injection is for executable contract tests, not alternate authority.
 */
export function documentDeliveryHandler(dependencies) {
  const appOrigin = new URL(dependencies.appOrigin).origin
  return async request => {
    const error = status => new Response('No se pudo entregar el documento.', { status, headers: DOCUMENT_HEADERS })
    if (request.method !== 'POST') return error(405)
    if (['range', 'if-none-match', 'if-modified-since', 'if-range'].some(h => request.headers.has(h))) return error(400)
    const header = request.headers.get('authorization')
    const bearer = header === null ? null : /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header)?.[1]
    if (header !== null && !bearer) return error(401) // Never fall back to cookies.
    if (request.headers.get('origin') !== appOrigin && (!bearer || request.headers.has('origin'))) return error(403)
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return error(400)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
    let acquired = false
    try {
      if (inFlight >= MAX_IN_FLIGHT) return error(429)
      inFlight++; acquired = true
      const body = await boundedBytes(request.body, 512, signal)
      let input
      try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) }
      catch { return error(400) }
      if (!input || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'clinicId,fileId,patientId'
        || !Object.values(input).every(value => typeof value === 'string' && uuid.test(value))) return error(400)
      const authority = await dependencies.authority(request, bearer, signal)
      const before = await authority.authorize(input)
      if (!before) return error(404)
      const path = privateMediaPath(before.path, 'patient-files', dependencies.providerOrigin)
      if (!path || !path.startsWith(input.clinicId + '/' + input.patientId + '/')) return error(404)
      const upstream = await dependencies.download(path, signal)
      if (upstream.status !== 200 || !upstream.body) { await upstream.body?.cancel(); return error(503) }
      const length = upstream.headers.get('content-length')
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > DOCUMENT_LIMIT)) { await upstream.body.cancel(); return error(503) }
      const bytes = await boundedBytes(upstream.body, DOCUMENT_LIMIT, signal)
      const after = await authority.authorize(input)
      if (!after || after.path !== before.path || after.userId !== before.userId || after.sessionId !== before.sessionId) return error(404)
      if (!(await dependencies.deliveryActive(signal))) return error(503)
      if (!(await dependencies.recordAccess(input, after.path, signal))) return error(503)
      signal.throwIfAborted()
      const name = String(after.name || 'documento').normalize('NFC').replace(/[\x00-\x1f\x7f"\\/]/g, '_').slice(0, 180)
      return new Response(bytes, { headers: { ...DOCUMENT_HEADERS,
        'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,
      } })
    } catch { return error(signal.aborted ? 504 : 503) }
    finally { if (acquired) inFlight-- }
  }
}
