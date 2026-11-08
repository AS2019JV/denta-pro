const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
async function harness(){
 const agenda=await import('../../lib/agenda.mjs'),slots=[],effects=[],writes=[];let cursor=0,tree
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i]},useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{slots[i]={deps};effect()})}}
 const m={exports:{}},jsx=(type,props)=>({type,props})
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/appointment-editor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,Date,Number,Error,require(id){
  if(id==='react')return react
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx}
  if(id==='@tanstack/react-query')return{useQuery:()=>({data:[{id:'doctor-a',full_name:'Profesional ficticio'}],isSuccess:true}),useQueryClient:()=>({invalidateQueries:async()=>{}})}
  if(id==='@/components/auth-context')return{useAuth:()=>({user:{id:'doctor-a',role:'doctor'},currentClinicId:'clinic-a',isLoading:false,authError:null})}
  if(id==='@/lib/agenda.mjs')return{...agenda,saveAppointment:async(_client,clinic,input)=>{writes.push({clinic,input});return{id:'synthetic'}}}
  return new Proxy({},{get:(_,name)=>name})
 }})
 const find=(predicate,node)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;const children=node.props?.children||[];for(const child of Array.isArray(children)?children:[children]){const match=find(predicate,child);if(match)return match}return null}
 const render=()=>{cursor=0;effects.length=0;tree=m.exports.AppointmentEditor({open:true,onOpenChange(){},patientId:'patient-a',initialDay:'2026-11-10'});effects.splice(0).forEach(fn=>fn())}
 render();render()
 return{render,writes,field:()=>find(n=>n.props?.id==='appointment-duration',tree),submit:()=>find(n=>n.type==='form',tree).props.onSubmit({preventDefault(){}}),text:()=>JSON.stringify(tree)}
}
test('duration can be cleared without snapping to zero; blank and zero cannot save',async()=>{
 const h=await harness()
 for(const value of ['', '0']){
  h.field().props.onChange({target:{value}});h.render();assert.equal(h.field().props.value,value)
  await h.submit();h.render();assert.equal(h.writes.length,0);assert.match(h.text(),/duración debe ser de 5 a 480/)
 }
})
test('replacing duration persists the chosen minutes in Guayaquil time',async()=>{
 const h=await harness();h.field().props.onChange({target:{value:''}});h.render()
 h.field().props.onChange({target:{value:'45'}});h.render();await h.submit()
 assert.equal(h.writes.length,1);const {clinic,input}=h.writes[0]
 assert.equal(clinic,'clinic-a');assert.equal(input.patient_id,'patient-a')
 assert.equal(input.start_time,'2026-11-10T14:00:00.000Z');assert.equal(input.end_time,'2026-11-10T14:45:00.000Z')
})
