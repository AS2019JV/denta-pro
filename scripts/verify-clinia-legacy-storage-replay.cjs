'use strict';
// Read-only historical Storage GET replay. `plan` performs no network calls.
// Credentials, signed query strings and raw response bodies never enter reports.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('./clinia-staging-runtime.cjs');
const hosted = require('./verify-clinia-hosted-api.cjs');
const PROJECT = 'phihonofwyerpfgqfekt', ORIGIN = `https://${PROJECT}.supabase.co`;
const CLINIC = 'd9a47157-1d36-43df-af1d-436d561ee551';
const PATIENT = 'b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14';
const DOCTOR = '272d63b1-38e3-4a60-89a2-dd07f031b2d2';
const OBJECTS = Object.freeze([
  `patient-files/${CLINIC}/${PATIENT}/hosted-1-run-2.pdf`,
  `patient-files/${CLINIC}/${PATIENT}/hosted-1-run-3.pdf`,
  `patient-files/${CLINIC}/${PATIENT}/nostore-e3e326f1-f046-4703-b3eb-0cad025f159e.pdf`,
  `clinic-branding/${CLINIC}/hosted-1-run-3.png`,
  `doctor-avatars/${DOCTOR}/hosted-1-run-3.png`,
  `patient-avatars/${CLINIC}/${PATIENT}/hosted-1-run-3.png`,
]);
const PRIVATE = path.join(runtime.repo, 'tools/local-supabase/supabase/.temp');
const EVIDENCE = path.join(runtime.repo, 'docs/production/evidence');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function read(file, privateCapture = false) {
  assert.ok(!fs.lstatSync(file).isSymbolicLink(), 'Symlink refused');
  assert.equal(fs.realpathSync(path.dirname(file)), path.resolve(path.dirname(file)), 'Indirect directory refused');
  if (privateCapture) {
    assert.equal(path.dirname(file), PRIVATE);
    assert.equal(spawnSync('git', ['check-ignore', '--quiet', '--no-index', path.relative(runtime.repo, file)],
      { cwd: runtime.repo, windowsHide: true }).status, 0, 'Private capture must remain ignored');
  }
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes), filename: path.relative(runtime.repo, file).split(path.sep).join('/'), sha256: sha(bytes) };
}
function scopedUrl(input) {
  const url = new URL(input);
  assert.equal(url.origin, ORIGIN, 'Exact staging origin required');
  assert.ok(!url.username && !url.password && !url.hash, 'URL authority changed');
  const prefix = '/storage/v1/object/';
  assert.ok(url.pathname.startsWith(prefix), 'Only Storage byte GET routes allowed');
  let object = url.pathname.slice(prefix.length);
  const variant = ['authenticated/', 'public/', 'sign/'].find(v => object.startsWith(v));
  if (variant) object = object.slice(variant.length);
  assert.ok(OBJECTS.includes(object), 'Only six exact synthetic objects allowed');
  if (variant === 'sign/') {
    assert.deepEqual([...url.searchParams.keys()], ['token'], 'Original signed token required');
    assert.match(url.searchParams.get('token'), /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  } else assert.equal(url.search, '', 'Uncaptured query strings cannot be reconstructed');
  return { url, object };
}
function claims(token, id, role) {
  assert.match(token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const value = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  assert.equal(value.sub, id); assert.equal(value.role, role);
  assert.equal(value.iss, ORIGIN + '/auth/v1');
  assert.ok(Number.isFinite(value.exp));
  return { subject: id, role, expiresAt: new Date(value.exp * 1000).toISOString() };
}
function sourceRef(source, index, row) {
  return { filename: source.filename, sha256: source.sha256, requestIndex: index,
    historicalStatus: row.status, historicalBodySha256: row.bodySha256 || null };
}
function buildInventory({ state, principal, additionalPrincipals = [], nostore, sources, anon }) {
  assert.equal(state.value.project, PROJECT); assert.equal(state.value.attempt, '1');
  assert.equal(state.value.fixtures.clinicA, CLINIC); assert.equal(state.value.fixtures.patientA, PATIENT);
  assert.equal(state.value.actors.doctor_A.id, DOCTOR);
  assert.equal(nostore.value.bucket + '/' + nostore.value.object, OBJECTS[2]);
  assert.equal(principal.value.project, PROJECT);
  const credentials = new Map();
  for (const label of hosted.LABELS) {
    const actor = state.value.actors[label];
    credentials.set(label, { token: actor.token, source: state, ...claims(actor.token, actor.id, 'authenticated') });
  }
  credentials.set('delivery_principal', { token: principal.value.token, source: principal,
    ...claims(principal.value.token, principal.value.id, 'clinia_document_delivery') });
  for (const capture of additionalPrincipals) {
    assert.equal(capture.value.project, PROJECT); assert.equal(capture.value.id, principal.value.id);
    assert.ok(['1', '2'].includes(capture.value.attempt));
    credentials.set('delivery_principal_' + capture.value.attempt, { token: capture.value.token, source: capture,
      ...claims(capture.value.token, capture.value.id, 'clinia_document_delivery') });
  }
  const requests = new Map(), gaps = [], binding = hosted.fixtureBinding(state.value);
  function add(url, label, profile, provenance, source) {
    const scope = scopedUrl(url), credential = credentials.get(label);
    assert.ok(credential, 'Known original credential required');
    const headers = { apikey: anon, Authorization: 'Bearer ' + credential.token };
    if (['expired', 'revocation', 'nostore', 'broker-runtime'].includes(profile)) headers['Content-Type'] = 'application/json';
    if (profile === 'revocation') headers['Cache-Control'] = 'no-cache';
    if (profile === 'nostore') Object.assign(headers, { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate', 'x-upsert': 'false' });
    const request = { url, method: 'GET', headers };
    const key = sha(JSON.stringify(request));
    if (!requests.has(key)) requests.set(key, { request, credential, profile, metadata: {
      requestSha256: key, method: 'GET', path: scope.url.pathname, object: scope.object,
      credentialSha256: sha(credential.token), actor: label, expiresAt: credential.expiresAt,
      credentialCapture: { filename: credential.source.filename, sha256: credential.source.sha256 },
      headerProfile: profile, headerNames: Object.keys(headers).sort(),
      originalHeadersCaptured: false, fullWireProof: false,
      apiKeyProvenance: 'Current publishable key; historical value was not captured',
      provenance: [], sources: [],
    } });
    const entry = requests.get(key);
    if (!entry.metadata.provenance.includes(provenance)) entry.metadata.provenance.push(provenance);
    if (source) entry.metadata.sources.push(source);
  }
  for (const source of sources) {
    const report = source.value;
    assert.equal(report.project, PROJECT, 'Evidence project changed');
    const name = path.basename(source.filename);
    for (const [index, row] of (report.requests || []).entries()) {
      if ((row.method || 'GET') !== 'GET' || !row.path?.startsWith('/storage/v1/object/')) continue;
      const ref = sourceRef(source, index, row);
      if (row.path.includes('/sign/')) { gaps.push({ reason: 'Original signed URL query token was not persisted', ...ref, path: row.path }); continue; }
      if (row.queryPresent === true) { gaps.push({ reason: 'Original cache-busting query was not persisted; no replacement generated', ...ref, path: row.path }); continue; }
      try { scopedUrl(ORIGIN + row.path); } catch { continue; }
      let label = row.actor || report.actor || 'doctor_A', profile = 'sdk-reconstructed';
      let provenance = report.fixtureBindingSha256 === binding ? 'Original actor token bound by fixture digest' : 'Actor association reconstructed; original token equality unproven';
      if (name.startsWith('principal-warm-disable-replay-')) {
        assert.equal(report.principalId, principal.value.id);
        assert.equal(report.principalTokenSha256, sha(principal.value.token));
        label = 'delivery_principal'; profile = 'broker'; provenance = 'Original broker token bound by warm receipt digest';
      } else if (/^principal-(enabled|disabled)-/.test(name)) {
        // The receipt's token digest identifies only the broker, never its human controls.
        if (row.actor !== 'delivery_principal') continue;
        const matching = [...credentials.entries()].find(([key, value]) => key.startsWith('delivery_principal') && sha(value.token) === report.originalTokenSha256);
        assert.ok(matching, 'Historical broker token capture does not match receipt');
        label = matching[0]; profile = 'broker-runtime'; provenance = 'Original broker token bound by principal receipt digest';
      } else if (name.startsWith('nostore-')) profile = 'nostore';
      else if (name.startsWith('expired-replay-')) profile = 'expired';
      else if (name.startsWith('storage-revocation-')) {
        profile = 'revocation';
        // The final byte request in this harness uses anon, despite report.actor.
        if (index === report.requests.length - 1) {
          gaps.push({ reason: 'Historical anonymous key was not captured', ...ref, path: row.path }); continue;
        }
      }
      if (!credentials.has(label)) {
        gaps.push({ reason: 'No captured original credential for actor', actor: label, ...ref, path: row.path }); continue;
      }
      add(ORIGIN + row.path, label, profile, provenance, ref);
    }
  }
  // Complete exact-object coverage, including run-2 whose old JWT was overwritten.
  for (const object of OBJECTS) for (const prefix of ['', 'authenticated/']) {
    const route = '/storage/v1/object/' + prefix + object;
    if (![...requests.values()].some(item => item.metadata.path === route))
      add(ORIGIN + route, 'doctor_A', 'supplementary', 'Supplementary current-path check with retained JWT; no original request equality established');
  }
  assert.ok(requests.size > 0);
  return { requests: [...requests.values()], gaps, captures: [state, principal, ...additionalPrincipals, nostore].map(({ filename, sha256 }) => ({ filename, sha256 })) };
}
function denial(status, bytes) {
  if (![400, 401, 403, 404].includes(status)) return false;
  let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { return false; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const code = data.code || data.error;
  const known = ['NoSuchKey', 'NoSuchBucket', 'AccessDenied', 'Unauthorized', 'InvalidJWT', 'InvalidToken', 'ExpiredToken', 'not_found'];
  if (known.includes(code)) return true;
  return status !== 400 && typeof data.message === 'string'
    && /not found|unauthorized|permission denied|invalid.*(?:jwt|token)|(?:jwt|token).*expired/i.test(data.message);
}
function publicInventory(inventory) {
  const requests = inventory.requests.map(item => item.metadata);
  const credentialGroups = [...new Set(requests.map(r => r.credentialSha256))].map(hash => ({
    credentialSha256: hash, requests: requests.filter(r => r.credentialSha256 === hash).map(r => r.requestSha256),
  }));
  return { captures: inventory.captures, requests, credentialGroups, gaps: inventory.gaps,
    objectCoverage: OBJECTS.map(object => ({ object, plannedRequests: requests.filter(r => r.object === object).length })),
    limits: ['Six exact synthetic legacy keys on the named project only',
      'No historical provider request stored a complete HTTP header set; no full wire proof is available',
      'Retained JWTs are never refreshed; expired JWT denial does not establish deletion causality',
      'SDK and auxiliary request headers are reconstructed from historical harness source; current API key is explicitly identified',
      'Missing signed URL tokens, nonces and overwritten run-2 credentials are not recreated',
      'The initial document-delivery provisioning JWT has no identified original-token-bound Storage warm receipt and is not treated as a captured successful capability',
      'Application gateway POST captures and other provider objects are outside this verifier',
      'Observed denial is local to this execution and does not establish universal CDN eviction'] };
}
async function execute(inventory, report, persist, fetchImpl = fetch) {
  report.responses = [];
  for (const item of inventory.requests) {
    scopedUrl(item.request.url); assert.equal(item.request.method, 'GET');
    const receipt = { requestSha256: item.metadata.requestSha256, startedAt: new Date().toISOString(), status: null, bodyComplete: false, denied: false };
    report.responses.push(receipt); persist();
    try {
      const response = await fetchImpl(item.request.url, { method: 'GET', headers: item.request.headers,
        ...(item.profile === 'expired' ? {} : { cache: 'no-store' }), redirect: 'error', signal: AbortSignal.timeout(20000) });
      receipt.status = response.status; persist();
      const chunks = []; let size = 0;
      if (response.body) for await (const chunk of response.body) {
        size += chunk.length; assert.ok(size <= 11 * 1024 * 1024, 'Response bound exceeded'); chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      Object.assign(receipt, { bodyComplete: true, bytes: size, bodySha256: sha(bytes), denied: denial(response.status, bytes), headers: {} });
      for (const header of ['date', 'cache-control', 'age', 'cf-cache-status', 'x-cache', 'content-type']) {
        const value = response.headers.get(header);
        if (value && value.length <= 512 && /^[\x20-\x7e]+$/.test(value)) receipt.headers[header] = value;
      }
    } catch { receipt.failure = 'Transport, response bound or metadata validation failed; no denial proof'; }
    receipt.completedAt = new Date().toISOString(); persist();
  }
  report.observedDenialsPassed = report.responses.length > 0 && report.responses.every(r => r.bodyComplete && r.denied);
  report.status = report.observedDenialsPassed ? 'PARTIALLY VERIFIED' : 'NOT VERIFIED';
  report.disposition = report.observedDenialsPassed ? 'All planned exact-path reads denied; historical capture gaps remain' : 'At least one request accessible or denial evidence incomplete';
  report.completedAt = new Date().toISOString(); persist();
  return report;
}
function loadInventory() {
  const p = hosted.plan('matrix', '1', PROJECT, '3');
  const state = read(p.privateFile, true);
  hosted.verifiedMatrix(state.value, p.directory, sha(fs.readFileSync(path.join(__dirname, 'verify-clinia-hosted-api.cjs'))));
  const principal = read(path.join(PRIVATE, 'step1-document-3.principal.private.json'), true);
  const additionalPrincipals = ['1', '2'].map(attempt => read(path.join(PRIVATE, `step1-document-${attempt}.principal.private.json`), true));
  const nostore = read(path.join(PRIVATE, 'clinia-nostore-1.private.json'), true);
  const names = fs.readdirSync(p.directory).filter(name => /^(?:matrix-run-[23]|prove-(?:auth-revoked|revoked|demoted)|storage-revocation-\d+|expired-replay-\d+|nostore-(?:prepare|revoked)-\d+)\.json$/.test(name));
  const sources = names.sort().map(name => read(path.join(p.directory, name)));
  sources.push(read(path.join(EVIDENCE, '2026-10-05-document-requalification/principal-warm-disable-replay-1791235075640.json')));
  const principalDirectory = path.join(EVIDENCE, '2026-10-04-document-delivery');
  for (const name of fs.readdirSync(principalDirectory).filter(name => /^principal-(?:enabled|disabled)-\d+-[a-f0-9]{8}\.json$/.test(name)).sort())
    sources.push(read(path.join(principalDirectory, name)));
  const { anon } = runtime.readConfig();
  return buildInventory({ state, principal, additionalPrincipals, nostore, sources, anon });
}
async function main(args) {
  assert.equal(args.length, 2); assert.equal(args[1], PROJECT); assert.ok(['plan', 'replay'].includes(args[0]));
  const inventory = loadInventory(), report = { status: 'NOT VERIFIED', executed: false, project: PROJECT, mode: args[0],
    startedAt: new Date().toISOString(), driverSha256: sha(fs.readFileSync(__filename)), ...publicInventory(inventory) };
  const directory = path.join(EVIDENCE, '2026-10-06-legacy-storage-retirement'); fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `legacy-replay-${args[0]}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (args[0] === 'replay') {
    report.executed = true;
    await execute(inventory, report, () => fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n'));
    if (!report.observedDenialsPassed) process.exitCode = 1;
  }
  console.log(JSON.stringify({ status: report.status, requests: report.requests.length, gaps: report.gaps.length, evidence: filename }));
}
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  console.error('Exact synthetic replay prerequisites failed; credentials and raw provider errors withheld'); process.exitCode = 1;
});
module.exports = { PROJECT, ORIGIN, OBJECTS, scopedUrl, buildInventory, publicInventory, denial, execute, loadInventory };
