/** Only transport failures may retain an already loaded view, always read-only. */
export class TemporaryAccessFailure extends Error {}
export function isTemporaryAccessFailure(error: unknown, status?: number): boolean {
  if (error instanceof TemporaryAccessFailure) return true
  if (!error || typeof error !== 'object') return false
  const value = error as { status?: number; code?: string; name?: string; message?: string }
  const http = status ?? value.status
  if (http === 401 || http === 403 || value.code === '42501') return false
  if (http === 0 || http === 429 || (typeof http === 'number' && http >= 500)) return true
  if (value.name === 'AuthRetryableFetchError') return true
  return !value.code && /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(value.message || '')
}
export function accessCheckError(error: unknown, status?: number): unknown {
  return isTemporaryAccessFailure(error, status) ? new TemporaryAccessFailure() : error
}

/** Any definitive failure wins over a simultaneous transport failure. */
export function accessResultsFailure(results: readonly { error?: unknown; status?: number }[]): unknown {
  const failures = results.filter(result => !!result.error)
  const selected = failures.find(result => !isTemporaryAccessFailure(result.error, result.status)) || failures[0]
  return selected ? accessCheckError(selected.error, selected.status) : undefined
}
