'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'docs/production/reconciliation/encargo02');
const sql = fs.readFileSync(path.join(dir, 'forward.sql'), 'utf8');
const verify = fs.readFileSync(path.join(dir, 'verify.sql'), 'utf8');
const containment = fs.readFileSync(path.join(dir, 'containment.sql'), 'utf8');
const cases = JSON.parse(fs.readFileSync(path.join(dir, 'acceptance-cases.json'), 'utf8'));
const captures = ['prod', 'stage'].map(name => JSON.parse(fs.readFileSync(path.join(root, `docs/production/evidence/2026-09-27/catalog-${name}-scoped.metadata.json`), 'utf8')));
const functions = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([\w.]+)\(([\s\S]*?)\)\s*RETURNS ([\s\S]*?)AS \$function\$([\s\S]*?)\$function\$;/g)];
const body = name => { const f = functions.find(f => f[1] === name); assert.ok(f, name); return f[4]; };
const grants = [...sql.matchAll(/GRANT\s+(SELECT|INSERT|UPDATE)\s*\(([^)]+)\)\s+ON\s+public\.([a-z0-9_]+)/g)];

test('Every explicit grant column exists with its real type in both captures', () => {
  assert.ok(grants.length >= 25);
  for (const capture of captures) for (const g of grants) for (const col of g[2].split(',').map(x => x.trim())) {
    // resolution_notes is added by mandatory M7 to the pre-M7 production fixture.
    if (g[3] === 'data_rights_requests' && col === 'resolution_notes') continue;
    const field = capture.columns.find(x => x.schema === 'public' && x.table === g[3] && x.name === col);
    assert.ok(field && field.type, `${capture.projectRef} ${g[3]}.${col}`);
  }
});
test('No new column INSERT privilege can spoof creation timestamps or IDs', () => {
  for (const g of grants.filter(x => x[1] === 'INSERT')) {
    assert.ok(!g[2].split(',').some(x => ['created_at', 'updated_at', 'id'].includes(x.trim())), g[3]);
  }
  const hcu = captures[1].columns.filter(x => x.table === 'hcu033_forms' && x.notNull && !x.default).map(x => x.name);
  assert.deepEqual(hcu.sort(), ['form_data', 'patient_id']);
  assert.match(sql,/ALTER TABLE public\.hcu033_forms ALTER COLUMN clinic_id DROP DEFAULT/);
  for (const capture of captures) for (const table of ['patients', 'appointments']) {
    for (const col of capture.columns.filter(x => x.table === table && x.notNull && !x.default)) {
      assert.ok(grants.some(g => g[1] === 'INSERT' && g[3] === table && g[2].split(',').map(x => x.trim()).includes(col.name)), `${table}.${col.name}`);
    }
  }
});
test('Financial columns never appear in client grants or projected patient RPCs', () => {
  for (const g of grants.filter(x => ['patients', 'services'].includes(x[3]))) {
    assert.ok(!/\b(account_balance|insurance_provider|policy_number|price)\b/.test(g[2]));
  }
  for (const fn of ['security_internal.patient_demographic', 'public.get_patient_demographics', 'public.save_patient_demographics', 'public.get_patients_with_stats']) {
    assert.ok(!/\b(account_balance|insurance_provider|policy_number|billings|invoices|payments)\b/.test(body(fn)), fn);
  }
  assert.ok(captures.every(x => !x.columns.some(c => c.table === 'patients' && c.name === 'data_consent')));
  const allowed = body('public.save_patient_demographics').match(/v_allowed constant text\[\]:=ARRAY\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(x => x.slice(1,-1));
  for (const capture of captures) for (const col of allowed) assert.ok(capture.columns.some(c => c.table === 'patients' && c.name === col && ['text','date'].includes(c.type)), col);
});
test('Authority is live, profile active, membership active, with no primary clinic fallback', () => {
  const role = body('security_internal.role_for');
  assert.match(role, /JOIN public\.profiles/); assert.match(role, /m\.status='active'/); assert.match(role, /p\.status::text='active'/); assert.match(role, /p\.deleted_at IS NULL/);
  assert.ok(!/owner_id|p\.clinic_id|user_metadata|app_metadata/.test(role));
  assert.match(body('public.get_clinic_member_role'), /is_anonymous/);
  assert.match(body('security_internal.require_clinic'), /FOR SHARE OF m,p/);
});
test('M7 prerequisite hashes agree with actual captured and source function bodies', () => {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql'), 'utf8').replace(/\r\n/g,'\n');
  const fromSource = new Map([...source.matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)].map(m => [m[1],m[2]]));
  const expected = [...sql.matchAll(/\('([\w.]+)\((?:uuid)?\)','([0-9a-f]{32})'\)/g)];
  assert.equal(expected.length,6);
  for (const e of expected) {
    const md5 = text => crypto.createHash('md5').update(text.replace(/\r\n/g,'\n')).digest('hex');
    assert.equal(md5(fromSource.get(e[1])), e[2], e[1]);
    const f = captures[1].functions.find(f => `${f.schema}.${f.name}` === e[1]);
    assert.equal(f.owner,'postgres');
    assert.equal(md5(f.definition.split('AS $function$')[1].split('$function$')[0]),e[2]);
  }
  assert.match(sql,/current_user<>'postgres' OR session_user<>'postgres'/);
  assert.ok(!/ALTER\s+FUNCTION[\s\S]*?OWNER TO/.test(sql));
  assert.match(sql,/t\.tgtype=23/); assert.match(sql,/t\.tgfoid=to_regprocedure\('security_internal.enforce_clinician_assignment/);
});
test('Signup callback cannot provision authority and verification callback preserves Auth row only', () => {
  const signup = body('public.handle_new_user'), confirmed = body('public.handle_verified_clinic_creation');
  assert.match(signup,/INSERT INTO public\.profiles\(id,full_name,email,status\)/);
  assert.ok(!/clinic_members|INSERT INTO public\.clinics|pending_clinic|'clinic_owner'/.test(signup));
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/i.test(confirmed)); assert.match(confirmed,/RETURN NEW/);
});
test('HCU has deterministic safe preparation before identity guard and qualified synthesis', () => {
  assert.ok('encargo02_00_prepare_author'.localeCompare('encargo02_protect_identity') < 0);
  assert.match(body('security_internal.prepare_hcu033_author'),/NEW\.doctor_id:=auth\.uid\(\)/);
  assert.match(sql,/ALTER TABLE public\.hcu033_forms ALTER COLUMN clinic_id DROP DEFAULT/);
  assert.ok(!/INTO NEW\.clinic_id/.test(body('public.sync_hcu033_form_clinic_id')));
  assert.match(body('public.update_patient_odontogram_summary'),/UPDATE public\.patients/);
  assert.match(body('public.update_patient_odontogram_summary'),/id=NEW\.patient_id AND clinic_id=NEW\.clinic_id/);
  for (const f of functions) assert.match(f[3],/SET search_path=''/,f[1]);
});
test('Service references and storage replacement use private controlled checks', () => {
  assert.match(body('security_internal.protect_service_reference'),/c\.id=NEW\.category_id AND c\.clinic_id=NEW\.clinic_id FOR KEY SHARE/);
  const replacement = body('security_internal.storage_replace_allowed');
  assert.match(replacement,/IF NOT security_internal\.storage_access/); assert.match(replacement,/f\.clinic_id=v_parts\[1\]::uuid/); assert.match(replacement,/f\.patient_id=v_parts\[2\]::uuid/);
  const policy = sql.match(/CREATE POLICY encargo02_storage_update[\s\S]*?;/)[0];
  assert.ok(!/public\.patient_files/.test(policy)); assert.match(policy,/USING[\s\S]+WITH CHECK/);
  assert.match(body('security_internal.storage_access'),/public\.check_subscription_active\(m\.clinic_id\)/);
  assert.match(body('public.check_subscription_active'),/c\.archived_at IS NULL/);
});
test('Demographic pagination and schedule keep count and page in one statement', () => {
  assert.match(body('public.get_patient_demographics'),/WITH matched AS MATERIALIZED/);
  assert.match(body('public.get_patient_demographics'),/'total_count',\(SELECT count\(\*\) FROM matched\)/);
  assert.match(body('public.get_clinic_schedule'),/interval '93 days'/);
  assert.ok(!/LIMIT|OFFSET/.test(body('public.get_clinic_schedule')));
  assert.match(body('public.get_clinic_schedule'),/to_jsonb\(matched\)-'notes'/);
  assert.match(body('public.save_clinic_appointment'),/v_key='notes' AND v_role NOT IN/);
});
test('Containment closes column and function grants without mutating history or bytes', () => {
  assert.match(containment,/AS RESTRICTIVE FOR ALL TO anon,authenticated USING \(false\) WITH CHECK \(false\)/);
  assert.match(containment,/REVOKE SELECT \(%s\), INSERT \(%s\), UPDATE \(%s\), REFERENCES \(%s\)/);
  assert.ok(!/\b(DELETE FROM|TRUNCATE|DROP TABLE|DROP FUNCTION|UPDATE public|INSERT INTO public)\b/i.test(containment));
  assert.match(verify,/BEGIN READ ONLY/); assert.match(verify,/has_column_privilege/);
});
test('Real acceptance plan covers all actors and providers and remains unexecuted', () => {
  assert.equal(cases.status,'PREPARADO_NO_EJECUTADO_NO_ACEPTADO'); assert.equal(cases.deployable,false);
  assert.equal(new Set(cases.cases.map(c=>c.id)).size,cases.cases.length);
  for(const id of ['auth_metadata_signup','receiver_base_denial','financial_closure','live_membership_old_jwt','tenant_references','storage_patient_files','storage_operational_upsert','containment_preservation']) assert.ok(cases.cases.some(c=>c.id===id),id);
  for(const surface of ['Auth','RPC','PostgREST','Storage']) assert.ok(cases.cases.some(c=>c.surface.includes(surface)),surface);
  assert.ok(cases.pending.includes('SQL parse/execute and catalog verification'));
});
