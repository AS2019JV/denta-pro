import 'server-only'
import { randomUUID } from 'node:crypto'
import { logger, type OperationalContext } from '@/lib/logger'

/** Correlation is generated here, never copied from attacker-controlled headers. */
export async function observeResponse(
  operation: OperationalContext['operation'], action: () => Promise<Response>,
): Promise<Response> {
  const correlationId = randomUUID()
  const started = performance.now()
  try {
    const response = await action()
    const context = { correlationId, operation, status: response.status, durationMs: performance.now() - started }
    const event = operation === 'health' ? (response.status === 200 ? 'readiness.ok' : 'readiness.unavailable')
      : response.status >= 500 ? 'application.error'
      : response.status >= 400 ? 'security.request_rejected' : 'application.response'
    logger.operational(event, context)
    response.headers.set('X-Correlation-ID', correlationId)
    return response
  } catch (error) {
    logger.operational('application.error', { correlationId, operation, status: 500, durationMs: performance.now() - started })
    // Preserve the framework's error contract; never log the error's message/stack.
    throw error
  }
}
