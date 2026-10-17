'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const driver = require('../../scripts/verify-clinia-hosted-api.cjs');

function token(id, exp, role = 'authenticated') {
  return 'test.' + Buffer.from(JSON.stringify({ sub: id, role, exp })).toString('base64url') + '.not-a-real-signature';
}
function state() {
  const fixtures = Object.fromEntries(['clinicA', 'clinicB', 'patientA', 'patientA2', 'patientB'].map((name) => [name, crypto.randomUUID()]));
  const actors = Object.fromEntries(driver.LABELS.map((label) => {
    const id = crypto.randomUUID();
    return [label, { id, email: 'clinia-' + label.toLowerCase() + '-aabbccddeeff@clinia.invalid',
      password: 'synthetic-test-value', token: token(id, Math.floor(Date.now() / 1000) + 3600) }];
  }));
  return { project: driver.PROJECT, attempt: '1', fixtures, actors };
}

test('phase planning refuses production, ambiguous target and attempts before credentials/network', () => {
  for (const target of ['leqsrfyjvuxxdsubjjin', undefined, 'production', driver.PROJECT + ' ', 'https://' + driver.PROJECT + '.supabase.co']) {
    assert.throws(() => driver.plan('matrix', '1', target));
  }
  for (const phase of ['apply', 'cleanup', undefined]) assert.throws(() => driver.plan(phase, '1', driver.PROJECT));
  for (const attempt of ['0', '10', '../1', undefined]) assert.throws(() => driver.plan('matrix', attempt, driver.PROJECT));
  assert.match(driver.plan('matrix', '1', driver.PROJECT).report, /attempt-1[\\/]matrix\.json$/);
  assert.match(driver.plan('matrix', '1', driver.PROJECT, '2').report, /attempt-1[\\/]matrix-run-2\.json$/);
  assert.equal(driver.plan('matrix', '1', driver.PROJECT, '2').privateFile, driver.plan('matrix', '1', driver.PROJECT).privateFile);
  for (const run of ['0', '10', '../2', '02', 2]) assert.throws(() => driver.plan('matrix', '1', driver.PROJECT, run));
  assert.throws(() => driver.plan('prepare-actors', '1', driver.PROJECT, '2'));
});

test('provider transport refuses origin escape and privileged REST/Storage object probes', () => {
  const origin = 'https://' + driver.PROJECT + '.supabase.co';
  for (const url of ['https://leqsrfyjvuxxdsubjjin.supabase.co/rest/v1/patients', 'http://' + driver.PROJECT + '.supabase.co/rest/v1/patients',
    'https://example.com/auth/v1/token', origin + '/functions/v1/test', origin + '/rest/v1/../patients', origin + '/rest/v1/patients#fragment',
    'https://user:secret@' + driver.PROJECT + '.supabase.co/rest/v1/patients']) assert.throws(() => driver.providerUrl(url));
  assert.throws(() => driver.providerUrl(origin + '/rest/v1/patients', true));
  assert.throws(() => driver.providerUrl(origin + '/storage/v1/object/patient-files/fake.pdf', true));
  assert.equal(driver.providerUrl(origin + '/auth/v1/admin/users', true).origin, origin);
  assert.equal(driver.providerUrl(origin + '/storage/v1/bucket', true).pathname, '/storage/v1/bucket');
});

test('authorization proof distinguishes actual denials from transport failure, deadlock and duplicate collision', () => {
  for (const error of [{ code: '42501' }, { status: 403 }, { status: 404 }, { status: 400, statusCode: '403' }]) {
    assert.doesNotThrow(() => driver.denied({ error, data: null }));
  }
  for (const error of [{ code: '40P01' }, { code: '23505', status: 409 }, { status: 500, code: '42501' }, { message: 'fetch failed' },
    { status: 400, message: 'Malformed request' }, { code: '22023', status: 400 }]) assert.throws(() => driver.denied({ error, data: null }));
  assert.throws(() => driver.denied({ error: { code: '42501' }, data: [{ id: 'disclosed' }] }));
  assert.throws(() => driver.denied({ error: null, data: [] }));
});

