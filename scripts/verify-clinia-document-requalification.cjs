'use strict';
// Separate release proof: never retarget or rewrite the original cfdb captures.
// Operator mutations are separate. No warmed token refresh, SQL or PHI here.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const d = require('./verify-clinia-document-runtime.cjs');
const runtime = require('./clinia-staging-runtime.cjs');
const CANDIDATE = '6a467b992d8dec8b36ca8a10a37cd37b4333a796';
const DEPLOYMENT = 'dpl_ESiZ2MV86Qd6RUJhE3x7t2sSA8DS';
const ORIGIN = 'https://v0-denta-mo81t1eay-alesuav2001-gmailcoms-projects.vercel.app';
const APP_ORIGIN = d.PREVIEW; // Explicit branch-scoped NEXT_PUBLIC_APP_URL; do not trust arbitrary Host/Origin.
const DIRECTORY = path.join(runtime.repo, 'docs/production/evidence/2026-10-05-document-requalification');
const PRIVATE = path.join(runtime.repo, 'tools/local-supabase/supabase/.temp');
const REVOKED = { removed: 'removed_A', demoted: 'demoted_A', logout: 'logout_A', ban: 'ban_A', expired: 'expiry_A' };
const CONTROLS = { suspended: ['expiry_A', 404], deleted: ['expiry_A', 404], restored: ['expiry_A', 200],
  'principal-disabled': ['owner_A', 503], 'principal-restored': ['owner_A', 200] };
