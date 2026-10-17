'use strict';
// Candidate-bound authenticated HTTP replays. This driver never mutates
// membership/session state, refreshes a warmed JWT, or calls provider routes
// except Auth password login and NEW synthetic Auth-user creation in prepare.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const spawnSync = require('node:child_process').spawnSync;
const runtime = require('./clinia-staging-runtime.cjs');
const old = require('./verify-clinia-document-runtime.cjs');
const hosted = require('./verify-clinia-hosted-api.cjs');
const syntheticMfa = require('./clinia-synthetic-mfa.cjs');

const PROJECT = 'phihonofwyerpfgqfekt';
const PREVIEW = 'https://v0-denta-pro-git-codex-cl-3f4a77-alesuav2001-gmailcoms-projects.vercel.app';
const CLINIC = 'd9a47157-1d36-43df-af1d-436d561ee551';
const PATIENT = 'b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14';
const AVATAR_DOCTOR = '272d63b1-38e3-4a60-89a2-dd07f031b2d2';
const FILE = '4e3b7af1-c025-4ab6-bda5-b48d4e11d0c8';
const PDF_SHA256 = '1f3c816b91e3f7f6737d99f5be95be1b82a7e7cffc73a7a40c4c275dbcca1552';
const PNG_SHA256 = 'd8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const DOCUMENT_DENIAL_SHA256 = sha(Buffer.from('No se pudo entregar el documento.'));
const MEDIA_DENIAL_SHA256 = sha(Buffer.from('No se pudo entregar la imagen.'));
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEAD = /^[a-f0-9]{40}$/i;
const REPLAYS = Object.freeze(['removed', 'demoted', 'logout', 'ban', 'expired']);
const ACTOR_BY_PHASE = Object.freeze({ removed: 'doctor_removed', demoted: 'doctor_demoted', logout: 'doctor_logout', ban: 'doctor_ban', expired: 'doctor_expired' });
const HELP = `Candidate-bound staging HTTP evidence (never changes memberships or sessions).
  node scripts/verify-clinia-origin-candidate.cjs prepare 1 <candidate-head-40hex>
  node scripts/verify-clinia-origin-candidate.cjs warm 1 <candidate-head-40hex>
  node scripts/verify-clinia-origin-candidate.cjs replay removed|demoted|logout|ban|expired 1 <candidate-head-40hex>

Requires a NEW operator-observed manifest at docs/production/evidence/2026-10-06-origin-candidate/candidate-manifest.json.
Before warm, the operator must assign all five new synthetic Auth users as doctors
in the synthetic clinic. Replay phases require the corresponding already-warmed
doctor to have undergone only the named operator change. This tool never changes
those states and never refreshes a warmed doctor JWT. Use a fresh attempt when a
token expires before another status phase. All request credentials stay ignored.
`;
const MEDIA = Object.freeze([
  { kind: 'clinic-logo', clinicId: CLINIC, entityId: CLINIC, expectedSha256: PNG_SHA256, expectedBytes: 68 },
  { kind: 'doctor-avatar', clinicId: CLINIC, entityId: AVATAR_DOCTOR, expectedSha256: PNG_SHA256, expectedBytes: 68 },
  { kind: 'patient-avatar', clinicId: CLINIC, entityId: PATIENT, expectedSha256: PNG_SHA256, expectedBytes: 68 },
]);
const evidenceDir = path.join(runtime.repo, 'docs/production/evidence/2026-10-06-origin-candidate');
const privateDir = path.join(runtime.repo, 'tools/local-supabase/supabase/.temp');
const fixturePath = hosted.plan('matrix', '1', PROJECT).privateFile;

