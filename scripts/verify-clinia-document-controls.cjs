'use strict';
// Replay already-warmed requests after operator-controlled synthetic mutations.
// No remote mutation, JWT refresh or provider credential is used by this probe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs');
const phases={ 'principal-disabled':['owner_A',503], 'principal-restored':['owner_A',200],
  suspended:['expiry_A',404], deleted:['expiry_A',404], restored:['expiry_A',200] };
async function main(args){
  assert.equal(args.length,2);const [phase,project]=args;assert.equal(project,d.PROJECT);assert.ok(Object.hasOwn(phases,phase));
  const p=d.plan(['probe','warm','1',project]);
  const read=file=>{assert.ok(!fs.lstatSync(file).isSymbolicLink());const bytes=fs.readFileSync(file);return {value:JSON.parse(bytes),hash:d.sha(bytes)};};
  const prepared=read(p.privateFile),state=d.preparedState(prepared.value,'1'),manifest=read(p.manifestFile);
  d.candidateManifest(manifest.value);
  const access=read(p.previewAccessFile),transport=d.previewTransport(access.value),replay=read(p.replayFile).value;
  const runtimeHash=d.sha(fs.readFileSync(path.join(__dirname,'verify-clinia-document-runtime.cjs')));
  d.verifyReplay(replay,state,{manifestSha256:manifest.hash,preparedSha256:prepared.hash,driverSha256:runtimeHash,transportSha256:access.hash});
  const warm=read(path.join(p.directory,replay.warmEvidence.filename));
  assert.equal(warm.hash,replay.warmEvidence.sha256);assert.equal(warm.value.status,'VERIFIED');
  const [actor,expected]=phases[phase],original=replay.requests[actor];
  assert.equal(d.requestBinding(original),replay.requestSha256[actor]);
  const report={status:'NOT VERIFIED',phase,project,candidate:d.candidateManifest(manifest.value),
    startedAt:new Date().toISOString(),driverSha256:d.sha(fs.readFileSync(__filename)),runtimeHash,
    originalRequestSha256:replay.requestSha256[actor],warmEvidence:replay.warmEvidence,expectedStatus:expected,requests:[],
    limits:['Operator mutation/readback recorded separately; no credentials or patient content in evidence',
      'Only the original previously successful synthetic Preview request is replayed']};
  const file=path.join(p.directory,'control-'+phase+'-'+Date.now()+'.json');
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  try{
    for(let i=0;i<2;i++){
      const request=d.applyPreviewTransport(original,transport);
      const response=await fetch(request.url,{...request,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=10*1024*1024+65536);chunks.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(chunks),result={status:response.status,bytes,bodySha256:d.sha(bytes),headers:d.cacheMetadata(response.headers),data:null};
      try{result.data=JSON.parse(bytes.toString());}catch{}
      report.requests.push(d.responseEvidence(actor,original,result));
      assert.equal(result.status,expected);d.assertNoStore(result);
      if(expected===200)d.assertDocument(result);
      else{assert.equal(result.bodySha256,d.sha(d.APP_DENIAL));assert.notEqual(result.bodySha256,state.document.sha256);}
    }
    report.status='VERIFIED';
  }catch{report.status='PARTIALLY VERIFIED';report.failure='Expected committed-control replay result not reproduced';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,phase,evidence:file}));
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Frozen replay prerequisites refused; no credentials emitted');process.exitCode=1;});
module.exports={main};
