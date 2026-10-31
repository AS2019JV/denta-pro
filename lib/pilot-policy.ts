/** Public capability switch; server handlers enforce it independently of the UI.
 * Direct Supabase permissions still require the separately reviewed pilot DB package.
 */
export const SYNTHETIC_PILOT = process.env.NEXT_PUBLIC_CLINIA_PILOT_MODE === 'synthetic'
export const PILOT_UNAVAILABLE = 'Esta función no está disponible en la evaluación con datos ficticios.'

const excluded = ['/billing', '/pay', '/reports', '/recipes', '/marketing', '/messages',
  '/settings', '/profile', '/clinic', '/dentists', '/dashboard/services', '/signup', '/free-trial',
  '/schedule-demo', '/api/clinical-documents', '/api/private-media', '/api/payments',
  '/api/webhooks', '/api/send-email']

export function pilotPathBlocked(pathname: string): boolean {
  return excluded.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export function pilotPatientTab(tab: string): string {
  return SYNTHETIC_PILOT && ['files', 'recipes', 'payments'].includes(tab) ? 'info' : tab
}
