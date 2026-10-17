// Confirmation links only lead to these application flows. Return a constant,
// never an attacker-controlled URL, including its query string or fragment.
const AUTH_DESTINATIONS = new Set(['/', '/dashboard', '/update-password'])

export function safeAuthRedirect(value: unknown): string {
  return typeof value === 'string' && AUTH_DESTINATIONS.has(value)
    ? value
    : '/dashboard'
}
