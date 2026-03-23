import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[Middleware] Missing Supabase environment variables!");
    return response;
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
           console.warn(`[Middleware] Auth check warning: ${error.message}`);
        }
     }
     user = data?.user;
  } catch (e: any) {
     console.error(`[Middleware] Auth fetch failed: ${e.message}`);
     // If fetch failed (likely timeout), we continue with null user rather than crashing
  }

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Protected Routes List (All routes inside the authenticated app)
  const isDashboardRoute = pathname === '/dashboard' || 
                           pathname.startsWith('/patients') || 
                           pathname.startsWith('/calendar') || 
                           pathname.startsWith('/billing') || 
                           pathname.startsWith('/reports') || 
                           pathname.startsWith('/messages') || 
                           pathname.startsWith('/dentists') || 
                           pathname.startsWith('/settings') || 
                           pathname.startsWith('/profile') ||
                           pathname.startsWith('/pay');

  const isAuth = pathname.startsWith('/login') || 
                 pathname.startsWith('/signup') ||
                 pathname.startsWith('/onboarding') ||
                 pathname === '/';

  // Redirect to login if accessing dashboard without session
  if (isDashboardRoute && !user) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // RBAC Enforcement (Role-Based Access Control)
  if (isDashboardRoute && user) {
      const userRole = user.user_metadata?.role || "doctor"; // Default fallback

      // 1. Doctors restrictions
      if (userRole === "doctor") {
          // Doctors cannot access finances (billing/reports) or admin settings
          if (pathname.startsWith('/billing') || pathname.startsWith('/reports') || pathname.startsWith('/settings') || pathname.startsWith('/dentists')) {
              url.pathname = '/dashboard';
              return NextResponse.redirect(url);
          }
      }

      // 2. Receptionist restrictions
      if (userRole === "receptionist") {
          // Receptionists can access calendar and checkout (pay/billing), but not the full patients CRM, services, or reports/settings
          if (pathname.startsWith('/patients') || pathname.startsWith('/reports') || pathname.startsWith('/settings') || pathname.startsWith('/dashboard/services') || pathname.startsWith('/dentists')) {
              url.pathname = '/dashboard';
              return NextResponse.redirect(url);
          }
      }
  }

  // Redirect to dashboard if accessing auth pages with active session
  if (isAuth && user && !pathname.startsWith('/onboarding') && pathname !== '/free-trial') {
      // Allow them to stay if it's the landing page? The prompt doesn't specify landing page protection, but we treat '/' as landing.
      // Usually, logged-in users going to '/' are redirected to their dashboard in SAAS.
      if (pathname === '/' || pathname.startsWith('/login')) {
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
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
