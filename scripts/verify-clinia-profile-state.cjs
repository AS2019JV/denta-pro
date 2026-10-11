'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const local=require('./clinia-local-runtime.cjs');
const output=path.join(local.repo,'docs/production/evidence/2026-09-27/auth-profile-state');
const A='33333333-3333-4333-8333-333333333333',patient='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const report={startedAt:new Date().toISOString(),environment:'local-synthetic-primary',checks:[],state:'PARTIAL',
  repairs:'Initial auth-matrix used nonexistent enum inactive. Keep that failed attempt; test every actual non-active state.'};
const trusted=text=>local.sql('postgres',"SET app.scoped_fixture_authorized='local-synthetic';\n"+text,'postgres');
async function main(){
  if(fs.existsSync(output))throw new Error('Evidence already exists');fs.mkdirSync(output,{recursive:true});
  report.runtime=local.inspectLocal();
  const actor=JSON.parse(fs.readFileSync(path.join(local.privateDir,'encargo02-actors.private.json'),'utf8')).doctor_A;
  assert.match(actor.id,/^[a-f0-9-]{36}$/);
  const keys=local.keys();
  const signin=createClient(local.url,keys.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await signin.auth.signInWithPassword({email:actor.email,password:actor.password});assert.equal(login.error,null);assert.equal(login.data.user.id,actor.id);
  const token=login.data.session.access_token;
  report.auth={method:'actual signInWithPassword before transitions',tokenSha256:crypto.createHash('sha256').update(token).digest('hex')};
  const client=createClient(local.url,keys.anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
  report.actualEnum=JSON.parse(trusted("SELECT json_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid='public.user_status'::regtype;"));
  const filename=JSON.parse(trusted(`SELECT json_agg(file_path) FROM public.patient_files WHERE patient_id='${patient}';`))[0];
  assert.match(filename,/^33333333-3333-4333-8333-333333333333\/cccccccc-cccc-4ccc-8ccc-cccccccccccc\/[^/]+$/);
  for(const state of report.actualEnum.filter(x=>x!=='active')){
    assert.match(state,/^[a-z_]+$/);
    trusted(`UPDATE public.profiles SET status='${state}' WHERE id='${actor.id}';`);
    try{
      const rpc=await client.rpc('get_patient_demographics',{p_clinic_id:A});assert.ok(rpc.error);
      const storage=await client.storage.from('patient-files').download(filename);assert.ok(storage.error);
      report.checks.push({state,rpcStatus:rpc.status,rpcCode:rpc.error.code,storageDenied:true,passed:true});
    }finally{trusted(`UPDATE public.profiles SET status='active' WHERE id='${actor.id}';`);}
  }
  trusted(`UPDATE public.profiles SET deleted_at=now() WHERE id='${actor.id}';`);
  try{assert.ok((await client.rpc('get_patient_demographics',{p_clinic_id:A})).error);assert.ok((await client.storage.from('patient-files').download(filename)).error);report.checks.push({state:'deleted_at',passed:true});}
  finally{trusted(`UPDATE public.profiles SET deleted_at=NULL WHERE id='${actor.id}';`);}
  assert.equal((await client.rpc('get_patient_demographics',{p_clinic_id:A})).error,null);
  report.restoredActive=true;report.state='LOCAL_PROFILE_STATE_VERIFIED';
}
main().catch(e=>{report.error=e.message;console.error(e.message);process.exitCode=1;}).finally(()=>{
  report.completedAt=new Date().toISOString();if(fs.existsSync(output))fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({state:report.state,enum:report.actualEnum,checks:report.checks,error:report.error||null,evidence:output}));
});
