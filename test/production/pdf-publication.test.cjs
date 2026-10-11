const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
test('deferred PDF import rechecks publication before generating a clinical download',async()=>{
  const source=fs.readFileSync('lib/pdf-client.ts','utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  let finish,calls=0,valid=true
  const loaded=new Promise(resolve=>{finish=resolve})
  const module={exports:{}}
  vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>{assert.equal(id,'@/lib/pdf-generator');return loaded}})
  const pending=module.exports.generatePrescription({synthetic:true},()=>valid)
  valid=false;finish({generatePrescription(){calls++}})
  await pending;assert.equal(calls,0)
  valid=true;await module.exports.generatePrescription({synthetic:true},()=>valid);assert.equal(calls,1)
})
