'use strict';
// Exact hosted staging only. API mutations are explicit CLI phases; SQL is only
// generated for the operator's separately authorized MCP fixture application.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const runtime = require('./clinia-staging-runtime.cjs');
const PROJECT = 'phihonofwyerpfgqfekt';
const ORIGIN = 'https://' + PROJECT + '.supabase.co';
const PHASES = ['prepare-actors', 'matrix', 'prove-revoked', 'prove-demoted', 'prove-auth-revoked'];
const LABELS = ['owner_A', 'doctor_A', 'receptionist_A', 'owner_B', 'removed_A', 'auth_revoked_A'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const PDF = Buffer.from('%PDF-1.4\nClinia synthetic staging transport, no patient document\n%%EOF');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=', 'base64');

function plan(phase, attempt, target, runNumber = '1') {
  assert.equal(target, PROJECT, 'Exact authorized staging project argument required');
  assert.ok(PHASES.includes(phase), 'Unknown explicit staging phase');
  assert.match(attempt || '', /^[1-9]$/, 'Fresh attempt 1..9 required');
  assert.match(runNumber, /^[1-9]$/, 'Run 1..9 required');
  if (phase === 'prepare-actors') assert.equal(runNumber, '1', 'Actor preparation has one run per attempt');
  const directory = path.join(runtime.repo, 'docs/production/evidence/2026-10-03-hosted-api', 'attempt-' + attempt);
  const suffix = runNumber === '1' ? '' : '-run-' + runNumber;
  return { phase, attempt, runNumber, directory, report: path.join(directory, phase + suffix + '.json'),
    privateFile: path.join(runtime.repo, 'tools/local-supabase/supabase/.temp', PROJECT + '-hosted-actors-' + attempt + '.private.json') };
}
function providerUrl(input, privileged = false) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(url.origin, ORIGIN, 'Non-staging origin refused');
  assert.ok(!url.username && !url.password && !url.hash, 'Provider URL credentials/fragments refused');
  assert.ok(['/auth/v1/', '/rest/v1/', '/storage/v1/'].some((prefix) => url.pathname.startsWith(prefix)), 'Provider route required');
  if (privileged) assert.ok(url.pathname.startsWith('/auth/v1/admin/') || url.pathname === '/auth/v1/logout' || url.pathname === '/storage/v1/bucket', 'Privileged client route refused');
  return url;
}
function jwtUnexpired(token, expectedId, nowSeconds = Math.floor(Date.now() / 1000)) {
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { throw Error('Original ordinary JWT required'); }
  assert.equal(claims.sub, expectedId, 'Unexpected actor JWT subject');
  assert.equal(claims.role, 'authenticated', 'Ordinary authenticated JWT required');
  assert.ok(Number.isFinite(claims.exp) && claims.exp > nowSeconds + 60, 'Original JWT expired or near expiry; new evidence run required');
  return claims.exp;
}
function denied(result) {
  assert.ok(result && result.error, 'Expected denied operation');
  const error = result.error, status = Number(error.status || error.statusCode || 0);
  assert.ok(!status || status < 500, 'Provider failure is not authorization proof');
  assert.ok(error.code === '42501' || ['PGRST301', 'PGRST302', '28000'].includes(error.code)
    || [401, 403, 404].includes(status)
    || status === 400 && (String(error.statusCode) === '403' || /row.level security|permission|unauthoriz|not found/i.test(error.message || '')),
  'Unexpected denial cause');
  assert.ok(result.data == null, 'Denied operation returned data');
}
function invalidRequest(result) {
  assert.equal(result?.error?.code, '22023', 'Expected exact invalid-input SQLSTATE');
  assert.ok(result.data == null, 'Invalid request returned data');
  assert.ok(!result.status || result.status === 400, 'Invalid request must be HTTP400');
  assert.ok(!result.error.status || result.error.status === 400, 'Provider failure is not validation proof');
}
function emptyOrDenied(result) {
  if (result.error) return denied(result);
  assert.deepEqual(result.data, [], 'Unauthorized list/read disclosed rows');
}
function storageDenied(result, providerResponse) {
  // The hosted Storage service conceals an existing unauthorized object as
  // HTTP400/NoSuchKey. storage-js discards body.code; bind the assertion to the
  // actual response recorded by our fetch adapter, never to a generic 400.
  if (providerResponse?.status === 400 && providerResponse.code === 'NoSuchKey'
    && /^\/storage\/v1\/object\//.test(providerResponse.path || '')
    && ['GET','POST'].includes(providerResponse.method)) {
    assert.ok(result?.error, 'Opaque denial must remain an SDK error');
    assert.equal(result.data, null, 'Opaque denial returned object data');
    return;
  }
  denied(result);
}
function successful(result) { assert.equal(result.error, null, 'Expected successful provider operation'); return result.data; }
function ownedState(state, attempt) {
  assert.equal(state.project, PROJECT); assert.equal(state.attempt, attempt);
  for (const value of Object.values(state.fixtures)) assert.match(value, UUID, 'Synthetic fixture UUID required');
  for (const label of LABELS) {
    const actor = state.actors[label]; assert.match(actor?.id || '', UUID);
    assert.match(actor.email, new RegExp('^clinia-' + label.toLowerCase() + '-[a-f0-9]{12}@clinia\\.invalid$'));
    jwtUnexpired(actor.token, actor.id);
  }
  return state;
}
function mediaSpecs(state, runNumber = state.verifiedMatrix?.runNumber || '1') {
  assert.match(runNumber, /^[1-9]$/);
  const f = state.fixtures, a = state.actors, stem = 'hosted-' + state.attempt + (runNumber === '1' ? '' : '-run-' + runNumber);
  return [
    { bucket: 'patient-files', object: f.clinicA + '/' + f.patientA + '/' + stem + '.pdf', writer: 'doctor_A', bytes: PDF, mime: 'application/pdf', clinical: true },
    { bucket: 'clinic-branding', object: f.clinicA + '/' + stem + '.png', writer: 'owner_A', bytes: PNG, mime: 'image/png' },
    { bucket: 'doctor-avatars', object: a.doctor_A.id + '/' + stem + '.png', writer: 'doctor_A', bytes: PNG, mime: 'image/png' },
    { bucket: 'patient-avatars', object: f.clinicA + '/' + f.patientA + '/' + stem + '.png', writer: 'receptionist_A', bytes: PNG, mime: 'image/png' },
  ];
}
function fixtureBinding(state) {
  return sha(JSON.stringify({ project: state.project, attempt: state.attempt, fixtures: state.fixtures,
    actors: LABELS.map((label) => ({ label, id: state.actors[label].id, tokenSha256: sha(state.actors[label].token) })) }));
}
function matrixStart(attempt, runNumber) {
  assert.match(attempt, /^[1-9]$/); assert.match(runNumber, /^[1-9]$/);
  return Date.parse('2041-10-01T00:00:00Z') + ((Number(attempt) - 1) * 90 + (Number(runNumber) - 1) * 7) * 86400000;
}
function verifiedMatrix(state, directory, driverSha256, readFile = fs.readFileSync) {
  const pointer = state.verifiedMatrix;
  assert.ok(pointer, 'Full verified matrix pointer required; failed matrix is not accepted');
  assert.match(pointer.runNumber || '', /^[1-9]$/);
  const basename = pointer.runNumber === '1' ? 'matrix.json' : 'matrix-run-' + pointer.runNumber + '.json';
  assert.equal(pointer.filename, basename, 'Fixed owned matrix evidence file required');
  assert.equal(pointer.driverSha256, driverSha256, 'Verified matrix driver source has changed');
  assert.equal(pointer.fixtureBindingSha256, fixtureBinding(state), 'Verified actors, original JWTs and fixtures changed');
  assert.match(pointer.fileSha256 || '', /^[a-f0-9]{64}$/);
  const bytes = readFile(path.join(directory, basename)), report = JSON.parse(bytes);
  assert.equal(sha(bytes), pointer.fileSha256, 'Verified matrix evidence changed');
  assert.equal(report.status, 'VERIFIED'); assert.equal(report.phase, 'matrix'); assert.equal(report.project, PROJECT);
  assert.equal(report.attempt, state.attempt); assert.equal(report.runNumber, pointer.runNumber);
  assert.equal(report.driverSha256, driverSha256); assert.equal(report.fixtureBindingSha256, pointer.fixtureBindingSha256);
  assert.ok(report.completedAt && !report.failure);
  assert.ok(report.checks.length >= 13 && report.checks.every((check) => check.status === 'VERIFIED'), 'Complete matrix checks required');
  assert.ok(report.requests.length && report.requests.every((request) => Number.isInteger(request.status) && request.status >= 200 && request.status < 500 && request.code !== '40P01'), 'No provider failure/deadlock in verified matrix');
  assert.match(pointer.prescriptionId || '', UUID);
  assert.equal(state.prescriptionId, pointer.prescriptionId, 'Verified prescription identity changed');
  return report;
}
function fixtureSql(state) {
  const f = state.fixtures, a = state.actors;
  for (const value of Object.values(f)) assert.match(value, UUID);
  for (const label of LABELS) assert.match(a[label].id, UUID);
  const ids = LABELS.map((label) => "'" + a[label].id + "'").join(',');
  const members = [['owner_A', f.clinicA, 'clinic_owner', 'active'], ['doctor_A', f.clinicA, 'doctor', 'active'],
    ['receptionist_A', f.clinicA, 'receptionist', 'active'], ['owner_B', f.clinicB, 'clinic_owner', 'active'],
    ['removed_A', f.clinicA, 'doctor', 'removed'], ['auth_revoked_A', f.clinicA, 'doctor', 'active']];
  return `-- Exact ${PROJECT} synthetic fixture. Operator applies through authorized MCP only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $fixture$ BEGIN
  IF (SELECT count(*) FROM auth.users WHERE id IN (${ids}) AND email LIKE 'clinia-%@clinia.invalid' AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND is_anonymous IS NOT TRUE)<>6
    OR (SELECT count(*) FROM public.profiles WHERE id IN (${ids}) AND clinic_id IS NULL)<>6
    OR EXISTS(SELECT 1 FROM public.clinic_members WHERE user_id IN (${ids}))
    OR EXISTS(SELECT 1 FROM public.clinics WHERE id IN ('${f.clinicA}','${f.clinicB}'))
    OR EXISTS(SELECT 1 FROM public.patients WHERE id IN ('${f.patientA}','${f.patientA2}','${f.patientB}'))
    OR to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR has_column_privilege('authenticated','public.appointments','start_time','INSERT')
  THEN RAISE EXCEPTION 'Exact new synthetic Auth actors and reviewed staging chain required'; END IF;
END $fixture$;
INSERT INTO public.clinics(id,name,address,phone,owner_id,bypass_subscription) VALUES
  ('${f.clinicA}','Clínica staging sintética A','Sin clínica real','000','${a.owner_A.id}',true),
  ('${f.clinicB}','Clínica staging sintética B','Sin clínica real','000','${a.owner_B.id}',true);
${members.map(([label, clinic, role]) => `UPDATE public.profiles SET clinic_id='${clinic}',role='${role}',status='active',full_name='Sintético ${label}' WHERE id='${a[label].id}';`).join('\n')}
INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES
  ${members.map(([label, clinic, role, status]) => `('${a[label].id}','${clinic}','${role}','${status}')`).join(',\n  ')};
INSERT INTO public.patients(id,clinic_id,first_name,last_name,clinical_notes,account_balance) VALUES
  ('${f.patientA}','${f.clinicA}','Inventado','Staging A','Nota clínica sintética sin uso clínico',0),
  ('${f.patientA2}','${f.clinicA}','Segundo inventado','Staging A','Segunda nota sintética',0),
  ('${f.patientB}','${f.clinicB}','Inventado','Staging B','Nota ajena sintética',0);
COMMIT;
`;
}
function membershipSql(state, mode) {
  assert.ok(['revoke', 'demote', 'restore'].includes(mode));
  const id = state.actors.doctor_A.id, clinic = state.fixtures.clinicA;
  assert.match(id, UUID); assert.match(clinic, UUID);
  const values = { revoke: "status='removed'", demote: "role='receptionist',status='active'", restore: "role='doctor',status='active'" };
  return `-- Only the owned synthetic actor in ${PROJECT}; never refresh its original JWT.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $owned$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='${id}' AND email LIKE 'clinia-doctor_a-%@clinia.invalid')
  THEN RAISE EXCEPTION 'Owned synthetic doctor required'; END IF; END $owned$;
UPDATE public.clinic_members SET ${values[mode]} WHERE user_id='${id}' AND clinic_id='${clinic}';
COMMIT;
`;
}

