'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const driver = require('../../scripts/verify-clinia-document-runtime.cjs');

const ids = Object.freeze({ clinicId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222', fileId: '33333333-3333-4333-8333-333333333333' });
const subject = '44444444-4444-4444-8444-444444444444';
const session = '55555555-5555-4555-8555-555555555555';
const now = 1800000000;
// These local parsing fixtures are not valid provider signatures or remote proof.
function token(overrides = {}) {
  const claims = { sub: subject, session_id: session, iss: driver.PROVIDER + '/auth/v1', role: 'authenticated', exp: now + 3600, ...overrides };
  return Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.synthetic_signature';
}
function response(status, bytes, headers = {}, data = null) {
  return { status, bytes, bodySha256: driver.sha(bytes), headers, data };
}
const cache = { 'cache-control': 'private, no-store, max-age=0, must-revalidate', vary: 'Authorization, Cookie',
  'content-type': 'application/octet-stream', 'x-vercel-cache': 'MISS' };

test('CLI pins staging, explicit phases, attempts, and rejects overrides', () => {
  assert.equal(driver.plan(['prepare', '1', driver.PROJECT]).phase, 'prepare');
  assert.equal(driver.plan(['probe', 'removed', '1', driver.PROJECT]).phase, 'removed');
  assert.equal(driver.plan(['principal', 'disabled', '1', driver.PROJECT]).phase, 'disabled');
  for (const args of [[], ['prepare', '1', 'production'], ['probe', 'unknown', '1', driver.PROJECT],
    ['probe', 'warm', '../2', driver.PROJECT], ['principal', 'enabled', '0', driver.PROJECT],
    ['prepare', '1', driver.PROJECT, 'https://cliniaplus.com']]) assert.throws(() => driver.plan(args));
});

test('URL authority pins exact origin, document path and privileged Auth creation', () => {
  assert.equal(driver.guardUrl(driver.PREVIEW + '/api/clinical-documents', false, 'POST').origin, driver.PREVIEW);
  driver.guardUrl(driver.PROVIDER + '/auth/v1/admin/users', true, 'POST');
  for (const [url, privileged, method] of [
    ['https://cliniaplus.com/api/clinical-documents', false, 'POST'],
    [driver.PREVIEW + '/api/clinical-documents?cache=1', false, 'POST'],
    [driver.PREVIEW + '/api/clinical-documents', true, 'POST'],
    [driver.PREVIEW + '/api/clinical-documents', false, 'GET'],
    [driver.PROVIDER + '/rest/v1/patient_files', true, 'POST'],
    [driver.PROVIDER + '/storage/v1/object/patient-files/a', true, 'GET'],
    [driver.PROVIDER + '/auth/v1/admin/users/' + subject, true, 'PUT'],
    [driver.PROVIDER + '/auth/v1/logout', true, 'POST'],
    [driver.PROVIDER + '/auth/v1/admin/users#fragment', true, 'POST'],
  ]) assert.throws(() => driver.guardUrl(url, privileged, method));
});

test('manifest requires reviewed source and observed Preview readiness', () => {
  const manifest = { project: driver.PROJECT, previewOrigin: driver.PREVIEW, candidateHead: driver.CANDIDATE,
    environment: 'preview', status: 'READY', sourceVerified: true, deploymentId: 'dpl_BkptvjQYPpGiNe9PsGqaT4C5vA1e', observedAt: '2026-10-04T16:00:00.000Z' };
  assert.equal(driver.candidateManifest(manifest).candidateHead, driver.CANDIDATE);
  driver.candidateManifest({ ...manifest, deploymentId: '8ed9JjDyMHXLhqh9Q3sYDB1wy48c' });
  for (const [key, value] of [['project', 'production'], ['previewOrigin', 'https://cliniaplus.com'],
    ['candidateHead', 'a'.repeat(40)], ['environment', 'production'], ['status', 'BUILDING'],
    ['sourceVerified', false], ['deploymentId', 'unknown'], ['observedAt', 'today']]) {
    assert.throws(() => driver.candidateManifest({ ...manifest, [key]: value }));
  }
});

test('JWT parser requires staging issuer, exact role/subject/session and real time expiry', () => {
  assert.equal(driver.jwt(token(), subject, 'authenticated', now).expiresAt, now + 3600);
  assert.equal(driver.jwt(token({ role: 'clinia_document_delivery' }), subject, 'clinia_document_delivery', now).sessionId, session);
  for (const overrides of [{ sub: ids.patientId }, { iss: 'https://production.supabase.co/auth/v1' },
    { role: 'service_role' }, { session_id: null }, { exp: now + 59 }, { exp: now - 1 }]) {
    assert.throws(() => driver.jwt(token(overrides), subject, 'authenticated', now));
  }
  assert.throws(() => driver.jwt(token(), subject, 'authenticated', now, true));
  driver.jwt(token({ exp: now - 1 }), subject, 'authenticated', now, true);
  driver.jwt(token({ exp: now + 1 }), subject, 'authenticated', now, false, 0);
});

test('request replay fixes original body bytes and bearer without Origin/cookies', () => {
  const original = driver.documentRequest(token(), ids);
  assert.equal(original.body, JSON.stringify({ clinicId: ids.clinicId, patientId: ids.patientId, fileId: ids.fileId }));
  assert.equal(original.headers.Authorization, 'Bearer ' + token());
  assert.ok(!Object.hasOwn(original.headers, 'Origin')); assert.ok(!Object.hasOwn(original.headers, 'Cookie'));
  const digest = driver.requestBinding(original);
  assert.notEqual(driver.requestBinding(driver.documentRequest(token({ exp: now + 3601 }), ids)), digest);
  assert.throws(() => driver.requestBinding({ ...original, body: original.body + ' ' }));
  assert.throws(() => driver.requestBinding({ ...original, headers: { ...original.headers, Origin: driver.PREVIEW } }));
  assert.throws(() => driver.documentRequest(token(), { ...ids, name: 'extra' }));
});

test('frozen replay rejects manifest/capture/driver drift and warmed token replacements', () => {
  const state = { project: driver.PROJECT, attempt: '1', scope: ids, actors: {} };
  const binding = { manifestSha256: 'a'.repeat(64), preparedSha256: 'b'.repeat(64), driverSha256: 'c'.repeat(64), transportSha256: 'f'.repeat(64) };
  const replay = { project: driver.PROJECT, attempt: '1', ...binding, requests: {}, requestSha256: {},
    warmEvidence: { filename: 'probe-warm-123456-abcdefgh.json'.replace('gh', '00'), sha256: 'd'.repeat(64) } };
  for (const label of [...driver.ACTORS, 'owner_A']) {
    state.actors[label] = { id: subject, token: token() };
    replay.requests[label] = driver.documentRequest(token(), ids);
    replay.requestSha256[label] = driver.requestBinding(replay.requests[label]);
  }
  driver.verifyReplay(replay, state, binding, now, 'removed');
  for (const key of Object.keys(binding)) assert.throws(() => driver.verifyReplay(replay, state, { ...binding, [key]: 'e'.repeat(64) }, now, 'removed'));
  state.actors.removed_A.token = token({ exp: now + 3601 });
  assert.throws(() => driver.verifyReplay(replay, state, binding, now, 'removed'));
});

test('authorized document evidence requires exact synthetic bytes and no-store', () => {
  driver.assertDocument(response(200, driver.PDF, cache));
  for (const value of [response(200, Buffer.from('other'), cache), response(304, driver.PDF, cache),
    response(200, driver.PDF, { ...cache, 'cache-control': 'public, max-age=3600' }),
    response(200, driver.PDF, { ...cache, 'x-vercel-cache': 'HIT' }),
    response(200, driver.PDF, { ...cache, vary: 'Cookie' })]) assert.throws(() => driver.assertDocument(value));
});

test('application denial must come from the handler, not Vercel protection or outage', () => {
  driver.assertAppDenied(response(404, driver.APP_DENIAL, cache));
  for (const value of [response(401, Buffer.from('{"protection":true}'), cache),
    response(503, driver.APP_DENIAL, cache), response(400, driver.APP_DENIAL, cache),
    response(200, driver.PDF, cache), response(404, driver.APP_DENIAL, { ...cache, 'x-vercel-cache': 'STALE' })]) {
    assert.throws(() => driver.assertAppDenied(value));
  }
});

test('provider denial excludes outages/generic 400 and rejects leaked rows or bytes', () => {
  driver.assertProviderDenied(response(403, Buffer.from('{}'), {}, { code: '42501' }));
  driver.assertProviderDenied(response(400, Buffer.from('{}'), {}, { code: 'NoSuchKey' }));
  driver.assertProviderDenied(response(200, Buffer.from('[]'), {}, []), true);
  for (const value of [response(503, Buffer.from('{}')), response(400, Buffer.from('{}'), {}, { code: 'InvalidInput' }),
    response(200, Buffer.from('[{"id":"x"}]'), {}, [{ id: 'x' }]), response(403, driver.PDF)]) {
    assert.throws(() => driver.assertProviderDenied(value, true));
  }
});

test('response evidence excludes credentials, provider body, cookies, signed URLs and query values', () => {
  const request = { url: driver.PROVIDER + '/auth/v1/token?grant_type=password', method: 'POST',
    headers: { Authorization: 'Bearer PRIVATE_TOKEN' }, body: '{"password":"PRIVATE_PASSWORD"}' };
  const data = { access_token: 'PRIVATE_TOKEN', password: 'PRIVATE_PASSWORD', signedURL: 'PRIVATE_SIGNED_URL', message: 'PRIVATE_MESSAGE', code: '42501' };
  const headers = driver.cacheMetadata(new Headers({ 'cache-control': 'no-store', 'set-cookie': 'PRIVATE_COOKIE', location: 'PRIVATE_SIGNED_URL' }));
  const safe = driver.responseEvidence('synthetic_login', request, response(200, Buffer.from(JSON.stringify(data)), headers, data));
  const serialized = JSON.stringify(safe);
  for (const secret of ['PRIVATE_TOKEN', 'PRIVATE_PASSWORD', 'PRIVATE_SIGNED_URL', 'PRIVATE_MESSAGE', 'PRIVATE_COOKIE', 'grant_type=password']) {
    assert.ok(!serialized.includes(secret));
  }
  assert.equal(safe.bodySha256.length, 64); assert.equal(safe.code, '42501');
  assert.throws(() => driver.cacheMetadata(new Headers({ vary: token() })));
});

test('Vercel protection is explicitly classified before any app authorization proof', () => {
  const request = driver.documentRequest(token(), ids);
  const data = { protection: true, access: 'private', mcp: 'private', message: 'private' };
  const protectedResponse = response(401, Buffer.from(JSON.stringify(data)), {}, data);
  assert.equal(driver.responseEvidence('removed_A', request, protectedResponse).layer, 'vercel-protection');
  assert.throws(() => driver.assertAppDenied(protectedResponse));
});

test('temporary Preview bypass is transport-only and refuses providers, production or other cookies', () => {
  const capture = { project: driver.PROJECT, previewOrigin: driver.PREVIEW,
    headerName: 'Cookie', headerValue: '_vercel_jwt=synthetic_bypass_token_12345' };
  const transport = driver.previewTransport(capture);
  const original = driver.documentRequest(token(), ids), digest = driver.requestBinding(original);
  const outbound = driver.applyPreviewTransport(original, transport);
  assert.equal(outbound.headers.Cookie, capture.headerValue);
  assert.equal(driver.requestBinding(original), digest);
  assert.equal(original.headers.Cookie, undefined);
  assert.equal(outbound.body, original.body); assert.equal(outbound.headers.Authorization, original.headers.Authorization);
  for (const url of [driver.PROVIDER + '/rest/v1/patients', 'https://cliniaplus.com/api/clinical-documents']) {
    assert.throws(() => driver.applyPreviewTransport({ ...original, url }, transport));
  }
  for (const changed of [{ ...capture, project: 'production' }, { ...capture, previewOrigin: 'https://cliniaplus.com' },
    { ...capture, headerName: 'Authorization' }, { ...capture, headerValue: 'sb-session=synthetic_token_12345' },
    { ...capture, headerValue: '__vercel_protection_bypass=synthetic_bypass_token_12345' },
    { ...capture, headerValue: capture.headerValue + '; sb-session=extra' },
    { ...capture, headerValue: capture.headerValue + '\r\nAuthorization: Bearer extra' }]) {
    assert.throws(() => driver.previewTransport(changed));
  }
  assert.throws(() => driver.requestBinding(outbound));
});

test('clinical probe routes keep writes on one immutable fresh nonexistent key', () => {
  const registered = ids.clinicId + '/' + ids.patientId + '/hosted-1-run-3.pdf';
  const routes = driver.clinicalObjectRoutes(registered, session);
  assert.deepEqual(routes.bytes, ['/storage/v1/object/authenticated/patient-files/' + registered,
    '/storage/v1/object/patient-files/' + registered]);
  assert.equal(routes.info, '/storage/v1/object/info/authenticated/patient-files/' + registered);
  assert.notEqual(routes.mutationObject, registered);
  assert.equal(routes.mutationObject, ids.clinicId + '/' + ids.patientId + '/hosted-1-run-3-principal-probe-' + session + '.pdf');
  assert.equal(routes.mutation, '/storage/v1/object/patient-files/' + routes.mutationObject);
  assert.equal(routes.unregistered, '/storage/v1/object/authenticated/patient-files/' + routes.mutationObject);
  assert.ok(Object.isFrozen(routes)); assert.ok(Object.isFrozen(routes.bytes));
  assert.throws(() => { routes.mutationObject = registered; });
  assert.throws(() => driver.clinicalObjectRoutes(registered, '../existing-document'));
  assert.throws(() => driver.clinicalObjectRoutes('arbitrary/key.pdf', session));
  assert.notEqual(driver.clinicalObjectRoutes(registered).mutationObject, driver.clinicalObjectRoutes(registered).mutationObject);
});

test('enabled principal matrix requires both aliases to return exact bytes and permits info separately', async () => {
  const routes = driver.clinicalObjectRoutes(ids.clinicId + '/' + ids.patientId + '/hosted-1-run-3.pdf', session);
  const calls = [];
  const invoke = async (route, method = 'GET') => {
    calls.push({ route, method });
    if (method === 'HEAD') return response(400, Buffer.alloc(0));
    if (route === routes.unregistered) return response(400, Buffer.from('{}'), {}, { code: 'NoSuchKey' });
    if (route === routes.info) return response(200, Buffer.from('{"size":70}'), {}, { size: driver.PDF.length });
    return response(200, driver.PDF);
  };
  await driver.verifyPrincipalReads('enabled', routes, invoke);
  assert.deepEqual(calls, [...routes.bytes.map(route => ({ route, method: 'GET' })), { route: routes.info, method: 'GET' },
    { route: routes.head, method: 'HEAD' }, { route: routes.unregistered, method: 'GET' }]);
  await assert.rejects(driver.verifyPrincipalReads('enabled', routes, async (route, method) =>
    route === routes.bytes[1] ? response(200, Buffer.from('different object')) : invoke(route, method)));
});

test('disabled principal matrix denies both byte aliases and exact-key metadata', async () => {
  const routes = driver.clinicalObjectRoutes(ids.clinicId + '/' + ids.patientId + '/hosted-1-run-3.pdf', session);
  const invoke = async (_route, method) => method === 'HEAD' ? response(400, Buffer.alloc(0))
    : response(400, Buffer.from('{}'), {}, { code: 'NoSuchKey' });
  await driver.verifyPrincipalReads('disabled', routes, invoke);
  for (const permitted of [...routes.bytes, routes.info]) {
    await assert.rejects(driver.verifyPrincipalReads('disabled', routes, async (route, method) =>
      route === permitted ? response(200, driver.PDF, {}, { size: driver.PDF.length }) : invoke(route, method)));
  }
});

test('metadata/HEAD assertions reject error bodies, successful HEAD and provider outages', () => {
  driver.assertProviderInfo(response(200, Buffer.from('{}'), {}, { size: driver.PDF.length }));
  for (const result of [response(200, Buffer.from('{}'), {}, {}), response(200, Buffer.from('{}'), {}, { code: 'NoSuchKey' }),
    response(400, Buffer.from('{}'), {}, { size: 70 }), response(200, Buffer.from('[]'), {}, [])]) {
    assert.throws(() => driver.assertProviderInfo(result));
  }
  driver.assertHeadDenied(response(400, Buffer.alloc(0)));
  driver.assertHeadDenied(response(403, Buffer.alloc(0)));
  for (const result of [response(200, Buffer.alloc(0)), response(503, Buffer.alloc(0)), response(400, Buffer.from('validation error'))]) {
    assert.throws(() => driver.assertHeadDenied(result));
  }
  driver.assertProviderDenied(response(400, Buffer.from('{}'), {}, { code: 'NoSuchBucket' }));
});

test('exact-key metadata content stays out of persisted response evidence', () => {
  const data = { id: subject, name: 'PRIVATE_OBJECT_NAME', user_metadata: { secret: 'PRIVATE_METADATA' }, size: driver.PDF.length };
  const result = response(200, Buffer.from(JSON.stringify(data)), {}, data);
  const routes = driver.clinicalObjectRoutes(ids.clinicId + '/' + ids.patientId + '/hosted-1-run-3.pdf', session);
  const evidence = driver.responseEvidence('delivery_principal', { url: driver.PROVIDER + routes.info, method: 'GET' }, result);
  const encoded = JSON.stringify(evidence);
  assert.ok(!encoded.includes('PRIVATE_OBJECT_NAME')); assert.ok(!encoded.includes('PRIVATE_METADATA'));
  assert.ok(!Object.hasOwn(evidence, 'data')); assert.equal(evidence.bodySha256, driver.sha(result.bytes));
});
