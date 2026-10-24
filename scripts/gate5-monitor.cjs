'use strict';
// Foreground monitor, not a scheduler. Disabled until the human authorizes the
// exact green candidate, isolated Preview, time window, provider and recipient.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { check, target } = require('./check-clinia-health.cjs');
const SHA = /^[a-f0-9]{40}$/;
const REF = /^[a-zA-Z0-9_-]{1,80}$/;
const policy = Object.freeze({ intervalMs: 60000, failureThreshold: 3, recoveryThreshold: 2, timeoutMs: 5000 });
function requireValue(ok) { if (!ok) throw Error('Gate5 configuration incomplete or outside authorized scope'); }
function validate(config, now = Date.now()) {
  requireValue(config && config.environment === 'isolated-preview' && config.exclusive === true);
  requireValue(['immutable-deployment', 'gate5-exclusive-alias'].includes(config.originKind));
  if (config.originKind === 'gate5-exclusive-alias') requireValue(REF.test(config.aliasAuthorizationRef || ''));
  requireValue(SHA.test(config.candidateSHA) && REF.test(config.deploymentId));
  requireValue(config.ci?.conclusion === 'success' && config.ci.headSHA === config.candidateSHA && /^\d+$/.test(config.ci.runId));
  requireValue(['ownerRef', 'providerRef', 'recipientRef', 'channelRef', 'authorizationRef'].every(k => REF.test(config[k] || '')));
  requireValue(Number.isFinite(Date.parse(config.windowStart)) && Number.isFinite(Date.parse(config.windowEnd))
    && Date.parse(config.windowEnd) > Date.parse(config.windowStart)
    && Date.parse(config.windowEnd) - Date.parse(config.windowStart) <= 4 * 3600000);
  requireValue(now >= Date.parse(config.windowStart) && now < Date.parse(config.windowEnd));
  target(config.origin);
  const origin = new URL(config.origin);
  requireValue(origin.hostname.endsWith('.vercel.app') && !origin.hostname.includes('-git-'));
  requireValue(config.policy && Object.keys(policy).every(k => config.policy[k] === policy[k]));
  return config;
}
function initial(config) {
  return { version: 1, candidateSHA: config.candidateSHA, deploymentId: config.deploymentId,
    targetDigest: createHash('sha256').update(config.origin).digest('hex'),
    originKind: config.originKind,
    incident: null, failures: 0, successes: 0, firstFailureAt: null, pending: [], lastSampleAt: null };
}
function transition(state, passed, at, makeId = randomUUID) {
  state.lastSampleAt = at;
  if (!passed) {
    state.successes = 0;
    if (!state.failures) state.firstFailureAt = at;
    state.failures = Math.min(policy.failureThreshold, state.failures + 1);
    if (state.failures === policy.failureThreshold && !state.incident) {
      state.incident = { id: makeId(), firstFailureAt: state.firstFailureAt, detectedAt: at };
      state.pending.push({ id: state.incident.id + '-down', kind: 'down', incidentId: state.incident.id,
        occurredAt: at, firstFailureAt: state.firstFailureAt, attempts: 0 });
    }
  } else {
    state.failures = 0; state.firstFailureAt = null;
    state.successes = Math.min(policy.recoveryThreshold, state.successes + 1);
    if (state.incident && state.successes === policy.recoveryThreshold) {
      state.pending.push({ id: state.incident.id + '-recovered', kind: 'recovered', incidentId: state.incident.id,
        occurredAt: at, firstFailureAt: state.incident.firstFailureAt, detectedAt: state.incident.detectedAt, attempts: 0 });
      state.incident = null;
    }
  }
  return state;
}
function receiver(env) {
  const url = new URL(env.GATE5_WEBHOOK_URL || '');
  // Exact HTTPS receiver host must come from the approved provider; URL stays private.
  requireValue(url.protocol === 'https:' && url.hostname === env.GATE5_WEBHOOK_HOST
    && !url.username && !url.password && !url.port && !url.hash
    && url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname)
    && !url.hostname.endsWith('.local') && !url.hostname.endsWith('.localhost'));
  return url.href;
}
async function deliver(event, config, env, send = fetch) {
  const url = receiver(env);
  // A successful POST is provider acceptance only, never delivery/human ack.
  const response = await send(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(policy.timeoutMs),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': event.id },
    body: JSON.stringify({ version: 1, eventId: event.id, kind: event.kind, incidentId: event.incidentId,
      expectedCandidateSHA: config.candidateSHA, expectedDeploymentId: config.deploymentId,
      identity: 'configuration-only', scope: 'application-auth',
      occurredAt: event.occurredAt, firstFailureAt: event.firstFailureAt,
      ownerRef: config.ownerRef, channelRef: config.channelRef, recipientRef: config.recipientRef }),
  });
  await response.body?.cancel();
  return response.status >= 200 && response.status < 300;
}
function save(file, state) {
  fs.writeFileSync(file + '.next', JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(file + '.next', file);
}
async function run(config, directory, env = process.env, dependencies = {}) {
  validate(config); receiver(env);
  const probe = dependencies.probe || check, send = dependencies.send || fetch;
  const sleep = dependencies.sleep || delay, now = dependencies.now || Date.now;
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'monitor.lock');
  // Exclusive lock is retained on crash: operator must verify no process lives
  // before removing it. No silent concurrent monitoring or state overwrite.
  const fd = fs.openSync(lock, 'wx', 0o600);
  const stateFile = path.join(directory, 'state.json'), journal = path.join(directory, 'events.jsonl');
  try {
    fs.writeFileSync(fd, String(process.pid));
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : initial(config);
    requireValue(state.version === 1 && state.candidateSHA === config.candidateSHA && state.deploymentId === config.deploymentId
      && state.targetDigest === initial(config).targetDigest);
    const write = record => fs.appendFileSync(journal, JSON.stringify(record) + '\n', { mode: 0o600 });
    requireValue(state.originKind === config.originKind);
    write({ type: 'monitor.started', at: new Date(now()).toISOString(), expectedCandidateSHA: config.candidateSHA,
      expectedDeploymentId: config.deploymentId, originKind: config.originKind,
      identity: 'configuration-only', activeUntil: config.windowEnd, scope: 'application-auth' });
    while (now() < Date.parse(config.windowEnd)) {
      const started = now();
      if (state.lastSampleAt && started - Date.parse(state.lastSampleAt) > policy.intervalMs * 2) {
        write({ type: 'monitor.gap', at: new Date(started).toISOString(), previousSampleAt: state.lastSampleAt });
        state.failures = 0; state.successes = 0; state.firstFailureAt = null;
      }
      const result = await probe(config.origin, (url, options) => send(url, { ...options, headers: { ...options.headers,
        ...(env.GATE5_PREVIEW_ACCESS ? { 'x-vercel-protection-bypass': env.GATE5_PREVIEW_ACCESS } : {}) } }));
      const at = new Date(now()).toISOString();
      transition(state, result.passed === true, at);
      // Write-before-send outbox survives restarts; receiver must deduplicate eventId.
      save(stateFile, state);
      write({ type: 'sample', at, passed: result.passed === true, httpStatus: result.httpStatus,
        durationMs: now() - started, expectedCandidateSHA: config.candidateSHA,
        expectedDeploymentId: config.deploymentId, identity: 'configuration-only' });
      for (const event of [...state.pending]) {
        // Do not send new events after the authorized window expires.
        if (now() >= Date.parse(config.windowEnd)) break;
        event.attempts++;
        let accepted = false;
        try { accepted = await deliver(event, config, env, send); } catch { /* Fixed metadata only. */ }
        write({ type: 'notification.attempt', at: new Date(now()).toISOString(), eventId: event.id,
          kind: event.kind, attempts: event.attempts, providerAccepted: accepted, delivery: 'NOT VERIFIED', humanAck: 'NOT VERIFIED' });
        save(stateFile, state);
        if (!accepted) break; // Preserve down-before-recovery order.
        state.pending.shift(); save(stateFile, state);
      }
      const remaining = Math.min(policy.intervalMs - (now() - started), Date.parse(config.windowEnd) - now());
      if (remaining > 0) await sleep(remaining);
    }
    write({ type: 'monitor.stopped', at: new Date(now()).toISOString(), pendingNotifications: state.pending.length });
    return state;
  } finally {
    try { fs.closeSync(fd); } finally { fs.unlinkSync(lock); }
  }
}
async function main(args) {
  requireValue(args.length === 2 && ['validate', 'run-authorized'].includes(args[0]));
  const privateRoot = path.resolve(__dirname, '..', '.gate5-private');
  const configFile = path.resolve(args[1]);
  requireValue(path.dirname(configFile) === privateRoot);
  const config = validate(JSON.parse(fs.readFileSync(configFile, 'utf8')));
  if (args[0] === 'validate') { console.log(JSON.stringify({ configuration: 'VALID', activeMonitor: false, hostedEvidence: 'NOT VERIFIED' })); return; }
  await run(config, path.join(privateRoot, config.deploymentId));
}
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  console.error('Gate5 monitor BLOCKED: verify private configuration, authorization window, receiver and exclusive state. No secret details emitted.');
  process.exitCode = 1;
});
module.exports = { policy, validate, initial, transition, receiver, deliver, run };
