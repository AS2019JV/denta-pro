// Executes the actual HCU component load/save handlers with delayed synthetic
// ordinary-client responses. This checks editor integrity, not JWT/RLS.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
function harness(){
  const state={pending:new Map(),writes:[],published:[],calls:[],slots:[],effects:[],tree:null}
  const auth={user:{id:'doctor-a',role:'doctor'},currentClinicId:'clinic-a',isRevalidating:false}
  let cursor=0
  const react={
    useState(initial){const i=cursor++;if(!(i in state.slots))state.slots[i]=typeof initial==='function'?initial():initial
      return [state.slots[i],v=>{state.slots[i]=typeof v==='function'?v(state.slots[i]):v}]},
    useRef(initial){const i=cursor++;if(!(i in state.slots))state.slots[i]={current:initial};return state.slots[i]},
    useEffect(effect,deps){const i=cursor++,old=state.slots[i]
      if(!old || deps.some((v,n)=>v!==old.deps[n]))state.effects.push(()=>{old?.cleanup?.();state.slots[i]={deps,cleanup:effect()}})},
  }
  const client={from(table){const filters={},call={table,filters};state.calls.push(call)
    const q={select(){return q},order(){return q},limit(){return q},eq(k,v){filters[k]=v;return q},is(k,v){return q.eq(k,v)},
      abortSignal(signal){call.signal=signal;return q},
      maybeSingle:async()=>{
        if(table==='hcu033_forms'){const d=deferred();state.pending.set(filters.patient_id,d);return d.promise}
        return {data:{first_name:'SYNTHETIC',last_name:filters.id,is_smoker:true},error:null}
      },
      insert(row){state.writes.push(row);return Promise.resolve({error:null})},
      update(){return q},then(resolve){resolve({error:null})},
    };return q}},
  jsx=(_type,props)=>({props})
  const m={exports:{}},js=ts.transpileModule(fs.readFileSync('components/hcu033-form.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  vm.runInNewContext(js,{module:m,exports:m.exports,Date,Promise,AbortController,console,require(id){
    if(id==='react')return react
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx}
    if(id==='@/components/auth-context')return {useAuth:()=>auth}
    if(id==='@/lib/supabase')return {supabase:client}
    if(id==='sonner')return {toast:{success(){},error(){}}}
    return new Proxy({}, {get:()=>()=>null})
  }})
  function find(node,name){if(!node || typeof node!=='object')return
    if(node.props?.onClick?.name===name)return node.props.onClick
    for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value){const fn=find(child,name);if(fn)return fn}}else{const fn=find(value,name);if(fn)return fn}}
  }
  return {state,auth,
    render(patientId){cursor=0;state.effects=[];state.tree=m.exports.HCU033Form({patientId,onDataChange:data=>state.published.push(data)})
      for(const effect of state.effects)effect();return find(state.tree,'handleSave')},
    unmount(){for(const slot of state.slots)slot?.cleanup?.()},
    form(){return state.slots.find(value=>value && typeof value==='object' && 'nombre_completo' in value)},
  }
}
test('late HCU A response cannot populate or save patient B, and reads are clinic scoped',async()=>{
  const h=harness();h.render('patient-a');const a=h.state.pending.get('patient-a')
  const earlySave=h.render('patient-b'),b=h.state.pending.get('patient-b')
  await earlySave();assert.equal(h.state.writes.length,0)
  b.resolve({data:{form_data:{nombre_completo:'PATIENT_B',motivo_consulta:'CONTENT_B'}},error:null});await settle()
  a.resolve({data:{form_data:{nombre_completo:'PATIENT_A',motivo_consulta:'CONTENT_A'}},error:null});await settle()
  assert.equal(h.form().nombre_completo,'PATIENT_B');assert.ok(h.state.published.every(row=>row.nombre_completo==='PATIENT_B'))
  await h.render('patient-b')();assert.equal(h.state.writes.length,1)
  assert.equal(h.state.writes[0].patient_id,'patient-b');assert.equal(h.state.writes[0].form_data.nombre_completo,'PATIENT_B')
  for(const call of h.state.calls.filter(c=>c.table==='hcu033_forms' && c.signal)){
    assert.equal(call.filters.clinic_id,'clinic-a');assert.equal(call.filters.deleted_at,null)
  }
  assert.equal(h.state.calls[0].signal.aborted,true)
})
test('clinic/user change, completed revalidation and unmount discard late HCU responses',async()=>{
  for(const change of ['clinic','user','revalidation','unmount']){
    const h=harness();h.render('patient-a');const old=h.state.pending.get('patient-a')
    if(change==='unmount')h.unmount()
    else {
      if(change==='clinic')h.auth.currentClinicId='clinic-b'
      if(change==='user')h.auth.user={id:'doctor-b',role:'doctor'}
      if(change==='revalidation')h.auth.isRevalidating=true
      h.render('patient-a')
      if(change==='revalidation'){h.auth.isRevalidating=false;h.render('patient-a')}
    }
    old.resolve({data:{form_data:{nombre_completo:'LATE_OLD_CONTENT'}},error:null});await settle()
    assert.equal(h.state.published.length,0,change);assert.equal(h.state.writes.length,0,change)
    assert.notEqual(h.form().nombre_completo,'LATE_OLD_CONTENT',change)
  }
})
test('smoking does not prefill asthma, and a failed HCU load cannot be saved as a new blank record',async()=>{
  const h=harness();h.render('patient-a');h.state.pending.get('patient-a').resolve({data:null,error:null});await settle()
  assert.equal(h.form().ant_asma,false);assert.equal(h.form().nombre_completo,'SYNTHETIC patient-a')
  const failed=harness();failed.render('patient-a');failed.state.pending.get('patient-a').resolve({data:null,error:{message:'synthetic unavailable'}});await settle()
  await failed.render('patient-a')();assert.equal(failed.state.writes.length,0)
})
