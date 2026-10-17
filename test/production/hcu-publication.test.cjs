const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')

const scope={userId:'clinician-a',clinicId:'clinic-a',patientId:'patient-a'}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
function source(file,imports){
  const module={exports:{}}
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,
  }}).outputText
  vm.runInNewContext(code,{module,exports:module.exports,require:imports,console,Date,Promise})
  return module.exports
}
// Executes real PDF workflow with synthetic ordinary-client responses. No JWT/RLS claim.
function harness(options={}){
  const state={current:true,role:'doctor',subscription:true,userId:scope.userId,
    saved:{id:'hcu-a',clinic_id:scope.clinicId,patient_id:scope.patientId,deleted_at:null,
      form_data:{nombre_completo:'Persisted patient',motivo_consulta:'Persisted clinical entry'}},
    patient:{id:scope.patientId,clinic_id:scope.clinicId,deleted_at:null},...options,
    calls:[],publications:[]}
  const engine={generateHCU033:data=>state.publications.push(data)}
  const client={
    auth:{getUser:async()=>({data:{user:{id:state.userId}},error:state.identityError || null})},
    rpc:async(name,args)=>{
      state.calls.push({rpc:name,args})
      if(state.authorityWait)await state.authorityWait.promise
      return {data:name==='get_clinic_member_role' ? state.role : state.subscription,error:state.rpcError || null}
    },
    from(table){
      state.calls.push({table,filters:[]})
      const call=state.calls.at(-1),filters=[]
      return {
        select(){return this},order(){return this},limit(){return this},
        eq(key,value){filters.push([key,value]);call.filters.push([key,value]);return this},
        is(key,value){return this.eq(key,value)},
        async maybeSingle(){
          if(state.readWait)await state.readWait.promise
          const row=table==='hcu033_forms' ? state.saved : state.patient
          const matches=row && filters.every(([key,value])=>row[key]===value)
          return {data:matches ? row : null,error:state.readError || null}
        },
      }
    },
  }
  const pdf=source('lib/pdf-client.ts',id=>{
    assert.equal(id,'@/lib/pdf-generator');return state.importWait ? state.importWait.promise : engine
  })
  return {state,client,pdf,engine,run:()=>pdf.exportPersistedHCU033(client,scope,()=>state.current)}
}
test('HCU export reloads persisted data after deferred import; never accepts editable form data',async()=>{
  const importWait=deferred(),h=harness({importWait})
  const pending=h.run()
  assert.equal(h.state.calls.length,0)
  h.state.saved.form_data={nombre_completo:'Persisted patient',motivo_consulta:'Saved while engine loaded'}
  importWait.resolve(h.engine)
  assert.equal(await pending,true)
  assert.equal(h.state.publications.length,1)
  assert.equal(h.state.publications[0].motivo_consulta,'Saved while engine loaded')
  assert.equal(h.state.publications[0].export_metadata.id,'hcu-a')
  assert.equal(h.state.publications[0].export_metadata.doctor_id,null)
  assert.equal(h.state.calls.find(c=>c.table==='hcu033_forms').filters.some(([key,value])=>key==='clinic_id' && value===scope.clinicId),true)
  assert.deepEqual(h.state.calls.filter(c=>c.rpc).map(c=>c.rpc),['get_clinic_member_role','check_subscription_active'])
})
test('missing, foreign, deleted or malformed persisted HCU and missing patient never publish',async()=>{
  for(const options of [{saved:null},{saved:{clinic_id:'foreign',patient_id:scope.patientId}},
    {saved:{clinic_id:scope.clinicId,patient_id:'foreign'}},
    {saved:{clinic_id:scope.clinicId,patient_id:scope.patientId,deleted_at:'deleted'}},
    {saved:{clinic_id:scope.clinicId,patient_id:scope.patientId,deleted_at:null,form_data:[]}},
    {patient:null},{patient:{id:scope.patientId,clinic_id:'foreign',deleted_at:null}},
    {patient:{id:scope.patientId,clinic_id:scope.clinicId,deleted_at:'deleted'}},
    {readError:{message:'synthetic unavailable'}}]){
    const h=harness(options);await assert.rejects(h.run(),/guardada/)
    assert.equal(h.state.publications.length,0)
  }
})
test('HCU publication fails closed for lost identity, non-clinical live role, expired subscription or RPC failure',async()=>{
  for(const options of [{userId:'different-user'},{identityError:{message:'synthetic invalid'}},
    {role:'receptionist'},{role:null},{role:'admin'},{subscription:false},{subscription:null},
    {rpcError:{message:'synthetic unavailable'}}]){
    const h=harness(options);await assert.rejects(h.run(),/autorización vigente/)
    assert.equal(h.state.publications.length,0)
  }
  const owner=harness({role:'clinic_owner'});assert.equal(await owner.run(),true)
})
test('context invalidation during engine load cancels before any record read',async()=>{
  const importWait=deferred(),h=harness({importWait}),pending=h.run()
  h.state.current=false;importWait.resolve(h.engine)
  assert.equal(await pending,false);assert.equal(h.state.calls.length,0)
  assert.equal(h.state.publications.length,0)
})
test('context invalidation during record or authority reads cancels publication',async()=>{
  for(const field of ['readWait','authorityWait']){
    const wait=deferred(),h=harness({[field]:wait}),pending=h.run()
    await new Promise(resolve=>setImmediate(resolve))
    h.state.current=false;wait.resolve()
    assert.equal(await pending,false);assert.equal(h.state.publications.length,0)
  }
})
test('live clinician removal committed during import is checked after it and blocks the export',async()=>{
  const importWait=deferred(),h=harness({importWait}),pending=h.run()
  h.state.role=null;importWait.resolve(h.engine)
  await assert.rejects(pending,/autorización vigente/)
  assert.equal(h.state.publications.length,0)
})

