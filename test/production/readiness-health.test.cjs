'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const monitor = require('../../scripts/check-clinia-health.cjs');
const root = path.resolve(__dirname, '../..');
const key = 'sb_publishable_' + 'synthetic'.repeat(4);
const input = { CLINIA_HEALTH_ENABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: key };
function load(file, imports = {}, env = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URL, Buffer, AbortSignal, Response, fetch,
    process: { env }, require: name => name === 'server-only' ? {} : imports[name] });
  return module.exports;
}
const { probeReadiness } = load('lib/readiness-health.ts');
const healthy = () => Response.json({ version: 'synthetic', name: 'GoTrue' });
test('readiness fails closed before transport for disabled, privileged or invalid provider config', async () => {
  const privileged = 'e30.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature';
  for (const change of [{ CLINIA_HEALTH_ENABLED: '' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: privileged }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-ci-key' },
    ...['http://127.0.0.1:54321', 'https://evil.invalid', 'https://user:pass@synthetic.supabase.co',
      'https://synthetic.supabase.co/path', 'https://synthetic.supabase.co?token=secret'].map(value => ({ NEXT_PUBLIC_SUPABASE_URL: value }))]) {
    let calls = 0; const result = await probeReadiness({ ...input, ...change }, async () => { calls++; return healthy(); });
    assert.equal(result.status, 'unavailable'); assert.equal(calls, 0);
  }
});
test('readiness uses one bounded public probe and emits only fixed metadata', async () => {
  const result = await probeReadiness(input, async (url, options) => {
    assert.equal(url, 'https://synthetic.supabase.co/auth/v1/health'); assert.equal(options.method, 'GET');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'apikey']); assert.equal(options.headers.apikey, key);
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.ok(options.signal);
    return healthy();
  });
  assert.equal(JSON.stringify(result), '{"status":"ok","scope":"application-auth"}');
});
test('provider errors, HTML challenges, malformed bodies and oversized bodies stay unavailable', async () => {
  for (const response of [new Response('provider-secret', { status: 503 }), new Response('<html>login</html>'),
    Response.json({}), Response.json({ version: '', name: 'GoTrue' }),
    new Response('invalid JSON', { headers: { 'content-type': 'application/json' } }),
    Response.json({ version: 'synthetic', name: 'GoTrue', extra: 'x'.repeat(4096) })]) {
    assert.equal((await probeReadiness(input, async () => response)).status, 'unavailable');
  }
  assert.equal((await probeReadiness(input, async () => { throw Error('secret'); })).status, 'unavailable');
});
test('actual route returns no-store 200 or retryable 503 without accepting target or identity input', async () => {
  for (const status of ['ok', 'unavailable']) {
    const route = load('app/api/health/route.ts', { '@/lib/readiness-health': { probeReadiness: async actual => {
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(input).sort());
      return { status, scope: 'application-auth' };
    } } }, { ...input, SUPABASE_SERVICE_ROLE_KEY: 'never-read' });
    const response = await route.GET(); assert.equal(response.status, status === 'ok' ? 200 : 503);
    assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(route.maxDuration, 5);
    assert.deepEqual(await response.json(), { status, scope: 'application-auth' });
  }
});
test('only exact health route avoids unbounded visitor-session refresh in middleware', async () => {
  let clients = 0;
  const middleware = load('middleware.ts', {
    '@/lib/clinic-authority.mjs': {},
    'next/server': { NextResponse: { next: () => ({ kind: 'next' }) } },
    '@supabase/ssr': { createServerClient: () => { clients++; throw Error('unexpected session refresh'); } },
  }, input);
  const request = pathname => ({ headers: {}, nextUrl: { pathname } });
  assert.equal((await middleware.middleware(request('/api/health'))).kind, 'next');
  assert.equal(clients, 0);
  await assert.rejects(() => middleware.middleware(request('/api/health/other')), /unexpected session refresh/);
  assert.equal(clients, 1);
});
test('one-shot monitor rejects protection pages, redirects, stale responses and sends no alerts', async () => {
  const reply = () => Response.json({ status: 'ok', scope: 'application-auth' }, { headers: { 'cache-control': 'private, no-store' } });
  const pass = await monitor.check('https://app.example.invalid', async (url, options) => {
    assert.equal(url, 'https://app.example.invalid/api/health'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined); return reply();
  });
  assert.equal(pass.passed, true); assert.equal(pass.alertsSent, 0);
  for (const response of [new Response('Vercel login', { status: 401 }), new Response(null, { status: 302 }),
    Response.json({ status: 'ok', scope: 'application-auth' }), Response.json({ status: 'ok', scope: 'other' }, { headers: { 'cache-control': 'no-store' } })]) {
    const result = await monitor.check('https://app.example.invalid', async () => response);
    assert.equal(result.passed, false); assert.equal(result.alertsSent, 0); assert.equal(result.status, 'NOT VERIFIED');
  }
  for (const origin of ['http://localhost:3000', 'https://127.0.0.1', 'https://[::ffff:127.0.0.1]', 'https://user:secret@app.invalid', 'https://app.invalid/path'])
    assert.throws(() => monitor.target(origin));
});
