'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime=require('./clinia-staging-runtime.cjs'),driver=require('./verify-clinia-hosted-api.cjs');
async function main(){
 const mode=process.argv[2];assert.ok(['prepare','revoked'].includes(mode));
 const config=runtime.readConfig(),p=driver.plan('matrix','1',driver.PROJECT,'3'),s=driver.ownedState(JSON.parse(fs.readFileSync(p.privateFile)),'1');
 driver.verifiedMatrix(s,p.directory,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'verify-clinia-hosted-api.cjs'))).digest('hex'));
 const actor=s.actors.doctor_A;driver.jwtUnexpired(actor.token,actor.id);
 const privateFile=path.join(path.dirname(p.privateFile),'clinia-nostore-1.private.json');
 const item=mode==='prepare'?{bucket:'patient-files',object:s.fixtures.clinicA+'/'+s.fixtures.patientA+'/nostore-'+crypto.randomUUID()+'.pdf'}:JSON.parse(fs.readFileSync(privateFile));
 assert.equal(item.bucket,'patient-files');assert.ok(item.object.startsWith(s.fixtures.clinicA+'/'+s.fixtures.patientA+'/nostore-'));assert.ok(!item.object.includes('..'));
 const report={status:'PARTIALLY VERIFIED',project:driver.PROJECT,mode,startedAt:new Date().toISOString(),requests:[],scope:'New owned synthetic PDF only; tests response no-store instead of trusting upload configuration'};
 async function q(route,method='GET',body,contentType='application/json'){
  const u=driver.providerUrl(config.origin+route),r=await fetch(u,{method,headers:{apikey:config.anon,Authorization:'Bearer '+actor.token,'Content-Type':contentType,'Cache-Control':'private, no-store, max-age=0, must-revalidate','x-upsert':'false'},body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  const bytes=Buffer.from(await r.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString())}catch{}
  report.requests.push({method,path:u.pathname,status:r.status,code:data?.code||null,cacheControl:r.headers.get('cache-control'),cfCacheStatus:r.headers.get('cf-cache-status'),bytes:bytes.length,bodySha256:crypto.createHash('sha256').update(bytes).digest('hex')});return{r,data,bytes};
 }
 try{
  if(mode==='prepare'){
   assert.ok(!fs.existsSync(privateFile));const bytes=Buffer.from('%PDF-1.4\nClinia synthetic no-store transport proof\n%%EOF');
   const upload=await q('/storage/v1/object/'+item.bucket+'/'+item.object,'POST',bytes,'application/pdf');assert.ok([200,201].includes(upload.r.status));fs.writeFileSync(privateFile,JSON.stringify(item),{flag:'wx'});
   for(let i=0;i<3;i++){const get=await q('/storage/v1/object/'+item.bucket+'/'+item.object);assert.equal(get.r.status,200);assert.deepEqual(get.bytes,bytes);}
   await q('/storage/v1/object/authenticated/'+item.bucket+'/'+item.object);
   report.status=report.requests.slice(1).every(x=>/no-store/.test(x.cacheControl||'') && x.cfCacheStatus!=='HIT')?'VERIFIED':'PARTIALLY VERIFIED';
  }else{
   const role=await q('/rest/v1/rpc/get_clinic_member_role','POST',JSON.stringify({check_clinic_id:s.fixtures.clinicA}));assert.equal(role.r.status,200);assert.equal(role.data,null);
   const clinical=await q('/rest/v1/rpc/get_patients_with_stats','POST',JSON.stringify({p_clinic_id:s.fixtures.clinicA,p_patient_id:s.fixtures.patientA}));assert.equal(clinical.data?.code,'42501');assert.equal(clinical.r.status,403);
   const signed=await q('/storage/v1/object/sign/'+item.bucket+'/'+item.object,'POST',JSON.stringify({expiresIn:5}));assert.equal(signed.r.status,400);assert.equal(signed.data?.code,'NoSuchKey');
   const replayStart=report.requests.length;report.liveRevocationControls='VERIFIED';
   for(let i=0;i<2;i++)await q('/storage/v1/object/'+item.bucket+'/'+item.object);
   await q('/storage/v1/object/authenticated/'+item.bucket+'/'+item.object);
   report.status=report.requests.slice(replayStart).every(x=>[400,401,403,404].includes(x.status)&&x.code==='NoSuchKey')?'VERIFIED':'PARTIALLY VERIFIED';
  }
 }catch{report.failure='Owned synthetic no-store probe failed; safe technical metadata preserved';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();const f=path.join(p.directory,'nostore-'+mode+'-'+Date.now()+'.json');fs.writeFileSync(f,JSON.stringify(report,null,2),{flag:'wx'});if(report.status!=='VERIFIED')process.exitCode=1;console.log(JSON.stringify(report));}
}
if(require.main===module)main().catch(()=>{console.error('Fixed synthetic no-store prerequisites refused');process.exitCode=1;});
