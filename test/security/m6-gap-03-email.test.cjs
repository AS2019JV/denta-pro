/**
 * Gate 6 Verification Suite: M6-GAP-03 Email Route Security Hardening
 *
 * Verifies that app/api/send-email/route.ts strictly adheres to M6-GAP-03:
 * 1. NEGATIVE INVARIANTS:
 *    - Rejects foreign links (e.g. evil-phishing.com) in variables.link / paymentLink / url with 400 Bad Request.
 *    - Rejects dangerous protocols (javascript:, data:, ftp:, file:, unencrypted remote http:) with 400 Bad Request.
 *    - Rejects subdomain spoofing (evil-cliniaplus.com, fake-cliniaplus.com, cliniaplus.com.attacker.com) with 400 Bad Request.
 *    - Rejects oversized payloads (>64KB) with exact 400 Bad Request message.
 *    - Rejects oversized template variables (>2048 chars) with 400 Bad Request.
 * 2. POSITIVE PATHS:
 *    - Approved production links (cliniaplus.com, app.cliniaplus.com, denta-pro.vercel.app, localhost) succeed (200) and render sanitized.
 *    - Configured Supabase project URL host passes (200).
 *    - Templates without links (welcome, recall_notice, appointment_reminder) succeed (200).
 * 3. PRESERVED INVARIANTS:
 *    - Unauthenticated request returns 401 Unauthorized.
 *    - User without clinic or inactive returns 403 Forbidden.
 *    - Cross-tenant recipient returns 403 Forbidden.
 *    - Original 31/101-request bursts respect explicit durable RPC denial and its Retry-After.
 *      This suite mocks quota replies; shared SQL quotas are verified independently.
 *    - Missing RESEND_API_KEY returns 503 Service Unavailable.
 */

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, describe } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const {loadCurrentSource,gateEnv,ALLOW_BUDGET,durableBudgetFixture}=require('./harness/current-source-loader.cjs');

const ROOT_DIR = join(__dirname, '../..');
const SEND_EMAIL_ROUTE_PATH = join(ROOT_DIR, 'app/api/send-email/route.ts');

const CLINIC_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_EMAIL = 'paciente.valido@cliniaplus.com';
const DOCTOR_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const defaultDbData = {
  patients: [
    { id: 'pat-001', clinic_id: CLINIC_ID, email: PATIENT_EMAIL, deleted_at: null },
  ],
  profiles: [
    { id: DOCTOR_USER_ID, clinic_id: CLINIC_ID, email: 'doctor@cliniaplus.com', status: 'active' },
  ],
  clinic_members: [
    { clinic_id: CLINIC_ID, user_id: DOCTOR_USER_ID, status: 'active', role: 'doctor' },
  ],
  clinics: [
    { id: CLINIC_ID, owner_id: DOCTOR_USER_ID },
  ],
};

