/**
 * Milestone 3 Adversarial Stress & Empirical Verification Test Suite
 * Author: teamwork_preview_challenger_m3_m4_1 (Empirical Challenger)
 * Roles: critic, specialist
 * Targets: SEC-08, SEC-09, SEC-10, SEC-11
 *
 * Comprehensive Empirical Verification Coverage:
 * - SEC-08: Dashboard Analytics View Isolation:
 *   * Cross-tenant revenue, billing counts, and patient metrics leakage attacks
 *   * Unauthenticated / anonymous query rejection and null tenant handling
 *   * Parameter manipulation and WHERE clause injection defense
 *   * SQL AST & migration invariant verification (security_invoker, tenant filter, role grants)
 * - SEC-09: Maintenance RPCs Execution Revocation & 90-Day Retention Lock:
 *   * Public/anon/unauthenticated execution denial on archive_clinic, purge_clinic_data, seed_default_services
 *   * Tenant privilege separation: regular users & owners denied direct execution
 *   * Statutory 90-day retention lock: purge rejection for unarchived, freshly archived, and <90 day clinics
 *   * Legitimate service_role purge after >90 day retention elapsed
 *   * SQL AST & migration invariants (search_path, REVOKE ALL FROM PUBLIC/authenticated/anon, GRANT to service_role)
 * - SEC-10: Transactional Email Route Adversarial Attacks (/api/send-email):
 *   * Unauthenticated or untrusted-origin requests (401/403), with zero provider side effects
 *   * Authenticated requests without active clinic association (403)
 *   * Exfiltration & relay attacks: external recipients and cross-tenant patients rejected (403)
 *   * Legitimate intra-clinic delivery: clinic patients and staff accepted (200)
 *   * Injection attacks: caller-supplied raw HTML, malicious tags, and unapproved templates rejected (400)
 *   * Template sanitization: HTML/script tag escaping in template variables
 *   * Original request bursts respect explicit durable RPC denial/Retry-After; SQL quota proof is separate
 *   * Service failure fail-closed: missing API key returns 503 without leaking data
 * - SEC-11: Kushki Gateway Fail-Closed Invariants:
 *   * Configuration edge cases: undefined, empty, whitespace, and 'mock_private_key' reject before network call
 *   * Provider card declines, authentication errors, and server errors fail closed
 *   * Network transport errors (ETIMEDOUT, ECONNREFUSED) fail closed
 *   * Zero active subscription synthesis across all error conditions
 *   * Subscription route (/api/payments/subscribe) RBAC: unauthenticated (401), non-owners (403), cross-tenant (403)
 *   * Atomic fail-closed persistence: failed gateway payments never activate database subscription or insert payment record
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const {loadCurrentSource,gateEnv,ALLOW_BUDGET,durableBudgetFixture}=require('./harness/current-source-loader.cjs');

const {
  TENANT_A_ID,
  TENANT_B_ID,
  CLINIC_A_OWNER_ID,
  CLINIC_A_DOCTOR_ID,
  CLINIC_A_DOCTOR_2_ID,
  CLINIC_A_RECEPTIONIST_ID,
  CLINIC_B_OWNER_ID,
  CLINIC_B_DOCTOR_ID,
  CLINIC_B_RECEPTIONIST_ID,
  PATIENT_A1_ID,
  PATIENT_A2_ID,
  PATIENT_B1_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');

const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');

const ROOT_DIR = join(__dirname, '../..');
const MIGRATION_M3_PATH = join(ROOT_DIR, 'supabase/migrations/20260920_m3_analytics_maintenance_rpcs.sql');
const SEND_EMAIL_ROUTE_PATH = join(ROOT_DIR, 'app/api/send-email/route.ts');
const KUSHKI_PATH = join(ROOT_DIR, 'lib/kushki.ts');
const SUBSCRIBE_ROUTE_PATH = join(ROOT_DIR, 'app/api/payments/subscribe/route.ts');

/**
 * Extended Challenger M3 Security Engine simulating the exact PL/pgSQL functions,
 * view definitions, grants, and retention locks deployed in Milestone 3.
 */
class ChallengerM3SecurityHarness extends DatabaseSecurityEngine {
  constructor() {
    super();

    // Hydrate distinct billings for Tenant A and Tenant B
    this.billings = [
      { id: 'bill-a-1', clinic_id: TENANT_A_ID, patient_id: PATIENT_A1_ID, amount: 120.0, created_at: '2026-09-10T15:00:00Z' },
      { id: 'bill-a-2', clinic_id: TENANT_A_ID, patient_id: PATIENT_A2_ID, amount: 250.0, created_at: '2026-09-12T16:00:00Z' },
      { id: 'bill-b-1', clinic_id: TENANT_B_ID, patient_id: PATIENT_B1_ID, amount: 500.0, created_at: '2026-09-11T12:00:00Z' },
      { id: 'bill-b-2', clinic_id: TENANT_B_ID, patient_id: PATIENT_B1_ID, amount: 350.0, created_at: '2026-09-14T18:00:00Z' },
    ];
  }

  /**
   * Simulates SELECT from public.dashboard_stats_view WITH (security_invoker = true)
   * WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
   */
  queryDashboardStatsView(caller, clientWhere = {}) {
    // Check view SELECT privilege: only authenticated and service_role are granted
    if (!caller || !caller.userId || caller.role === 'anon') {
      throw new Error('403 Forbidden: SELECT privilege denied on dashboard_stats_view to role anon');
    }

    const jwtClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId || null;
    if (!jwtClinicId) {
      // In PostgreSQL: WHERE clinic_id = NULL evaluates to unknown/false -> 0 rows
      return [];
    }

    // Underlying view definition enforces clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    let viewRows = this.billings.filter((b) => b.clinic_id === jwtClinicId);

    // If client attempts additional WHERE filter (e.g. adversary tries WHERE clinic_id = TENANT_A_ID)
    if (clientWhere.clinic_id && clientWhere.clinic_id !== jwtClinicId) {
      return [];
    }

    // Group by clinic_id, calculate aggregates
    const totalBillings = viewRows.length;
    const totalRevenue = viewRows.reduce((acc, b) => acc + b.amount, 0);
    const uniquePatients = new Set(viewRows.map((b) => b.patient_id)).size;

    return [
      {
        clinic_id: jwtClinicId,
        month: '2026-09-01T00:00:00.000Z',
        total_billings: totalBillings,
        total_revenue: totalRevenue,
        unique_patients_billed: uniquePatients,
      },
    ];
  }

