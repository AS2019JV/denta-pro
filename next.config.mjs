/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
// Exact local acceptance origin, explicitly enabled by the isolated launcher.
// Normal builds/deployments receive no localhost allowance.
const localAcceptance = process.env.CLINIA_LOCAL_ACCEPTANCE === '1' && process.env.NEXT_PUBLIC_SUPABASE_URL === 'http://127.0.0.1:56321';
const localConnections = localAcceptance ? ' http://127.0.0.1:56321 ws://127.0.0.1:56321' : '';
const localImages = localAcceptance ? ' http://127.0.0.1:56321' : '';
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  // Server Actions read this file at runtime; automatic tracing omits it.
  outputFileTracingIncludes: {
    '/login': ['./emails/signup-confirmation.html'],
    '/signup': ['./emails/signup-confirmation.html'],
    '/forgot-password': ['./emails/reset-password.html'],
  },
  // Acceptance must not overwrite the .next directory used by localhost dev.
  distDir: localAcceptance ? '.next-clinia-acceptance' : '.next',
  // Next's middleware adapter otherwise rewrites 127.0.0.1 redirects to
  // localhost after our response, losing host-scoped local Auth cookies.
  // Keep normal deployment behavior; this flag only affects acceptance.
  skipMiddlewareUrlNormalize: localAcceptance,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    // Private Storage must never be republished by the image optimizer.
    remotePatterns: [],
    localPatterns: [
      { pathname: '/_next/static/media/**', search: '' },
      ...["/apple-icon.png","/avatar-1.png","/avatar-2.png","/avatar-3.png","/brand-logo.png","/clinia-logo.png","/dental-chart-3d.png","/grid.svg","/icon-dark-32x32.png","/icon-light-32x32.png","/icon.svg","/logo.png","/odontologic-dashboard.png","/placeholder-logo.png","/placeholder-logo.svg","/placeholder-user.jpg","/placeholder.jpg","/placeholder.svg","/team-ceo.png","/team-cs.png","/team-cto.png","/team-group.png","/team-product.png"].map(pathname => ({ pathname, search: '' })),
    ],
  },
  transpilePackages: ['recharts'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co${localImages}; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com${localConnections}; frame-ancestors 'none'; form-action 'self'; base-uri 'self';`,
          }
        ],
      },
    ]
  },
}

export default nextConfig