function read(file) {
  assert.ok(!fs.lstatSync(file).isSymbolicLink(), 'Symlink refused');
  const bytes = fs.readFileSync(file); return { value: JSON.parse(bytes), sha256: d.sha(bytes) };
}
function validateManifest(m) {
  assert.equal(m.project, d.PROJECT); assert.equal(m.candidateHead, CANDIDATE);
  assert.equal(m.deploymentId, DEPLOYMENT); assert.equal(m.deploymentOrigin, ORIGIN);
  assert.equal(m.previewOrigin, APP_ORIGIN);
  assert.equal(m.environment, 'preview'); assert.equal(m.status, 'READY'); assert.equal(m.sourceVerified, true);
  assert.ok(Number.isFinite(Date.parse(m.observedAt))); assert.equal(m.sourceEvidence, 'deployment-ready.jpg');
  assert.match(m.sourceEvidenceSha256 || '', /^[a-f0-9]{64}$/);
  return { candidateHead: CANDIDATE, deploymentId: DEPLOYMENT, deploymentOrigin: ORIGIN, project: d.PROJECT };
}
function guard(request) {
  const url = new URL(request.url);
  assert.equal(url.origin, ORIGIN); assert.equal(url.pathname, '/api/clinical-documents');
  assert.ok(!url.username && !url.password && !url.search && !url.hash); assert.equal(request.method, 'POST');
  return url;
}
function documentRequest(token, scope) { return { ...d.documentRequest(token, scope), url: ORIGIN + '/api/clinical-documents' }; }
function binding(request) {
  guard(request); assert.deepEqual(Object.keys(request.headers).sort(), ['Authorization', 'Content-Type']);
  assert.deepEqual(request, documentRequest(request.headers.Authorization.slice(7), JSON.parse(request.body)));
  return d.sha(JSON.stringify(request));
}
function transport(capture) {
  assert.deepEqual(Object.keys(capture).sort(), ['headerName', 'headerValue', 'previewOrigin', 'project']);
  assert.equal(capture.project, d.PROJECT); assert.equal(capture.previewOrigin, ORIGIN);
  assert.equal(capture.headerName, 'Cookie');
  assert.match(capture.headerValue || '', /^_vercel_jwt=[A-Za-z0-9._~%-]{16,8192}$/);
  return { Cookie: capture.headerValue };
}
function privateFile(file) {
  assert.equal(path.dirname(file), PRIVATE); assert.equal(fs.realpathSync(PRIVATE), path.resolve(PRIVATE));
  assert.equal(spawnSync('git', ['check-ignore', '--quiet', '--no-index', path.relative(runtime.repo, file)],
    { cwd: runtime.repo, windowsHide: true }).status, 0, 'Private credentials must remain ignored');
  if (fs.existsSync(file)) assert.ok(!fs.lstatSync(file).isSymbolicLink());
  return file;
}
function freeze(file, value) { fs.writeFileSync(privateFile(file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
function verifyFrozen(replay, state, hashes) {
  assert.equal(replay.project, d.PROJECT); assert.equal(replay.attempt, state.attempt);
  for (const [key, value] of Object.entries(hashes)) assert.equal(replay[key], value, 'Frozen evidence dependency changed');
  assert.deepEqual(Object.keys(replay.requests).sort(), [...d.ACTORS, 'owner_A'].sort());
  for (const label of [...d.ACTORS, 'owner_A']) {
    assert.deepEqual(replay.requests[label], documentRequest(state.actors[label].token, state.scope));
    assert.equal(binding(replay.requests[label]), replay.requestSha256[label]);
  }
  assert.match(replay.warmEvidence.filename, /^warm-\d+\.json$/);
  assert.match(replay.warmEvidence.sha256, /^[a-f0-9]{64}$/);
  return replay;
}
function verifyWarm(warm, replay, hashes, candidate) {
  assert.equal(warm.status, 'VERIFIED'); assert.equal(warm.phase, 'warm'); assert.equal(warm.attempt, replay.attempt);
  assert.deepEqual(warm.candidate, candidate);
  for (const [key, value] of Object.entries(hashes)) assert.equal(warm[key], value);
  for (const label of [...d.ACTORS, 'owner_A']) {
    const responses = warm.requests.filter(r => r.actor === label + ' warm 1' || r.actor === label + ' warm 2');
    assert.equal(responses.length, 2);
    for (const r of responses) {
      assert.equal(r.requestSha256, replay.requestSha256[label]); assert.equal(r.status, 200);
      assert.equal(r.bodyComplete, true); assert.equal(r.bytes, d.PDF.length); assert.equal(r.bodySha256, d.sha(d.PDF));
      d.assertNoStore({ headers: r.headers });
    }
  }
}
function verifyRestored(receipt, replay, hashes, candidate, expiresAt) {
  assert.equal(receipt.status, 'VERIFIED'); assert.equal(receipt.phase, 'restored'); assert.equal(receipt.attempt, replay.attempt);
  assert.deepEqual(receipt.candidate, candidate); assert.deepEqual(receipt.warmEvidence, replay.warmEvidence);
  assert.equal(receipt.originalRequestSha256, replay.requestSha256.expiry_A);
  for (const [key, value] of Object.entries(hashes)) assert.equal(receipt[key], value);
  assert.ok(Date.parse(receipt.completedAt) < expiresAt);
  for (const label of ['restored exact original 1', 'restored exact original 2']) {
    const responses = receipt.requests.filter(r => r.actor === label); assert.equal(responses.length, 1);
    const r = responses[0]; assert.equal(r.status, 200); assert.equal(r.bodyComplete, true);
    assert.equal(r.requestSha256, replay.requestSha256.expiry_A); assert.equal(r.bodySha256, d.sha(d.PDF));
    assert.equal(r.bytes, d.PDF.length); d.assertNoStore({ headers: r.headers });
  }
}
function verifyExpiryAuthority(before, after, receipt, actor, sessionId) {
  for (const [value, phase] of [[before, 'before'], [after, 'after']]) {
    assert.equal(value.project, d.PROJECT); assert.equal(value.candidateHead, CANDIDATE); assert.equal(value.phase, phase);
    assert.equal(value.actorId, actor); assert.equal(value.sessionId, sessionId); assert.equal(value.status, 'VERIFIED');
    for (const key of ['profileActive', 'profileNotDeleted', 'doctorMembershipActive', 'authUserActive', 'sessionPresent']) assert.equal(value[key], true);
    assert.ok(Number.isFinite(Date.parse(value.observedAt))); assert.match(value.sqlSha256, /^[a-f0-9]{64}$/);
    assert.match(value.providerReceiptSha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(Date.parse(before.observedAt) <= Date.parse(receipt.startedAt));
  assert.ok(Date.parse(receipt.startedAt) - Date.parse(before.observedAt) <= 120000);
  assert.ok(Date.parse(after.observedAt) >= Date.parse(receipt.completedAt));
  assert.ok(Date.parse(after.observedAt) - Date.parse(receipt.completedAt) <= 120000);
}
async function run(args) {
  assert.equal(args.length, 3);
  const [phase, attempt, project] = args; assert.equal(project, d.PROJECT); assert.match(attempt, /^[2-9]$/);
  assert.ok(['warm', 'attacks', 'historical-regression', 'qualify-expiry', ...Object.keys(REVOKED), ...Object.keys(CONTROLS)].includes(phase));
  const manifest = read(path.join(DIRECTORY, 'candidate-manifest.json'));
  const candidate = validateManifest(manifest.value);
  assert.equal(d.sha(fs.readFileSync(path.join(DIRECTORY, manifest.value.sourceEvidence))), manifest.value.sourceEvidenceSha256);
  const access = read(privateFile(path.join(PRIVATE, 'step1-requalification-preview-access.private.json')));
  const cookie = transport(access.value);
  const hashes = { manifestSha256: manifest.sha256, transportSha256: access.sha256,
    driverSha256: d.sha(fs.readFileSync(__filename)), helperSha256: d.sha(fs.readFileSync(path.join(__dirname, 'verify-clinia-document-runtime.cjs'))),
    runtimeHelperSha256: d.sha(fs.readFileSync(path.join(__dirname, 'clinia-staging-runtime.cjs'))) };
  const file = path.join(DIRECTORY, phase + '-' + Date.now() + '.json');
  const report = { status: 'NOT VERIFIED', phase, attempt, candidate, startedAt: new Date().toISOString(), ...hashes,
    command: 'node scripts/verify-clinia-document-requalification.cjs ' + args.join(' '), checks: [], requests: [],
    limits: ['Pinned deployment hostname; observed source binding is not cryptographic runtime attestation',
      'Synthetic 70-byte PDF only; operator authority changes are recorded separately',
      'No clinical data, tokens, passwords or protection cookies emitted'] };
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const persist = () => fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  async function send(label, original, expected) {
    guard(original); assert.ok(!Object.hasOwn(original.headers, 'Cookie'));
    const startedAt = new Date().toISOString();
    const receipt = { actor: label, startedAt, requestSha256: d.sha(JSON.stringify(original)), expected,
      status: null, bodyComplete: false }; report.requests.push(receipt); persist();
    let response, bytes, result;
    try {
      response = await fetch(original.url, { method: 'POST', body: original.body, headers: { ...original.headers, ...cookie },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
      receipt.status = response.status; persist();
      const serverDate = response.headers.get('date');
      if (serverDate && Number.isFinite(Date.parse(serverDate))) receipt.serverDate = new Date(serverDate).toISOString();
      const chunks = []; let size = 0;
      if (response.body) for await (const chunk of response.body) {
        size += chunk.length; assert.ok(size <= 10 * 1024 * 1024 + 65536); chunks.push(Buffer.from(chunk));
      }
      bytes = Buffer.concat(chunks); receipt.bodyComplete = true; receipt.bytes = size; receipt.bodySha256 = d.sha(bytes);
      receipt.headers = d.cacheMetadata(response.headers);
      result = { status: response.status, bytes, bodySha256: receipt.bodySha256, headers: receipt.headers };
    } catch {
      receipt.failure = response ? 'Response consumption or safe metadata validation failed' : 'No HTTP response received';
      receipt.completedAt = new Date().toISOString(); persist(); throw Error('Incomplete request evidence');
    }
    let data; try { data = JSON.parse(bytes.toString()); } catch {}
    const protection = result.status === 401 && data && ['protection', 'access', 'mcp'].every(key => Object.hasOwn(data, key));
    receipt.completedAt = new Date().toISOString(); if (protection) receipt.layer = 'vercel-protection'; persist();
    if (phase === 'expired' && label.startsWith('expired exact original')) {
      assert.ok(receipt.serverDate, 'Provider HTTP Date required for genuine expiry proof');
      assert.ok(Date.parse(receipt.serverDate) >= Date.parse(report.originalExpiresAt) + 10000,
        'Server-observed expiry plus clock margin required');
    }
    assert.equal(result.status, expected); d.assertNoStore(result);
    if (expected === 200) d.assertDocument(result);
    else { assert.equal(result.bodySha256, d.sha(d.APP_DENIAL)); assert.equal(receipt.bytes, d.APP_DENIAL.length); }
    report.checks.push({ requirement: label, expected, actual: result.status, status: 'VERIFIED' }); persist();
  }
  async function freshOwner(state, label) {
    const actor = state.actors.owner_A, config = runtime.readConfig();
    const response = await runtime.request(config, '/auth/v1/token?grant_type=password',
      { method: 'POST', body: { email: actor.email, password: actor.password } });
    assert.equal(response.status, 200); assert.equal(response.data?.user?.id, actor.id);
    d.jwt(response.data.access_token, actor.id);
    const capture = { project: d.PROJECT, actorId: actor.id, token: response.data.access_token, createdAt: new Date().toISOString() };
    const captureFile = path.join(PRIVATE, 'step1-requalification-' + label + '-' + Date.now() + '.private.json');
    freeze(captureFile, capture); report.positiveControlCaptureSha256 = d.sha(fs.readFileSync(captureFile));
    return documentRequest(capture.token, state.scope);
  }
  try {
    if (phase === 'historical-regression') {
      const old = d.plan(['probe', 'expired', '1', project]);
      const prepared = read(privateFile(old.privateFile)), state = d.preparedState(prepared.value, '1');
      const oldManifest = read(old.manifestFile), oldAccess = read(privateFile(old.previewAccessFile)), replay = read(privateFile(old.replayFile)).value;
      d.candidateManifest(oldManifest.value);
      d.verifyReplay(replay, state, { manifestSha256: oldManifest.sha256, preparedSha256: prepared.sha256,
        driverSha256: hashes.helperSha256, transportSha256: oldAccess.sha256 }, Math.floor(Date.now() / 1000), 'expired');
      const warm = read(path.join(old.directory, replay.warmEvidence.filename));
      assert.equal(warm.sha256, replay.warmEvidence.sha256); assert.equal(warm.value.status, 'VERIFIED');
      assert.equal(warm.value.phase, 'warm'); assert.equal(warm.value.manifestSha256, oldManifest.sha256);
      assert.equal(warm.value.preparedSha256, prepared.sha256); assert.equal(warm.value.driverSha256, hashes.helperSha256);
      report.historicalBindings = { manifestSha256: oldManifest.sha256, preparedSha256: prepared.sha256,
        transportSha256: oldAccess.sha256, replaySha256: read(old.replayFile).sha256, driverSha256: hashes.helperSha256 };
      report.historicalWarmEvidence = replay.warmEvidence; report.historicalCandidate = d.CANDIDATE;
      report.historicalRequestSha256 = replay.requestSha256.expiry_A;
      report.originalTokenSha256 = d.sha(state.actors.expiry_A.token);
      report.originalExpiresAt = new Date(d.jwt(state.actors.expiry_A.token, state.actors.expiry_A.id, 'authenticated',
        Math.floor(Date.now() / 1000), true).expiresAt * 1000).toISOString();
      const expiredRequest = { ...replay.requests.expiry_A, url: ORIGIN + '/api/clinical-documents' };
      report.limits.push('Historical successful JWT/body replayed on new pinned hostname: URL changed; this is not a new-candidate warm-to-expiry transition');
      const owner = await freshOwner(state, 'historical-owner');
      await send('fresh owner before regression', owner, 200);
      for (let i = 0; i < 2; i++) await send('malformed JSON with fresh authorized owner', { ...owner, body: '{' }, 400);
      for (let i = 0; i < 2; i++) await send('original naturally expired bearer and body', expiredRequest, 404);
      d.jwt(owner.headers.Authorization.slice(7), state.actors.owner_A.id);
      await send('fresh owner after regression', owner, 200);
    } else {
      const prepared = read(privateFile(d.plan(['prepare', attempt, project]).privateFile));
      const state = d.preparedState(prepared.value, attempt); hashes.preparedSha256 = prepared.sha256;
      report.preparedSha256 = prepared.sha256;
      const replayFile = path.join(PRIVATE, 'step1-requalification-' + attempt + '.replay.private.json');
      let replay;
      if (phase === 'warm') {
        assert.ok(!fs.existsSync(replayFile), 'Warm proof cannot be overwritten');
        replay = { project, attempt, ...hashes, requests: {}, requestSha256: {} };
        for (const label of [...d.ACTORS, 'owner_A']) {
          d.jwt(state.actors[label].token, state.actors[label].id);
          replay.requests[label] = documentRequest(state.actors[label].token, state.scope);
          replay.requestSha256[label] = binding(replay.requests[label]);
          await send(label + ' warm 1', replay.requests[label], 200); await send(label + ' warm 2', replay.requests[label], 200);
        }
        const anon = documentRequest(null, state.scope); anon.headers.Origin = APP_ORIGIN;
        await send('configured-origin anonymous', anon, 404);
        d.jwt(state.actors.owner_B.token, state.actors.owner_B.id);
        await send('foreign clinic owner', documentRequest(state.actors.owner_B.token, state.scope), 404);
        report.status = 'VERIFIED'; report.completedAt = new Date().toISOString(); persist();
        replay.warmEvidence = { filename: path.basename(file), sha256: d.sha(fs.readFileSync(file)) }; freeze(replayFile, replay);
        console.log(JSON.stringify({ status: report.status, checks: report.checks.length, evidence: file })); return;
      }
      replay = verifyFrozen(read(privateFile(replayFile)).value, state, hashes);
      const warm = read(path.join(DIRECTORY, replay.warmEvidence.filename));
      assert.equal(warm.sha256, replay.warmEvidence.sha256); verifyWarm(warm.value, replay, hashes, candidate);
      report.warmEvidence = replay.warmEvidence;
      if (phase === 'attacks') {
        const owner = replay.requests.owner_A; d.jwt(state.actors.owner_A.token, state.actors.owner_A.id);
        const cases = [['foreign Origin', 403, { headers: { ...owner.headers, Origin: 'https://clinia-invalid.example' } }],
          ['malformed bearer', 401, { headers: { ...owner.headers, Authorization: 'Bearer invalid' } }],
          ['invalid UUID', 400, { body: JSON.stringify({ ...state.scope, fileId: 'invalid' }) }],
          ['caller supplied path', 400, { body: JSON.stringify({ ...state.scope, filePath: state.document.path }) }],
          ['foreign patient', 404, { body: JSON.stringify({ ...state.scope, patientId: '0b524dc4-9edd-484e-821a-635f0a9f3d69' }) }],
          ['unregistered file', 404, { body: JSON.stringify({ ...state.scope, fileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }) }],
          ['Range replay', 400, { headers: { ...owner.headers, Range: 'bytes=0-10' } }],
          ['conditional replay', 400, { headers: { ...owner.headers, 'If-None-Match': 'synthetic' } }],
          ['wrong content type', 400, { headers: { ...owner.headers, 'Content-Type': 'text/plain' } }], ['malformed JSON', 400, { body: '{' }]];
        await send('original owner before attacks', owner, 200);
        for (const [label, expected, change] of cases) await send(label, { ...owner, ...change }, expected);
        await send('original owner after attacks', owner, 200);
      } else if (phase === 'qualify-expiry') {
        const captures = fs.readdirSync(DIRECTORY).filter(n => /^expired-\d+\.json$/.test(n)).sort().reverse();
        const source = captures.map(n => ({ filename: n, ...read(path.join(DIRECTORY, n)) }))
          .find(r => r.value.attempt === attempt && r.value.driverSha256 === hashes.driverSha256 && r.value.responsesPassed === true);
        assert.ok(source, 'Complete real expiry responses required');
        assert.deepEqual(source.value.candidate, candidate); assert.deepEqual(source.value.warmEvidence, replay.warmEvidence);
        for (const [key, value] of Object.entries(hashes)) assert.equal(source.value[key], value);
        assert.equal(source.value.originalRequestSha256, replay.requestSha256.expiry_A);
        for (const label of ['expired exact original 1', 'expired exact original 2']) {
          const responses = source.value.requests.filter(r => r.actor === label); assert.equal(responses.length, 1);
          const r = responses[0]; assert.equal(r.status, 404); assert.equal(r.bodyComplete, true);
          assert.equal(r.requestSha256, replay.requestSha256.expiry_A); assert.equal(r.bodySha256, d.sha(d.APP_DENIAL));
          assert.equal(r.bytes, d.APP_DENIAL.length); d.assertNoStore({ headers: r.headers });
          assert.ok(Date.parse(r.serverDate) >= Date.parse(source.value.originalExpiresAt) + 10000);
        }
        for (const label of ['fresh independent owner before expired', 'fresh independent owner after expired']) {
          const r = source.value.requests.find(r => r.actor === label); assert.ok(r && r.status === 200 && r.bodyComplete);
          assert.equal(r.bodySha256, d.sha(d.PDF)); assert.equal(r.bytes, d.PDF.length); d.assertNoStore({ headers: r.headers });
        }
        const before = read(path.join(DIRECTORY, 'expiry-authority-before.json')), after = read(path.join(DIRECTORY, 'expiry-authority-after.json'));
        const claim = JSON.parse(Buffer.from(state.actors.expiry_A.token.split('.')[1], 'base64url'));
        verifyExpiryAuthority(before.value, after.value, source.value, state.actors.expiry_A.id, claim.session_id);
        report.expiredResponseEvidence = { filename: source.filename, sha256: source.sha256 };
        report.authorityEvidence = { beforeSha256: before.sha256, afterSha256: after.sha256 };
        report.checks.push({ requirement: 'Natural expiry has exact404 replays, positive controls and unchanged live target authority', status: 'VERIFIED' });
      } else {
        const [actor, expected] = CONTROLS[phase] || [REVOKED[phase], 404], original = replay.requests[actor];
        const now = Math.floor(Date.now() / 1000), claims = JSON.parse(Buffer.from(state.actors[actor].token.split('.')[1], 'base64url'));
        report.originalExpiresAt = new Date(claims.exp * 1000).toISOString(); report.originalRequestSha256 = binding(original);
        report.originalTokenSha256 = d.sha(state.actors[actor].token);
        if (phase === 'expired' && claims.exp + 10 > now) {
          report.pending = 'Original real JWT has not expired plus ten-second clock margin; no replay or refresh performed';
          report.status = 'NOT VERIFIED'; persist(); return;
        }
        if (phase === 'expired') {
          const restored = fs.readdirSync(DIRECTORY).filter(n => /^restored-\d+\.json$/.test(n)).map(n => ({ filename: n, ...read(path.join(DIRECTORY, n)) }))
            .find(r => r.value.status === 'VERIFIED' && r.value.originalRequestSha256 === report.originalRequestSha256
              && r.value.warmEvidence?.sha256 === replay.warmEvidence.sha256 && r.value.driverSha256 === hashes.driverSha256);
          assert.ok(restored, 'Successful original-request restoration receipt required before expiry');
          verifyRestored(restored.value, replay, hashes, candidate, claims.exp * 1000);
          report.restoredEvidence = { filename: restored.filename, sha256: restored.sha256 };
          report.limits.push('Expiry actor must remain otherwise authorized after the restoration receipt; operator pre/post SQL readback required for causal attribution');
        }
        d.jwt(state.actors[actor].token, state.actors[actor].id, 'authenticated', now, phase === 'expired');
        const available = !phase.startsWith('principal-');
        const positive = available ? await freshOwner(state, phase + '-owner') : null;
        if (positive) await send('fresh independent owner before ' + phase, positive, 200);
        for (let i = 0; i < 2; i++) await send(phase + ' exact original ' + (i + 1), original, expected);
        if (positive) { d.jwt(positive.headers.Authorization.slice(7), state.actors.owner_A.id);
          await send('fresh independent owner after ' + phase, positive, 200); }
      }
    }
    report.status = phase === 'expired' ? 'PARTIALLY VERIFIED' : 'VERIFIED';
    if (phase === 'expired') { report.responsesPassed = true;
      report.pending = 'Run qualify-expiry after independent pre/post live-authority receipts; responses alone do not certify causal expiry'; }
  } catch {
    report.status = report.requests.some(r => r.layer === 'vercel-protection') ? 'BLOCKED' : 'PARTIALLY VERIFIED';
    report.failure = 'Expected named result not reproduced; raw statuses/hashes retained, no credentials emitted'; process.exitCode = 1;
  } finally {
    // The warm receipt was frozen above; never change its bytes afterwards.
    if (!(phase === 'warm' && report.status === 'VERIFIED')) { report.completedAt = new Date().toISOString(); persist();
      console.log(JSON.stringify({ status: report.status, checks: report.checks.length, evidence: file })); }
  }
}
if (require.main === module) run(process.argv.slice(2)).catch(() => {
  console.error('Pinned staging requalification prerequisites refused; no secrets emitted'); process.exitCode = 1;
});
module.exports = { CANDIDATE, DEPLOYMENT, ORIGIN, validateManifest, guard, documentRequest, binding, transport, verifyFrozen, verifyWarm, verifyRestored, verifyExpiryAuthority };
