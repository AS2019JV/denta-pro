'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jwt = role => [Buffer.from('{"alg":"HS256"}').toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'), 'syntheticSignature'].join('.');
const valid = { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
  NEXT_PUBLIC_APP_URL: 'https://app.example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') };
function load(envValues = valid, browser = false) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/env.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const process = { env: { ...envValues } };
  vm.runInNewContext(code, { module, exports: module.exports, process, URL, atob,
    ...(browser ? { window: {} } : {}) });
  return { ...module.exports, process };
}

test('public configuration never reads or returns server secrets in either runtime', () => {
  for (const browser of [false, true]) {
    const values = { ...valid, SUPABASE_SERVICE_ROLE_KEY: 'private-service-sentinel',
      RESEND_API_KEY: 'private-resend-sentinel', KUSHKI_PRIVATE_MERCHANT_ID: 'private-kushki-sentinel' };
    const result = load(values, browser);
    assert.deepEqual(Object.keys(result.env).sort(), ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_INVOICE_PROVIDER',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL'].sort());
    assert.ok(!JSON.stringify(result.env).includes('private-'));
    assert.equal(result.process.env.NODE_ENV, 'production');
    assert.equal(result.env.NODE_ENV, undefined);
    assert.equal(Object.isFrozen(result.env), true);
  }
  const source = fs.readFileSync(path.join(root, 'lib/env.ts'), 'utf8');
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|KUSHKI_PRIVATE_MERCHANT_ID|mock_role_key/.test(source));
});

test('public keys reject privileged/malformed values; publishable and legacy anon work', () => {
  for (const key of [jwt('service_role'), jwt('authenticated'), jwt('unknown'), 'sb_secret_' + 'x'.repeat(30),
    'mock_role_key', 'placeholder_anon_key', 'eyJ.invalid.signature', '']) {
    assert.throws(() => load({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }), error => {
      assert.ok(error.message.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
      assert.ok(!error.message.includes(key) || key === ''); return true;
    });
  }
  assert.equal(load({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_' + 'x'.repeat(30) }).env.NEXT_PUBLIC_APP_URL,
    valid.NEXT_PUBLIC_APP_URL);
});

test('deployment public URLs are explicit HTTPS origins, without credentials or injected paths', () => {
  for (const field of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
    for (const value of ['', 'not-a-url', 'http://localhost:3000', 'http://127.0.0.1:56321',
      'https://user:private@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?token=private',
      'https://example.invalid/#fragment']) {
      assert.throws(() => load({ ...valid, [field]: value }), /Invalid public configuration/);
    }
  }
});

test('offline verification accepts only exact declared tuple and refuses Vercel', () => {
  const { verificationEnv } = require('../../scripts/clinia-verify.cjs');
  assert.throws(() => verificationEnv(root, { VERCEL: '1' }), /forbidden on Vercel/);
  const offline = verificationEnv(root, {});
  assert.equal(load(offline).env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:59999');
  assert.equal(load(offline, true).env.NEXT_PUBLIC_APP_URL, 'http://127.0.0.1:59998');
  for (const change of [{ NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY: '' }, { VERCEL: '1' },
    { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59997' }, { NEXT_PUBLIC_APP_URL: 'http://localhost:59998' },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }]) assert.throws(() => load({ ...offline, ...change }));
});

test('acceptance loopback is exact, explicit for browser/server, and forbidden on Vercel', () => {
  const local = { ...valid, NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE: '1', CLINIA_LOCAL_ACCEPTANCE: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:56321', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3400' };
  assert.equal(load(local).env.NEXT_PUBLIC_APP_URL, local.NEXT_PUBLIC_APP_URL);
  assert.equal(load({ ...local, CLINIA_LOCAL_ACCEPTANCE: undefined }, true).env.NEXT_PUBLIC_APP_URL, local.NEXT_PUBLIC_APP_URL);
  for (const change of [{ CLINIA_LOCAL_ACCEPTANCE: '' }, { NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE: '' },
    { VERCEL: '1' }, { NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3401' },
    { NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:56321' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }]) {
    assert.throws(() => load({ ...local, ...change }));
  }
});
