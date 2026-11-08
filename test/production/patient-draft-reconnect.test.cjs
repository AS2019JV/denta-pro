const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function harness(){
 const auth={user:{id:'doctor-a',role:'doctor'},currentClinicId:'clinic-a',isLoading:false,isRevalidating:false,authError:null}
 let cursor=0,tree;const slots=[],effects=[],reads=[]
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
 useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i]},
 useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()}})}}
 const patient={id:'patient-a',name:'Paciente',lastName:'Ficticio',status:'active'}
 const m={exports:{}},jsx=(type,props)=>({type,props})
 const code=ts.transpileModule(fs.readFileSync('app/(dashboard)/patients/[id]/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{module:m,exports:m.exports,AbortController,Promise,URL,setTimeout(){},require(id){
  if(id==='react')return react
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx}
  if(id==='next/navigation')return{useParams:()=>({id:patient.id}),useRouter:()=>({}),useSearchParams:()=>({get:()=> 'hcu033'})}
  if(id==='@/components/auth-context')return{useAuth:()=>auth}
  if(id==='@/components/translations')return{useTranslation:()=>({t:x=>x})}
  if(id==='@/hooks/use-private-media')return{usePrivateMediaUrl:()=>null}
  if(id==='@/lib/pilot-policy')return{SYNTHETIC_PILOT:true,pilotPatientTab:x=>x}
  if(id==='@/lib/prescription-policy.mjs')return{readPatientTab:x=>x}
  if(id==='@/lib/patient-detail.mjs')return{loadPatientDetail:async()=>{reads.push(true);return patient}}
  if(id==='@/lib/patient-utils')return{calculateProfileCompletion:()=>0,getCompletionColor:()=>'',getCompletionLabel:()=>''}
  if(id==='@/lib/birth-date.mjs')return{formatBirthDate:()=>null,ageFromBirthDate:()=>null}
  if(id==='@/lib/utils')return{cn:(...args)=>args.filter(Boolean).join(' ')}
  return new Proxy({},{get:(_,name)=>name})
 }})
 const walk=(node,at='root')=>{
  if(!node||typeof node!=='object')return null
  if(node.type==='HCU033Form')return{node,path:at}
  for(const [key,value]of Object.entries(node.props||{})){
   if(Array.isArray(value)){for(let i=0;i<value.length;i++){const found=walk(value[i],at+'.'+key+'.'+i);if(found)return found}}
   else if(key==='children'){const found=walk(value,at+'.children');if(found)return found}
  }
  return null
 }
 const render=()=>{cursor=0;effects.length=0;tree=m.exports.default();effects.splice(0).forEach(fn=>fn());return walk(tree)}
 return{auth,reads,render}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('patient container preserves the same HCU position through offline/reconnect but removes it on authority loss',async()=>{
 const h=harness();h.render();await settle();const loaded=h.render();assert(loaded)
 const reads=h.reads.length
 h.auth.isRevalidating=true;h.auth.authError='Conexión interrumpida';const offline=h.render()
 assert(offline,'temporary connection error must not unmount the editor');assert.equal(offline.path,loaded.path);assert.equal(offline.node.props.patientId,'patient-a')
 h.auth.authError=null;assert.equal(h.render().path,loaded.path)
 h.auth.isRevalidating=false;assert.equal(h.render().path,loaded.path);assert.equal(h.reads.length,reads)
 h.auth.user=null;h.auth.currentClinicId=undefined;h.auth.authError='Access revoked';assert.equal(h.render(),null)
})
