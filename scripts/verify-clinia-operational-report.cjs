'use strict';
// One local migration + ordinary Auth/JWT checks; no dotenv/provider/remote use.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const local=require('./clinia-local-runtime.cjs');
const attempt=process.argv[2]||'1';if(!/^[1-9]$/.test(attempt))throw new Error('Attempt refused');
const out=path.join(local.repo,'docs/production/evidence/2026-09-28-convergence/reports-'+attempt);
const A='33333333-3333-4333-8333-333333333333',B='44444444-4444-4444-8444-444444444444',patient='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const day='2051-07-'+attempt.padStart(2,'0'),start=Date.parse(day+'T05:00:00Z'),end=start+86400000;
const report={startedAt:new Date().toISOString(),state:'PARTIAL',checks:[],requests:[],created:[],limits:['Local synthetic JWT/API evidence, not remote deployment','Future synthetic states only test report calculations, not clinical/temporal approval','No large-volume load or recovery claim']};
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
const denied=r=>{assert.ok(r.error);assert.equal(r.data,null);};
const trusted=sql=>local.sql('postgres',"SET app.scoped_fixture_authorized='local-synthetic';\n"+sql,'postgres');
let made=false;
async function check(name,fn){try{await fn();report.checks.push({name,passed:true});console.log('PASS '+name);}catch(e){report.checks.push({name,passed:false,error:e.message});process.exitCode=1;console.error('FAIL '+name+': '+e.message);}}
async function main(){
  if(fs.existsSync(out))throw new Error('Existing evidence; do not replay fixtures');fs.mkdirSync(out,{recursive:true});made=true;
  report.runtime=local.inspectLocal();
  const migration='tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql';
  report.migration={path:migration,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(local.repo,migration))).digest('hex')};
  const exists=trusted("SELECT to_regprocedure('public.get_clinic_operational_report(uuid,timestamptz,timestamptz)') IS NOT NULL;");
  if(exists==='f'){fs.writeFileSync(path.join(out,'migration.log'),local.sqlFile('postgres',migration,'postgres'));report.migration.state='COMMITTED';}
  else if(attempt!=='1')report.migration.state='EXISTING_VERIFICATION_ONLY';
  else throw new Error('Unexpected prior report installation; review before testing');
  const keys=local.keys(),actors=JSON.parse(fs.readFileSync(path.join(local.privateDir,'encargo02-actors.private.json'),'utf8')),clients={};
  function client(label){return createClient(local.url,keys.anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url);assert.equal(url.origin,local.url);const t=performance.now(),r=await fetch(input,{...init,signal:AbortSignal.timeout(15000)});report.requests.push({actor:label,path:url.pathname,status:r.status,ms:Number((performance.now()-t).toFixed(1))});return r;}}});}
  for(const label of ['owner_A','doctor_A','receptionist_A','removed_A','owner_B']){
    clients[label]=client(label);ok(await clients[label].auth.signInWithPassword({email:actors[label].email,password:actors[label].password}));
  }
  const moneyBefore=trusted("SELECT md5(jsonb_agg(jsonb_build_object('id',id,'balance',account_balance) ORDER BY id)::text) FROM public.patients;");
  assert.equal(trusted(`SELECT count(*) FROM public.appointments WHERE start_time>='${new Date(start-3600000).toISOString()}' AND start_time<'${new Date(end+3600000).toISOString()}';`),'0','Fresh synthetic interval required');
  async function save(id,input){return ok(await clients.receptionist_A.rpc('save_clinic_appointment',{p_clinic_id:A,p_appointment_id:id,p_data:input}));}
  const rows=[];
  for(const [index,status]of ['scheduled','confirmed','arrived','completed','cancelled','no_show'].entries()){
    const when=start+index*3600000;
    const row=await save(null,{patient_id:patient,doctor_id:actors.doctor_A.id,start_time:new Date(when).toISOString(),end_time:new Date(when+1800000).toISOString(),type:'Ensayo informe '+status,status:'scheduled'});
    report.created.push(row.id);rows.push(row);
    if(status==='completed'){await save(row.id,{status:'arrived'});await save(row.id,{status});}
    else if(status!=='scheduled')await save(row.id,{status});
  }
  for(const when of [start-1800000,end]){const row=await save(null,{patient_id:patient,doctor_id:actors.doctor_A.id,start_time:new Date(when).toISOString(),end_time:new Date(when+900000).toISOString(),type:'Límite sintético',status:'scheduled'});report.created.push(row.id);}
  const params={p_clinic_id:A,p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString()};
  for(const label of ['owner_A','doctor_A','receptionist_A'])await check(label+' exact counts, closed attendance and exclusive Ecuador midnight',async()=>{
    const data=ok(await clients[label].rpc('get_clinic_operational_report',params));
    assert.equal(data.clinic_id,A);assert.equal(data.summary.appointments,6);assert.equal(data.summary.completed,1);assert.equal(data.summary.noShow,1);assert.equal(data.summary.cancelled,1);assert.equal(data.summary.attendanceRate,50);
    assert.deepEqual(data.statuses,{scheduled:1,confirmed:1,arrived:1,completed:1,cancelled:1,no_show:1});assert.equal(data.monthly.length,1);assert.equal(data.monthly[0].appointments,6);assert.equal(data.monthly[0].newPatients,0);
    assert.equal(data.summary.activePatients,Number(trusted(`SELECT count(*) FROM public.patients WHERE clinic_id='${A}' AND status='active' AND deleted_at IS NULL;`)));
    assert.doesNotMatch(JSON.stringify(data),/account_balance|revenue|price|clinical_notes|first_name|last_name/);
  });
  await check('foreign clinic, retired member and anonymous denied',async()=>{denied(await clients.owner_A.rpc('get_clinic_operational_report',{...params,p_clinic_id:B}));denied(await clients.removed_A.rpc('get_clinic_operational_report',params));denied(await client('anonymous').rpc('get_clinic_operational_report',params));});
  await check('empty period and invalid ranges have honest results',async()=>{
    const data=ok(await clients.owner_B.rpc('get_clinic_operational_report',{...params,p_clinic_id:B}));assert.equal(data.summary.appointments,0);assert.equal(data.summary.attendanceRate,null);
    for(const p of [{p_start:null},{p_end:params.p_start},{p_end:'infinity'},{p_end:'2054-01-01T00:00:00Z'}])denied(await clients.owner_A.rpc('get_clinic_operational_report',{...params,...p}));
  });
  await check('historical financial values unchanged',async()=>assert.equal(trusted("SELECT md5(jsonb_agg(jsonb_build_object('id',id,'balance',account_balance) ORDER BY id)::text) FROM public.patients;"),moneyBefore));
  report.state=report.checks.every(c=>c.passed)?'LOCAL_REPORT_JWT_VERIFIED':'PARTIAL';
}
main().catch(e=>{report.failure=e.message;process.exitCode=1;console.error(e.message);}).finally(()=>{report.completedAt=new Date().toISOString();if(made)fs.writeFileSync(path.join(out,'execution.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks,failure:report.failure||null,evidence:out}));});
