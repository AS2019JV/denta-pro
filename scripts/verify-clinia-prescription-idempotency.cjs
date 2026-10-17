'use strict';
// Actual action + ordinary Supabase SDK/JWTs. Cookie transport is adapted; no browser claim.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('typescript'),{createClient}=require('@supabase/supabase-js');
const api=require('./clinia-clean-api.cjs'),local=require('./clinia-local-runtime.cjs');
const policy=require('../lib/prescription-policy.mjs'),receipt=require('../lib/prescription-receipt.mjs');
const migration='supabase/migrations/20261002234427_enable_prescription_request_ids.sql';
const pinned='1462d48079fa232131f1bfa066b34db34876f0eebe62c5b64be93270c26646bf';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function plan(variant,attempt){assert.match(variant,/^clean-managed-[1-9]$/);assert.match(attempt,/^[1-9]$/);return {c:api.config(variant),output:path.join(local.repo,'docs/production/evidence/2026-10-02-prescription-idempotency',variant+'-'+attempt)};}
function action(client,url,anon){
  const mod={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(path.join(local.repo,'app/actions/save-prescription.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon}},require(name){
    if(name==='@supabase/ssr')return {createServerClient:()=>client};
    if(name==='next/headers')return {cookies:async()=>({getAll:()=>[],set(){}})};
    if(name==='@/lib/prescription-policy.mjs')return policy;
    if(name==='@/lib/prescription-receipt.mjs')return receipt;
    throw Error('Unexpected action dependency');
  }});
  return mod.exports.savePrescription;
}
async function main(variant,attempt){
  const {c,output}=plan(variant,attempt);assert.ok(!fs.existsSync(output),'Use new evidence attempt');
  const sql=fs.readFileSync(path.join(local.repo,migration),'utf8');assert.equal(sha(sql),pinned);
  const baseline=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-prescription-receipts',variant+'-1/execution.json')));
  assert.equal(baseline.state,'CLEAN_09B_REAL_JWT_RECEIPTS_VERIFIED');
  const f=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-contract-api',variant+'-1/execution.json'))).fixtureIds;
  const actors=JSON.parse(fs.readFileSync(path.join(local.privateDir,c.project+'-actors-1.private.json'))),{keys}=api.read(variant),origin='http://127.0.0.1:'+c.port;
  const report={state:'PARTIALLY VERIFIED',startedAt:new Date().toISOString(),project:c.project,migration,migrationSha256:pinned,
    actionSha256:sha(fs.readFileSync(path.join(local.repo,'app/actions/save-prescription.ts'))),checks:[],requests:[],
    limits:['Actual action transpiled with cookie/client factory adapted to real ordinary SDK and Auth JWT; not Next HTTP/browser execution','Synthetic loopback candidate; not remote release, professional qualification or clinical acceptance']};
  fs.mkdirSync(output,{recursive:true});const persist=()=>fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2)+'\n');persist();
  async function safeFetch(url,options={},lose){
    const u=new URL(typeof url==='string'?url:url.url);assert.equal(u.origin,origin);
    const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});
    let code=null;try{code=(await response.clone().json())?.code||null;}catch{}
    report.requests.push({method:options.method||'GET',path:u.pathname,status:response.status,code});
    if(lose?.value&&options.method==='POST'&&u.pathname==='/rest/v1/prescriptions'&&response.ok){lose.value=false;throw Error('Synthetic committed-response loss');}
    return response;
  }
  const ordinary=(token,lose)=>createClient(origin,keys.anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token},fetch:(url,options)=>safeFetch(url,options,lose)}});
  async function login(label){const actor=actors[label];const response=await safeFetch(origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:keys.anon,'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password:actor.password})});assert.equal(response.status,200);const session=await response.json();assert.equal(session.user.id,actor.id);return {actor,token:session.access_token,client:ordinary(session.access_token)};}
  async function check(name,expected,fn){const actual=await fn();report.checks.push({name,expected,result:actual,passed:true});persist();}
  const input=(requestId,overrides={})=>({requestId,clinicId:f.clinicA,patientId:f.patientA,medications:[{name:'Prueba sintética',dosage:'Uso sintético',duration:'1 día'}],indications:'Prueba sin uso clínico',...overrides});
  let doctor;
  try{
    api.start(variant);doctor=await login('doctor_A');const foreign=await login('owner_B'),reception=await login('receptionist_A');
    assert.equal(api.sql(variant,"SELECT has_column_privilege('authenticated','public.prescriptions','id','INSERT');",'postgres'),'f','Already changed; refuse unproven DDL replay');
    const beforeId=crypto.randomUUID();
    await check('Reproduce ordinary UUID issuance privilege failure before fix','42501 and zero persisted rows',async()=>{
      const result=await doctor.client.from('prescriptions').insert({id:beforeId,clinic_id:f.clinicA,patient_id:f.patientA,doctor_id:doctor.actor.id,data:{medications:input(beforeId).medications,indications:input(beforeId).indications}});
      assert.equal(result.error?.code,'42501');const rows=await doctor.client.from('prescriptions').select('id').eq('id',beforeId);assert.equal(rows.error,null);assert.equal(rows.data.length,0);return {code:result.error.code,rows:rows.data.length};
    });
    api.sql(variant,sql,'postgres');report.migrationApplied=true;persist();
    await check('Narrow insert permission retains anonymous and snapshot-column denial','authenticated id only; no broad INSERT/anonymous/snapshot',async()=>{
      const permissions=JSON.parse(api.sql(variant,"SELECT json_build_object('id',has_column_privilege('authenticated','public.prescriptions','id','INSERT'),'table',has_table_privilege('authenticated','public.prescriptions','INSERT'),'anon',has_column_privilege('anon','public.prescriptions','id','INSERT'),'snapshot',has_column_privilege('authenticated','public.prescriptions','issuance_snapshot','INSERT'));",'postgres'));
      assert.deepEqual(permissions,{id:true,table:false,anon:false,snapshot:false});return permissions;
    });
    const save=action(doctor.client,origin,keys.anon),id=crypto.randomUUID();
    await check('Concurrent actual-action retries persist one immutable receipt','2 successes; same receipt; count 1',async()=>{
      const results=await Promise.all([save(input(id)),save(input(id))]);assert.ok(results.every(r=>r.success));assert.deepEqual(results[0].prescription,results[1].prescription);
      assert.equal(results[0].prescription.doctor_id,doctor.actor.id);assert.equal(results[0].prescription.id,id);
      const rows=await doctor.client.from('prescriptions').select('id').eq('id',id);assert.equal(rows.error,null);assert.equal(rows.data.length,1);report.receiptSha256=sha(JSON.stringify(results[0].prescription));return {successes:2,rows:1};
    });
    await check('Same UUID cannot alter issued content','false and unchanged receipt',async()=>{
      const before=(await save(input(id))).prescription;
      for(const override of [{indications:'Alterado'},{medications:[{name:'Otro',dosage:'Uso',duration:'1 día'}]},{patientId:f.patientB},{clinicId:f.clinicB}])assert.equal((await save(input(id,override))).success,false);
      assert.deepEqual((await save(input(id))).prescription,before);return {denials:4,unchanged:true};
    });
    await check('Foreign clinic cannot read or recover colliding UUID','read [] and foreign-own-intent retry false',async()=>{
      const rows=await foreign.client.from('prescriptions').select('id,issuance_snapshot').eq('id',id);assert.equal(rows.error,null);assert.deepEqual(rows.data,[]);
      assert.equal((await action(foreign.client,origin,keys.anon)(input(id,{clinicId:f.clinicB,patientId:f.patientB}))).success,false);return {rows:0,retry:false};
    });
    await check('Receptionist cannot issue even with valid UUID','false; no row',async()=>{const requestId=crypto.randomUUID();assert.equal((await action(reception.client,origin,keys.anon)(input(requestId))).success,false);assert.equal(api.sql(variant,`SELECT count(*) FROM public.prescriptions WHERE id='${requestId}';`,'postgres'),'0');return {issued:false};});
    await check('Committed-response loss retries same UUID without duplicate issuance','first false; retry true; count 1',async()=>{
      const requestId=crypto.randomUUID(),lose={value:true},lost=action(ordinary(doctor.token,lose),origin,keys.anon);
      assert.equal((await lost(input(requestId))).success,false);assert.equal(lose.value,false);assert.equal((await lost(input(requestId))).success,true);
      assert.equal(api.sql(variant,`SELECT count(*) FROM public.prescriptions WHERE id='${requestId}';`,'postgres'),'1');return {first:false,retry:true,rows:1};
    });
    await check('Caller cannot choose author or insert a snapshot','author bound to Auth UID; direct snapshot 42501',async()=>{
      const requestId=crypto.randomUUID(),result=await save(input(requestId,{doctorId:foreign.actor.id,issuance_snapshot:{version:999}}));assert.equal(result.success,true);assert.equal(result.prescription.doctor_id,doctor.actor.id);
      const invalid=await doctor.client.from('prescriptions').insert({id:crypto.randomUUID(),clinic_id:f.clinicA,patient_id:f.patientA,doctor_id:doctor.actor.id,data:{medications:input(requestId).medications,indications:'Prueba'},issuance_snapshot:{version:999}});assert.equal(invalid.error?.code,'42501');return {authorBound:true,snapshotCode:invalid.error.code};
    });
    await check('Actual action with locally revoked Auth session cannot issue or recover','logout 204; both false',async()=>{
      const revoked=await login('doctor_A');const response=await safeFetch(origin+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:keys.anon,Authorization:'Bearer '+revoked.token}});assert.equal(response.status,204);
      const denied=action(revoked.client,origin,keys.anon);assert.equal((await denied(input(crypto.randomUUID()))).success,false);assert.equal((await denied(input(id))).success,false);return {logout:204,new:false,retry:false};
    });
    report.prescriptionSubGate={state:'VERIFIED',checks:9,scope:'Explicit-ID issuance and actual-action retries with ordinary real JWTs'};persist();
    const appPath=path.join(local.repo,'docs/production/evidence/2026-10-02-clean-application',`attempt-${c.attempt}`,'execution.json'),app=JSON.parse(fs.readFileSync(appPath));
    app.appendedRequestIdGrant={migration,sha256:pinned,evidence:path.relative(local.repo,output),state:report.prescriptionSubGate.state};fs.writeFileSync(appPath,JSON.stringify(app,null,2)+'\n');
    await check('Current candidate retains atomic appointment overlap denial after overlays','two ordinary actors race; one success and one 23P01',async()=>{
      const start='2038-07-12T15:00:00Z',end='2038-07-12T15:30:00Z';
      const args={p_clinic_id:f.clinicA,p_appointment_id:null,p_data:{patient_id:f.patientA,doctor_id:doctor.actor.id,start_time:start,end_time:end,status:'scheduled',type:'Carrera sintética'}};
      const results=await Promise.all([doctor.client.rpc('save_clinic_appointment',args),reception.client.rpc('save_clinic_appointment',args)]);
      assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.find(r=>r.error).error.code,'23P01');
      const count=api.sql(variant,`SELECT count(*) FROM public.appointments WHERE clinic_id='${f.clinicA}' AND doctor_id='${doctor.actor.id}' AND start_time='${start}' AND end_time='${end}';`,'postgres');assert.equal(count,'1');return {successes:1,denial:'23P01',rows:1};
    });
    report.state='VERIFIED';report.scope='Local explicit-ID issuance and actual-action idempotency after narrow forward grant';
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{try{report.stopped=api.stop(variant);}catch(error){report.stopError=error.message;process.exitCode=1;}report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({state:report.state,checks:report.checks.length,error:report.error||null,evidence:output}));}
}
if(require.main===module){assert.equal(process.argv.length,4);main(...process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={plan};
