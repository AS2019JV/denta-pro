/**
 * Gate 0 Security Verification Suite: SEC-11 & SEC-13
 * 
 * Verifies that financial processing and public checkout are strictly disabled
 * server-side for the Clinia+ Clinical EHR/PMS MVP:
 * 1. SEC-11: POST to /api/payments/subscribe returns 503 Service Unavailable
 *    with { error: "Payments service disabled for clinical MVP" } before any
 *    Kushki API execution or database mutation.
 * 2. SEC-13: Pay route app/(dashboard)/pay/[id]/page.tsx imports notFound and
 *    invokes notFound() at the start of the component to fail closed with HTTP 404.
 */

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, describe } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT_DIR = join(__dirname, '../..');
const SUBSCRIBE_ROUTE_PATH = join(ROOT_DIR, 'app/api/payments/subscribe/route.ts');
const PAY_PAGE_PATH = join(ROOT_DIR, 'app/(dashboard)/pay/[id]/page.tsx');

function createSubscribeSandbox(options = {}) {
  const source = readFileSync(SUBSCRIBE_ROUTE_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  let kushkiCalls = 0;
  let dbUpdates = 0;
  let dbInserts = 0;

  const mockCookies = async () => ({
    getAll: () => [],
    set: () => {},
  });

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: options.user || null },
        error: options.user ? null : new Error('Unauthorized'),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 'test-clinic', owner_id: 'test-owner' }, error: null }),
          maybeSingle: async () => ({ data: { role: 'clinic_owner', clinic_id: 'test-clinic' }, error: null }),
        }),
      }),
      update: () => {
        dbUpdates++;
        return { eq: async () => ({ error: null }) };
      },
      insert: async () => {
        dbInserts++;
        return { error: null };
      },
    }),
  };

  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: {
      env: options.env !== undefined ? options.env : {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        NODE_ENV: 'production',
      },
    },
    console: { log() {}, error() {}, warn() {} },
    require: (mod) => {
      if (mod === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => ({
              status: init?.status || 200,
              body,
              json: async () => body,
            }),
          },
        };
      }
      if (mod === 'next/headers') return { cookies: mockCookies };
      if (mod === '@supabase/ssr') return { createServerClient: () => mockSupabase };
      if (mod === '@supabase/supabase-js') return { createClient: () => mockSupabase };
      if (mod === '@/lib/kushki') {
        return {
          kushki: {
            createSubscription: async () => {
              kushkiCalls++;
              return { subscriptionId: 'sub-test' };
            },
          },
        };
      }
      if (mod === '@/lib/subscription-plans') {
        return {
          getPlan: () => ({ id: 'pro', name: 'Pro', price: 59, kushkiPlanId: 'plan_pro' }),
        };
      }
      return require(mod);
    },
  };

  vm.runInNewContext(transpiled, sandbox);

  return {
    POST: sandbox.exports.POST,
    getMetrics: () => ({ kushkiCalls, dbUpdates, dbInserts }),
  };
}

