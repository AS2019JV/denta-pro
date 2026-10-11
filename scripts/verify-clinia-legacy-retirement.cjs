'use strict';
// Operator-controlled maintenance of exactly six synthetic staging objects.
// Service credential is confined to backup/copy/sign/delete of this allowlist;
// it is never application authority, never returned, and never targets production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const runtime=require('./clinia-staging-runtime.cjs');
const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');
const PROJECT='phihonofwyerpfgqfekt',CLINIC='d9a47157-1d36-43df-af1d-436d561ee551',PATIENT='b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14',DOCTOR='272d63b1-38e3-4a60-89a2-dd07f031b2d2';
const specs=Object.freeze([
 ['patient-files',`${CLINIC}/${PATIENT}/hosted-1-run-2.pdf`,70,'1f3c816b91e3f7f6737d99f5be95be1b82a7e7cffc73a7a40c4c275dbcca1552'],
 ['patient-files',`${CLINIC}/${PATIENT}/hosted-1-run-3.pdf`,70,'1f3c816b91e3f7f6737d99f5be95be1b82a7e7cffc73a7a40c4c275dbcca1552'],
 ['patient-files',`${CLINIC}/${PATIENT}/nostore-e3e326f1-f046-4703-b3eb-0cad025f159e.pdf`,56,'8d3969f893e84b278b2e6d7f1a9f4f44f1d587a7d93aefa0e990dd7de28b21e4'],
 ['clinic-branding',`${CLINIC}/hosted-1-run-3.png`,68,'d8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
 ['doctor-avatars',`${DOCTOR}/hosted-1-run-3.png`,68,'d8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
 ['patient-avatars',`${CLINIC}/${PATIENT}/hosted-1-run-3.png`,68,'d8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
].map(spec=>Object.freeze(spec)));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const privateFile=path.join(runtime.repo,'tools/local-supabase/supabase/.temp/phase1-legacy-retirement.private.json');
const directory=path.join(runtime.repo,'docs/production/evidence/2026-10-06-phase1-origin');
function validate(state,allowlist=specs){
 assert.equal(state.project,PROJECT);assert.ok(Array.isArray(state.objects));assert.equal(state.objects.length,allowlist.length);
 for(let i=0;i<allowlist.length;i++){
  const o=state.objects[i],[bucket,oldPath,size,expectedHash]=allowlist[i];
  assert.equal(o.bucket,bucket);assert.equal(o.oldPath,oldPath);assert.equal(o.size,size);
  assert.equal(o.newPath.split('/').slice(0,-1).join('/'),oldPath.split('/').slice(0,-1).join('/'));
  assert.match(o.newPath.split('/').at(-1),new RegExp(`^origin-[a-f0-9-]{36}\\.${bucket==='patient-files'?'pdf':'png'}$`));
  assert.equal(typeof o.backupBase64,'string');
  const backup=Buffer.from(o.backupBase64,'base64');
  assert.equal(backup.toString('base64'),o.backupBase64,'Backup must be canonical base64');
  assert.equal(backup.length,size,'Decoded backup length must match the exact allowlist');
  assert.equal(o.sha256,expectedHash);assert.equal(sha(backup),expectedHash);
  assert.ok(o.request&&typeof o.request==='object');assert.equal(o.request.method,'GET');
  assert.deepEqual(o.request.headers,{'cache-control':'no-cache'});
  const url=new URL(o.request.url);
  assert.equal(url.protocol,'https:');assert.equal(url.origin,`https://${PROJECT}.supabase.co`);
  assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.hash,'');
  assert.equal(decodeURIComponent(url.pathname),`/storage/v1/object/sign/${bucket}/${oldPath}`);
  assert.equal([...url.searchParams.keys()].join(','),'token');assert.ok(url.searchParams.get('token'));
 }
}
function isDenial(status,body){return [401,403,404].includes(status)||(status===400&&String(body?.statusCode)==='400'&&body?.error==='InvalidJWT'&&body?.message==='Invalid JWT: "exp" claim timestamp check failed');}
async function main(args){assert.equal(args.length,2);const[phase,project]=args;assert.equal(project,PROJECT);assert.ok(['copy','delete','replay'].includes(phase));
const config=runtime.readConfig(),client=createClient(config.origin,config.service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(u,i)=>fetch(u,{...i,redirect:'error',signal:AbortSignal.timeout(20000)})}});
const s3=new S3Client({region:'sa-east-1',endpoint:`https://${PROJECT}.storage.supabase.co/storage/v1/s3`,forcePathStyle:true,maxAttempts:1,credentials:{accessKeyId:PROJECT,secretAccessKey:config.anon,sessionToken:config.service}});
const report={status:'NOT VERIFIED',project,phase,command:'node scripts/verify-clinia-legacy-retirement.cjs '+args.join(' '),driverSha256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),objects:[],limits:['Maintenance credential only for six known synthetic objects; not ordinary-user authorization proof','Newly captured signed URLs supplement missing historical captures; they do not reconstruct those missing requests','No occupied production data or production historical-capability claim']};fs.mkdirSync(directory,{recursive:true});const output=path.join(directory,'legacy-'+phase+'-'+Date.now()+'.json'),persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
async function bytes(bucket,key){assert.ok(specs.some(s=>s[0]===bucket&&s[1]===key)||state?.objects?.some(o=>o.bucket===bucket&&o.newPath===key));const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)});assert.equal(response.$metadata.httpStatusCode,200);assert.ok(response.ContentLength<=70);return Buffer.from(await response.Body.transformToByteArray());}
let state;
try{
if(phase==='copy'){
 assert.ok(!fs.existsSync(privateFile),'Never overwrite a migration capture');state={project,objects:[],createdAt:new Date().toISOString()};fs.writeFileSync(privateFile,JSON.stringify(state),{flag:'wx'});
 for(const[bucket,oldPath,size]of specs){
  const old=await bytes(bucket,oldPath);assert.equal(old.length,size);assert.ok(oldPath.endsWith('.png')?old.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):old.toString().includes('synthetic')||old.toString().includes('Synthetic'));
  const newPath=oldPath.slice(0,oldPath.lastIndexOf('/')+1)+'origin-'+crypto.randomUUID()+path.extname(oldPath),mime=oldPath.endsWith('.png')?'image/png':'application/pdf';
  const o={bucket,oldPath,newPath,size,sha256:sha(old),backupBase64:old.toString('base64'),copied:false};state.objects.push(o);fs.writeFileSync(privateFile,JSON.stringify(state,null,2));
  const uploaded=await client.storage.from(bucket).upload(newPath,old,{contentType:mime,upsert:false,cacheControl:'0'});assert.ok(!uploaded.error,'Synthetic copy failed');
  assert.equal(sha(await bytes(bucket,newPath)),o.sha256);o.copied=true;
  const signed=await client.storage.from(bucket).createSignedUrl(oldPath,3600);assert.ok(!signed.error&&signed.data.signedUrl);const url=new URL(signed.data.signedUrl);assert.equal(url.origin,config.origin);assert.equal(decodeURIComponent(url.pathname),'/storage/v1/object/sign/'+bucket+'/'+oldPath);
  o.request={url:url.href,method:'GET',headers:{'cache-control':'no-cache'}};
  const warm=await fetch(url,{...o.request,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(warm.status,200);assert.equal(sha(Buffer.from(await warm.arrayBuffer())),o.sha256);o.warmedAt=new Date().toISOString();
  fs.writeFileSync(privateFile,JSON.stringify(state,null,2));report.objects.push({bucket,oldPath,newPath,size,sha256:o.sha256,copyHashMatched:true,signedWarmStatus:200,requestSha256:sha(JSON.stringify(o.request))});persist();
 }
 validate(state);state.stage='COPIED';fs.writeFileSync(privateFile,JSON.stringify(state,null,2));report.privateCaptureSha256=sha(fs.readFileSync(privateFile));
}else{
 state=JSON.parse(fs.readFileSync(privateFile));validate(state);assert.ok(['COPIED','DELETED'].includes(state.stage));
 if(phase==='delete'){
  assert.equal(state.stage,'COPIED');const witnessPath=path.join(directory,'legacy-cutover.provider.json');const witness=JSON.parse(fs.readFileSync(witnessPath));assert.equal(witness.isError,false);const raw=JSON.parse(witness.content[0].text).result;const start=raw.indexOf('\n[{'),end=raw.indexOf('\n</untrusted-data-',start);const checked=JSON.parse(raw.slice(start,end).trim())[0].state;
  assert.equal(checked.retired,6);assert.equal(checked.delivery_enabled,false);assert.equal(checked.document_path,state.objects[1].newPath);assert.ok(Date.now()-Date.parse(checked.observed_at)<300000,'Fresh committed cutover evidence required');report.cutoverEvidenceSha256=sha(fs.readFileSync(witnessPath));
  for(const o of state.objects){assert.equal(sha(await bytes(o.bucket,o.newPath)),o.sha256);const result=await client.storage.from(o.bucket).remove([o.oldPath]);assert.ok(!result.error,'Storage API deletion failed');report.objects.push({bucket:o.bucket,oldPath:o.oldPath,newPath:o.newPath,copyHashMatched:true,deleteApiAccepted:true});persist();}
  state.stage='DELETED';state.deletedAt=new Date().toISOString();fs.writeFileSync(privateFile,JSON.stringify(state,null,2));
 }else{
  assert.equal(state.stage,'DELETED');assert.ok(Date.now()-Date.parse(state.deletedAt)>=65000,'Allow documented CDN invalidation propagation before replay');
  for(const o of state.objects){const response=await fetch(o.request.url,{method:o.request.method,headers:o.request.headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});const body=Buffer.from(await response.arrayBuffer());let parsed;try{parsed=JSON.parse(body.toString())}catch{}
   const denied=isDenial(response.status,parsed);
   report.objects.push({bucket:o.bucket,oldPath:o.oldPath,requestSha256:sha(JSON.stringify(o.request)),expected:'No original bytes; object removed',status:response.status,bytes:body.length,bodySha256:sha(body),cache:response.headers.get('cf-cache-status'),denied});persist();assert.ok(denied);assert.notEqual(sha(body),o.sha256);
   let missing=false;try{await bytes(o.bucket,o.oldPath)}catch(e){missing=e?.$metadata?.httpStatusCode===404}assert.ok(missing,'Origin must confirm object absence');
   assert.equal(sha(await bytes(o.bucket,o.newPath)),o.sha256);
  }
 }
}
report.status='VERIFIED';
if(phase==='replay'&&state.objects.some(o=>Date.parse(state.deletedAt)-Date.parse(o.warmedAt)>=3600000)){report.status='PARTIALLY VERIFIED';report.limits.push('The captured signed capabilities expired before deletion: denial plus origin absence and copied hashes are proven, but deletion alone is not proven as the cause of signed-request denial');report.originAbsenceAndCopyHashesVerified=true;}
}catch{report.status='PARTIALLY VERIFIED';report.failure='Guard, transfer, cutover or replay assertion failed; no provider body/secrets emitted';process.exitCode=1;}
finally{s3.destroy();report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,evidence:output}));}
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Exact synthetic retirement prerequisites refused; no secrets emitted');process.exitCode=1});
module.exports={validate,specs,isDenial};
