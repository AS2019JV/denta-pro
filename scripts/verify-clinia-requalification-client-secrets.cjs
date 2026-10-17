'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs'),q=require('./verify-clinia-document-requalification.cjs');
const runtime=require('./clinia-staging-runtime.cjs'),{inspectText}=require('./clinia-secret-scan.cjs');
const directory=path.join(runtime.repo,'docs/production/evidence/2026-10-05-document-requalification');
function read(file){assert.ok(!fs.lstatSync(file).isSymbolicLink());return JSON.parse(fs.readFileSync(file));}
function assetRequest(url,access){
 const parsed=new URL(url);assert.ok(!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash);
 if(parsed.origin==='https://vercel.live'){
  assert.equal(parsed.pathname,'/_next-live/feedback/feedback.js');
  return {url:parsed.href,headers:{},path:parsed.pathname,source:'vercel-toolbar'};
 }
 assert.equal(parsed.origin,d.PREVIEW);assert.match(parsed.pathname,/^\/_next\/static\/[A-Za-z0-9_./%()[\]-]+\.js$/);
 const pinned=new URL(parsed.pathname,q.ORIGIN);assert.equal(pinned.origin,q.ORIGIN);
 return {url:pinned.href,headers:access,path:parsed.pathname,source:'pinned-candidate'};
}
async function main(args){
 assert.deepEqual(args,[d.PROJECT]);const manifest=read(path.join(directory,'candidate-manifest.json')),candidate=q.validateManifest(manifest);
 const inventoryFile=path.join(runtime.repo,'tmp/phase1-requalification-observed-client-assets.json'),inventory=read(inventoryFile);
 assert.equal(inventory.candidateHead,q.CANDIDATE);
 const access=q.transport(read(path.join(runtime.repo,'tools/local-supabase/supabase/.temp/step1-requalification-preview-access.private.json')));
 const principal=read(path.join(runtime.repo,'tools/local-supabase/supabase/.temp/document-delivery-20261004.private.json'));
 const captured=read(d.plan(['principal','enabled','3',d.PROJECT]).principalFile);
 assert.equal(principal.project,d.PROJECT);assert.equal(captured.id,principal.id);
 const config=runtime.readConfig(),values=[config.service,principal.email,principal.password,principal.token,principal.refreshToken,captured.token];
 assert.ok(values.every(v=>typeof v==='string'&&v.length>=10));
 const urls=[...new Set(inventory.scriptUrls)];assert.ok(urls.length>=10&&urls.length<=150);
 const report={status:'NOT VERIFIED',candidate,startedAt:new Date().toISOString(),observedAt:inventory.observedAt,
  driverSha256:d.sha(fs.readFileSync(__filename)),inventorySha256:d.sha(fs.readFileSync(inventoryFile)),credentialComparisons:values.length,scripts:[],findings:[],
  limits:['Observed first-party scripts in the synthetic login/patient/file journey; unloaded routes not covered',
   'Paths observed on the configured branch alias are retrieved from the pinned deployment hostname',
   'Pattern and exact stored privileged credential comparison; not an exhaustive secrecy guarantee']};
 const file=path.join(directory,'deployed-client-secrets-'+Date.now()+'.json'),persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 try{
  for(const url of urls){
   const request=assetRequest(url,access);
   const response=await fetch(request.url,{headers:request.headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
   assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/javascript/);
   const parts=[];let size=0;for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=8*1024*1024);parts.push(Buffer.from(chunk));}
   const bytes=Buffer.concat(parts),text=bytes.toString(),findings=inspectText(text).map(f=>({path:request.path,...f}));
   if(values.some(v=>text.includes(v)))findings.push({path:request.path,rule:'current-server-credential-exposure'});
   report.findings.push(...findings);report.scripts.push({path:request.path,source:request.source,status:response.status,bytes:size,sha256:d.sha(bytes)});persist();assert.equal(findings.length,0);
  }
  report.status='VERIFIED';
 }catch{report.status='PARTIALLY VERIFIED';report.failure='Observed client asset retrieval or secrecy assertion failed';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();persist();}
 console.log(JSON.stringify({status:report.status,scripts:report.scripts.length,findings:report.findings.length,evidence:file}));
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Pinned client-secret scan prerequisites refused; no values emitted');process.exitCode=1;});
module.exports={assetRequest};
