'use strict';
// Exact authorized synthetic staging. No SQL, Storage mutation, token refresh
// or mail. Private frozen wire requests are never printed/published.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const r=require('./clinia-staging-runtime.cjs');
const {createClient}=require('@supabase/supabase-js');
const sdkRoot=path.join(r.repo,'tools/local-supabase/supabase/.temp/s3-sdk/node_modules');
const {S3Client,GetObjectCommand,HeadObjectCommand,ListObjectsV2Command}=require(path.join(sdkRoot,'@aws-sdk/client-s3'));
const {NodeHttpHandler}=require(path.join(sdkRoot,'@smithy/node-http-handler'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PROJECT='phihonofwyerpfgqfekt',ORIGIN='https://'+PROJECT+'.storage.supabase.co';
const PRIVATE=path.join(r.repo,'tools/local-supabase/supabase/.temp/s3-origin-1.private.json');
const DIRECTORY=path.join(r.repo,'docs/production/evidence/2026-10-06-phase1-origin');
const KEY='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf';
const PDF=Buffer.from('%PDF-1.4\nClinia synthetic staging transport, no patient document\n%%EOF');
async function main(args){
  assert.equal(args.length,2);const [phase,project]=args;assert.equal(project,PROJECT);assert.ok(['login','warm','disabled','restored','expired'].includes(phase));
  const config=r.readConfig();assert.equal(JSON.parse(Buffer.from(config.anon.split('.')[1],'base64url')).role,'anon','S3 JWT auth requires legacy anon key');
  fs.mkdirSync(DIRECTORY,{recursive:true});const filename=path.join(DIRECTORY,phase+'-'+Date.now()+'.json');
  const report={status:'NOT VERIFIED',project,command:'node scripts/verify-clinia-s3-transport.cjs '+args.join(' '),driverSha256:sha(fs.readFileSync(__filename)),phase,startedAt:new Date().toISOString(),checks:[],limits:['Synthetic registered 70-byte file, one staging region only','No deployed application, legacy capability retirement or production claim']};
  const persist=()=>fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');persist();
  try{
    let state;
    if(phase==='login'){
      assert.ok(!fs.existsSync(PRIVATE),'Fresh capture required');
      const principal=JSON.parse(fs.readFileSync(path.join(r.repo,'tools/local-supabase/supabase/.temp/document-delivery-20261004.private.json')));
      assert.equal(principal.project,PROJECT);assert.equal(principal.id,'378b431f-f043-489c-820b-347901a78d11');
      const auth=createClient(config.origin,config.anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(u,i)=>fetch(u,{...i,signal:AbortSignal.timeout(15000),redirect:'error'})}});
      const signed=await auth.auth.signInWithPassword({email:principal.email,password:principal.password});assert.ok(!signed.error&&signed.data.session&&signed.data.user.id===principal.id,'Scoped machine login refused');
      state={project,token:signed.data.session.access_token,requests:[],createdAt:new Date().toISOString()};
      const claims=JSON.parse(Buffer.from(state.token.split('.')[1],'base64url'));assert.equal(claims.role,'clinia_document_delivery');
      state.expiresAt=new Date(claims.exp*1000).toISOString();fs.writeFileSync(PRIVATE,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
      report.checks.push({requirement:'Isolated principal JWT',result:'Accepted; no human role',subject:principal.id,expiresAt:state.expiresAt,tokenSha256:sha(state.token)});
    }else{
      state=JSON.parse(fs.readFileSync(PRIVATE));assert.equal(state.project,project);report.tokenSha256=sha(state.token);report.expiresAt=state.expiresAt;
      const active=await r.request(config,'/rest/v1/rpc/clinia_document_delivery_active',{token:state.token,method:'POST',body:{}});
      report.checks.push({requirement:'Independent live flag witness',httpStatus:active.status,active:active.data===true});persist();
      if(phase==='warm'||phase==='restored')assert.equal(active.data,true);
      if(phase==='disabled')assert.equal(active.data,false);
      if(phase==='expired')assert.ok(Date.now()>Date.parse(state.expiresAt)+10000);
      if(['disabled','restored'].includes(phase)){
        assert.equal(state.requests.length,2,'Frozen successful GET/HEAD required');
        for(const original of state.requests){
          assert.equal(new URL(original.url).origin,ORIGIN);assert.equal(original.headers['x-amz-security-token'],state.token);
          const response=await fetch(original.url,{method:original.method,headers:original.headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
          const bytes=Buffer.from(await response.arrayBuffer());const receipt={requirement:'Exact warmed '+original.method+' wire replay',expected:phase==='disabled'?'401/403/404 and no clinical bytes':'200 with original hash',wireSha256:sha(JSON.stringify(original)),status:response.status,bytes:bytes.length,bodySha256:sha(bytes),date:response.headers.get('date'),cache:response.headers.get('cf-cache-status'),completedAt:new Date().toISOString()};report.checks.push(receipt);persist();
          if(phase==='disabled'){assert.ok([401,403,404].includes(response.status));assert.notEqual(sha(bytes),sha(PDF));}
          else{assert.equal(response.status,200);if(original.method==='GET')assert.equal(sha(bytes),sha(PDF));}
        }
      }else{
        const delegate=new NodeHttpHandler({connectionTimeout:5000,requestTimeout:15000});let capture;
        const client=new S3Client({region:'sa-east-1',endpoint:ORIGIN+'/storage/v1/s3',forcePathStyle:true,maxAttempts:1,
          credentials:{accessKeyId:PROJECT,secretAccessKey:config.anon,sessionToken:state.token},
          requestHandler:{handle:async(req,opts)=>{assert.ok(Object.keys(req.query||{}).every(k=>k==='x-id'));const url=new URL(req.protocol+'//'+req.hostname+req.path);for(const [key,value] of Object.entries(req.query||{})){assert.equal(typeof value,'string');url.searchParams.set(key,value);}capture={url:url.href,method:req.method,headers:{...req.headers}};return delegate.handle(req,opts)},destroy:()=>delegate.destroy()}});
        try{
          for(const [name,Command,input] of [['GET',GetObjectCommand,{Bucket:'patient-files',Key:KEY}],['HEAD',HeadObjectCommand,{Bucket:'patient-files',Key:KEY}],['LIST',ListObjectsV2Command,{Bucket:'patient-files',Prefix:KEY}]]){
            if(name==='LIST')continue; // LIST has query arguments; separate matrix needs its own capture contract.
            let result,error;try{result=await client.send(new Command(input),{abortSignal:AbortSignal.timeout(15000)})}catch(e){error=e;}
            const status=result?.$metadata.httpStatusCode||error?.$metadata?.httpStatusCode;const bytes=result?.Body?Buffer.from(await result.Body.transformToByteArray()):Buffer.alloc(0);
            const expected=phase==='warm'?'200 and original synthetic hash':'401/403/404 without bytes';
            report.checks.push({requirement:name+' S3 JWT/RLS',expected,status:status||null,errorCode:error?.name||null,bytes:bytes.length,bodySha256:sha(bytes),wireSha256:capture?sha(JSON.stringify(capture)):null,completedAt:new Date().toISOString()});persist();
            if(phase==='warm'){assert.equal(status,200);if(name==='GET')assert.equal(sha(bytes),sha(PDF));assert.equal(capture.headers['x-amz-security-token'],state.token);state.requests.push(capture);}
            else assert.ok([401,403,404].includes(status));
          }
        }finally{client.destroy();}
        if(phase==='warm'){assert.equal(state.requests.length,2);fs.writeFileSync(PRIVATE,JSON.stringify(state,null,2)+'\n');report.privateCaptureSha256=sha(fs.readFileSync(PRIVATE));}
      }
    }
    report.status='VERIFIED';
  }catch{report.status='PARTIALLY VERIFIED';report.failure='Authorization, transport or capture expectation not satisfied; see receipts';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,evidence:filename}));}
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Scoped S3 prerequisites refused; no secrets emitted');process.exitCode=1});
