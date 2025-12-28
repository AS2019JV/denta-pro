import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // 1. Unauthenticated users -> Redirect to /login
  // Allow access to login, signup, and public assets/api
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicRoute = 
    pathname === "/" || 
    pathname.startsWith("/api") || 
    pathname.startsWith("/_next") || 
    pathname.includes(".") || 
    pathname.startsWith("/favicon.ico");

  if (!user && !isAuthRoute && !isPublicRoute) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users -> Redirect away from /login or /signup
  if (user && isAuthRoute) {
    if (!user.app_metadata?.clinic_id) {
       url.pathname = "/onboarding";
    } else {
       url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // 3. Protected Routes Guard
  // Redirect unauthenticated users trying to access protected routes
  if (!user && pathname.startsWith('/dashboard')) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
  }

  // 3. Limbo State Check: User authenticated but no clinic_id -> Force /onboarding
  // Allow access to /onboarding and strictly API/signout
  // 3. Onboarding Guard (Limbo State)
  // If user accesses /dashboard/* but has NO clinic_id -> Force /onboarding
  if (user && pathname.startsWith('/dashboard')) {
      const clinicId = user.app_metadata?.clinic_id;
      if (!clinicId) {
          url.pathname = "/onboarding";
          return NextResponse.redirect(url);
      }
  }

  // 3. User Role Checks for specific protected routes
  if (user) {
    const role = user.app_metadata?.role;

    // /dashboard/admin/* -> Requires role === 'clinic_owner'
    if (pathname.startsWith("/dashboard/admin") && role !== "clinic_owner") {
      // Redirect to a safe default or unauthorized page
      url.pathname = "/dashboard"; 
      return NextResponse.redirect(url);
    }

    // /dashboard/medical/* -> Requires role === 'doctor'
    // Note: Assuming 'clinic_owner' might also need access? 
    // The requirement purely says: /dashboard/medical/* -> Requires role === 'doctor'
    // I will stick to the strict requirement first.
    if (pathname.startsWith("/dashboard/medical") && role !== "doctor") {
      url.pathname = "/dashboard";
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
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
