'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const adapter=require('../../scripts/prepare-clinia-hosted-staging.cjs');
const repo=path.resolve(__dirname,'../..');
const pin={file:'reviewed.sql',begin:'BEGIN;',end:'COMMIT;'};

test('hosted adapter independently denies production and accepts only the exact authorized project argument',()=>{
  for(const target of [adapter.PRODUCTION_ID,'postgres','production','PHIHONOFWYERPFGQFEKT','phihonofwyerpfgqfekt ','https://phihonofwyerpfgqfekt.supabase.co',undefined]) {
    assert.throws(()=>adapter.build(target),/Production target|authorized staging/);
  }
  assert.equal(adapter.build(adapter.PROJECT_ID).manifest.projectId,adapter.PROJECT_ID);
});

test('every canonical source and fresh catalog evidence is pinned before compilation',()=>{
  const candidate=adapter.build(adapter.PROJECT_ID);
  for(const file of [...adapter.PINS.map(p=>p.file),candidate.manifest.sourceBaseline.file,candidate.manifest.catalogQuery.file]) {
    assert.throws(()=>adapter.build(adapter.PROJECT_ID,{readFile:relative=>{
      const value=fs.readFileSync(path.join(repo,relative));
      return relative===file?Buffer.concat([value,Buffer.from('\n-- source drift')]):value;
    }}),/Reviewed source drift/);
  }
  assert.equal(candidate.manifest.sources.length,15);
  assert.ok(candidate.manifest.sources.findIndex(s=>s.name==='serialize-agenda-rpc-writes')>candidate.manifest.sources.findIndex(s=>s.name==='live-session-revocation'));
  assert.equal(candidate.manifest.sources.at(-1).sha256,'1462d48079fa232131f1bfa066b34db34876f0eebe62c5b64be93270c26646bf');
});

test('reviewed outer boundaries are removed byte-for-byte while PL/pgSQL bodies and comments survive',()=>{
  const middle="\n/* BEGIN; /* nested COMMIT; */ still comment */\nDO $body$\nBEGIN\n  PERFORM 'COMMIT; ROLLBACK;';\nEND\n$body$;\n";
  const sql='-- review header\nBEGIN;'+middle+'COMMIT; -- review footer\n';
  assert.equal(adapter.stripReviewedWrapper(sql,pin),'-- review header\n'+middle+' -- review footer\n');
  assert.equal(adapter.stripReviewedWrapper('BEGIN READ ONLY;\nSELECT 1;\nROLLBACK;',{...pin,begin:'BEGIN READ ONLY;',end:'ROLLBACK;'}),'\nSELECT 1;\n');
});

test('unexpected or embedded top-level transaction boundaries fail closed',()=>{
  for(const sql of [
    'BEGIN READ WRITE; SELECT 1; COMMIT;',
    'BEGIN; SELECT 1; ROLLBACK;',
    'BEGIN; COMMIT; SELECT 1; COMMIT;',
    'BEGIN; ROLLBACK; SELECT 1; COMMIT;',
    'BEGIN; START TRANSACTION; SELECT 1; COMMIT;',
    'BEGIN; SAVEPOINT retry; SELECT 1; COMMIT;',
    'BEGIN; SET TRANSACTION READ ONLY; SELECT 1; COMMIT;',
    'BEGIN; SELECT 1; COMMIT; SELECT 2;',
  ]) assert.throws(()=>adapter.stripReviewedWrapper(sql,pin));
});

test('a DO/procedure body cannot commit, roll back or start another transaction',()=>{
  for(const control of ['COMMIT','ROLLBACK','ABORT','START TRANSACTION','SAVEPOINT hidden','RELEASE hidden']) {
    assert.throws(()=>adapter.stripReviewedWrapper('BEGIN; DO $body$ BEGIN '+control+'; END $body$; COMMIT;',pin),/Embedded transaction control/);
  }
});

test('unterminated SQL tokens and direct managed Storage data writes are rejected',()=>{
  for(const sql of ["BEGIN; SELECT 'broken; COMMIT;","BEGIN; /* broken COMMIT;","BEGIN; DO $body$ BEGIN NULL; END; COMMIT;"]) {
    assert.throws(()=>adapter.stripReviewedWrapper(sql,pin),/Unterminated/);
  }
  for(const body of ["INSERT INTO storage.buckets(id) VALUES('unsafe');","UPDATE storage.objects SET name='unsafe';","DELETE FROM storage.buckets;","TRUNCATE TABLE storage.objects;"]) {
    assert.throws(()=>adapter.stripReviewedWrapper('BEGIN; '+body+' COMMIT;',pin),/managed Storage write/);
  }
});

