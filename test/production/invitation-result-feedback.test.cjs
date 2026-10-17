const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the real submit handler, replacing only UI effects and the action boundary.
const file = path.resolve(__dirname,'../../app/(dashboard)/dentists/page.tsx')
const source = fs.readFileSync(file,'utf8')
const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let handler
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast)==='handleInvite') handler=node.initializer
  ts.forEachChild(node,visit)
}
visit(ast)
assert.ok(handler,'actual invitation submit handler exists')
const compiled = ts.transpileModule('module.exports = '+handler.getText(ast),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText

function harness(result) {
  const calls=[]
  const effect=name=>(...args)=>calls.push({name,args})
  const module={exports:{}}
  vm.runInNewContext(compiled,{
    module,FormData,
    currentClinicId:'33333333-3333-4333-8333-333333333333',
    inviteEmail:'invitee@example.invalid',inviteName:'Synthetic staff',inviteRole:'receptionist',inviteSpecialty:'',
    inviteTeamMember:async form=>{
      calls.push({name:'action',email:form.get('email'),role:form.get('role')})
      return result
    },
    toast:{error:effect('error'),success:effect('success')},
    setIsInviting:effect('loading'),setGeneratedLink:effect('link'),setIsLinkCopyOpen:effect('link-dialog'),
    setIsInviteOpen:effect('dialog'),setInviteEmail:effect('email'),setInviteName:effect('name'),
    setInviteSpecialty:effect('specialty'),setInvitationsRevision:effect('revision'),fetchMembers:effect('refresh'),
  })
  return {calls,submit:()=>module.exports({preventDefault:effect('prevent-default')})}
}

test('pending conflict displays the returned message and retains the form without success effects',async()=>{
  const error='Ya existe una invitación pendiente activa para este correo en tu clínica.'
  const h=harness({success:false,code:'INVITATION_PENDING',error})
  await h.submit()
  assert.deepEqual(h.calls.map(c=>c.name),['prevent-default','loading','action','error','loading'])
  assert.deepEqual(h.calls.filter(c=>c.name==='loading').map(c=>c.args[0]),[true,false])
  assert.equal(h.calls.find(c=>c.name==='error').args[0],error)
  assert.equal(h.calls.find(c=>c.name==='action').role,'receptionist')
})

test('successful invitation closes and clears the form and refreshes the pending list once',async()=>{
  const h=harness({success:true})
  await h.submit()
  assert.equal(h.calls.filter(c=>c.name==='success').length,1)
  assert.equal(h.calls.filter(c=>c.name==='error').length,0)
  assert.equal(h.calls.filter(c=>c.name==='revision').length,1)
  assert.equal(h.calls.filter(c=>c.name==='refresh').length,1)
  assert.equal(h.calls.find(c=>c.name==='dialog').args[0],false)
  for (const name of ['email','name','specialty']) assert.equal(h.calls.find(c=>c.name===name).args[0],'')
  assert.deepEqual(h.calls.filter(c=>c.name==='loading').map(c=>c.args[0]),[true,false])
})
