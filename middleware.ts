import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { CLINIC_PREFERENCE_COOKIE, CLINIC_ROLES, selectClinicMembership } from "@/lib/clinic-authority.mjs";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  // Public metadata-only readiness owns its bounded provider probe. Do not
  // refresh visitor sessions or add a second network call before that bound.
  if (pathname === '/api/health') return response;
  const isDashboardRoute = ['/dashboard', '/patients', '/calendar', '/billing', '/reports', '/messages', '/dentists', '/settings', '/profile', '/recipes', '/clinic', '/marketing', '/pay']
    .some(path => pathname === path || pathname.startsWith(`${path}/`));
  const redirect = (path: string, reason?: string) => {
    // Preserve the incoming site's cookie scope, including localhost and
    // previews. A configured public URL may belong to another environment.
    const url = new URL(path, request.url);
    url.search = '';
    if (reason) url.searchParams.set('reason', reason);
    const result = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    return result;
  };

  if (!supabaseUrl || !supabaseKey) {
    return isDashboardRoute ? redirect('/login', 'unavailable') : response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims refreshes the SSR session and verifies the JWT signature. The
  // AAL claim is the server-side gate; client state never grants access.
  let user: { id: string } | null = null;
  let aal: string | undefined;
  try {
     const { data, error } = await supabase.auth.getClaims();
     const claims = data?.claims;
     if (!error && claims?.role === 'authenticated' && typeof claims.sub === 'string') {
       user = { id: claims.sub };
       aal = typeof claims.aal === 'string' ? claims.aal : 'aal1';
     }
  } catch {
     console.error('[Middleware] Unable to verify session');
  }

  // Only signed, verified claims establish the request identity; never trust
  // client session state. Protected clinical data is independently gated by DB RLS.
  const isAuth = pathname.startsWith('/login') ||
                 pathname.startsWith('/signup') ||
                 pathname === '/';

  // Do not perform profile or membership lookups for an AAL1 session: those
  // reads are protected by RLS too. Keep first-factor sessions on the MFA page.
  if (user && aal !== 'aal2' && (isDashboardRoute || pathname === '/' || pathname.startsWith('/login'))) {
    return redirect('/auth/mfa');
  }

  // A previously issued AAL2 JWT can outlive factor removal until refresh.
  // Ask the database authority function before looking up profile/role data;
  // RLS remains the final gate for every table and Storage request.
  if (user && aal === 'aal2' && (isDashboardRoute || pathname === '/')) {
    try {
      const { data, error } = await supabase.rpc('clinia_mfa_active');
      if (error || data !== true) return redirect('/auth/mfa');
    } catch {
      return redirect('/auth/mfa');
    }
  }

  // Redirect to login if accessing dashboard without verified session (fail closed)
  if (isDashboardRoute && !user) {
    return redirect('/login');
  }

  // Resolve current authority from the database, including revocation and
  // per-clinic roles. JWT metadata and the preference cookie grant nothing.
  let userRole: string | undefined;
  if (user && (isDashboardRoute || isAuth)) {
    try {
      const [profileResult, membershipResult] = await Promise.all([
        supabase.from('profiles').select('status,deleted_at,clinic_id').eq('id', user.id).maybeSingle(),
        supabase.from('clinic_members').select('clinic_id,role,status').eq('user_id', user.id).eq('status', 'active'),
      ]);
      const {data: profile, error: profileError} = profileResult;
      const {data: memberships, error: membershipError} = membershipResult;
      if (!profileError && !membershipError) {
        const selected = selectClinicMembership(profile, memberships || [], request.cookies.get(CLINIC_PREFERENCE_COOKIE)?.value);
        if (selected) {
          const {data: role, error} = await supabase.rpc('get_clinic_member_role', {check_clinic_id: selected.clinic_id});
          if (!error && CLINIC_ROLES.includes(role) && role === selected.role) userRole = role;
        }
      }
    } catch { /* Fail closed; protected routes redirect below. */ }
  }

  if (isDashboardRoute && user) {
      // M6-GAP-05 FIX: Fail closed by redirecting unverified users without a server-managed role claim to /login
      if (!userRole) {
          return redirect('/login', 'access');
      }

      // 1. Doctors restrictions
      if (userRole === "doctor") {
          // Operational reports contain only authorized counts, not finances.
          if (pathname.startsWith('/billing') || pathname.startsWith('/settings') || pathname.startsWith('/dentists') || pathname.startsWith('/clinic') || pathname.startsWith('/marketing')) {
              return redirect('/dashboard');
          }
      }

      // 2. Receptionist restrictions
      if (userRole === "receptionist") {
          // Receptionists can access lists (patients/team) but not detail views or admin areas
          if (pathname.startsWith('/reports') || pathname.startsWith('/settings') || pathname.startsWith('/dashboard/services') || pathname.startsWith('/recipes') || pathname.startsWith('/clinic') || pathname.startsWith('/marketing')) {
              return redirect('/dashboard');
          }

          // Block Patient details specifically, but allow the main list
          if (pathname.startsWith('/patients/')) {
              return redirect('/patients');
          }
      }
  }

  // Redirect to dashboard if accessing auth pages with active session AND verified role
  // M6-GAP-05 FIX: Prevent infinite redirect loops for sessions lacking a valid role claim
  const isVerifiedUser = !!(user && userRole);
  if (isAuth && isVerifiedUser && pathname !== '/free-trial') {
      if (pathname === '/' || pathname.startsWith('/login')) {
        return redirect('/dashboard');
      }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - manifest.json, manifest.webmanifest, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json)$).*)',
  ],
};
