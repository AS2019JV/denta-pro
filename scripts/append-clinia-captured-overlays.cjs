'use strict';
// Bounded prospective overlays on the two already reviewed SYNTHETIC captures.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs'),clean=require('./clinia-clean-api.cjs');
const pins=[
  ['session','20261002180423_live_session_revocation.sql','9e9e28f2b8871c5218a19b84918974061541808b141279d6b0fab7f666af0c9d',['public.clinia_session_active()','security_internal.lock_clinia_session()','security_internal.role_for(uuid,uuid)','security_internal.require_clinic(uuid,text[],boolean)']],
  ['enrollment','20261002180800_trusted_enrollment.sql','bcc0c79413c07f78be13de15c6d11f324e0a538084e8e7ee1e60c39c482c67f3',['public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text)','public.complete_verified_clinic_registration()','public.redeem_verified_clinic_invitation(text)']],
  ['receipt','20261002231730_immutable_prescription_receipts.sql','da6c2212eb85989ef891a9251e3f4ad0519b9de97f683ae3e5b73b4a0ba268d8',['security_internal.freeze_prescription_receipt()']],
];
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function plan(attempt){assert.match(attempt,/^[1-9]$/);return {targets:[['stage-3','clinia_upgrade_stage_20261002_3'],['linked-2','clinia_upgrade_linked_20261002_2']],output:path.join(local.repo,'docs/production/evidence/2026-10-02-captured-upgrade','overlays-'+attempt)};}
const functions=signatures=>`SELECT coalesce(json_agg(json_build_object('signature',s.signature,'body',md5(regexp_replace(p.prosrc,'\\s+','','g')),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text) ORDER BY s.signature),'[]') FROM unnest(ARRAY[${signatures.map(s=>"'"+s+"'").join(',')}]) s(signature) JOIN pg_proc p ON p.oid=to_regprocedure(s.signature);`;
const preservation=`DO $capture$ DECLARE r record; n bigint; h text; full_h text; cols jsonb; excluded text[]; result jsonb:='[]'; BEGIN
 FOR r IN SELECT ns.nspname,c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname IN ('public','logs','security_internal','auth','storage') AND c.relkind IN ('r','p') AND NOT c.relispartition ORDER BY ns.nspname,c.relname LOOP
  excluded:=CASE WHEN r.nspname='public' AND r.relname='prescriptions' THEN ARRAY['issuance_snapshot'] WHEN r.nspname='public' AND r.relname='clinic_invitations' THEN ARRAY['auth_ready','accepted_by','accepted_at'] ELSE ARRAY[]::text[] END;
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg((to_jsonb(t)-%L::text[])::text,''|'' ORDER BY (to_jsonb(t)-%L::text[])::text),'''')),md5(coalesce(string_agg(to_jsonb(t)::text,''|'' ORDER BY to_jsonb(t)::text),'''')) FROM %I.%I t',excluded,excluded,r.nspname,r.relname) INTO n,h,full_h;
  SELECT jsonb_agg(a.attname ORDER BY a.attnum) INTO cols FROM pg_attribute a WHERE a.attrelid=format('%I.%I',r.nspname,r.relname)::regclass AND a.attnum>0 AND NOT a.attisdropped;
  result:=result||jsonb_build_array(jsonb_build_object('schema',r.nspname,'table',r.relname,'count',n,'hash',h,'fullHash',full_h,'columns',cols));
 END LOOP; PERFORM set_config('app.preservation_snapshot',result::text,false); END $capture$;
 SELECT current_setting('app.preservation_snapshot');`;