function createSendEmailSandbox({
  currentUser = { id: DOCTOR_USER_ID, app_metadata: { clinic_id: CLINIC_ID, role: 'doctor' } },
  dbData = defaultDbData,
  resendApiKey = 're_test_valid_api_key_123',
  supabaseUrl = 'https://app-tenant.supabase.co',
  budgetReply = ALLOW_BUDGET,
} = {}) {
  const source = readFileSync(SEND_EMAIL_ROUTE_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const sentEmails = [];
  const budget=durableBudgetFixture(budgetReply);

  const createQueryBuilder = (tableName) => {
    let rows = dbData[tableName] ? [...dbData[tableName]] : [];

    const builder = {
      select: () => builder,
      eq: (col, val) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      is: (col, val) => {
        rows = rows.filter((r) => r[col] === val || (val === null && (r[col] === undefined || r[col] === null)));
        return builder;
      },
      in: (col, vals) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return builder;
      },
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: rows[0] ? null : new Error('Not found') }),
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return builder;
  };

  const mockSupabase = {
    rpc: async (name, params) => {
      if(name==='consume_email_abuse_budget')return budget.rpc(name,params);
      assert.ok(['get_user_clinic_id','get_clinic_member_role'].includes(name));
      const profile = dbData.profiles?.find(p => p.id === currentUser?.id);
      const membership = dbData.clinic_members?.find(m => m.user_id === currentUser?.id
        && m.status === 'active' && (name === 'get_user_clinic_id' || m.clinic_id === params.check_clinic_id));
      const active = profile?.status === 'active' && profile.deleted_at == null;
      return {data: active && membership ? name === 'get_user_clinic_id' ? membership.clinic_id : membership.role : null, error: null};
    },
    auth: {
      getUser: async () => {
        if (currentUser) return { data: { user: currentUser }, error: null };
        return { data: { user: null }, error: new Error('Unauthorized') };
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
        sentEmails.push(payload);
        return { data: { id: `email_${Date.now()}` }, error: null };
      },
    };
  }

  const exportsObj = {};
  const sandbox = {
    exports: exportsObj,
    module: { exports: exportsObj },
    URL,
    Buffer,
    TextEncoder,
    process: {
      env: {
        ...gateEnv,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
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
      if (mod === 'next/headers') {
        return {
          cookies: async () => ({
            getAll: () => [],
            set: () => {},
          }),
        };
      }
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
    sentEmails,
    budgetCalls:budget.calls,
  };
}

describe('M6-GAP-03: Transactional Email Route Security Hardening (/api/send-email)', () => {
  test('Explicit durable budget denial returns its retry and performs no delivery',async()=>{
    const sandbox=createSendEmailSandbox({budgetReply:{allowed:false,retry_after_seconds:37}});
    const result=await sandbox.POST(new Request('https://app.cliniaplus.com/api/send-email',{method:'POST',
      headers:{'Content-Type':'application/json',Origin:'https://app.cliniaplus.com','x-vercel-forwarded-for':'203.0.113.7'},
      body:JSON.stringify({to:PATIENT_EMAIL,template:'welcome'})}));
    assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'37');
    assert.equal(sandbox.budgetCalls.length,1);assert.equal(sandbox.sentEmails.length,0);
  });
  const routeSource = readFileSync(SEND_EMAIL_ROUTE_PATH, 'utf8');

  // ==========================================================================
  // SUITE 1: STATIC AST & CONTRACT CHECKS
  // ==========================================================================
  describe('1. Static AST Invariants', () => {
    test('Defines isAllowedLinkHost validator preventing spoofing', () => {
      assert.ok(routeSource.includes('function isAllowedLinkHost'), 'Must define host allowlist validator');
      assert.ok(routeSource.includes('cliniaplus.com'), 'Must allow production domain');
      assert.ok(routeSource.includes('.endsWith(\'.cliniaplus.com\')'), 'Must strictly check .cliniaplus.com subdomain');
      assert.ok(!routeSource.includes("host.endsWith('cliniaplus.com')"), 'Must not allow dot-less subdomain suffix matching');
    });

    test('Enforces 64KB body and 2048 variable limits', () => {
      assert.ok(routeSource.includes('65536'), 'Must check 65536 byte payload cap');
      assert.ok(routeSource.includes('2048'), 'Must check 2048 character variable limit');
      assert.ok(routeSource.includes('Payload exceeds size limit of 64KB'), 'Must return exact 64KB error message');
    });

    test('Fails closed on untrusted link host with exact error message', () => {
      assert.ok(
        routeSource.includes('Bad Request: Untrusted or invalid link destination host'),
        'Must return exact 400 error message on untrusted link'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: NEGATIVE INVARIANTS - UNTRUSTED LINKS & DANGEROUS PROTOCOLS
  // ==========================================================================
  describe('2. Negative Invariants: Link Destination Validation', () => {
    test('Rejects foreign phishing link in variables.link (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.1' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://evil-phishing.com/steal-data' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0, 'Must NOT dispatch email on untrusted link');
    });

    test('Rejects foreign link in variables.paymentLink (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.2' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'appointment_reminder',
          variables: { paymentLink: 'https://fake-checkout.org/pay' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects dangerous protocol javascript:alert(1) (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.3' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'javascript:alert(document.cookie)' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects dangerous protocol data:text/html (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.4' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'data:text/html,<script>alert(1)</script>' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects dangerous protocol ftp://evil.com (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.5' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'ftp://evil.com/malware.exe' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects unencrypted HTTP protocol for remote hosts (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.6' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'http://cliniaplus.com/unencrypted-rx' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects unparseable malformed URL string (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.7' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'not-a-valid-url://////' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects foreign link in variables.url (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.8' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { url: 'https://evil-phishing.com/steal-url' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects non-string variables.link type (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.9' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 12345 },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects foreign link in templateParams (400 Bad Request)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.1.10' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {},
          templateParams: { link: 'https://evil-phishing.com/steal-params' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });
  });

  // ==========================================================================
  // SUITE 3: NEGATIVE INVARIANTS - SUBDOMAIN SPOOFING DEFENSE
  // ==========================================================================
  describe('3. Negative Invariants: Subdomain Spoofing Defense', () => {
    test('Rejects hyphenated suffix spoofing https://fake-cliniaplus.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.1' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://fake-cliniaplus.com/rx/123' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects evil-cliniaplus.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.2' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://evil-cliniaplus.com' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects suffix attacker host https://cliniaplus.com.attacker.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.3' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://cliniaplus.com.attacker.com/rx' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects leading dot subdomain https://.cliniaplus.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.4' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://.cliniaplus.com/rx' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects double dot subdomain https://..cliniaplus.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.5' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://..cliniaplus.com/rx' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });

    test('Rejects cyrillic punycode homoglyph spoofing https://cliniаplus.com (400)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.2.6' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: { link: 'https://clini\u0430plus.com/rx' },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Untrusted or invalid link destination host');
      assert.equal(sentEmails.length, 0);
    });
  });

  // ==========================================================================
  // SUITE 4: NEGATIVE INVARIANTS - PAYLOAD LIMITS
  // ==========================================================================
  describe('4. Negative Invariants: Payload & Variable Size Limits', () => {
    test('Rejects oversized payload > 64KB (65536 bytes) with 400 Bad Request', async () => {
      const { POST } = createSendEmailSandbox();
      const hugePadding = 'X'.repeat(70000);
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.3.1' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'welcome',
          variables: { name: 'Juan', padding: hugePadding },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Payload exceeds size limit of 64KB');
    });

    test('Rejects oversized variable > 2048 characters with 400 Bad Request', async () => {
      const { POST } = createSendEmailSandbox();
      const longName = 'A'.repeat(2049);
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.3.2' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'welcome',
          variables: { name: longName },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /exceeds maximum length of 2048 characters/i);
    });

    test('Rejects oversized variable inside array > 2048 chars (400 Bad Request)', async () => {
      const { POST } = createSendEmailSandbox();
      const longItem = 'B'.repeat(3000);
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.3.3' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'welcome',
          variables: { items: [longItem] },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /exceeds maximum length of 2048 characters/i);
    });

    test('Rejects non-object variables payload (400 Bad Request)', async () => {
      const { POST } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.3.4' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'welcome',
          variables: 'not-an-object',
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Template variables must be an object');
    });

    test('Rejects payload exceeding 64KB boundary at 65537 bytes (400 Bad Request)', async () => {
      const { POST } = createSendEmailSandbox();
      const basePayload = JSON.stringify({
        to: PATIENT_EMAIL,
        template: 'welcome',
        variables: { name: 'A' },
        pad: '',
      });
      const neededPadding = 65537 - Buffer.byteLength(basePayload, 'utf8');
      const paddedPayload = JSON.stringify({
        to: PATIENT_EMAIL,
        template: 'welcome',
        variables: { name: 'A' },
        pad: 'Z'.repeat(neededPadding),
      });

      assert.equal(Buffer.byteLength(paddedPayload, 'utf8'), 65537);

      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.3.5' },
        body: paddedPayload,
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, 'Bad Request: Payload exceeds size limit of 64KB');
    });
  });

  // ==========================================================================
  // SUITE 5: POSITIVE PATHS - APPROVED LINKS & TEMPLATES
  // ==========================================================================
  describe('5. Positive Paths: Approved Links & Templates', () => {
    test('Approved production link https://cliniaplus.com/rx/abc succeeds (200) and renders', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.4.1' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {
            name: 'Carlos Ruiz',
            clinicName: 'Clinia Central',
            link: 'https://cliniaplus.com/rx/abc',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(sentEmails.length, 1);
      assert.ok(sentEmails[0].html.includes('https://cliniaplus.com/rx/abc'));
    });

    test('Approved subdomain link https://app.cliniaplus.com/invite succeeds (200)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.4.2' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {
            name: 'Carlos Ruiz',
            link: 'https://app.cliniaplus.com/invite',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      assert.equal(sentEmails.length, 1);
      assert.ok(sentEmails[0].html.includes('https://app.cliniaplus.com/invite'));
    });

    test('Approved Vercel domain https://denta-pro.vercel.app/test succeeds (200)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.4.3' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {
            name: 'Carlos Ruiz',
            amount: '45.00',
            link: 'https://denta-pro.vercel.app/test',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      assert.equal(sentEmails.length, 1);
      assert.ok(sentEmails[0].html.includes('https://denta-pro.vercel.app/test'));
    });

    test('Approved local HTTP link http://localhost:3000/portal succeeds (200)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.4.4' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {
            name: 'Carlos Ruiz',
            link: 'http://localhost:3000/portal',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      assert.equal(sentEmails.length, 1);
    });

    test('Configured Supabase project URL host passes (200)', async () => {
      const configuredSupabase = 'https://tenant-project.supabase.co';
      const { POST, sentEmails } = createSendEmailSandbox({ supabaseUrl: configuredSupabase });
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.4.5' },
        body: JSON.stringify({
          to: PATIENT_EMAIL,
          template: 'prescription_ready',
          variables: {
            name: 'Carlos Ruiz',
            link: 'https://tenant-project.supabase.co/storage/v1/object/public/rx/sample.pdf',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      assert.equal(sentEmails.length, 1);
      assert.ok(sentEmails[0].html.includes('https://tenant-project.supabase.co/storage/v1/object/public/rx/sample.pdf'));
    });

    test('Templates without links (welcome, recall_notice, appointment_reminder) succeed (200)', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();

      const templates = ['welcome', 'recall_notice', 'appointment_reminder'];
      for (const tpl of templates) {
        const req = new Request('https://app.cliniaplus.com/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': `10.0.4.${Math.floor(Math.random() * 200 + 10)}` },
          body: JSON.stringify({
            to: PATIENT_EMAIL,
            template: tpl,
            variables: { name: 'Carlos Ruiz', clinicName: 'Clinia' },
          }),
        });
        const res = await POST(req);
        assert.equal(res.status, 200, `Template ${tpl} must pass`);
      }
      assert.equal(sentEmails.length, 3);
    });
  });

  // ==========================================================================
  // SUITE 6: PRESERVED SECURITY CONTROLS & RATE LIMITING
  // ==========================================================================
  describe('6. Preserved Invariants: Authentication, Authorization & Rate Limiting', () => {
    test('Unauthenticated caller returns 401 Unauthorized', async () => {
      const { POST } = createSendEmailSandbox({ currentUser: null });
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.5.1' },
        body: JSON.stringify({ to: PATIENT_EMAIL, template: 'welcome' }),
      });

      const res = await POST(req);
      assert.equal(res.status, 401);
    });

    test('Caller without active clinic association returns 403 Forbidden', async () => {
      const orphanedUser = { id: 'orphaned-user-123', app_metadata: { clinic_id: null } };
      const { POST } = createSendEmailSandbox({ currentUser: orphanedUser });
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.5.2' },
        body: JSON.stringify({ to: PATIENT_EMAIL, template: 'welcome' }),
      });

      const res = await POST(req);
      assert.equal(res.status, 403);
    });

    test('Recipient outside caller clinic returns 403 Forbidden', async () => {
      const { POST, sentEmails } = createSendEmailSandbox();
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.5.3' },
        body: JSON.stringify({ to: 'foreign.victim@external.com', template: 'welcome' }),
      });

      const res = await POST(req);
      assert.equal(res.status, 403);
      assert.equal(sentEmails.length, 0);
    });

    test('Missing RESEND_API_KEY fails closed with 503 Service Unavailable', async () => {
      const { POST } = createSendEmailSandbox({ resendApiKey: '' });
      const req = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': '10.0.5.4' },
        body: JSON.stringify({ to: PATIENT_EMAIL, template: 'welcome' }),
      });

      const res = await POST(req);
      assert.equal(res.status, 503);
      const json = await res.json();
      assert.match(json.error, /Email service not configured/i);
    });

    test('31-request IP burst respects explicit durable shared-destination denial', async () => {
      // Current SQL permits ten authenticated requests per destination/hour.
      // This fixture tests the JS response contract, not SQL quota execution.
      const { POST,sentEmails,budgetCalls } = createSendEmailSandbox({budgetReply:(_args,count)=>count<=10
        ? ALLOW_BUDGET : {allowed:false,retry_after_seconds:37}});
      const testIp = '198.51.100.222';

      for (let i = 1; i <= 30; i++) {
        const req = new Request('https://app.cliniaplus.com/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': testIp },
          body: JSON.stringify({ to: PATIENT_EMAIL, template: 'welcome' }),
        });
        const res = await POST(req);
        assert.equal(res.status, i<=10?200:429, `Request #${i} must respect the durable reply`);
      }

      const blockedReq = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com', 'x-vercel-forwarded-for': testIp },
        body: JSON.stringify({ to: PATIENT_EMAIL, template: 'welcome' }),
      });
      const blockedRes = await POST(blockedReq);
      assert.equal(blockedRes.status, 429, '31st request remains denied');
      assert.equal(blockedRes.headers.get('retry-after'), '37');
      assert.equal(sentEmails.length,10);assert.equal(budgetCalls.length,31);
    });

    test('101-request rotating-IP burst cannot bypass durable recipient denial', async () => {
      const customClinicId = '99999999-9999-4999-8999-999999999999';
      const customDb = {
        patients: [{ id: 'p999', clinic_id: customClinicId, email: 'p999@test.com' }],
        profiles: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa9999', clinic_id: customClinicId, email: 'u999@test.com', status: 'active' }],
        clinic_members: [{ clinic_id: customClinicId, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa9999', status: 'active', role: 'doctor' }],
        clinics: [{ id: customClinicId, owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa9999' }],
      };
      const customUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa9999', app_metadata: { clinic_id: customClinicId, role: 'doctor' } };

      const { POST,sentEmails,budgetCalls } = createSendEmailSandbox({
        currentUser: customUser,
        dbData: customDb,
        budgetReply:(_args,count)=>count<=10?ALLOW_BUDGET:{allowed:false,retry_after_seconds:73},
      });

      for (let i = 1; i <= 100; i++) {
        const req = new Request('https://app.cliniaplus.com/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com',
            'x-vercel-forwarded-for': `172.16.${Math.floor(i / 250)}.${i % 250}`,
          },
          body: JSON.stringify({ to: 'p999@test.com', template: 'welcome' }),
        });
        const res = await POST(req);
        assert.equal(res.status, i<=10?200:429, `Clinic request #${i} must respect the durable reply`);
      }

      const blockedReq = new Request('https://app.cliniaplus.com/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'Origin': 'https://app.cliniaplus.com',
          'x-vercel-forwarded-for': '172.16.200.200',
        },
        body: JSON.stringify({ to: 'p999@test.com', template: 'welcome' }),
      });
      const blockedRes = await POST(blockedReq);
      assert.equal(blockedRes.status, 429, '101st clinic request remains denied');
      assert.equal(blockedRes.headers.get('retry-after'), '73');
      assert.equal(sentEmails.length,10);assert.equal(budgetCalls.length,101);
    });
  });
});
