'use strict';
// One new disposable PNG in the authorized synthetic staging clinic. Tests
// provider invalidation with an unexpired, byte-identical signed capability.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');
const runtime=require('./clinia-staging-runtime.cjs');
const PROJECT='phihonofwyerpfgqfekt',CLINIC='d9a47157-1d36-43df-af1d-436d561ee551';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const privateFile=path.join(runtime.repo,'tools/local-supabase/supabase/.temp/retirement-causal.private.json');
const directory=path.join(runtime.repo,'docs/production/evidence/2026-10-06-phase1-origin');
function validate(state){assert.equal(state.project,PROJECT);assert.equal(state.bucket,'clinic-branding');assert.match(state.key,new RegExp('^'+CLINIC+'/retirement-probe-[a-f0-9-]{36}\\.png$'));const u=new URL(state.request.url);assert.equal(u.origin,'https://'+PROJECT+'.supabase.co');assert.equal(decodeURIComponent(u.pathname),'/storage/v1/object/sign/'+state.bucket+'/'+state.key);assert.equal([...u.searchParams.keys()].join(','),'token');assert.equal(state.request.method,'GET');assert.deepEqual(state.request.headers,{'cache-control':'no-cache'});assert.match(state.sha256,/^[a-f0-9]{64}$/);assert.equal(sha(Buffer.from(state.backupBase64,'base64')),state.sha256);assert.equal(Buffer.from(state.backupBase64,'base64').length,68);}
async function main(args){assert.equal(args.length,2);const [phase,project]=args;assert.equal(project,PROJECT);assert.ok(['prepare','replay'].includes(phase));
 const config=runtime.readConfig();const client=createClient(config.origin,config.service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(u,i)=>fetch(u,{...i,redirect:'error',signal:AbortSignal.timeout(20000)})}});
 const evidence={status:'NOT VERIFIED',command:'node scripts/verify-clinia-retirement-causal.cjs '+args.join(' '),project,phase,startedAt:new Date().toISOString(),driverSha256:sha(fs.readFileSync(__filename)),checks:[],limits:['Maintenance-only synthetic disposable object; no ordinary-user authorization or production historical-retirement proof']};
 fs.mkdirSync(directory,{recursive:true});const output=path.join(directory,'causal-'+phase+'-'+Date.now()+'.json'),persist=()=>fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');persist();
 try{let state;
  if(phase==='prepare'){
   assert.ok(!fs.existsSync(privateFile),'Never overwrite a capability capture');
   const plan=JSON.parse(fs.readFileSync(path.join(runtime.repo,'tools/local-supabase/supabase/.temp/phase1-legacy-retirement.private.json')));
   assert.equal(plan.project,PROJECT);const png=Buffer.from(plan.objects.find(o=>o.bucket==='clinic-branding').backupBase64,'base64');assert.equal(png.length,68);assert.ok(png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
   const key=CLINIC+'/retirement-probe-'+crypto.randomUUID()+'.png';
   state={project,bucket:'clinic-branding',key,backupBase64:png.toString('base64'),sha256:sha(png)};
   const upload=await client.storage.from(state.bucket).upload(key,png,{contentType:'image/png',upsert:false,cacheControl:'0'});assert.ok(!upload.error,'Synthetic upload failed');
   const signed=await client.storage.from(state.bucket).createSignedUrl(key,3600);assert.ok(!signed.error&&signed.data?.signedUrl);state.request={url:signed.data.signedUrl,method:'GET',headers:{'cache-control':'no-cache'}};validate(state);
   state.capturedAt=new Date().toISOString();fs.writeFileSync(privateFile,JSON.stringify(state,null,2),{flag:'wx'});
   const r=await fetch(state.request.url,{method:'GET',headers:state.request.headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});const b=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);assert.equal(sha(b),state.sha256);state.warmedAt=new Date().toISOString();evidence.checks.push({name:'Original signed request returns exact synthetic bytes',status:r.status,hashMatched:true,requestSha256:sha(JSON.stringify(state.request)),cache:r.headers.get('cf-cache-status')});persist();
   const deleted=await client.storage.from(state.bucket).remove([key]);assert.ok(!deleted.error);state.deletedAt=new Date().toISOString();assert.ok(Date.parse(state.deletedAt)-Date.parse(state.warmedAt)<120000,'Deletion must precede capability expiration');state.stage='DELETED';fs.writeFileSync(privateFile,JSON.stringify(state,null,2));evidence.checks.push({name:'Only the newly allocated disposable object deleted through Storage API',passed:true});
  }else{
   state=JSON.parse(fs.readFileSync(privateFile));validate(state);assert.equal(state.stage,'DELETED');assert.ok(Date.now()-Date.parse(state.deletedAt)>=65000,'Documented CDN invalidation window required');
   const signedJwt=new URL(state.request.url).searchParams.get('token');const claims=JSON.parse(Buffer.from(signedJwt.split('.')[1],'base64url'));assert.ok(claims.exp*1000>Date.now()+60000,'Unexpired capability required for causal attribution');
   const r=await fetch(state.request.url,{method:state.request.method,headers:state.request.headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());let body;try{body=JSON.parse(bytes.toString())}catch{}
   const missing=[403,404].includes(r.status)||(r.status===400&&['403','404'].includes(String(body?.statusCode))&&/not found|does not exist/i.test(body?.message||''));
   evidence.checks.push({name:'Exact previously successful, still-unexpired signed request denied after removal',status:r.status,bytes:bytes.length,bodySha256:sha(bytes),requestSha256:sha(JSON.stringify(state.request)),cache:r.headers.get('cf-cache-status'),tokenExpiresAt:new Date(claims.exp*1000).toISOString(),passed:missing});persist();assert.ok(missing);assert.notEqual(sha(bytes),state.sha256);
   const s3=new S3Client({region:'sa-east-1',endpoint:`https://${PROJECT}.storage.supabase.co/storage/v1/s3`,forcePathStyle:true,maxAttempts:1,credentials:{accessKeyId:PROJECT,secretAccessKey:config.anon,sessionToken:config.service}});
   try{let missingOrigin=false;try{const o=await s3.send(new GetObjectCommand({Bucket:state.bucket,Key:state.key}),{abortSignal:AbortSignal.timeout(15000)});o.Body?.destroy()}catch(e){missingOrigin=e?.$metadata?.httpStatusCode===404}assert.ok(missingOrigin);evidence.checks.push({name:'Provider origin independently confirms object absent',passed:true});}finally{s3.destroy()}
  }
  evidence.status='VERIFIED';
 }catch{evidence.failure='Synthetic guard, byte hash or exact unexpired capability denial failed; no secret/provider body emitted';process.exitCode=1;}
 finally{evidence.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:evidence.status,evidence:output}));}
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Exact staging retirement prerequisites refused');process.exitCode=1});
module.exports={validate};