// Small hook harness exercises the actual HCU button handler and scope effect.
// Unrelated form synchronization/loading effects are intentionally not executed.
function componentHarness(){
  const h=harness({importWait:deferred()})
  const auth={user:{id:scope.userId,role:'doctor'},currentClinicId:scope.clinicId,isRevalidating:false}
  let cursor=0,effectNumber=0,slots=[],pendingEffect,cleanup,tree
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial
      return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
    useEffect(effect,deps){const i=cursor++
      if(effectNumber++!==0)return
      if(!slots[i] || deps.some((value,n)=>value!==slots[i][n])){slots[i]=deps;pendingEffect=effect}},
  }
  const jsx=(_type,props)=>({props})
  const mod=source('components/hcu033-form.tsx',id=>{
    if(id==='react')return react
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx}
    if(id==='@/components/auth-context')return {useAuth:()=>auth}
    if(id==='@/lib/supabase')return {supabase:h.client}
    if(id==='@/lib/pdf-client')return h.pdf
    if(id==='sonner')return {toast:{success(){},error(){}}}
    return new Proxy({}, {get:()=>()=>null})
  })
  const findHandler=(node,field)=>{
    if(!node || typeof node!=='object')return
    if(field ? node.props?.id===field && node.props.onChange : node.props?.onClick?.name==='handleExport'){
      return field ? node.props.onChange : node.props.onClick
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value)){for(const child of value){const found=findHandler(child,field);if(found)return found}}
      else {const found=findHandler(value,field);if(found)return found}
    }
  }
  return {h,auth,
    render(patientId=scope.patientId,commit=true){cursor=0;effectNumber=0
      tree=mod.HCU033Form({patientId})
      if(commit && pendingEffect){cleanup?.();cleanup=pendingEffect();pendingEffect=null}
      return findHandler(tree)},
    editDraft(field,value){findHandler(tree,field)({target:{value}})},
    unmount(){cleanup?.()},
  }
}
test('actual HCU export handler cancels on patient, clinic, identity, role, revalidation or unmount during import',async()=>{
  for(const change of ['patient','clinic','identity','role','revalidation','unmount']){
    const c=componentHarness(),exportButton=c.render(),pending=exportButton()
    if(change==='unmount')c.unmount()
    else {
      if(change==='clinic')c.auth.currentClinicId='different-clinic'
      if(change==='identity')c.auth.user={id:'different-user',role:'doctor'}
      if(change==='role')c.auth.user={id:scope.userId,role:'receptionist'}
      if(change==='revalidation')c.auth.isRevalidating=true
      c.render(change==='patient'?'different-patient':scope.patientId,false)
    }
    c.h.state.importWait.resolve(c.h.engine);await pending
    assert.equal(c.h.state.publications.length,0,change)
    assert.equal(c.h.state.calls.length,0,change)
  }
})
test('actual HCU button exports saved content even when the editor contains unsaved changes',async()=>{
  const c=componentHarness();c.render()
  c.editDraft('motivo_consulta','UNSAVED EDITOR CONTENT')
  const button=c.render(),pending=button()
  c.h.state.importWait.resolve(c.h.engine);await pending
  assert.equal(c.h.state.publications.length,1)
  assert.equal(c.h.state.publications[0].export_metadata.id,'hcu-a')
  assert.equal(c.h.state.publications[0].motivo_consulta,'Persisted clinical entry')
})
test('completed same-scope revalidation never revives an already pending HCU export',async()=>{
  const c=componentHarness(),pending=c.render()()
  c.auth.isRevalidating=true;c.render()
  c.auth.isRevalidating=false;c.render()
  c.h.state.importWait.resolve(c.h.engine);await pending
  assert.equal(c.h.state.publications.length,0);assert.equal(c.h.state.calls.length,0)
})

test('HCU export provenance overrides forged JSON metadata without inventing historical author or dates',async()=>{
  const h=harness()
  h.state.saved.form_data.export_metadata={doctor_id:'forged',created_at:'forged'}
  assert.equal(await h.run(),true)
  assert.equal(h.state.publications[0].export_metadata.doctor_id,null)
  assert.equal(h.state.publications[0].export_metadata.created_at,null)
  h.state.saved.doctor_id='persisted-issuer';h.state.saved.created_at='2026-10-02T18:00:00Z'
  assert.equal(await h.run(),true)
  assert.equal(h.state.publications[1].export_metadata.doctor_id,'persisted-issuer')
  assert.equal(h.state.publications[1].export_metadata.created_at,'2026-10-02T18:00:00Z')
})
