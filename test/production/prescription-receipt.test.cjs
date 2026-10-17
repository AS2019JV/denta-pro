const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const receipt = require('../../lib/prescription-receipt.mjs')
const policy = require('../../lib/prescription-policy.mjs')
const ids = ['880e8400-e29b-41d4-a716-446655440000','880e8400-e29b-41d4-a716-446655440001','880e8400-e29b-41d4-a716-446655440002','880e8400-e29b-41d4-a716-446655440003']
function record() {
  return { id: ids[0], clinic_id: ids[1], patient_id: ids[2], doctor_id: ids[3],
    issuance_snapshot: { version:1,prescription_id:ids[0],clinic_id:ids[1],patient_id:ids[2],doctor_id:ids[3],
      issued_at:'2026-10-02T18:00:00+00:00',clinic:{name:'Original Clinic',address:'Original address',phone:''},
      patient:{name:'Original Patient',identification:'synthetic'},doctor:{name:'Original Doctor',specialization:'',license_number:''},
      medications:[{name:'A',dosage:'B',duration:'C'}],indications:'Original indications' } }
}
test('PDF uses the database receipt and original issuance date exclusively', () => {
  const r=record(), first=receipt.prescriptionPdfFromReceipt(r)
  r.patient={first_name:'Changed'};r.doctor={full_name:'Changed'};r.clinic={name:'Changed'}
  r.data={medications:[],indications:'Changed',signature:'fabricated'}
  assert.deepEqual(receipt.prescriptionPdfFromReceipt(r),first)
  assert.equal(first.patientName,'Original Patient');assert.equal(first.issuedAt,'2026-10-02T18:00:00+00:00')
  assert.equal(first.prescriptionId,r.id)
})
test('historical and incomplete receipts fail closed without backfill', () => {
  for(const s of [null,undefined,{}, {...record().issuance_snapshot,version:2}]) {
    assert.equal(receipt.prescriptionPdfFromReceipt({...record(),issuance_snapshot:s}),null)
  }
  assert.match(receipt.HISTORICAL_PRESCRIPTION_MESSAGE,/custodia/)
})
test('receipt must bind the persisted document, issuer, patient and clinic', () => {
  for(const key of ['prescription_id','clinic_id','patient_id','doctor_id']) {
    const r=record();r.issuance_snapshot[key]=ids[(ids.indexOf(r.issuance_snapshot[key])+1)%4]
    assert.equal(receipt.prescriptionPdfFromReceipt(r),null,key)
  }
})
test('invalid date, identity or clinical values cannot reach PDF', () => {
  for(const change of [s=>s.issued_at='invalid',s=>s.clinic.name='',s=>s.patient.name=null,
    s=>s.doctor.license_number=42,s=>s.medications=[],s=>s.medications[0].duration='',s=>s.indications='x'.repeat(2001)]) {
    const r=record();change(r.issuance_snapshot);assert.equal(receipt.prescriptionPdfFromReceipt(r),null)
  }
})
test('receipt does not manufacture professional qualification, logos or signatures', () => {
  const r=record();r.issuance_snapshot.clinic.logo_url='mutable';r.issuance_snapshot.signature='fabricated'
  const pdf=receipt.prescriptionPdfFromReceipt(r)
  assert.equal(pdf.doctorReg,'Registro no informado');assert.equal(pdf.signature,null);assert.equal(pdf.clinicLogo,undefined)
  r.issuance_snapshot.doctor.license_number='self-declared-registration'
  assert.equal(receipt.prescriptionPdfFromReceipt(r).doctorReg,'Registro: self-declared-registration')
})
function actionHarness(output,error=null,transport=false) {
  const writes=[]
  const q={select(){return q},eq(){return q},is(){return q},maybeSingle:async()=>({data:{status:'active',id:ids[2]},error:null})}
  const client={auth:{getUser:async()=>({data:{user:{id:ids[3]}},error:null})},rpc:async()=>({data:'doctor',error:null}),
    from(table){if(table!=='prescriptions')return q;return {insert(r){writes.push(r);return {select(){return {single:async()=>{if(transport)throw Error('raw sensitive error');return {data:output,error}}}}}}}}}
  const mod={exports:{}}
  const js=ts.transpileModule(fs.readFileSync('app/actions/save-prescription.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(js,{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic'}},require(name){
    if(name==='@supabase/ssr')return {createServerClient:()=>client}
    if(name==='next/headers')return {cookies:async()=>({getAll:()=>[],set(){}})}
    if(name==='@/lib/prescription-policy.mjs')return policy
    if(name==='@/lib/prescription-receipt.mjs')return receipt
    throw Error(name)
  }})
  return {writes,save:()=>mod.exports.savePrescription({requestId:ids[0],clinicId:ids[1],patientId:ids[2],doctorId:'forged',issuance_snapshot:{},
    medications:[{name:'A',dosage:'B',duration:'C'}],indications:'Original indications'})}
}
test('actual save action returns only persisted receipt and ignores arbitrary client issuer/snapshot',async()=>{
  const h=actionHarness(record()), result=await h.save()
  assert.equal(result.success,true);assert.deepEqual(result.prescription,record())
  assert.equal(h.writes[0].doctor_id,ids[3]);assert.equal(h.writes[0].issuance_snapshot,undefined)
})
function retryHarness(options={}) {
  const state={rows:new Map(),writes:0,attempts:0,loads:[],loseResponse:options.loseResponse}
  if(options.initial)state.rows.set(options.initial.id,options.initial)
  const q={select(){return q},eq(){return q},is(){return q},maybeSingle:async()=>({data:{status:'active',id:ids[2]},error:null})}
  const client={auth:{getUser:async()=>({data:{user:{id:ids[3]}},error:null})},rpc:async()=>({data:'doctor',error:null}),
    from(table){if(table!=='prescriptions')return q
      const filters=[]
      const read={select(){return read},eq(key,value){filters.push([key,value]);return read},maybeSingle:async()=>{
        state.loads.push(filters);const r=state.rows.get(filters.find(([key])=>key==='id')[1])
        return {data:r && filters.every(([key,value])=>r[key]===value)?r:null,error:null}
      }}
      return {...read,insert(input){state.attempts++;return {select(){return {single:async()=>{
        if(state.rows.has(input.id))return {data:null,error:{code:'23505'}}
        const r=record();r.id=input.id;r.doctor_id=input.doctor_id;r.clinic_id=input.clinic_id;r.patient_id=input.patient_id
        Object.assign(r.issuance_snapshot,{prescription_id:input.id,doctor_id:input.doctor_id,clinic_id:input.clinic_id,patient_id:input.patient_id,...input.data})
        state.rows.set(input.id,r);state.writes++
        if(state.loseResponse){state.loseResponse=false;throw Error('lost response')}
        return {data:r,error:null}
      }}}}}}
    }}
  const mod={exports:{}}
  const js=ts.transpileModule(fs.readFileSync('app/actions/save-prescription.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(js,{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic'}},require(name){
    if(name==='@supabase/ssr')return {createServerClient:()=>client}
    if(name==='next/headers')return {cookies:async()=>({getAll:()=>[],set(){}})}
    if(name==='@/lib/prescription-policy.mjs')return policy
    if(name==='@/lib/prescription-receipt.mjs')return receipt
    throw Error(name)
  }})
  return {state,save:(overrides={})=>mod.exports.savePrescription({requestId:ids[0],clinicId:ids[1],patientId:ids[2],
    medications:[{name:'A',dosage:'B',duration:'C'}],indications:'Original indications',...overrides})}
}
test('concurrent actual-action retries with one UUID return the same receipt with one persisted insert',async()=>{
  const h=retryHarness(),results=await Promise.all([h.save(),h.save()])
  assert.ok(results.every(r=>r.success));assert.deepEqual(results[0].prescription,results[1].prescription)
  assert.equal(h.state.writes,1);assert.equal(h.state.rows.size,1);assert.equal(h.state.loads.length,1)
  assert.deepEqual(h.state.loads[0].map(([key])=>key),['id','clinic_id','patient_id','doctor_id'])
})
test('lost INSERT response followed by identical retry returns the immutable receipt',async()=>{
  const h=retryHarness({loseResponse:true})
  assert.equal((await h.save()).success,false)
  assert.equal((await h.save()).success,true);assert.equal(h.state.writes,1)
})
test('same UUID cannot change the issued intent or expose a different patient/clinic/issuer',async()=>{
  const h=retryHarness();assert.equal((await h.save()).success,true)
  for(const override of [{indications:'Changed'},{medications:[{name:'Different',dosage:'B',duration:'C'}]},
    {clinicId:ids[2]},{patientId:ids[1]}])assert.equal((await h.save(override)).success,false)
  const foreign=record();foreign.doctor_id=ids[1];foreign.issuance_snapshot.doctor_id=ids[1]
  const h2=retryHarness({initial:foreign});assert.equal((await h2.save()).success,false)
  assert.equal(h.state.writes,1);assert.equal(h2.state.writes,0)
})
test('missing or invalid request UUID denies before any insert',async()=>{
  const h=retryHarness()
  for(const requestId of [null,undefined,'invalid',''])assert.equal((await h.save({requestId})).success,false)
  assert.equal(h.state.attempts,0)
})
test('actual save action rejects missing/corrupt receipt and ambiguous provider outcomes',async()=>{
  for(const h of [actionHarness(null),actionHarness({...record(),issuance_snapshot:null}),actionHarness(null,{message:'raw sensitive error'}),actionHarness(null,null,true)]) {
    const result=await h.save();assert.equal(result.success,false);assert.equal(h.writes.length,1)
    assert.doesNotMatch(result.error,/sensitive/)
  }
})
test('actual PDF engine prints the persisted date and does not fabricate registration/contact values',()=>{
  const texts=[]
  let bytes
  function PDF(...args) {
    const doc=new (require('jspdf').jsPDF)(...args),text=doc.text.bind(doc)
    doc.text=(value,...rest)=>{texts.push(value);return text(value,...rest)}
    doc.save=()=>{bytes=Buffer.from(doc.output('arraybuffer'))}
    return doc
  }
  const mod={exports:{}}
  const js=ts.transpileModule(fs.readFileSync('lib/pdf-generator.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(js,{module:mod,exports:mod.exports,Date,console,require(name){
    if(name==='jspdf')return PDF
    if(name==='jspdf-autotable')return require(name)
    throw Error(name)
  }})
  mod.exports.generatePrescription(receipt.prescriptionPdfFromReceipt(record()))
  assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,4).toString(),'%PDF')
  assert.ok(texts.includes('Fecha: 2/10/2026'))
  assert.ok(texts.includes('Registro no informado'))
  assert.ok(texts.includes('Especialidad no informada'))
  assert.ok(!texts.some(value=>typeof value==='string' && /999 999|0000-00|Senescyt/.test(value)))
})
