// Server route only: shares a short-lived transport credential, never human
// authority or document bytes. Live principal/human checks remain per request.
export function deliveryTokenCache(now = Date.now) {
  let cached = null, pending = null, retryAfter = 0
  return async (subject, login, signal) => {
    signal.throwIfAborted()
    if (cached?.subject === subject && cached.until > now()) return cached.token
    if (retryAfter > now()) throw new Error('Delivery login backoff')
    if (!pending) {
      pending = (async () => {
        const token = await login()
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
        if (claims.role !== 'clinia_document_delivery' || claims.sub !== subject || !Number.isFinite(claims.exp)
          || claims.exp * 1000 <= now() + 60000) throw new Error('Isolated delivery role required')
        cached = { subject, token, until: Math.min(now() + 300000, claims.exp * 1000 - 60000) }
        return token
      })().catch(error => { cached = null; retryAfter = now() + 5000; throw error })
        .finally(() => { pending = null })
    }
    // A canceled waiting request must not cancel another request's session login.
    let abort
    const canceled = new Promise((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }) })
    try {
      const token = await Promise.race([pending, canceled]); signal.throwIfAborted()
      if (cached?.subject !== subject) throw new Error('Delivery identity changed')
      return token
    } finally { signal.removeEventListener('abort', abort) }
  }
}
