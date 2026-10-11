'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const origin = 'https://app.example.invalid';
const actor = '11111111-1111-4111-8111-111111111111';
const clinic = '22222222-2222-4222-8222-222222222222';
const defaults = { NODE_ENV: 'production', VERCEL: '1', CLINIA_EMAIL_ENABLED: '1',
  EMAIL_ABUSE_HASH_SECRET: 'synthetic-test-secret-not-a-real-key',
  NEXT_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
  RESEND_API_KEY: 'synthetic-resend', RESEND_FROM_EMAIL: 'Clinia+ <sender@example.invalid>' };
function harness(options = {}) {
  const state = { calls: [], effects: [], clients: [] };
  const env = { ...defaults, ...options.env };
  const trusted = new Headers({ origin, 'x-vercel-forwarded-for': '203.0.113.1', ...options.headers });
  const effect = name => { state.effects.push(name); throw Error('Provider side effect must be blocked'); };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }),
      admin: { createUser: () => effect('createUser'), generateLink: () => effect('generateLink'), listUsers: () => effect('listUsers') } },
    storage: { from: () => effect('storage') },
    rpc: async (name, args) => {
      state.calls.push({ name, args });
      if (name === 'get_clinic_member_role') return { data: 'clinic_owner', error: null };
      if (name === 'get_user_clinic_id') return { data: clinic, error: null };
      assert.equal(name, 'consume_email_abuse_budget');
      if (options.throws) throw Error('sensitive transport detail');
      return { data: options.data === undefined ? { allowed: false, retry_after_seconds: 60 } : options.data,
        error: options.error || null };
    },
    from(table) {
      const q = { select() { return q; }, eq() { return q; }, is() { return q; }, in() { return q; },
        maybeSingle: async () => ({ data: table === 'patients' ? { id: 'synthetic-patient', email: 'patient@example.invalid' } : null, error: null }),
        insert: () => effect('insert'), update: () => effect('update') };
      return q;
    },
  };
  function load(file) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const imports = name => {
      if (name === 'server-only') return {};
      if (name === 'next/headers') return { headers: async () => trusted, cookies: async () => ({ getAll: () => [], set() {} }) };
      if (name === 'next/navigation') return {};
      if (name === 'next/server') return { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } };
      if (name === '@supabase/supabase-js') return { createClient: (url, key, config) => { state.clients.push({ url, key, config }); return client; } };
      if (name === '@supabase/ssr') return { createServerClient: () => client };
      if (name === 'resend') return { Resend: class { emails = { send: () => effect('send') }; } };
      if (name === '@/lib/env') return { env: {} };
      if (name === '@/lib/logger') return { logger: { info() {}, warn() {}, error() {} }, maskEmail: () => 'masked' };
      if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts');
      return require(name);
    };
    vm.runInNewContext(js, { module, exports: module.exports, require: imports, URL, Buffer, TextEncoder,
      console: { log() {}, warn() {}, error() {} }, process: { env, cwd: () => root } }, { filename: file });
    return module.exports;
  }
  const gate = input => load('lib/server-email-gate.ts').consumeEmailBudget({ action: 'signup',
    headers: trusted, destination: 'patient@example.invalid', ...input });
  return { state, gate, load, trusted };
}

test('gate requires explicit enablement, complete server configuration and trusted ingress', async () => {
  for (const options of [ { env: { CLINIA_EMAIL_ENABLED: '' } }, { env: { VERCEL: '' } },
    { env: { EMAIL_ABUSE_HASH_SECRET: 'short' } }, { env: { SUPABASE_SERVICE_ROLE_KEY: '' } },
    { env: { RESEND_API_KEY: '' } },
    { env: { RESEND_FROM_EMAIL: '' } }, { env: { RESEND_FROM_EMAIL: 'invalid-sender' } },
    { env: { RESEND_FROM_EMAIL: 'sender@example.invalid\r\nBcc: attacker@example.invalid' } },
    { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' } }, { env: { NEXT_PUBLIC_APP_URL: 'not-a-url' } },
    { headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '203.0.113.2', 'x-real-ip': '203.0.113.3' } },
    { headers: { 'x-vercel-forwarded-for': '203.0.113.1, 203.0.113.2' } } ]) {
    const h = harness(options), result = await h.gate();
    assert.equal(result.allowed, false); assert.equal(result.status, 503);
    assert.equal(h.state.calls.length, 0); assert.equal(h.state.clients.length, 0);
  }
});

