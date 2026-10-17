'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const driver = require('../../scripts/verify-clinia-origin-candidate.cjs');
const sha = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
const head = 'a'.repeat(40);
const manifest = () => ({ project: driver.PROJECT, previewOrigin: driver.PREVIEW, candidateHead: head,
  sourceCommit: head, environment: 'preview', status: 'READY', sourceVerified: true,
  deploymentId: 'dpl_0123456789abcdefghijkl', deploymentOrigin: 'https://dpl-origin-unique.vercel.app',
  observedAt: '2026-10-06T20:00:00.000Z' });

test('candidate manifest is bound to explicit source head, fixed alias, project and unique Ready Preview deployment', () => {
  assert.deepEqual(driver.candidateManifest(manifest(), head), {
    project: driver.PROJECT, candidateHead: head, deploymentId: 'dpl_0123456789abcdefghijkl',
    environment: 'preview', status: 'READY', observedAt: '2026-10-06T20:00:00.000Z',
  });
  for (const change of [
    { project: 'other-project' }, { previewOrigin: 'https://arbitrary.invalid' },
    { candidateHead: 'b'.repeat(40) }, { sourceCommit: 'b'.repeat(40) },
    { environment: 'production' }, { status: 'BUILDING' }, { sourceVerified: false },
    { deploymentOrigin: driver.PREVIEW }, { deploymentOrigin: 'http://dpl-origin-unique.vercel.app' },
    { deploymentId: '' }, { observedAt: 'not-a-date' },
  ]) assert.throws(() => driver.candidateManifest({ ...manifest(), ...change }, head));
  assert.throws(() => driver.candidateManifest(manifest(), 'not-a-commit'));
});

test('CLI plan requires an explicit candidate head and refuses arbitrary origins or extra arguments', () => {
  assert.equal(driver.plan(['prepare', '1', head]).candidateHead, head);
  assert.equal(driver.plan(['replay', 'logout', '2', head]).phase, 'logout');
  for (const args of [
    ['warm', '1'], ['warm', '1', 'not-a-commit'], ['warm', '1', head, 'https://evil.invalid'],
    ['replay', 'unknown', '1', head], ['prepare', '0', head],
  ]) assert.throws(() => driver.plan(args));
});

test('private-media and document requests have fixed handlers, scopes, methods and bounded entity IDs', () => {
  const token = 'header.payload.signature';
  const doc = driver.requestFor('document', token, driver.CLINIC, driver.FILE);
  assert.equal(doc.method, 'POST'); assert.equal(doc.path, '/api/clinical-documents');
  assert.deepEqual(JSON.parse(doc.body), { clinicId: driver.CLINIC, patientId: driver.PATIENT, fileId: driver.FILE });
  const media = driver.MEDIA.map(spec => driver.requestFor(spec.kind, token, driver.CLINIC, spec.entityId));
  assert.ok(media.every(item => item.method === 'POST' && item.path === '/api/private-media'));
  assert.equal(new Set(media.map(item => JSON.parse(item.body).kind)).size, 3);
  assert.throws(() => driver.requestFor('document', token, '11111111-1111-4111-8111-111111111111', driver.FILE));
  assert.throws(() => driver.requestFor('doctor-avatar', token, driver.CLINIC, driver.PATIENT));
  assert.throws(() => driver.requestFor('https://evil.invalid', token, driver.CLINIC, driver.PATIENT));
  assert.equal(driver.requestFor('clinic-logo', null, driver.CLINIC, driver.CLINIC).headers.Origin, driver.PREVIEW);
});

test('frozen warm requests bind original body, auth hash and exact path; changes are rejected', () => {
  const request = driver.requestFor('document', 'header.payload.signature', driver.CLINIC, driver.FILE);
  const digest = driver.requestDigest(request);
  const entry = { actor: 'doctor_removed', jwtSha256: sha(Buffer.from('header.payload.signature')),
    request, requestDigest: digest, requestSha256: digest, expected: 'allow',
    response: { status: 200, bytes: 70, bodySha256: driver.PDF_SHA256,
      responseHeaders: { 'cache-control': 'private, no-store, max-age=0', 'content-type': 'application/octet-stream', vary: 'Authorization, Cookie' } } };
  const frozen = { project: driver.PROJECT, attempt: '1', candidateHead: head, requests: [entry, entry, entry, entry] };
  assert.equal(driver.verifyFrozen(frozen), frozen);
  const changed = structuredClone(frozen); changed.requests[0].request.body = '{}';
  assert.throws(() => driver.verifyFrozen(changed));
  const withProvider = structuredClone(frozen); withProvider.requests[0].request.path = 'https://secret.supabase.co/rest/v1/patients';
  assert.throws(() => driver.verifyFrozen(withProvider));
  assert.throws(() => driver.assertNoProviderUrl({ target: 'https://secret.supabase.co' }));
});

test('public warm receipt binds the immutable private capture hash and safe response records', () => {
  const request = driver.requestFor('document', 'header.payload.signature', driver.CLINIC, driver.FILE);
  const digest = driver.requestDigest(request);
  const item = { actor: 'doctor_removed', jwtSha256: sha(Buffer.from('header.payload.signature')),
    request, requestDigest: digest, requestSha256: digest, expected: 'allow',
    response: { actor: 'doctor_removed', path: request.path, status: 200, bytes: 70, bodySha256: driver.PDF_SHA256,
      responseHeaders: { 'cache-control': 'private, no-store, max-age=0', 'content-type': 'application/octet-stream', vary: 'Authorization, Cookie' } } };
  const frozen = { project: driver.PROJECT, attempt: '1', candidateHead: head, manifestSha256: 'c'.repeat(64),
    status: 'WARM_VERIFIED', requests: [item, item, item, item] };
  const bytes = Buffer.from(JSON.stringify(frozen));
  const receipt = { project: driver.PROJECT, attempt: '1', candidateHead: head, manifestSha256: 'c'.repeat(64),
    phase: 'warm', status: 'WARM_VERIFIED', frozenRequestsSha256: sha(bytes), requests: frozen.requests.map(value => value.response) };
  assert.equal(driver.verifyWarmReceipt(receipt, frozen, bytes), receipt);
  assert.throws(() => driver.verifyWarmReceipt({ ...receipt, frozenRequestsSha256: 'd'.repeat(64) }, frozen, bytes));
  assert.throws(() => driver.verifyWarmReceipt({ ...receipt, requests: [] }, frozen, bytes));
});

test('denials require the reviewed handler body and no-store headers, so protection pages and outages fail', () => {
  const request = driver.requestFor('doctor-avatar', 'header.payload.signature', driver.CLINIC, driver.AVATAR_DOCTOR);
  const denied = { status: 404, bytes: Buffer.from('No se pudo entregar la imagen.'),
    protectionInterception: false, headers: { 'cache-control': 'private, no-store, max-age=0', 'content-type': 'text/plain', vary: 'Authorization, Cookie' } };
  assert.doesNotThrow(() => driver.validateResponse(denied, request, 'denied', 'doctor_removed'));
  assert.throws(() => driver.validateResponse({ ...denied, status: 403, headers: { ...denied.headers, 'content-type': 'text/html' } }, request, 'denied', 'doctor_removed'));
  assert.throws(() => driver.validateResponse({ ...denied, status: 503 }, request, 'denied', 'doctor_removed'));
  assert.throws(() => driver.validateResponse({ ...denied, bytes: Buffer.from('proxy denial') }, request, 'denied', 'doctor_removed'));
});
