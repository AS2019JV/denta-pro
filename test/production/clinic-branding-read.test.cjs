'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const clinicId='11111111-1111-4111-8111-111111111111';
// The ordinary role intentionally cannot SELECT billing/entitlement columns.
const readable=new Set(['id','name','email','phone','address','logo_url','settings']);
async function renderClinic(id=clinicId){
 const states=[],effects=[],calls=[];let cursor=0;
 const fixture={id:clinicId,name:'Synthetic clinic',email:'',phone:'',address:'',logo_url:clinicId+'/synthetic.png',settings:{}};
 const auth={user:{id:'synthetic-owner',role:'clinic_owner'},currentClinicId:id};
 const query={select(value){calls.push({select:value});return this;},eq(column,value){Object.assign(calls.at(-1),{column,value});return this;},async single(){
  const request=calls.at(-1),allowed=request.select!=='*'&&request.select.split(',').every(field=>readable.has(field));
  if(!allowed)return {data:null,error:{code:'42501'}};
  assert.equal(request.column,'id');assert.equal(request.value,clinicId);
  return {data:fixture,error:null};
 }};
 const react={useState(initial){const slot=cursor++;states[slot]=initial;return [initial,value=>{states[slot]=value;}];},useEffect(effect){effects.push(effect);}};
 const module={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../components/settings/clinic-tab.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(compiled,{module,exports:module.exports,console:{error(){}},require(name){
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx:()=>null,jsxs:()=>null};
  if(name==='@/components/auth-context')return {useAuth:()=>auth};
  if(name==='@/lib/supabase')return {supabase:{from(table){assert.equal(table,'clinics');return query;}}};
  return new Proxy({},{get:()=>()=>null});
 }},{filename:'clinic-tab.tsx'});
 module.exports.ClinicTab();for(const effect of effects)effect();
 await new Promise(resolve=>setImmediate(resolve));
 return {states,calls,fixture};
}
test('clinic branding loads under ordinary column grants without widening privileges',async()=>{
 const {states,calls,fixture}=await renderClinic();
 assert.equal(calls.length,1);
 const clinic=states.find(value=>value&&typeof value==='object'&&'logo_url' in value);
 assert.equal(clinic.name,fixture.name);assert.equal(clinic.logo_url,fixture.logo_url);
});
test('clinic branding makes no database request without an active clinic scope',async()=>{
 const {calls}=await renderClinic(null);assert.equal(calls.length,0);
});