test('forbidden demographics keys require SQLSTATE22023 separately from authorization evidence', () => {
  assert.doesNotThrow(() => driver.invalidRequest({ data: null, error: { code: '22023' }, status: 400 }));
  for (const result of [{ data: null, error: { code: '42501' }, status: 403 }, { data: null, error: { code: '22023' }, status: 500 },
    { data: null, error: { code: '22023', status: 500 } }, { data: {}, error: { code: '22023' }, status: 400 },
    { data: null, error: null, status: 400 }]) assert.throws(() => driver.invalidRequest(result));
});

test('matrix retries isolate object paths and appointment ranges while preserving owned actors', () => {
  const s = state(), first = driver.mediaSpecs(s, '1'), second = driver.mediaSpecs(s, '2');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].bucket, second[i].bucket); assert.equal(first[i].writer, second[i].writer);
    assert.notEqual(first[i].object, second[i].object); assert.match(second[i].object, /hosted-1-run-2\./);
    assert.deepEqual(first[i].bytes, second[i].bytes);
  }
  assert.equal(driver.matrixStart('1', '2') - driver.matrixStart('1', '1'), 7 * 86400000);
  assert.ok(driver.matrixStart('2', '1') > driver.matrixStart('1', '9') + 7 * 86400000);
  assert.throws(() => driver.matrixStart('1', '02'));
  s.verifiedMatrix = { runNumber: '2' }; assert.deepEqual(driver.mediaSpecs(s).map((m) => m.object), second.map((m) => m.object));
});

test('proof phases accept only fixed owned complete matrix evidence bound to source, actors and original JWTs', () => {
  const s = state(), driverSha256 = 'a'.repeat(64), digest = (v) => crypto.createHash('sha256').update(v).digest('hex');
  s.prescriptionId = crypto.randomUUID();
  const report = { status: 'VERIFIED', phase: 'matrix', project: driver.PROJECT, attempt: '1', runNumber: '2', driverSha256,
    fixtureBindingSha256: driver.fixtureBinding(s), completedAt: '2026-10-03T15:00:00Z',
    checks: Array.from({ length: 13 }, (_, i) => ({ name: 'proof-' + i, status: 'VERIFIED' })), requests: [{ status: 200, code: null }] };
  let bytes = Buffer.from(JSON.stringify(report));
  s.verifiedMatrix = { filename: 'matrix-run-2.json', runNumber: '2', driverSha256, fixtureBindingSha256: report.fixtureBindingSha256,
    fileSha256: digest(bytes), prescriptionId: s.prescriptionId };
  const reader = (filename) => { assert.match(filename, /owned[\\/]matrix-run-2\.json$/); return bytes; };
  assert.deepEqual(driver.verifiedMatrix(s, 'owned', driverSha256, reader), report);
  const noPointer = structuredClone(s); delete noPointer.verifiedMatrix;
  assert.throws(() => driver.verifiedMatrix(noPointer, 'owned', driverSha256, reader));
  for (const key of ['filename', 'driverSha256', 'fixtureBindingSha256', 'fileSha256', 'prescriptionId']) {
    const changed = structuredClone(s); changed.verifiedMatrix[key] = key === 'filename' ? '../matrix.json' : 'b'.repeat(64);
    assert.throws(() => driver.verifiedMatrix(changed, 'owned', driverSha256, reader));
  }
  const changedActor = structuredClone(s); changedActor.actors.doctor_A.token += 'changed';
  assert.throws(() => driver.verifiedMatrix(changedActor, 'owned', driverSha256, reader));
  for (const corrupt of [{ ...report, status: 'PARTIAL' }, { ...report, project: 'production' }, { ...report, runNumber: '1' },
    { ...report, checks: report.checks.slice(1) }, { ...report, checks: [...report.checks, { status: 'FAILED' }] },
    { ...report, requests: [{ status: null, code: 'transport_failure' }] }, { ...report, requests: [{ status: 500, code: '40P01' }] },
    { ...report, completedAt: null }, { ...report, failure: 'failed' }]) {
    bytes = Buffer.from(JSON.stringify(corrupt)); s.verifiedMatrix.fileSha256 = digest(bytes);
    assert.throws(() => driver.verifiedMatrix(s, 'owned', driverSha256, reader));
  }
});