async function run(phase, attempt, target, runNumber = '1') {
  const p = plan(phase, attempt, target, runNumber), config = runtime.readConfig();
  assert.equal(config.project, PROJECT); assert.equal(config.origin, ORIGIN);
  assert.ok(!fs.existsSync(p.report), 'Fresh phase evidence required; no overwrites');
  if (phase === 'prepare-actors') assert.ok(!fs.existsSync(p.privateFile), 'Fresh private actor attempt required');
  else assert.ok(fs.existsSync(p.privateFile), 'Prepared original actors required');
  let state = phase === 'prepare-actors' ? { project: PROJECT, attempt, fixtures: Object.fromEntries(['clinicA', 'clinicB', 'patientA', 'patientA2', 'patientB'].map((name) => [name, crypto.randomUUID()])), actors: {} }
    : ownedState(JSON.parse(fs.readFileSync(p.privateFile)), attempt);
  fs.mkdirSync(p.directory, { recursive: true });
  const report = { status: 'PARTIAL', phase, project: PROJECT, attempt, runNumber, startedAt: new Date().toISOString(),
    driverSha256: sha(fs.readFileSync(__filename)), requests: [], checks: [],
    limits: ['Real hosted Auth/PostgREST/Storage API proof; not browser or Next server-action execution',
      'Only owned synthetic fixtures; no production deployment or clinical approval',
      'Signed URLs remain bearer capabilities until expiry; revocation proof concerns new authorized requests'] };
  const persist = () => fs.writeFileSync(p.report, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(p.report, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const savePrivate = () => {
    fs.mkdirSync(path.dirname(p.privateFile), { recursive: true });
    const temporary = p.privateFile + '.new';
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, p.privateFile);
  };
  const matrixRunNumber = phase === 'matrix' ? runNumber : state.verifiedMatrix?.runNumber || '1';
  const matrixMedia = () => mediaSpecs(state, matrixRunNumber);
  if (phase !== 'prepare-actors') report.fixtureBindingSha256 = fixtureBinding(state);
  const clients = {};
  async function safeFetch(input, options = {}, actor, privileged = false) {
    const url = providerUrl(input, privileged), method = options.method || 'GET';
    if (privileged && url.pathname === '/storage/v1/bucket') assert.equal(method, 'GET', 'Admin bucket mutation not part of this driver');
    let response;
    try { response = await fetch(input, { ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }); }
    catch { report.requests.push({ actor, method, path: url.pathname, status: null, code: 'transport_failure' }); throw Error('Provider transport failed'); }
    let code = null;
    try { const body = await response.clone().json(); code = body?.code || body?.statusCode || null; } catch {}
    report.requests.push({ actor, method, path: url.pathname, status: response.status, code: typeof code === 'string' || typeof code === 'number' ? code : null });
    return response;
  }
  const makeClient = (label, token, privileged = false) => createClient(ORIGIN, privileged ? config.service : config.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: 'Bearer ' + token } : {}, fetch: (input, options) => safeFetch(input, options, label, privileged) },
  });
  const admin = makeClient('synthetic_auth_admin', undefined, true);
  const ordinary = (label) => clients[label] ||= makeClient(label, label === 'anonymous' ? undefined : state.actors[label].token);
  const rpc = (label, name, data) => ordinary(label).rpc(name, data);
  async function check(name, expected, fn) {
    try { const detail = await fn(); report.checks.push({ name, expected, status: 'VERIFIED', detail: detail || null }); persist(); }
    catch { report.checks.push({ name, expected, status: 'FAILED' }); persist(); throw Error('Named verification failed'); }
  }
  async function login(label) {
    const actor = state.actors[label], c = makeClient(label + '_login');
    const session = successful(await c.auth.signInWithPassword({ email: actor.email, password: actor.password }));
    assert.equal(session.user?.id, actor.id); assert.ok(session.session?.access_token);
    jwtUnexpired(session.session.access_token, actor.id); return session.session.access_token;
  }
  const f = state.fixtures;
  let appointmentSlot = phase === 'prove-revoked' ? 40 : phase === 'prove-demoted' ? 50 : phase === 'prove-auth-revoked' ? 60 : 0;
  const appointment = (doctorId = state.actors.doctor_A?.id) => {
    const start = matrixStart(attempt, matrixRunNumber) + appointmentSlot++ * 3600000;
    return { patient_id: f.patientA, doctor_id: doctorId, type: 'Staging sintético sin uso clínico', status: 'scheduled', start_time: new Date(start).toISOString(), end_time: new Date(start + 1800000).toISOString() };
  };
  const saveAppointment = (label, data) => rpc(label, 'save_clinic_appointment', { p_clinic_id: f.clinicA, p_appointment_id: null, p_data: data });
  const rx = (label, id = crypto.randomUUID()) => ({ id, clinic_id: f.clinicA, patient_id: f.patientA, doctor_id: state.actors[label].id,
    data: { medications: [{ name: 'Prueba sintética', dosage: 'Sin uso clínico', duration: '1 día' }], indications: 'Prueba de autorización, no receta clínica' } });
  const demographics = (label) => rpc(label, 'get_patient_demographics', { p_clinic_id: f.clinicA, p_patient_id: f.patientA, p_limit: 10 });
  const clinical = (label) => rpc(label, 'get_patients_with_stats', { p_clinic_id: f.clinicA, p_patient_id: f.patientA });
  const fileBytes = async (result, expected) => { const blob = successful(result); assert.equal(sha(Buffer.from(await blob.arrayBuffer())), sha(expected)); };
  const denyList = async (c, media) => emptyOrDenied(await c.storage.from(media.bucket).list(path.posix.dirname(media.object), { limit: 100, offset: 0 }));
  const forbiddenObject = (media, label) => media.object.replace(/(\.[^.]+)$/, '-' + phase + '-' + label.toLowerCase() + '$1');
  const storageDenial = result => storageDenied(result, report.requests.at(-1));
  async function denyMedia(label, media) {
    const c = ordinary(label), storage = c.storage.from(media.bucket);
    storageDenial(await storage.download(media.object)); storageDenial(await storage.createSignedUrl(media.object, 60));
    await denyList(c, media);
    denied(await storage.upload(forbiddenObject(media, label), media.bytes, { contentType: media.mime, upsert: false, cacheControl: '0' }));
  }
  async function clinicalDenials(label, allMedia = false) {
    denied(await clinical(label));
    emptyOrDenied(await ordinary(label).from('patients').select('id,clinical_notes').eq('id', f.patientA));
    emptyOrDenied(await ordinary(label).from('prescriptions').select('id,issuance_snapshot').eq('id', state.prescriptionId));
    denied(await ordinary(label).from('prescriptions').insert(rx(label)));
    for (const item of matrixMedia().filter((m) => allMedia || m.clinical)) await denyMedia(label, item);
  }
  try {
    if (phase === 'prepare-actors') {
      fs.mkdirSync(path.dirname(p.privateFile), { recursive: true });
      fs.writeFileSync(p.privateFile, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
      for (const label of LABELS) await check('Create and authenticate isolated ' + label, 'confirmed synthetic Auth actor; forged metadata grants no authority', async () => {
        const email = 'clinia-' + label.toLowerCase() + '-' + crypto.randomBytes(6).toString('hex') + '@clinia.invalid';
        const password = crypto.randomBytes(24).toString('base64url') + 'aA1!';
        const user = successful(await admin.auth.admin.createUser({ email, password, email_confirm: true,
          user_metadata: { full_name: 'Sintético ' + label, role: 'clinic_owner', clinic_id: f.clinicB, pending_clinic: { name: 'No crear desde metadata' } } })).user;
        assert.match(user?.id || '', UUID); assert.equal(user.email, email); assert.ok(user.email_confirmed_at);
        state.actors[label] = { id: user.id, email, password }; savePrivate();
        state.actors[label].token = await login(label); savePrivate();
        const profile = successful(await ordinary(label).from('profiles').select('id,role,clinic_id').eq('id', user.id));
        assert.equal(profile.length, 1); assert.equal(profile[0].clinic_id, null); assert.notEqual(profile[0].role, 'clinic_owner');
        emptyOrDenied(await ordinary(label).from('clinic_members').select('clinic_id,role').eq('user_id', user.id));
        assert.equal(successful(await rpc(label, 'get_clinic_member_role', { check_clinic_id: f.clinicB })), null);
        return { label, userId: user.id, originalTokenSha256: sha(state.actors[label].token), editableMetadataAuthority: false };
      });
      ownedState(state, attempt);
      const sql = fixtureSql(state); fs.writeFileSync(path.join(p.directory, 'fixture.sql'), sql, { flag: 'wx' });
      for (const mode of ['revoke', 'demote', 'restore']) fs.writeFileSync(path.join(p.directory, mode + '-doctor.sql'), membershipSql(state, mode), { flag: 'wx' });
      const ids = { project: PROJECT, fixtures: f, actorIds: Object.fromEntries(LABELS.map((label) => [label, state.actors[label].id])) };
      fs.writeFileSync(path.join(p.directory, 'fixture-ids.json'), JSON.stringify(ids, null, 2) + '\n', { flag: 'wx' });
      state.stage = 'ACTORS_PREPARED_SQL_PENDING'; savePrivate(); report.fixtureSqlSha256 = sha(sql); report.fixtureIds = ids;
    } else {
      if (phase !== 'matrix') {
        verifiedMatrix(state, p.directory, report.driverSha256);
        report.verifiedMatrix = { ...state.verifiedMatrix };
      }
      if (phase === 'matrix') {
        await check('Fixture actors have exact live roles via ordinary original JWTs', 'owner/doctor/reception/removed/foreign/auth-test roles', async () => {
          const roles = { owner_A: 'clinic_owner', doctor_A: 'doctor', receptionist_A: 'receptionist', removed_A: null, auth_revoked_A: 'doctor' };
          for (const [label, role] of Object.entries(roles)) assert.equal(successful(await rpc(label, 'get_clinic_member_role', { check_clinic_id: f.clinicA })), role);
          assert.equal(successful(await rpc('owner_B', 'get_clinic_member_role', { check_clinic_id: f.clinicB })), 'clinic_owner');
          assert.equal(successful(await rpc('owner_B', 'get_clinic_member_role', { check_clinic_id: f.clinicA })), null);
          return { liveRoleChecks: 7 };
        });
        await check('Demographics, clinical and financial boundaries use real RLS', 'operational roles allowed; clinical reception/foreign/anonymous denied', async () => {
          for (const label of ['owner_A', 'doctor_A', 'receptionist_A']) {
            const result = successful(await demographics(label)); assert.equal(result.items.length, 1); assert.equal(result.items[0].id, f.patientA);
            for (const key of ['clinical_notes', 'medical_history', 'account_balance']) assert.ok(!(key in result.items[0]));
            denied(await ordinary(label).from('patients').select('account_balance').eq('id', f.patientA));
          }
          assert.equal(successful(await clinical('doctor_A')).items[0].clinical_notes, 'Nota clínica sintética sin uso clínico');
          for (const label of ['receptionist_A', 'owner_B', 'removed_A', 'anonymous']) {
            denied(await clinical(label)); emptyOrDenied(await ordinary(label).from('patients').select('id,clinical_notes').eq('id', f.patientA));
          }
          const update = successful(await rpc('receptionist_A', 'save_patient_demographics', { p_clinic_id: f.clinicA, p_patient_id: f.patientA, p_data: { phone: '000' } })); assert.equal(update.phone, '000');
          for (const p_data of [{ clinical_notes: 'No autorizado' }, { account_balance: '0' }]) invalidRequest(await rpc('receptionist_A', 'save_patient_demographics', { p_clinic_id: f.clinicA, p_patient_id: f.patientA, p_data }));
          assert.equal(successful(await clinical('doctor_A')).items[0].clinical_notes, 'Nota clínica sintética sin uso clínico');
          return { operationalReads: 3, clinicalDoctorAllowed: true, forbiddenClinicalReaders: 4, forbiddenInputCode: '22023', forbiddenInputKeys: ['clinical_notes', 'account_balance'] };
        });
        await check('Ordinary actor cannot elevate profile or membership authority', '42501/no changed live role', async () => {
          denied(await ordinary('doctor_A').from('clinic_members').update({ role: 'clinic_owner' }).eq('user_id', state.actors.doctor_A.id).eq('clinic_id', f.clinicA));
          denied(await ordinary('doctor_A').from('profiles').update({ role: 'clinic_owner', clinic_id: f.clinicB }).eq('id', state.actors.doctor_A.id));
          assert.equal(successful(await rpc('doctor_A', 'get_clinic_member_role', { check_clinic_id: f.clinicA })), 'doctor');
          return { roleEscalationDenied: true };
        });
        const expires = [];
        await check('Four Storage buckets remain private with reviewed limits', 'private known buckets only; no configuration mutation', async () => {
          const buckets = successful(await admin.storage.listBuckets());
          for (const id of runtime.buckets) {
            const b = buckets.find((item) => item.id === id); assert.ok(b); assert.equal(b.public, false);
            assert.equal(b.file_size_limit, (id === 'patient-files' ? 10 : 5) * 1024 * 1024);
            assert.deepEqual([...b.allowed_mime_types].sort(), (id === 'patient-files' ? ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp']).sort());
          }
          return { privateBuckets: 4 };
        });
        for (const media of matrixMedia()) await check(media.bucket + ' hosted bytes/list/sign and role isolation', 'allowed writer/readers succeed; removed/foreign/anonymous denied', async () => {
          successful(await ordinary(media.writer).storage.from(media.bucket).upload(media.object, media.bytes, { contentType: media.mime, upsert: false, cacheControl: '0' }));
          const readers = media.clinical ? ['owner_A', 'doctor_A'] : ['owner_A', 'doctor_A', 'receptionist_A'];
          for (const label of readers) {
            await fileBytes(await ordinary(label).storage.from(media.bucket).download(media.object), media.bytes);
            const listing = successful(await ordinary(label).storage.from(media.bucket).list(path.posix.dirname(media.object), { limit: 100, offset: 0 }));
            assert.ok(listing.some((item) => item.name === path.posix.basename(media.object)));
            const signed = successful(await ordinary(label).storage.from(media.bucket).createSignedUrl(media.object, 60)); providerUrl(signed.signedUrl);
          }
          for (const label of ['owner_B', 'removed_A', 'anonymous', ...(media.clinical ? ['receptionist_A'] : [])]) await denyMedia(label, media);
          const publicRead = await safeFetch(ORIGIN + '/storage/v1/object/public/' + media.bucket + '/' + media.object, {}, 'anonymous_public');
          assert.ok([400, 401, 403, 404].includes(publicRead.status));
          const signed = successful(await ordinary(media.writer).storage.from(media.bucket).createSignedUrl(media.object, 2)); providerUrl(signed.signedUrl);
          const download = await safeFetch(signed.signedUrl, {}, 'signed_capability'); assert.equal(download.status, 200); assert.equal(sha(Buffer.from(await download.arrayBuffer())), sha(media.bytes));
          expires.push(signed.signedUrl);
          return { bucket: media.bucket, writer: media.writer, allowedReaders: readers.length, bytesSha256: sha(media.bytes), signedExpirySeconds: 2 };
        });
        await check('All four signed capabilities expire', 'previously successful URLs rejected after requested TTL', async () => {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          for (const signed of expires) { const response = await safeFetch(signed, {}, 'expired_signed_capability'); assert.ok([400, 401, 403].includes(response.status)); }
          return { expiredCapabilities: expires.length };
        });
        await check('Storage cannot forge clinical foreign patient or media writer ownership', 'valid bytes rejected by role/path checks', async () => {
          denied(await ordinary('doctor_A').storage.from('clinic-branding').upload(f.clinicA + '/doctor-forbidden.png', PNG, { contentType: 'image/png' }));
          denied(await ordinary('owner_A').storage.from('doctor-avatars').upload(state.actors.doctor_A.id + '/owner-forbidden.png', PNG, { contentType: 'image/png' }));
          denied(await ordinary('receptionist_A').storage.from('patient-avatars').upload(f.clinicA + '/' + f.patientB + '/foreign-patient.png', PNG, { contentType: 'image/png' }));
          const item = matrixMedia()[0]; successful(await ordinary('doctor_A').from('patient_files').insert({ clinic_id: f.clinicA, patient_id: f.patientA, uploaded_by: state.actors.doctor_A.id, name: 'Documento staging sintético', file_path: item.object, type: item.mime, size: item.bytes.length }));
          denied(await ordinary('doctor_A').storage.from(item.bucket).upload(item.object, Buffer.from('%PDF-1.4\nAlterado\n%%EOF'), { contentType: item.mime, upsert: true }));
          await fileBytes(await ordinary('doctor_A').storage.from(item.bucket).download(item.object), item.bytes);
          return { forbiddenPaths: 3, registeredClinicalBytesImmutable: true };
        });
        await check('Prescription REST UUID retries preserve one immutable issuance receipt', 'one insert, duplicate 23505, own recovery count one; edits/forgeries denied', async () => {
          const id = crypto.randomUUID(), record = rx('doctor_A', id), c = ordinary('doctor_A');
          const results = await Promise.all([c.from('prescriptions').insert(record).select('id,clinic_id,patient_id,doctor_id,issuance_snapshot').single(), c.from('prescriptions').insert(record).select('id,clinic_id,patient_id,doctor_id,issuance_snapshot').single()]);
          assert.equal(results.filter((r) => !r.error).length, 1); assert.equal(results.find((r) => r.error).error.code, '23505');
          const receipt = successful(results.find((r) => !r.error)); assert.equal(receipt.issuance_snapshot?.prescription_id, id); assert.equal(receipt.doctor_id, state.actors.doctor_A.id);
          const recover = successful(await c.from('prescriptions').select('id,clinic_id,patient_id,doctor_id,issuance_snapshot').eq('id', id)); assert.deepEqual(recover, [receipt]);
          const retry = await c.from('prescriptions').insert(record); assert.equal(retry.error?.code, '23505');
          denied(await c.from('prescriptions').update({ data: { ...record.data, indications: 'Alterado' } }).eq('id', id));
          denied(await c.from('prescriptions').insert({ ...rx('doctor_A'), issuance_snapshot: { version: 999 } }));
          denied(await c.from('prescriptions').insert({ ...rx('doctor_A'), doctor_id: state.actors.owner_A.id }));
          denied(await ordinary('receptionist_A').from('prescriptions').insert(rx('receptionist_A')));
          emptyOrDenied(await ordinary('owner_B').from('prescriptions').select('id,issuance_snapshot').eq('id', id));
          assert.deepEqual(successful(await c.from('prescriptions').select('id,clinic_id,patient_id,doctor_id,issuance_snapshot').eq('id', id)), [receipt]);
          state.prescriptionId = id; return { requestId: id, receipts: 1, duplicateCode: '23505', receiptSha256: sha(JSON.stringify(receipt)) };
        });
        await check('Eight hosted appointment races preserve one row and sanitized 23P01', 'ordinary doctor/reception; no 40P01 or HTTP500', async () => {
          for (let i = 0; i < 8; i++) {
            const data = appointment();
            const results = await Promise.all([saveAppointment('doctor_A', data), saveAppointment('receptionist_A', data)]);
            assert.equal(results.filter((r) => !r.error).length, 1); const rejected = results.find((r) => r.error);
            assert.equal(rejected.error.code, '23P01'); assert.equal(rejected.error.message, 'Appointment interval unavailable'); assert.equal(rejected.error.details, null);
            const rows = successful(await ordinary('doctor_A').from('appointments').select('id').eq('clinic_id', f.clinicA).eq('doctor_id', state.actors.doctor_A.id).eq('start_time', data.start_time)); assert.equal(rows.length, 1);
          }
          denied(await ordinary('doctor_A').from('appointments').insert({ ...appointment(), clinic_id: f.clinicA }));
          return { races: 8, savedRows: 8, safeConflicts: 8, directBypassDenied: true };
        });
        await check('Hosted schedule joins and operational report remain scoped after the race', 'eight scheduled appointments; reception omits clinical notes; no financial report', async () => {
          const start = matrixStart(attempt, matrixRunNumber);
          const range = { p_start: new Date(start).toISOString(), p_end: new Date(start + 7 * 86400000).toISOString() };
          for (const label of ['doctor_A', 'receptionist_A']) {
            const schedule = successful(await rpc(label, 'get_clinic_schedule', { p_clinic_id: f.clinicA, ...range }));
            assert.equal(schedule.items.length, 8); assert.equal(schedule.total_count, 8);
            for (const row of schedule.items) { assert.equal(row.clinic_id, f.clinicA); assert.equal(row.profiles?.id, state.actors.doctor_A.id); assert.ok(row.patients?.first_name); assert.equal('notes' in row, label === 'doctor_A'); }
            const result = successful(await rpc(label, 'get_clinic_operational_report', { p_clinic_id: f.clinicA, ...range }));
            assert.equal(result.summary.appointments, 8); assert.equal(result.statuses.scheduled, 8);
            assert.ok(!/revenue|amount|balance|invoice|payment|price/i.test(JSON.stringify(result)));
          }
          for (const label of ['owner_B', 'removed_A', 'anonymous']) denied(await rpc(label, 'get_clinic_operational_report', { p_clinic_id: f.clinicA, ...range }));
          return { scheduleRows: 8, operationalReaders: 2, financialFields: 0 };
        });
      } else if (phase === 'prove-revoked') {
        await check('Original doctor JWT loses all capabilities after committed member removal', 'no refresh; every private bucket read/write/list/sign denied', async () => {
          assert.equal(successful(await rpc('doctor_A', 'get_clinic_member_role', { check_clinic_id: f.clinicA })), null);
          const member = successful(await ordinary('doctor_A').from('clinic_members').select('status').eq('user_id', state.actors.doctor_A.id).eq('clinic_id', f.clinicA)); assert.equal(member[0]?.status, 'removed');
          denied(await demographics('doctor_A')); denied(await saveAppointment('doctor_A', appointment())); await clinicalDenials('doctor_A', true);
          return { originalTokenSha256: sha(state.actors.doctor_A.token), allBucketsDenied: 4 };
        });
      } else if (phase === 'prove-demoted') {
        await check('Original doctor JWT follows the new reception role after committed demotion', 'demographics remain allowed; clinical read/write/list/sign denied', async () => {
          assert.equal(successful(await rpc('doctor_A', 'get_clinic_member_role', { check_clinic_id: f.clinicA })), 'receptionist');
          const result = successful(await demographics('doctor_A')); assert.equal(result.items[0].id, f.patientA); assert.ok(!('clinical_notes' in result.items[0]));
          await clinicalDenials('doctor_A');
          for (const item of matrixMedia().filter((m) => ['clinic-branding', 'patient-avatars'].includes(m.bucket))) await fileBytes(await ordinary('doctor_A').storage.from(item.bucket).download(item.object), item.bytes);
          return { originalTokenSha256: sha(state.actors.doctor_A.token), liveRole: 'receptionist', demographicsAllowed: true, clinicalMediaDenied: true };
        });
      } else {
        const label = 'auth_revoked_A', actor = state.actors[label];
        await check('Dedicated actor retains a signed JWT after real Auth global logout', 'positive before; original JWT denied after provider logout', async () => {
          assert.equal(successful(await rpc(label, 'get_clinic_member_role', { check_clinic_id: f.clinicA })), 'doctor'); successful(await clinical(label));
          for (const item of matrixMedia()) {
            await fileBytes(await ordinary(label).storage.from(item.bucket).download(item.object), item.bytes);
            successful(await ordinary(label).storage.from(item.bucket).createSignedUrl(item.object, 60));
          }
          successful(await admin.auth.admin.signOut(actor.token, 'global'));
          denied(await demographics(label)); denied(await saveAppointment(label, appointment(actor.id))); await clinicalDenials(label, true);
          return { originalTokenSha256: sha(actor.token), globalLogoutProviderAccepted: true, allBucketsDenied: 4 };
        });
        await check('Dedicated actor new live session loses capabilities after real Auth ban', 'fresh independent positive session; retained JWT denied after ban', async () => {
          actor.banTestToken = await login(label); savePrivate(); clients[label] = makeClient(label + '_ban_retained', actor.banTestToken);
          successful(await clinical(label));
          try { successful(await admin.auth.admin.updateUserById(actor.id, { ban_duration: '1h' })); denied(await demographics(label)); denied(await saveAppointment(label, appointment(actor.id))); await clinicalDenials(label, true); }
          finally { successful(await admin.auth.admin.updateUserById(actor.id, { ban_duration: 'none' })); }
          return { retainedBanTokenSha256: sha(actor.banTestToken), authBanProviderAccepted: true, syntheticBanLifted: true, allBucketsDenied: 4 };
        });
      }
    }
    assert.ok(report.requests.every((r) => r.status !== null && r.status < 500 && r.code !== '40P01'), 'Unexpected provider failure/deadlock');
    report.status = 'VERIFIED';
    report.completedAt = new Date().toISOString(); persist();
    if (phase === 'matrix') {
      state.verifiedMatrix = { filename: path.basename(p.report), runNumber, fileSha256: sha(fs.readFileSync(p.report)),
        driverSha256: report.driverSha256, fixtureBindingSha256: report.fixtureBindingSha256, prescriptionId: state.prescriptionId };
      verifiedMatrix(state, p.directory, report.driverSha256);
      state.stage = 'MATRIX_VERIFIED'; savePrivate();
    }
  } catch { report.status = 'PARTIAL'; report.failure = 'Hosted verification failed; inspect named checks/statuses, no provider bodies emitted'; process.exitCode = 1; }
  finally { report.completedAt ||= new Date().toISOString(); persist(); console.log(JSON.stringify({ status: report.status, phase, runNumber, checks: report.checks.length, evidence: p.report })); }
}
if (require.main === module) {
  if (![5, 6].includes(process.argv.length)) { console.error('Use explicit phase, attempt, phihonofwyerpfgqfekt, optional run 1..9'); process.exitCode = 1; }
  else run(...process.argv.slice(2)).catch(() => { console.error('Hosted operation prerequisites refused; no credential/provider contents emitted'); process.exitCode = 1; });
}
module.exports = { PROJECT, PHASES, LABELS, plan, providerUrl, jwtUnexpired, denied, storageDenied, invalidRequest, emptyOrDenied, fixtureSql, membershipSql, mediaSpecs, ownedState, fixtureBinding, matrixStart, verifiedMatrix };
