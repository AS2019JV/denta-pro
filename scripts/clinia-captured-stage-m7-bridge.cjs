'use strict';
// LOCAL bridge for the captured stage's already-installed M7 constraints.
// No historical migration edits, constraint removal, data changes, or remote use.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const m7Sha256='cd6fbf5ab50dc4b214b587febacb7534fb3816b1f0c76767d83aa1b6519ea47d';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const links=[
  ['appointments','appointments_patient_clinic_fkey','patient_id','c'],
  ['prescriptions','prescriptions_patient_clinic_fkey','patient_id','c'],
  ['clinical_records','clinical_records_patient_clinic_fkey','patient_id','a'],
  ['patient_notes','patient_notes_patient_clinic_fkey','patient_id','c'],
  ['patient_files','patient_files_patient_clinic_fkey','patient_id','c'],
  ['hcu033_forms','hcu033_forms_patient_clinic_fkey','patient_id','c'],
  ['data_rights_requests','data_rights_requests_patient_clinic_fkey','patient_id','n'],
  ['billings','billings_patient_clinic_fkey','patient_id','a'],
  ['invoices','invoices_patient_clinic_fkey','patient_id','a'],
  ['patients','patients_family_clinic_fkey','family_representative_id','n'],
];
const indexTables=['appointments','prescriptions','clinical_records','patient_notes','patient_files','data_rights_requests','billings','invoices'];
function build(database,m7,options={}){
  assert.ok(Object.keys(options).every(key=>key==='cleanManagedProject'),'Unknown bridge option');
  let cleanGuard='';
  if(options.cleanManagedProject){
    assert.match(options.cleanManagedProject,/^clinia-clean-20261002-[1-9]$/,'Exact isolated managed project required');
    assert.equal(database,'postgres','Fresh managed primary required');
    cleanGuard=`OR current_setting('app.clean_managed_project',true) IS DISTINCT FROM '${options.cleanManagedProject}'`;
  }else assert.match(database,/^clinia_upgrade_stage_20261002_[1-9]$/,'Exact NEW stage upgrade clone required');
  assert.equal(digest(m7),m7Sha256,'Historical M7 hash changed; review instead of applying bridge');
  const start=m7.indexOf('-- Support tenant-scoped clinical reads');
  const skip=m7.indexOf('-- This legacy marketing table',start);
  const resume=m7.indexOf('-- Assigning a doctor',skip);
  assert.ok(start>0&&skip>start&&resume>skip,'Reviewed M7 sections required');
  const tail=m7.slice(start,skip)+m7.slice(resume);
  assert.ok(!/ADD CONSTRAINT|DROP CONSTRAINT|ALTER COLUMN/.test(tail),'Bridge must not change constraints');
  const expected=links.map(([table,name,column,deletion])=>`('${table}','${name}','${column}','${deletion}')`).join(',\n');
  const indexes=indexTables.map(table=>`('${table}','idx_${table}_clinic_patient')`).join(',\n');
  return `-- Local captured-stage M7 bridge; original migration SHA256 ${m7Sha256}
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL search_path='';
DO $bridge$ BEGIN
  IF current_database()<>'${database}' OR current_user<>'supabase_admin' OR session_user<>'supabase_admin' ${cleanGuard}
    OR current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Exact new local captured-stage clone required'; END IF;
END $bridge$;
${options.cleanManagedProject?`DO $empty$ BEGIN
  IF EXISTS(SELECT 1 FROM public.patients) OR EXISTS(SELECT 1 FROM auth.users)
    OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets)
  THEN RAISE EXCEPTION 'Fresh managed stage bridge requires application/managed actors and objects empty'; END IF;