test('empty RLS/list results prove no disclosure while returned records and provider failures fail', () => {
  assert.doesNotThrow(() => driver.emptyOrDenied({ data: [], error: null }));
  assert.doesNotThrow(() => driver.emptyOrDenied({ data: null, error: { code: '42501' } }));
  assert.throws(() => driver.emptyOrDenied({ data: [{ id: 'foreign' }], error: null }));
  assert.throws(() => driver.emptyOrDenied({ data: null, error: { status: 500 } }));
});

test('hosted Storage opaque NoSuchKey denial requires its actual provider response and no bytes', () => {
  const { StorageApiError } = require('@supabase/storage-js');
  const denied = { data: null, error: new StorageApiError('Opaque object', 400, '400') };
  const response = { status:400, code:'NoSuchKey', method:'GET', path:'/storage/v1/object/patient-files/owned-synthetic' };
  assert.doesNotThrow(() => driver.storageDenied(denied,response));
  for (const changed of [{...response,code:'InvalidRequest'}, {...response,status:500}, {...response,path:'/rest/v1/patients'}])
    assert.throws(() => driver.storageDenied(denied,changed));
  assert.throws(() => driver.storageDenied({...denied,data:Buffer.from('leaked')},response));
  assert.throws(() => driver.storageDenied({data:null,error:null},response));
});

test('original-token guard rejects expiry and wrong actor/role rather than confusing them with revocation', () => {
  const id = crypto.randomUUID();
  assert.equal(driver.jwtUnexpired(token(id, 2000), id, 1000), 2000);
  assert.throws(() => driver.jwtUnexpired(token(id, 1060), id, 1000));
  assert.throws(() => driver.jwtUnexpired(token(id, 999), id, 1000));
  assert.throws(() => driver.jwtUnexpired(token(id, 2000, 'service_role'), id, 1000));
  assert.throws(() => driver.jwtUnexpired(token(crypto.randomUUID(), 2000), id, 1000));
});

test('fixture generation binds only synthetic UUIDs and contains no credentials or managed-schema mutations', () => {
  const s = state(); assert.equal(driver.ownedState(s, '1'), s);
  const sql = driver.fixtureSql(s);
  for (const actor of Object.values(s.actors)) { assert.ok(sql.includes(actor.id)); assert.ok(!sql.includes(actor.token)); assert.ok(!sql.includes(actor.password)); }
  assert.match(sql, /email LIKE 'clinia-%@clinia\.invalid'/);
  assert.match(sql, /clinic_id IS NULL/); assert.match(sql, /Exact new synthetic Auth actors/);
  assert.ok(!/\b(?:GRANT|CREATE\s+(?:FUNCTION|TABLE)|INSERT\s+INTO\s+(?:auth|storage)\.)/i.test(sql));
  const injected = structuredClone(s); injected.fixtures.clinicA = "x'; DELETE FROM public.patients; --";
  assert.throws(() => driver.fixtureSql(injected));
  const ordinary = structuredClone(s); ordinary.actors.doctor_A.email = 'real@example.com';
  assert.throws(() => driver.ownedState(ordinary, '1'));
});

test('membership phases stay scoped and Auth revocation has a dedicated actor', () => {
  const s = state(); assert.notEqual(s.actors.auth_revoked_A.id, s.actors.doctor_A.id);
  for (const mode of ['revoke', 'demote', 'restore']) {
    const sql = driver.membershipSql(s, mode);
    assert.match(sql, new RegExp("WHERE user_id='" + s.actors.doctor_A.id + "' AND clinic_id='" + s.fixtures.clinicA + "'"));
    assert.ok(!sql.includes(s.actors.auth_revoked_A.id)); assert.ok(!/DELETE|TRUNCATE|GRANT/.test(sql));
  }
  assert.throws(() => driver.membershipSql(s, 'purge'));
  assert.deepEqual(driver.mediaSpecs(s).map((m) => m.bucket).sort(), ['clinic-branding', 'doctor-avatars', 'patient-avatars', 'patient-files']);
});
