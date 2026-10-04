import { boundedBytes } from './bounded-stream.mjs'
// Clinical bytes never enter local/session storage or a provider object URL.
export async function fetchClinicalDocument(scope, signal, isCurrent, fetcher = fetch) {
  if (!isCurrent() || signal.aborted) return null
  const response = await fetcher('/api/clinical-documents', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope),
  })
  if (!response.ok) { await response.body?.cancel(); throw new Error('Document denied') }
  if (!isCurrent() || signal.aborted) { await response.body?.cancel(); return null }
  const length = response.headers.get('content-length')
  if (!length || !/^\d+$/.test(length) || Number(length) > 10 * 1024 * 1024) {
    await response.body?.cancel(); throw new Error('Document exceeds bound')
  }
  const bytes = await boundedBytes(response.body, 10 * 1024 * 1024, signal)
  if (!isCurrent() || signal.aborted) return null
  if (bytes.byteLength !== Number(length)) throw new Error('Document incomplete')
  return new Blob([bytes], { type: 'application/octet-stream' })
}
