'use strict';
// Separate fresh-owner controls after genuine target expiry. Frozen target
// JWT, request, capture and replay driver are never rewritten.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs'),provider=require('./clinia-staging-runtime.cjs');
async function main(args){
  assert.equal(args.length,2);const [phase,project]=args;
  assert.equal(project,d.PROJECT);assert.ok(['active','disabled','protection-revoked'].includes(phase));
  const p=d.plan(['probe','expired','1',project]);
  const read=file=>{assert.ok(!fs.lstatSync(file).isSymbolicLink());const bytes=fs.readFileSync(file);return {value:JSON.parse(bytes),hash:d.sha(bytes)};};
  const prepared=read(p.privateFile),state=d.preparedState(prepared.value,'1'),manifest=read(p.manifestFile),access=read(p.previewAccessFile);
  d.candidateManifest(manifest.value);const replay=read(p.replayFile).value;
  const binding={manifestSha256:manifest.hash,preparedSha256:prepared.hash,
    driverSha256:d.sha(fs.readFileSync(path.join(__dirname,'verify-clinia-document-runtime.cjs'))),transportSha256:access.hash};
  d.verifyReplay(replay,state,binding,Math.floor(Date.now()/1000),'expired');
  const warm=read(path.join(p.directory,replay.warmEvidence.filename));assert.equal(warm.hash,replay.warmEvidence.sha256);assert.equal(warm.value.status,'VERIFIED');
  const privateFile=path.join(p.privateDirectory,'step1-final-owner-control.private.json');
  const positiveFile=path.join(p.directory,'final-owner-active-receipt.json');
  let request;
  if(phase==='active'){
    assert.ok(!fs.existsSync(privateFile),'Fresh control cannot overwrite a previous request');
    const config=provider.readConfig(),actor=state.actors.owner_A;
    const login=await provider.request(config,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:actor.email,password:actor.password}});
    assert.equal(login.status,200);assert.equal(login.data?.user?.id,actor.id);d.jwt(login.data.access_token,actor.id);
    request=d.documentRequest(login.data.access_token,state.scope);
    fs.writeFileSync(privateFile,JSON.stringify({project,binding,request,requestSha256:d.requestBinding(request)},null,2)+'\n',{flag:'wx',mode:0o600});
  }else{
    const fresh=read(privateFile).value;assert.equal(fresh.project,project);assert.deepEqual(fresh.binding,binding);
    request=fresh.request;assert.equal(d.requestBinding(request),fresh.requestSha256);
    d.jwt(request.headers.Authorization.slice(7),state.actors.owner_A.id);
    const positive=read(positiveFile).value;
    assert.equal(positive.status,'VERIFIED');assert.equal(positive.freshOwnerRequestSha256,fresh.requestSha256);
    assert.match(positive.filename,/^final-control-active-\d+\.json$/);
    const actualPositive=read(path.join(p.directory,positive.filename));
    assert.equal(actualPositive.hash,positive.sha256);assert.equal(actualPositive.value.status,'VERIFIED');
    assert.equal(actualPositive.value.phase,'active');assert.equal(actualPositive.value.requests.length,2);
    assert.ok(actualPositive.value.requests.every(r=>r.status===200));
  }
  const expected={active:200,disabled:503,'protection-revoked':401}[phase];
  const report={status:'NOT VERIFIED',phase,project,candidate:d.candidateManifest(manifest.value),startedAt:new Date().toISOString(),
    driverSha256:d.sha(fs.readFileSync(__filename)),originalExpiryRequestSha256:replay.requestSha256.expiry_A,
    freshOwnerRequestSha256:d.requestBinding(request),expectedStatus:expected,requests:[],
    limits:['Fresh ordinary-owner positive/control request is separate from the unmodified original expiry request',
      'Principal and share-link changes are separately confirmed/read back; no remote control mutation by this driver']};
  const file=path.join(p.directory,'final-control-'+phase+'-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  try{
    for(let i=0;i<2;i++){
      const sent=d.applyPreviewTransport(request,d.previewTransport(access.value));
      const response=await fetch(sent.url,{...sent,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=10*1024*1024+65536);chunks.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(chunks),result={status:response.status,bytes,bodySha256:d.sha(bytes),headers:d.cacheMetadata(response.headers),data:null};
      try{result.data=JSON.parse(bytes.toString());}catch{}
      report.requests.push(d.responseEvidence('fresh_owner_A',request,result));assert.equal(response.status,expected);
      if(phase==='active'){d.assertNoStore(result);d.assertDocument(result);}
      else if(phase==='disabled'){d.assertNoStore(result);assert.equal(result.bodySha256,d.sha(d.APP_DENIAL));}
      else{assert.ok(result.data&&Object.hasOwn(result.data,'protection'));assert.notEqual(result.bodySha256,d.sha(d.APP_DENIAL));assert.notEqual(result.bodySha256,state.document.sha256);}
    }
    report.status='VERIFIED';
  }catch{report.status='PARTIALLY VERIFIED';report.failure='Expected final control result not reproduced';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
  if(phase==='active'&&report.status==='VERIFIED')fs.writeFileSync(positiveFile,JSON.stringify({status:'VERIFIED',
    filename:path.basename(file),sha256:d.sha(fs.readFileSync(file)),freshOwnerRequestSha256:report.freshOwnerRequestSha256},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,phase,evidence:file}));
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Final-control prerequisites refused; no credentials emitted');process.exitCode=1;});
module.exports={main};
