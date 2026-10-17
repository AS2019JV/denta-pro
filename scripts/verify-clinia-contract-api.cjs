'use strict';
// Real providers on synthetic secondary DBs; no app env, browser or remote access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const api=require(process.argv[2]?.startsWith('clean-managed-')?'./clinia-clean-api.cjs':'./clinia-contract-api.cjs'),local=require('./clinia-local-runtime.cjs');
const [variant,attempt]=process.argv.slice(2);assert.equal(process.argv.length,4);assert.match(attempt||'',/^[1-9]$/);
const c=api.config(variant),output=path.join(local.repo,variant.startsWith('captured-')||c.gateway?'docs/production/evidence/2026-10-02-contract-api':'docs/production/evidence/2026-09-28-contract-api',variant+'-'+attempt);
const privateFile=path.join(local.privateDir,c.project+'-actors-'+attempt+'.private.json');
const report={startedAt:new Date().toISOString(),state:'PARTIAL',database:c.database,variant,checks:[],requests:[],actors:[],limits:['Scoped secondary fixture, not full clean install or complete remote upgrade','Direct Auth/PostgREST/Storage HTTP; not gateway/browser acceptance','Shared local cluster/roles/network; not physical compromise containment','No email delivery, qualified signature, clinical or legal approval']};
if(c.gateway)report.limits=['Fresh managed initialization and captured/canonical application chain are separately evidenced','Gateway Auth/PostgREST/Storage with real provider JWTs; not browser/deployed provider parity','No external email delivery, qualified signature, clinical/legal approval or complete backup recovery'];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
let madeOutput=false;const actors={};let keys;
async function request(service,route,token,method='GET',body,contentType='application/json',extra={}){
  const base='http://127.0.0.1:'+(c.port+(c.gateway?0:{auth:0,rest:1,storage:2}[service])),url=new URL(c.gateway?api.route(variant,service,route):route,base);
  assert.equal(url.origin,base,'Only the isolated loopback API is allowed');
  const headers={Authorization:'Bearer '+token,...extra};if(body!==undefined)headers['Content-Type']=contentType;
  if(c.gateway)headers.apikey=token===keys.service?keys.service:keys.anon;
  const response=await fetch(url,{method,headers,body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
  report.requests.push({service,method,path:url.pathname,status:response.status});
  const bytes=Buffer.from(await response.arrayBuffer());let data;
  if(response.headers.get('content-type')?.includes('json'))try{data=JSON.parse(bytes.toString('utf8'));}catch{throw new Error('Invalid provider JSON');}
  return {status:response.status,ok:response.ok,data,bytes};
}
function ok(r){assert.ok(r.ok,'Provider request failed: HTTP '+r.status+' code '+(r.data?.code||'unknown'));return r.data;}
function denied(r){assert.ok([400,401,403,404,409].includes(r.status),'Expected rejected provider operation');assert.ok(!r.data?.items,'Denied request returned records');}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,passed:true,detail:detail??null});}catch(e){report.checks.push({name,passed:false,error:e.message});process.exitCode=1;}}
function trusted(query){return api.sql(variant,"SET app.scoped_fixture_authorized='local-synthetic';\n"+query,'postgres');}
const rpc=(actor,name,body)=>request('rest','/rpc/'+name,actor.token,'POST',body);
const range={p_start:'2026-10-01T00:00:00Z',p_end:'2026-11-01T00:00:00Z'};
async function main(){
  assert.ok(!fs.existsSync(output)&&!fs.existsSync(privateFile),'New attempt required; do not overwrite evidence/actors');
  fs.mkdirSync(output,{recursive:true});madeOutput=true;
  report.runtime=api.inspect(variant);assert.ok(report.runtime.every(s=>s.state==='running'&&(!s.health||s.health==='healthy')),'Isolated API must be healthy');
  keys=api.read(variant).keys;report.managedBefore=api.managedState(variant);assert.deepEqual(report.managedBefore,keys.managedBefore,'Unexpected managed state before fixtures');
  if(c.gateway)await check('Anonymous published Auth JWKS exposes only public signing material',async()=>{
    const jwks=ok(await request('auth','/.well-known/jwks.json',keys.anon));
    assert.ok(Array.isArray(jwks.keys)&&jwks.keys.length>0,'Published signing keys missing');
    for(const key of jwks.keys){
      assert.ok(key&&typeof key==='object'&&!Array.isArray(key));assert.ok(key.kty!=='oct','Symmetric signing material was published');
      for(const field of ['d','k','p','q','dp','dq','qi'])assert.ok(!Object.hasOwn(key,field),'Private signing material was published');
    }
    return {publishedKeys:jwks.keys.length,algorithms:[...new Set(jwks.keys.map(key=>key.alg))]};
  });
  const A=crypto.randomUUID(),B=crypto.randomUUID(),patientA=crypto.randomUUID(),patientB=crypto.randomUUID();report.fixtureIds={clinicA:A,clinicB:B,patientA,patientB};
  report.historicalBefore=JSON.parse(trusted("SELECT coalesce(json_agg(json_build_object('id',id,'sha256',encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex')) ORDER BY id),'[]') FROM public.patients p;"));
  const clinicCount=trusted('SELECT count(*) FROM public.clinics;');
  fs.writeFileSync(privateFile,'{}',{flag:'wx'});
  for(const label of ['owner_A','doctor_A','receptionist_A','removed_A','owner_B']){
    const password=crypto.randomBytes(24).toString('base64url')+'aA1!',email=label.toLowerCase()+'-'+crypto.randomBytes(6).toString('hex')+'@clinia.invalid';
    const created=ok(await request('auth','/admin/users',keys.service,'POST',{email,password,email_confirm:true,user_metadata:{full_name:'Sintético '+label,role:'clinic_owner',clinic_id:B,pending_clinic:{name:'No crear'}}}));
    assert.match(created.id,/^[a-f0-9-]{36}$/);
    actors[label]={id:created.id,email,password};fs.writeFileSync(privateFile,JSON.stringify(actors,null,2));
    const session=ok(await request('auth','/token?grant_type=password',keys.anon,'POST',{email,password}));
    assert.ok(session.access_token&&session.user?.id===created.id,'Real Auth login did not identify the created actor');
    actors[label].token=session.access_token;fs.writeFileSync(privateFile,JSON.stringify(actors,null,2));
    report.actors.push({label,userId:created.id,authentication:'real password login',tokenSha256:digest(session.access_token)});
  }
  await check('Editable Auth metadata grants no membership or clinic authority',async()=>{
    assert.equal(trusted('SELECT count(*) FROM public.clinics;'),clinicCount);
    const ids=Object.values(actors).map(a=>"'"+a.id+"'").join(',');
    assert.equal(trusted(`SELECT count(*) FROM public.profiles WHERE id IN (${ids}) AND (clinic_id IS NOT NULL OR role='clinic_owner');`),'0');
    assert.equal(trusted(`SELECT count(*) FROM public.clinic_members WHERE user_id IN (${ids});`),'0');
  });
  const memberships=[['owner_A',A,'clinic_owner','active'],['doctor_A',A,'doctor','active'],['receptionist_A',A,'receptionist','active'],['removed_A',A,'doctor','removed'],['owner_B',B,'clinic_owner','active']];
  const updates=memberships.map(([label,clinic,role])=>`UPDATE public.profiles SET clinic_id='${clinic}',role='${role}',status='active' WHERE id='${actors[label].id}';`).join('\n');
  const states=['scheduled','confirmed','arrived','completed','cancelled','no_show'];
  trusted(`BEGIN; INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES('${A}','Clínica API sintética A','${actors.owner_A.id}',true),('${B}','Clínica API sintética B','${actors.owner_B.id}',true);${updates}
    INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES ${memberships.map(([label,clinic,role,status])=>`('${actors[label].id}','${clinic}','${role}','${status}')`).join(',')};
    INSERT INTO public.patients(id,clinic_id,first_name,last_name,clinical_notes,account_balance,created_at) VALUES('${patientA}','${A}','Inventado','API A','Nota clínica sintética',45.89,'2026-09-01'),('${patientB}','${B}','Inventado','API B','No leer desde A',12.34,'2026-09-01');
    INSERT INTO public.patients(clinic_id,first_name,last_name,created_at) VALUES('${A}','Segundo inventado','API A','2026-09-01'); COMMIT;`);
  // Appointment guards require live identity even for maintenance fixtures.
  // Create through the ordinary RPC with the real doctor's Auth-issued JWT.
  for(const [i,status]of states.entries()){
    const created=ok(await rpc(actors.doctor_A,'save_clinic_appointment',{
      p_clinic_id:A,p_data:{patient_id:patientA,doctor_id:actors.doctor_A.id,
        start_time:`2026-10-01T${13+i}:00:00Z`,end_time:`2026-10-01T${13+i}:30:00Z`,
        status:status==='confirmed'?'confirmed':'scheduled',type:'Control'},
    }));
    const transitions=status==='completed'?['arrived','completed']
      :['arrived','cancelled','no_show'].includes(status)?[status]:[];
    for(const next of transitions)ok(await rpc(actors.doctor_A,'save_clinic_appointment',{
      p_clinic_id:A,p_appointment_id:created.id,p_data:{status:next},
    }));
  }
  for(const label of ['owner_A','doctor_A','receptionist_A']){
    const actor=actors[label];
    await check(label+' demographic pagination and financial boundary',async()=>{
      const demographics=ok(await rpc(actor,'get_patient_demographics',{p_clinic_id:A,p_limit:1}));assert.equal(demographics.total_count,2);assert.equal(demographics.items.length,1);assert.ok(!('clinical_notes'in demographics.items[0])&&!('account_balance'in demographics.items[0]));
      denied(await request('rest','/patients?select=account_balance&id=eq.'+patientA,actor.token));
      denied(await rpc(actor,'get_patient_demographics',{p_clinic_id:B}));
    });
    await check(label+' report exact six states and no finance',async()=>{
      const result=ok(await rpc(actor,'get_clinic_operational_report',{p_clinic_id:A,...range}));
      assert.deepEqual(result.summary,{appointments:6,activePatients:2,newPatients:0,completed:1,noShow:1,cancelled:1,attendanceRate:50});
      assert.deepEqual(result.statuses,Object.fromEntries(states.map(s=>[s,1])));
      assert.ok(!/revenue|amount|balance|invoice|payment|price/i.test(JSON.stringify(result)));
      denied(await rpc(actor,'get_clinic_operational_report',{p_clinic_id:B,...range}));
    });
    await check(label+' real schedule joins and clinical notes boundary',async()=>{
      const result=ok(await rpc(actor,'get_clinic_schedule',{p_clinic_id:A,...range}));assert.equal(result.total_count,6);assert.equal(result.items.length,6);
      assert.ok(result.items.every(a=>a.profiles?.id===actors.doctor_A.id&&a.patients?.first_name));assert.equal(result.items.every(a=>'notes'in a),label!=='receptionist_A');
    });
  }
  await check('Clinical doctor allowed; reception and cross clinic denied',async()=>{
    const result=ok(await rpc(actors.doctor_A,'get_patients_with_stats',{p_clinic_id:A,p_patient_id:patientA}));assert.equal(result.items[0].clinical_notes,'Nota clínica sintética');
    denied(await rpc(actors.receptionist_A,'get_patients_with_stats',{p_clinic_id:A}));
    denied(await rpc(actors.owner_B,'get_patients_with_stats',{p_clinic_id:A}));
  });
  await check('Reception demographic write works; forbidden fields/foreign references fail',async()=>{
    const r=ok(await rpc(actors.receptionist_A,'save_patient_demographics',{p_clinic_id:A,p_patient_id:patientA,p_data:{phone:'0990000000'}}));assert.equal(r.phone,'0990000000');
    denied(await rpc(actors.receptionist_A,'save_patient_demographics',{p_clinic_id:A,p_patient_id:patientA,p_data:{account_balance:'0'}}));
    denied(await rpc(actors.receptionist_A,'save_patient_demographics',{p_clinic_id:A,p_patient_id:patientB,p_data:{phone:'0990000000'}}));
  });
  const bytes=Buffer.from('%PDF-1.4\nClinia synthetic API transport bytes\n%%EOF'),filePath=A+'/'+patientA+'/api-'+attempt+'.pdf';
  const object='/object/patient-files/'+filePath;
  await check('Storage clinical bytes roundtrip and cross role/clinic/anonymous rejection',async()=>{
    ok(await request('storage',object,actors.doctor_A.token,'POST',bytes,'application/pdf'));
    const read=await request('storage',object,actors.doctor_A.token);ok(read);assert.equal(digest(read.bytes),digest(bytes));
    for(const token of [actors.receptionist_A.token,actors.owner_B.token,keys.anon])denied(await request('storage',object,token));
    denied(await request('storage','/object/patient-files/'+A+'/'+patientB+'/foreign.pdf',actors.doctor_A.token,'POST',bytes,'application/pdf'));
    const signed=ok(await request('storage','/object/sign/patient-files/'+filePath,actors.doctor_A.token,'POST',{expiresIn:60}));assert.ok(signed.signedURL||signed.signedUrl,'Signed URL absent');
  });
  await check('Registered clinical Storage bytes cannot be replaced or deleted',async()=>{
    ok(await request('rest','/patient_files',actors.doctor_A.token,'POST',{clinic_id:A,patient_id:patientA,uploaded_by:actors.doctor_A.id,name:'Inventado API',file_path:filePath,size:bytes.length,type:'application/pdf'}));
    denied(await request('storage',object,actors.doctor_A.token,'POST',Buffer.from('%PDF-1.4\nREPLACED'),'application/pdf',{'x-upsert':'true'}));
    const removal=await request('storage','/object/patient-files',actors.doctor_A.token,'DELETE',{prefixes:[filePath]});if(removal.ok)assert.deepEqual(removal.data,[]);else denied(removal);
    const read=await request('storage',object,actors.doctor_A.token);ok(read);assert.equal(digest(read.bytes),digest(bytes));
  });
  await check('Clinical signed URLs deliver exact bytes and expire; unauthorized signing denied',async()=>{
    for(const token of [actors.receptionist_A.token,actors.owner_B.token,keys.anon])
      denied(await request('storage','/object/sign/patient-files/'+filePath,token,'POST',{expiresIn:1}));
    const signed=ok(await request('storage','/object/sign/patient-files/'+filePath,actors.doctor_A.token,'POST',{expiresIn:5}));
    const signedRoute=signed.signedURL||signed.signedUrl;
    assert.ok(typeof signedRoute==='string'&&signedRoute.startsWith('/object/sign/patient-files/'),'Unexpected signed URL path');
    // Signed URLs are bearer capabilities until expiry. Do not claim revocation
    // retracts a download or invalidates an already issued capability.
    const read=await request('storage',signedRoute,keys.anon);ok(read);assert.equal(digest(read.bytes),digest(bytes));
    await new Promise(resolve=>setTimeout(resolve,6500));
    denied(await request('storage',signedRoute,keys.anon));
    return {bytesSha256:digest(bytes),requestedExpirySeconds:5};
  });
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=','base64');
  const media=[
    {bucket:'clinic-branding',path:A+'/api-'+attempt+'.png',writer:actors.owner_A},
    {bucket:'doctor-avatars',path:actors.doctor_A.id+'/api-'+attempt+'.png',writer:actors.doctor_A},
    {bucket:'patient-avatars',path:A+'/'+patientA+'/api-'+attempt+'.png',writer:actors.receptionist_A},
  ];
  for(const m of media) await check(m.bucket+' private bytes, shared-clinic read, and foreign/anonymous denial',async()=>{
    const route='/object/'+m.bucket+'/'+m.path;
    ok(await request('storage',route,m.writer.token,'POST',png,'image/png'));
    for(const actor of [actors.owner_A,actors.doctor_A,actors.receptionist_A]){
      const read=await request('storage',route,actor.token);ok(read);assert.equal(digest(read.bytes),digest(png));
    }
    for(const token of [actors.owner_B.token,actors.removed_A.token,keys.anon]){
      denied(await request('storage',route,token));
      denied(await request('storage','/object/sign/'+m.bucket+'/'+m.path,token,'POST',{expiresIn:60}));
    }
    denied(await request('storage','/object/public/'+m.bucket+'/'+m.path,keys.anon));
    const listed=ok(await request('storage','/object/list/'+m.bucket,actors.owner_B.token,'POST',{prefix:m.path.split('/').slice(0,-1).join('/'),limit:100,offset:0}));
    assert.deepEqual(listed,[],'Foreign clinic listing disclosed objects');
    return {bytesSha256:digest(png)};
  });
  await check('Media writes cannot forge ownership or foreign patient paths',async()=>{
    denied(await request('storage','/object/clinic-branding/'+A+'/doctor-forbidden-'+attempt+'.png',actors.doctor_A.token,'POST',png,'image/png'));
    denied(await request('storage','/object/doctor-avatars/'+actors.doctor_A.id+'/owner-forbidden-'+attempt+'.png',actors.owner_A.token,'POST',png,'image/png'));
    denied(await request('storage','/object/patient-avatars/'+A+'/'+patientB+'/foreign-'+attempt+'.png',actors.receptionist_A.token,'POST',png,'image/png'));
    denied(await request('storage','/object/doctor-avatars/'+actors.doctor_A.id+'-flat.png',actors.doctor_A.token,'POST',png,'image/png'));
  });
  await check('Committed member removal denies original JWT for report and Storage',async()=>{
    trusted(`UPDATE public.clinic_members SET status='removed' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`);
    try{
      denied(await rpc(actors.doctor_A,'get_clinic_operational_report',{p_clinic_id:A,...range}));
      denied(await request('storage',object,actors.doctor_A.token));
      for(const m of media)denied(await request('storage','/object/'+m.bucket+'/'+m.path,actors.doctor_A.token));
    }
    finally{trusted(`UPDATE public.clinic_members SET status='active' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`);}
    ok(await rpc(actors.doctor_A,'get_clinic_operational_report',{p_clinic_id:A,...range}));
  });
  for(const state of ['suspended','deleted'])await check('Original JWT denied after profile '+state+'; restoration re-enables authorized access',async()=>{
    trusted(state==='suspended'
      ? `UPDATE public.profiles SET status='suspended' WHERE id='${actors.doctor_A.id}';`
      : `UPDATE public.profiles SET deleted_at=now() WHERE id='${actors.doctor_A.id}';`);
    try{
      denied(await rpc(actors.doctor_A,'get_clinic_operational_report',{p_clinic_id:A,...range}));
      denied(await rpc(actors.doctor_A,'get_patients_with_stats',{p_clinic_id:A,p_patient_id:patientA}));
      denied(await request('storage',object,actors.doctor_A.token));
      denied(await request('storage','/object/sign/patient-files/'+filePath,actors.doctor_A.token,'POST',{expiresIn:60}));
      for(const m of media){
        denied(await request('storage','/object/'+m.bucket+'/'+m.path,actors.doctor_A.token));
        denied(await request('storage','/object/sign/'+m.bucket+'/'+m.path,actors.doctor_A.token,'POST',{expiresIn:60}));
        const listed=ok(await request('storage','/object/list/'+m.bucket,actors.doctor_A.token,'POST',{prefix:m.path.split('/').slice(0,-1).join('/'),limit:100,offset:0}));
        assert.deepEqual(listed,[]);
      }
    }finally{trusted(`UPDATE public.profiles SET status='active',deleted_at=NULL WHERE id='${actors.doctor_A.id}';`);}
    ok(await rpc(actors.doctor_A,'get_clinic_operational_report',{p_clinic_id:A,...range}));
  });
  await check('Original doctor JWT loses clinical capability after demotion to reception',async()=>{
    trusted(`UPDATE public.clinic_members SET role='receptionist' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`);
    try{
      assert.equal(ok(await rpc(actors.doctor_A,'get_clinic_member_role',{check_clinic_id:A})),'receptionist');
      denied(await rpc(actors.doctor_A,'get_patients_with_stats',{p_clinic_id:A,p_patient_id:patientA}));
      denied(await request('storage',object,actors.doctor_A.token));
      denied(await request('storage','/object/sign/patient-files/'+filePath,actors.doctor_A.token,'POST',{expiresIn:60}));
      ok(await rpc(actors.doctor_A,'get_patient_demographics',{p_clinic_id:A,p_patient_id:patientA}));
    }finally{trusted(`UPDATE public.clinic_members SET role='doctor' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`);}
  });
  await check('Ordinary JWT cannot elevate membership/profile or call privileged email limiter',async()=>{
    denied(await request('rest','/clinic_members?user_id=eq.'+actors.doctor_A.id+'&clinic_id=eq.'+A,actors.doctor_A.token,'PATCH',{role:'clinic_owner'}));
    denied(await request('rest','/profiles?id=eq.'+actors.doctor_A.id,actors.doctor_A.token,'PATCH',{role:'clinic_owner',clinic_id:B}));
    assert.equal(ok(await rpc(actors.doctor_A,'get_clinic_member_role',{check_clinic_id:A})),'doctor');
    for(const token of [actors.doctor_A.token,keys.anon])denied(await request('rest','/rpc/consume_email_abuse_budget',token,'POST',{p_action:'signup',p_ip_hash:'a'.repeat(64),p_destination_hash:'b'.repeat(64)}));
  });
  await check('Removed and anonymous have no report capability',async()=>{
    for(const token of [actors.removed_A.token,keys.anon])denied(await request('rest','/rpc/get_clinic_operational_report',token,'POST',{p_clinic_id:A,...range}));
  });
  await check('Historical patients preserved and managed migrations unchanged',async()=>{
    const originalIds=report.historicalBefore.map(p=>"'"+p.id+"'").join(',');
    const after=JSON.parse(trusted(`SELECT coalesce(json_agg(json_build_object('id',id,'sha256',encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex')) ORDER BY id),'[]') FROM public.patients p WHERE id IN (${originalIds||'NULL'});`));assert.deepEqual(after,report.historicalBefore);
    const managed=api.managedState(variant);assert.deepEqual(managed.authMigrations,report.managedBefore.authMigrations);assert.deepEqual(managed.storageMigrations,report.managedBefore.storageMigrations);report.managedAfter=managed;
  });
  report.state=report.checks.every(check=>check.passed)?(c.gateway?'CLEAN_GATEWAY_CORE_API_VERIFIED_NEW_WORKFLOWS_REMOTE_PENDING':'SCOPED_CANONICAL_API_VERIFIED_CLEAN_REMOTE_PENDING'):'PARTIAL_FAILED_CASES';
}
main().catch(e=>{report.error=e.message;process.exitCode=1;}).finally(()=>{
  if(madeOutput){try{report.stop=api.stop(variant);report.primaryAfter=c.gateway?api.primaryAfter(variant):local.inspectLocal();}catch(e){report.stopError=e.message;process.exitCode=1;report.state='PARTIAL_STOP_REQUIRES_REVIEW';}
    report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify({state:report.state,passed:report.checks.filter(c=>c.passed).length,total:report.checks.length,failures:report.checks.filter(c=>!c.passed),error:report.error||null,stop:report.stop,evidence:output}));
});