END $empty$;`:''}
LOCK TABLE public.patients,public.appointments,public.prescriptions,public.clinical_records,
  public.patient_notes,public.patient_files,public.hcu033_forms,public.data_rights_requests,
  public.billings,public.invoices IN ACCESS EXCLUSIVE MODE;
DO $constraints$
DECLARE r record; c pg_catalog.pg_constraint; keys smallint[]; parent_keys smallint[]; null_keys smallint[];
BEGIN
  IF to_regclass('public.loyalty_communications') IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected legacy table in captured stage'; END IF;
  SELECT ARRAY_AGG(attnum ORDER BY array_position(ARRAY['id','clinic_id']::text[],attname::text)) INTO parent_keys
    FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname IN ('id','clinic_id') AND NOT attisdropped;
  SELECT * INTO c FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_id_clinic_id_key';
  IF c.oid IS NULL OR c.contype<>'u' OR c.conkey IS DISTINCT FROM parent_keys OR NOT c.convalidated
    OR c.condeferrable OR c.condeferred OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_index i WHERE i.indexrelid=c.conindid AND i.indisvalid AND i.indisready
        AND i.indisunique AND i.indimmediate AND NOT i.indnullsnotdistinct)
  THEN RAISE EXCEPTION 'Unexpected captured patient composite unique metadata'; END IF;
  FOR r IN SELECT * FROM (VALUES ${expected}) AS expected(table_name,constraint_name,patient_column,delete_action) LOOP
    SELECT ARRAY_AGG(attnum ORDER BY array_position(ARRAY[r.patient_column,'clinic_id']::text[],attname::text)) INTO keys
      FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||r.table_name)
        AND attname::text IN (r.patient_column,'clinic_id') AND NOT attisdropped;
    SELECT ARRAY[attnum] INTO null_keys FROM pg_catalog.pg_attribute
      WHERE attrelid=to_regclass('public.'||r.table_name) AND attname::text=r.patient_column AND NOT attisdropped;
    SELECT * INTO c FROM pg_catalog.pg_constraint
      WHERE conrelid=to_regclass('public.'||r.table_name) AND conname=r.constraint_name;
    IF c.oid IS NULL OR c.contype<>'f' OR c.conkey IS DISTINCT FROM keys
      OR c.confrelid IS DISTINCT FROM 'public.patients'::regclass OR c.confkey IS DISTINCT FROM parent_keys
      OR c.confupdtype<>'a' OR c.confdeltype::text<>r.delete_action OR c.confmatchtype<>'s'
      OR NOT c.convalidated OR c.condeferrable OR c.condeferred
      OR c.confdelsetcols IS DISTINCT FROM (CASE WHEN r.delete_action='n' THEN null_keys ELSE NULL::smallint[] END)
    THEN RAISE EXCEPTION 'Unreviewed captured FK metadata: %',r.constraint_name; END IF;
    IF r.table_name<>'patients' AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid=to_regclass('public.'||r.table_name) AND conname=r.table_name||'_patient_id_fkey')
    THEN RAISE EXCEPTION 'Unexpected legacy patient FK: %',r.table_name; END IF;
  END LOOP;
  FOR r IN SELECT unnest(ARRAY['patients','appointments','prescriptions','hcu033_forms','billings','invoices']) AS table_name LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||r.table_name)
      AND attname='clinic_id' AND attnotnull AND NOT attisdropped)
    THEN RAISE EXCEPTION 'Missing captured tenant NOT NULL: %',r.table_name; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES ${indexes}) AS expected(table_name,index_name) LOOP
    SELECT ARRAY_AGG(attnum ORDER BY array_position(ARRAY['clinic_id','patient_id']::text[],attname::text)) INTO keys
      FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||r.table_name)
        AND attname IN ('clinic_id','patient_id') AND NOT attisdropped;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ci ON ci.oid=i.indexrelid
      JOIN pg_catalog.pg_am am ON am.oid=ci.relam WHERE i.indexrelid=to_regclass('public.'||r.index_name)
      AND i.indrelid=to_regclass('public.'||r.table_name) AND am.amname='btree'
      AND i.indisvalid AND i.indisready AND NOT i.indisunique AND NOT i.indisprimary
      AND i.indnatts=2 AND i.indnkeyatts=2 AND i.indexprs IS NULL AND i.indpred IS NULL
      AND i.indkey::text=array_to_string(keys,' ') AND i.indoption::text='0 0'
      AND i.indcollation::text='0 0')
    THEN RAISE EXCEPTION 'Unreviewed captured clinical index: %',r.index_name; END IF;
  END LOOP;
END $constraints$;
${tail}`;
}
module.exports={build,m7Sha256};
