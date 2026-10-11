'use strict';
// Real ordinary Auth JWTs on the owned clean loopback project. Verification only:
// the caller separately applies the reviewed migration and starts the gateway.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createClient } = require('@supabase/supabase-js');
const api = require('./clinia-clean-api.cjs');
const local = require('./clinia-local-runtime.cjs');

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const bodyHash = (value) => crypto.createHash('md5').update(value.replace(/\s+/g, '')).digest('hex');
const guardHash = '852e98f6d3e11eb76557f652f10c725d';
const requireHash = 'e7c822cbffb3195f70088e7e4617a043';
const sessionHash = '69a325cf0b73743dc5a50b2c6f4a7170';
const lockNamespace = 'clinia.appointment.clinic:';

function plan(variant, attempt, migration, pinnedSha256) {
  assert.match(variant || '', /^clean-managed-[1-9]$/, 'Exact clean project required');
  assert.match(attempt || '', /^[1-9]$/, 'Fresh attempt 1..9 required');
  assert.match(migration || '', /^supabase\/migrations\/\d{14}_serialize_appointment_rpc_writes\.sql$/, 'Exact CLI migration path required');
  assert.match(pinnedSha256 || '', /^[a-f0-9]{64}$/, 'Reviewed migration SHA required');
  const source = fs.readFileSync(path.join(local.repo, migration), 'utf8');
  assert.equal(digest(source), pinnedSha256, 'Migration changed after review');
  const match = source.match(/CREATE OR REPLACE FUNCTION public\.save_clinic_appointment\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/);
  assert.ok(match, 'Reviewable complete RPC definition required');
  return {
    c: api.config(variant), variant, attempt, migration, pinnedSha256,
    expectedSaveHash: bodyHash(match[1]),
    output: path.join(local.repo, 'docs/production/evidence/2026-10-03-agenda-serialization', variant + '-' + attempt),
  };
}

function holdClinicLock() {
  assert.equal(workerData.operation, 'hold-owned-clinic-lock');
  assert.match(workerData.variant, /^clean-managed-[1-9]$/);
  assert.match(workerData.clinic, uuid);
  assert.match(workerData.tag, /^agenda-probe-[a-f0-9]{12}$/);
  // Only the advisory key is locked. No actor/session/member/appointment rows.
  api.sql(workerData.variant, `BEGIN;
    SET LOCAL application_name='${workerData.tag}';
    SET LOCAL statement_timeout='12s';
    SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('${lockNamespace}${workerData.clinic}',0));
    SELECT pg_catalog.pg_sleep(6);
    COMMIT;`, 'postgres');
  parentPort.postMessage({ complete: true });
}

