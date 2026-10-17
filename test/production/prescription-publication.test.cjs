'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const receipt=require('../../lib/prescription-receipt.mjs');
const ids=['880e8400-e29b-41d4-a716-446655440000','880e8400-e29b-41d4-a716-446655440001','880e8400-e29b-41d4-a716-446655440002','880e8400-e29b-41d4-a716-446655440003'];
const scope={prescriptionId:ids[0],clinicId:ids[1],patientId:ids[2],userId:ids[3]};
function record(){return {id:ids[0],clinic_id:ids[1],patient_id:ids[2],doctor_id:ids[3],issuance_snapshot:{version:1,prescription_id:ids[0],clinic_id:ids[1],patient_id:ids[2],doctor_id:ids[3],issued_at:'2026-10-02T18:00:00+00:00',clinic:{name:'Synthetic clinic',address:'',phone:''},patient:{name:'Synthetic patient',identification:''},doctor:{name:'Synthetic doctor',specialization:'',license_number:''},medications:[{name:'A',dosage:'B',duration:'C'}],indications:''}}}
function harness(){
  const state={current:true,role:'doctor',subscription:true,user:ids[3],saved:record(),patient:{id:ids[2]},queries:[],published:[]};
  let finish;const deferred=new Promise(resolve=>{finish=resolve});
  const client={from(table){const filters=[];state.queries.push({table,filters});const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},maybeSingle:async()=>({data:table==='prescriptions'?state.saved:state.patient,error:null})};return q},auth:{getUser:async()=>({data:{user:state.user?{id:state.user}:null},error:null})},rpc:async(name)=>({data:name==='get_clinic_member_role'?state.role:state.subscription,error:null})};
  const module={exports:{}};
  const compiled=ts.transpileModule(fs.readFileSync('lib/pdf-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,require(name){if(name==='@/lib/pdf-generator')return deferred;if(name==='@/lib/prescription-receipt.mjs')return receipt;throw Error(name)}});
  return {state,finish:()=>finish({generatePrescription(data){state.published.push(data)}}),run:()=>module.exports.exportPersistedPrescription(client,scope,()=>state.current)};
}
test('persisted Rx export reloads exact document and patient after deferred import, then publishes original receipt',async()=>{
  const h=harness(),pending=h.run();assert.equal(h.state.queries.length,0);h.finish();assert.equal(await pending,true);
  assert.deepEqual(h.state.queries[0].filters,[['id',ids[0]],['clinic_id',ids[1]],['patient_id',ids[2]]]);
  assert.deepEqual(h.state.queries[1].filters,[['id',ids[2]],['clinic_id',ids[1]],['deleted_at',null]]);
  assert.equal(h.state.published.length,1);assert.equal(h.state.published[0].issuedAt,'2026-10-02T18:00:00+00:00');
});
test('revoked membership or identity during deferred Rx import cannot publish cached data',async()=>{
  for(const change of [s=>s.role=null,s=>s.role='receptionist',s=>s.user=null,s=>s.user=ids[2],s=>s.subscription=false]){
    const h=harness(),pending=h.run();change(h.state);h.finish();await assert.rejects(pending,/autorización/);assert.equal(h.state.published.length,0);
  }
});
test('scope invalidation during deferred Rx import discards publication and does not query clinical rows',async()=>{
  const h=harness(),pending=h.run();h.state.current=false;h.finish();assert.equal(await pending,false);assert.equal(h.state.queries.length,0);assert.equal(h.state.published.length,0);
});
test('denied, deleted, foreign-scope or historical persisted Rx cannot fall back to cache',async()=>{
  for(const change of [s=>s.saved=null,s=>s.patient=null,s=>s.saved.clinic_id=ids[2],s=>s.saved.patient_id=ids[1],s=>s.saved.issuance_snapshot=null]){
    const h=harness(),pending=h.run();change(h.state);h.finish();await assert.rejects(pending);assert.equal(h.state.published.length,0);
  }
});
