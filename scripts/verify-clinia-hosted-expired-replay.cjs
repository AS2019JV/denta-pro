'use strict';
// Read-only, exact original matrix credentials. Deliberately bypasses only the
// live-actor prerequisite to test expiry; it never refreshes or alters fixtures.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime=require('./clinia-staging-runtime.cjs'),driver=require('./verify-clinia-hosted-api.cjs');
async function main(){
 assert.deepEqual(process.argv.slice(2),['1',driver.PROJECT]);
 const config=runtime.readConfig(),plan=driver.plan('matrix','1',driver.PROJECT,'3'),state=JSON.parse(fs.readFileSync(plan.privateFile));
 assert.equal(state.project,driver.PROJECT);assert.equal(state.attempt,'1');
 driver.verifiedMatrix(state,plan.directory,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'verify-clinia-hosted-api.cjs'))).digest('hex'));
 const actor=state.actors.doctor_A,claims=JSON.parse(Buffer.from(actor.token.split('.')[1],'base64url'));
 assert.equal(claims.sub,actor.id);assert.equal(claims.role,'authenticated');assert.ok(Number.isFinite(claims.exp)&&claims.exp*1000<Date.now(),'Original JWT must already be expired');
 const item=driver.mediaSpecs(state,'3')[0],requests=[];
 for(const [route,method,body] of [
  ['/rest/v1/rpc/get_clinic_member_role','POST',{check_clinic_id:state.fixtures.clinicA}],
  ['/storage/v1/object/'+item.bucket+'/'+item.object,'GET'],
  ['/storage/v1/object/authenticated/'+item.bucket+'/'+item.object,'GET']
 ]){
  const url=driver.providerUrl(config.origin+route),response=await fetch(url,{method,headers:{apikey:config.anon,Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  const bytes=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(bytes.toString())}catch{}
  requests.push({path:url.pathname,status:response.status,code:data?.code||data?.error||null,...(url.pathname.startsWith('/rest/')?{providerErrorConfirmsExpiration:/\bexpired\b/i.test(data?.message||'')} : {}),cfCacheStatus:response.headers.get('cf-cache-status'),cacheControl:response.headers.get('cache-control'),bytes:bytes.length,bodySha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 assert.equal(requests[0].status,401);assert.equal(requests[0].code,'PGRST303','Provider must actually reject expired JWT');assert.equal(requests[0].providerErrorConfirmsExpiration,true);
 const report={status:requests.slice(1).every(r=>[400,401,403,404].includes(r.status))?'VERIFIED':'PARTIALLY VERIFIED',project:driver.PROJECT,actor:'doctor_A',jwtExpiredAt:new Date(claims.exp*1000).toISOString(),executedAt:new Date().toISOString(),requests,scope:'Original expired JWT, exact warmed synthetic patient-file paths in this region; no universal cache-duration, all-bucket or production claim',driverSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')};
 const file=path.join(plan.directory,'expired-replay-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify(report));if(report.status!=='VERIFIED')process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('Exact expired-JWT evidence prerequisite or transport failed; no credentials printed');process.exitCode=1});
