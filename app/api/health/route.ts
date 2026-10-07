import { probeReadiness } from '@/lib/readiness-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 5

export async function GET() {
  const result = await probeReadiness({
    CLINIA_HEALTH_ENABLED: process.env.CLINIA_HEALTH_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  return Response.json(result, {
    status: result.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff',
      ...(result.status === 'unavailable' ? { 'Retry-After': '30' } : {}) },
  })
}
