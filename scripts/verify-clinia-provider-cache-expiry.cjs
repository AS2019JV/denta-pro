'use strict';
// Defense-in-depth probe only: replay the already warmed isolated broker JWT.
// This does not exercise, replace or certify ordinary-user gateway revocation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs'),r=require('./clinia-staging-runtime.cjs');
async function main(args){
 assert.deepEqual(args,[d.PROJECT]);const directory=path.join(r.repo,'docs/production/evidence/2026-10-05-document-requalification');
 const capture=JSON.parse(fs.readFileSync(d.plan(['principal','enabled','3',d.PROJECT]).principalFile));
 const warmFile='principal-warm-disable-replay-1791235075640.json',warmBytes=fs.readFileSync(path.join(directory,warmFile)),warm=JSON.parse(warmBytes);
 assert.equal(warm.project,d.PROJECT);assert.equal(warm.principalId,capture.id);assert.equal(warm.principalTokenSha256,d.sha(capture.token));
 const claims=d.jwt(capture.token,capture.id,'clinia_document_delivery',Math.floor(Date.now()/1000),true);
 const exp=claims.expiresAt*1000;assert.ok(Date.now()>=exp+10000,'Natural broker expiry plus clock margin required');
 const state=JSON.parse(fs.readFileSync(d.plan(['prepare','2',d.PROJECT]).privateFile));d.preparedState(state,'2');
 const routes=d.clinicalObjectRoutes(state.document.path).bytes;assert.deepEqual(warm.requests.map(x=>x.path),routes);
 for(const response of warm.requests){assert.equal(response.status,200);assert.equal(response.bodySha256,d.sha(d.PDF));}
 const config=r.readConfig(),report={status:'NOT VERIFIED',project:d.PROJECT,scope:'Isolated server broker only',startedAt:new Date().toISOString(),
  command:'node scripts/verify-clinia-provider-cache-expiry.cjs '+d.PROJECT,driverSha256:d.sha(fs.readFileSync(__filename)),
  principalId:capture.id,principalTokenSha256:d.sha(capture.token),originalExpiresAt:new Date(exp).toISOString(),
  warmEvidence:{filename:warmFile,sha256:d.sha(warmBytes)},expected:'Both warmed provider routes deny after natural broker JWT expiry',requests:[],
  limits:['Needs the server-only isolated bearer and registered object path; no ordinary-user exposure demonstrated',
   'Same bearer, methods and paths as the October5 warm-disable GET harness; original complete HTTP header capture was not recorded',
   'A denial alone does not establish expiry causality or prove immediate flag revocation',
   'No token refresh, nonce, URL replacement, flag mutation or storage mutation']};
 const file=path.join(directory,'provider-cache-expiry-'+Date.now()+'.json');const persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});let failed=false;
 try{for(const route of routes){
  const receipt={path:route,status:null,bodyComplete:false,startedAt:new Date().toISOString()};report.requests.push(receipt);persist();
  const response=await fetch(config.origin+route,{headers:{apikey:config.anon,Authorization:'Bearer '+capture.token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  receipt.status=response.status;persist();const chunks=[];let size=0;if(response.body)for await(const c of response.body){size+=c.length;assert.ok(size<10*1024*1024+65536);chunks.push(Buffer.from(c));}
  const bytes=Buffer.concat(chunks);Object.assign(receipt,{bodyComplete:true,bytes:size,bodySha256:d.sha(bytes),headers:d.cacheMetadata(response.headers),serverDate:response.headers.get('date'),completedAt:new Date().toISOString()});persist();
  assert.ok(Date.parse(receipt.serverDate)>=exp+10000);let data=null;try{data=JSON.parse(bytes.toString());}catch{}
  try{d.assertProviderDenied({...receipt,bytes,data});}catch{failed=true;}
 }report.status='PARTIALLY VERIFIED';report.providerDenialsPassed=!failed;
 report.disposition=failed?'Warmed document remained accessible after natural broker expiry':'Denial observed after expiry; causal provider qualification remains separate';
 if(failed)process.exitCode=1;
 }catch{report.status='PARTIALLY VERIFIED';report.failure='Transport or timing proof incomplete; raw response metadata retained';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,evidence:file}));}
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Scoped broker-expiry prerequisites refused; no secrets emitted');process.exitCode=1;});
