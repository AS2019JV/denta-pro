import { boundedBytes } from './bounded-stream.mjs'
import { CLINICAL_MEDIA_LIMIT } from './clinical-media-limits.mjs'
import { privateImageMime } from './private-image-mime.mjs'

export async function fetchPrivateMedia(scope, signal, isCurrent, fetcher = fetch) {
  if (!isCurrent() || signal.aborted) return null
  const response = await fetcher('/api/private-media', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope),
  })
  if (!response.ok) { await response.body?.cancel(); throw new Error('Image denied') }
  if (!isCurrent() || signal.aborted) { await response.body?.cancel(); return null }
  const length = response.headers.get('content-length')
  if (!length || !/^\d+$/.test(length) || Number(length) > CLINICAL_MEDIA_LIMIT) {
    await response.body?.cancel(); throw new Error('Image exceeds bound')
  }
  const bytes = await boundedBytes(response.body, CLINICAL_MEDIA_LIMIT, signal)
  if (!isCurrent() || signal.aborted) return null
  const mime = privateImageMime(bytes, response.headers.get('content-type'))
  if (bytes.byteLength !== Number(length) || !mime) throw new Error('Image invalid')
  return new Blob([bytes], { type: mime })
}
