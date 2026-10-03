'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime=require('./clinia-staging-runtime.cjs');
async function main(){
 assert.deepEqual(process.argv.slice(2),[runtime.project],'Explicit staging target required');
 const c=runtime.readConfig(),email='clinia-password-probe-'+crypto.randomUUID()+'@clinia.invalid';
 const report={status:'NOT VERIFIED',project:c.project,startedAt:new Date().toISOString(),expected:'An eleven-character password is rejected by hosted Auth before enrollment/mail',requests:[],limits:['Reject-policy proof only, not MFA/recovery/password-change flow or legal compliance']};
 try{
  const r=await runtime.request(c,'/auth/v1/signup',{method:'POST',body:{email,password:'Clini!a2026'}});
  report.requests.push({path:'/auth/v1/signup',status:r.status,code:r.data?.error_code||r.data?.code||null});
  report.status=[400,422].includes(r.status)&&(r.data?.error_code==='weak_password'||r.data?.code==='weak_password')?'VERIFIED':'NOT VERIFIED';
  const user=r.data?.user||r.data;
  if(r.status>=200&&r.status<300&&user?.id){assert.equal(user.email,email,'Cleanup must bind the exact owned synthetic account');assert.match(user.id,/^[a-f0-9-]{36}$/i);const clean=await runtime.request(c,'/auth/v1/admin/users/'+user.id,{method:'DELETE',token:c.service,privileged:true});report.requests.push({path:'/auth/v1/admin/users/[owned-probe]',status:clean.status});assert.ok([200,204].includes(clean.status));report.syntheticAccountRemoved=true;}
 }catch{report.failure='Guarded policy probe failed; no provider response bodies emitted';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();const dir=path.join(runtime.repo,'docs/production/evidence/2026-10-03-staging'),file=path.join(dir,'password-policy-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});if(report.status!=='VERIFIED')process.exitCode=1;console.log(JSON.stringify(report));}
}
if(require.main===module)main().catch(()=>{console.error('Exact staging policy prerequisites refused');process.exitCode=1;});
