'use strict';
// Replays the exact fresh positive-control request after principal/link removal.
// No login, refresh, authority mutation, object deletion or provider URL rotation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs'),q=require('./verify-clinia-document-requalification.cjs');
const directory=path.resolve(__dirname,'../docs/production/evidence/2026-10-05-document-requalification');
const privateDirectory=path.resolve(__dirname,'../tools/local-supabase/supabase/.temp');
function read(file){assert.ok(!fs.lstatSync(file).isSymbolicLink());const bytes=fs.readFileSync(file);return {value:JSON.parse(bytes),sha256:d.sha(bytes)};}
async function run(args){
 assert.equal(args.length,2);const [phase,project]=args;assert.equal(project,d.PROJECT);assert.ok(['disabled','protection-revoked'].includes(phase));
 const manifest=read(path.join(directory,'candidate-manifest.json'));q.validateManifest(manifest.value);
 const access=read(path.join(privateDirectory,'step1-requalification-preview-access.private.json'));const cookie=q.transport(access.value);
 const receipts=fs.readdirSync(directory).filter(n=>/^expired-\d+\.json$/.test(n)).sort().reverse();
 const expiry=receipts.map(n=>({filename:n,...read(path.join(directory,n))})).find(r=>r.value.responsesPassed===true);
 assert.ok(expiry);assert.deepEqual(expiry.value.candidate,q.validateManifest(manifest.value));
 assert.equal(expiry.value.manifestSha256,manifest.sha256);assert.equal(expiry.value.transportSha256,access.sha256);
 const controls=fs.readdirSync(privateDirectory).filter(n=>/^step1-requalification-expired-owner-\d+\.private\.json$/.test(n));
 const fresh=controls.map(n=>read(path.join(privateDirectory,n))).find(r=>r.sha256===expiry.value.positiveControlCaptureSha256);
 assert.ok(fresh);assert.equal(fresh.value.project,project);d.jwt(fresh.value.token,fresh.value.actorId);
 const prepared=read(path.join(privateDirectory,'step1-document-2.private.json')),state=prepared.value;d.preparedState(state,'2');
 assert.equal(expiry.value.preparedSha256,prepared.sha256);
 assert.equal(fresh.value.actorId,state.actors.owner_A.id);
 const original=q.documentRequest(fresh.value.token,state.scope);const requestSha256=q.binding(original);
 const positive=expiry.value.requests.filter(r=>r.actor==='fresh independent owner after expired');assert.equal(positive.length,1);
 assert.equal(positive[0].requestSha256,requestSha256);assert.equal(positive[0].status,200);assert.equal(positive[0].bodyComplete,true);
 assert.equal(positive[0].bodySha256,d.sha(d.PDF));assert.equal(positive[0].bytes,d.PDF.length);
 const report={status:'NOT VERIFIED',phase,project,candidate:q.validateManifest(manifest.value),startedAt:new Date().toISOString(),
  command:'node scripts/verify-clinia-document-closeout.cjs '+args.join(' '),driverSha256:d.sha(fs.readFileSync(__filename)),
  manifestSha256:manifest.sha256,transportSha256:access.sha256,positiveEvidence:{filename:expiry.filename,sha256:expiry.sha256},
  originalRequestSha256:requestSha256,requests:[],limits:['Synthetic PDF; exact fresh-owner positive-control request',
   'Vercel access removal is separate from application authorization; no production or credential mutation']};
 const file=path.join(directory,'closeout-'+phase+'-'+Date.now()+'.json');
 const persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 try{for(let i=0;i<2;i++){
  const receipt={expected:phase==='disabled'?503:401,requestSha256,status:null,bodyComplete:false,startedAt:new Date().toISOString()};report.requests.push(receipt);persist();
  const response=await fetch(original.url,{method:original.method,body:original.body,headers:{...original.headers,...cookie},
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});receipt.status=response.status;persist();
  const chunks=[];let size=0;if(response.body)for await(const chunk of response.body){size+=chunk.length;assert.ok(size<10*1024*1024+65536);chunks.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(chunks);Object.assign(receipt,{bodyComplete:true,bytes:size,bodySha256:d.sha(bytes),headers:d.cacheMetadata(response.headers),completedAt:new Date().toISOString()});persist();
  assert.equal(receipt.status,receipt.expected);assert.notEqual(receipt.bodySha256,d.sha(d.PDF));
  if(phase==='disabled'){d.assertNoStore(receipt);assert.equal(receipt.bodySha256,d.sha(d.APP_DENIAL));assert.equal(receipt.bytes,d.APP_DENIAL.length);receipt.layer='clinia-handler';}
  else {const data=JSON.parse(bytes.toString());assert.ok(['protection','access','mcp'].every(k=>Object.hasOwn(data,k)));receipt.layer='vercel-protection';}
  persist();
 }report.status='VERIFIED';}catch{report.status='PARTIALLY VERIFIED';report.failure='Expected bounded closeout result not reproduced; raw status/hash retained';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,evidence:file}));}
}
if(require.main===module)run(process.argv.slice(2)).catch(()=>{console.error('Scoped closeout prerequisites refused; no secrets emitted');process.exitCode=1;});
