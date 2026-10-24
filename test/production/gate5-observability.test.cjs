'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const vm = require('node:vm'), ts = require('typescript');
const { loadObservability } = require('./helpers/operational-observability.cjs');
const monitor = require('../../scripts/gate5-monitor.cjs');
const uuid = '11111111-1111-4111-8111-111111111111';
function config(now = Date.now()) {
  return { environment: 'isolated-preview', exclusive: true, originKind: 'immutable-deployment', candidateSHA: 'a'.repeat(40), deploymentId: 'syntheticDeployment',
    origin: 'https://synthetic-immutable.vercel.app', ci: { conclusion: 'success', headSHA: 'a'.repeat(40), runId: '123' },
    ownerRef: 'operator-pending', providerRef: 'provider-pending', channelRef: 'channel-pending', recipientRef: 'recipient-pending',
    authorizationRef: 'synthetic-test-only', windowStart: new Date(now - 1000).toISOString(),
    windowEnd: new Date(now + 3600000).toISOString(), policy: { ...monitor.policy } };
}
test('closed logger discards arbitrary text, nested PHI, errors and getters in all environments', () => {
  const h = loadObservability();
  const dangerous = new Proxy({}, { ownKeys() { throw Error('must never inspect arbitrary payload'); } });
  h.logger.error('Bearer secret; clinical patient name; password=synthetic', dangerous);
  h.logger.operational('application.error', { correlationId: uuid, operation: 'clinical-document', status: 503,
    durationMs: 11.8, body: 'synthetic clinical payload', token: 'synthetic-secret', error: Error('private') });
  assert.deepEqual(Object.keys(h.records[0]).sort(), ['event', 'level', 'timestamp']);
  assert.deepEqual(Object.keys(h.records[1]).sort(), ['correlationId', 'durationMs', 'event', 'level', 'operation', 'status', 'timestamp']);
  assert.equal(h.records[1].durationMs, 12);
  assert.doesNotMatch(JSON.stringify(h.records), /Bearer|password|payload|synthetic|private|secret/);
  h.logger.operational('untrusted\nforged', { correlationId: uuid, operation: 'health', status: 200, durationMs: 1 });
  h.logger.operational('application.error', { correlationId: 'secret\nforged', operation: 'health', status: 500, durationMs: 1 });
  assert.equal(h.records.length, 2);
});
test('response wrapper preserves bytes, no-store and denial while correlating events with fresh IDs', async () => {
  const h = loadObservability(), ids = new Set();
  for (const status of [200, 400, 401, 403, 404, 429, 503]) {
    const original = new Response('synthetic response', { status, headers: { 'Cache-Control': 'private, no-store' } });
    const response = await h.observeResponse('clinical-document', async () => original);
    assert.equal(response, original); assert.equal(await response.text(), 'synthetic response');
    assert.equal(response.status, status); assert.match(response.headers.get('cache-control'), /no-store/);
    const id = response.headers.get('x-correlation-id'); assert.match(id, /^[a-f0-9-]{36}$/); ids.add(id);
    const event = h.records.at(-1); assert.equal(event.correlationId, id);
    assert.equal(event.event, status >= 500 ? 'application.error' : status >= 400 ? 'security.request_rejected' : 'application.response');
  }
  assert.equal(ids.size, 7);
});
test('health events and unhandled application errors carry no error content; broken sink does not break app', async () => {
  const h = loadObservability();
  for (const status of [200, 503]) await h.observeResponse('health', async () => new Response(null, { status }));
  assert.deepEqual(h.records.map(x => x.event), ['readiness.ok', 'readiness.unavailable']);
  const error = Error('synthetic patient: diagnosis token=private');
  await assert.rejects(h.observeResponse('private-media', async () => { throw error; }), e => e === error);
  assert.doesNotMatch(JSON.stringify(h.records), /diagnosis|patient|token|private$/);
  const failing = loadObservability([], true);
  assert.equal((await failing.observeResponse('health', async () => new Response(null, { status: 200 }))).status, 200);
});
test('actual private-media route instruments POST/GET/HEAD without inspecting a request body', async () => {
  const h = loadObservability(), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../app/api/private-media/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === '@/lib/operational-observability') return h;
    if (name === '@/lib/env') return { env: { NEXT_PUBLIC_APP_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co' } };
    if (name === '@/lib/private-media-delivery.mjs') return { privateMediaDeliveryHandler: () => async () => new Response('denied', { status: 403, headers: { 'cache-control': 'no-store' } }) };
    return {};
  } });
  for (const method of ['POST', 'GET', 'HEAD']) {
    const request = new Request('https://synthetic.invalid/api/private-media', { method, headers: { 'x-correlation-id': 'attacker', authorization: 'Bearer synthetic-private' } });
    const response = await module.exports[method](request);
    assert.equal(response.status, 403); assert.notEqual(response.headers.get('x-correlation-id'), 'attacker');
    assert.equal(h.records.at(-1).operation, 'private-media');
  }
  assert.doesNotMatch(JSON.stringify(h.records), /attacker|synthetic-private/);
});
test('monitor fails closed for missing owner, non-green CI, wrong identity, scope, policy or time', () => {
  const valid = config(); assert.equal(monitor.validate(valid), valid);
  for (const delta of [{ ownerRef: null }, { candidateSHA: 'main' }, { exclusive: false }, { environment: 'production' },
    { origin: 'https://app-git-shared.vercel.app' }, { origin: 'https://user:pass@synthetic.vercel.app' },
    { ci: { ...valid.ci, headSHA: 'b'.repeat(40) } }, { ci: { ...valid.ci, conclusion: 'failure' } },
    { policy: { ...monitor.policy, failureThreshold: 1 } }, { windowEnd: new Date(Date.now() - 1).toISOString() }]) {
    assert.throws(() => monitor.validate({ ...valid, ...delta }));
  }
});
test('consecutive failure and recovery thresholds suppress noise and preserve ordered durable events', () => {
  const state = monitor.initial(config());
  const step = (passed, second) => monitor.transition(state, passed, new Date(second * 1000).toISOString(), () => uuid);
  step(false, 0); step(true, 60); step(false, 120); step(false, 180); assert.equal(state.pending.length, 0);
  step(false, 240); step(false, 300); assert.equal(state.pending.length, 1); assert.equal(state.incident.id, uuid);
  assert.equal(state.pending[0].firstFailureAt, new Date(120000).toISOString());
  step(true, 360); step(false, 420); step(true, 480); step(true, 540);
  assert.deepEqual(state.pending.map(x => x.kind), ['down', 'recovered']); assert.equal(state.incident, null);
  step(true, 600); assert.equal(state.pending.length, 2);
});
test('webhook sends only fixed metadata, rejects redirects and never claims delivery or human ack', async () => {
  const env = { GATE5_WEBHOOK_URL: 'https://receiver.invalid/private-secret-path', GATE5_WEBHOOK_HOST: 'receiver.invalid' };
  const event = { id: uuid + '-down', kind: 'down', incidentId: uuid, occurredAt: new Date().toISOString(), attempts: 0,
    body: 'sensitive', error: 'sensitive', origin: 'https://protected.invalid' };
  let calls = 0;
  assert.equal(await monitor.deliver(event, config(), env, async (url, options) => {
    calls++; assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    assert.equal(options.headers['Idempotency-Key'], event.id);
    assert.doesNotMatch(options.body, /sensitive|protected|private-secret-path|humanAck|delivered/);
    return new Response(null, { status: 202 });
  }), true);
  assert.equal(calls, 1);
  assert.equal(await monitor.deliver(event, config(), env, async () => new Response(null, { status: 302 })), false);
  assert.throws(() => monitor.receiver({ ...env, GATE5_WEBHOOK_HOST: 'wrong.invalid' }));
});
test('foreground runner retries failed outbox, restores state and keeps recovery ordered; simulated transports only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate5-test-'));
  const start = Date.now(); let now = start, sends = 0, sample = 0;
  const c = config(start); c.windowEnd = new Date(start + 6 * monitor.policy.intervalMs).toISOString();
  const env = { GATE5_WEBHOOK_URL: 'https://receiver.invalid/private', GATE5_WEBHOOK_HOST: 'receiver.invalid' };
  try {
    await monitor.run(c, dir, env, { now: () => now, sleep: async ms => { now += ms; },
      probe: async () => ({ passed: ++sample > 3, httpStatus: sample > 3 ? 200 : 503 }),
      send: async (_url, options) => { sends++; return new Response(null, { status: sends === 1 ? 500 : 202 }); },
    });
    const records = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const attempts = records.filter(x => x.type === 'notification.attempt');
    assert.deepEqual(attempts.map(x => [x.kind, x.providerAccepted]), [['down', false], ['down', true], ['recovered', true]]);
    assert.ok(attempts.every(x => x.delivery === 'NOT VERIFIED' && x.humanAck === 'NOT VERIFIED'));
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'))); assert.equal(state.pending.length, 0);
    assert.equal(fs.existsSync(path.join(dir, 'monitor.lock')), false);
    // A restarted monitor cannot silently bind an existing state to another SHA.
    await assert.rejects(monitor.run({ ...c, candidateSHA: 'b'.repeat(40), ci: { ...c.ci, headSHA: 'b'.repeat(40) } }, dir, env));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('failed lock initialization cleans only its own lock before any probe or notification', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate5-lock-test-'));
  const original = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (file, ...args) => {
    if (typeof file === 'number') throw Error('synthetic disk failure');
    return original(file, ...args);
  });
  const env = { GATE5_WEBHOOK_URL: 'https://receiver.invalid/private', GATE5_WEBHOOK_HOST: 'receiver.invalid' };
  try {
    await assert.rejects(monitor.run(config(), dir, env, {
      probe: async () => assert.fail('No probe during failed initialization'),
      send: async () => assert.fail('No notification during failed initialization'),
    }), /synthetic disk failure/);
    assert.equal(fs.existsSync(path.join(dir, 'monitor.lock')), false);
  } finally { t.mock.restoreAll(); fs.rmSync(dir, { recursive: true, force: true }); }
});
test('restart gap resets old failure streak while preserving persisted state and target identity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate5-gap-test-'));
  const start = Date.now(); let now = start;
  const c = config(start); c.windowEnd = new Date(start + 1000).toISOString();
  const state = monitor.initial(c);
  state.failures = 2; state.lastSampleAt = new Date(start - 180000).toISOString();
  state.firstFailureAt = new Date(start - 240000).toISOString();
  const env = { GATE5_WEBHOOK_URL: 'https://receiver.invalid/private', GATE5_WEBHOOK_HOST: 'receiver.invalid' };
  try {
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
    const final = await monitor.run(c, dir, env, { now: () => now, sleep: async ms => { now += ms; },
      probe: async () => ({ passed: false, httpStatus: 503 }), send: async () => assert.fail('Old failures cannot trigger notification after gap') });
    assert.equal(final.failures, 1); assert.equal(final.pending.length, 0);
    const log = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8'); assert.match(log, /monitor.gap/);
    await assert.rejects(monitor.run({ ...c, origin: 'https://different.vercel.app' }, dir, env));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