test('cookie/public origins are pinned to server configuration and authenticated actions require UUIDs', async () => {
  const h = harness({ headers: { origin: 'https://attacker.invalid' } });
  assert.equal((await h.gate()).status, 403); assert.equal(h.state.calls.length, 0);
  assert.equal((await h.gate({ bearer: true })).status, 403);
  for (const input of [{ action: 'invite' }, { action: 'transactional', actorId: 'forged', clinicId: clinic }]) {
    const h = harness(); assert.equal((await h.gate(input)).status, 503); assert.equal(h.state.calls.length, 0);
  }
  const bearer = harness({ headers: { origin: 'https://attacker.invalid' }, data: { allowed: true, retry_after_seconds: 0 } });
  assert.equal((await bearer.gate({ action: 'transactional', actorId: actor, clinicId: clinic, bearer: true })).allowed, true);
});

test('server dispatch rejects credentials, paths, queries and fragments in configured HTTPS origins', async () => {
  for (const field of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
    for (const value of ['https://user:synthetic@example.invalid', 'https://example.invalid/api',
      'https://example.invalid/?next=external', 'https://example.invalid/#external']) {
      const h = harness({ env: { [field]: value }, data: { allowed: true, retry_after_seconds: 0 } });
      assert.equal((await h.gate()).status, 503);
      assert.deepEqual(h.state.clients, []);
      assert.deepEqual(h.state.calls, []);
      assert.deepEqual(h.state.effects, []);
    }
  }
});

test('gate hashes normalized identity with stable HMAC and only permits exact durable response', async () => {
  const h = harness({ data: { allowed: true, retry_after_seconds: 0 } });
  assert.equal((await h.gate({ destination: ' Patient@EXAMPLE.invalid ' })).allowed, true);
  assert.equal((await h.gate()).allowed, true);
  const [first, second] = h.state.calls;
  assert.equal(JSON.stringify(first.args), JSON.stringify(second.args));
  assert.match(first.args.p_destination_hash, /^[a-f0-9]{64}$/);
  assert.match(first.args.p_ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(first.args.p_actor_id, null); assert.equal(first.args.p_clinic_id, null);
  assert.ok(!JSON.stringify(first).includes('patient@example.invalid'));
  assert.ok(!JSON.stringify(first).includes('203.0.113.1'));
  assert.equal(h.state.clients[0].config.auth.persistSession, false);
  const deny = await harness().gate(); assert.equal(deny.status, 429); assert.equal(deny.retryAfter, 60);
  for (const options of [{ error: { message: 'missing rpc' } }, { throws: true }, { data: null },
    { data: [{ allowed: true, retry_after_seconds: 0 }] }, { data: { allowed: 'true', retry_after_seconds: 0 } },
    { data: { allowed: true, retry_after_seconds: 1 } }, { data: { allowed: false, retry_after_seconds: 0 } }]) {
    const result = await harness(options).gate(); assert.equal(result.status, 503);
    assert.ok(!JSON.stringify(result).includes('sensitive'));
  }
});

function signupForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ firstName: 'Synthetic', lastName: 'Person', email: 'patient@example.invalid',
    password: 'synthetic-password', practiceName: 'Synthetic Clinic', practiceSize: 'small' })) form.set(key, value);
  return form;
}
test('real durable gate blocks all four entrypoints before provider writes/admin calls or mail', async () => {
  for (const options of [{}, { error: { message: 'missing function' } }, { throws: true }, { env: { CLINIA_EMAIL_ENABLED: '' } },
    { env: { RESEND_FROM_EMAIL: '' } }, { env: { RESEND_FROM_EMAIL: 'mail@example.invalid\r\n' } }]) {
    for (const action of ['signup', 'resend', 'invite', 'transactional']) {
      const h = harness(options);
      if (action === 'signup') assert.ok((await h.load('app/actions/register-clinic.ts').registerClinic(signupForm())).error);
      if (action === 'resend') assert.ok((await h.load('app/actions/resend-confirmation.ts').resendConfirmationEmail('patient@example.invalid')).error);
      if (action === 'invite') {
        const fields = { email: 'patient@example.invalid', clinicId: clinic, name: 'Synthetic', role: 'doctor' };
        await assert.rejects(h.load('app/actions/invite-member.ts').inviteTeamMember({ get: name => fields[name] ?? null }));
      }
      if (action === 'transactional') {
        const request = new Request(origin + '/api/send-email', { method: 'POST', headers: { ...Object.fromEntries(h.trusted), 'content-type': 'application/json' },
          body: JSON.stringify({ to: 'patient@example.invalid', template: 'welcome', clinicId: clinic }) });
        const result = await h.load('app/api/send-email/route.ts').POST(request);
        assert.equal(result.status, options.error || options.throws || options.env ? 503 : 429);
        if (result.status === 429) assert.equal(result.headers.get('retry-after'), '60');
      }
      assert.deepEqual(h.state.effects, [], action);
      const reservations = h.state.calls.filter(call => call.name === 'consume_email_abuse_budget');
      assert.equal(reservations.length, options.env ? 0 : 1, action);
    }
  }
});
