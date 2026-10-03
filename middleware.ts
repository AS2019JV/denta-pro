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

  // Refresh session if expired - required for Server Components
  // We use try-catch to avoid hard crashes if the network request fails (e.g. timeout on Windows)
  let user = null;
  try {
     const { data, error } = await supabase.auth.getUser();
     if (error) {
        // Only log serious errors, ignore common session-missing scenarios
        if (error.status !== 401 && error.status !== 400) {
           console.warn('[Middleware] Unable to verify session');
        }
     }
     user = data?.user;
  } catch (e: any) {
     console.error('[Middleware] Unable to verify session');
  }

  // PR-06 FIX: Always verify identity via getUser(). Do not fall back to getSession()
  // for protected routes. If getUser fails, user remains null and protected routes fail closed.
  const isAuth = pathname.startsWith('/login') || 
                 pathname.startsWith('/signup') ||
                 pathname === '/';

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
