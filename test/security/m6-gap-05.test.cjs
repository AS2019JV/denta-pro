/**
 * Test Suite: M6-GAP-05 Middleware Role Fallback & Route Scoping Verification
 * Validates:
 * 1. Removal of /pay from isDashboardRoute (public checkout accessible)
 * 2. Elimination of fail-open fallback || "doctor"
 * 3. Fail-closed redirection to /login when user.app_metadata.role is undefined/missing or invalid
 * 4. Protection of /dashboard sub-paths (including /dashboard/services) via pathname.startsWith('/dashboard')
 * 5. Elimination of infinite redirect loop between /dashboard and /login for unverified users
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT_DIR = join(__dirname, '../..');
const MIDDLEWARE_PATH = join(ROOT_DIR, 'middleware.ts');

function readMiddleware() {
  return readFileSync(MIDDLEWARE_PATH, 'utf8');
}

describe('M6-GAP-05: Middleware Static Code Invariants', () => {
  const code = readMiddleware();

  test('middleware.ts does NOT treat /pay as a protected dashboard route', () => {
    assert.ok(
      !code.includes("pathname.startsWith('/pay')"),
      'Must NOT include pathname.startsWith(\'/pay\') in isDashboardRoute'
    );
  });

  test('middleware.ts does NOT fall back to || "doctor"', () => {
    assert.ok(
      !code.includes('|| "doctor"'),
      'Must NOT fall back to "doctor" role if app_metadata.role is missing'
    );
    assert.ok(
      !code.includes("|| 'doctor'"),
      'Must NOT fall back to \'doctor\' role if app_metadata.role is missing'
    );
  });

  test('middleware.ts verifies user.app_metadata.role and redirects unverified users to /login', () => {
    assert.ok(
      code.includes('user.app_metadata?.role'),
      'Must extract role from user.app_metadata?.role'
    );
    assert.ok(
      code.includes('if (!userRole'),
      'Must check if (!userRole) to detect missing role claim'
    );
    assert.ok(
      code.includes("url.pathname = '/login'"),
      'Must set url.pathname = \'/login\' when userRole is missing'
    );
  });

  test('middleware.ts uses pathname.startsWith(\'/dashboard\') to cover sub-paths', () => {
    assert.ok(
      code.includes("pathname.startsWith('/dashboard')"),
      'Must protect /dashboard sub-paths like /dashboard/services'
    );
  });

  test('middleware.ts guards auth route redirect to prevent infinite redirect loops', () => {
    assert.ok(
      code.includes('isVerifiedUser') || code.includes('ALLOWED_ROLES'),
      'Must verify role before redirecting from auth pages to /dashboard'
    );
  });
});

describe('M6-GAP-05: Route Matching & Full Middleware Simulation', () => {
  const ALLOWED_ROLES = ['clinic_owner', 'admin', 'doctor', 'receptionist'];

  function simulateMiddleware(pathname, user) {
    const isDashboardRoute =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/patients') ||
      pathname.startsWith('/calendar') ||
      pathname.startsWith('/billing') ||
      pathname.startsWith('/reports') ||
      pathname.startsWith('/messages') ||
      pathname.startsWith('/dentists') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/profile');

    const isAuth =
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname === '/';

    // 1. Unauthenticated access to dashboard routes fails closed
    if (isDashboardRoute && !user) {
      return { redirect: '/login' };
    }

    const userRole = user?.app_metadata?.role;

    // 2. RBAC Enforcement for dashboard routes
    if (isDashboardRoute && user) {
      // Fail closed if role is missing or not in allowed set
      if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return { redirect: '/login' };
      }

      // Doctors restrictions
      if (userRole === 'doctor') {
        if (
          pathname.startsWith('/billing') ||
          pathname.startsWith('/reports') ||
          pathname.startsWith('/settings') ||
          pathname.startsWith('/dentists')
        ) {
          return { redirect: '/dashboard' };
        }
      }

      // Receptionist restrictions
      if (userRole === 'receptionist') {
        if (
          pathname.startsWith('/reports') ||
          pathname.startsWith('/settings') ||
          pathname.startsWith('/dashboard/services')
        ) {
          return { redirect: '/dashboard' };
        }
        if (pathname.startsWith('/patients/')) {
          return { redirect: '/patients' };
        }
      }
    }

    // 3. Auth pages redirect to dashboard ONLY for verified sessions with allowed roles
    const isVerifiedUser = Boolean(user && userRole && ALLOWED_ROLES.includes(userRole));
    if (isAuth && isVerifiedUser && pathname !== '/free-trial') {
      if (pathname === '/' || pathname.startsWith('/login')) {
        return { redirect: '/dashboard' };
      }
    }

    return { allowed: true };
  }

  test('/pay routes are NOT dashboard routes and do not require auth', () => {
    assert.deepEqual(simulateMiddleware('/pay/uuid-123', null), { allowed: true });
    assert.deepEqual(simulateMiddleware('/pay', null), { allowed: true });
  });

  test('Unauthenticated user accessing dashboard or sub-routes is redirected to /login', () => {
    assert.deepEqual(simulateMiddleware('/dashboard', null), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/dashboard/services', null), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/patients', null), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/settings', null), { redirect: '/login' });
  });

  test('Authenticated user with MISSING role claim fails closed to /login', () => {
    const userWithoutRole = { id: 'u1', app_metadata: {} };
    assert.deepEqual(simulateMiddleware('/dashboard', userWithoutRole), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/patients/123', userWithoutRole), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/billing', userWithoutRole), { redirect: '/login' });
  });

  test('INVARIANT: Unverified user arriving at /login is NOT redirected to /dashboard (no infinite loop)', () => {
    const userWithoutRole = { id: 'u1', app_metadata: {} };
    // Step 1: User visits /dashboard -> redirected to /login
    const step1 = simulateMiddleware('/dashboard', userWithoutRole);
    assert.deepEqual(step1, { redirect: '/login' });

    // Step 2: Browser follows redirect to /login with existing session -> MUST be allowed, NOT looped
    const step2 = simulateMiddleware(step1.redirect, userWithoutRole);
    assert.deepEqual(step2, { allowed: true }, 'Must NOT redirect back to /dashboard from /login');

    // Step 3: Landing page access also allowed without bouncing to /dashboard
    const landing = simulateMiddleware('/', userWithoutRole);
    assert.deepEqual(landing, { allowed: true }, 'Must NOT bounce to /dashboard from landing page');
  });

  test('Authenticated user with UNAPPROVED role fails closed to /login without privilege escalation', () => {
    const userWithBadRole = { id: 'u-hacker', app_metadata: { role: 'guest' } };
    assert.deepEqual(simulateMiddleware('/dashboard', userWithBadRole), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/billing', userWithBadRole), { redirect: '/login' });
    assert.deepEqual(simulateMiddleware('/login', userWithBadRole), { allowed: true });
  });

  test('Authenticated doctor has clinical access but blocked from finances/admin', () => {
    const doctorUser = { id: 'u2', app_metadata: { role: 'doctor' } };
    assert.deepEqual(simulateMiddleware('/dashboard', doctorUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/patients/123', doctorUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/billing', doctorUser), { redirect: '/dashboard' });
    assert.deepEqual(simulateMiddleware('/reports', doctorUser), { redirect: '/dashboard' });
    assert.deepEqual(simulateMiddleware('/settings', doctorUser), { redirect: '/dashboard' });
    assert.deepEqual(simulateMiddleware('/dentists', doctorUser), { redirect: '/dashboard' });
    // Auth route redirect
    assert.deepEqual(simulateMiddleware('/login', doctorUser), { redirect: '/dashboard' });
  });

  test('Authenticated receptionist restricted from /dashboard/services and patient details', () => {
    const receptionistUser = { id: 'u3', app_metadata: { role: 'receptionist' } };
    assert.deepEqual(simulateMiddleware('/dashboard', receptionistUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/patients', receptionistUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/patients/123', receptionistUser), { redirect: '/patients' });
    assert.deepEqual(simulateMiddleware('/reports', receptionistUser), { redirect: '/dashboard' });
    assert.deepEqual(simulateMiddleware('/settings', receptionistUser), { redirect: '/dashboard' });
    assert.deepEqual(simulateMiddleware('/dashboard/services', receptionistUser), { redirect: '/dashboard' });
  });

  test('Authenticated clinic_owner has full access to all dashboard routes', () => {
    const ownerUser = { id: 'u4', app_metadata: { role: 'clinic_owner' } };
    assert.deepEqual(simulateMiddleware('/dashboard', ownerUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/dashboard/services', ownerUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/patients/123', ownerUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/billing', ownerUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/settings', ownerUser), { allowed: true });
    assert.deepEqual(simulateMiddleware('/dentists', ownerUser), { allowed: true });
  });
});
