const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const policy=require('../../lib/prescription-policy.mjs')
const clinic='880e8400-e29b-41d4-a716-446655440001',patient='880e8400-e29b-41d4-a716-446655440002',user='880e8400-e29b-41d4-a716-446655440003'
function harness(options={}){
  let cursor=0,slots=[],pending=[],tree,uuidCount=0
  const state={saves:[],exports:[],messages:[],failOnce:options.failOnce}
  const auth={user:{id:user},currentClinicId:clinic,isRevalidating:false}
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
    useCallback(fn,deps){const i=cursor++;if(!slots[i] || deps.some((v,n)=>v!==slots[i].deps[n]))slots[i]={fn,deps};return slots[i].fn},
    useEffect(fn,deps){const i=cursor++;if(!slots[i] || deps.some((v,n)=>v!==slots[i][n])){slots[i]=deps;pending.push(fn)}}}
  const q={select(){return q},eq(){return q},is(){return q},order(){return q},maybeSingle:async()=>({data:{status:'active'},error:null}),
    then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}}
  const client={from:()=>q,rpc:async()=>({data:'doctor',error:null})}
  const jsx=(type,props)=>({type,props}),mod={exports:{}}
  const js=ts.transpileModule(fs.readFileSync('components/patient-prescriptions.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  vm.runInNewContext(js,{module:mod,exports:mod.exports,console,crypto:options.noCrypto?undefined:{randomUUID:()=>`990e8400-e29b-41d4-a716-${String(++uuidCount).padStart(12,'0')}`},require(name){
    if(name==='react')return react
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}
    if(name==='@/lib/supabase')return {supabase:client}
    if(name==='@/components/auth-context')return {useAuth:()=>auth}
    if(name==='@/lib/prescription-policy.mjs')return policy
    if(name==='@/app/actions/save-prescription')return {savePrescription:async(input)=>{state.saves.push(input);if(state.failOnce){state.failOnce=false;throw Error('lost response')}
      return {success:true,prescription:{id:input.requestId,clinic_id:input.clinicId,patient_id:input.patientId,doctor_id:user,issuance_snapshot:null}}}}
    if(name==='@/lib/pdf-client')return {exportPersistedPrescription:async(_client,scope,current)=>{if(current())state.exports.push(scope);return true}}
    if(name==='sonner')return {toast:{error:m=>state.messages.push(m),success(){},info(){}}}
    return new Proxy({}, {get:()=>name})
  }})
  function find(node,predicate){if(!node || typeof node!=='object')return null;if(node.props && predicate(node.props))return node.props
    for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value){const p=find(child,predicate);if(p)return p}}else{const p=find(value,predicate);if(p)return p}}return null}
  function render(){cursor=0;pending=[];tree=mod.exports.PatientPrescriptions({patientId:patient,patientName:'Editable UI name'});const effects=pending;pending=[];effects.forEach(fn=>fn());return tree}
  return {state,auth,render,async ready(){render();await new Promise(setImmediate);render()},
    change(placeholder,value){const p=find(tree,p=>p.placeholder===placeholder);assert.ok(p,placeholder);p.onChange({target:{value}});render()},
    async save(){const p=find(tree,p=>p.children==='Generar e Imprimir' || Array.isArray(p.children)&&p.children.includes('Generar e Imprimir'));assert.ok(p);await p.onClick();render()}}
}
async function fill(h){await h.ready();h.change('Ej. Paracetamol 500mg','A');h.change('Ej. 1 tableta c/ 8h','B');h.change('Ej. 3 días','C')}
test('actual Rx component keeps one UUID across unchanged retries and PDF; edits allocate a new request',async()=>{
  const h=harness({failOnce:true});await fill(h);await h.save();await h.save();await h.save()
  assert.equal(h.state.saves.length,3);assert.equal(new Set(h.state.saves.map(s=>s.requestId)).size,1)
  assert.equal(h.state.exports.length,2);assert.deepEqual({...h.state.exports[0]},
    {userId:user,clinicId:clinic,patientId:patient,prescriptionId:h.state.saves[1].requestId})
  h.change('Ej. Paracetamol 500mg','Changed');await h.save()
  assert.notEqual(h.state.saves[3].requestId,h.state.saves[0].requestId)
})
test('actual Rx component refuses issuance when secure UUID generation is unavailable',async()=>{
  const h=harness({noCrypto:true});await fill(h);await h.save()
  assert.equal(h.state.saves.length,0);assert.equal(h.state.exports.length,0)
  assert.ok(h.state.messages.some(m=>m.includes('navegador compatible')))
})