const managed=`SELECT json_build_object('functions',(SELECT json_agg(json_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'hash',md5(pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage') AND p.prokind='f'),'histories',json_build_object('auth',(SELECT json_agg(to_jsonb(a) ORDER BY version) FROM auth.schema_migrations a),'storage',(SELECT json_agg(to_jsonb(s) ORDER BY id) FROM storage.migrations s)));`;
async function main(attempt){
 const p=plan(attempt);assert.ok(!fs.existsSync(p.output),'New evidence required');
 const material=pins.map(([name,file,pinned,signatures])=>{const text=fs.readFileSync(path.join(local.repo,'supabase/migrations',file),'utf8');assert.equal(sha(text),pinned);return {name,file,pinned,signatures,text};});
 for(const [evidence,database]of p.targets){const old=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-captured-upgrade',evidence,'execution.json')));assert.equal(old.status,'VERIFIED');assert.equal(old.database,database);}
 const fresh=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-prescription-receipts/clean-managed-1-1/execution.json')));assert.equal(fresh.state,'CLEAN_09B_REAL_JWT_RECEIPTS_VERIFIED');
 fs.mkdirSync(p.output,{recursive:true});const report={startedAt:new Date().toISOString(),state:'PARTIAL',targets:[],limits:['Existing synthetic captured upgrades only, not remote schemas','Read-only clean reference; inherited managed provider grants remain unchanged','Row preservation hashes exclude only the four reviewed additive columns; historical new values checked explicitly']},persist=()=>fs.writeFileSync(path.join(p.output,'execution.json'),JSON.stringify(report,null,2)+'\n');persist();
 function sql(database,text){assert.ok(p.targets.some(t=>t[1]===database));local.inspectDatabase();const r=spawnSync(path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe'),['--context','desktop-linux','exec','-i','--user','postgres','supabase_db_clinia-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,'-f','/dev/stdin'],{input:"SET app.scoped_fixture_authorized='local-synthetic';\n"+text,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:8*1024*1024});if(r.error||r.status!==0){fs.writeFileSync(path.join(local.privateDir,'captured-overlay-'+Date.now()+'.private.log'),(r.stdout||'')+(r.stderr||''),{flag:'wx'});throw Error('Captured overlay failed; private diagnostic and target preserved');}return r.stdout.trim();}
 try{
  const expected=material.map(m=>{const result=JSON.parse(clean.sql('clean-managed-1',functions(m.signatures),'postgres'));assert.equal(result.length,m.signatures.length,'Clean reference missing reviewed functions');return result;});
  for(const [,database]of p.targets){
   const target={database,steps:[],rowsBefore:JSON.parse(sql(database,preservation)),managedBefore:JSON.parse(sql(database,managed))};report.targets.push(target);persist();
   for(const [i,m]of material.entries()){
    const marker={session:"to_regprocedure('public.clinia_session_active()') IS NOT NULL",enrollment:"to_regclass('security_internal.clinic_registration_intents') IS NOT NULL",receipt:"EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prescriptions' AND column_name='issuance_snapshot')"}[m.name];
    const installed=sql(database,'SELECT '+marker+';')==='t';target.steps.push({name:m.name,file:m.file,sha256:m.pinned,status:installed?'EXISTING_REVIEW_REQUIRED':'PENDING'});persist();
    if(!installed)sql(database,m.text);
    assert.deepEqual(JSON.parse(sql(database,functions(m.signatures))),expected[i],'Unexpected existing or installed '+m.name+' functions');target.steps.at(-1).status=installed?'EXISTING_EXACT_VERIFIED':'APPLIED_EXACT_VERIFIED';persist();
   }
   const after=JSON.parse(sql(database,preservation));for(const before of target.rowsBefore){const found=after.find(r=>r.schema===before.schema&&r.table===before.table);assert.ok(found);if(JSON.stringify(found.columns)===JSON.stringify(before.columns))assert.deepEqual(found,before,'Existing full rows changed: '+before.schema+'.'+before.table);else {for(const key of ['schema','table','count','hash'])assert.deepEqual(found[key],before[key],'Existing normalized rows changed: '+before.schema+'.'+before.table);const additions=found.columns.filter(col=>!before.columns.includes(col));assert.deepEqual(additions,before.table==='prescriptions'?['issuance_snapshot']:['auth_ready','accepted_by','accepted_at'],'Unexpected additive columns');}}
   for(const addition of after.filter(r=>!target.rowsBefore.some(b=>b.schema===r.schema&&b.table===r.table)))assert.deepEqual({schema:addition.schema,table:addition.table,count:addition.count},{schema:'security_internal',table:'clinic_registration_intents',count:0},'Unexpected new data/table');
   if(target.steps.find(s=>s.name==='receipt').status==='APPLIED_EXACT_VERIFIED')assert.equal(sql(database,"SELECT NOT EXISTS(SELECT 1 FROM public.prescriptions WHERE issuance_snapshot IS NOT NULL);"),'t','New historical receipt defaults changed');
   if(target.steps.find(s=>s.name==='enrollment').status==='APPLIED_EXACT_VERIFIED')assert.equal(sql(database,"SELECT NOT EXISTS(SELECT 1 FROM public.clinic_invitations WHERE auth_ready OR accepted_by IS NOT NULL OR accepted_at IS NOT NULL);"),'t','New historical invitation defaults changed');
   target.managedAfter=JSON.parse(sql(database,managed));assert.deepEqual(target.managedAfter,target.managedBefore);target.rowsAfter=after;target.state='OVERLAYS_EXISTING_ROWS_MANAGED_HISTORY_VERIFIED';persist();
  }
  report.state='CAPTURED_STAGE_LINKED_OVERLAYS_PRESERVED_VERIFIED';
 }catch(error){report.error=error.message;process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({state:report.state,targets:report.targets.map(t=>({database:t.database,state:t.state,steps:t.steps})),error:report.error||null,evidence:p.output}));}
}
if(require.main===module){assert.equal(process.argv.length,3);main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={plan,functions};
