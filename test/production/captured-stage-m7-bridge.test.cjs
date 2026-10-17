'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build,m7Sha256}=require('../../scripts/clinia-captured-stage-m7-bridge.cjs');
const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql'),'utf8');
test('stage bridge is exact-source/exact-target bound and never adds/drops foreign keys',()=>{
  const sql=build('clinia_upgrade_stage_20261002_2',migration);
  assert.ok(sql.includes(m7Sha256));
  assert.match(sql,/current_database\(\)<>'clinia_upgrade_stage_20261002_2'/);
  assert.ok(!/ADD CONSTRAINT|DROP CONSTRAINT|ALTER COLUMN|DROP TABLE|DELETE FROM public\.patients/.test(sql));
  assert.ok(sql.includes('c.confdelsetcols IS DISTINCT FROM'));
  assert.ok(sql.includes('c.confkey IS DISTINCT FROM parent_keys'));
  assert.ok(sql.includes('NOT c.convalidated'));
  assert.ok(sql.includes('Unreviewed captured clinical index'));
  for(const target of ['postgres','clinia_stage_clean','clinia_upgrade_linked_20261002_2','clinia_upgrade_stage_20261002_2;COMMIT'])assert.throws(()=>build(target,migration));
  assert.throws(()=>build('clinia_upgrade_stage_20261002_2',migration+'\n'));
  assert.throws(()=>build('postgres',migration,{cleanManagedProject:'clinia-acceptance'}));
  assert.throws(()=>build('postgres',migration,{cleanManagedProject:'clinia-clean-20261002-1;COMMIT'}));
  const fresh=build('postgres',migration,{cleanManagedProject:'clinia-clean-20261002-1'});
  assert.ok(fresh.includes("current_setting('app.clean_managed_project',true) IS DISTINCT FROM 'clinia-clean-20261002-1'"));
  assert.ok(fresh.includes('EXISTS(SELECT 1 FROM auth.users)'));
});
test('bridge reuses complete reviewed callback and policy tail atomically',()=>{
  const sql=build('clinia_upgrade_stage_20261002_3',migration);
  assert.ok(sql.startsWith('-- Local captured-stage M7 bridge'));
  assert.ok(sql.trimEnd().endsWith('COMMIT;'));
  for(const name of ['security_internal.enforce_clinician_assignment','security_internal.audit_data_rights_status','public.guard_data_rights_request_insert','public.protect_data_rights_requests','logs.log_access_trigger','public.purge_clinic_data'])assert.ok(sql.includes('CREATE OR REPLACE FUNCTION '+name));
  assert.ok(sql.includes('CREATE POLICY "Tenant isolated upload for patient-files"'));
  assert.ok(sql.includes('CREATE POLICY "Clinical staff can view patient files"'));
});
