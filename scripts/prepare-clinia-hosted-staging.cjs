'use strict';
// Pure, target-bound compiler. This file never reads credentials or executes SQL.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const REPO = path.resolve(__dirname, '..');
const PROJECT_ID = 'phihonofwyerpfgqfekt';
const PRODUCTION_ID = 'leqsrfyjvuxxdsubjjin';
const MIGRATION_NAME = 'clinia_candidate_20261003';
const DIRECTORY = 'docs/production/reconciliation/hosted-staging';
const BASELINE_SHA256 = 'e964ffcb4c85d3e2be881bf35733e4eb1e87c1d1be1a88482b3e1572e7af197d';
const CATALOG_QUERY_SHA256 = 'd3ba91cecb5971818b5f7061b4a6d831893f209116e24eadb1172cc8f6c7abdc';
const PINS = [
  {
    "name": "operational-prerequisites",
    "file": "docs/production/reconciliation/operational-convergence/before-authority.sql",
    "sha256": "0fc3357fff3c8108099f90c952b4387874e689cbfafce9648f892d1c838418d9",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "authority",
    "file": "docs/production/reconciliation/encargo02/forward.sql",
    "sha256": "52193473664922ed94608b9c8e344b22ae166bf5ac5f64d140f548ff8b1a1077",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "operational-callbacks",
    "file": "docs/production/reconciliation/operational-convergence/after-authority.sql",
    "sha256": "7d90f08e37ad22c41ff5f082038da0582c0afde0d5c84def0e7e3cf318d001e5",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "agenda",
    "file": "tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql",
    "sha256": "79436969fe001c355fbdc3a8d807add8cad0b2f090eefbbb6882cc69c6535b41",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "reports",
    "file": "tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql",
    "sha256": "5d09791fb55c45f55972faa2432f58159523c882f89d6e6edd1f89b6b4d1ed4f",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "canonical-catalog",
    "file": "docs/production/reconciliation/final-contract/verify.sql",
    "sha256": "47df20b80c0661493d7d8e19ed5d77e144877b607c4e7672b85dde51b97ec3fe",
    "begin": "BEGIN READ ONLY;",
    "end": "ROLLBACK;"
  },
  {
    "name": "canonical-boundaries",
    "file": "docs/production/reconciliation/operational-convergence/verify-boundaries.sql",
    "sha256": "79a5f2b8aada22b4a5fca7cb1fcb92d1e2205e0de6f4dee5d37f66fe6b8e0b97",
    "begin": "BEGIN READ ONLY;",
    "end": "ROLLBACK;"
  },
  {
    "name": "pending-invitations",
    "file": "supabase/migrations/20261001120000_invitation_pending_reservation.sql",
    "sha256": "c436b9e2d814374e373dd27fb42b437f0e1eaa1599dd9ea6a728fa2d8d2b3ac4",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "durable-email",
    "file": "supabase/migrations/20261001130000_durable_email_abuse_budget.sql",
    "sha256": "5d6a85b96033fc74ee32ff3cb882dc6b78e03b7a0ac0acbb8d145ee23cdce21f",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "profile-guard",
    "file": "supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql",
    "sha256": "a89bf8fcfb8be928f73ad4b3e25dc2862d43ad9684def34aa60ae614c684c5bb",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "live-session-revocation",
    "file": "supabase/migrations/20261002180423_live_session_revocation.sql",
    "sha256": "9e9e28f2b8871c5218a19b84918974061541808b141279d6b0fab7f666af0c9d",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "serialize-agenda-rpc-writes",
    "file": "supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql",
    "sha256": "21e299752fb9db44859911ccd568e21b9e715237225323620e52c34f985518b9",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "trusted-enrollment",
    "file": "supabase/migrations/20261002180800_trusted_enrollment.sql",
    "sha256": "bcc0c79413c07f78be13de15c6d11f324e0a538084e8e7ee1e60c39c482c67f3",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "immutable-prescription",
    "file": "supabase/migrations/20261002231730_immutable_prescription_receipts.sql",
    "sha256": "da6c2212eb85989ef891a9251e3f4ad0519b9de97f683ae3e5b73b4a0ba268d8",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  },
  {
    "name": "prescription-request-ids",
    "file": "supabase/migrations/20261002234427_enable_prescription_request_ids.sql",
    "sha256": "1462d48079fa232131f1bfa066b34db34876f0eebe62c5b64be93270c26646bf",
    "begin": "BEGIN;",
    "end": "COMMIT;"
  }
];
const BUCKETS = [
  ...['clinic-branding','doctor-avatars','patient-avatars'].map(id => ({id,name:id,public:false,fileSizeLimit:5242880,allowedMimeTypes:['image/jpeg','image/png','image/webp']})),
  {id:'patient-files',name:'patient-files',public:false,fileSizeLimit:10485760,allowedMimeTypes:['application/pdf','image/jpeg','image/png','image/webp']},
];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sqlLiteral = value => "'" + String(value).replace(/'/g,"''") + "'";
const identifier = value => '"' + String(value).replace(/"/g,'""') + '"';
function assertTarget(projectId) {
  assert.notEqual(projectId,PRODUCTION_ID,'Production target is explicitly denied');
  assert.equal(projectId,PROJECT_ID,'Only the explicitly authorized staging project is allowed');
}
function readPinned(relative,expected,readFile) {
  const bytes = readFile(relative);
  assert.equal(sha256(bytes),expected,'Reviewed source drift: '+relative);
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  assert.ok(!text.includes('\u0000'),'NUL byte in reviewed SQL');
  return text;
}
// Split only SQL statement boundaries outside comments, strings, identifiers and
// dollar-quoted bodies. Regex replacement of BEGIN/COMMIT is unsafe for PL/pgSQL.
function statements(sql,allowTail=false) {
  const result = [];
  let start = 0, i = 0, cleaned = '', tokenStart;
  function quoted(close,escape) {
    const begin = i++;
    while(i<sql.length) {
      if(escape && sql[i]==='\\') {i+=2;continue;}
      if(sql[i]===close) {if(sql[i+1]===close) {i+=2;continue;} i++;return sql.slice(begin,i);}
      i++;
    }
    throw Error('Unterminated SQL quote');
  }
  while(i<sql.length) {
    if(sql.startsWith('--',i)) {const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end;cleaned+=' ';continue;}
    if(sql.startsWith('/*',i)) {let depth=1;i+=2;while(i<sql.length && depth){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}assert.equal(depth,0,'Unterminated SQL comment');cleaned+=' ';continue;}
    if(tokenStart===undefined && !/\s/.test(sql[i])) tokenStart=i;
    if(sql[i]==="'") {quoted("'",/[Ee]$/.test(cleaned));cleaned+='<literal>';continue;}
    if(sql[i]==='"') {cleaned+=quoted('"',false);continue;}
    if(sql[i]==='$') {
      const tag=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
      if(tag) {
        const bodyStart=i+tag.length,end=sql.indexOf(tag,bodyStart);
        assert.ok(end>=0,'Unterminated SQL dollar quote');
        const body=sql.slice(bodyStart,end);
        // Procedures and DO bodies cannot escape the release transaction.
        for(const inner of statements(body,true)) assert.ok(!/(?:^|[\s;])(?:COMMIT|ROLLBACK|ABORT|SAVEPOINT|RELEASE)(?:[\s;]|$)|(?:^|[\s;])START\s+TRANSACTION\b/i.test(inner.clean),'Embedded transaction control rejected');
        cleaned+=tag+'<reviewed-body>'+tag;i=end+tag.length;continue;
      }
    }
    if(sql[i]===';') {result.push({start,tokenStart,end:i+1,clean:(cleaned+';').trim()});start=i+1;cleaned='';tokenStart=undefined;i++;continue;}
    cleaned+=sql[i++];
  }
  if(allowTail && cleaned.trim()) result.push({start,tokenStart,end:sql.length,clean:cleaned.trim()});
  else assert.equal(cleaned.trim(),'','Trailing SQL without semicolon');
  return result;
}
function stripReviewedWrapper(sql,pin) {
  const parts=statements(sql);
  assert.ok(parts.length>=2,'Reviewed outer transaction missing: '+pin.file);
  assert.equal(parts[0].clean,pin.begin,'Unexpected reviewed BEGIN: '+pin.file);
  assert.equal(parts.at(-1).clean,pin.end,'Unexpected reviewed transaction ending: '+pin.file);
  for(const statement of parts.slice(1,-1)) {
    assert.ok(!/^(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION|SET\s+TRANSACTION|SET\s+SESSION\s+CHARACTERISTICS)\b/i.test(statement.clean),'Embedded transaction boundary rejected: '+pin.file);
    assert.ok(!/^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|COPY)\s+["']?storage["']?\./i.test(statement.clean),'Direct managed Storage write rejected');
  }
  // Remove only the exact first/last parsed statements; every interior byte stays.
  return sql.slice(0,parts[0].tokenStart)+sql.slice(parts[0].end,parts.at(-1).tokenStart)+sql.slice(parts.at(-1).end);
}
const bucketExpression = `(SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'public',b.public,'fileSizeLimit',b.file_size_limit,'allowedMimeTypes',(SELECT jsonb_agg(m ORDER BY m) FROM unnest(b.allowed_mime_types) m)) ORDER BY b.id),'[]') FROM storage.buckets b)`;
const managedExpression = `(SELECT jsonb_build_object(
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'identity',p.oid::regprocedure::text,'definitionMd5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage') AND p.prokind='f'),
  'authVersions',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM auth.schema_migrations),
  'storageVersions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'hash',hash) ORDER BY id),'[]') FROM storage.migrations),
  'extensions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname),'[]') FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname<>'btree_gist')
))`;
const allowed = [
  'public.get_clinic_member_role(uuid)','public.is_clinic_member(uuid)','public.get_user_clinic_id()','public.check_subscription_active(uuid)',
  'public.get_patient_demographics(uuid,text,integer,integer,uuid)','public.save_patient_demographics(uuid,jsonb,uuid)',
  'public.get_clinic_staff_directory(uuid)','public.get_clinic_schedule(uuid,timestamptz,timestamptz)','public.save_clinic_appointment(uuid,jsonb,uuid)',
  'public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid)','public.remove_clinic_member(uuid,uuid)',
  'public.encargo02_storage_access(text,text,boolean)','public.encargo02_storage_replace_allowed(text,text)',
  'public.get_clinic_operational_report(uuid,timestamptz,timestamptz)','public.clinia_session_active()',
  'public.complete_verified_clinic_registration()','public.redeem_verified_clinic_invitation(text)',
];
function emptyAssertion() {
  return `FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p') AND NOT c.relispartition
    ORDER BY n.nspname,c.relname LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I',r.nspname,r.relname) INTO row_count;
    IF row_count<>0 THEN RAISE EXCEPTION 'Application target occupied: %.%',r.nspname,r.relname; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM auth.sessions) OR EXISTS(SELECT 1 FROM storage.objects)
  THEN RAISE EXCEPTION 'Managed Auth/Storage target occupied'; END IF;
  IF ${bucketExpression} IS DISTINCT FROM ${sqlLiteral(JSON.stringify(BUCKETS))}::jsonb
  THEN RAISE EXCEPTION 'Reviewed four private API-created buckets required'; END IF;`;
}
function finalAssertions() {
  return `SET LOCAL search_path='';
DO $hosted_final$
DECLARE r record; row_count bigint; v_allowed text[]:=ARRAY[${allowed.map(sqlLiteral).join(',')}]; identity text;
BEGIN
  ${emptyAssertion()}
  IF ${managedExpression} IS DISTINCT FROM current_setting('app.hosted_managed_before')::jsonb
  THEN RAISE EXCEPTION 'Managed callbacks/migration histories/extensions changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='btree_gist' AND e.extversion='1.7' AND n.nspname='extensions')
  THEN RAISE EXCEPTION 'Reviewed agenda btree_gist prerequisite differs'; END IF;
  FOREACH identity IN ARRAY v_allowed LOOP
    IF to_regprocedure(identity) IS NULL OR NOT has_function_privilege('authenticated',to_regprocedure(identity),'EXECUTE')
    THEN RAISE EXCEPTION 'Final exact public contract missing: %',identity; END IF;
  END LOOP;
  FOR r IN SELECT p.oid,n.nspname,p.proname,p.proowner,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    IF pg_get_userbyid(r.proowner)<>'postgres' OR has_function_privilege('anon',r.oid,'EXECUTE')
    THEN RAISE EXCEPTION 'Final callback owner/anonymous boundary differs: %.%',r.nspname,r.proname; END IF;
    IF has_function_privilege('authenticated',r.oid,'EXECUTE') AND (r.oid NOT IN (SELECT to_regprocedure(x) FROM unnest(v_allowed) x)
      OR NOT r.prosecdef OR r.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[])
    THEN RAISE EXCEPTION 'Final authenticated callback boundary differs: %.%',r.nspname,r.proname; END IF;
  END LOOP;
  FOR r IN SELECT c.oid,n.nspname,c.relname,c.relkind,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m') LOOP
    IF r.relkind IN ('r','p') AND NOT r.relrowsecurity THEN RAISE EXCEPTION 'Final RLS absent: %.%',r.nspname,r.relname; END IF;
    IF r.relkind IN ('v','m') AND (has_any_column_privilege('anon',r.oid,'SELECT') OR has_any_column_privilege('authenticated',r.oid,'SELECT'))
    THEN RAISE EXCEPTION 'Final client view access leaked: %.%',r.nspname,r.relname; END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role','public.consume_email_abuse_budget(text,text,text,uuid,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.consume_email_abuse_budget(text,text,text,uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Final server-only email/enrollment contract differs'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.save_clinic_appointment(uuid,jsonb,uuid)')
    AND md5(regexp_replace(p.prosrc,'\\s+','','g'))='caae0bd668648dac2b32686b658be02d')
    OR EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated')) ordinary(role_name)
      WHERE has_any_column_privilege(ordinary.role_name,'public.appointments','INSERT,UPDATE')
        OR has_table_privilege(ordinary.role_name,'public.appointments','INSERT,UPDATE,DELETE'))
  THEN RAISE EXCEPTION 'Final appointment RPC write boundary for ordinary clients differs'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('security_internal.freeze_prescription_receipt()')
    AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
    AND md5(regexp_replace(p.prosrc,'\\s+','','g'))='991bb0106792a1323e357dcc3e3cf1b7')
    OR NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.prescriptions'::regclass AND t.tgname='freeze_prescription_receipt'
      AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgtype=31 AND t.tgfoid=to_regprocedure('security_internal.freeze_prescription_receipt()'))
    OR NOT has_column_privilege('authenticated','public.prescriptions','id','INSERT')
    OR has_table_privilege('authenticated','public.prescriptions','INSERT,UPDATE,DELETE')
    OR has_any_column_privilege('authenticated','public.prescriptions','UPDATE')
    OR has_column_privilege('authenticated','public.prescriptions','issuance_snapshot','INSERT,UPDATE')
    OR has_column_privilege('authenticated','public.prescriptions','created_at','INSERT,UPDATE')
  THEN RAISE EXCEPTION 'Final immutable prescription/request ID boundary differs'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'encargo02_storage_%')<>4
    OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname NOT LIKE 'encargo02_storage_%')
  THEN RAISE EXCEPTION 'Final Storage policy contract differs'; END IF;
END $hosted_final$;
SELECT 'HOSTED_STAGING_CANONICAL_CATALOG_VERIFIED_EMPTY_API_JWT_PENDING' AS status;
COMMIT;
`;
}
function build(projectId,options={}) {
  assertTarget(projectId);
  const readFile=options.readFile || (relative=>fs.readFileSync(path.join(REPO,relative)));
  const baselineText=readPinned(DIRECTORY+'/reviewed-baseline.json',BASELINE_SHA256,readFile);
  const baseline=JSON.parse(baselineText);
  assert.equal(baseline.projectId,PROJECT_ID);
  assert.equal(baseline.catalog.currentUser,'postgres');assert.equal(baseline.catalog.sessionUser,'postgres');
  assert.equal(baseline.catalog.database,'postgres');assert.equal(baseline.catalog.serverVersion,'170006');
  assert.equal(baseline.fingerprint,'9d8904994ae7c61150d9b4d3b5ca9ec3');
  const query=readPinned(DIRECTORY+'/catalog-query.sql',CATALOG_QUERY_SHA256,readFile).trim();
  const material=PINS.map(pin=>{
    const original=readPinned(pin.file,pin.sha256,readFile);
    const body=stripReviewedWrapper(original,pin);
    return {pin,body,bodySha256:sha256(body)};
  });
  const appTables=baseline.catalog.tables.filter(t=>['r','p'].includes(t.kind));
  const locked=[['auth','sessions'],['auth','users'],...appTables.map(t=>[t.schema,t.name]),['storage','buckets'],['storage','objects']]
    .sort((a,b)=>a.join('.').localeCompare(b.join('.'),'en'));
  const inventory=appTables.map(t=>t.schema+'.'+t.name).sort();
  const sql=`-- HOSTED STAGING ONLY. Identity comes from the fixed MCP project_id, never a GUC.
-- Preserve the canonical source hashes and the reviewed catalogue baseline.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
SET LOCAL search_path='';
LOCK TABLE ${locked.map(([schema,name])=>identifier(schema)+'.'+identifier(name)).join(', ')} IN ACCESS EXCLUSIVE MODE;
DO $hosted_preflight$
DECLARE r record; row_count bigint; actual jsonb;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
    OR current_setting('server_version_num')<>'170006'
  THEN RAISE EXCEPTION 'Reviewed PostgreSQL17.6 postgres executor required'; END IF;
  IF (SELECT coalesce(jsonb_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p') AND NOT c.relispartition)
      IS DISTINCT FROM ${sqlLiteral(JSON.stringify(inventory))}::jsonb
  THEN RAISE EXCEPTION 'Reviewed application relation inventory drift'; END IF;
  ${emptyAssertion()}
  SELECT catalog INTO actual FROM (${query}) reviewed;
  IF md5(actual::text)<>${sqlLiteral(baseline.fingerprint)}
  THEN RAISE EXCEPTION 'Full reviewed application catalogue fingerprint drift'; END IF;
END $hosted_preflight$;
SELECT set_config('app.hosted_managed_before',${managedExpression}::text,true);
-- Compatibility switches satisfy frozen local-era source guards. They do not prove target identity.
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
SET LOCAL app.encargo02_authorized='reviewed-local-forward';
SET LOCAL app.operational_convergence_authorized='reviewed-local-contract';
${material.map(m=>'\n-- CANONICAL '+m.pin.name+' SHA256 '+m.pin.sha256+'\n'+m.body).join('\n')}
${finalAssertions()}`;
  const manifest={
    status:'PREPARED_FOR_INDEPENDENT_REVIEW_HOSTED_EXECUTION_UNVERIFIED',projectId:PROJECT_ID,projectName:'cliniaplus-staging',
    explicitlyDeniedProjectId:PRODUCTION_ID,executionTool:'supabase_apply_migration',migrationName:MIGRATION_NAME,executorIdentity:'fixed tool argument project_id',
    sourceBaseline:{file:DIRECTORY+'/reviewed-baseline.json',sha256:BASELINE_SHA256,catalogFingerprint:baseline.fingerprint,capturedAt:baseline.capturedAt},
    catalogQuery:{file:DIRECTORY+'/catalog-query.sql',sha256:CATALOG_QUERY_SHA256},
    transaction:{beginCount:1,commitCount:1,embeddedBoundaries:0,lockMode:'ACCESS EXCLUSIVE',lockedRelations:locked.map(t=>t.join('.')),
      explicitOuterBoundariesPreserved:true,toolBoundaryCompatibility:'UNVERIFIED',applicationRollbackProof:'NOT_RUN',
      assessment:'The reviewed SQL has one explicit BEGIN/COMMIT. Official MCP client forwards this query unchanged to the hosted migrations endpoint. Backend transaction wrapping and migration-history insertion are not visible in that client; terminal COMMIT might end a tool-owned transaction. No hosted rollback or joint SQL/history atomicity is claimed.'},
    migrationHistory:{owner:'supabase_apply_migration',name:MIGRATION_NAME,version:'TOOL_ASSIGNED',expectedNewNamedEntries:1,readback:'REQUIRED_AFTER_EXECUTION',jointAtomicityWithApplicationSql:'UNVERIFIED'},
    validation:{compilerTests:'SEPARATE_TEST_OUTPUT',localSql:'NOT_RUN',hostedSql:'NOT_RUN',hostedMigrationHistory:'NOT_READ_AFTER_EXECUTION'},
    requiredBuckets:BUCKETS,sources:material.map(({pin,bodySha256})=>({...pin,strippedBodySha256:bodySha256})),
    candidateSha256:sha256(sql),
    limits:['Compiler never reads credentials, calls remote tools, resets public, imports captures, repairs M7 owners, or writes Storage metadata',
      'Bucket creation is a separately reviewed official Storage API operation',
      'Candidate includes the reviewed prospective agenda delta; compiler validation is not actual SQL execution proof',
      'Local SQL validation is pending and is not an additional authorization requirement; execute only against the already authorized fixed staging project',
      'Explicit BEGIN/COMMIT and the apply_migration client contract do not prove rollback behavior or atomicity with migration-history writes; inspect catalog and named history entry after the first tool result, including errors',
      'SQL catalogue success does not prove ordinary JWT/API authorization or production readiness']
  };
  const top=statements(sql);
  assert.equal(top.filter(s=>/^BEGIN;$/i.test(s.clean)).length,1);
  assert.equal(top.filter(s=>/^COMMIT;$/i.test(s.clean)).length,1);
  assert.ok(!top.some(s=>/^ROLLBACK\b/i.test(s.clean)));
  return {sql,manifest};
}
function executionRequest(projectId,candidateSha256) {
  assertTarget(projectId);
  const candidate=build(projectId);
  assert.equal(candidate.manifest.candidateSha256,candidateSha256,'Reviewed candidate drift');
  return {project_id:PROJECT_ID,name:MIGRATION_NAME,query:candidate.sql};
}
function write(projectId) {
  const candidate=build(projectId);
  const directory=path.join(REPO,DIRECTORY);fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'candidate.sql'),candidate.sql);
  fs.writeFileSync(path.join(directory,'candidate-manifest.json'),JSON.stringify(candidate.manifest,null,2)+'\n');
  return {status:candidate.manifest.status,projectId:PROJECT_ID,candidateSha256:candidate.manifest.candidateSha256,sourceCount:PINS.length};
}
if(require.main===module) {
  try {assert.equal(process.argv.length,3);console.log(JSON.stringify(write(process.argv[2])));}
  catch(error) {console.error(error.message);process.exitCode=1;}
}
module.exports={PROJECT_ID,PRODUCTION_ID,MIGRATION_NAME,PINS,BUCKETS,sha256,assertTarget,statements,stripReviewedWrapper,build,executionRequest,write};