describe('SEC-11: Payment Subscription API Route Fail-Closed Guard (/api/payments/subscribe)', () => {
  const routeSource = readFileSync(SUBSCRIBE_ROUTE_PATH, 'utf8');

  test('Static Invariant: Route contains 503 guard with exact MVP disabled message', () => {
    assert.ok(
      routeSource.includes('Payments service disabled for clinical MVP'),
      'Must contain exact error message: Payments service disabled for clinical MVP'
    );
    assert.ok(
      routeSource.includes('status: 503'),
      'Must return HTTP status 503 Service Unavailable'
    );
  });

  test('Static Invariant: Guard is positioned before Kushki execution and DB mutations', () => {
    const guardIndex = routeSource.indexOf('Payments service disabled for clinical MVP');
    const kushkiIndex = routeSource.indexOf('kushki.createSubscription');
    const dbUpdateIndex = routeSource.indexOf("subscription_status: 'active'");

    assert.ok(guardIndex > 0, 'Guard must exist in file');
    assert.ok(kushkiIndex > 0, 'Kushki reference exists');
    assert.ok(guardIndex < kushkiIndex, 'Guard must precede kushki.createSubscription');
    if (dbUpdateIndex > 0) {
      assert.ok(guardIndex < dbUpdateIndex, 'Guard must precede database subscription activation');
    }
  });

  test('Execution: Unauthenticated POST returns 503 Service Unavailable', async () => {
    const { POST, getMetrics } = createSubscribeSandbox({ user: null });
    const req = {
      json: async () => ({ token: 'card-tok', planId: 'pro', clinicId: 'c1' }),
    };

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must return HTTP 503');
    const body = await res.json();
    assert.equal(body.error, 'Payments service disabled for clinical MVP');

    const metrics = getMetrics();
    assert.equal(metrics.kushkiCalls, 0, 'Must NOT invoke Kushki gateway');
    assert.equal(metrics.dbUpdates, 0, 'Must NOT execute DB updates');
    assert.equal(metrics.dbInserts, 0, 'Must NOT execute DB inserts');
  });

  test('Execution: Authenticated clinic_owner POST returns 503 without charging or DB mutation', async () => {
    const mockOwner = {
      id: 'owner-uuid-1',
      email: 'owner@clinic.test',
      app_metadata: { role: 'clinic_owner', clinic_id: 'c1' },
    };
    const { POST, getMetrics } = createSubscribeSandbox({ user: mockOwner });
    const req = {
      json: async () => ({ token: 'valid-kushki-tok', planId: 'pro', clinicId: 'c1' }),
    };

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must return HTTP 503');
    const body = await res.json();
    assert.equal(body.error, 'Payments service disabled for clinical MVP');

    const metrics = getMetrics();
    assert.equal(metrics.kushkiCalls, 0, 'Must NOT invoke Kushki gateway');
    assert.equal(metrics.dbUpdates, 0, 'Must NOT update clinics table');
    assert.equal(metrics.dbInserts, 0, 'Must NOT insert into payments table');
  });

  test('Execution: Hostile payload (cross-tenant, forged token) is aborted at 503 guard', async () => {
    const mockAttacker = {
      id: 'attacker-uuid',
      email: 'attacker@evil.invalid',
      app_metadata: { role: 'doctor', clinic_id: 'c2' },
    };
    const { POST, getMetrics } = createSubscribeSandbox({ user: mockAttacker });
    const req = {
      json: async () => ({ token: 'malicious-token', planId: 'enterprise', clinicId: 'c1' }),
    };

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must return HTTP 503');
    const body = await res.json();
    assert.equal(body.error, 'Payments service disabled for clinical MVP');

    const metrics = getMetrics();
    assert.equal(metrics.kushkiCalls, 0, 'Must NOT contact gateway');
    assert.equal(metrics.dbUpdates, 0, 'Must NOT mutate DB');
  });

  test('Execution: Malformed or unparseable JSON payload returns 503 without attempting body parsing', async () => {
    const { POST, getMetrics } = createSubscribeSandbox({ user: null });
    let jsonParserCalled = false;
    const req = {
      json: async () => {
        jsonParserCalled = true;
        throw new SyntaxError('Unexpected token in JSON');
      },
    };

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must return HTTP 503');
    const body = await res.json();
    assert.equal(body.error, 'Payments service disabled for clinical MVP');
    assert.equal(jsonParserCalled, false, 'Body parser must never be invoked when 503 guard fires');

    const metrics = getMetrics();
    assert.equal(metrics.kushkiCalls, 0, 'Zero Kushki calls');
    assert.equal(metrics.dbUpdates, 0, 'Zero DB updates');
  });

  test('Execution: Completely missing environment variables still returns 503 cleanly without 500 error', async () => {
    const { POST, getMetrics } = createSubscribeSandbox({ user: null, env: {} });
    const req = {
      json: async () => ({ token: 'tok', planId: 'pro', clinicId: 'c1' }),
    };

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must return HTTP 503 even when env is unconfigured');
    const body = await res.json();
    assert.equal(body.error, 'Payments service disabled for clinical MVP');

    const metrics = getMetrics();
    assert.equal(metrics.kushkiCalls, 0, 'Zero Kushki calls');
  });
});

