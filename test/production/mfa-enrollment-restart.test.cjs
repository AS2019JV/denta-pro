'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../../lib/mfa-enrollment.ts'),'utf8');
const moduleOutput={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:moduleOutput,exports:moduleOutput.exports,Set});
const {cancelPendingTotpEnrollment,getEnrollmentRecoveryState}=moduleOutput.exports;

function fixture(){
 const state={factors:[{id:'pending-totp',status:'unverified',factor_type:'totp'}],deleted:[],lists:0,live:true,
   claims:{sub:'signed-in-owner',role:'authenticated',aal:'aal1'},user:{id:'signed-in-owner',email_confirmed_at:'confirmed'},
   assurance:{currentLevel:'aal1',nextLevel:'aal1'}};
 const client={rpc:async()=>({data:state.live,error:state.liveError}),auth:{
  getUser:async()=>({data:{user:state.user},error:state.identityError}),
  getClaims:async()=>({data:{claims:state.claims},error:state.claimError}),
  mfa:{getAuthenticatorAssuranceLevel:async()=>({data:state.assurance,error:state.assuranceError}),
   listFactors:async()=>{state.lists++;if(state.onList)state.onList(state);return {data:{all:structuredClone(state.factors)},error:state.listError}},
   unenroll:async({factorId})=>{if(state.onRemove)return state.onRemove(state,factorId);state.deleted.push(factorId);state.factors=state.factors.filter(f=>f.id!==factorId);return {data:{id:factorId},error:null}},
  },
 }};
 return {state,client};
}

test('authenticated first-factor user can cancel only own unfinished TOTP enrollment',async()=>{
 const h=fixture();h.state.factors.push({id:'pending-phone',status:'unverified',factor_type:'phone'});
 assert.equal(await cancelPendingTotpEnrollment(h.client),true);
 assert.deepEqual(h.state.deleted,['pending-totp']);assert.equal(h.state.factors[0].id,'pending-phone');
});

test('missing, unconfirmed, anonymous, mismatched, expired or revoked identity causes no factor mutation',async()=>{
 for(const mutate of [
  s=>s.user=null,s=>delete s.user.email_confirmed_at,s=>s.claims.sub='other-user',s=>s.claims.role='anon',
  s=>s.claims.is_anonymous=true,s=>s.identityError={message:'expired'},s=>s.claimError={message:'invalid'},
  s=>s.live=false,s=>s.liveError={message:'revoked'},s=>s.assuranceError={message:'denied'},
 ]){const h=fixture();mutate(h.state);assert.equal(await cancelPendingTotpEnrollment(h.client),false);assert.deepEqual(h.state.deleted,[])}
});

test('verified TOTP or other verified factor and AAL2 sessions cannot use the first-enrollment reset',async()=>{
 for(const mutate of [
  s=>s.factors.push({id:'verified-totp',factor_type:'totp',status:'verified'}),
  s=>s.factors.push({id:'verified-phone',factor_type:'phone',status:'verified'}),
  s=>s.claims.aal='aal2',s=>s.assurance.currentLevel='aal2',s=>s.assurance.nextLevel='aal2',
 ]){const h=fixture();mutate(h.state);assert.equal(await cancelPendingTotpEnrollment(h.client),false);assert.deepEqual(h.state.deleted,[])}
});

test('verification in another tab before deletion blocks reset and preserves the now verified factor',async()=>{
 const h=fixture();h.state.onList=s=>{if(s.lists===2)s.factors[0].status='verified'};
 assert.equal(await cancelPendingTotpEnrollment(h.client),false);assert.deepEqual(h.state.deleted,[]);
 assert.equal(h.state.factors[0].status,'verified');
});

test('provider enforces the last race boundary; rejection or unknown mutation outcomes never report success',async()=>{
 for(const result of ['error','throw','wrong-id']){
  const h=fixture();h.state.onRemove=async s=>{s.factors[0].status='verified';if(result==='throw')throw Error('unknown transport outcome');
   return result==='error'?{data:null,error:{message:'AAL2 required'}}:{data:{id:'other-factor'},error:null}};
  assert.equal(await cancelPendingTotpEnrollment(h.client),false);assert.deepEqual(h.state.deleted,[]);
 }
});

test('all abandoned TOTP factors are cleared, while duplicate IDs, empty or failed lists stop safely',async()=>{
 const h=fixture();h.state.factors.push({id:'second-pending',status:'unverified',factor_type:'totp'});
 assert.equal(await cancelPendingTotpEnrollment(h.client),true);assert.deepEqual(h.state.deleted,['pending-totp','second-pending']);
 for(const mutate of [s=>s.factors=[],s=>s.factors.push({...s.factors[0]}),s=>s.listError={message:'unavailable'}]){
  const h=fixture();mutate(h.state);assert.equal(await cancelPendingTotpEnrollment(h.client),false);assert.deepEqual(h.state.deleted,[]);
 }
});

test('remaining or concurrently created pending/verified factors prevent a fresh enrollment success claim',async()=>{
 for(const status of ['unverified','verified']){
  const h=fixture();h.state.onList=s=>{if(s.lists===3)s.factors.push({id:'concurrent-factor',status,factor_type:'totp'})};
  assert.equal(await cancelPendingTotpEnrollment(h.client),false);
  assert.equal(h.state.factors[0].id,'concurrent-factor');
 }
});

test('lost deletion response reconciles to fresh setup with no second mutation or false cancellation success',async()=>{
 const h=fixture();h.state.onRemove=async s=>{s.factors=[];throw Error('response lost after deletion')};
 assert.equal(await cancelPendingTotpEnrollment(h.client),false);
 assert.equal((await getEnrollmentRecoveryState(h.client)).kind,'enroll');assert.deepEqual(h.state.deleted,[]);
});

test('lost final list response permits read-only reconciliation after cancellation completed',async()=>{
 const h=fixture();h.state.onList=s=>{s.listError=s.lists===3?{message:'transport failure'}:null};
 assert.equal(await cancelPendingTotpEnrollment(h.client),false);
 assert.equal((await getEnrollmentRecoveryState(h.client)).kind,'enroll');assert.deepEqual(h.state.deleted,['pending-totp']);
});

test('reconciliation routes pending to retry and verified to challenge; invalid or revoked sessions stay blocked',async()=>{
 const h=fixture();assert.equal((await getEnrollmentRecoveryState(h.client)).kind,'pending');
 h.state.factors[0].status='verified';h.state.assurance.nextLevel='aal2';
 assert.equal((await getEnrollmentRecoveryState(h.client)).kind,'challenge');assert.deepEqual(h.state.deleted,[]);
 h.state.live=false;assert.equal((await getEnrollmentRecoveryState(h.client)).kind,'blocked');
});
