'use strict';
// Reauthenticate the same synthetic fixtures after a work interruption, before
// any verified revocation matrix exists. Preserve the original private capture.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const runtime=require('./clinia-staging-runtime.cjs'),driver=require('./verify-clinia-hosted-api.cjs');
async function main(){
  assert.equal(process.argv.length,2);const config=runtime.readConfig();
  const p=driver.plan('matrix','1',driver.PROJECT,'3');
  const state=JSON.parse(fs.readFileSync(p.privateFile));
  assert.equal(state.project,driver.PROJECT);assert.equal(state.attempt,'1');
  assert.ok(!state.verifiedMatrix,'Never refresh tokens after a verified original-JWT matrix');
  const stamp=Date.now(),out=path.join(p.directory,'token-refresh-'+stamp+'.json');
  fs.copyFileSync(p.privateFile,p.privateFile+'.before-refresh-'+stamp,fs.constants.COPYFILE_EXCL);
  const report={status:'PARTIALLY VERIFIED',project:driver.PROJECT,startedAt:new Date().toISOString(),checks:[],
    scope:'Same synthetic actors, new real logins after previous JWT expiry; expired tokens are not revocation evidence'};
  try{
    for(const label of driver.LABELS){
      const actor=state.actors[label];assert.match(actor.email,new RegExp('^clinia-'+label.toLowerCase()+'-[a-f0-9]{12}@clinia\\.invalid$'));
      const client=createClient(config.origin,config.anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        global:{fetch:(input,options)=>{driver.providerUrl(input);return fetch(input,{...options,redirect:'error',signal:AbortSignal.timeout(20000)})}}});
      const r=await client.auth.signInWithPassword({email:actor.email,password:actor.password});assert.equal(r.error,null);assert.equal(r.data.user.id,actor.id);
      const token=r.data.session.access_token;const expires=driver.jwtUnexpired(token,actor.id);
      const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
      report.checks.push({actor:label,userId:actor.id,status:'VERIFIED',oldTokenSha256:hash(actor.token),newTokenSha256:hash(token),expiresAt:expires});actor.token=token;
    }
    const next=p.privateFile+'.new';fs.writeFileSync(next,JSON.stringify(state,null,2),{flag:'wx'});fs.renameSync(next,p.privateFile);report.status='VERIFIED';
  }catch{report.failure='Synthetic reauthentication failed; private captures preserved';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence:out}));}
}
main().catch(()=>{console.error('Exact synthetic refresh prerequisites refused');process.exitCode=1});
