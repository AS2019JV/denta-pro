'use strict';
// Genuine Auth/PostgREST/RPC/Storage checks, exclusively against owned loopback.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const local=require('./clinia-local-runtime.cjs');
const output=path.join(local.repo,'docs/production/evidence/2026-09-27/auth-matrix');
const privateActors=path.join(local.privateDir,'encargo02-actors.private.json');
const A='33333333-3333-4333-8333-333333333333', B='44444444-4444-4444-8444-444444444444';
const patientA='cccccccc-cccc-4ccc-8ccc-cccccccccccc',patientB='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const report={startedAt:new Date().toISOString(),environment:'local-synthetic-primary',state:'PARTIAL',
  checks:[],requests:[],fixtures:[],limitations:[
    'Local providers, not deployed staging/browser acceptance.',
    'Admin-created confirmed fixtures do not test confirmation email delivery.',
    'No qualified signature, clinical UAT, legal approval or booking concurrency claim.',
    'Full acceptance-cases.json including rights, containment and concurrent revocation remains pending.'
  ]};
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function safeClient(key,token,label){
  return createClient(local.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:token?{Authorization:'Bearer '+token}:{},fetch:async(input,init)=>{
      const u=new URL(typeof input==='string'?input:input.url); if(u.origin!==local.url)throw new Error('Non-local API request refused');
      const start=Date.now();const r=await fetch(input,{...init,signal:AbortSignal.timeout(15000)});
      // No headers, auth body, token, password or signed URL is recorded.
      report.requests.push({actor:label,method:init?.method||'GET',path:u.pathname,status:r.status,elapsedMs:Date.now()-start});
      return r;
    }}});
}
function expectOk(r){assert.equal(r.error,null,r.error?.message);return r.data;}
function expectDenied(r){assert.ok(r.error,'Expected rejected operation');assert.ok(!r.data||Array.isArray(r.data)&&r.data.length===0);}
async function check(name,fn){
  try{const detail=await fn();report.checks.push({name,passed:true,detail:detail??null});}
  catch(e){report.checks.push({name,passed:false,error:e.message});process.exitCode=1;}
}
function trusted(query){return local.sql('postgres',"SET app.scoped_fixture_authorized='local-synthetic';\n"+query,'postgres');}
async function main(){
  if(fs.existsSync(output)||fs.existsSync(privateActors))throw new Error('Acceptance evidence/actors already exist; refuse duplicate fixtures');
  fs.mkdirSync(output,{recursive:true});
  report.runtime=local.inspectLocal();
  const keys=local.keys(),admin=safeClient(keys.service,null,'trusted-fixture-admin'),anonymous=safeClient(keys.anon,null,'anonymous');
  const actors={};
  for(const label of ['owner_A','doctor_A','receptionist_A','removed_A','owner_B','doctor_B','dual_role','dual_owner','unaffiliated']){
    const password=crypto.randomBytes(24).toString('base64url')+'aA1!';
    const email=`${label.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}@clinia.invalid`;
    const data=expectOk(await admin.auth.admin.createUser({email,password,email_confirm:label!=='unaffiliated',
      user_metadata:{full_name:'Sintético '+label,role:'clinic_owner',clinic_id:B,pending_clinic:{name:'No debe crearse'}}}));
    assert.match(data.user.id,/^[a-f0-9-]{36}$/);
    if(label==='unaffiliated') expectOk(await admin.auth.admin.updateUserById(data.user.id,{email_confirm:true}));
    const login=safeClient(keys.anon,null,label+'-signin');
    const session=expectOk(await login.auth.signInWithPassword({email,password}));
    assert.ok(session.session?.access_token);assert.equal(session.user.id,data.user.id);
    actors[label]={id:data.user.id,email,password,token:session.session.access_token,login,client:safeClient(keys.anon,session.session.access_token,label)};
    report.fixtures.push({actor:label,userId:data.user.id,authentication:'actual signInWithPassword',tokenSha256:digest(session.session.access_token)});
  }
  fs.writeFileSync(privateActors,JSON.stringify(Object.fromEntries(Object.entries(actors).map(([label,a])=>[label,{id:a.id,email:a.email,password:a.password,token:a.token}])),null,2));
  await check('Auth editable signup metadata grants no clinic/membership',async()=>{
    const actual=JSON.parse(trusted("SELECT json_build_object('clinics',(SELECT count(*) FROM public.clinics),'members',(SELECT count(*) FROM public.clinic_members),'privilegedProfiles',(SELECT count(*) FROM public.profiles WHERE role='clinic_owner' OR clinic_id IS NOT NULL));"));
    assert.deepEqual(actual,{clinics:0,members:0,privilegedProfiles:0});
    expectDenied(await actors.unaffiliated.client.rpc('get_patient_demographics',{p_clinic_id:B}));return actual;
  });
  const memberships=[['owner_A',A,'clinic_owner'],['doctor_A',A,'doctor'],['receptionist_A',A,'receptionist'],['removed_A',A,'doctor'],['owner_B',B,'clinic_owner'],['doctor_B',B,'doctor'],['dual_role',A,'doctor'],['dual_role',B,'receptionist'],['dual_owner',A,'clinic_owner'],['dual_owner',B,'clinic_owner']];
  const updates=Object.entries(actors).filter(([l])=>l!=='unaffiliated').map(([label,a])=>{
    const m=memberships.find(x=>x[0]===label);return `UPDATE public.profiles SET role='${m[2]}',clinic_id='${label==='dual_role'?B:m[1]}',status='active' WHERE id='${a.id}';`;
  }).join('\n');
  trusted(`BEGIN;INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES('${A}','Clínica sintética JWT A','${actors.owner_A.id}',true),('${B}','Clínica sintética JWT B','${actors.owner_B.id}',true);
    ${updates}
    INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES ${memberships.map(([l,c,r])=>`('${actors[l].id}','${c}','${r}','${l==='removed_A'?'removed':'active'}')`).join(',')};
    INSERT INTO public.patients(id,clinic_id,first_name,last_name,account_balance,clinical_notes,odontogram_state) VALUES('${patientA}','${A}','Paciente inventado','JWT A',45.89,'Nota clínica sintética','{"11":{"status":"healthy"}}'),('${patientB}','${B}','Paciente inventado','JWT B',12.34,'Otra clínica','{}');
    INSERT INTO public.patients(clinic_id,first_name,last_name) SELECT '${A}','Paciente sintético',g::text FROM generate_series(1,30) g;
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes)
      SELECT '${A}',p.id,'${actors.doctor_A.id}',timestamptz '2026-10-01 13:00:00+00'+row_number() OVER(ORDER BY p.id)*interval '1 hour',timestamptz '2026-10-01 13:30:00+00'+row_number() OVER(ORDER BY p.id)*interval '1 hour','scheduled','Consulta','Nota privada'
      FROM public.patients p WHERE p.clinic_id='${A}';COMMIT;`);
  const baselineMoney=trusted(`SELECT account_balance FROM public.patients WHERE id='${patientA}';`);
  const allowedKeys=new Set(['id','clinic_id','first_name','last_name','cedula','email','phone','address','city','state','birth_date','gender','status','occupation','guardian_name','medical_record_number','emergency_contact','emergency_phone','marital_status','preferred_contact_method','avatar_url','family_representative_id','family_relationship','is_family_head','created_at','updated_at']);
  for(const label of ['owner_A','doctor_A','receptionist_A']){
    const client=actors[label].client;
    await check(label+' exact demographic projection/count/empty offset',async()=>{
      const page=expectOk(await client.rpc('get_patient_demographics',{p_clinic_id:A,p_limit:25}));
      assert.equal(page.items.length,25);assert.equal(page.total_count,31);for(const p of page.items)assert.deepEqual(new Set(Object.keys(p)),allowedKeys);
      const last=expectOk(await client.rpc('get_patient_demographics',{p_clinic_id:A,p_offset:1000}));assert.equal(last.items.length,0);assert.equal(last.total_count,31);
      const empty=expectOk(await client.rpc('get_patient_demographics',{p_clinic_id:A,p_search:'no-existe-92848'}));assert.deepEqual(empty,{items:[],total_count:0});
    });
    await check(label+' foreign clinic and financial access denied',async()=>{
      expectDenied(await client.rpc('get_patient_demographics',{p_clinic_id:B}));
      expectDenied(await client.from('patients').select('account_balance').eq('id',patientA));
      expectDenied(await client.from('patients').update({account_balance:999}).eq('id',patientA));
      for(const table of ['billings','invoices','payments','expenses','budgets'])expectDenied(await client.from(table).select('*'));
      expectDenied(await client.from('services').select('price'));expectDenied(await client.rpc('get_family_unit_with_stats',{p_representative_id:patientA}));
    });
    await check(label+' complete schedule joins and notes boundary',async()=>{
      const result=expectOk(await client.rpc('get_clinic_schedule',{p_clinic_id:A,p_start:'2026-10-01T00:00:00Z',p_end:'2026-12-01T00:00:00Z'}));
      assert.equal(result.total_count,31);assert.equal(result.items.length,31);assert.ok(result.items.every(a=>a.patients?.first_name&&a.profiles?.id===actors.doctor_A.id));
      assert.equal(result.items.every(a=>'notes' in a),label!=='receptionist_A');
      expectDenied(await client.rpc('get_clinic_schedule',{p_clinic_id:A,p_start:'2026-10-01T00:00:00Z',p_end:'2027-03-01T00:00:00Z'}));
    });
  }
  const reception=actors.receptionist_A.client,doctor=actors.doctor_A.client;
  await check('Reception base and clinical rows denied',async()=>{
    assert.deepEqual(expectOk(await reception.from('patients').select('id,first_name,clinic_id')),[]);
    assert.deepEqual(expectOk(await reception.from('appointments').select('id,notes')),[]);
    for(const table of ['clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'])assert.deepEqual(expectOk(await reception.from(table).select('*')),[]);
    expectDenied(await reception.from('patients').insert({clinic_id:A,first_name:'No insertar',last_name:'Directo'}));
  });
  await check('Reception demographic mutation preserves fields and history',async()=>{
    const result=expectOk(await reception.rpc('save_patient_demographics',{p_clinic_id:A,p_patient_id:patientA,p_data:{phone:'0990000000'}}));assert.equal(result.phone,'0990000000');
    expectOk(await reception.rpc('save_patient_demographics',{p_clinic_id:A,p_patient_id:patientA,p_data:{phone:null}}));
    for(const data of [{medical_history:{}},{account_balance:'0'},{data_consent:'true'},{clinic_id:B},{created_at:'2020-01-01'},{first_name:null},{birth_date:'invalid'}])
      expectDenied(await reception.rpc('save_patient_demographics',{p_clinic_id:A,p_patient_id:patientA,p_data:data}));
    assert.equal(trusted(`SELECT account_balance FROM public.patients WHERE id='${patientA}';`),baselineMoney);
  });
  await check('Reception appointment RPC works without clinical notes',async()=>{
    const data={patient_id:patientA,doctor_id:actors.doctor_A.id,start_time:'2026-10-05T13:00:00Z',end_time:'2026-10-05T13:30:00Z',status:'scheduled',type:'Control'};
    const created=expectOk(await reception.rpc('save_clinic_appointment',{p_clinic_id:A,p_data:data}));assert.ok(created.id);assert.equal('notes' in created,false);
    expectDenied(await reception.rpc('save_clinic_appointment',{p_clinic_id:A,p_data:{...data,notes:'No autorizado'}}));
    expectDenied(await reception.rpc('save_clinic_appointment',{p_clinic_id:A,p_data:{...data,patient_id:patientB}}));
    expectDenied(await reception.rpc('save_clinic_appointment',{p_clinic_id:A,p_data:{...data,doctor_id:actors.doctor_B.id}}));
  });
  await check('Clinical authorized read and HCU own author preserves absent chart fields',async()=>{
    const result=expectOk(await doctor.rpc('get_patients_with_stats',{p_clinic_id:A,p_patient_id:patientA}));assert.equal(result.items[0].clinical_notes,'Nota clínica sintética');assert.ok(!('account_balance' in result.items[0]));
    const hcu=expectOk(await doctor.from('hcu033_forms').insert({clinic_id:A,patient_id:patientA,form_data:{motivo_consulta:'Consulta sintética'}}).select('id,doctor_id').single());
    assert.equal(hcu.doctor_id,actors.doctor_A.id);
    const chart=JSON.parse(trusted(`SELECT odontogram_state FROM public.patients WHERE id='${patientA}';`));assert.deepEqual(chart,{'11':{status:'healthy'}});
    expectDenied(await doctor.from('hcu033_forms').insert({clinic_id:A,patient_id:patientB,form_data:{}}));
    expectDenied(await doctor.from('prescriptions').insert({clinic_id:A,patient_id:patientA,doctor_id:actors.owner_A.id,data:{}}));
  });
  await check('Editable Auth metadata cannot promote receptionist',async()=>{
    expectOk(await actors.receptionist_A.login.auth.updateUser({data:{role:'clinic_owner',clinic_id:B,status:'active'}}));
    expectDenied(await reception.rpc('get_patients_with_stats',{p_clinic_id:A}));
    expectDenied(await reception.rpc('get_patient_demographics',{p_clinic_id:B}));
    expectOk(await reception.rpc('get_patient_demographics',{p_clinic_id:A}));
  });
  await check('Multiclinic role follows membership, not primary clinic',async()=>{
    const c=actors.dual_role.client;
    expectOk(await c.rpc('get_patients_with_stats',{p_clinic_id:A}));expectDenied(await c.rpc('get_patients_with_stats',{p_clinic_id:B}));
    expectOk(await c.rpc('get_patient_demographics',{p_clinic_id:B}));
    const directory=expectOk(await reception.rpc('get_clinic_staff_directory',{p_clinic_id:A}));assert.ok(directory.some(x=>x.id===actors.dual_role.id&&x.role==='doctor'));
  });
  await check('Cross-clinic family and immutable author rejected even for dual owner',async()=>{
    expectDenied(await actors.dual_owner.client.from('patients').update({family_representative_id:patientB}).eq('id',patientA));
    expectDenied(await doctor.from('patient_notes').insert({clinic_id:A,patient_id:patientA,author_id:actors.owner_A.id,content:'Autor ajeno'}));
    expectDenied(await doctor.from('patient_notes').insert({clinic_id:A,patient_id:patientA,author_id:actors.doctor_A.id,created_at:'2020-01-01',content:'Fecha inventada'}));
  });
  const bytes=Buffer.from('%PDF-1.4\nClinia synthetic acceptance bytes\n%%EOF');
  const filePath=`${A}/${patientA}/synthetic-${crypto.randomBytes(4).toString('hex')}.pdf`;
  await check('Storage clinical bytes positive, reception/foreign paths denied',async()=>{
    expectOk(await doctor.storage.from('patient-files').upload(filePath,bytes,{contentType:'application/pdf'}));
    const download=expectOk(await doctor.storage.from('patient-files').download(filePath));assert.equal(digest(Buffer.from(await download.arrayBuffer())),digest(bytes));
    expectOk(await doctor.storage.from('patient-files').createSignedUrl(filePath,60));
    expectDenied(await reception.storage.from('patient-files').download(filePath));
    expectDenied(await doctor.storage.from('patient-files').upload(`${A}/${patientB}/foreign.pdf`,bytes,{contentType:'application/pdf'}));
    expectDenied(await doctor.storage.from('patient-files').upload(`${A}/not-a-uuid/no.pdf`,bytes,{contentType:'application/pdf'}));
  });
  await check('Storage registered clinical bytes immutable',async()=>{
    expectOk(await doctor.from('patient_files').insert({clinic_id:A,patient_id:patientA,uploaded_by:actors.doctor_A.id,name:'Sintético',file_path:filePath,size:bytes.length,type:'application/pdf'}));
    expectDenied(await doctor.storage.from('patient-files').upload(filePath,Buffer.from('%PDF-1.4\nREPLACED'),{contentType:'application/pdf',upsert:true}));
    // Storage delete may return success with an empty list under RLS; bytes are the invariant.
    const removed=await doctor.storage.from('patient-files').remove([filePath]);if(!removed.error)assert.equal(removed.data.length,0);
    const download=expectOk(await doctor.storage.from('patient-files').download(filePath));assert.equal(digest(Buffer.from(await download.arrayBuffer())),digest(bytes));
  });
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
  await check('Storage operational avatar upsert and branding roles',async()=>{
    const avatar=`${A}/${patientA}/avatar.png`;
    expectOk(await reception.storage.from('patient-avatars').upload(avatar,png,{contentType:'image/png'}));
    expectOk(await reception.storage.from('patient-avatars').upload(avatar,png,{contentType:'image/png',upsert:true}));
    const branding=`${A}/logo.png`;
    expectOk(await actors.owner_A.client.storage.from('clinic-branding').upload(branding,png,{contentType:'image/png'}));
    expectOk(await reception.storage.from('clinic-branding').download(branding));
    expectDenied(await reception.storage.from('clinic-branding').upload(`${A}/not-owner.png`,png,{contentType:'image/png'}));
    expectDenied(await actors.doctor_B.client.storage.from('clinic-branding').download(branding));
  });
  await check('Committed removal immediately denies original Auth JWT',async()=>{
    trusted(`UPDATE public.clinic_members SET status='removed' WHERE user_id='${actors.doctor_A.id}' AND clinic_id='${A}';`);
    try{
      expectDenied(await doctor.rpc('get_patient_demographics',{p_clinic_id:A}));expectDenied(await doctor.rpc('get_clinic_schedule',{p_clinic_id:A,p_start:'2026-10-01T00:00:00Z',p_end:'2026-11-01T00:00:00Z'}));
      assert.deepEqual(expectOk(await doctor.from('prescriptions').select('id')),[]);
      expectDenied(await doctor.storage.from('patient-files').download(filePath));
    }finally{trusted(`UPDATE public.clinic_members SET status='active' WHERE user_id='${actors.doctor_A.id}' AND clinic_id='${A}';`);}
    expectOk(await doctor.rpc('get_patient_demographics',{p_clinic_id:A}));
  });
  await check('Inactive profile denies original JWT despite active membership',async()=>{
    const statuses=JSON.parse(trusted("SELECT json_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid='public.user_status'::regtype;"));
    const suspended=statuses.find(s=>s!=='active');assert.match(suspended,/^[a-z_]+$/);
    trusted(`UPDATE public.profiles SET status='${suspended}' WHERE id='${actors.doctor_A.id}';`);
    try{expectDenied(await doctor.rpc('get_patient_demographics',{p_clinic_id:A}));expectDenied(await doctor.storage.from('patient-files').download(filePath));}
    finally{trusted(`UPDATE public.profiles SET status='active' WHERE id='${actors.doctor_A.id}';`);}
  });
  await check('Committed demotion removes clinical access with original JWT',async()=>{
    trusted(`UPDATE public.clinic_members SET role='receptionist' WHERE user_id='${actors.doctor_A.id}' AND clinic_id='${A}';`);
    try{expectDenied(await doctor.rpc('get_patients_with_stats',{p_clinic_id:A}));expectOk(await doctor.rpc('get_patient_demographics',{p_clinic_id:A}));expectDenied(await doctor.storage.from('patient-files').download(filePath));}
    finally{trusted(`UPDATE public.clinic_members SET role='doctor' WHERE user_id='${actors.doctor_A.id}' AND clinic_id='${A}';`);}
  });
  await check('Removed and anonymous have no tenant capabilities',async()=>{
    for(const c of [actors.removed_A.client,anonymous]){expectDenied(await c.rpc('get_patient_demographics',{p_clinic_id:A}));expectDenied(await c.storage.from('patient-files').download(filePath));}
    expectDenied(await anonymous.from('patients').select('id'));
  });
  await check('Synthetic historical financial value unchanged',async()=>assert.equal(trusted(`SELECT account_balance FROM public.patients WHERE id='${patientA}';`),baselineMoney));
  report.state=report.checks.every(c=>c.passed)?'LOCAL_PROVIDER_SLICE_VERIFIED_ACCEPTANCE_PARTIAL':'PARTIAL_FAILED_CASES';
}
main().catch(e=>{report.error=e.message;process.exitCode=1;console.error(e.message);}).finally(()=>{
  report.completedAt=new Date().toISOString();
  if(fs.existsSync(output))fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({state:report.state,passed:report.checks.filter(c=>c.passed).length,total:report.checks.length,
    failures:report.checks.filter(c=>!c.passed),error:report.error||null,evidence:output},null,2));
});