test('compiled candidate has exactly one explicit transaction boundary and locks every reviewed application/Auth/Storage relation before rechecking',()=>{
  const {sql,manifest}=adapter.build(adapter.PROJECT_ID);
  const parts=adapter.statements(sql);
  assert.equal(parts.filter(s=>s.clean==='BEGIN;').length,1);
  assert.equal(parts.filter(s=>s.clean==='COMMIT;').length,1);
  assert.equal(parts.filter(s=>/^ROLLBACK\b/.test(s.clean)).length,0);
  assert.equal(parts.at(-1).clean,'COMMIT;');
  assert.equal(manifest.transaction.lockedRelations.length,29);
  assert.deepEqual(manifest.transaction.lockedRelations.filter(x=>x.startsWith('auth.')||x.startsWith('storage.')),['auth.sessions','auth.users','storage.buckets','storage.objects']);
  assert.ok(sql.indexOf('LOCK TABLE')<sql.indexOf('Full reviewed application catalogue fingerprint drift'));
  assert.ok(sql.indexOf('Full reviewed application catalogue fingerprint drift')<sql.indexOf('-- CANONICAL operational-prerequisites'));
  assert.ok(sql.indexOf('Managed callbacks/migration histories/extensions changed')<sql.lastIndexOf('COMMIT;'));
  assert.deepEqual(manifest.requiredBuckets.map(b=>[b.id,b.public,b.fileSizeLimit]),[
    ['clinic-branding',false,5242880],['doctor-avatars',false,5242880],['patient-avatars',false,5242880],['patient-files',false,10485760],
  ]);
  assert.equal(adapter.sha256(sql),manifest.candidateSha256);
  assert.doesNotMatch(sql,/DROP SCHEMA|INSERT INTO storage\.buckets|ALTER FUNCTION[^;]+OWNER TO supabase_admin/i);
});

test('agenda SQL preserves the known trusted service table ACL while denying ordinary direct appointment writes',()=>{
  const authority=fs.readFileSync(path.join(repo,'docs/production/reconciliation/encargo02/forward.sql'),'utf8');
  const delta=fs.readFileSync(path.join(repo,'supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql'),'utf8');
  assert.match(authority,/GRANT ALL ON TABLE %I\.%I TO service_role/);
  for(const privilege of ['INSERT','UPDATE']) {
    assert.ok(delta.includes("OR NOT has_table_privilege('service_role','public.appointments','"+privilege+"')"));
    assert.ok(delta.includes("OR NOT has_column_privilege('service_role','public.appointments',a.attname,'"+privilege+"')"));
  }
  assert.equal((delta.match(/'serviceTableAcl',\(SELECT relacl::text/g)||[]).length,2);
  assert.match(delta,/v_after IS DISTINCT FROM \(SELECT contract FROM pg_temp\.clinia_agenda_contract_before\)/);
  const revoke=adapter.statements(delta).filter(s=>/^REVOKE\b/.test(s.clean));
  assert.equal(revoke.length,1);assert.match(revoke[0].clean,/ON public\.appointments FROM authenticated;/);
  assert.doesNotMatch(revoke[0].clean,/FROM[^;]*service_role/);
  const final=adapter.build(adapter.PROJECT_ID).sql.split('DO $hosted_final$')[1];
  const appointmentCheck=final.slice(final.indexOf("to_regprocedure('public.save_clinic_appointment"),final.indexOf('Final appointment RPC write boundary for ordinary clients differs'));
  assert.match(appointmentCheck,/VALUES \('anon'\),\('authenticated'\)/);
  assert.match(appointmentCheck,/has_any_column_privilege\(ordinary\.role_name,'public\.appointments','INSERT,UPDATE'\)/);
  assert.doesNotMatch(appointmentCheck,/service_role/);
});

test('DDL execution uses the fixed named migration and never fabricates transaction/history or local SQL proof',()=>{
  const candidate=adapter.build(adapter.PROJECT_ID);
  assert.throws(()=>adapter.executionRequest(adapter.PRODUCTION_ID,candidate.manifest.candidateSha256),/Production target/);
  assert.throws(()=>adapter.executionRequest(adapter.PROJECT_ID,'0'.repeat(64)),/Reviewed candidate drift/);
  const request=adapter.executionRequest(adapter.PROJECT_ID,candidate.manifest.candidateSha256);
  assert.deepEqual(Object.keys(request).sort(),['name','project_id','query']);
  assert.equal(request.project_id,adapter.PROJECT_ID);assert.equal(request.query,candidate.sql);
  assert.equal(request.name,'clinia_candidate_20261003');
  assert.equal(candidate.manifest.executionTool,'supabase_apply_migration');
  assert.equal(candidate.manifest.migrationHistory.name,request.name);
  assert.equal(candidate.manifest.validation.localSql,'NOT_RUN');
  assert.equal(candidate.manifest.transaction.toolBoundaryCompatibility,'UNVERIFIED');
  assert.equal(candidate.manifest.transaction.applicationRollbackProof,'NOT_RUN');
  assert.equal(candidate.manifest.migrationHistory.jointAtomicityWithApplicationSql,'UNVERIFIED');
});
