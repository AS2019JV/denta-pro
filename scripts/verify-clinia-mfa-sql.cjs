'use strict';
// Prospective five-migration install + MFA regressions, one rollback-only
// transaction on the already-owned disposable baseline. No hosted mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const api=require('./clinia-clean-api.cjs'),local=require('./clinia-local-runtime.cjs');
const {migrationChain}=require('./verify-clinia-private-media-origin.cjs');
const {stripReviewedWrapper,statements}=require('./prepare-clinia-hosted-staging.cjs');
const FILE='supabase/migrations/20261007045223_mandatory_clinical_mfa.sql';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function compiled(readFile=relative=>fs.readFileSync(path.join(local.repo,relative))){const bytes=readFile(FILE),body=stripReviewedWrapper(bytes.toString(),{file:FILE,begin:'BEGIN;',end:'COMMIT;'});const chain=migrationChain(readFile),sql=chain.sql+body+'\n';const parts=statements(sql);assert.equal(parts.filter(x=>x.clean==='BEGIN;').length,1);assert.ok(parts.every(x=>! /^(?:COMMIT|ROLLBACK|ABORT|START\s+TRANSACTION)\b/i.test(x.clean)),'Early transaction exit refused');return {sql,migrations:[...chain.sources,{file:FILE,sha256:sha(bytes),bodySha256:sha(body)}]};}
async function main(attempt){assert.match(attempt||'',/^[1-9]$/);const variant='clean-managed-1',c=api.config(variant),name='supabase_db_'+c.project;api.read(variant);
 const directory=path.join(local.repo,'docs/production/evidence/2026-10-06-mfa','attempt-'+attempt);assert.ok(!fs.existsSync(directory));fs.mkdirSync(directory,{recursive:true});const chain=compiled();
 const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
 const native=args=>{const r=spawnSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024});assert.equal(r.status,0,'Owned DB operation failed');return r.stdout.trim()};
 const initial=JSON.parse(native(['inspect',name]))[0];assert.equal(initial.Name,'/'+name);assert.equal(initial.Config.Labels['com.supabase.cli.project'],c.project);assert.equal(initial.HostConfig.Privileged,false);assert.deepEqual(Object.keys(initial.NetworkSettings.Networks),[c.network]);assert.ok(['exited','running'].includes(initial.State.Status));
 const report={status:'NOT VERIFIED',command:'node scripts/verify-clinia-mfa-sql.cjs '+attempt,project:c.project,startedAt:new Date().toISOString(),driverSha256:sha(fs.readFileSync(__filename)),migrations:chain.migrations,checks:[],limits:['Synthetic SQL claims only; cryptographic ordinary Auth JWT/TOTP HTTP flow and deployed browser remain unverified','Entire prospective chain, factors, identities and clinical changes roll back','No occupied production or hosted database connection']};const persist=()=>fs.writeFileSync(path.join(directory,'execution.json'),JSON.stringify(report,null,2)+'\n');persist();let started=false;
 try{if(initial.State.Status==='exited'){native(['start',name]);started=true}
  const readyDeadline=Date.now()+60000;while(true){try{api.inspect(variant,['db']);break}catch(error){if(Date.now()>=readyDeadline)throw error;await new Promise(resolve=>setTimeout(resolve,500));}}
  const snapshot=()=>JSON.parse(api.sql(variant,"select jsonb_build_object('mfa_function',to_regprocedure('public.clinia_mfa_active()') is not null,'mfa_policies',(select count(*) from pg_policies where policyname='clinia_mfa_gate'),'factors',(select count(*) from auth.mfa_factors),'patients',(select count(*) from public.patients),'files',(select count(*) from public.patient_files),'role_hash',(select md5(regexp_replace(prosrc,'\\s+','','g')) from pg_proc where oid='security_internal.role_for(uuid,uuid)'::regprocedure))",'supabase_admin'));
  report.before=snapshot();assert.equal(report.before.mfa_function,false);assert.equal(report.before.mfa_policies,0);
  const probe=`
   CREATE TEMP TABLE mfa_probe_result(result jsonb);
   DO $probe$ DECLARE u uuid;s uuid;cl uuid;pa uuid;fi uuid;factor uuid;factor2 uuid;claims jsonb;n bigint;
   BEGIN
    SELECT m.user_id,m.clinic_id,p.id,a.id INTO u,cl,pa,s FROM public.clinic_members m JOIN public.patients p ON p.clinic_id=m.clinic_id JOIN auth.sessions a ON a.user_id=m.user_id WHERE m.status='active' AND m.role='doctor' AND p.deleted_at IS NULL AND (a.not_after IS NULL OR a.not_after>now()) LIMIT 1;
    IF u IS NULL THEN RAISE EXCEPTION 'Synthetic live doctor/session prerequisite missing'; END IF;
    SELECT id INTO fi FROM public.patient_files WHERE clinic_id=cl AND patient_id=pa LIMIT 1;
    claims:=jsonb_build_object('role','authenticated','sub',u,'session_id',s,'is_anonymous',false,'aal','aal1');
    PERFORM set_config('request.jwt.claims',claims::text,true);
    SET LOCAL ROLE authenticated;
    IF public.clinia_session_active() IS NOT TRUE OR public.clinia_mfa_active() IS TRUE THEN RAISE EXCEPTION 'AAL1 enrollment/session semantics failed'; END IF;
    IF public.get_clinic_member_role(cl) IS NOT NULL THEN RAISE EXCEPTION 'AAL1 clinic authority leaked'; END IF;
    SELECT count(*) INTO n FROM public.patients WHERE id=pa;IF n<>0 THEN RAISE EXCEPTION 'AAL1 direct read leaked'; END IF;
    UPDATE public.patients SET first_name=first_name WHERE id=pa;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'AAL1 direct update accepted'; END IF;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('aal','aal2'))::text,true);
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS TRUE THEN RAISE EXCEPTION 'AAL2 without verified factor accepted'; END IF;
    RESET ROLE;
    INSERT INTO auth.mfa_factors(id,user_id,friendly_name,factor_type,status,secret,created_at,updated_at) VALUES(gen_random_uuid(),u,'Synthetic MFA proof','totp','unverified','CLINIA_SYNTHETIC_NOT_A_FACTOR_SECRET',now(),now()) RETURNING id INTO factor;
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS TRUE THEN RAISE EXCEPTION 'Unverified factor accepted'; END IF;
    RESET ROLE;
    UPDATE auth.mfa_factors SET status='verified' WHERE id=factor;
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS NOT TRUE OR public.get_clinic_member_role(cl) IS DISTINCT FROM 'doctor' THEN RAISE EXCEPTION 'Verified AAL2 positive authority failed'; END IF;
    SELECT count(*) INTO n FROM public.patients WHERE id=pa;IF n<>1 THEN RAISE EXCEPTION 'Verified AAL2 own-clinic positive read failed'; END IF;
    SELECT count(*) INTO n FROM public.patients WHERE clinic_id<>cl;IF n<>0 THEN RAISE EXCEPTION 'Cross-clinic read leaked'; END IF;
    UPDATE public.patients SET first_name=first_name WHERE id=pa;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Verified AAL2 ordinary metadata write failed'; END IF;
    RESET ROLE;
    DELETE FROM auth.mfa_factors WHERE id=factor;
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS TRUE OR public.get_clinic_member_role(cl) IS NOT NULL THEN RAISE EXCEPTION 'Stale AAL2 JWT survived last factor removal'; END IF;
    SELECT count(*) INTO n FROM public.patients WHERE id=pa;IF n<>0 THEN RAISE EXCEPTION 'Stale AAL2 direct read leaked'; END IF;
    RESET ROLE;
    INSERT INTO auth.mfa_factors(id,user_id,friendly_name,factor_type,status,secret,created_at,updated_at) VALUES(gen_random_uuid(),u,'Synthetic remaining factor','totp','verified','CLINIA_SYNTHETIC_NOT_A_FACTOR_SECRET',now(),now()) RETURNING id INTO factor2;
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS NOT TRUE THEN RAISE EXCEPTION 'Remaining verified factor positive control failed'; END IF;
    RESET ROLE;
    UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id=u;
    SET LOCAL ROLE authenticated;
    IF public.clinia_mfa_active() IS TRUE THEN RAISE EXCEPTION 'MFA bypassed live Auth ban'; END IF;
    RESET ROLE;
    INSERT INTO pg_temp.mfa_probe_result VALUES(jsonb_build_object('AAL1SessionStillActive',true,'AAL1ReadWriteAuthorityDenied',true,'AAL2WithoutFactorDenied',true,'unverifiedFactorDenied',true,'verifiedAAL2OwnClinicReadWritePassed',true,'crossClinicReadDenied',true,'exactClaimsLastFactorRemovalDenied',true,'remainingVerifiedFactorPassed',true,'liveAuthBanDenied',true,'publicGatePolicies',(SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='clinia_mfa_gate'),'privateStorageGatePolicies',(SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND policyname='clinia_mfa_gate')));
   END $probe$;
   SELECT result FROM pg_temp.mfa_probe_result;
   ROLLBACK;`;
  const sql=chain.sql+probe;assert.equal(statements(sql).filter(x=>x.clean==='BEGIN;').length,1);assert.equal(statements(sql).at(-1).clean,'ROLLBACK;');report.sqlSha256=sha(sql);report.probe=JSON.parse(api.sql(variant,sql,'supabase_admin'));
  assert.equal(report.probe.publicGatePolicies,24);assert.equal(report.probe.privateStorageGatePolicies,1);assert.ok(Object.values(report.probe).every(v=>v===true||v===24||v===1));report.after=snapshot();assert.deepEqual(report.after,report.before);report.checks=[{requirement:'All five canonical migrations install, live session preserved, AAL1/stale/unverified factor denial and AAL2 own-clinic controls',passed:true},{requirement:'All schema/data/factors/policies exactly restored after rollback',passed:true}];report.status='PARTIALLY VERIFIED';
 }catch(error){report.failure=String(error.message).slice(0,180);process.exitCode=1}
 finally{if(started)native(['stop','--time','10',name]);report.finalState=JSON.parse(native(['inspect',name]))[0].State.Status;assert.equal(report.finalState,initial.State.Status);report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,evidence:directory}));}
}
if(require.main===module)main(process.argv[2]).catch(()=>{console.error('Owned rollback-only MFA SQL guard failed');process.exitCode=1});
module.exports={compiled};
