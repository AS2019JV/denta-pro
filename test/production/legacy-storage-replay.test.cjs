'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const replay = require('../../scripts/verify-clinia-legacy-storage-replay.cjs');
const hosted = require('../../scripts/verify-clinia-hosted-api.cjs');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const token = (id, role = 'authenticated') => ['e30', Buffer.from(JSON.stringify({ sub: id, role, iss: replay.ORIGIN + '/auth/v1', exp: 1234567890 })).toString('base64url'), 'synthetic'].join('.');
function fixture() {
  const actor = '272d63b1-38e3-4a60-89a2-dd07f031b2d2';
  const state = { filename: 'private-actors', sha256: 'a'.repeat(64), value: { project: replay.PROJECT, attempt: '1',
    fixtures: { clinicA: 'd9a47157-1d36-43df-af1d-436d561ee551', patientA: 'b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14' },
    actors: Object.fromEntries(hosted.LABELS.map((label, i) => [label, { id: label === 'doctor_A' ? actor : `actor-${i}`, token: token(label === 'doctor_A' ? actor : `actor-${i}`) }])) } };
  const principal = { filename: 'private-principal', sha256: 'b'.repeat(64), value: { project: replay.PROJECT, id: 'principal', token: token('principal', 'clinia_document_delivery') } };
  const nostore = { filename: 'private-nostore', sha256: 'c'.repeat(64), value: { bucket: 'patient-files', object: replay.OBJECTS[2].slice('patient-files/'.length) } };
  const sources = [{ filename: 'matrix-run-3.json', sha256: 'd'.repeat(64), value: { project: replay.PROJECT,
    fixtureBindingSha256: hosted.fixtureBinding(state.value), requests: [
      { actor: 'doctor_A', method: 'GET', path: '/storage/v1/object/' + replay.OBJECTS[1], status: 200 },
      { actor: 'signed_capability', method: 'GET', path: '/storage/v1/object/sign/' + replay.OBJECTS[1], status: 200 },
      { actor: 'doctor_A', method: 'GET', path: '/storage/v1/object/' + replay.OBJECTS[1], status: 400, queryPresent: true },
    ] } }];
  return { state, principal, nostore, sources, anon: 'synthetic-publishable-key' };
}
test('route guard confines GET capabilities to exact project and six objects', () => {
  assert.equal(replay.scopedUrl(replay.ORIGIN + '/storage/v1/object/' + replay.OBJECTS[0]).object, replay.OBJECTS[0]);
  for (const input of [
    'https://other.supabase.co/storage/v1/object/' + replay.OBJECTS[0],
    replay.ORIGIN + '/auth/v1/token', replay.ORIGIN + '/storage/v1/object/patient-files/other.pdf',
    replay.ORIGIN + '/storage/v1/object/' + replay.OBJECTS[0] + '?nonce=new',
    replay.ORIGIN + '/storage/v1/object/sign/' + replay.OBJECTS[0],
  ]) assert.throws(() => replay.scopedUrl(input));
});
test('inventory retains JWT, labels reconstruction, omits unavailable signed URLs and query nonces', () => {
  const input = fixture(), inventory = replay.buildInventory(input), safe = replay.publicInventory(inventory);
  const first = inventory.requests[0];
  assert.equal(first.request.headers.Authorization, 'Bearer ' + input.state.value.actors.doctor_A.token);
  assert.equal(first.metadata.credentialSha256, sha(input.state.value.actors.doctor_A.token));
  assert.deepEqual(first.metadata.provenance, ['Original actor token bound by fixture digest']);
  assert.equal(first.metadata.originalHeadersCaptured, false); assert.equal(first.metadata.fullWireProof, false);
  assert.equal(safe.gaps.length, 2); assert.equal(safe.objectCoverage.length, 6);
  assert.ok(safe.objectCoverage.every(x => x.plannedRequests >= 2));
  assert.ok(!JSON.stringify(safe).includes(input.state.value.actors.doctor_A.token));
  assert.ok(!JSON.stringify(safe).includes(input.anon));
  assert.ok(inventory.requests.every(x => !x.request.url.includes('?')));
});
test('changed historic credential binding never upgrades reconstructed evidence', () => {
  const input = fixture(); input.sources[0].value.fixtureBindingSha256 = 'different';
  const result = replay.buildInventory(input);
  assert.match(result.requests[0].metadata.provenance[0], /equality unproven/);
  input.sources[0].value.project = 'another-project'; assert.throws(() => replay.buildInventory(input));
});
test('broker replay refuses any substituted original token', () => {
  const input = fixture(); input.sources = [{ filename: 'principal-warm-disable-replay-123.json', sha256: 'e'.repeat(64), value: {
    project: replay.PROJECT, principalId: input.principal.value.id, principalTokenSha256: 'wrong',
    requests: [{ path: '/storage/v1/object/' + replay.OBJECTS[1], status: 200 }],
  } }];
  assert.throws(() => replay.buildInventory(input));
});
test('distinct historical broker credentials bind only their matching receipt routes', () => {
  const input = fixture();
  const old = { filename: 'old-principal', sha256: 'f'.repeat(64), value: { ...input.principal.value, attempt: '2' } };
  old.value.token = old.value.token.slice(0, -'synthetic'.length) + 'oldsignature';
  input.additionalPrincipals = [old];
  input.sources.push({ filename: 'principal-enabled-123-abcd1234.json', sha256: 'a'.repeat(64), value: {
    project: replay.PROJECT, originalTokenSha256: sha(old.value.token), requests: [
      { actor: 'delivery_principal', method: 'GET', path: '/storage/v1/object/' + replay.OBJECTS[1], status: 200 },
      { actor: 'owner_A', method: 'GET', path: '/storage/v1/object/' + replay.OBJECTS[1], status: 400 },
    ],
  } });
  const entries = replay.buildInventory(input).requests.filter(x => x.metadata.headerProfile === 'broker-runtime');
  assert.equal(entries.length, 1); assert.equal(entries[0].request.headers.Authorization, 'Bearer ' + old.value.token);
  assert.equal(entries[0].metadata.actor, 'delivery_principal_2');
  assert.match(entries[0].metadata.provenance[0], /bound by principal receipt digest/);
});
test('generic failures and malformed input are never denial evidence', () => {
  const bytes = text => Buffer.from(text);
  assert.equal(replay.denial(400, bytes('{"code":"NoSuchKey"}')), true);
  assert.equal(replay.denial(401, bytes('{"message":"jwt expired"}')), true);
  for (const [status, body] of [[200, '{"code":"NoSuchKey"}'], [500, '{"code":"NoSuchKey"}'],
    [400, '{"message":"Invalid parameter"}'], [403, '<html>provider protection</html>'], [404, ''], [401, '{}']])
    assert.equal(replay.denial(status, bytes(body)), false);
});
test('execution preserves request credential, never follows redirects and keeps capture gaps partial', async () => {
  const inventory = replay.buildInventory(fixture()); inventory.requests = inventory.requests.slice(0, 1);
  const report = { ...replay.publicInventory(inventory) }; let calls = 0;
  await replay.execute(inventory, report, () => {}, async (url, options) => {
    calls++; assert.equal(url, inventory.requests[0].request.url); assert.equal(options.method, 'GET');
    assert.deepEqual(options.headers, inventory.requests[0].request.headers); assert.equal(options.redirect, 'error');
    return new Response('{"code":"NoSuchKey"}', { status: 400 });
  });
  assert.equal(calls, 1); assert.equal(report.observedDenialsPassed, true); assert.equal(report.status, 'PARTIALLY VERIFIED');
  await replay.execute(inventory, report, () => {}, async () => new Response('%PDF synthetic leaked bytes', { status: 200 }));
  assert.equal(report.observedDenialsPassed, false); assert.equal(report.status, 'NOT VERIFIED');
  await replay.execute(inventory, report, () => {}, async () => { throw Error('private provider error'); });
  assert.equal(report.status, 'NOT VERIFIED'); assert.ok(!JSON.stringify(report).includes('private provider error'));
});