describe('SEC-13: Pay Route Fail-Closed Invariant (app/(dashboard)/pay/[id]/page.tsx)', () => {
  const paySource = readFileSync(PAY_PAGE_PATH, 'utf8');

  test('Static Invariant: notFound is imported from next/navigation', () => {
    assert.ok(
      /import\s+.*\{[^}]*notFound[^}]*\}\s+from\s+["']next\/navigation["']/.test(paySource),
      'Must import notFound from next/navigation'
    );
  });

  test('Static Invariant: notFound() is invoked at start of PaymentPage component', () => {
    const fnMatch = paySource.match(/export\s+default\s+function\s+PaymentPage\s*\([^)]*\)\s*\{([^}]*)/);
    assert.ok(fnMatch, 'PaymentPage component function must exist');

    const notFoundIndex = paySource.indexOf('notFound()');
    assert.ok(notFoundIndex > 0, 'notFound() must be invoked');

    const compIndex = paySource.indexOf('function PaymentPage');
    assert.ok(notFoundIndex > compIndex, 'notFound() must be inside PaymentPage');

    const fetchDataIndex = paySource.indexOf('fetchData');
    assert.ok(notFoundIndex < fetchDataIndex, 'notFound() must precede fetchData');

    const supabaseQueryIndex = paySource.indexOf("supabase.from('billings')");
    assert.ok(notFoundIndex < supabaseQueryIndex, 'notFound() must precede billing queries');
  });

  test('Execution: PaymentPage invocation throws NEXT_NOT_FOUND to trigger 404', () => {
    const transpiled = ts.transpileModule(paySource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;

    let notFoundCalled = false;
    let queryCalls = 0;

    const sandbox = {
      exports: {},
      module: { exports: {} },
      process: { env: {} },
      console: { log() {}, error() {}, warn() {} },
      require: (mod) => {
        if (mod === 'next/navigation') {
          return {
            useParams: () => ({ id: 'bill-123' }),
            notFound: () => {
              notFoundCalled = true;
              const err = new Error('NEXT_NOT_FOUND');
              err.digest = 'NEXT_NOT_FOUND';
              throw err;
            },
          };
        }
        if (mod === 'react') {
          return {
            createElement: () => null,
            useEffect: () => {},
            useState: (init) => [init, () => {}],
            useCallback: (fn) => fn,
          };
        }
        if (mod === '@/lib/supabase') {
          return {
            supabase: {
              from: () => {
                queryCalls++;
                return { select: () => ({ eq: () => ({ single: async () => ({}) }) }) };
              },
            },
          };
        }
        if (mod === 'sonner') return { toast: { success() {}, error() {} } };
        if (mod === 'lucide-react') return { Loader2: () => null, CheckCircle2: () => null, Copy: () => null, Building2: () => null, CreditCard: () => null, Upload: () => null };
        if (mod.startsWith('@/components/ui/')) return {};
        return {};
      },
    };

    vm.runInNewContext(transpiled, sandbox);

    const PaymentPage = sandbox.exports.default || sandbox.module.exports.default;
    assert.ok(typeof PaymentPage === 'function', 'PaymentPage must export a component function');

    assert.throws(
      () => PaymentPage(),
      (err) => err.digest === 'NEXT_NOT_FOUND' || err.message === 'NEXT_NOT_FOUND',
      'PaymentPage must throw NEXT_NOT_FOUND on render to fail closed with 404'
    );

    assert.equal(notFoundCalled, true, 'notFound() must have been called');
    assert.equal(queryCalls, 0, 'Zero database queries must be initiated');
  });

  test('Execution: PaymentPage invocation with empty params throws NEXT_NOT_FOUND without inspecting params', () => {
    const transpiled = ts.transpileModule(paySource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;

    let notFoundCalled = false;
    let paramsAccessed = false;

    const sandbox = {
      exports: {},
      module: { exports: {} },
      process: { env: {} },
      console: { log() {}, error() {}, warn() {} },
      require: (mod) => {
        if (mod === 'next/navigation') {
          return {
            useParams: () => {
              paramsAccessed = true;
              return {};
            },
            notFound: () => {
              notFoundCalled = true;
              const err = new Error('NEXT_NOT_FOUND');
              err.digest = 'NEXT_NOT_FOUND';
              throw err;
            },
          };
        }
        if (mod === 'react') {
          return {
            createElement: () => null,
            useEffect: () => {},
            useState: (init) => [init, () => {}],
            useCallback: (fn) => fn,
          };
        }
        return {};
      },
    };

    vm.runInNewContext(transpiled, sandbox);
    const PaymentPage = sandbox.exports.default || sandbox.module.exports.default;

    assert.throws(
      () => PaymentPage(),
      (err) => err.digest === 'NEXT_NOT_FOUND' || err.message === 'NEXT_NOT_FOUND'
    );
    assert.equal(notFoundCalled, true, 'notFound() must be called');
    assert.equal(paramsAccessed, false, 'useParams must NOT even be called because notFound() throws first');
  });
});
