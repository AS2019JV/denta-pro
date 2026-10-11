'use strict';
// Scan only script URLs observed in the synthetic candidate browser journey.
// Credential values are compared in memory and never written to evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const runtime=require('./verify-clinia-document-runtime.cjs');
const provider=require('./clinia-staging-runtime.cjs');
const {inspectText}=require('./clinia-secret-scan.cjs');
async function main(args){
  assert.deepEqual(args,[runtime.PROJECT]);
  const read=file=>{assert.ok(!fs.lstatSync(file).isSymbolicLink());return JSON.parse(fs.readFileSync(file,'utf8'));};
  const plan=runtime.plan(['probe','warm','1',runtime.PROJECT]);
  const manifest=read(plan.manifestFile);runtime.candidateManifest(manifest);
  const inventory=read(path.join(provider.repo,'tmp/step1-observed-client-assets.json'));
  const access=runtime.previewTransport(read(plan.previewAccessFile));
  const principal=read(path.join(provider.repo,'tools/local-supabase/supabase/.temp/document-delivery-20261004.private.json'));
  assert.equal(principal.project,runtime.PROJECT);
  const config=provider.readConfig();
  const values=[config.service,...['email','password','token','refreshToken'].map(k=>principal[k])];
  assert.ok(values.every(v=>typeof v==='string'&&v.length>=10));
  const urls=[...new Set(inventory.scriptUrls)];assert.ok(urls.length>=10&&urls.length<=150);
  const report={status:'NOT VERIFIED',project:runtime.PROJECT,candidate:runtime.candidateManifest(manifest),
    startedAt:new Date().toISOString(),driverSha256:runtime.sha(fs.readFileSync(__filename)),
    observedAt:inventory.observedAt,scripts:[],credentialComparisons:values.length,findings:[],
    limits:['Only rendered journey scripts observed by the browser are scanned; unloaded routes are not covered',
      'Bounded credential patterns and exact current service/delivery credentials, not an exhaustive secret-discovery guarantee',
      'Deployment source identity comes from Vercel UI; branch alias is mutable']};
  const file=path.join(plan.directory,'deployed-client-secrets-'+Date.now()+'.json');
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  try{
    for(const url of urls){
      const parsed=new URL(url);assert.equal(parsed.origin,runtime.PREVIEW);
      assert.ok(!parsed.username&&!parsed.password);
      assert.ok(/^\/_next\/static\/[A-Za-z0-9_./%()[\]-]+\.js$/.test(parsed.pathname));
      assert.equal(parsed.search,'');assert.equal(parsed.hash,'');
      // The replay driver's POST-only guard remains unchanged. This separate
      // read-only scope permits only the observed same-origin static scripts.
      const headers={...access};
      const response=await fetch(url,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
      assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/javascript/);
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=8*1024*1024);chunks.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');
      const findings=inspectText(text).map(f=>({path:parsed.pathname,...f}));
      if(values.some(v=>text.includes(v)))findings.push({path:parsed.pathname,rule:'current-server-credential-exposure'});
      report.findings.push(...findings);report.scripts.push({path:parsed.pathname,status:response.status,bytes:size,sha256:runtime.sha(bytes)});
      fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
      assert.equal(findings.length,0);
    }
    report.status='VERIFIED';
  }catch{report.status='PARTIALLY VERIFIED';report.failure='Observed client-script retrieval or secret-boundary expectation failed';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,scripts:report.scripts.length,findings:report.findings.length,evidence:file}));
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Exact staging client-scan prerequisites refused; no credentials emitted');process.exitCode=1;});
module.exports={main};
