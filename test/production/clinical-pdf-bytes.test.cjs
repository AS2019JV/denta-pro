const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function engine(){
  const documents=[],m={exports:{}}
  function PDF(...args){const doc=new (require('jspdf').jsPDF)(...args)
    doc.save=()=>documents.push({doc,bytes:Buffer.from(doc.output('arraybuffer'))});return doc}
  const js=ts.transpileModule(fs.readFileSync('lib/pdf-generator.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(js,{module:m,exports:m.exports,Date,console,require(name){
    if(name==='jspdf')return {__esModule:true,default:PDF}
    if(name==='jspdf-autotable')return require(name)
    throw Error(name)
  }})
  return {...m.exports,documents}
}
test('real PDF bytes keep all 20 medications and the end of maximum-length indications on paginated pages',()=>{
  const e=engine()
  e.generatePrescription({prescriptionId:'PERSISTED_QA_RECEIPT_ID',clinicName:'SYNTHETIC CLINIC',patientName:'FULL SYNTHETIC PATIENT',patientId:'QA',
    issuedAt:'2026-10-02T02:00:00Z',doctorName:'ORIGINAL SYNTHETIC AUTHOR',
    medications:Array.from({length:20},(_,i)=>({name:`MEDICATION_${i+1}`,dosage:'SYNTHETIC DOSE',duration:'SYNTHETIC DURATION'})),
    indications:'SYNTHETIC INDICATION '.repeat(99)+'END_QA'})
  const {doc,bytes}=e.documents[0],pdf=bytes.toString('latin1')
  assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.ok(doc.getNumberOfPages()>1)
  for(const marker of ['MEDICATION_1','MEDICATION_20','END_QA','ORIGINAL SYNTHETIC AUTHOR','Fecha: 1/10/2026'])assert.ok(pdf.includes(marker),marker)
  assert.ok(!pdf.includes('Dr. Profesional'));assert.ok(!pdf.includes('0000-00'))
  for(const page of doc.internal.pages.slice(1))assert.ok(page.join('\n').includes('PERSISTED_QA_RECEIPT_ID'))
})
test('real HCU PDF preserves full identity, actual sessions and long notes without inventing definitive diagnosis',()=>{
  const e=engine()
  e.generateHCU033({nombre_completo:'MARIA JOSE DE LA CRUZ SYNTHETIC',identificacion:'QA',
    motivo_consulta:'SYNTHETIC NARRATIVE '.repeat(150)+'END_HCU_QA',responsable:'GUARDIAN_QA',
    diagnosticos:[{descripcion:'DIAG_QA',codigo:'CIE_QA'},{descripcion:'PRESUMPTIVE_QA',tipo:'presuntivo'}],
    plan_terapeutico:[{procedimiento:'FUTURE_PLAN_QA'}],
    registro_sesiones:[{procedimiento:'PERFORMED_SESSION_QA',medicamentos:'SESSION_MEDICATION_QA',profesional:'SESSION_AUTHOR_QA'}],
    odontograma_data:{48:{condition:'extraction',status:'completed',recesion:'2',movilidad:'1',notes:'TOOTH_NOTE_QA',surfaces:{top:'sealant:blue'},bridge:{type:'fixed',start:48,end:45,status:'completed'}}},
    export_metadata:{id:'HCU_QA',doctor_id:'RECORDED_AUTH_UID',created_at:'2026-10-02T18:00:00Z'}})
  const {doc,bytes}=e.documents[0],pdf=bytes.toString('latin1')
  assert.ok(doc.getNumberOfPages()>=3)
  for(const marker of ['MARIA JOSE DE LA CRUZ SYNTHETIC','PERFORMED_SESSION_QA','SESSION_MEDICATION_QA','SESSION_AUTHOR_QA','GUARDIAN_QA','END_HCU_QA','RECORDED_AUTH_UID','No registrado','Pre.','TOOTH_NOTE_QA','sealant:blue','fixed'])assert.ok(pdf.includes(marker),marker)
  assert.ok(!pdf.includes('(Def.)'))
  // Independent screen diagram convention: patient right appears on reader left.
  const page=doc.internal.pages[1].join('\n'),left=page.indexOf('(48)'),right=page.indexOf('(31)')
  assert.ok(left>=0 && left<right)
  assert.ok(page.indexOf('(85)')<page.indexOf('(71)'))
})
