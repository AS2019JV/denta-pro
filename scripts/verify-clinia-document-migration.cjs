'use strict';
// Rollback-only upgrade/SQL-role proof on the owned synthetic clean database.
// Does not configure hosted Auth, execute HTTP Storage, or retain any JWT.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const api=require('./clinia-clean-api.cjs'),local=require('./clinia-local-runtime.cjs');
const {stripReviewedWrapper,statements}=require('./prepare-clinia-hosted-staging.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const MIGRATIONS=Object.freeze(['supabase/migrations/20261004022340_clinical_document_delivery.sql',
  'supabase/migrations/20261004220500_document_delivery_info_operation.sql']);
const emptyRegistry=`
DO $document_chain_registry$ BEGIN
  IF (SELECT count(*) FROM security_internal.document_delivery_principals)<>0
    OR EXISTS(SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
  THEN RAISE EXCEPTION 'Expected empty disabled delivery registry in prospective chain'; END IF;
END $document_chain_registry$;
`;
const humanRestriction=`
DO $document_chain_human_policy$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='clinia_no_human_clinical_object_read' AND cmd='SELECT' AND permissive='RESTRICTIVE'
    AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
  THEN RAISE EXCEPTION 'Exact human patient-files restriction changed'; END IF;
END $document_chain_human_policy$;
`;
function migrationChain(readFile=relative=>fs.readFileSync(path.join(local.repo,relative))){
  const sources=MIGRATIONS.map(file=>{
    const bytes=readFile(file),body=stripReviewedWrapper(bytes.toString('utf8'),{file,begin:'BEGIN;',end:'COMMIT;'});
    return {file,sha256:sha(bytes),bodySha256:sha(body),body};
  });
  const sql='BEGIN;\nSET LOCAL ROLE postgres;\n'+sources[0].body+emptyRegistry+humanRestriction+sources[1].body+emptyRegistry+humanRestriction;
  const parts=statements(sql);
  assert.equal(parts.filter(item=>item.clean==='BEGIN;').length,1,'One outer transaction required');
  assert.ok(parts.every(item=>! /^(?:COMMIT|ROLLBACK|ABORT|START\s+TRANSACTION)\b/i.test(item.clean)),'Early transaction exit refused');
  return {sql,sha256:sha(sql),sources:sources.map(({body,...metadata})=>metadata)};
}
async function main(attempt){
  assert.match(attempt||'',/^[1-9]$/,'Fresh attempt 1..9 required');
  const variant='clean-managed-1',c=api.config(variant),name='supabase_db_'+c.project;
  api.read(variant);
  const output=path.join(local.repo,'docs/production/evidence/2026-10-04-document-migration','attempt-'+attempt);
  assert.ok(!fs.existsSync(output),'Use a fresh evidence attempt');fs.mkdirSync(output,{recursive:true});
  const chain=migrationChain(),migration=chain.sources[0].file;
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  function native(args){const r=spawnSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});assert.equal(r.status,0,'Owned DB operation failed');return r.stdout.trim();}
  const initial=JSON.parse(native(['inspect',name]))[0];
  assert.equal(initial.Name,'/'+name);assert.equal(initial.Config.Labels['com.supabase.cli.project'],c.project);
  assert.ok(!initial.HostConfig.Privileged);assert.deepEqual(Object.keys(initial.NetworkSettings.Networks),[c.network]);
  assert.ok(['exited','running'].includes(initial.State.Status));const started=initial.State.Status==='exited';
  const report={status:'NOT VERIFIED',startedAt:new Date().toISOString(),command:`node scripts/verify-clinia-document-migration.cjs ${attempt}`,project:c.project,
    driverSha256:sha(fs.readFileSync(__filename)),migration,migrationSha256:chain.sources[0].sha256,
    migrations:chain.sources,compiledMigrationSqlSha256:chain.sha256,initialState:initial.State.Status,checks:[],
    limits:['SQL roles with synthetic claims; no cryptographic HTTP JWT, managed hook or Storage/CDN proof','All prospective DDL, role/grants and probe rows rolled back','No remote or occupied production connection']};
  const persist=()=>fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2));persist();
  try{
    if(started)native(['start',name]);
    for(let i=0;i<20;i++){try{api.inspect(variant,['db']);break}catch(error){if(i===19)throw error;await new Promise(resolve=>setTimeout(resolve,500));}}
    report.runtime=api.inspect(variant,['db']);
    const snapshot=()=>JSON.parse(api.sql(variant,`SELECT json_build_object('roleExists',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'),
      'registryExists',to_regclass('security_internal.document_delivery_principals') IS NOT NULL,
      'auditExists',to_regclass('security_internal.document_delivery_audit') IS NOT NULL,
      'objects',(SELECT count(*) FROM storage.objects),'files',(SELECT count(*) FROM public.patient_files),
      'policies',(SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'));`,'postgres'));
    report.before=snapshot();assert.equal(report.before.roleExists,false);assert.equal(report.before.registryExists,false);
    const probe=`
      CREATE TEMP TABLE document_probe_result(result jsonb);
      DO $probe$ DECLARE u uuid;s uuid;cl uuid;pa uuid;fi uuid;object_name text;event jsonb;claims jsonb;
        allowed bigint;get_allowed bigint;info_allowed bigint;denied bigint;hook_role text;
      BEGIN
        SELECT m.user_id,m.clinic_id,p.id,a.id INTO u,cl,pa,s FROM public.clinic_members m
          JOIN public.patients p ON p.clinic_id=m.clinic_id JOIN auth.sessions a ON a.user_id=m.user_id
          WHERE m.status='active' AND m.role='doctor' AND p.deleted_at IS NULL AND (a.not_after IS NULL OR a.not_after>now()) LIMIT 1;
        IF u IS NULL THEN RAISE EXCEPTION 'Synthetic live doctor/session/patient prerequisite missing'; END IF;
        object_name:=cl::text||'/'||pa::text||'/'||gen_random_uuid()::text||'.pdf';
        claims:=jsonb_build_object('role','authenticated','sub',u,'session_id',s,'is_anonymous',false);
        PERFORM set_config('request.jwt.claims',claims::text,true);
        SET LOCAL ROLE authenticated;
        INSERT INTO public.patient_files(patient_id,clinic_id,name,file_path,size,type,uploaded_by)
          VALUES(pa,cl,'Synthetic migration probe',object_name,'0.001 MB','application/pdf',u) RETURNING id INTO fi;
        IF public.clinia_audit_document_delivery(cl,pa,fi,object_name) IS NOT TRUE THEN RAISE EXCEPTION 'Ordinary audit denied'; END IF;
        BEGIN
          PERFORM public.clinia_audit_document_delivery(gen_random_uuid(),pa,fi,object_name);
          RAISE EXCEPTION 'Foreign audit authority accepted';
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
        RESET ROLE;
        IF (SELECT count(*) FROM security_internal.document_delivery_audit WHERE actor_id=u AND clinic_id=cl AND patient_id=pa AND file_id=fi)<>1
          OR (SELECT count(*) FROM security_internal.document_delivery_audit)<>1
        THEN RAISE EXCEPTION 'Audit did not bind exactly one authorized actor/scope'; END IF;
        INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('patient-files',object_name,u::text);
        INSERT INTO security_internal.document_delivery_principals(user_id,enabled) VALUES(u,true);
        event:=jsonb_build_object('user_id',u,'claims',claims);
        SET LOCAL ROLE supabase_auth_admin;
        event:=public.clinia_document_access_token_hook(event);
        RESET ROLE;
        IF event->'claims'->>'role'<>'clinia_document_delivery' OR event->'claims'->>'sub'<>u::text
          OR event->'claims'->>'session_id'<>s::text THEN RAISE EXCEPTION 'Hook corrupted identity or failed isolation'; END IF;
        PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('role','clinia_document_delivery'))::text,true);
        FOR hook_role IN SELECT unnest(ARRAY['object.get_authenticated','object.get_authenticated_info']) LOOP
          PERFORM set_config('storage.operation',hook_role,true);
          SET LOCAL ROLE clinia_document_delivery;
          IF public.clinia_document_delivery_active() IS NOT TRUE THEN RAISE EXCEPTION 'Principal positive control denied'; END IF;
          SELECT count(*) INTO allowed FROM storage.objects WHERE bucket_id='patient-files' AND name=object_name;
          RESET ROLE;
          IF allowed<>1 THEN RAISE EXCEPTION 'Registered object positive control denied: %',hook_role; END IF;
          IF hook_role='object.get_authenticated' THEN get_allowed:=allowed; ELSE info_allowed:=allowed; END IF;
        END LOOP;
        FOR hook_role IN SELECT unnest(ARRAY['object.head_authenticated_info','object.list','object.list_v2','object.sign',
          'object.sign_many','object.get','object.get_public','object.unknown','image.get_authenticated']) LOOP
          PERFORM set_config('storage.operation',hook_role,true);
          SET LOCAL ROLE clinia_document_delivery;
          SELECT count(*) INTO denied FROM storage.objects WHERE bucket_id='patient-files' AND name=object_name;
          RESET ROLE;
          IF denied<>0 THEN RAISE EXCEPTION 'Principal operation leaked: %',hook_role; END IF;
        END LOOP;
        PERFORM set_config('request.jwt.claims',claims::text,true);
        FOR hook_role IN SELECT unnest(ARRAY['object.get_authenticated','object.get_authenticated_info']) LOOP
          PERFORM set_config('storage.operation',hook_role,true);
          SET LOCAL ROLE authenticated;
          SELECT count(*) INTO denied FROM storage.objects WHERE bucket_id='patient-files' AND name=object_name;
          RESET ROLE;
          IF denied<>0 THEN RAISE EXCEPTION 'Ordinary human clinical object read remains enabled: %',hook_role; END IF;
        END LOOP;
        UPDATE security_internal.document_delivery_principals SET enabled=false WHERE user_id=u;
        event:=public.clinia_document_access_token_hook(jsonb_build_object('user_id',u,'claims',claims));
        IF event->'claims'->>'role'<>'clinia_document_delivery' THEN RAISE EXCEPTION 'Disabled principal reverted to human role'; END IF;
        PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('role','clinia_document_delivery'))::text,true);
        FOR hook_role IN SELECT unnest(ARRAY['object.get_authenticated','object.get_authenticated_info']) LOOP
          PERFORM set_config('storage.operation',hook_role,true);
          SET LOCAL ROLE clinia_document_delivery;
          IF public.clinia_document_delivery_active() IS TRUE THEN RAISE EXCEPTION 'Disabled principal remains active'; END IF;
          SELECT count(*) INTO denied FROM storage.objects WHERE bucket_id='patient-files' AND name=object_name;
          RESET ROLE;
          IF denied<>0 THEN RAISE EXCEPTION 'Disabled principal still reads: %',hook_role; END IF;
        END LOOP;
        INSERT INTO document_probe_result VALUES(jsonb_build_object('registeredObjectRead',get_allowed,'registeredObjectInfoRead',info_allowed,
          'registryEmptyBeforeForward',true,'humanRestrictionUnchanged',true,'humanGetInfoDenied',true,'humanReadDenied',true,
          'headListSignUnknownOperationsDenied',true,'listSignOtherOperationsDenied',true,'disabledGetInfoDenied',true,
          'disabledPrincipalDenied',true,'disabledHookPreservesIsolation',true,
          'auditActorScopeBound',true,'foreignAuditDenied',true,
          'ordinaryAuditTablePrivilegesAbsent',NOT has_table_privilege('authenticated','security_internal.document_delivery_audit','SELECT,INSERT,UPDATE,DELETE'),
          'clinicalTablePrivilegesAbsent',NOT has_table_privilege('clinia_document_delivery','public.patient_files','SELECT,INSERT,UPDATE,DELETE')));
      END $probe$;
      SELECT result FROM document_probe_result;
      ROLLBACK;`;
    // The isolated cluster admin may assume managed Auth's role; ordinary
    // postgres cannot. Install as postgres so prospective ownership is exact.
    const sql=chain.sql+probe;
    assert.equal(statements(sql).at(-1).clean,'ROLLBACK;','Final outer rollback required');report.rollbackSqlSha256=sha(sql);
    report.probe=JSON.parse(api.sql(variant,sql,'supabase_admin'));report.after=snapshot();assert.deepEqual(report.after,report.before);
    report.checks=[{requirement:'Original plus forward canonical migrations install with empty disabled registry and guarded prerequisites',expected:'No error',actual:'Both installed within one rollback-only transaction',passed:true},
      {requirement:'Registered principal get and info operations preserve identity',expected:'1 object for each',actual:{get:report.probe.registeredObjectRead,info:report.probe.registeredObjectInfoRead},passed:report.probe.registeredObjectRead===1&&report.probe.registeredObjectInfoRead===1},
      {requirement:'Unchanged human restriction, HEAD/list/sign/unknown operations, disabled get/info and clinical table privilege denial',expected:'Denied',actual:report.probe,passed:Object.values(report.probe).every(x=>x===true||x===1)},
      {requirement:'Rollback leaves original schema/role and rows intact',expected:'Before equals after',actual:'Equal',passed:true}];
    assert.ok(report.checks.every(x=>x.passed));report.status='PARTIALLY VERIFIED';
  }catch(error){report.error=String(error.message).slice(0,300);report.status='BLOCKED';throw error}
  finally{
    if(started)native(['stop','--time','10',name]);report.finalState=JSON.parse(native(['inspect',name]))[0].State.Status;
    assert.equal(report.finalState,initial.State.Status,'Prior DB state not restored');report.completedAt=new Date().toISOString();persist();
  }
  console.log(JSON.stringify({status:report.status,checks:report.checks.map(x=>({requirement:x.requirement,passed:x.passed})),finalState:report.finalState,evidence:path.relative(local.repo,output)}));
}
if(require.main===module)main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main,MIGRATIONS,migrationChain};