async function main(variant, attempt, migration, pinnedSha256) {
  const p = plan(variant, attempt, migration, pinnedSha256);
  assert.ok(!fs.existsSync(p.output), 'Use a fresh evidence attempt');
  const fixtures = JSON.parse(fs.readFileSync(path.join(local.repo, 'docs/production/evidence/2026-10-02-contract-api', variant + '-1/execution.json'))).fixtureIds;
  for (const value of Object.values(fixtures)) assert.match(value, uuid, 'Owned synthetic fixture UUID required');
  const actors = JSON.parse(fs.readFileSync(path.join(local.privateDir, p.c.project + '-actors-1.private.json')));
  for (const label of ['doctor_A', 'receptionist_A', 'owner_B']) assert.match(actors[label].id, uuid);
  const { keys } = api.read(variant);
  const origin = 'http://127.0.0.1:' + p.c.port;
  const report = {
    state: 'PARTIAL', startedAt: new Date().toISOString(), project: p.c.project,
    migration, migrationSha256: pinnedSha256, expectedSaveBodyMd5: p.expectedSaveHash,
    driverSha256: digest(fs.readFileSync(__filename)), checks: [], requests: [], createdIds: [],
    limits: ['Synthetic loopback real Auth/PostgREST JWTs; not hosted/browser acceptance',
      'Bounded scheduling races; not capacity or clinical acceptance',
      'Appointment evidence is preserved; no rows are deleted'],
  };
  fs.mkdirSync(p.output, { recursive: true });
  const persist = () => fs.writeFileSync(path.join(p.output, 'execution.json'), JSON.stringify(report, null, 2) + '\n');
  persist();
  const trusted = (sql) => api.sql(variant, sql, 'postgres');
  async function safeFetch(input, options = {}, actor = 'anonymous') {
    const url = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(url.origin, origin, 'Nonlocal API refused');
    const response = await fetch(input, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
    let code = null, authenticationDiagnostic = null;
    try { const data = await response.clone().json(); code = data?.code || null;
      if (code === 'PGRST303') authenticationDiagnostic = String(data.message).slice(0,200);
    } catch {}
    report.requests.push({ actor, method: options.method || 'GET', path: url.pathname, status: response.status, code, authenticationDiagnostic });
    return response;
  }
  const client = (label) => createClient(origin, keys.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => safeFetch(input, options, label) },
  });
  async function login(label) {
    const c = client(label), actor = actors[label];
    const result = await c.auth.signInWithPassword({ email: actor.email, password: actor.password });
    assert.equal(result.error, null, 'Synthetic login failed');
    assert.equal(result.data.user?.id, actor.id, 'Unexpected real Auth actor');
    const token = result.data.session.access_token;
    const claims = JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
    report.authentication = report.authentication || [];
    report.authentication.push({actor:label,issuedAt:claims.iat,expiresAt:claims.exp,observedAt:Math.floor(Date.now()/1000)});
    // Auth and PostgREST can sample opposite sides of the issuance second.
    // Mature the real JWT; do not change provider verification or its claims.
    const waitMs = Math.max(0, (claims.iat + 2) * 1000 - Date.now());
    assert.ok(waitMs <= 3000, 'Unexpected provider clock skew');
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    report.authentication.at(-1).issuanceClockWaitMs = waitMs;
    return { client: c, token };
  }
  const ok = (result) => { assert.equal(result.error?.code || null, null, 'Expected successful RPC'); return result.data; };
  const deny = (result, code) => { assert.equal(result.error?.code, code, 'Unexpected rejection code'); assert.equal(result.data, null); };
  const remember = (row) => { assert.match(row.id, uuid); report.createdIds.push(row.id); return row; };
  async function check(name, fn) {
    try {
      const detail = await fn(); report.checks.push({ name, passed: true, detail }); persist();
    } catch {
      report.checks.push({ name, passed: false }); persist();
      throw new Error('Acceptance failed: ' + name);
    }
  }
  const base = Date.parse('2040-10-01T00:00:00Z') + (Number(attempt) - 1) * 7 * 86400000;
  let slot = 0;
  const payload = (extra = {}, clinicB = false) => {
    const start = base + slot++ * 3600000;
    return { patient_id: clinicB ? fixtures.patientB : fixtures.patientA,
      doctor_id: clinicB ? actors.owner_B.id : actors.doctor_A.id,
      start_time: new Date(start).toISOString(), end_time: new Date(start + 1800000).toISOString(),
      status: 'scheduled', type: 'Agenda sintética ' + variant + '-' + attempt, ...extra };
  };
  const save = (c, data, id = null, clinic = fixtures.clinicA) => c.rpc('save_clinic_appointment', {
    p_clinic_id: clinic, p_data: data, p_appointment_id: id,
  });
  const intervalCount = (data, clinic = fixtures.clinicA) => Number(trusted(`SELECT count(*) FROM public.appointments
    WHERE clinic_id='${clinic}' AND doctor_id='${data.doctor_id}' AND deleted_at IS NULL
      AND status IN ('scheduled','confirmed','arrived') AND start_time<'${data.end_time}' AND end_time>'${data.start_time}';`));
  const financialSnapshot = () => trusted("SELECT json_build_object('billings',(SELECT count(*) FROM public.billings),'invoices',(SELECT count(*) FROM public.invoices),'payments',(SELECT count(*) FROM public.payments),'patientBalancesMd5',(SELECT md5(coalesce(string_agg(id::text||':'||coalesce(account_balance::text,''),'|' ORDER BY id),'')) FROM public.patients));");
  let revokedMembership = false;
  let worker;
  let workerDone;
  try {
    report.runtime = api.inspect(variant);
    const catalog = JSON.parse(trusted(`SELECT json_build_object(
      'save',md5(regexp_replace(s.prosrc,'[[:space:]]+','','g')),'owner',s.proowner::regrole::text,
      'securityDefiner',s.prosecdef,'volatile',s.provolatile,'config',s.proconfig,
      'guard',md5(regexp_replace(g.prosrc,'[[:space:]]+','','g')),
      'require',md5(regexp_replace(r.prosrc,'[[:space:]]+','','g')),
      'session',md5(regexp_replace(l.prosrc,'[[:space:]]+','','g')),
      'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.appointments'::regclass),
      'overlap',(SELECT count(*) FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='agenda_no_overlap' AND contype='x'),
      'directWritableColumns',(SELECT count(*) FROM pg_attribute a CROSS JOIN (VALUES ('authenticated'),('anon')) roles(name)
        WHERE a.attrelid='public.appointments'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND (has_column_privilege(roles.name,'public.appointments',a.attname,'INSERT') OR has_column_privilege(roles.name,'public.appointments',a.attname,'UPDATE'))),
      'directWritableTables',(SELECT count(*) FROM (VALUES ('authenticated'),('anon')) roles(name)
        WHERE has_table_privilege(roles.name,'public.appointments','INSERT') OR has_table_privilege(roles.name,'public.appointments','UPDATE')),
      'deadlocks',(SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()))
      FROM pg_proc s,pg_proc g,pg_proc r,pg_proc l
      WHERE s.oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure
        AND g.oid='security_internal.guard_operational_appointment()'::regprocedure
        AND r.oid='security_internal.require_clinic(uuid,text[],boolean)'::regprocedure
        AND l.oid='security_internal.lock_clinia_session()'::regprocedure;`));
    report.catalogBefore = catalog;
    await check('Reviewed RPC and live authority exact bodies; direct ordinary DML closed', async () => {
      assert.equal(catalog.save, p.expectedSaveHash); assert.equal(catalog.guard, guardHash);
      assert.equal(catalog.require, requireHash); assert.equal(catalog.session, sessionHash);
      assert.equal(catalog.owner, 'postgres'); assert.equal(catalog.securityDefiner, true);
      assert.equal(catalog.volatile, 'v'); assert.deepEqual(catalog.config, ['search_path=""']);
      assert.equal(catalog.rls, true); assert.equal(catalog.overlap, 1);
      assert.equal(catalog.directWritableColumns, 0); assert.equal(catalog.directWritableTables, 0);
      return { sourceAndCatalogMatch: true, directWritableColumns: 0, directWritableTables: 0 };
    });
    const doctor = await login('doctor_A'), reception = await login('receptionist_A'), foreign = await login('owner_B');
    const moneyBefore = financialSnapshot();
    await check('Twenty-four real doctor/reception insert races return one save and sanitized 23P01', async () => {
      for (let i = 0; i < 24; i++) {
        const data = payload(); assert.equal(intervalCount(data), 0, 'Synthetic interval already used');
        const second = i % 2 ? { ...data, start_time: new Date(Date.parse(data.start_time) + 900000).toISOString() } : data;
        const results = await Promise.all([save(doctor.client, data), save(reception.client, second)]);
        assert.equal(results.filter((r) => !r.error).length, 1);
        const rejected = results.find((r) => r.error); deny(rejected, '23P01');
        assert.equal(rejected.error.message, 'Appointment interval unavailable'); assert.equal(rejected.error.details, null);
        remember(ok(results.find((r) => !r.error))); assert.equal(intervalCount(data), 1);
      }
      return { races: 24, identical: 12, partiallyOverlapping: 12, saves: 24, safeConflicts: 24 };
    });
    await check('Eight conflicting two-row reschedule races preserve the rejected original', async () => {
      for (let i = 0; i < 8; i++) {
        const first = remember(ok(await save(doctor.client, payload())));
        const second = remember(ok(await save(reception.client, payload())));
        const target = payload(); assert.equal(intervalCount(target), 0);
        const change = { start_time: target.start_time, end_time: target.end_time };
        const results = await Promise.all([save(doctor.client, change, first.id), save(reception.client, change, second.id)]);
        assert.equal(results.filter((r) => !r.error).length, 1); deny(results.find((r) => r.error), '23P01');
        const loser = results[0].error ? first : second;
        const retained = JSON.parse(trusted(`SELECT json_build_object('start_time',start_time,'end_time',end_time) FROM public.appointments WHERE id='${loser.id}';`));
        assert.equal(Date.parse(retained.start_time), Date.parse(loser.start_time));
        assert.equal(Date.parse(retained.end_time), Date.parse(loser.end_time)); assert.equal(intervalCount(target), 1);
      }
      return { races: 8, saves: 8, conflicts: 8, originalLoserPreserved: 8 };
    });
    await check('Doctor and reception cannot bypass the serialized RPC by direct INSERT or UPDATE', async () => {
      const data = payload(), targetId = report.createdIds[0];
      for (const c of [doctor.client, reception.client]) {
        deny(await c.from('appointments').insert({ ...data, clinic_id: fixtures.clinicA }), '42501');
        deny(await c.from('appointments').update({ status: 'confirmed' }).eq('id', targetId), '42501');
      }
      assert.equal(intervalCount(data), 0); return { directDenials: 4, insertedRows: 0 };
    });
    await check('Adjacent intervals remain available; invalid transition and cross-clinic requests fail', async () => {
      const initial = remember(ok(await save(reception.client, payload())));
      const next = payload({ start_time: initial.end_time, end_time: new Date(Date.parse(initial.end_time) + 1800000).toISOString() });
      remember(ok(await save(doctor.client, next)));
      deny(await save(doctor.client, { status: 'completed' }, initial.id), '22023');
      deny(await save(foreign.client, payload()), '42501');
      deny(await save(reception.client, payload({ patient_id: fixtures.patientB })), '42501');
      deny(await save(client('anonymous'), payload()), '42501');
      return { adjacentSaved: true, invalidAndForeignDenials: 4 };
    });
    await check('Queued actor revocation is rechecked after lock; another clinic remains independent', async () => {
      const queued = payload(), otherClinic = payload({}, true), tag = 'agenda-probe-' + crypto.randomBytes(6).toString('hex');
      assert.equal(trusted(`SELECT status FROM public.clinic_members WHERE clinic_id='${fixtures.clinicA}' AND user_id='${actors.doctor_A.id}';`), 'active');
      worker = new Worker(__filename, { workerData: { operation: 'hold-owned-clinic-lock', variant, clinic: fixtures.clinicA, tag } });
      workerDone = new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', () => reject(new Error('Local lock probe failed'))); worker.once('exit', (code) => { if (code !== 0) reject(new Error('Local lock probe exited')); }); });
      // Attach rejection handling before performing synchronous catalog polls.
      workerDone.catch(() => {});
      const held = () => Number(trusted(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity s ON s.pid=l.pid WHERE s.application_name='${tag}' AND l.locktype='advisory' AND l.granted;`));
      const waiting = () => Number(trusted(`SELECT count(*) FROM pg_locks w JOIN pg_locks h ON w.locktype=h.locktype AND w.database=h.database AND w.classid=h.classid AND w.objid=h.objid AND w.objsubid=h.objsubid JOIN pg_stat_activity s ON s.pid=h.pid WHERE s.application_name='${tag}' AND h.granted AND NOT w.granted AND w.locktype='advisory';`));
      async function poll(predicate) {
        for (let i = 0; i < 12; i++) { if (predicate() > 0) return; await new Promise((resolve) => setTimeout(resolve, 100)); }
        throw new Error('Expected local advisory probe state missing');
      }
      await poll(held);
      const queuedRequest = save(doctor.client, queued);
      const queuedResult = Promise.resolve(queuedRequest); queuedResult.catch(() => {});
      await poll(waiting);
      trusted(`BEGIN; SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='2s'; UPDATE public.clinic_members SET status='removed' WHERE clinic_id='${fixtures.clinicA}' AND user_id='${actors.doctor_A.id}' AND status='active'; COMMIT;`);
      revokedMembership = true;
      remember(ok(await save(foreign.client, otherClinic, null, fixtures.clinicB)));
      assert.equal(held(), 1, 'B-clinic write waited for A-clinic lock');
      await workerDone; worker = null;
      deny(await queuedResult, '42501'); assert.equal(intervalCount(queued), 0);
      trusted(`UPDATE public.clinic_members SET status='active' WHERE clinic_id='${fixtures.clinicA}' AND user_id='${actors.doctor_A.id}' AND status='removed';`);
      revokedMembership = false;
      return { observedQueue: true, revocationCommittedWhileQueued: true, deniedAfterLock: '42501', queuedRows: 0, clinicBCompletedWhileClinicALocked: true };
    });
    await check('Revoked real Auth session cannot create an appointment with its old JWT', async () => {
      const revoked = await login('doctor_A'), data = payload();
      const response = await safeFetch(origin + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: keys.anon, Authorization: 'Bearer ' + revoked.token } }, 'doctor_A_revoked');
      assert.equal(response.status, 204); deny(await save(revoked.client, data), '42501'); assert.equal(intervalCount(data), 0);
      return { logout: 204, staleJwtDenial: '42501', rows: 0 };
    });
    await check('No new PostgreSQL deadlocks or financial changes', async () => {
      const deadlocksAfter = Number(trusted('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database();'));
      assert.equal(deadlocksAfter, Number(catalog.deadlocks)); assert.equal(financialSnapshot(), moneyBefore);
      assert.ok(report.requests.every((r) => r.code !== '40P01' && r.status < 500));
      report.deadlocksAfter = deadlocksAfter;
      return { before: Number(catalog.deadlocks), after: deadlocksAfter, financialSnapshotUnchanged: true, observed40P01: 0 };
    });
    report.state = 'VERIFIED_LOCAL_BOUNDED';
  } catch (error) {
    report.failure = /^Acceptance failed: /.test(error.message) ? error.message : 'Local agenda verification failed; private runtime diagnostics retained';
    process.exitCode = 1;
  } finally {
    if (workerDone) { try { await workerDone; } catch { report.lockProbeFailure = true; process.exitCode = 1; } }
    if (revokedMembership) {
      try { trusted(`UPDATE public.clinic_members SET status='active' WHERE clinic_id='${fixtures.clinicA}' AND user_id='${actors.doctor_A.id}' AND status='removed';`); report.syntheticMembershipRestored = true; }
      catch { report.syntheticMembershipRestored = false; process.exitCode = 1; }
    }
    report.completedAt = new Date().toISOString(); persist();
    console.log(JSON.stringify({ state: report.state, checks: report.checks.length, evidence: p.output }));
  }
}

if (!isMainThread) holdClinicLock();
else if (require.main === module) {
  assert.equal(process.argv.length, 6, 'Pass clean variant, fresh attempt, migration path and reviewed SHA');
  main(...process.argv.slice(2)).catch(() => { console.error('Agenda verification prerequisites failed'); process.exitCode = 1; });
}
module.exports = { plan, bodyHash };
