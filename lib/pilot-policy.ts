/** Public capability switch; server handlers enforce it independently of the UI.
 * Direct Supabase permissions still require the separately reviewed pilot DB package.
 */
export const SYNTHETIC_PILOT = process.env.NEXT_PUBLIC_CLINIA_PILOT_MODE === 'synthetic'
export const PILOT_UNAVAILABLE = 'Esta función no está disponible en la evaluación con datos ficticios.'

const excluded = ['/billing', '/pay', '/reports', '/recipes', '/marketing', '/messages',
  '/settings', '/profile', '/clinic', '/dentists', '/dashboard/services', '/free-trial',
  '/schedule-demo', '/api/clinical-documents', '/api/private-media', '/api/payments',
  '/api/webhooks', '/api/send-email']

export function pilotPathBlocked(pathname: string): boolean {
  return excluded.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export function pilotPatientTab(tab: string): string {
  return SYNTHETIC_PILOT && ['files', 'recipes', 'payments'].includes(tab) ? 'info' : tab
}

/** Closed by default until the clinical-file gate is verified. The opt-in is
 * restricted to synthetic QA on clinia-test; it cannot release Production.
 * Public capability is UX only. Server/DB authorization remains mandatory.
 */
// Direct client uploads and clinical PDF publication remain closed until their own gate is verified.
export const CLINICAL_DOCUMENTS_RELEASED = false
export const CLINICAL_FILES_QA = process.env.NEXT_PUBLIC_CLINIA_FILES_QA === '1'
  && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://fbtlldubzomocuhpvweg.supabase.co'

export const CLINICAL_FILES_UNAVAILABLE = 'Los archivos y las exportaciones no están disponibles por el momento.'
export const CLINICAL_FILE_DENIAL_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache', 'Expires': '0', 'Vary': 'Authorization, Cookie',
}
export function clinicalFilesServerQA(): boolean {
  return CLINICAL_FILES_QA && process.env.CLINIA_FILES_QA === '1' && process.env.VERCEL_ENV === 'preview'
}
export function clinicalFilePathBlocked(pathname: string): boolean {
  return ['/api/clinical-documents', '/api/private-media'].some(path => pathname === path || pathname.startsWith(path + '/'))
}