function manifestPath() { return path.join(evidenceDir, 'candidate-manifest.json'); }
function candidateManifest(value, explicitHead) {
  assert.match(explicitHead || '', HEAD, 'Explicit candidate source commit required');
  assert.equal(value.project, PROJECT, 'Exact staging project required');
  assert.equal(value.previewOrigin, PREVIEW, 'Exact branch Preview origin required');
  assert.equal(value.candidateHead, explicitHead, 'CLI candidate head differs from observed manifest');
  assert.equal(value.sourceCommit, explicitHead, 'Observed deployment source commit differs from CLI candidate head');
  assert.equal(value.environment, 'preview', 'Production environment refused');
  assert.equal(value.status, 'READY', 'Observed Ready deployment required');
  assert.equal(value.sourceVerified, true, 'Operator-observed source binding required');
  assert.match(value.deploymentId || '', /^(?:dpl_)?[A-Za-z0-9]{16,80}$/, 'Observed unique deployment ID required');
  const deployment = new URL(value.deploymentOrigin || '');
  assert.equal(deployment.protocol, 'https:');
  assert.match(deployment.hostname, /^[a-z0-9-]+\.vercel\.app$/i, 'Unique Vercel deployment origin required');
  assert.equal(deployment.origin, value.deploymentOrigin, 'Deployment origin must be a bare HTTPS origin');
  assert.notEqual(deployment.origin, PREVIEW, 'Unique deployment origin cannot be the branch alias');
  assert.match(value.observedAt || '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);
  assert.ok(Number.isFinite(Date.parse(value.observedAt)));
  return { project: PROJECT, candidateHead: explicitHead, deploymentId: value.deploymentId,
    environment: 'preview', status: 'READY', observedAt: value.observedAt };
}
function plan(args) {
  assert.ok(Array.isArray(args));
  assert.ok(['prepare', 'warm', 'replay'].includes(args[0]), 'Explicit mode required');
  const mode = args[0], phase = mode === 'replay' ? args[1] : mode;
  const attempt = mode === 'replay' ? args[2] : args[1];
  const head = mode === 'replay' ? args[3] : args[2];
  assert.equal(args.length, mode === 'replay' ? 4 : 3, 'Unexpected arguments refused');
  if (mode === 'replay') assert.ok(REPLAYS.includes(phase), 'Unknown replay phase');
  assert.match(attempt || '', /^[1-9]$/, 'Fresh attempt 1..9 required');
  assert.match(head || '', HEAD, 'Explicit new candidate source commit required');
  const stem = 'origin-candidate-' + attempt;
  return { mode, phase, attempt, candidateHead: head,
    directory: evidenceDir,
    privateFile: path.join(privateDir, stem + '.private.json'),
    warmPrivateFile: path.join(privateDir, stem + '.warm.private.json'),
    manifestFile: manifestPath() };
}
function verifyCandidateFile(p) {
  assert.ok(fs.existsSync(p.manifestFile), 'New candidate observation manifest is required');
  const bytes = fs.readFileSync(p.manifestFile);
  const value = JSON.parse(bytes.toString('utf8'));
  return { identity: candidateManifest(value, p.candidateHead), sha256: sha(bytes) };
}
function fixedPath(pathname) {
  assert.ok(pathname === '/api/clinical-documents' || pathname === '/api/private-media', 'Exact application handler required');
  return pathname;
}
function requestFor(kind, token, clinicId = CLINIC, entityId) {
  assert.equal(clinicId, CLINIC, 'Candidate test is scoped to the exact synthetic clinic');
  const headers = { 'Content-Type': 'application/json' };
  if (token !== null) {
    assert.match(token || '', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    headers.Authorization = 'Bearer ' + token;
  } else headers.Origin = PREVIEW;
  let pathname, body;
  if (kind === 'document') {
    assert.equal(entityId, FILE);
    pathname = '/api/clinical-documents';
    body = JSON.stringify({ clinicId, patientId: PATIENT, fileId: FILE });
  } else {
    const spec = MEDIA.find(item => item.kind === kind);
    assert.ok(spec, 'Known private-media kind required');
    assert.equal(entityId, spec.entityId, 'Known synthetic entity required');
    pathname = '/api/private-media';
    body = JSON.stringify({ kind, clinicId, entityId });
  }
  fixedPath(pathname);
  return { method: 'POST', path: pathname, headers, body };
}
function wire(request) {
  const headers = request.headers || {};
  const auth = headers.Authorization || '';
  const authToken = auth ? auth.slice('Bearer '.length) : null;
  return { method: request.method, path: fixedPath(request.path), contentType: headers['Content-Type'],
    origin: headers.Origin || null, body: request.body, authorizationSha256: authToken ? sha(Buffer.from(authToken)) : null };
}
function requestDigest(request) { return sha(Buffer.from(JSON.stringify(wire(request)))); }
function assertNoProviderUrl(value) {
  const serialized = JSON.stringify(value);
  assert.ok(!/https?:\/\/[^" ]+\.supabase\.co/i.test(serialized), 'Provider URLs may not enter candidate evidence');
  assert.ok(!/Bearer\s+[A-Za-z0-9._-]{20,}/i.test(serialized), 'Bearer credentials may not enter public evidence');
}
function verifyFrozen(frozen) {
  assert.equal(frozen.project, PROJECT);
  assert.match(frozen.attempt || '', /^[1-9]$/);
  assert.match(frozen.candidateHead || '', HEAD);
  assert.ok(Array.isArray(frozen.requests) && frozen.requests.length >= 4);
  for (const entry of frozen.requests) {
    assert.ok(['owner_A', 'owner_B', 'receptionist_A', ...Object.values(ACTOR_BY_PHASE), 'anonymous'].includes(entry.actor));
    if (entry.actor === 'anonymous') assert.equal(entry.jwtSha256, null);
    else assert.match(entry.jwtSha256 || '', /^[a-f0-9]{64}$/);
    assert.match(entry.requestSha256 || '', /^[a-f0-9]{64}$/);
    assert.equal(entry.requestDigest, requestDigest(entry.request), 'Frozen original request changed');
    assert.ok(!String(entry.request.path).includes('://'), 'Frozen request stores only the exact application path');
    assert.ok(['Content-Type', 'Authorization', 'Origin'].every(key =>
      !Object.hasOwn(entry.request.headers, key) || key === 'Content-Type' || key === 'Origin' || entry.actor !== 'anonymous'));
    const token = entry.request.headers.Authorization?.replace(/^Bearer /, '') || null;
    const body = JSON.parse(entry.request.body);
    const reconstructed = entry.request.path === '/api/clinical-documents'
      ? requestFor('document', token, body.clinicId, body.fileId)
      : requestFor(body.kind, token, body.clinicId, body.entityId);
    assert.deepEqual(entry.request, reconstructed, 'Only the exact expected body and headers may be frozen');
    assertNoStore(entry.response?.responseHeaders || {});
    if (entry.expected === 'allow') {
      assert.equal(entry.response?.status, 200, 'Successful warm response required');
      const isDocument = entry.request.path === '/api/clinical-documents';
      assert.equal(entry.response.bytes, isDocument ? 70 : 68);
      assert.equal(entry.response.bodySha256, isDocument ? PDF_SHA256 : PNG_SHA256);
      assert.equal(entry.response.responseHeaders['content-type'], isDocument ? 'application/octet-stream' : 'image/png');
      assert.match(entry.response.responseHeaders.vary || '', /Authorization/i);
    } else {
      assert.ok([401, 403, 404].includes(entry.response?.status), 'Expected application denial must be warmed');
      assert.ok(entry.response.bytes > 0);
    }
  }
  return frozen;
}
function verifyWarmReceipt(receipt, frozen, frozenBytes) {
  assert.equal(receipt.project, PROJECT); assert.equal(receipt.phase, 'warm');
  assert.equal(receipt.status, 'WARM_VERIFIED');
  assert.equal(receipt.attempt, frozen.attempt); assert.equal(receipt.candidateHead, frozen.candidateHead);
  assert.equal(receipt.manifestSha256, frozen.manifestSha256);
  assert.equal(receipt.frozenRequestsSha256, sha(frozenBytes), 'Immutable private request capture changed');
  assert.deepEqual(receipt.requests, frozen.requests.map(item => item.response), 'Warm receipt differs from frozen response records');
  return receipt;
}
function assertNoStore(headers) {
  const cache = headers['cache-control'] || '';
  assert.match(cache, /(?:^|[, ])private(?:[, ]|$)/i);
  assert.match(cache, /(?:^|[, ])no-store(?:[, ]|$)/i);
  assert.match(cache, /max-age=0(?:[, ]|$)/i);
  assert.ok(!/^(?:HIT|STALE)$/i.test(headers['x-vercel-cache'] || ''));
}
function assertProtectedHandler(response) {
  assert.ok(!response.protectionInterception, 'Vercel protection response is not application evidence');
  assert.ok(!/text\/html/i.test(response.headers['content-type'] || ''), 'HTML challenge is not application evidence');
  assert.ok(response.status < 500, 'Provider/application outage is not authorization evidence');
}
function privateCapturePath(file) {
  assert.equal(path.dirname(file), privateDir);
  assert.equal(fs.realpathSync(privateDir), path.resolve(privateDir));
  assert.equal(spawnSync('git', ['check-ignore', '--quiet', '--no-index', path.relative(runtime.repo, file)],
    { cwd: runtime.repo, windowsHide: true }).status, 0, 'Capture must be ignored');
}
function readPrivate(file) {
  privateCapturePath(file);
  assert.ok(!fs.lstatSync(file).isSymbolicLink());
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function savePrivate(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  privateCapturePath(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function updatePrivate(file, value) {
  privateCapturePath(file);
  assert.ok(fs.existsSync(file), 'Initial private capture required');
  const temporary = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function safeRequestEvidence(actor, request, response, expected) {
  const item = { actor, method: request.method, path: fixedPath(request.path), body: JSON.parse(request.body),
    headerNames: Object.keys(request.headers).sort(), requestSha256: requestDigest(request),
    jwtSha256: wire(request).authorizationSha256, status: response.status, bytes: response.bytes.length,
    bodySha256: sha(response.bytes), responseHeaders: response.headers, expected };
  assertNoProviderUrl(item);
  return item;
}
function makeRequests(actor, token) {
  return [requestFor('document', token, CLINIC, FILE), ...MEDIA.map(spec => requestFor(spec.kind, token, CLINIC, spec.entityId))];
}
function expectedFor(request, actor) {
  if (actor === 'owner_B' || actor === 'receptionist_A' || actor === 'anonymous') return 'denied';
  return 'allow';
}

async function http(request) {
  const url = new URL(request.path, PREVIEW);
  assert.equal(url.origin, PREVIEW);
  assert.equal(url.search, '');
  const headers = { ...request.headers };
  const response = await fetch(url, { method: request.method, headers, body: request.body,
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  const reader = response.body?.getReader(); const chunks = []; let total = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        total += value.byteLength; assert.ok(total <= 4 * 1024 * 1024, 'Response body limit exceeded');
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = Buffer.concat(chunks, total);
  let json = null; try { json = JSON.parse(bytes.toString('utf8')); } catch {}
  const protectionInterception = response.status === 401 && json && ['protection', 'access', 'mcp'].every(key => Object.hasOwn(json, key));
  const headersSafe = old.cacheMetadata(response.headers);
  return { status: response.status, bytes, json, protectionInterception: Boolean(protectionInterception), headers: headersSafe };
}
function validateResponse(response, request, expected, actor) {
  assertProtectedHandler(response);
  assertNoStore(response.headers);
  if (expected === 'allow') {
    assert.equal(response.status, 200);
    if (request.path === '/api/clinical-documents') {
      assert.equal(response.bytes.length, 70); assert.equal(sha(response.bytes), PDF_SHA256);
      assert.equal(response.headers['content-type'], 'application/octet-stream');
    } else {
      const kind = JSON.parse(request.body).kind, spec = MEDIA.find(item => item.kind === kind);
      assert.equal(response.bytes.length, spec.expectedBytes); assert.equal(sha(response.bytes), spec.expectedSha256);
      assert.equal(response.headers['content-type'], 'image/png');
    }
    assert.match(response.headers.vary || '', /Authorization/i);
    return;
  }
  assert.ok([401, 403, 404].includes(response.status), `${actor} expected application authorization denial`);
  const expectedBodyHash = request.path === '/api/clinical-documents' ? DOCUMENT_DENIAL_SHA256 : MEDIA_DENIAL_SHA256;
  assert.equal(sha(response.bytes), expectedBodyHash, 'Expected denial must come from the actual reviewed handler');
}
function loadFixtureActors() {
  assert.ok(fs.existsSync(fixturePath), 'Existing owned hosted synthetic actor capture required');
  const state = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(state.project, PROJECT); assert.equal(state.attempt, '1');
  assert.equal(state.fixtures.clinicA, CLINIC); assert.equal(state.fixtures.patientA, PATIENT);
  assert.match(state.fixtures.clinicB || '', UUID); assert.notEqual(state.fixtures.clinicB, CLINIC);
  for (const label of ['owner_A', 'owner_B', 'receptionist_A']) {
    const actor = state.actors?.[label];
    assert.match(actor?.id || '', UUID); assert.match(actor.email || '', /^clinia-[a-z_]+-[a-f0-9]{12}@clinia\.invalid$/);
    assert.equal(typeof actor.password, 'string'); assert.ok(actor.password.length >= 16);
  }
  return state;
}
async function login(config, label, actor) {
  const authenticated = await syntheticMfa.authenticateAal2({ project: config.project, origin: config.origin,
    publicKey: config.anon, userId: actor.id, email: actor.email, password: actor.password });
  assert.equal(authenticated.userId, actor.id); assert.equal(authenticated.email.toLowerCase(), actor.email.toLowerCase());
  assert.equal(authenticated.aal, 'aal2');
  const token = authenticated.accessToken;
  const claims = old.jwt(token, actor.id);
  assert.equal(claims.sessionId, authenticated.sessionId);
  const signedPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(signedPayload.aal, 'aal2');
  return { id: actor.id, email: actor.email, password: actor.password, token,
    tokenSha256: sha(Buffer.from(token)), expiresAt: claims.expiresAt, sessionId: claims.sessionId, aal: 'aal2', label };
}
async function verifyAuthorityControl(config, actor, clinicId, expectedRole) {
  const active = await runtime.request(config, '/rest/v1/rpc/clinia_session_active', {
    method: 'POST', body: {}, token: actor.token,
  });
  assert.equal(active.status, 200); assert.equal(active.data, true, 'Independent control needs a live ordinary session');
  const role = await runtime.request(config, '/rest/v1/rpc/get_clinic_member_role', {
    method: 'POST', body: { check_clinic_id: clinicId }, token: actor.token,
  });
  assert.equal(role.status, 200); assert.equal(role.data, expectedRole, 'Independent control role is not established');
}
async function prepare(p, manifest) {
  assert.ok(!fs.existsSync(p.privateFile) && !fs.existsSync(p.warmPrivateFile), 'Fresh attempt required; captures are never overwritten');
  const config = runtime.readConfig(); assert.equal(config.project, PROJECT);
  const fixture = loadFixtureActors();
  fs.mkdirSync(p.directory, { recursive: true });
  const state = { project: PROJECT, attempt: p.attempt, candidateHead: p.candidateHead,
    manifestSha256: manifest.sha256, actors: {}, createdAt: new Date().toISOString() };
  savePrivate(p.privateFile, state);
  for (const label of ['owner_A', 'owner_B', 'receptionist_A']) {
    state.actors[label] = await login(config, label, fixture.actors[label]); updatePrivate(p.privateFile, state);
  }
  await verifyAuthorityControl(config, state.actors.owner_A, CLINIC, 'clinic_owner');
  await verifyAuthorityControl(config, state.actors.owner_B, fixture.fixtures.clinicB, 'clinic_owner');
  await verifyAuthorityControl(config, state.actors.receptionist_A, CLINIC, 'receptionist');
  state.authorityControlsVerified = true; updatePrivate(p.privateFile, state);
  for (const phase of REPLAYS) {
    const label = ACTOR_BY_PHASE[phase];
    const email = `clinia-origin-${p.attempt}-${phase}-${crypto.randomBytes(6).toString('hex')}@clinia.invalid`;
    const password = 'A9!' + crypto.randomBytes(36).toString('base64url');
    const request = { method: 'POST', url: runtime.origin + '/auth/v1/admin/users',
      headers: { apikey: config.service, Authorization: 'Bearer ' + config.service, 'Content-Type': 'application/json' },
      body: { email, password, email_confirm: true, user_metadata: { full_name: 'Sintético replay ' + phase } } };
    old.guardUrl(request.url, true, request.method);
    const created = await runtime.request(config, '/auth/v1/admin/users', { method: 'POST', body: request.body,
      token: config.service, privileged: true });
    assert.ok([200, 201].includes(created.status), 'New synthetic Auth actor creation failed');
    assert.equal(created.data?.email, email); assert.match(created.data?.id || '', UUID);
    state.actors[label] = { id: created.data.id, email, password }; updatePrivate(p.privateFile, state);
    const actor = await login(config, label, state.actors[label]);
    state.actors[label] = actor;
    updatePrivate(p.privateFile, state);
  }
  const report = { status: 'PREPARED', project: PROJECT, attempt: p.attempt,
    candidateHead: p.candidateHead, manifestSha256: manifest.sha256, authorityControlsVerified: true,
    actors: Object.entries(state.actors).map(([label, actor]) => ({ label, id: actor.id, jwtSha256: actor.tokenSha256, expiresAt: actor.expiresAt })) };
  assertNoProviderUrl(report); fs.mkdirSync(p.directory, { recursive: true });
  const file = path.join(p.directory, `prepare-${p.attempt}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { status: report.status, evidence: file, actors: report.actors.length };
}
function verifyState(p, manifest, state, requireFresh = false) {
  assert.equal(state.project, PROJECT); assert.equal(state.attempt, p.attempt);
  assert.equal(state.candidateHead, p.candidateHead); assert.equal(state.manifestSha256, manifest.sha256);
  assert.equal(state.authorityControlsVerified, true);
  for (const [label, actor] of Object.entries(state.actors)) {
    assert.match(actor.id || '', UUID); assert.match(actor.tokenSha256 || '', /^[a-f0-9]{64}$/);
    assert.equal(actor.aal, 'aal2');
    // Validate identity and expiry claim shape even if a replay actor's
    // original token has since expired; phase-specific validation follows.
    const claims = old.jwt(actor.token, actor.id, 'authenticated',
      requireFresh ? Math.floor(Date.now() / 1000) : 0, false, requireFresh ? 60 : 0);
    assert.equal(claims.sessionId, actor.sessionId); assert.equal(sha(Buffer.from(actor.token)), actor.tokenSha256);
    assert.equal(JSON.parse(Buffer.from(actor.token.split('.')[1], 'base64url').toString('utf8')).aal, 'aal2');
  }
}
async function warm(p, manifest) {
  assert.ok(!fs.existsSync(p.warmPrivateFile), 'Warm capture is immutable; use a new attempt');
  const state = readPrivate(p.privateFile); verifyState(p, manifest, state, true);
  assert.ok(!fs.existsSync(p.directory) || !fs.readdirSync(p.directory, { withFileTypes: true }).some(entry => entry.isFile() && entry.name.startsWith(`warm-${p.attempt}-`)),
    'Prior warm evidence exists; use a new attempt');
  const frozen = { project: PROJECT, attempt: p.attempt, candidateHead: p.candidateHead,
    manifestSha256: manifest.sha256, frozenAt: new Date().toISOString(), requests: [] };
  const jobs = [];
  for (const label of ['owner_A', 'owner_B', 'receptionist_A', ...Object.values(ACTOR_BY_PHASE)]) {
    const actor = state.actors[label];
    if (label === 'receptionist_A') jobs.push({ actor: label, request: requestFor('document', actor.token, CLINIC, FILE) });
    else for (const request of makeRequests(label, actor.token)) jobs.push({ actor: label, request });
  }
  for (const spec of MEDIA) jobs.push({ actor: 'anonymous', request: requestFor(spec.kind, null, CLINIC, spec.entityId) });
  const report = { status: 'PARTIAL', phase: 'warm', project: PROJECT, attempt: p.attempt,
    candidateHead: p.candidateHead, manifestSha256: manifest.sha256, startedAt: new Date().toISOString(), requests: [] };
  const evidence = path.join(p.directory, `warm-${p.attempt}-${Date.now()}.json`);
  fs.mkdirSync(p.directory, { recursive: true }); fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const persist = () => fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
  try {
    for (const job of jobs) {
      const expected = expectedFor(job.request, job.actor);
      const entry = { actor: job.actor, jwtSha256: wire(job.request).authorizationSha256,
        request: job.request, requestDigest: requestDigest(job.request), requestSha256: requestDigest(job.request),
        expected, status: 'PENDING' };
      frozen.requests.push(entry); persist();
      const result = await http(job.request); validateResponse(result, job.request, expected, job.actor);
      entry.status = 'VERIFIED'; entry.response = safeRequestEvidence(job.actor, job.request, result, expected);
      frozen.requests.at(-1).response = entry.response;
      report.requests.push(entry.response); persist();
    }
    frozen.status = 'WARM_VERIFIED'; frozen.completedAt = new Date().toISOString();
    verifyFrozen(frozen); savePrivate(p.warmPrivateFile, frozen);
    report.status = 'WARM_VERIFIED'; report.completedAt = frozen.completedAt;
    report.frozenRequestsSha256 = sha(fs.readFileSync(p.warmPrivateFile));
    report.frozenRequestCount = frozen.requests.length; persist();
  } catch {
    report.status = 'PARTIAL'; report.failure = 'Warm check failed; no response body or provider details retained';
    report.completedAt = new Date().toISOString(); persist(); throw Error('Warm candidate check failed');
  }
  assertNoProviderUrl(report);
  return { status: report.status, evidence, frozenRequestCount: frozen.requests.length };
}
async function replay(p, manifest) {
  const phase = p.phase, state = readPrivate(p.privateFile), frozen = verifyFrozen(readPrivate(p.warmPrivateFile));
  verifyState(p, manifest, state);
  assert.equal(frozen.attempt, p.attempt); assert.equal(frozen.candidateHead, p.candidateHead);
  assert.equal(frozen.manifestSha256, manifest.sha256);
  assert.equal(frozen.status, 'WARM_VERIFIED', 'Successful immutable warm capture required');
  const warmReceipts = fs.existsSync(p.directory) ? fs.readdirSync(p.directory).filter(name => /^warm-\d+-\d+\.json$/.test(name)) : [];
  assert.equal(warmReceipts.length, 1, 'Exactly one successful warm evidence receipt required');
  const warmReport = JSON.parse(fs.readFileSync(path.join(p.directory, warmReceipts[0]), 'utf8'));
  verifyWarmReceipt(warmReport, frozen, fs.readFileSync(p.warmPrivateFile));
  const label = ACTOR_BY_PHASE[phase], actor = state.actors[label];
  const claims = old.jwt(actor.token, actor.id, 'authenticated', Math.floor(Date.now() / 1000), phase === 'expired', 0);
  const targets = frozen.requests.filter(entry => entry.actor === label);
  assert.equal(targets.length, 4, 'Exact four successful original requests required');
  for (const item of targets) {
    assert.equal(item.status, 'VERIFIED'); assert.equal(item.response.status, 200);
    assert.equal(item.requestDigest, requestDigest(item.request));
    assert.equal(item.jwtSha256, sha(Buffer.from(actor.token)));
  }
  // Owner controls use a freshly authenticated owner session for this operator
  // phase. Only the target doctor's frozen original JWT is replayed.
  const config = runtime.readConfig();
  const owner = await login(config, 'owner_A_replay_control', state.actors.owner_A);
  const controls = makeRequests('owner_A', owner.token);
  const report = { status: 'PARTIAL', phase, project: PROJECT, attempt: p.attempt,
    candidateHead: p.candidateHead, manifestSha256: manifest.sha256, actor: label,
    actorId: actor.id, jwtSha256: sha(Buffer.from(actor.token)), sessionId: claims.sessionId,
    expiresAt: new Date(claims.expiresAt * 1000).toISOString(), warmEvidenceSha256: sha(fs.readFileSync(p.warmPrivateFile)),
    warmRequestsSha256: targets.map(item => item.requestDigest), startedAt: new Date().toISOString(), controls: [], replays: [] };
  const evidence = path.join(p.directory, `replay-${phase}-${p.attempt}-${Date.now()}.json`);
  fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const persist = () => fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
  try {
    for (const control of controls) {
      const result = await http(control); validateResponse(result, control, 'allow', 'owner_A control');
      report.controls.push(safeRequestEvidence('owner_A', control, result, 'allow')); persist();
    }
    for (const item of targets) {
      const result = await http(item.request); validateResponse(result, item.request, 'denied', label);
      const observed = safeRequestEvidence(label, item.request, result, 'denied');
      assert.equal(observed.requestSha256, item.requestSha256, 'Replay must be byte-for-byte the original frozen request');
      report.replays.push(observed); persist();
    }
    for (const control of controls) {
      const result = await http(control); validateResponse(result, control, 'allow', 'owner_A control');
      report.controls.push(safeRequestEvidence('owner_A', control, result, 'allow')); persist();
    }
    report.status = 'VERIFIED'; report.completedAt = new Date().toISOString(); persist();
  } catch {
    report.status = 'PARTIAL'; report.failure = 'Exact replay/control outcome not reproduced; only safe statuses and hashes retained';
    report.completedAt = new Date().toISOString(); persist(); throw Error('Candidate replay failed');
  }
  assertNoProviderUrl(report);
  return { status: report.status, phase, evidence, replays: report.replays.length, controls: report.controls.length };
}
async function run(args) {
  const p = plan(args), manifest = verifyCandidateFile(p);
  if (p.mode === 'prepare') return prepare(p, manifest);
  if (p.mode === 'warm') return warm(p, manifest);
  return replay(p, manifest);
}

if (require.main === module) {
  if (process.argv.length === 3 && ['--help', '-h'].includes(process.argv[2])) console.log(HELP);
  else run(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(() => {
      console.error('Candidate-bound staging prerequisites refused; no credentials, provider URLs, or response bodies emitted');
      process.exitCode = 1;
    });
}
module.exports = { PROJECT, PREVIEW, CLINIC, PATIENT, AVATAR_DOCTOR, FILE, PDF_SHA256, PNG_SHA256,
  DOCUMENT_DENIAL_SHA256, MEDIA_DENIAL_SHA256,
  REPLAYS, ACTOR_BY_PHASE, MEDIA, HELP, candidateManifest, plan, requestFor, wire, requestDigest, verifyFrozen, verifyWarmReceipt,
  validateResponse, assertNoProviderUrl, assertNoStore, verifyCandidateFile };
