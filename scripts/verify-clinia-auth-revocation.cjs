'use strict';
// Existing synthetic candidate only; no cloud, dotenv, patient contents or token output.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const api = require('./clinia-contract-api.cjs'), local = require('./clinia-local-runtime.cjs');
const mode = process.argv[2];
assert.equal(process.argv.length, 3); assert.ok(['before', 'after'].includes(mode));
const variant = 'captured-linked-v2', c = api.config(variant);
const directory = path.join(local.repo, 'docs/production/evidence/2026-10-02-auth-revocation', mode + '-1');
assert.ok(!fs.existsSync(directory), 'Preserve prior evidence; review a new attempt explicitly');
fs.mkdirSync(directory, { recursive: true });
const report = { startedAt: new Date().toISOString(), status: 'NOT VERIFIED', mode, database: c.database,
  environment: 'Isolated existing synthetic captured-linked-v2 candidate; direct Auth and PostgREST HTTP',
  checks: [], requests: [], limits: ['Not cloud or deployed browser evidence', 'Synthetic owner_B, no real patient data or email'] };
const keys = api.read(variant).keys;
const actor = JSON.parse(fs.readFileSync(path.join(local.privateDir, c.project + '-actors-1.private.json'))).owner_B;
const fixture = JSON.parse(fs.readFileSync(path.join(local.repo, 'docs/production/evidence/2026-10-02-contract-api/captured-linked-v2-1/execution.json'))).fixtureIds;
report.actor = { label: 'owner_B', id: actor.id, clinicId: fixture.clinicB };
const docker = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
function compose(action) {
  const args = ['--context', 'desktop-linux', 'compose', '-f', c.compose];
  args.push(...(action === 'start' ? ['up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '60'] : ['stop']));
  const r = spawnSync(docker, args, { encoding: 'utf8', windowsHide: true, timeout: 90000 });
  if (r.error || r.status !== 0) {
    fs.writeFileSync(path.join(local.privateDir, 'auth-revocation-' + mode + '.private.log'), (r.stdout || '') + (r.stderr || ''));
    throw Error('Owned candidate operation failed; private diagnostics preserved');
  }
}
async function request(service, route, token, method = 'GET', body) {
  const base = 'http://127.0.0.1:' + (c.port + (service === 'rest' ? 1 : 0));
  const url = new URL(route, base); assert.equal(url.origin, base);
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
  report.requests.push({ service, path: url.pathname, method, status: r.status });
  const text = await r.text(); return { status: r.status, data: text ? JSON.parse(text) : null };
}
async function login() {
  const r = await request('auth', '/token?grant_type=password', keys.anon, 'POST', { email: actor.email, password: actor.password });
  assert.equal(r.status, 200); assert.equal(r.data.user.id, actor.id);
  return r.data.access_token;
}
async function access(token, name, allowed) {
  const role = await request('rest', '/rpc/get_clinic_member_role', token, 'POST', { check_clinic_id: fixture.clinicB });
  const patients = await request('rest', '/patients?select=id,clinical_notes&clinic_id=eq.' + fixture.clinicB, token);
  const profile = await request('rest', '/profiles?select=id&id=eq.' + actor.id, token);
  const observed = { role: role.data, clinicalRows: Array.isArray(patients.data) ? patients.data.length : null,
    ownProfileRows: Array.isArray(profile.data) ? profile.data.length : null };
  report.checks.push({ name, expected: allowed ? 'own clinic success' : 'role null, zero clinical/profile rows', observed });
  assert.equal(role.status, 200); assert.equal(patients.status, 200); assert.equal(profile.status, 200);
  if (allowed) { assert.equal(role.data, 'clinic_owner'); assert.ok(observed.clinicalRows > 0); assert.equal(observed.ownProfileRows, 1); }
  else { assert.equal(role.data, null); assert.equal(observed.clinicalRows, 0); assert.equal(observed.ownProfileRows, 0); }
}
async function main() {
  let token;
  try {
    local.inspectLocal(); compose('start'); report.runtime = api.inspect(variant);
    token = await login(); await access(token, 'Active real Auth session control', true);
    const ban = await request('auth', '/admin/users/' + actor.id, keys.service, 'PUT', { ban_duration: '1h' });
    assert.equal(ban.status, 200); assert.ok(new Date(ban.data.banned_until).getTime() > Date.now());
    await access(token, 'Original JWT after real Auth ban', mode === 'before');
    assert.equal((await request('auth', '/admin/users/' + actor.id, keys.service, 'PUT', { ban_duration: 'none' })).status, 200);
    token = await login(); await access(token, 'Unbanned new real Auth session control', true);
    assert.equal((await request('auth', '/logout?scope=global', token, 'POST')).status, 204);
    await access(token, 'Original JWT after real Auth global logout', mode === 'before');
    report.status = mode === 'before' ? 'NOT VERIFIED' : 'VERIFIED';
    if (mode === 'before') report.finding = 'REPRODUCED P1: real Auth ban/global logout leaves original JWT able to read synthetic clinical data under canonical profile/membership-only authority';
  } catch (e) { report.error = e.message; process.exitCode = 1; }
  finally {
    try { await request('auth', '/admin/users/' + actor.id, keys.service, 'PUT', { ban_duration: 'none' }); } catch { report.cleanup = 'Unban not confirmed; synthetic actor requires review'; }
    try { compose('stop'); report.services = 'STOPPED_VOLUMES_PRESERVED'; } catch { report.stop = 'Not confirmed'; process.exitCode = 1; }
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, 'execution.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, finding: report.finding || null, error: report.error || null, evidence: directory }));
  }
}
main();
