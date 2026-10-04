'use strict';
// Real candidate negative probes; each uses synthetic IDs and never mutates data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs');
async function main(){
  assert.deepEqual(process.argv.slice(2),['1',d.PROJECT]);
  const p=d.plan(['probe','warm','1',d.PROJECT]);
  const read=file=>{assert.ok(!fs.lstatSync(file).isSymbolicLink());const bytes=fs.readFileSync(file);return {value:JSON.parse(bytes),hash:d.sha(bytes)};};
  const state=read(p.privateFile),manifest=read(p.manifestFile),access=read(p.previewAccessFile),replay=read(p.replayFile).value;
  d.preparedState(state.value,'1');d.candidateManifest(manifest.value);
  d.verifyReplay(replay,state.value,{manifestSha256:manifest.hash,preparedSha256:state.hash,
    driverSha256:d.sha(fs.readFileSync(path.join(__dirname,'verify-clinia-document-runtime.cjs'))),transportSha256:access.hash});
  const warm=read(path.join(p.directory,replay.warmEvidence.filename));assert.equal(warm.hash,replay.warmEvidence.sha256);assert.equal(warm.value.status,'VERIFIED');
  const original=replay.requests.owner_A,transport=d.previewTransport(access.value);
  const headers=extra=>({...original.headers,...extra});const body=extra=>JSON.stringify({...state.value.scope,...extra});
  const cases=[
    ['same-origin anonymous identity denial',404,{...original,headers:{'Content-Type':'application/json',Origin:d.PREVIEW}}],
    ['same-origin authorized bearer success',200,{...original,headers:headers({Origin:d.PREVIEW})}],
    ['foreign Origin denial',403,{...original,headers:headers({Origin:'https://clinia-invalid.example'})}],
    ['malformed bearer denial',401,{...original,headers:headers({Authorization:'Bearer invalid'})}],
    ['invalid UUID denial',400,{...original,body:body({fileId:'invalid'})}],
    ['caller-supplied provider path rejected',400,{...original,body:body({filePath:state.value.document.path})}],
    ['foreign patient scope denial',404,{...original,body:body({patientId:'0b524dc4-9edd-484e-821a-635f0a9f3d69'})}],
    ['unregistered file denial',404,{...original,body:body({fileId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}],
    ['Range replay rejected',400,{...original,headers:headers({Range:'bytes=0-10'})}],
    ['conditional replay rejected',400,{...original,headers:headers({'If-None-Match':'synthetic'})}],
    ['wrong content type rejected',400,{...original,headers:headers({'Content-Type':'text/plain'})}],
    ['malformed JSON rejected',400,{...original,body:'{' }],
    ['original owner positive control',200,original],
  ];
  const report={status:'NOT VERIFIED',project:d.PROJECT,candidate:d.candidateManifest(manifest.value),
    startedAt:new Date().toISOString(),driverSha256:d.sha(fs.readFileSync(__filename)),warmEvidence:replay.warmEvidence,
    checks:[],requests:[],limits:['Synthetic staging document only; no clinical data or remote mutations',
      'Same-origin anonymous request has only Vercel transport access; no Supabase cookie or Bearer']};
  const file=path.join(p.directory,'application-attacks-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  try{
    for(const [name,expected,request] of cases){
      const sent=d.applyPreviewTransport(request,transport);
      const response=await fetch(sent.url,{...sent,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=10*1024*1024+65536);chunks.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(chunks),result={status:response.status,bytes,bodySha256:d.sha(bytes),headers:d.cacheMetadata(response.headers),data:null};
      try{result.data=JSON.parse(bytes.toString());}catch{}
      report.requests.push(d.responseEvidence(name,request,result));
      assert.equal(response.status,expected);d.assertNoStore(result);
      if(expected===200)d.assertDocument(result);else assert.equal(result.bodySha256,d.sha(d.APP_DENIAL));
      report.checks.push({requirement:name,expected,actual:result.status,status:'VERIFIED'});
      fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
    }
    report.status='VERIFIED';
  }catch{report.status='PARTIALLY VERIFIED';report.failure='Named application attack expectation not reproduced';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence:file}));
}
if(require.main===module)main().catch(()=>{console.error('Frozen candidate attack prerequisites refused; no credentials emitted');process.exitCode=1;});