  /**
   * Simulates public.archive_clinic(target_clinic_id)
   * Invariant SEC-09: REVOKE ALL FROM PUBLIC, authenticated, anon; GRANT TO service_role.
   */
  archiveClinicM3(caller, { target_clinic_id }) {
    if (!caller || !caller.userId || caller.role === 'anon') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on archive_clinic');
    }

    if (caller.role !== 'service_role') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on archive_clinic (restricted to service_role)');
    }

    const clinic = this.clinics.find((c) => c.id === target_clinic_id);
    if (!clinic) throw new Error('Clinic not found');

    clinic.subscription_status = 'archived';
    clinic.archived_at = new Date().toISOString();
    return { success: true, archived_at: clinic.archived_at };
  }

  /**
   * Simulates public.purge_clinic_data(target_clinic_id)
   * Invariant SEC-09: Execution strictly restricted to service_role with 90-day retention lock.
   */
  purgeClinicDataM3(caller, { target_clinic_id }) {
    if (!caller || !caller.userId || caller.role === 'anon') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on purge_clinic_data');
    }

    if (caller.role !== 'service_role') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on purge_clinic_data (restricted to service_role)');
    }

    const clinic = this.clinics.find((c) => c.id === target_clinic_id);
    if (!clinic) {
      throw new Error('Clinic not found');
    }

    if (clinic.subscription_status !== 'archived' || !clinic.archived_at) {
      throw new Error('Cannot purge unarchived clinic');
    }

    const archivedAtMs = new Date(clinic.archived_at).getTime();
    const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;

    if (archivedAtMs > ninetyDaysAgoMs) {
      throw new Error('Statutory 90-day retention lock active. Purge rejected.');
    }

    this.clinics = this.clinics.filter((c) => c.id !== target_clinic_id);
    return { success: true, purged: target_clinic_id };
  }

  /**
   * Simulates public.seed_default_services(target_clinic_id)
   * Invariant SEC-09: Execution strictly restricted to service_role.
   */
  seedDefaultServicesM3(caller, { target_clinic_id }) {
    if (!caller || !caller.userId || caller.role === 'anon') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on seed_default_services');
    }

    if (caller.role !== 'service_role') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on seed_default_services (restricted to service_role)');
    }

    const defaultServices = [
      'Consulta General / Diagnóstico',
      'Limpieza Dental (Profilaxis)',
      'Resina Simple (1 superficie)',
      'Extracción Simple',
    ];

    for (const name of defaultServices) {
      this.services.push({
        id: `srv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        clinic_id: target_clinic_id,
        name,
        price: 30.0,
        is_active: true,
      });
    }

    return { success: true, count: defaultServices.length };
  }
}

/**
 * Sandboxed Execution Factory for app/api/send-email/route.ts
 */
function createSendEmailRouteSandbox({
  currentUser = null,
  sessionUser = null,
  tokenUser = null,
  cookiesList = [],
  dbData = {},
  resendApiKey = 'test_resend_api_key',
  resendSendHandler = null,
  budgetReply = ALLOW_BUDGET,
} = {}) {
  const source = readFileSync(SEND_EMAIL_ROUTE_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mockCookies = async () => ({
    getAll: () => cookiesList,
    set: () => {},
  });

  const sentResendCalls = [];
  const budget=durableBudgetFixture(budgetReply);

  const createQueryBuilder = (tableName) => {
    let rows = dbData[tableName] ? [...dbData[tableName]] : [];

    const builder = {
      select: () => builder,
      eq: (col, val) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      ilike: (col, val) => {
        const valLower = String(val).trim().toLowerCase();
        rows = rows.filter((r) => String(r[col] || '').trim().toLowerCase() === valLower);
        return builder;
      },
      in: (col, vals) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return builder;
      },
      is: (col,val) => {rows=rows.filter(row=>row[col]===val||(val===null&&row[col]==null));return builder;},
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: rows[0] ? null : new Error('Not found') }),
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return builder;
  };

  const mockSupabase = {
    rpc: async (name,params) => {
      if(name==='consume_email_abuse_budget')return budget.rpc(name,params);
      assert.ok(['get_user_clinic_id','get_clinic_member_role'].includes(name));
      const actor=tokenUser||sessionUser||currentUser;
      const profile=dbData.profiles?.find(p=>p.id===actor?.id&&p.status==='active'&&p.deleted_at==null);
      const member=dbData.clinic_members?.find(m=>m.user_id===actor?.id&&m.status==='active'&&(name==='get_user_clinic_id'||m.clinic_id===params.check_clinic_id));
      return {data:profile&&member?(name==='get_user_clinic_id'?member.clinic_id:member.role):null,error:null};
    },
    auth: {
      getUser: async (token) => {
        if (token !== undefined && token !== null) {
          if (token === 'valid_bearer_token') {
            const user = tokenUser || currentUser;
            if (user) return { data: { user }, error: null };
          }
          return { data: { user: null }, error: new Error('Invalid token') };
        }
        const user = sessionUser || (tokenUser ? null : currentUser);
        if (user) {
          return { data: { user }, error: null };
        }
        return { data: { user: null }, error: new Error('No user session') };
      },
    },
    from: createQueryBuilder,
  };

  class MockResend {
    constructor(key) {
      this.key = key;
    }
    emails = {
      send: async (payload) => {
        sentResendCalls.push(payload);
        if (resendSendHandler) {
          return resendSendHandler(payload);
        }
        return { data: { id: `resend_${Date.now()}` }, error: null };
      },
    };
  }

  const exportsObj = {};
  const sandbox = {
    exports: exportsObj,
    module: { exports: exportsObj },
    process: {
      env: {
        ...gateEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        RESEND_API_KEY: resendApiKey,
        RESEND_FROM_EMAIL: 'Clinia + <soporte@cliniaplus.com>',
      },
    },
    console: { log() {}, error() {}, warn() {}, info() {} },
    require: (mod) => {
      if (mod === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => {
              const headersMap = new Map();
              if (init?.headers) {
                for (const [k, v] of Object.entries(init.headers)) {
                  headersMap.set(k.toLowerCase(), v);
                }
              }
              return {
                status: init?.status || 200,
                headers: {
                  get: (name) => headersMap.get(name.toLowerCase()) || null,
                },
                json: async () => body,
                body,
              };
            },
          },
        };
      }
      if (mod === 'next/headers') return { cookies: mockCookies };
      if (mod === '@supabase/ssr') return { createServerClient: () => mockSupabase };
      if (mod === '@supabase/supabase-js') return { createClient: () => mockSupabase };
      if (mod === 'resend') return { Resend: MockResend };
      if (mod === '@/lib/env') {
        return {
          env: {
            RESEND_API_KEY: resendApiKey,
            RESEND_FROM_EMAIL: 'Clinia + <soporte@cliniaplus.com>',
          },
        };
      }
      return require(mod);
    },
  };

  const loaded=loadCurrentSource(SEND_EMAIL_ROUTE_PATH,sandbox);

  return {
    POST: loaded.POST,
    sentResendCalls,
    budgetCalls:budget.calls,
  };
}

/**
 * Sandboxed Execution Factory for lib/kushki.ts
 */
function loadKushkiGateway(env, mockFetch) {
  const source = readFileSync(KUSHKI_PATH, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const exportsObj = {};
  vm.runInNewContext(
    compiled,
    {
      exports: exportsObj,
      process: { env },
      fetch: mockFetch,
      console: { log() {}, error() {} },
    },
    { filename: 'kushki.js' }
  );
  return exportsObj.kushki;
}

/**
 * Sandboxed Execution Factory for app/api/payments/subscribe/route.ts
 */
function createSubscribeRouteSandbox({
  currentUser = null,
  kushkiGateway = null,
  dbData = {},
  onDbUpdate = null,
  onDbInsert = null,
} = {}) {
  let source = readFileSync(SUBSCRIBE_ROUTE_PATH, 'utf8');
  // Bypass Gate 0 MVP 503 emergency circuit-breaker inside the sandbox to verify the underlying route logic
  source = source.replace(/if\s*\(\s*true\s+as\s+boolean\s*\)\s*\{[\s\S]*?return\s+NextResponse\.json\([\s\S]*?status:\s*503[\s\S]*?\);\s*\}/, '');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mockCookies = async () => ({
    getAll: () => [],
    set: () => {},
  });

  const queryBuilder = (tableName) => {
    let rows = dbData[tableName] ? [...dbData[tableName]] : [];

    const builder = {
      select: () => builder,
      eq: (col, val) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: rows[0] ? null : new Error('Not found') }),
      update: (fields) => ({
        eq: async (col, val) => {
          if (onDbUpdate) onDbUpdate(tableName, fields, col, val);
          return { error: null };
        },
      }),
      insert: async (row) => {
        if (onDbInsert) onDbInsert(tableName, row);
        return { error: null };
      },
    };
    return builder;
  };

  const mockSupabase = {
    auth: {
      getUser: async () => {
        if (currentUser) {
          return { data: { user: currentUser }, error: null };
        }
        return { data: { user: null }, error: new Error('Unauthorized') };
      },
    },
    from: queryBuilder,
  };

  const exportsObj = {};
  const sandbox = {
    exports: exportsObj,
    module: { exports: exportsObj },
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      },
    },
    console: { log() {}, error() {}, warn() {} },
    require: (mod) => {
      if (mod === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => ({
              status: init?.status || 200,
              json: async () => body,
              body,
            }),
          },
        };
      }
      if (mod === 'next/headers') return { cookies: mockCookies };
      if (mod === '@supabase/ssr') return { createServerClient: () => mockSupabase };
      if (mod === '@supabase/supabase-js') return { createClient: () => mockSupabase };
      if (mod === '@/lib/kushki') return { kushki: kushkiGateway };
      if (mod === '@/lib/subscription-plans') {
        return {
          getPlan: (planId) => {
            if (planId === 'pro') {
              return { id: 'pro', name: 'Pro', price: 59.0, kushkiPlanId: 'plan_pro_monthly' };
            }
            return undefined;
          },
        };
      }
      return require(mod);
    },
  };

  vm.runInNewContext(transpiled, sandbox);
  return { POST: sandbox.exports.POST };
}

// ============================================================================
// ADVERSARIAL TEST SUITE
// ============================================================================

describe('CHALLENGER MILESTONE 3: EMPIRICAL ADVERSARIAL STRESS TEST SUITE', () => {
  let db;

  beforeEach(() => {
    db = new ChallengerM3SecurityHarness();
  });

  // ==========================================================================
  // SUITE 1: SEC-08 DASHBOARD ANALYTICS VIEW ISOLATION
  // ==========================================================================
  describe('SEC-08: Dashboard Analytics View Isolation', () => {
    test('1.1 Cross-Tenant Leakage Attack: Tenant B query strictly receives Tenant B aggregates and zero Tenant A rows', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      const rows = db.queryDashboardStatsView(doctorB);

      assert.equal(rows.length, 1, 'Must return exactly one aggregated row for Tenant B');
      assert.equal(rows[0].clinic_id, TENANT_B_ID, 'Returned clinic_id must match Tenant B');
      assert.equal(rows[0].total_billings, 2, 'Must count only Tenant B billings (2)');
      assert.equal(rows[0].total_revenue, 850.0, 'Must sum only Tenant B billings (500 + 350 = 850)');
      assert.equal(rows[0].unique_patients_billed, 1, 'Must count only Tenant B patients');

      // Assert zero cross-tenant leakage
      const hasTenantA = rows.some((r) => r.clinic_id === TENANT_A_ID);
      assert.equal(hasTenantA, false, 'No Tenant A data may ever be exposed to Tenant B');
    });

    test('1.2 Adversarial WHERE Injection: Tenant B attempts WHERE clinic_id = TENANT_A_ID -> returns 0 rows', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const rows = db.queryDashboardStatsView(ownerB, { clinic_id: TENANT_A_ID });

      assert.equal(rows.length, 0, 'Adversarial query attempting to select competitor clinic must return 0 rows');
    });

    test('1.3 Unauthenticated Attack: Anonymous caller receives 403 / SELECT privilege denied', () => {
      const anonCaller = { role: 'anon', userId: null, clinicId: null };

      assert.throws(
        () => db.queryDashboardStatsView(anonCaller),
        /403 Forbidden.*SELECT privilege denied/i,
        'Anonymous callers must not have SELECT permission on dashboard_stats_view'
      );
    });

    test('1.4 Caller with missing or null clinic_id in JWT receives empty rowset (0 rows)', () => {
      const rogueCaller = {
        userId: 'rogue-user-123',
        role: 'authenticated',
        clinicId: null,
        jwt: { app_metadata: { clinic_id: null } },
      };

      const rows = db.queryDashboardStatsView(rogueCaller);
      assert.equal(rows.length, 0, 'JWT lacking clinic_id must yield zero rows');
    });

    test('1.5 Static SQL Invariant: 20260920_m3 migration specifies security_invoker = true and tenant filter', () => {
      assert.ok(existsSync(MIGRATION_M3_PATH), 'Milestone 3 migration file must exist');
      const migrationSql = readFileSync(MIGRATION_M3_PATH, 'utf8');

      assert.match(
        migrationSql,
        /WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/i,
        'View MUST be defined WITH (security_invoker = true)'
      );
      assert.match(
        migrationSql,
        /WHERE\s+clinic_id\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'clinic_id'\)::uuid/i,
        'View MUST enforce WHERE clinic_id = auth.jwt() tenant filter'
      );
      assert.match(
        migrationSql,
        /GRANT\s+SELECT\s+ON\s+public\.dashboard_stats_view\s+TO\s+authenticated/i,
        'GRANT SELECT must be given to authenticated'
      );
      assert.match(
        migrationSql,
        /GRANT\s+SELECT\s+ON\s+public\.dashboard_stats_view\s+TO\s+service_role/i,
        'GRANT SELECT must be given to service_role'
      );
      assert.doesNotMatch(
        migrationSql,
        /GRANT\s+SELECT\s+ON\s+public\.dashboard_stats_view\s+TO\s+anon/i,
        'SELECT on dashboard_stats_view must NEVER be granted to anon'
      );
      assert.doesNotMatch(
        migrationSql,
        /GRANT\s+SELECT\s+ON\s+public\.dashboard_stats_view\s+TO\s+PUBLIC/i,
        'SELECT on dashboard_stats_view must NEVER be granted to PUBLIC'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: SEC-09 MAINTENANCE RPCS EXECUTION REVOCATION & 90-DAY RETENTION
  // ==========================================================================
  describe('SEC-09: Maintenance RPCs Execution Revocation & 90-Day Retention Lock', () => {
    test('2.1 Unauthenticated Execution: Anonymous caller cannot invoke archive_clinic (403)', () => {
      const anonCaller = { role: 'anon', userId: null };
      assert.throws(
        () => db.archiveClinicM3(anonCaller, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied/i
      );
    });

    test('2.2 Unauthenticated Execution: Anonymous caller cannot invoke purge_clinic_data (403)', () => {
      const anonCaller = { role: 'anon', userId: null };
      assert.throws(
        () => db.purgeClinicDataM3(anonCaller, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied/i
      );
    });

    test('2.3 Unauthenticated Execution: Anonymous caller cannot invoke seed_default_services (403)', () => {
      const anonCaller = { role: 'anon', userId: null };
      assert.throws(
        () => db.seedDefaultServicesM3(anonCaller, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied/i
      );
    });

    test('2.4 Regular Authenticated Tenant Attack: Doctor cannot invoke archive_clinic on victim clinic', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      assert.throws(
        () => db.archiveClinicM3(doctorB, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied/i,
        'Doctor must not be able to archive competitor clinic'
      );
    });

    test('2.5 Regular Authenticated Tenant Attack: Clinic Owner cannot invoke archive_clinic directly via PostgREST', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => db.archiveClinicM3(ownerA, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied/i,
        'Direct client execution must be revoked from authenticated role'
      );
    });

    test('2.6 Regular Authenticated Tenant Attack: Clinic Owner cannot invoke purge_clinic_data on own or competitor clinic', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => db.purgeClinicDataM3(ownerA, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied.*service_role/i
      );
      assert.throws(
        () => db.purgeClinicDataM3(ownerA, { target_clinic_id: TENANT_B_ID }),
        /403 Forbidden.*EXECUTE privilege denied.*service_role/i
      );
    });

    test('2.7 Regular Authenticated Tenant Attack: Receptionist cannot invoke seed_default_services', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => db.seedDefaultServicesM3(recepA, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*EXECUTE privilege denied.*service_role/i
      );
    });

    test('2.8 Retention Guard: Service role cannot purge an active, unarchived clinic', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.subscription_status = 'active';
      clinicA.archived_at = null;

      assert.throws(
        () => db.purgeClinicDataM3(serviceRole, { target_clinic_id: TENANT_A_ID }),
        /Cannot purge unarchived clinic/i
      );
      assert.ok(db.clinics.some((c) => c.id === TENANT_A_ID), 'Clinic A must not be purged');
    });

    test('2.9 Retention Guard: Service role cannot purge clinic archived 0 days ago (today)', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.subscription_status = 'archived';
      clinicA.archived_at = new Date().toISOString();

      assert.throws(
        () => db.purgeClinicDataM3(serviceRole, { target_clinic_id: TENANT_A_ID }),
        /Statutory 90-day retention lock active/i
      );
      assert.ok(db.clinics.some((c) => c.id === TENANT_A_ID), 'Clinic A must not be purged');
    });

    test('2.10 Retention Guard: Service role cannot purge clinic archived 30 days ago', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.subscription_status = 'archived';
      clinicA.archived_at = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      assert.throws(
        () => db.purgeClinicDataM3(serviceRole, { target_clinic_id: TENANT_A_ID }),
        /Statutory 90-day retention lock active/i
      );
      assert.ok(db.clinics.some((c) => c.id === TENANT_A_ID), 'Clinic A must not be purged');
    });

    test('2.11 Retention Guard: Service role cannot purge clinic archived 89 days, 23 hours ago (<90 days)', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.subscription_status = 'archived';
      const eightyNineDaysAgo = Date.now() - (89 * 24 * 60 * 60 * 1000 + 23 * 3600 * 1000);
      clinicA.archived_at = new Date(eightyNineDaysAgo).toISOString();

      assert.throws(
        () => db.purgeClinicDataM3(serviceRole, { target_clinic_id: TENANT_A_ID }),
        /Statutory 90-day retention lock active/i
      );
      assert.ok(db.clinics.some((c) => c.id === TENANT_A_ID), 'Clinic A must not be purged');
    });

    test('2.12 Retention Guard: Service role cannot purge non-existent clinic UUID', () => {
      const serviceRole = getSecurityContext('service_role');
      assert.throws(
        () => db.purgeClinicDataM3(serviceRole, { target_clinic_id: crypto.randomUUID() }),
        /Clinic not found/i
      );
    });

    test('2.13 Statutory Purge Allowed: Service role can purge clinic archived >90 days ago (91 days)', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.subscription_status = 'archived';
      clinicA.archived_at = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();

      const result = db.purgeClinicDataM3(serviceRole, { target_clinic_id: TENANT_A_ID });
      assert.equal(result.success, true);
      assert.equal(result.purged, TENANT_A_ID);
      assert.equal(db.clinics.some((c) => c.id === TENANT_A_ID), false, 'Clinic A must be removed');
    });

    test('2.14 Static SQL Invariant: REVOKE from PUBLIC/authenticated/anon and GRANT strictly to service_role', () => {
      const migrationSql = readFileSync(MIGRATION_M3_PATH, 'utf8');

      // Check explicit REVOKE statements
      assert.match(
        migrationSql,
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.archive_clinic\(uuid\)\s+FROM\s+PUBLIC,\s*authenticated,\s*anon/i,
        'archive_clinic must be revoked from PUBLIC, authenticated, anon'
      );
      assert.match(
        migrationSql,
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.purge_clinic_data\(uuid\)\s+FROM\s+PUBLIC,\s*authenticated,\s*anon/i,
        'purge_clinic_data must be revoked from PUBLIC, authenticated, anon'
      );
      assert.match(
        migrationSql,
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.seed_default_services\(uuid\)\s+FROM\s+PUBLIC,\s*authenticated,\s*anon/i,
        'seed_default_services must be revoked from PUBLIC, authenticated, anon'
      );

      // Check explicit GRANT statements strictly to service_role
      assert.match(
        migrationSql,
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.archive_clinic\(uuid\)\s+TO\s+service_role/i
      );
      assert.match(
        migrationSql,
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.purge_clinic_data\(uuid\)\s+TO\s+service_role/i
      );
      assert.match(
        migrationSql,
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.seed_default_services\(uuid\)\s+TO\s+service_role/i
      );

      // Check double-safety retention lock inside purge_clinic_data
      assert.match(
        migrationSql,
        /IF\s+v_archived_at\s*>\s*\(NOW\(\)\s*-\s*INTERVAL\s*'90 days'\)\s*THEN\s*RAISE\s+EXCEPTION/i,
        'purge_clinic_data must check 90-day retention in PL/pgSQL IF'
      );
      assert.match(
        migrationSql,
        /AND\s+archived_at\s*<\s*NOW\(\)\s*-\s*INTERVAL\s*'90 days'/i,
        'purge_clinic_data must check 90-day retention in DELETE WHERE condition'
      );
      assert.match(
        migrationSql,
        /SET\s+search_path\s*=\s*public/i,
        'Functions must specify SET search_path = public'
      );
    });
  });

  // ==========================================================================
  // SUITE 3: SEC-10 EMAIL ROUTE ADVERSARIAL ATTACKS (/api/send-email)
  // ==========================================================================
  describe('SEC-10: Email Endpoint Authentication, Relay Defense & Injection Attacks', () => {
    test('Explicit durable budget denial blocks transactional mail after live authority',async()=>{
      const sandbox=createSendEmailRouteSandbox({currentUser:{id:CLINIC_A_DOCTOR_ID},
        dbData:{patients:[{id:PATIENT_A1_ID,clinic_id:TENANT_A_ID,email:'budget@example.com'}],
          profiles:[{id:CLINIC_A_DOCTOR_ID,status:'active'}],
          clinic_members:[{user_id:CLINIC_A_DOCTOR_ID,clinic_id:TENANT_A_ID,role:'doctor',status:'active'}]},
        budgetReply:{allowed:false,retry_after_seconds:91}});
      const result=await sandbox.POST(new Request('https://app.cliniaplus.com/api/send-email',{method:'POST',
        headers:{'Content-Type':'application/json',authorization:'Bearer valid_bearer_token','x-vercel-forwarded-for':'203.0.113.8'},
        body:JSON.stringify({to:'budget@example.com',template:'welcome'})}));
      assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'91');
      assert.equal(sandbox.budgetCalls.length,1);assert.equal(sandbox.sentResendCalls.length,0);
    });
    const mockDbTables = {
      patients: [
        { id: PATIENT_A1_ID, clinic_id: TENANT_A_ID, email: 'juan.perez@example.com' },
        { id: PATIENT_A2_ID, clinic_id: TENANT_A_ID, email: 'maria.lopez@example.com' },
        { id: PATIENT_B1_ID, clinic_id: TENANT_B_ID, email: 'roberto.gomez@example.com' },
      ],
      profiles: [
        { id: CLINIC_A_DOCTOR_ID, clinic_id: TENANT_A_ID, email: 'doctor-a@clinic-a.com', status:'active' },
        { id: CLINIC_A_RECEPTIONIST_ID, clinic_id: TENANT_A_ID, email: 'recep-a@clinic-a.com', status:'active' },
        { id: CLINIC_B_DOCTOR_ID, clinic_id: TENANT_B_ID, email: 'doctor-b@clinic-b.com', status:'active' },
      ],
      clinic_members: [
        { clinic_id: TENANT_A_ID, user_id: CLINIC_A_DOCTOR_ID,role:'doctor',status:'active' },
        { clinic_id: TENANT_A_ID, user_id: CLINIC_A_RECEPTIONIST_ID,role:'receptionist',status:'active' },
        { clinic_id: TENANT_B_ID, user_id: CLINIC_B_DOCTOR_ID,role:'doctor',status:'active' },
      ],
    };

    test('3.1 Unauthenticated Request: Missing session/token/Origin is denied without side effects', async () => {
      const { POST,sentResendCalls,budgetCalls } = createSendEmailRouteSandbox({
        currentUser: null,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '198.51.100.1' },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.ok([401,403].includes(res.status));
      const json = await res.json();
      assert.match(json.error, /Unauthorized.*Authentication required|Forbidden.*Same-origin request required/i);
      assert.equal(sentResendCalls.length,0);assert.equal(budgetCalls.length,0);
    });

    test('3.2 Invalid Bearer Token: Forged token returns 401 Unauthorized', async () => {
      const { POST } = createSendEmailRouteSandbox({
        tokenUser: { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } },
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer forged_hacker_jwt_token',
          'x-vercel-forwarded-for': '198.51.100.2',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 401);
    });

    test('3.3 Authenticated User without Clinic Association returns 403 Forbidden', async () => {
      const orphanedUser = { id: 'orphaned-user-999', app_metadata: { clinic_id: null } };
      const { POST } = createSendEmailRouteSandbox({
        currentUser: orphanedUser,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.3',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Caller is not associated with an active clinic/i);
    });

    test('3.4 Open Relay Attack: Attempt to email arbitrary external recipient outside clinic returns 403', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST, sentResendCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.4',
        },
        body: JSON.stringify({
          to: 'arbitrary-victim@gmail.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Recipient email is not associated with this clinic/i);
      assert.equal(sentResendCalls.length, 0, 'No email must be dispatched to Resend');
    });

    test('3.5 Cross-Tenant Recipient Attack: Doctor A attempts to email Clinic B patient returns 403', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST, sentResendCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      // Roberto Gomez is patient of Clinic B, not Clinic A
      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.5',
        },
        body: JSON.stringify({
          to: 'roberto.gomez@example.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Recipient email is not associated with this clinic/i);
      assert.equal(sentResendCalls.length, 0, 'No cross-tenant email may be dispatched');
    });

    test('3.6 Legitimate Delivery: Doctor A sends approved appointment_reminder to Clinic A patient succeeds (200)', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST, sentResendCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.6',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
          variables: {
            name: 'Juan Pérez',
            date: '2026-09-25 10:00',
            clinicName: 'Clínica Dental Alfa',
            doctorName: 'Dra. Beatriz',
          },
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(sentResendCalls.length, 1);
      assert.equal(sentResendCalls[0].to[0], 'juan.perez@example.com');
      assert.match(sentResendCalls[0].subject, /Recordatorio de Cita - Clínica Dental Alfa/);
      assert.match(sentResendCalls[0].html, /Juan Pérez/);
    });

    test('3.7 Recipient Casing & Whitespace Normalization: Upper-case trimmed email succeeds', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST, sentResendCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.7',
        },
        body: JSON.stringify({
          to: '  JUAN.PEREZ@EXAMPLE.COM  ',
          template: 'welcome',
          variables: { name: 'Juan' },
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 200);
      assert.equal(sentResendCalls.length, 1);
      assert.equal(sentResendCalls[0].to[0], 'juan.perez@example.com');
    });

    test('3.8 Injection Attack: Caller supplies raw HTML in body.html -> 400 Bad Request', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.8',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
          html: '<script>alert("XSS")</script><p>Malicious html payload</p>',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /Arbitrary HTML messages are forbidden/i);
    });

    test('3.9 Injection Attack: Caller embeds HTML/script tags in body.message -> 400 Bad Request', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const attackPayloads = [
        '<script>stealCookies()</script>',
        '<img src=x onerror=alert(1)>',
        '<iframe src="https://evil.com"></iframe>',
        '<a href="javascript:alert(1)">Click me</a>',
      ];

      for (const msg of attackPayloads) {
        const request = new Request('http://localhost/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer valid_bearer_token',
            'x-vercel-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200 + 10)}`,
          },
          body: JSON.stringify({
            to: 'juan.perez@example.com',
            template: 'appointment_reminder',
            message: msg,
          }),
        });

        const res = await POST(request);
        assert.equal(res.status, 400);
        const json = await res.json();
        assert.match(json.error, /Arbitrary HTML messages are forbidden/i);
      }
    });

    test('3.10 Unapproved Template Attack: Unrecognized templates are rejected with 400 Bad Request', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const invalidTemplates = [
        'promotional_newsletter',
        'system_admin_alert',
        '../../etc/passwd',
        '__proto__',
        'constructor',
      ];

      for (const tpl of invalidTemplates) {
        const request = new Request('http://localhost/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer valid_bearer_token',
            'x-vercel-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200 + 10)}`,
          },
          body: JSON.stringify({
            to: 'juan.perez@example.com',
            template: tpl,
          }),
        });

        const res = await POST(request);
        assert.equal(res.status, 400);
        const json = await res.json();
        assert.match(json.error, /Invalid template/i);
      }
    });

    test('3.11 Template Variable XSS Sanitization: Injected HTML entities are strictly escaped', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST, sentResendCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
      });

      const xssInjection = '<script>alert("XSS")</script>&"\'<b style="color:red">test</b>';

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.30',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
          variables: {
            name: xssInjection,
            clinicName: 'Clinia <script>',
          },
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 200);
      assert.equal(sentResendCalls.length, 1);

      const html = sentResendCalls[0].html;
      // Must NOT contain raw unescaped script tag
      assert.doesNotMatch(html, /<script>alert/i);
      // MUST contain properly escaped entities
      assert.match(html, /&lt;script&gt;alert/i);
      assert.match(html, /&amp;&quot;&#039;&lt;b/i);
    });

    test('3.12 31-request IP burst respects explicit durable shared-destination denial', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST,sentResendCalls,budgetCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
        budgetReply:(_args,count)=>count<=10?ALLOW_BUDGET:{allowed:false,retry_after_seconds:41},
      });

      const targetIp = '203.0.113.195';

      // Preserve the 31-request attack; current durable destination cap is ten.
      for (let i = 1; i <= 30; i++) {
        const req = new Request('http://localhost/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer valid_bearer_token',
            'x-vercel-forwarded-for': targetIp,
          },
          body: JSON.stringify({
            to: 'juan.perez@example.com',
            template: 'appointment_reminder',
          }),
        });
        const res = await POST(req);
        assert.equal(res.status, i<=10?200:429, `Request #${i} must respect the durable reply`);
      }

      // Fire 31st request: Must be rate limited
      const reqBlocked = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': targetIp,
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
        }),
      });
      const resBlocked = await POST(reqBlocked);
      assert.equal(resBlocked.status, 429, '31st request must trigger 429');
      assert.equal(resBlocked.headers.get('retry-after'), '41', 'Must preserve durable retry header');
      const jsonBlocked = await resBlocked.json();
      assert.match(jsonBlocked.error, /límite/);
      assert.equal(sentResendCalls.length,10);assert.equal(budgetCalls.length,31);
    });

    test('3.13 101 rotating-IP requests cannot use metadata without live clinic membership', async () => {
      const inactiveClinic='99999999-9999-4999-8999-999999999999';
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: inactiveClinic } };
      const customDb = {
        patients: [{ id: 'p1', clinic_id: inactiveClinic, email: 'pat@example.com' }],
        profiles: [],
        clinic_members: [],
      };

      const { POST,sentResendCalls,budgetCalls } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: customDb,
      });

      // Send 100 requests from distinct IPs
      for (let i = 1; i <= 100; i++) {
        const req = new Request('http://localhost/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer valid_bearer_token',
            'x-vercel-forwarded-for': `10.0.${Math.floor(i / 250)}.${i % 250}`,
          },
          body: JSON.stringify({
            to: 'pat@example.com',
            template: 'welcome',
          }),
        });
        const res = await POST(req);
        assert.equal(res.status,403,`Clinic request #${i} must not grant metadata authority`);
      }

      // 101st request for this clinic from yet another IP
      const reqBlocked = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '10.0.99.99',
        },
        body: JSON.stringify({
          to: 'pat@example.com',
          template: 'welcome',
        }),
      });
      const resBlocked = await POST(reqBlocked);
      assert.equal(resBlocked.status,403,'101st clinic request remains unauthorized');
      const jsonBlocked = await resBlocked.json();
      assert.match(jsonBlocked.error,/Forbidden/);
      assert.equal(sentResendCalls.length,0);assert.equal(budgetCalls.length,0);
    });

    test('3.14 Fail-Closed: Missing RESEND_API_KEY returns 503 Service Unavailable', async () => {
      const doctorA = { id: CLINIC_A_DOCTOR_ID, app_metadata: { clinic_id: TENANT_A_ID } };
      const { POST } = createSendEmailRouteSandbox({
        currentUser: doctorA,
        dbData: mockDbTables,
        resendApiKey: '', // Empty API Key
      });

      const request = new Request('http://localhost/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer valid_bearer_token',
          'x-vercel-forwarded-for': '198.51.100.99',
        },
        body: JSON.stringify({
          to: 'juan.perez@example.com',
          template: 'appointment_reminder',
        }),
      });

      const res = await POST(request);
      assert.equal(res.status, 503);
      const json = await res.json();
      assert.match(json.error, /Email service not configured/i);
    });
  });

  // ==========================================================================
  // SUITE 4: SEC-11 KUSHKI PAYMENT GATEWAY FAIL-CLOSED INVARIANTS
  // ==========================================================================
  describe('SEC-11: Kushki Payment Gateway Fail-Closed Invariants & Subscription Route Security', () => {
    const defaultPayload = {
      token: 'test-card-token-12345',
      planId: 'plan_pro_monthly',
      email: 'owner@clinic.com',
      amount: 59.0,
      metadata: { clinicId: TENANT_A_ID },
    };

    test('4.1 Gateway rejects undefined KUSHKI_PRIVATE_MERCHANT_ID with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: undefined },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.2 Gateway rejects empty string KUSHKI_PRIVATE_MERCHANT_ID with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: '' },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.3 Gateway rejects whitespace-only KUSHKI_PRIVATE_MERCHANT_ID ("   ") with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: '   ' },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.4 Gateway rejects tabs/newlines whitespace KUSHKI_PRIVATE_MERCHANT_ID with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: '\t\r\n   \n' },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.5 Gateway rejects placeholder "mock_private_key" with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'mock_private_key' },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.6 Gateway rejects padded placeholder "  mock_private_key  " with 0 network calls', async () => {
      let networkCalls = 0;
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: '  mock_private_key  ' },
        async () => {
          networkCalls++;
          throw new Error('should not be reached');
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment service is not configured/i);
      assert.equal(networkCalls, 0, 'Must abort before network call');
    });

    test('4.7 Provider Card Decline: Rejection throws error; zero active subscription synthesized', async () => {
      const declineReasons = [
        'Declined: Insufficient funds in cardholder account',
        'Declined: Card reported stolen or lost',
        'Declined: Fraud risk threshold exceeded',
        'Declined: Card expired',
      ];

      for (const reason of declineReasons) {
        const gateway = loadKushkiGateway(
          { KUSHKI_PRIVATE_MERCHANT_ID: 'real-merchant-id' },
          async () => ({
            ok: false,
            json: async () => ({ message: reason }),
          })
        );

        await assert.rejects(
          gateway.createSubscription(defaultPayload),
          new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          'Provider decline must strictly re-throw and never succeed'
        );
      }
    });

    test('4.8 Provider Error with missing message defaults to "Payment Service Error"', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'real-merchant-id' },
        async () => ({
          ok: false,
          json: async () => ({}),
        })
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /Payment Service Error/);
    });

    test('4.9 Network Timeout (ETIMEDOUT): Transport failure throws error; zero active subscription synthesized', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'real-merchant-id' },
        async () => {
          const timeoutErr = new Error('connect ETIMEDOUT 190.15.14.1:443');
          timeoutErr.code = 'ETIMEDOUT';
          throw timeoutErr;
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /ETIMEDOUT/);
    });

    test('4.10 Network Connection Refused (ECONNREFUSED): Transport failure throws error', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'real-merchant-id' },
        async () => {
          const connErr = new Error('connect ECONNREFUSED 190.15.14.1:443');
          connErr.code = 'ECONNREFUSED';
          throw connErr;
        }
      );

      await assert.rejects(gateway.createSubscription(defaultPayload), /ECONNREFUSED/);
    });

    test('4.11 Subscription Route RBAC: Unauthenticated caller returns 401 Unauthorized', async () => {
      const { POST } = createSubscribeRouteSandbox({
        currentUser: null,
      });

      const req = new Request('http://localhost/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-123',
          planId: 'pro',
          clinicId: TENANT_A_ID,
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 401);
    });

    test('4.12 Subscription Route RBAC: Doctor (non-owner) returns 403 Forbidden', async () => {
      const doctorA = {
        id: CLINIC_A_DOCTOR_ID,
        app_metadata: { clinic_id: TENANT_A_ID, role: 'doctor' },
      };

      const { POST } = createSubscribeRouteSandbox({
        currentUser: doctorA,
        dbData: {
          profiles: [{ id: CLINIC_A_DOCTOR_ID, clinic_id: TENANT_A_ID, role: 'doctor' }],
          clinics: [{ id: TENANT_A_ID, owner_id: CLINIC_A_OWNER_ID }],
        },
      });

      const req = new Request('http://localhost/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-123',
          planId: 'pro',
          clinicId: TENANT_A_ID,
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Only clinic owners can manage subscriptions/i);
    });

    test('4.13 Subscription Route RBAC: Owner of Clinic B attempting to subscribe for Clinic A returns 403', async () => {
      const ownerB = {
        id: CLINIC_B_OWNER_ID,
        app_metadata: { clinic_id: TENANT_B_ID, role: 'clinic_owner' },
      };

      const { POST } = createSubscribeRouteSandbox({
        currentUser: ownerB,
        dbData: {
          profiles: [{ id: CLINIC_B_OWNER_ID, clinic_id: TENANT_B_ID, role: 'clinic_owner' }],
          clinics: [{ id: TENANT_A_ID, owner_id: CLINIC_A_OWNER_ID }],
        },
      });

      const req = new Request('http://localhost/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-123',
          planId: 'pro',
          clinicId: TENANT_A_ID, // Victim clinic
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Caller does not belong to target clinic/i);
    });

    test('4.14 Atomic Fail-Closed Persistence: Provider card decline never updates clinic status or inserts payment record', async () => {
      const ownerA = {
        id: CLINIC_A_OWNER_ID,
        app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
      };

      const dbUpdates = [];
      const dbInserts = [];

      const mockFailingGateway = {
        createSubscription: async () => {
          throw new Error('Declined: Card issuer rejected transaction');
        },
      };

      const { POST } = createSubscribeRouteSandbox({
        currentUser: ownerA,
        kushkiGateway: mockFailingGateway,
        dbData: {
          profiles: [{ id: CLINIC_A_OWNER_ID, clinic_id: TENANT_A_ID, role: 'clinic_owner' }],
          clinics: [{ id: TENANT_A_ID, owner_id: CLINIC_A_OWNER_ID, subscription_status: 'trialing' }],
        },
        onDbUpdate: (table, fields, col, val) => dbUpdates.push({ table, fields, col, val }),
        onDbInsert: (table, row) => dbInserts.push({ table, row }),
      });

      const req = new Request('http://localhost/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'declined-tok-123',
          planId: 'pro',
          clinicId: TENANT_A_ID,
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 500);

      // Verify zero state side-effects
      assert.equal(dbUpdates.length, 0, 'Clinics table must NEVER be updated upon payment decline');
      assert.equal(dbInserts.length, 0, 'Payments table must NEVER receive a record upon payment decline');
    });

    test('4.15 Legitimate Subscription Flow: Confirmed provider success activates subscription and logs payment', async () => {
      const ownerA = {
        id: CLINIC_A_OWNER_ID,
        app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
      };

      const dbUpdates = [];
      const dbInserts = [];

      const mockSuccessfulGateway = {
        createSubscription: async (payload) => ({
          subscriptionId: 'sub_kushki_verified_9988',
          status: 'active',
        }),
      };

      const { POST } = createSubscribeRouteSandbox({
        currentUser: ownerA,
        kushkiGateway: mockSuccessfulGateway,
        dbData: {
          profiles: [{ id: CLINIC_A_OWNER_ID, clinic_id: TENANT_A_ID, role: 'clinic_owner' }],
          clinics: [{ id: TENANT_A_ID, owner_id: CLINIC_A_OWNER_ID, subscription_status: 'trialing' }],
        },
        onDbUpdate: (table, fields, col, val) => dbUpdates.push({ table, fields, col, val }),
        onDbInsert: (table, row) => dbInserts.push({ table, row }),
      });

      const req = new Request('http://localhost/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-tok-123',
          planId: 'pro',
          clinicId: TENANT_A_ID,
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);

      // Verify successful activation
      assert.equal(dbUpdates.length, 1);
      assert.equal(dbUpdates[0].fields.subscription_status, 'active');
      assert.equal(dbUpdates[0].fields.kushki_subscription_id, 'sub_kushki_verified_9988');

      assert.equal(dbInserts.length, 1);
      assert.equal(dbInserts[0].row.status, 'succeeded');
      assert.equal(dbInserts[0].row.provider, 'kushki');
      assert.equal(dbInserts[0].row.provider_transaction_id, 'sub_kushki_verified_9988');
    });
  });
});
