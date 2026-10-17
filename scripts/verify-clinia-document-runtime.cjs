'use strict';
// Operator-driven, exact staging only. This driver never applies SQL, changes
// memberships, logs out/bans actors, refreshes warmed tokens, or uses a server
// credential for clinical CRUD. All request credentials stay in ignored files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('./clinia-staging-runtime.cjs');
const fixtures = require('./verify-clinia-hosted-api.cjs');

const PROJECT = 'phihonofwyerpfgqfekt';
const PROVIDER = 'https://' + PROJECT + '.supabase.co';
const PREVIEW = 'https://v0-denta-pro-git-codex-cl-3f4a77-alesuav2001-gmailcoms-projects.vercel.app';
const CANDIDATE = 'cfdb93c5cfb5aec6d7fd0e300a84904c56bf619a';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const ACTORS = Object.freeze(['removed_A', 'demoted_A', 'logout_A', 'ban_A', 'expiry_A']);
const REPLAY_ACTOR = Object.freeze({ removed: 'removed_A', demoted: 'demoted_A', logout: 'logout_A', ban: 'ban_A', expired: 'expiry_A' });
const PDF = Buffer.from('%PDF-1.4\nClinia synthetic staging transport, no patient document\n%%EOF');
const APP_DENIAL = Buffer.from('No se pudo entregar el documento.');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const HELP = `Exact staging document verification (production is forbidden).
  node scripts/verify-clinia-document-runtime.cjs prepare 1 ${PROJECT}
  node scripts/verify-clinia-document-runtime.cjs probe warm 1 ${PROJECT}
  node scripts/verify-clinia-document-runtime.cjs probe removed|demoted|logout|ban|expired 1 ${PROJECT}
  node scripts/verify-clinia-document-runtime.cjs principal disabled|enabled 1 ${PROJECT}

Attempts: 1..9. prepare creates five NEW synthetic doctor Auth accounts and fresh
owner sessions in a NEW ignored capture. The operator assigns these doctors to
the existing synthetic clinic, then enables the registered delivery principal.
Before enabling it, run principal disabled; principal enabled reuses its JWT.
Principal checks capture a fresh ordinary owner in a separate ignored file.
The operator records Ready/source/alias evidence in the fixed candidate manifest.
warm verifies bytes/no-store and creates an immutable original-request capture.
Between replay phases, the operator changes only the corresponding new actor.
No phase refreshes a warmed JWT or changes remote authorization. expired remains
PENDING until the original, previously successful JWT actually expires.
The candidate manifest must bind the exact Preview alias, candidate ${CANDIDATE},
environment=preview, status=READY, sourceVerified=true, project=${PROJECT},
deploymentId (the observed Vercel ID), and observedAt (ISO UTC).
`;

function plan(args) {
  const [mode, phaseOrAttempt, attemptOrProject, project] = args;
  assert.ok(['prepare', 'probe', 'principal'].includes(mode), 'Explicit driver mode required');
  const phase = mode === 'prepare' ? 'prepare' : phaseOrAttempt;
  const attempt = mode === 'prepare' ? phaseOrAttempt : attemptOrProject;
  const target = mode === 'prepare' ? attemptOrProject : project;
  assert.equal(args.length, mode === 'prepare' ? 3 : 4, 'Unexpected CLI arguments refused');
  assert.equal(target, PROJECT, 'Exact authorized staging project required');
  assert.match(attempt || '', /^[1-9]$/, 'Fresh attempt 1..9 required');
  if (mode === 'probe') assert.ok(['warm', ...Object.keys(REPLAY_ACTOR)].includes(phase), 'Unknown replay phase');
  if (mode === 'principal') assert.ok(['disabled', 'enabled'].includes(phase), 'Unknown principal phase');
  const directory = path.join(runtime.repo, 'docs/production/evidence/2026-10-04-document-delivery');
  const privateDirectory = path.join(runtime.repo, 'tools/local-supabase/supabase/.temp');
  const stem = 'step1-document-' + attempt;
  return { mode, phase, attempt, directory, privateDirectory,
    manifestFile: path.join(directory, 'candidate-manifest.json'),
    previewAccessFile: path.join(privateDirectory, 'step1-preview-access.private.json'),
    privateFile: path.join(privateDirectory, stem + '.private.json'),
    replayFile: path.join(privateDirectory, stem + '.replay.private.json'),
    principalFile: path.join(privateDirectory, stem + '.principal.private.json'),
    principalHumanFile: path.join(privateDirectory, stem + '.principal-human.private.json') };
}

