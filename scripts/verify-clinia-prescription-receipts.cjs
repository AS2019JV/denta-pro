'use strict';
// Synthetic clean-project receipt acceptance. Never targets remote or occupied captured DBs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const api=require('./clinia-clean-api.cjs'),local=require('./clinia-local-runtime.cjs');
const migration='supabase/migrations/20261002231730_immutable_prescription_receipts.sql';
const pinned='da6c2212eb85989ef891a9251e3f4ad0519b9de97f683ae3e5b73b4a0ba268d8';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function plan(variant,attempt){assert.match(variant,/^clean-managed-[1-9]$/);assert.match(attempt,/^[1-9]$/);const c=api.config(variant);return {c,output:path.join(local.repo,'docs/production/evidence/2026-10-02-prescription-receipts',variant+'-'+attempt)};}
async function main(variant,attempt){
  const {c,output}=plan(variant,attempt);assert.ok(!fs.existsSync(output),'New evidence attempt required');
  const text=fs.readFileSync(path.join(local.repo,migration),'utf8');assert.equal(sha(text),pinned,'Reviewed 09B changed');
  const core=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-contract-api',variant+'-1/execution.json')));
  assert.equal(core.state,'CLEAN_GATEWAY_CORE_API_VERIFIED_NEW_WORKFLOWS_REMOTE_PENDING');
  const actors=JSON.parse(fs.readFileSync(path.join(local.privateDir,c.project+'-actors-1.private.json'))),{keys}=api.read(variant);
  const report={state:'PARTIAL',startedAt:new Date().toISOString(),project:c.project,migration,migrationSha256:pinned,checks:[],requests:[],limits:['Ordinary real Auth JWT gateway acceptance on synthetic data; not browser or deployed-provider evidence','Historical NULL is preserved, not reconstructed; no qualified signature or custody approval']};
  fs.mkdirSync(output,{recursive:true});const persist=()=>fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2)+'\n');persist();
  async function request(service,route,token,method='GET',body){
    const url=new URL(api.route(variant,service,route),'http://127.0.0.1:'+c.port);assert.equal(url.origin,'http://127.0.0.1:'+c.port);
    const r=await fetch(url,{method,headers:{apikey:keys.anon,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
    const data=await r.json();report.requests.push({service,method,path:url.pathname,status:r.status});return {status:r.status,data};
  }
  const ok=r=>{assert.ok(r.status>=200&&r.status<300,'Provider HTTP '+r.status+' code '+(r.data?.code||'unknown'));return r.data;};
  const deny=r=>assert.ok([400,401,403,404,409].includes(r.status),'Expected denial; HTTP '+r.status);
  const trusted=q=>api.sql(variant,"SET app.scoped_fixture_authorized='local-synthetic';\n"+q,'postgres');
  async function check(name,fn){await fn();report.checks.push({name,passed:true});persist();}
  const catalog=()=>JSON.parse(trusted("SELECT json_build_object('managed',(SELECT json_agg(json_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'hash',md5(pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage') AND p.prokind='f'),'histories',json_build_object('auth',(SELECT json_agg(to_jsonb(a) ORDER BY version) FROM auth.schema_migrations a),'storage',(SELECT json_agg(to_jsonb(s) ORDER BY id) FROM storage.migrations s)));") );
  let historical,issued;
  try{
    api.start(variant);report.managedBefore=catalog();
    assert.equal(trusted("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='prescriptions' AND column_name='issuance_snapshot';"),'0','09B already applied; refuse DDL replay');
    for(const label of ['doctor_A','owner_B','receptionist_A','removed_A']){
      const actor=actors[label],session=ok(await request('auth','/token?grant_type=password',keys.anon,'POST',{email:actor.email,password:actor.password}));
      assert.equal(session.user.id,actor.id);actor.token=session.access_token;
    }
    const f=core.fixtureIds,body={clinic_id:f.clinicA,patient_id:f.patientA,doctor_id:actors.doctor_A.id,data:{medications:[{name:'Sintético',dosage:'Uso sintético',duration:'1 día'}],indications:'Prueba sin uso clínico',doctorName:'Cliente falso',clinicName:'Cliente falso'}};
    historical=ok(await request('rest','/prescriptions',actors.doctor_A.token,'POST',body))[0];assert.ok(historical.id);report.historicalId=historical.id;
    api.sql(variant,text,'postgres');report.migrationApplied=true;persist();
    for(let i=0;i<20;i++){const cache=await request('rest','/prescriptions?select=issuance_snapshot&id=eq.'+historical.id,actors.doctor_A.token);if(cache.status===200)break;assert.ok(i<19,'PostgREST did not reload reviewed 09B');await new Promise(resolve=>setTimeout(resolve,250));}
    await check('Historical receipt remains NULL and existing content preserved',async()=>{const row=ok(await request('rest','/prescriptions?id=eq.'+historical.id,actors.doctor_A.token))[0];assert.equal(row.issuance_snapshot,null);for(const key of Object.keys(historical))assert.deepEqual(row[key],historical[key]);});
    await check('Ordinary doctor issuance captures database identity and strips client labels',async()=>{
      issued=ok(await request('rest','/prescriptions',actors.doctor_A.token,'POST',body))[0];assert.ok(issued.id&&issued.issuance_snapshot);report.issuedId=issued.id;
      const s=issued.issuance_snapshot;assert.equal(s.doctor_id,actors.doctor_A.id);assert.equal(s.patient_id,f.patientA);assert.equal(s.clinic_id,f.clinicA);assert.equal(s.prescription_id,issued.id);assert.equal(s.version,1);
      assert.ok(s.doctor.name&&s.clinic.name&&s.patient.name);assert.notEqual(s.doctor.name,'Cliente falso');assert.notEqual(s.clinic.name,'Cliente falso');assert.deepEqual(Object.keys(issued.data).sort(),['indications','medications']);assert.ok(!Object.hasOwn(s,'signature')&&!Object.hasOwn(s.clinic,'logoUrl'));
    });
    for(const [name,actor,change]of [
      ['foreign author',actors.doctor_A,{doctor_id:actors.owner_B.id}],['foreign patient',actors.doctor_A,{patient_id:f.patientB}],['foreign clinic',actors.doctor_A,{clinic_id:f.clinicB}],
      ['caller snapshot',actors.doctor_A,{issuance_snapshot:{version:1}}],['receptionist',actors.receptionist_A,{doctor_id:actors.receptionist_A.id}],['removed membership',actors.removed_A,{doctor_id:actors.removed_A.id}],['anonymous', {token:keys.anon},{}],
    ])await check('Issuance rejects '+name,async()=>deny(await request('rest','/prescriptions',actor.token,'POST',{...body,...change})));
    await check('Real locally logged-out doctor session cannot issue with retained JWT',async()=>{
      const actor=actors.doctor_A,session=ok(await request('auth','/token?grant_type=password',keys.anon,'POST',{email:actor.email,password:actor.password}));
      // Auth logout returns an empty body; use a bounded loopback fetch directly.
      const url=new URL(api.route(variant,'auth','/logout?scope=local'),'http://127.0.0.1:'+c.port);
      const r=await fetch(url,{method:'POST',headers:{apikey:keys.anon,Authorization:'Bearer '+session.access_token},redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,204);report.requests.push({service:'auth',method:'POST',path:url.pathname,status:r.status});
      deny(await request('rest','/prescriptions',session.access_token,'POST',body));
    });
    for(const [name,method,change]of [['content update','PATCH',{data:{...body.data,indications:'Alterado'}}],['snapshot update','PATCH',{issuance_snapshot:{version:999}}],['delete','DELETE',undefined]])await check('Ordinary JWT denies '+name,async()=>deny(await request('rest','/prescriptions?id=eq.'+issued.id,actors.doctor_A.token,method,change)));
    await check('Live identity edits preserve issued receipt; transaction rolled back',async()=>{
      const receiptHash=trusted(`SELECT md5(issuance_snapshot::text) FROM public.prescriptions WHERE id='${issued.id}';`);
      trusted(`BEGIN; UPDATE public.patients SET last_name='Identidad posterior sintética' WHERE id='${f.patientA}'; UPDATE public.profiles SET full_name='Doctor posterior sintético' WHERE id='${actors.doctor_A.id}'; UPDATE public.clinics SET name='Clínica posterior sintética' WHERE id='${f.clinicA}'; DO $verify$ BEGIN IF (SELECT md5(issuance_snapshot::text) FROM public.prescriptions WHERE id='${issued.id}') IS DISTINCT FROM '${receiptHash}' THEN RAISE EXCEPTION 'Receipt changed with live identities'; END IF; END $verify$; ROLLBACK;`);
      const row=ok(await request('rest','/prescriptions?id=eq.'+issued.id,actors.doctor_A.token))[0];assert.deepEqual(row,issued);report.receiptSha256=sha(JSON.stringify(issued.issuance_snapshot));
    });
    await check('Foreign tenant reads no issued receipt',async()=>assert.deepEqual(ok(await request('rest','/prescriptions?id=eq.'+issued.id,actors.owner_B.token)),[]));
    report.managedAfter=catalog();assert.deepEqual(report.managedAfter,report.managedBefore);report.state='CLEAN_09B_REAL_JWT_RECEIPTS_VERIFIED';
    const appPath=path.join(local.repo,'docs/production/evidence/2026-10-02-clean-application',`attempt-${c.attempt}`,'execution.json'),app=JSON.parse(fs.readFileSync(appPath));
    assert.equal(app.status,'CLEAN_APPLICATION_HELPER_ENROLLMENT_INSTALLED_SNAPSHOT_API_PENDING');
    app.appendedReceipt={migration,sha256:pinned,evidence:path.relative(local.repo,output),state:report.state};app.status='CLEAN_APPLICATION_HELPER_ENROLLMENT_SNAPSHOT_INSTALLED_API_PENDING';fs.writeFileSync(appPath,JSON.stringify(app,null,2)+'\n');
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{try{report.stopped=api.stop(variant);}catch(error){report.stopError=error.message;process.exitCode=1;}report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({state:report.state,checks:report.checks.length,error:report.error||null,evidence:output}));}
}
if(require.main===module){assert.equal(process.argv.length,4);main(...process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={plan};
