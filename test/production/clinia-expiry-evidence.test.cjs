'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),v=require('../../scripts/verify-clinia-expiry-evidence.cjs');
function result(change={}){
 const row={observed_at:'2026-10-05T22:00:00Z',phase:'before',actor_id:v.ACTOR,clinic_id:v.CLINIC,session_id:v.SESSION,
  profile_active:true,profile_not_deleted:true,doctor_membership_active:true,auth_user_active:true,session_present:true,...change};
 return {isError:false,content:[{type:'text',text:JSON.stringify({result:'Result\n<untrusted-data-test>\n'+JSON.stringify([row])+'\n</untrusted-data-test>'})}]};
}
test('expiry witness binds the real SQL and exact clinic, actor, session and returned authority',()=>{
 const sql=v.authoritySql('before');v.witness('before',sql,result(),'a'.repeat(64),'b'.repeat(64));
 for(const change of [{clinic_id:'other-clinic'},{session_id:'new-session'},{actor_id:'other-actor'},{doctor_membership_active:false},{session_present:false}])
  assert.throws(()=>v.witness('before',sql,result(change),'a'.repeat(64),'b'.repeat(64)));
 assert.throws(()=>v.witness('before',sql+' SELECT true;',result(),'a'.repeat(64),'b'.repeat(64)));
 assert.throws(()=>v.witness('before',sql,{...result(),isError:true},'a'.repeat(64),'b'.repeat(64)));
});
