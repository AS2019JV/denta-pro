'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const q = require('../../scripts/verify-clinia-document-requalification.cjs');
const d = require('../../scripts/verify-clinia-document-runtime.cjs');
const scope = { clinicId: '11111111-1111-4111-8111-111111111111', patientId: '22222222-2222-4222-8222-222222222222', fileId: '33333333-3333-4333-8333-333333333333' };
const token = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c3ludGhldGlj';
const manifest = { project: d.PROJECT, candidateHead: q.CANDIDATE, deploymentId: q.DEPLOYMENT, deploymentOrigin: q.ORIGIN,
  previewOrigin: d.PREVIEW,
  environment: 'preview', status: 'READY', sourceVerified: true, observedAt: '2026-10-05T20:48:57.801Z',
  sourceEvidence: 'deployment-ready.jpg', sourceEvidenceSha256: 'a'.repeat(64) };
test('release proof rejects a different source, deployment or environment', () => {
  q.validateManifest(manifest);
  for (const [key, value] of [['candidateHead', d.CANDIDATE], ['deploymentId', 'dpl_other'], ['environment', 'production'],
    ['deploymentOrigin', d.PREVIEW], ['previewOrigin', q.ORIGIN], ['sourceVerified', false], ['sourceEvidence', '../capture.jpg']]) {
    assert.throws(() => q.validateManifest({ ...manifest, [key]: value }));
  }
});
test('clinical probe and protection cookie are restricted to the pinned Preview', () => {
  const request = q.documentRequest(token, scope); q.guard(request);
  for (const url of ['https://cliniaplus.com/api/clinical-documents', d.PROVIDER + '/api/clinical-documents',
    d.PREVIEW + '/api/clinical-documents', q.ORIGIN + '/api/clinical-documents?bypass=1', q.ORIGIN + '/api/other',
    q.ORIGIN + '/api/clinical-documents#token', q.ORIGIN.replace('https://', 'https://user:password@') + '/api/clinical-documents']) {
    assert.throws(() => q.guard({ ...request, url }));
  }
  assert.throws(() => q.guard({ ...request, method: 'GET' }));
  const capture = { project: d.PROJECT, previewOrigin: q.ORIGIN, headerName: 'Cookie', headerValue: '_vercel_jwt=' + 'a'.repeat(32) };
  q.transport(capture);
  for (const change of [{ previewOrigin: d.PREVIEW }, { headerName: 'Authorization' }, { headerValue: capture.headerValue + '; other=1' }])
    assert.throws(() => q.transport({ ...capture, ...change }));
});
test('request binding rejects added cookies, caller scope and serialization changes', () => {
  const request = q.documentRequest(token, scope); assert.match(q.binding(request), /^[a-f0-9]{64}$/);
  assert.throws(() => q.binding({ ...request, headers: { ...request.headers, Cookie: 'transport' } }));
  assert.throws(() => q.binding({ ...request, body: JSON.stringify(scope, null, 2) }));
  assert.throws(() => q.documentRequest(token, { ...scope, path: 'provider-path' }));
});
test('warmed proof refuses changed token, request, helper or manifest dependencies', () => {
  const state = { attempt: '2', scope, actors: {} };
  const hashes = { manifestSha256: 'a'.repeat(64), preparedSha256: 'b'.repeat(64), driverSha256: 'c'.repeat(64), helperSha256: 'd'.repeat(64), runtimeHelperSha256: 'e'.repeat(64), transportSha256: 'f'.repeat(64) };
  const replay = { project: d.PROJECT, attempt: '2', ...hashes, requests: {}, requestSha256: {}, warmEvidence: { filename: 'warm-123456.json', sha256: '0'.repeat(64) } };
  for (const label of [...d.ACTORS, 'owner_A']) {
    state.actors[label] = { token }; replay.requests[label] = q.documentRequest(token, scope); replay.requestSha256[label] = q.binding(replay.requests[label]);
  }
  q.verifyFrozen(replay, state, hashes);
  for (const key of Object.keys(hashes)) assert.throws(() => q.verifyFrozen(replay, state, { ...hashes, [key]: '1'.repeat(64) }));
  state.actors.expiry_A.token = token.replace('c3ludGhldGlj', 'bmV3dG9rZW4');
  assert.throws(() => q.verifyFrozen(replay, state, hashes));
});
test('a successful receipt for other requests cannot substitute the actual warm proof', () => {
  const hashes = { manifestSha256: 'a'.repeat(64), preparedSha256: 'b'.repeat(64), driverSha256: 'c'.repeat(64) };
  const replay = { attempt: '2', requestSha256: {} }, candidate = q.validateManifest(manifest);
  const warm = { status: 'VERIFIED', phase: 'warm', attempt: '2', candidate, ...hashes, requests: [] };
  const headers = { 'cache-control': 'private, no-store, max-age=0', 'x-vercel-cache': 'MISS' };
  for (const label of [...d.ACTORS, 'owner_A']) {
    replay.requestSha256[label] = d.sha(label);
    for (let i = 1; i <= 2; i++) warm.requests.push({ actor: label + ' warm ' + i, requestSha256: replay.requestSha256[label],
      status: 200, bodyComplete: true, bytes: d.PDF.length, bodySha256: d.sha(d.PDF), headers });
  }
  q.verifyWarm(warm, replay, hashes, candidate);
  assert.throws(() => q.verifyWarm({ ...warm, phase: 'restored' }, replay, hashes, candidate));
  assert.throws(() => q.verifyWarm({ ...warm, candidate: { ...candidate, candidateHead: d.CANDIDATE } }, replay, hashes, candidate));
  const substituted = structuredClone(warm); substituted.requests[0].requestSha256 = '9'.repeat(64);
  assert.throws(() => q.verifyWarm(substituted, replay, hashes, candidate));
  const incomplete = structuredClone(warm); incomplete.requests[0].bodyComplete = false;
  assert.throws(() => q.verifyWarm(incomplete, replay, hashes, candidate));
});
test('causal expiry qualification refuses missing, stale or revoked live-authority witnesses', () => {
  const receipt = { startedAt: '2026-10-05T22:00:30Z', completedAt: '2026-10-05T22:00:40Z' };
  const witness = { project: d.PROJECT, candidateHead: q.CANDIDATE, actorId: 'synthetic', sessionId: 'original-session', status: 'VERIFIED',
    profileActive: true, profileNotDeleted: true, doctorMembershipActive: true, authUserActive: true, sessionPresent: true,
    sqlSha256: 'a'.repeat(64), providerReceiptSha256: 'b'.repeat(64) };
  const before = { ...witness, phase: 'before', observedAt: '2026-10-05T22:00:20Z' }, after = { ...witness, phase: 'after', observedAt: '2026-10-05T22:00:50Z' };
  q.verifyExpiryAuthority(before, after, receipt, 'synthetic', 'original-session');
  for (const key of ['profileActive', 'profileNotDeleted', 'doctorMembershipActive', 'authUserActive', 'sessionPresent'])
    assert.throws(() => q.verifyExpiryAuthority(before, { ...after, [key]: false }, receipt, 'synthetic', 'original-session'));
  assert.throws(() => q.verifyExpiryAuthority({ ...before, observedAt: '2026-10-05T21:57:00Z' }, after, receipt, 'synthetic', 'original-session'));
  assert.throws(() => q.verifyExpiryAuthority(before, { ...after, sessionId: 'replacement-session' }, receipt, 'synthetic', 'original-session'));
});
test('restoration must prove the exact warmed request twice before its original expiry', () => {
  const hashes = { driverSha256: 'a'.repeat(64), preparedSha256: 'b'.repeat(64) }, candidate = q.validateManifest(manifest);
  const replay = { attempt: '2', requestSha256: { expiry_A: 'c'.repeat(64) }, warmEvidence: { filename: 'warm-123.json', sha256: 'd'.repeat(64) } };
  const receipt = { status: 'VERIFIED', phase: 'restored', attempt: '2', candidate, ...hashes, warmEvidence: replay.warmEvidence,
    originalRequestSha256: replay.requestSha256.expiry_A, completedAt: '2026-10-05T21:10:00Z', requests: [1, 2].map(i => ({
      actor: 'restored exact original ' + i, requestSha256: replay.requestSha256.expiry_A, status: 200, bodyComplete: true,
      bytes: d.PDF.length, bodySha256: d.sha(d.PDF), headers: { 'cache-control': 'private, no-store, max-age=0' } })) };
  q.verifyRestored(receipt, replay, hashes, candidate, Date.parse('2026-10-05T22:00:00Z'));
  assert.throws(() => q.verifyRestored({ ...receipt, completedAt: '2026-10-05T22:01:00Z' }, replay, hashes, candidate, Date.parse('2026-10-05T22:00:00Z')));
  const substitute = structuredClone(receipt); substitute.requests[0].requestSha256 = '9'.repeat(64);
  assert.throws(() => q.verifyRestored(substitute, replay, hashes, candidate, Date.parse('2026-10-05T22:00:00Z')));
});