function guardUrl(input, privileged = false, method = 'GET') {
  const url = new URL(input);
  assert.ok(!url.username && !url.password && !url.hash, 'Credentials/fragments in URL refused');
  if (url.origin === PREVIEW) {
    assert.ok(!privileged && method === 'POST' && url.pathname === '/api/clinical-documents' && !url.search,
      'Only the exact Preview document POST is allowed');
  } else {
    assert.equal(url.origin, PROVIDER, 'Non-staging/non-Preview origin refused');
    assert.ok(['/auth/v1/', '/rest/v1/', '/storage/v1/'].some(prefix => url.pathname.startsWith(prefix)), 'Provider route required');
    if (privileged) assert.ok(method === 'POST' && url.pathname === '/auth/v1/admin/users' && !url.search,
      'Server credential allowed only for NEW synthetic Auth user creation');
  }
  return url;
}

function jwt(token, subject, role = 'authenticated', now = Math.floor(Date.now() / 1000), expired = false, minLifetime = 60) {
  assert.match(subject || '', UUID, 'Expected synthetic subject required');
  assert.match(token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Original JWT required');
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { throw Error('JWT claims refused'); }
  assert.equal(claims.sub, subject, 'JWT subject changed');
  assert.equal(claims.role, role, 'Unexpected Auth role');
  assert.equal(claims.iss, PROVIDER + '/auth/v1', 'Non-staging JWT issuer refused');
  assert.match(claims.session_id || '', UUID, 'Real Auth session claim required');
  assert.ok(Number.isSafeInteger(claims.exp), 'JWT expiry required');
  assert.ok(expired ? claims.exp <= now : claims.exp > now + minLifetime, 'Original JWT expired/near expiry or is not yet expired');
  return { expiresAt: claims.exp, sessionId: claims.session_id };
}

function candidateManifest(manifest) {
  assert.equal(manifest.project, PROJECT, 'Candidate project changed');
  assert.equal(manifest.previewOrigin, PREVIEW, 'Exact stable Preview alias required');
  assert.equal(manifest.candidateHead, CANDIDATE, 'Reviewed candidate changed');
  assert.equal(manifest.environment, 'preview', 'Production deployment refused');
  assert.equal(manifest.status, 'READY', 'Ready deployment evidence required');
  assert.equal(manifest.sourceVerified, true, 'Observed exact source binding required');
  assert.match(manifest.deploymentId || '', /^(?:dpl_)?[A-Za-z0-9]{16,80}$/, 'Observed Vercel deployment identity required');
  assert.match(manifest.observedAt || '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'UTC observation timestamp required');
  assert.ok(Number.isFinite(Date.parse(manifest.observedAt)), 'Valid observation time required');
  return { deploymentId: manifest.deploymentId, candidateHead: CANDIDATE, previewOrigin: PREVIEW };
}

function documentRequest(token, scope) {
  assert.deepEqual(Object.keys(scope).sort(), ['clinicId', 'fileId', 'patientId']);
  Object.values(scope).forEach(value => assert.match(value, UUID));
  const headers = { 'Content-Type': 'application/json' };
  if (token !== null) {
    assert.match(token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    headers.Authorization = 'Bearer ' + token;
  }
  return { url: PREVIEW + '/api/clinical-documents', method: 'POST', headers,
    body: JSON.stringify({ clinicId: scope.clinicId, patientId: scope.patientId, fileId: scope.fileId }) };
}

function requestBinding(request) {
  guardUrl(request.url, false, request.method);
  assert.equal(request.url, PREVIEW + '/api/clinical-documents');
  assert.deepEqual(Object.keys(request.headers).sort(), ['Authorization', 'Content-Type']);
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.match(request.headers.Authorization || '', /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const scope = JSON.parse(request.body);
  assert.deepEqual(documentRequest(request.headers.Authorization.slice(7), scope), request,
    'Original request body/header serialization changed');
  return sha(JSON.stringify(request));
}

function previewTransport(capture) {
  assert.deepEqual(Object.keys(capture).sort(), ['headerName', 'headerValue', 'previewOrigin', 'project']);
  assert.equal(capture.project, PROJECT, 'Preview access project changed');
  assert.equal(capture.previewOrigin, PREVIEW, 'Bypass cookie restricted to exact Preview');
  assert.equal(capture.headerName, 'Cookie', 'Only a transport bypass cookie is allowed');
  assert.match(capture.headerValue || '', /^_vercel_jwt=[A-Za-z0-9._~%-]{16,8192}$/,
    'Only the explicitly authorized share-link protection cookie is allowed');
  return { Cookie: capture.headerValue };
}

function applyPreviewTransport(request, transport) {
  const url = guardUrl(request.url, false, request.method || 'GET');
  assert.equal(url.origin, PREVIEW, 'Preview bypass cannot be sent to provider/production');
  assert.deepEqual(Object.keys(transport), ['Cookie']);
  previewTransport({ project: PROJECT, previewOrigin: PREVIEW, headerName: 'Cookie', headerValue: transport.Cookie });
  assert.ok(!Object.hasOwn(request.headers, 'Cookie'), 'Original application request must not contain transport cookies');
  return { ...request, headers: { ...request.headers, ...transport } };
}

function cacheMetadata(headers) {
  const out = {};
  for (const name of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control', 'vary', 'content-type']) {
    const value = headers.get(name);
    if (value !== null) {
      assert.match(value, /^[A-Za-z0-9;,= /+.-]{1,200}$/, 'Unsafe cache metadata refused');
      assert.ok(!/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(value), 'JWT-shaped metadata refused');
      out[name] = value;
    }
  }
  for (const name of ['age', 'content-length']) {
    const value = headers.get(name);
    if (value !== null) { assert.match(value, /^\d{1,12}$/); out[name] = value; }
  }
  for (const name of ['x-vercel-cache', 'cf-cache-status', 'x-cache']) {
    const value = headers.get(name);
    if (value !== null && /^(?:HIT|MISS|BYPASS|DYNAMIC|STALE|REVALIDATED|EXPIRED|DISABLED|CONFIG_NOCACHE)$/i.test(value)) out[name] = value;
  }
  return out;
}

function assertNoStore(response) {
  const cache = response.headers['cache-control'] || '';
  assert.match(cache, /(?:^|[, ])private(?:[, ]|$)/i, 'Private cache directive required');
  assert.match(cache, /(?:^|[, ])no-store(?:[, ]|$)/i, 'No-store directive required');
  assert.match(cache, /max-age=0(?:[, ]|$)/i, 'Zero cache lifetime required');
  assert.ok(!/HIT|STALE/i.test(response.headers['x-vercel-cache'] || ''), 'Cached Preview response refused');
}

function assertDocument(response) {
  assert.equal(response.status, 200, 'Authorized document download failed');
  assert.equal(response.bodySha256, sha(PDF), 'Synthetic document bytes changed');
  assert.equal(response.bytes.length, PDF.length, 'Synthetic document length changed');
  assertNoStore(response);
  assert.equal(response.headers['content-type'], 'application/octet-stream');
  const vary = response.headers.vary || '';
  assert.match(vary, /Authorization/i); assert.match(vary, /Cookie/i);
}

function assertAppDenied(response) {
  assert.ok([401, 403, 404].includes(response.status), 'Expected application authorization denial; outage/invalid input is not proof');
  assert.equal(response.bodySha256, sha(APP_DENIAL), 'Denial must come from the reviewed document handler');
  assertNoStore(response);
}

function responseEvidence(label, request, response) {
  const url = guardUrl(request.url, false, request.method || 'GET');
  const code = response.data?.code;
  const protectedByVercel = url.origin === PREVIEW && response.status === 401 && response.data
    && ['protection', 'access', 'mcp'].every(key => Object.hasOwn(response.data, key));
  return { actor: label, method: request.method || 'GET', path: url.pathname, queryPresent: Boolean(url.search),
    status: response.status, code: typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : null,
    bytes: response.bytes.length, bodySha256: response.bodySha256, headers: response.headers,
    ...(protectedByVercel ? { layer: 'vercel-protection' } : {}) };
}

function assertProviderDenied(response, emptyAllowed = false) {
  if (emptyAllowed && response.status === 200) { assert.deepEqual(response.data, []); return; }
  const denied = [401, 403, 404].includes(response.status)
    || response.status === 400 && ['NoSuchKey', 'NoSuchBucket'].includes(response.data?.code)
    || response.status === 400 && String(response.data?.statusCode) === '403';
  assert.ok(denied, 'Provider outage/generic validation failure is not authorization proof');
  assert.notEqual(response.bodySha256, sha(PDF), 'Denied provider request disclosed document');
}

function clinicalObjectRoutes(registeredObject, nonce = crypto.randomUUID()) {
  assert.match(registeredObject, /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/hosted-1-run-3\.pdf$/);
  assert.match(nonce, UUID, 'Fresh synthetic mutation-key UUID required');
  const object = registeredObject.split('/').map(encodeURIComponent).join('/');
  const mutationObject = registeredObject.replace(/\.pdf$/, '-principal-probe-' + nonce + '.pdf');
  assert.notEqual(mutationObject, registeredObject, 'Existing document mutation forbidden');
  return Object.freeze({
    bytes: Object.freeze(['/storage/v1/object/authenticated/patient-files/' + object, '/storage/v1/object/patient-files/' + object]),
    info: '/storage/v1/object/info/authenticated/patient-files/' + object,
    head: '/storage/v1/object/authenticated/patient-files/' + object,
    list: '/storage/v1/object/list/patient-files', sign: '/storage/v1/object/sign/patient-files/' + object,
    prefix: path.posix.dirname(registeredObject), mutationObject,
    mutation: '/storage/v1/object/patient-files/' + mutationObject.split('/').map(encodeURIComponent).join('/'),
    remove: '/storage/v1/object/patient-files',
    unregistered: '/storage/v1/object/authenticated/patient-files/' + mutationObject.split('/').map(encodeURIComponent).join('/'),
  });
}

function assertProviderPdf(response) {
  assert.equal(response.status, 200, 'Enabled broker byte GET failed');
  assert.equal(response.bodySha256, sha(PDF)); assert.equal(response.bytes.length, PDF.length);
}

function assertProviderInfo(response) {
  assert.equal(response.status, 200, 'Enabled broker exact-key metadata GET failed');
  assert.ok(response.data && typeof response.data === 'object' && !Array.isArray(response.data)
    && Object.keys(response.data).length > 0, 'Object metadata response required');
  assert.ok(!Object.hasOwn(response.data, 'error') && !Object.hasOwn(response.data, 'code'), 'Error body is not object metadata');
}

function assertHeadDenied(response) {
  // HTTP HEAD has no body, including the managed service's NoSuchKey error.
  // The exact known-valid route plus a positive GET and catalog operation
  // exclusion distinguish this opaque rejection from independent ACL proof.
  assert.ok([401, 403, 404].includes(response.status)
    || response.status === 400 && response.bytes.length === 0 && response.data === null, 'HEAD unexpectedly allowed or provider outage');
}

async function verifyPrincipalReads(phase, routes, request) {
  assert.ok(['disabled', 'enabled'].includes(phase));
  for (const route of routes.bytes) {
    const response = await request(route);
    if (phase === 'enabled') assertProviderPdf(response); else assertProviderDenied(response);
  }
  const info = await request(routes.info);
  if (phase === 'enabled') assertProviderInfo(info); else assertProviderDenied(info);
  assertHeadDenied(await request(routes.head, 'HEAD'));
  assertProviderDenied(await request(routes.unregistered));
}

function readJson(filename) {
  assert.ok(!fs.lstatSync(filename).isSymbolicLink(), 'Capture/manifest symlink refused');
  const bytes = fs.readFileSync(filename);
  return { value: JSON.parse(bytes), hash: sha(bytes) };
}

function privatePath(filename, directory) {
  assert.equal(path.dirname(filename), directory, 'Fixed private capture directory required');
  assert.equal(fs.realpathSync(directory), path.resolve(directory), 'Private directory symlink refused');
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--no-index', path.relative(runtime.repo, filename)], { cwd: runtime.repo, windowsHide: true });
  assert.equal(ignored.status, 0, 'Private capture must remain git-ignored');
}

function saveNewPrivate(filename, state, directory) {
  privatePath(filename, directory);
  fs.writeFileSync(filename, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

function ownedFixture() {
  const source = fixtures.plan('matrix', '1', PROJECT, '3');
  const capture = readJson(source.privateFile);
  assert.equal(capture.value.project, PROJECT); assert.equal(capture.value.attempt, '1');
  Object.values(capture.value.fixtures).forEach(value => assert.match(value, UUID));
  fixtures.verifiedMatrix(capture.value, source.directory, sha(fs.readFileSync(path.join(__dirname, 'verify-clinia-hosted-api.cjs'))));
  assert.equal(capture.value.verifiedMatrix.runNumber, '3', 'Fixed verified synthetic media fixture required');
  const media = fixtures.mediaSpecs(capture.value, '3')[0];
  assert.equal(sha(media.bytes), sha(PDF));
  return { state: capture.value, sourceHash: capture.hash, media };
}

function preparedState(state, attempt) {
  assert.equal(state.project, PROJECT); assert.equal(state.attempt, attempt); assert.equal(state.stage, 'PREPARED');
  assert.match(state.originalCaptureSha256, SHA);
  assert.match(state.document.path, /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/hosted-1-run-3\.pdf$/);
  assert.deepEqual(Object.keys(state.scope).sort(), ['clinicId', 'fileId', 'patientId']);
  Object.values(state.scope).forEach(value => assert.match(value, UUID));
  assert.ok(state.document.path.startsWith(state.scope.clinicId + '/' + state.scope.patientId + '/'), 'Owned document scope changed');
  assert.equal(state.document.sha256, sha(PDF));
  assert.equal(state.document.size, PDF.length);
  for (const label of [...ACTORS, 'owner_A', 'owner_B']) {
    const actor = state.actors[label]; assert.match(actor?.id || '', UUID);
    const email = label.startsWith('owner_')
      ? new RegExp('^clinia-' + label.toLowerCase() + '-[a-f0-9]{12}@clinia\\.invalid$')
      : new RegExp('^clinia-document-' + label.toLowerCase() + '-[a-f0-9]{12}@clinia\\.invalid$');
    assert.match(actor.email || '', email);
    assert.ok(typeof actor.password === 'string' && actor.password.length >= 32);
    assert.match(actor.token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  }
  return state;
}

function verifyReplay(replay, state, binding, now = Math.floor(Date.now() / 1000), phase = 'warm') {
  assert.equal(replay.project, PROJECT); assert.equal(replay.attempt, state.attempt);
  for (const key of ['manifestSha256', 'preparedSha256', 'driverSha256', 'transportSha256']) {
    assert.match(binding[key] || '', SHA);
    assert.equal(replay[key], binding[key], 'Frozen ' + key + ' changed');
  }
  assert.deepEqual(Object.keys(replay.requests).sort(), [...ACTORS, 'owner_A'].sort());
  for (const label of [...ACTORS, 'owner_A']) {
    const request = replay.requests[label], actor = state.actors[label];
    assert.deepEqual(request, documentRequest(actor.token, state.scope), 'Warmed original bearer/body changed');
    assert.equal(replay.requestSha256[label], requestBinding(request), 'Warmed request digest changed');
    // Only the selected replay must still be live; expiry proof uses the signed
    // token that succeeded before, without forging a new expired signature.
    if (phase === 'warm' || label === REPLAY_ACTOR[phase]) jwt(actor.token, actor.id, 'authenticated', now, phase === 'expired');
  }
  assert.match(replay.warmEvidence.filename, /^probe-warm-\d+-[a-f0-9]{8}\.json$/);
  assert.match(replay.warmEvidence.sha256, SHA);
  return replay;
}

async function boundedResponse(response) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), parts = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      assert.ok(size <= 10 * 1024 * 1024 + 65536, 'Response body bound exceeded');
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts, size);
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

async function run(args) {
  const p = plan(args), config = runtime.readConfig();
  assert.equal(config.project, PROJECT); assert.equal(config.origin, PROVIDER);
  fs.mkdirSync(p.directory, { recursive: true });
  const driverSha256 = sha(fs.readFileSync(__filename));
  const filename = p.mode + '-' + p.phase + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.json';
  const evidence = path.join(p.directory, filename);
  const report = { status: 'PARTIALLY VERIFIED', mode: p.mode, phase: p.phase, attempt: p.attempt, project: PROJECT,
    startedAt: new Date().toISOString(), driverSha256, checks: [], requests: [],
    limits: ['Owned synthetic staging fixtures only; production forbidden',
      'Operator changes authorization separately; driver never revokes/restores actors',
      'Candidate manifest is operator-observed Vercel evidence, not a runtime source attestation',
      'Actual expiry requires the original successful JWT to expire; forged signatures do not count'] };
  const persist = () => fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  let transport = null;
  async function check(name, fn) {
    try { await fn(); report.checks.push({ name, status: 'VERIFIED' }); persist(); }
    catch { report.checks.push({ name, status: 'FAILED' }); persist(); throw Error('Named check failed'); }
  }
  async function send(label, request, privileged = false) {
    const url = guardUrl(request.url, privileged, request.method || 'GET');
    const outbound = url.origin === PREVIEW && transport ? applyPreviewTransport(request, transport) : request;
    const response = await fetch(url, { ...outbound, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
    const bytes = await boundedResponse(response);
    let data = null; try { data = JSON.parse(bytes.toString('utf8')); } catch {}
    const result = { status: response.status, data, bytes, bodySha256: sha(bytes), headers: cacheMetadata(response.headers) };
    report.requests.push(responseEvidence(label, request, result));
    persist(); return result;
  }
  const provider = (label, route, token, method = 'GET', body, privileged = false, raw = false) => send(label, {
    url: PROVIDER + route, method,
    headers: { apikey: privileged ? config.service : config.anon, Authorization: 'Bearer ' + token,
      'Content-Type': raw ? 'application/pdf' : 'application/json' },
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
  }, privileged);
  async function login(label, actor, role = 'authenticated') {
    const response = await provider(label + '_login', '/auth/v1/token?grant_type=password', config.anon, 'POST', { email: actor.email, password: actor.password });
    assert.equal(response.status, 200); assert.equal(response.data?.user?.id, actor.id);
    jwt(response.data?.access_token, actor.id, role); return response.data.access_token;
  }
  try {
    const fixture = ownedFixture();
    if (p.mode === 'prepare') {
      assert.ok(!fs.existsSync(p.privateFile), 'Fresh NEW actor attempt required; captures are never overwritten');
      const state = { project: PROJECT, attempt: p.attempt, stage: 'PREPARING', originalCaptureSha256: fixture.sourceHash,
        scope: { clinicId: fixture.state.fixtures.clinicA, patientId: fixture.state.fixtures.patientA, fileId: null },
        document: { path: fixture.media.object, sha256: sha(PDF), size: PDF.length }, actors: {} };
      saveNewPrivate(p.privateFile, state, p.privateDirectory);
      const persistPrivate = () => {
        const temporary = p.privateFile + '.new'; saveNewPrivate(temporary, state, p.privateDirectory);
        fs.renameSync(temporary, p.privateFile);
      };
      await check('Fresh owner logins preserve every original matrix credential', async () => {
        for (const label of ['owner_A', 'owner_B']) {
          const old = fixture.state.actors[label];
          assert.match(old.email, new RegExp('^clinia-' + label.toLowerCase() + '-[a-f0-9]{12}@clinia\\.invalid$'));
          state.actors[label] = { id: old.id, email: old.email, password: old.password, token: await login(label, old) };
          persistPrivate();
        }
      });
      await check('Owned registered synthetic PDF metadata found using ordinary owner JWT', async () => {
        const query = new URLSearchParams({ select: 'id,file_path,type,size', clinic_id: 'eq.' + state.scope.clinicId,
          patient_id: 'eq.' + state.scope.patientId, file_path: 'eq.' + state.document.path, deleted_at: 'is.null' });
        const response = await provider('owner_A', '/rest/v1/patient_files?' + query, state.actors.owner_A.token);
        assert.equal(response.status, 200); assert.ok(Array.isArray(response.data)); assert.equal(response.data.length, 1);
        const file = response.data[0]; assert.match(file.id, UUID); assert.equal(file.file_path, state.document.path);
        assert.equal(file.type, 'application/pdf'); assert.equal(Number(file.size), PDF.length);
        state.scope.fileId = file.id; persistPrivate();
      });
      await check('Five new synthetic Auth doctor sessions captured privately', async () => {
        for (const label of ACTORS) {
          const actor = { email: 'clinia-document-' + label.toLowerCase() + '-' + crypto.randomBytes(6).toString('hex') + '@clinia.invalid',
            password: 'A9!' + crypto.randomBytes(36).toString('base64url') };
          const response = await provider('synthetic_auth_admin', '/auth/v1/admin/users', config.service, 'POST',
            { email: actor.email, password: actor.password, email_confirm: true, user_metadata: { full_name: 'Sintético documento ' + label } }, true);
          assert.ok([200, 201].includes(response.status)); assert.equal(response.data?.email, actor.email); assert.match(response.data?.id || '', UUID);
          actor.id = response.data.id; state.actors[label] = actor; persistPrivate();
          actor.token = await login(label, actor); persistPrivate();
        }
      });
      state.stage = 'PREPARED'; preparedState(state, p.attempt); persistPrivate();
      assert.equal(readJson(fixtures.plan('matrix', '1', PROJECT, '3').privateFile).hash, fixture.sourceHash, 'Original fixture capture changed');
      report.actorIds = ACTORS.map(label => ({ label, id: state.actors[label].id, clinicId: state.scope.clinicId, role: 'doctor' }));
    } else if (p.mode === 'principal') {
      const principalSource = readJson(path.join(p.privateDirectory, 'document-delivery-20261004.private.json')).value;
      assert.equal(principalSource.project, PROJECT); assert.match(principalSource.id, UUID);
      assert.match(principalSource.email || '', /^clinia-document-delivery-[a-f0-9]{12}@clinia\.invalid$/);
      let captured;
      if (p.phase === 'disabled') {
        assert.ok(!fs.existsSync(p.principalFile), 'Fresh principal attempt required');
        captured = { project: PROJECT, attempt: p.attempt, id: principalSource.id,
          token: await login('delivery_principal', principalSource, 'clinia_document_delivery'), originalCaptureSha256: fixture.sourceHash };
        saveNewPrivate(p.principalFile, captured, p.privateDirectory);
      } else {
        captured = readJson(p.principalFile).value;
        assert.match(captured.disabledEvidence?.filename || '', /^principal-disabled-\d+-[a-f0-9]{8}\.json$/);
        const disabled = readJson(path.join(p.directory, captured.disabledEvidence.filename));
        assert.equal(disabled.hash, captured.disabledEvidence.sha256); assert.equal(disabled.value.status, 'VERIFIED');
      }
      assert.equal(captured.project, PROJECT); assert.equal(captured.attempt, p.attempt); assert.equal(captured.id, principalSource.id);
      assert.equal(captured.originalCaptureSha256, fixture.sourceHash);
      jwt(captured.token, captured.id, 'clinia_document_delivery');
      report.originalTokenSha256 = sha(captured.token);
      const routes = clinicalObjectRoutes(fixture.media.object);
      let human;
      if (fs.existsSync(p.principalHumanFile)) human = readJson(p.principalHumanFile).value;
      else {
        const owner = fixture.state.actors.owner_A;
        assert.match(owner.email || '', /^clinia-owner_a-[a-f0-9]{12}@clinia\.invalid$/);
        human = { project: PROJECT, attempt: p.attempt, id: owner.id, originalCaptureSha256: fixture.sourceHash,
          token: await login('owner_A_principal_matrix', owner) };
        saveNewPrivate(p.principalHumanFile, human, p.privateDirectory);
      }
      assert.equal(human.project, PROJECT); assert.equal(human.attempt, p.attempt);
      assert.equal(human.id, fixture.state.actors.owner_A.id); assert.equal(human.originalCaptureSha256, fixture.sourceHash);
      jwt(human.token, human.id);
      await check('Registered principal live enabled state matches explicit phase', async () => {
        const active = await provider('delivery_principal', '/rest/v1/rpc/clinia_document_delivery_active', captured.token, 'POST', {});
        assert.equal(active.status, 200); assert.equal(active.data, p.phase === 'enabled');
      });
      await check('Custom Auth role cannot read clinical tables or call clinical RPC', async () => {
        for (const table of ['patients', 'patient_files']) {
          const query = new URLSearchParams({ select: 'id', [table === 'patients' ? 'id' : 'patient_id']: 'eq.' + fixture.state.fixtures.patientA });
          assertProviderDenied(await provider('delivery_principal', '/rest/v1/' + table + '?' + query, captured.token));
        }
        assertProviderDenied(await provider('delivery_principal', '/rest/v1/rpc/get_patients_with_stats', captured.token, 'POST',
          { p_clinic_id: fixture.state.fixtures.clinicA, p_patient_id: fixture.state.fixtures.patientA }));
      });
      await check('Custom Auth role cannot list, sign or write clinical objects', async () => {
        assertProviderDenied(await provider('delivery_principal', routes.list, captured.token, 'POST',
          { prefix: routes.prefix, limit: 100, offset: 0 }), true);
        assertProviderDenied(await provider('delivery_principal', routes.sign, captured.token, 'POST', { expiresIn: 5 }));
        assertProviderDenied(await provider('delivery_principal', routes.mutation, captured.token, 'POST', PDF, false, true));
        assertProviderDenied(await provider('delivery_principal', routes.mutation, captured.token, 'PUT', PDF, false, true));
        assertProviderDenied(await provider('delivery_principal', routes.remove, captured.token, 'DELETE', { prefixes: [routes.mutationObject] }), true);
      });
      await check('Both broker byte GET aliases and exact-key metadata follow live enabled state; HEAD and new key rejected', async () => {
        await verifyPrincipalReads(p.phase, routes, (route, method = 'GET') => provider('delivery_principal', route, captured.token, method));
      });
      await check('Fresh ordinary owner retains live clinical membership independently of broker', async () => {
        const active = await provider('owner_A', '/rest/v1/rpc/clinia_session_active', human.token, 'POST', {});
        assert.equal(active.status, 200); assert.equal(active.data, true);
        const role = await provider('owner_A', '/rest/v1/rpc/get_clinic_member_role', human.token, 'POST', { check_clinic_id: fixture.state.fixtures.clinicA });
        assert.equal(role.status, 200); assert.equal(role.data, 'clinic_owner');
      });
      await check('Ordinary owner and anonymous cannot read byte aliases/metadata, list or sign clinical objects', async () => {
        for (const [label, callerToken] of [['owner_A', human.token], ['anonymous', config.anon]]) {
          for (const route of [...routes.bytes, routes.info]) assertProviderDenied(await provider(label, route, callerToken));
          assertProviderDenied(await provider(label, routes.list, callerToken, 'POST', { prefix: routes.prefix, limit: 100, offset: 0 }), true);
          assertProviderDenied(await provider(label, routes.sign, callerToken, 'POST', { expiresIn: 5 }));
        }
      });
      assert.equal(readJson(fixtures.plan('matrix', '1', PROJECT, '3').privateFile).hash, fixture.sourceHash, 'Original fixture capture changed');
      report.limits.push('HEAD HTTP400 without a body is an opaque rejection; catalog operation exclusion provides its exact boundary',
        'Mutation probes use only a fresh nonexistent key; empty DELETE/nonexistent-key rejection does not prove denial for an existing object');
      report.status = 'VERIFIED'; report.completedAt = new Date().toISOString(); persist();
      if (p.phase === 'disabled') {
        captured.disabledEvidence = { filename, sha256: sha(fs.readFileSync(evidence)) };
        const temporary = p.principalFile + '.new'; saveNewPrivate(temporary, captured, p.privateDirectory); fs.renameSync(temporary, p.principalFile);
      }
    } else {
      const prepared = readJson(p.privateFile), state = preparedState(prepared.value, p.attempt);
      assert.equal(state.originalCaptureSha256, fixture.sourceHash, 'Verified fixture capture changed');
      assert.equal(state.document.path, fixture.media.object);
      const manifest = readJson(p.manifestFile), candidate = candidateManifest(manifest.value);
      let transportSha256 = sha('direct-preview-no-bypass');
      if (fs.existsSync(p.previewAccessFile)) {
        privatePath(p.previewAccessFile, p.privateDirectory);
        const access = readJson(p.previewAccessFile); transport = previewTransport(access.value); transportSha256 = access.hash;
      }
      report.candidate = candidate; report.manifestSha256 = manifest.hash; report.preparedSha256 = prepared.hash;
      report.transportSha256 = transportSha256;
      const binding = { manifestSha256: manifest.hash, preparedSha256: prepared.hash, driverSha256, transportSha256 };
      let replay;
      if (p.phase === 'warm') {
        assert.ok(!fs.existsSync(p.replayFile), 'Successful warmed originals cannot be overwritten');
        replay = { project: PROJECT, attempt: p.attempt, ...binding, requests: {}, requestSha256: {} };
        for (const label of [...ACTORS, 'owner_A']) {
          jwt(state.actors[label].token, state.actors[label].id);
          replay.requests[label] = documentRequest(state.actors[label].token, state.scope);
          replay.requestSha256[label] = requestBinding(replay.requests[label]);
          await check(label + ' exact document request succeeds twice with uncached expected bytes', async () => {
            assertDocument(await send(label, replay.requests[label])); assertDocument(await send(label, replay.requests[label]));
          });
        }
        await check('Anonymous and real foreign-clinic owner cannot obtain document', async () => {
          assertAppDenied(await send('anonymous', documentRequest(null, state.scope)));
          jwt(state.actors.owner_B.token, state.actors.owner_B.id);
          assertAppDenied(await send('owner_B', documentRequest(state.actors.owner_B.token, state.scope)));
        });
      } else {
        replay = readJson(p.replayFile).value;
        const actor = state.actors[REPLAY_ACTOR[p.phase]];
        const now = Math.floor(Date.now() / 1000);
        const expired = p.phase === 'expired' && JSON.parse(Buffer.from(actor.token.split('.')[1], 'base64url')).exp <= now;
        verifyReplay(replay, state, binding, now, p.phase === 'expired' && !expired ? 'pending-expired' : p.phase);
        const warm = readJson(path.join(p.directory, replay.warmEvidence.filename));
        assert.equal(warm.hash, replay.warmEvidence.sha256); assert.equal(warm.value.status, 'VERIFIED');
        assert.equal(warm.value.phase, 'warm'); assert.equal(warm.value.driverSha256, driverSha256);
        assert.equal(warm.value.manifestSha256, manifest.hash); assert.equal(warm.value.preparedSha256, prepared.hash);
        report.originalTokenSha256 = sha(actor.token); report.originalRequestSha256 = replay.requestSha256[REPLAY_ACTOR[p.phase]];
        report.warmEvidence = replay.warmEvidence;
        if (p.phase === 'expired' && !expired) {
          report.status = 'PENDING'; report.expiresAt = jwt(actor.token, actor.id, 'authenticated', now, false, 0).expiresAt;
          report.pending = 'Real original JWT expiry has not occurred; no forged signature or expiry claim accepted';
          return;
        }
        await check(p.phase + ' replays identical original bearer and serialized body twice without disclosure', async () => {
          const request = replay.requests[REPLAY_ACTOR[p.phase]];
          assertAppDenied(await send(REPLAY_ACTOR[p.phase], request)); assertAppDenied(await send(REPLAY_ACTOR[p.phase], request));
        });
        if (p.phase !== 'expired') await check('Independent original owner request still succeeds on the same Preview', async () => {
            jwt(state.actors.owner_A.token, state.actors.owner_A.id);
            assertDocument(await send('owner_A', replay.requests.owner_A));
          });
        else report.limits.push('Original owner JWT may expire with the tested actor; genuine expiry proof has no contemporaneous owner positive control');
      }
      report.status = 'VERIFIED'; report.completedAt = new Date().toISOString(); persist();
      if (p.phase === 'warm') {
        replay.warmEvidence = { filename, sha256: sha(fs.readFileSync(evidence)) };
        saveNewPrivate(p.replayFile, replay, p.privateDirectory);
      }
    }
    report.status = 'VERIFIED';
  } catch {
    report.status = report.requests.some(request => request.layer === 'vercel-protection') ? 'BLOCKED' : 'PARTIALLY VERIFIED';
    report.failure = report.status === 'BLOCKED'
      ? 'Vercel deployment protection refused CLI access before the document handler'
      : 'Guarded verification failed; only safe statuses/hashes/check names retained';
    process.exitCode = 1;
  } finally {
    report.completedAt ||= new Date().toISOString(); persist();
    const summary = { status: report.status, mode: p.mode, phase: p.phase, attempt: p.attempt, checks: report.checks.length, evidence };
    if (report.actorIds) summary.actorIds = report.actorIds;
    console.log(JSON.stringify(summary));
  }
}

if (require.main === module) {
  if (process.argv.length === 3 && ['--help', '-h'].includes(process.argv[2])) console.log(HELP);
  else run(process.argv.slice(2)).catch(() => { console.error('Exact staging prerequisites refused; no credential/provider contents emitted'); process.exitCode = 1; });
}
module.exports = { PROJECT, PROVIDER, PREVIEW, CANDIDATE, ACTORS, PDF, APP_DENIAL, HELP, plan, guardUrl, jwt, candidateManifest,
  documentRequest, requestBinding, cacheMetadata, assertNoStore, assertDocument, assertAppDenied, assertProviderDenied,
  clinicalObjectRoutes, assertProviderPdf, assertProviderInfo, assertHeadDenied, verifyPrincipalReads,
  previewTransport, applyPreviewTransport, responseEvidence, preparedState, verifyReplay, sha };
