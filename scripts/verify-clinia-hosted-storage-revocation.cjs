'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime=require('./clinia-staging-runtime.cjs'),driver=require('./verify-clinia-hosted-api.cjs');
function classifyProbe(mode,requests,listData){
 assert.ok(['warm','revoked'].includes(mode));
 if(requests.length!==7 || requests[0].status!==200 || requests[5].status!==200 || !Array.isArray(listData))return 'PARTIALLY VERIFIED';
 const storageDenied=x=>[400,401,403,404].includes(x.status)&&x.code==='NoSuchKey';
 const replayOk=requests.slice(1,5).every(mode==='warm'?x=>x.status===200:storageDenied);
 return replayOk && storageDenied(requests[6]) && (mode==='warm'||listData.length===0)?'VERIFIED':'PARTIALLY VERIFIED';
}
async function main(){
 const mode=process.argv[2]||'revoked';assert.ok(['warm','revoked'].includes(mode),'Use warm or revoked');
 const c=runtime.readConfig(),p=driver.plan('matrix','1',driver.PROJECT,'3'),s=driver.ownedState(JSON.parse(fs.readFileSync(p.privateFile)),'1');
 driver.verifiedMatrix(s,p.directory,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'verify-clinia-hosted-api.cjs'))).digest('hex'));
 const item=driver.mediaSpecs(s,'3')[0],file='/storage/v1/object/'+item.bucket+'/'+item.object;
 const report={status:'PARTIALLY VERIFIED',project:driver.PROJECT,startedAt:new Date().toISOString(),actor:'doctor_A',mode,requests:[],scope:'Read-only synthetic cached versus fresh resource probes; same authenticated URL across committed membership removal'};
 const q=async(route,method='GET',body,token=s.actors.doctor_A.token)=>{
   const u=new URL(route,c.origin);driver.providerUrl(u.href);
   const r=await fetch(u,{method,headers:{apikey:c.anon,Authorization:'Bearer '+token,'Content-Type':'application/json','Cache-Control':'no-cache'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   const bytes=Buffer.from(await r.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString())}catch{}
   const headers={};for(const name of ['cache-control','age','cf-cache-status','x-cache','etag','date','sb-gateway-mode'])if(r.headers.has(name))headers[name]=r.headers.get(name);
   report.requests.push({method,path:u.pathname,queryPresent:!!u.search,status:r.status,code:data?.code||data?.error||null,headers,bytes:bytes.length,bodySha256:crypto.createHash('sha256').update(bytes).digest('hex')});return{status:r.status,data};
 };
 try{
   const role=await q('/rest/v1/rpc/get_clinic_member_role','POST',{check_clinic_id:s.fixtures.clinicA});assert.equal(role.status,200);assert.equal(role.data,mode==='warm'?'doctor':null);
   await q(file);await q(file+'?clinia_probe='+crypto.randomUUID());
   await q('/storage/v1/object/authenticated/'+item.bucket+'/'+item.object);
   await q('/storage/v1/object/sign/'+item.bucket+'/'+item.object,'POST',{expiresIn:5});
   const list=await q('/storage/v1/object/list/'+item.bucket,'POST',{prefix:path.posix.dirname(item.object),limit:100,offset:0});if(mode==='revoked')assert.deepEqual(list.data,[]);
   await q(file,'GET',undefined,c.anon);
   report.status=classifyProbe(mode,report.requests,list.data);
   if(report.status!=='VERIFIED')process.exitCode=1;
 }catch{report.failure='Probe failed; preserved safe technical metadata';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();const out=path.join(p.directory,'storage-revocation-'+Date.now()+'.json');fs.writeFileSync(out,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));}
}
if(require.main===module)main().catch(()=>{console.error('Exact synthetic probe prerequisites refused');process.exitCode=1});
module.exports={classifyProbe};
