'use strict';
// Pure guarded transaction builder. No SQL connections, env/credentials or local fixture markers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'docs/production/migration-package/hosted-v2');
const {statements}=require('./prepare-clinia-hosted-staging.cjs'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const read=n=>fs.readFileSync(path.join(DIR,n),'utf8'),json=n=>JSON.parse(read(n));
const denied=new Set(['phihonofwyerpfgqfekt','leqsrfyjvuxxdsubjjin']);
function verify(){const m=json('manifest.json');assert.equal(m.baseCandidate,'17837fdbd6700f9c7943583dbd2b4620c6b057d2');for(const x of m.files)assert.equal(sha(read(x.file)),x.sha256,x.file);return m;}
// Approval records cannot include the manifest that contains their own digest.
// Bind executable content independently; destination/approval registry stays separately pinned.
function payloadCode(){
 const closed=['clinia-hosted-successor.cjs','execute-clinia-hosted-successor.cjs','clinia-restore-owner-acls.cjs','prepare-clinia-hosted-staging.cjs','clinia-migration-package.cjs','clinia-captured-stage-m7-bridge.cjs','compare-supabase-catalogs.cjs'].sort();
 return closed.map(file=>{const text=fs.readFileSync(path.join(ROOT,'scripts',file),'utf8').replaceAll('\r\n','\n');const calls=[...text.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g)];assert.equal(calls.length,[...text.matchAll(/\brequire\s*\(/g)].length,'Dynamic dependency refused');for(const x of calls){if(x[2].startsWith('node:'))continue;assert.ok(x[2].startsWith('./')&&closed.includes(x[2].slice(2)),'Unpinned executable dependency: '+x[2]);}return {file,sha256:sha(text),normalization:'UTF8_CRLF_TO_LF'};});
}
function payloadSha256(){const m=verify();return sha(JSON.stringify({baseCandidate:m.baseCandidate,sources:m.sources,files:m.files.filter(x=>x.file!=='hosted-targets.json'),code:payloadCode()}));}
function validateTarget(t){
 verify();
 assert.equal(t.isolated,true,'Isolated destination attestation required');assert.ok(!denied.has(t.project),'Shared project is prohibited');
 assert.ok(['local-disposable','hosted-isolated'].includes(t.kind));assert.match(t.project,t.kind==='local-disposable'?/^clinia-clean-20261002-[6789]$/:/^[a-z]{20}$/);
 assert.equal(t.database,'postgres');assert.equal(t.executorRole,'postgres');assert.equal(t.syntheticOnly,true,'Real clinical data import is outside this rehearsal');
 assert.match(t.serverSystemIdentifier,/^[0-9]{10,25}$/,'Actual server identity required');
 if(t.kind==='hosted-isolated'){
  const registered=json('hosted-targets.json').targets.find(x=>x.project===t.project);assert.ok(registered,'Hosted project not independently registered; default deny');
  assert.equal(t.host,registered.host);assert.equal(t.serverSystemIdentifier,registered.serverSystemIdentifier);assert.match(registered.managementEvidenceSha256,/^[a-f0-9]{64}$/);assert.match(registered.privilegeReviewEvidenceSha256,/^[a-f0-9]{64}$/);assert.equal(t.executorRole,registered.executorRole);
  assert.equal(t.host,'db.'+t.project+'.supabase.co');assert.equal(t.sslmode,'verify-full');
 }
}
function validateHostedRead(t,a){validateTarget(t);assert.equal(t.kind,'hosted-isolated');const r=json('hosted-targets.json').targets.find(x=>x.project===t.project);assert.ok(['APPROVED_ISOLATED_READ','APPROVED_ISOLATED_CHANGE'].includes(a.status));assert.equal(a.project,t.project);assert.equal(sha(JSON.stringify(a)),r.readApprovalSha256,'Exact separately approved read scope required');}
function validateAuthorization(t,a,r){
 validateTarget(t);assert.equal(a.project,t.project);assert.equal(a.status,t.kind==='local-disposable'?'LOCAL_REHEARSAL_AUTHORIZED':'APPROVED_ISOLATED_CHANGE');
 assert.equal(a.acceptsUnknownProvenance,false,'Risk acceptance is separate and cannot be implied by execution');
 if(t.kind==='hosted-isolated')assert.equal(a.packagePayloadSha256,payloadSha256(),'Approved executable content differs');else assert.equal(a.packageManifestSha256,sha(read('manifest.json')));
 if(t.kind==='hosted-isolated'){const registered=json('hosted-targets.json').targets.find(x=>x.project===t.project);assert.equal(sha(JSON.stringify(a)),registered.changeApprovalSha256,'Exact separately approved change scope required');}
 assert.equal(typeof r.evidenceText,'string','Recovery receipt bytes required');assert.equal(sha(r.evidenceText),r.evidenceSha256,'Recovery receipt digest differs');
 const evidence=JSON.parse(r.evidenceText);for(const field of ['project','status','baselineCatalogSha256','verifiedAt'])assert.equal(r[field],evidence[field],'Recovery receipt field differs: '+field);
 assert.equal(r.project,t.project);assert.equal(r.status,'PASS_FULL_SYNTHETIC_RECOVERY');assert.equal(r.baselineCatalogSha256,sha(read('baseline-upgrade.json')));assert.match(r.evidenceSha256,/^[a-f0-9]{64}$/);
 if(t.kind==='hosted-isolated'){const registered=json('hosted-targets.json').targets.find(x=>x.project===t.project);assert.equal(r.evidenceSha256,registered.recoveryEvidenceSha256,'Recovery evidence not independently registered');assert.equal(a.recoveryEvidenceSha256,r.evidenceSha256,'Recovery evidence not explicitly approved');}
 assert.ok(Date.now()-Date.parse(r.verifiedAt)>=0&&Date.now()-Date.parse(r.verifiedAt)<30*60*1000,'Fresh recovery prerequisite required');
}
function catalogGuard(expected,label){
 const select=read('catalog.sql').trim().replace(/;$/,'');
 // Compare every field. Top-level catalog rows and ACL/config sets have no ordering contract;
 // enum labels/argument types and all other arrays remain ordered. No identity is omitted.
 return `SET LOCAL search_path=pg_catalog,public,extensions; DO $catalog_guard$
 DECLARE actual jsonb; expected jsonb := ${quote(JSON.stringify(expected))}::jsonb;
 n_doc jsonb; n_row jsonb; n_rows jsonb; n_value jsonb; n_section record; n_field record; n_i integer;
 BEGIN SELECT catalog INTO actual FROM (${select}) snapshot;
 FOR n_i IN 0..1 LOOP
 n_doc:=CASE WHEN n_i=0 THEN actual ELSE expected END;
 FOR n_section IN SELECT key,value FROM jsonb_each(n_doc) LOOP
 IF jsonb_typeof(n_section.value)='array' THEN
 n_rows:='[]'::jsonb;
 FOR n_row IN SELECT value FROM jsonb_array_elements(n_section.value) LOOP
 FOR n_field IN SELECT key,value FROM jsonb_each(n_row) LOOP
 n_value:=n_field.value;
 IF jsonb_typeof(n_value)='string' THEN
 n_value:=to_jsonb(replace(n_value#>>'{}',E'\\r\\n',E'\\n'));
 IF n_field.key IN ('acl','roles') AND (n_value#>>'{}') ~ '^\\{[^{}]*\\}$' THEN
 SELECT to_jsonb('{'||coalesce(string_agg(v,',' ORDER BY v COLLATE "C"),'')||'}') INTO n_value
 FROM unnest(string_to_array(trim(both '{}' FROM n_value#>>'{}'),',')) v WHERE v<>'';
 END IF;
 ELSIF jsonb_typeof(n_value)='array' AND n_field.key IN ('config','options','allowed_mime_types') THEN
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_value FROM jsonb_array_elements(n_value);
 END IF;
 n_row:=jsonb_set(n_row,ARRAY[n_field.key],n_value);
 END LOOP;
 n_rows:=n_rows||jsonb_build_array(n_row);
 END LOOP;
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_rows FROM jsonb_array_elements(n_rows);
 n_doc:=jsonb_set(n_doc,ARRAY[n_section.key],n_rows);
 END IF;
 END LOOP;
 IF n_i=0 THEN actual:=n_doc; ELSE expected:=n_doc; END IF;
 END LOOP;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '${label}' USING ERRCODE='P0001'; END IF; END $catalog_guard$;`;
}
function compile(t,a,recovery,ending='commit'){
 verify();validateAuthorization(t,a,recovery);assert.ok(['commit','rollback','fail'].includes(ending));
 const baseline=json('baseline-upgrade.json'),expected=json('expected-upgrade.json');
 let sql=`BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='90s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog;\n`;
 sql+=`DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR (SELECT system_identifier::text FROM pg_catalog.pg_control_system())<>${quote(t.serverSystemIdentifier)} OR current_setting('transaction_read_only')<>'off' THEN RAISE EXCEPTION 'GATE3_DESTINATION_IDENTITY_REFUSED'; END IF; END $identity$;\nSELECT pg_catalog.pg_advisory_xact_lock(731926,17837);\n`;
 const tables=baseline.tables.filter(x=>['r','p'].includes(x.kind)).map(x=>'"'+x.schema+'"."'+x.name+'"');assert.ok(tables.length>0);sql+='LOCK TABLE '+tables.join(',')+' IN SHARE ROW EXCLUSIVE MODE;\n';
 sql+=catalogGuard(baseline,'GATE3_BASELINE_DRIFT_REFUSED')+'\n';
 sql+=`DO $data_guard$ DECLARE invariants jsonb; BEGIN SELECT result INTO invariants FROM (${read('invariants.sql').trim().replace(/;$/,'')}) counts; IF EXISTS(SELECT FROM jsonb_each_text(invariants) value WHERE value.value::bigint<>0) THEN RAISE EXCEPTION 'GATE3_DATA_INVARIANTS_REFUSED'; END IF; IF (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND NOT public)<>4 OR EXISTS(SELECT FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'GATE3_PRIVATE_STORAGE_PRECONDITION_REFUSED'; END IF; END $data_guard$;\n`;
 sql+=read('forward.sql')+'\n'+catalogGuard(expected,'GATE3_POSTCONTRACT_REFUSED')+'\n';
 if(ending==='fail')sql+="DO $failure$ BEGIN RAISE EXCEPTION 'GATE3_EXPECTED_AFTER_ALL_DDL_FAILURE'; END $failure$;\n";
 const parsed=statements(sql);assert.equal(parsed.filter(x=>x.clean==='BEGIN;').length,1);assert.ok(!parsed.some(x=>/^(COMMIT|ROLLBACK|ABORT|START TRANSACTION)\b/i.test(x.clean)));assert.ok(!/SET(?: LOCAL)? app\.(?:scoped_fixture_authorized|clean_managed_project|encargo02_authorized|operational_convergence_authorized)\b/i.test(sql));
 sql+=ending==='rollback'?'ROLLBACK;':'COMMIT;';return {sql,sha256:sha(sql),manifestSha256:sha(read('manifest.json')),expected};
}
module.exports={verify,payloadCode,payloadSha256,validateTarget,validateHostedRead,validateAuthorization,compile,catalogGuard,sha,DIR};
if(require.main===module){assert.equal(process.argv[2],'verify','Only offline verify exposed. Target/execution transport must independently prove destination and approvals.');console.log(JSON.stringify({status:'PASS_HOSTED_SUCCESSOR_PINS',files:verify().files.length}));}
