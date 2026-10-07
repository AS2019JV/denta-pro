const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const clinicA = '33333333-3333-4333-8333-333333333333'
const clinicB = '44444444-4444-4444-8444-444444444444'
const origin = 'https://app.example.invalid'

// Execute the actual action/route; replace providers only. These are not JWT/RLS tests.
function sourceModule(file, requireMock, env = {}) {
  const module = {exports:{}}
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(code, {module,exports:module.exports,require:requireMock,
    process:{env},console:{warn(){},error(){},info(){}},URL,Buffer,TextEncoder})
  return module.exports
}
function harness(options = {}) {
  const state = {
    profile:{status:'active',deleted_at:null}, membership:{clinic_id:clinicA,role:'clinic_owner',status:'active'},
    user:{id:'actor',app_metadata:{clinic_id:clinicA,role:'clinic_owner'}}, ...options,
    clients:[], rpcCalls:[], identities:[], generated:[], inserted:[], sent:[], writes:[],
  }
  const rows = {
    patients:[{id:'patient-a',clinic_id:clinicA,email:'patient@example.invalid',deleted_at:null},
      {id:'patient-b',clinic_id:clinicB,email:'foreign@example.invalid',deleted_at:null}],
    profiles:[{id:'staff',clinic_id:clinicA,email:'staff@example.invalid',status:'active',deleted_at:null}],
    clinic_members:[{user_id:'staff',clinic_id:clinicA,status:'active'}], clinic_invitations:[],
    ...(options.rows || {}),
  }
  state.rows = rows
  const client = kind => ({
    auth:{getUser:async token=>{state.identities.push({kind,token});return {
      data:{user:state.identityError ? null : state.user},error:state.identityError || null}},
      admin:{generateLink:async input=>{state.generated.push(input)
        assert.ok(rows.clinic_invitations.some(row=>row.status==='pending' && row.email===input.email), 'reserve before Auth generation')
        if(state.linkThrows)throw Error('synthetic generation transport failure')
        return {data:{properties:state.linkMissingToken ? {} : {hashed_token:`synthetic-hash-${state.generated.length}`},user:{id:'invitee'}},error:state.linkError || null}}}},
    rpc:async(name,args)=>{
      state.rpcCalls.push({kind,name,args})
      if(state.rpcError) return {data:null,error:state.rpcError}
      if(name==='get_user_clinic_id')return {data:state.membership?.clinic_id || null,error:null}
      assert.equal(name,'get_clinic_member_role')
      const active = state.profile?.status==='active' && state.profile.deleted_at==null
        && state.membership?.status==='active' && state.membership.clinic_id===args.check_clinic_id
      return {data:active ? state.membership.role : null,error:null}
    },
    from(table) {
      let selected = [...(rows[table] || [])]
      let mutation, applied = false
      const result = () => {
        const release = mutation?.values.status === 'expired'
        const error = mutation ? (release ? state.releaseError : state.updateError) : state.queryError?.table===table ? state.queryError : null
        if (mutation && !error && !applied) {
          if (release ? state.releaseMatchesNone : state.updateMatchesNone) selected = []
          selected.forEach(row=>Object.assign(row,mutation.values));applied=true
        }
        return {data:selected,error:error || null}
      }
      const builder = {
        select(){return this},eq(key,value){if(mutation)mutation.filters.push([key,value]);selected=selected.filter(row=>row[key]===value);return this},
        is(key,value){selected=selected.filter(row=>row[key]===value);return this},
        in(key,values){selected=selected.filter(row=>values.includes(row[key]));return this},
        async maybeSingle(){const r=result();return {...r,data:r.error ? null : selected[0] || null}},
        then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
        async insert(row){state.inserted.push(row)
          // Synthetic model of the prospective partial unique index; not a DB test.
          const conflict=table==='clinic_invitations' && rows[table].some(existing=>existing.status==='pending'
            && existing.clinic_id===row.clinic_id && existing.email.toLowerCase()===row.email.toLowerCase())
          const error=state.insertError || (conflict ? {code:'23505'} : null)
          if(!error)rows[table].push({...row,id:row.id || `invite-${state.inserted.length}`,expires_at:new Date(Date.now()+7*86400000).toISOString()})
          return {error}},
        upsert(row){state.writes.push(row);return Promise.resolve({error:null})},
        update(row){mutation={table,values:row,filters:[]};state.writes.push(mutation);return this},
      }
      return builder
    },
  })
  const env = {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59999',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
    NEXT_PUBLIC_APP_URL:origin,RESEND_API_KEY:'synthetic-resend',...options.env}
  const imports = id => {
    if(id==='node:crypto')return require('node:crypto')
    if(id==='next/server')return {NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}}
    if(id==='next/headers')return {cookies:async()=>({getAll:()=>state.cookies || [],set(){}}),headers:async()=>new Headers({origin})}
    if(id==='@/lib/server-email-gate')return {consumeEmailBudget:async()=>({allowed:true})}
    if(id==='@supabase/ssr')return {createServerClient:()=>{state.clients.push({kind:'cookie'});return client('cookie')}}
    if(id==='@supabase/supabase-js')return {createClient:(_url,key,config)=>{
      const kind=key==='synthetic-service'?'admin':'bearer';state.clients.push({kind,config});return client(kind)}}
    if(id==='resend')return {Resend:class {emails={send:async payload=>{
      state.sent.push(payload);if(state.sendThrows)throw Error('synthetic transport failure');
      return {data:{id:'synthetic-message'},error:state.sendError || null}}}}}
    if(id==='@/lib/env')return {env:{}}
    if(id==='@/lib/html-escape')return sourceModule('lib/html-escape.ts',imports)
    if(id==='@/lib/auth-email-contract')return sourceModule('lib/auth-email-contract.ts',imports)
    throw Error(`Unexpected import ${id}`)
  }
  return {...sourceModule('app/api/send-email/route.ts',imports,env),
    ...sourceModule('app/actions/invite-member.ts',imports,env),state}
}
function request(body = {}, headers = {}) {
  return new Request(`${origin}/api/send-email`,{method:'POST',
    headers:{origin,'content-type':'application/json',...headers},
    body:JSON.stringify({to:'patient@example.invalid',template:'welcome',clinicId:clinicA,...body})})
}
function form(values = {}) {
  const fields={email:'invitee@example.invalid',clinicId:clinicA,role:'doctor',name:'Synthetic',...values}
  return {get:key=>fields[key] ?? null}
}
function noPrivilegedEffects(h) {
  assert.equal(h.state.generated.length,0);assert.equal(h.state.inserted.length,0)
  assert.equal(h.state.sent.length,0);assert.ok(!h.state.clients.some(c=>c.kind==='admin'))
}
for(const [label,options] of [
  ['suspended profile',{profile:{status:'suspended',deleted_at:null}}],
  ['deleted profile',{profile:{status:'active',deleted_at:'2026-10-01'}}],
  ['missing profile',{profile:null}], ['removed membership',{membership:null}],
  ['null membership status',{membership:{clinic_id:clinicA,role:'clinic_owner',status:null}}],
  ['unknown role',{membership:{clinic_id:clinicA,role:'admin',status:'active'}}],
  ['RPC error',{rpcError:{message:'synthetic unavailable'}}],
]) test(`live denial blocks email and invitation before service role: ${label}`,async()=>{
  const h=harness(options);assert.equal((await h.POST(request())).status,403)
  await assert.rejects(h.inviteTeamMember(form()),/403 Forbidden/);noPrivilegedEffects(h)
})
test('doctor/receptionist cannot invite despite historical owner metadata; operational email is allowed',async()=>{
  for(const role of ['doctor','receptionist']){
    const h=harness({membership:{clinic_id:clinicA,role,status:'active'}})
    await assert.rejects(h.inviteTeamMember(form()),/403 Forbidden/);noPrivilegedEffects(h)
    assert.equal((await h.POST(request())).status,200);assert.equal(h.state.sent.length,1)
  }
})
test('foreign clinic and forged preference never grant authority',async()=>{
  const h=harness({cookies:[{name:'clinia-clinic',value:clinicB}]})
  assert.equal((await h.POST(request({clinicId:clinicB}))).status,403)
  assert.equal((await h.POST(request({clinicId:undefined}))).status,403)
  await assert.rejects(h.inviteTeamMember(form({clinicId:clinicB})),/403 Forbidden/)
  noPrivilegedEffects(h)
})
test('Bearer identity and DB RPC share the exact token without cookie client',async()=>{
  const h=harness({cookies:[{name:'clinia-clinic',value:clinicB}]})
  const r=request({clinicId:undefined},{authorization:'Bearer synthetic-token'})
  r.headers.delete('origin');assert.equal((await h.POST(r)).status,200)
  assert.equal(h.state.identities[0].token,'synthetic-token')
  assert.equal(h.state.clients[0].config.global.headers.Authorization,'Bearer synthetic-token')
  assert.ok(!h.state.clients.some(c=>c.kind==='cookie'))
  assert.deepEqual(h.state.rpcCalls.map(c=>c.kind),['bearer','bearer'])
})
test('same previously valid token loses authority after committed live membership change',async()=>{
  const h=harness(),headers={authorization:'Bearer synthetic-unchanged-token'}
  assert.equal((await h.POST(request({},headers))).status,200)
  await h.inviteTeamMember(form())
  const before={sent:h.state.sent.length,generated:h.state.generated.length,admin:h.state.clients.filter(c=>c.kind==='admin').length}
  h.state.membership.status='removed'
  assert.equal((await h.POST(request({},headers))).status,403)
  await assert.rejects(h.inviteTeamMember(form()),/403 Forbidden/)
  assert.equal(h.state.sent.length,before.sent);assert.equal(h.state.generated.length,before.generated)
  assert.equal(h.state.clients.filter(c=>c.kind==='admin').length,before.admin)
})
test('invalid explicit bearer never falls back to an otherwise valid cookie identity',async()=>{
  for(const authorization of ['Basic synthetic','Bearer ','Bearer invalid token']){
    const h=harness();assert.equal((await h.POST(request({}, {authorization}))).status,401)
    assert.equal(h.state.identities.length,0);noPrivilegedEffects(h)
  }
  const h=harness({identityError:{message:'invalid token'}})
  assert.equal((await h.POST(request({}, {authorization:'Bearer bad-token'}))).status,401)
  assert.equal(h.state.identities.length,1);assert.equal(h.state.identities[0].kind,'bearer');noPrivilegedEffects(h)
})
test('cookie email requires exact incoming origin and JSON before identity/provider effects',async()=>{
  for(const supplied of [undefined,'https://evil.example.invalid',`${origin}.evil.invalid`,`${origin}/`]){
    const h=harness(),r=request();if(supplied===undefined)r.headers.delete('origin');else r.headers.set('origin',supplied)
    assert.equal((await h.POST(r)).status,403);assert.equal(h.state.identities.length,0);noPrivilegedEffects(h)
  }
  const h=harness();assert.equal((await h.POST(request({}, {'content-type':'text/plain'}))).status,415)
  assert.equal(h.state.identities.length,0);noPrivilegedEffects(h)
})
test('recipient checks reject foreign/deleted patients, removed staff and lookup errors',async()=>{
  const foreign=harness();assert.equal((await foreign.POST(request({to:'foreign@example.invalid'}))).status,403)
  const deleted=harness({rows:{patients:[{id:'p',clinic_id:clinicA,email:'patient@example.invalid',deleted_at:'2026-10-01'}]}})
  assert.equal((await deleted.POST(request())).status,403)
  const removed=harness({rows:{clinic_members:[]}})
  assert.equal((await removed.POST(request({to:'staff@example.invalid'}))).status,403)
  const failed=harness({queryError:{table:'patients',message:'synthetic failure'}})
  assert.equal((await failed.POST(request())).status,503)
  for(const h of [foreign,deleted,removed,failed])assert.equal(h.state.sent.length,0)
  const allowed=harness();assert.equal((await allowed.POST(request({to:'staff@example.invalid'}))).status,200)
})
test('active owner invite escapes HTML and does not write profile authority or expose token',async()=>{
  const h=harness(),result=await h.inviteTeamMember(form({name:'<img src=x onerror=probe()>'}))
  assert.deepEqual(Object.keys(result),['success']);assert.equal(result.success,true)
  assert.equal(h.state.generated.length,1);assert.equal(h.state.inserted.length,1);assert.equal(h.state.sent.length,1)
  assert.equal(h.state.writes.length,1);assert.equal(h.state.writes[0].table,'clinic_invitations')
  assert.equal(h.state.rows.clinic_invitations[0].token,'synthetic-hash-1')
  assert.equal(h.state.rows.clinic_invitations[0].auth_ready,true)
  assert.notEqual(h.state.inserted[0].token,'synthetic-hash-1')
  assert.match(h.state.sent[0].html,/&lt;img src=x onerror=probe\(\)&gt;/)
  assert.ok(!h.state.sent[0].html.includes('<img src=x'))
})
test('invitation lookup/record/delivery failures are reported honestly; no send after failed record',async()=>{
  const lookup=harness({queryError:{table:'clinic_invitations'}})
  await assert.rejects(lookup.inviteTeamMember(form()),/verificar/);assert.equal(lookup.state.generated.length,0)
  const record=harness({insertError:{message:'synthetic failure'}})
  await assert.rejects(record.inviteTeamMember(form()),/registrar/);assert.equal(record.state.sent.length,0);assert.equal(record.state.generated.length,0)
  const delivery=harness({sendError:{message:'synthetic provider rejection'}})
  await assert.rejects(delivery.inviteTeamMember(form()),/rechazó.*volver a intentarlo/)
})
test('definite provider rejection expires only the new pending record and permits the next call',async()=>{
  const h=harness({sendError:{message:'synthetic rejection'},rows:{clinic_invitations:[
    {id:'other-clinic',clinic_id:clinicB,email:'invitee@example.invalid',token:'other-token',status:'pending'},
    {id:'accepted',clinic_id:clinicA,email:'previous@example.invalid',token:'previous-token',status:'accepted'},
  ]}})
  await assert.rejects(h.inviteTeamMember(form()),/rechazó.*volver a intentarlo/)
  assert.equal(h.state.rows.clinic_invitations[0].status,'pending')
  assert.equal(h.state.rows.clinic_invitations[1].status,'accepted')
  assert.equal(h.state.rows.clinic_invitations[2].status,'expired')
  assert.deepEqual(h.state.writes[1].filters,[['id',h.state.rows.clinic_invitations[2].id],['clinic_id',clinicA],['token','synthetic-hash-1'],['status','pending']])
  h.state.sendError=null
  assert.equal((await h.inviteTeamMember(form())).success,true)
  assert.equal(h.state.rows.clinic_invitations[3].status,'pending')
  assert.equal(h.state.generated.length,2);assert.equal(h.state.sent.length,2)
  await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
  assert.equal(h.state.generated.length,2);assert.equal(h.state.sent.length,2)
})
test('ambiguous transport outcome preserves pending invitation and blocks blind second call',async()=>{
  const h=harness({sendThrows:true})
  await assert.rejects(h.inviteTeamMember(form()),/No se pudo confirmar el envío; revisa la invitación antes de repetir/)
  assert.equal(h.state.rows.clinic_invitations[0].status,'pending');assert.equal(h.state.writes.length,1)
  h.state.sendThrows=false
  await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
  assert.equal(h.state.generated.length,1);assert.equal(h.state.sent.length,1)
})
test('failed or unconfirmed rejection recovery preserves pending state and requires review',async()=>{
  for(const recovery of [{releaseError:{message:'synthetic unavailable'}},{releaseMatchesNone:true}]){
    const h=harness({sendError:{message:'synthetic rejection'},...recovery})
    await assert.rejects(h.inviteTeamMember(form()),/no se pudo liberar.*Revísala antes de repetir/)
    assert.equal(h.state.rows.clinic_invitations[0].status,'pending')
    h.state.sendError=null
    await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
    assert.equal(h.state.generated.length,1);assert.equal(h.state.sent.length,1)
  }
})
test('concurrent requests reserve one pending invitation before generating one Auth link',async()=>{
  const h=harness()
  const results=await Promise.allSettled([h.inviteTeamMember(form()),h.inviteTeamMember(form())])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.filter(r=>r.status==='rejected').length,1)
  assert.match(results.find(r=>r.status==='rejected').reason.message,/invitación pendiente activa/)
  assert.equal(h.state.generated.length,1);assert.equal(h.state.sent.length,1)
  assert.equal(h.state.rows.clinic_invitations.length,1)
  assert.equal(h.state.rows.clinic_invitations[0].token,'synthetic-hash-1')
})
test('pending recipient normalized index conflict prevents Auth even when exact lookup misses legacy casing',async()=>{
  const h=harness({rows:{clinic_invitations:[{id:'legacy',clinic_id:clinicA,
    email:'INVITEE@example.invalid',token:'legacy-token',status:'pending'}]}})
  await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
  assert.equal(h.state.generated.length,0);assert.equal(h.state.sent.length,0)
  assert.equal(h.state.rows.clinic_invitations.length,1)
})
test('two explicit Auth generation rejections release reservations and permit a subsequent successful retry',async()=>{
  const h=harness({linkError:{message:'synthetic definite rejection'},rows:{clinic_invitations:[
    {id:'accepted-history',clinic_id:clinicA,email:'invitee@example.invalid',token:'history-token',status:'accepted'},
  ]}})
  for(let i=0;i<2;i++){
    await assert.rejects(h.inviteTeamMember(form()),/rechazó la generación.*volver a intentarlo/)
    assert.equal(h.state.rows.clinic_invitations[i+1].status,'expired')
    assert.equal(h.state.sent.length,0)
  }
  h.state.linkError=null
  assert.equal((await h.inviteTeamMember(form())).success,true)
  assert.deepEqual(h.state.rows.clinic_invitations.map(row=>row.status),['accepted','expired','expired','pending'])
  assert.equal(h.state.generated.length,3);assert.equal(h.state.sent.length,1)
})
test('two explicit delivery rejections retain independent history and permit a third call',async()=>{
  const h=harness({sendError:{message:'synthetic definite rejection'}})
  for(let i=0;i<2;i++)await assert.rejects(h.inviteTeamMember(form()),/rechazó.*volver a intentarlo/)
  assert.deepEqual(h.state.rows.clinic_invitations.map(row=>row.status),['expired','expired'])
  h.state.sendError=null
  assert.equal((await h.inviteTeamMember(form())).success,true)
  assert.equal(h.state.generated.length,3);assert.equal(h.state.sent.length,3)
})
test('unconfirmed Auth generation preserves reservation and prevents a second provider call',async()=>{
  for(const outcome of [{linkThrows:true},{linkMissingToken:true}]){
    const h=harness(outcome)
    await assert.rejects(h.inviteTeamMember(form()),/No se pudo confirmar la generación.*revisa/)
    assert.equal(h.state.rows.clinic_invitations[0].status,'pending')
    assert.equal(h.state.sent.length,0)
    await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
    assert.equal(h.state.generated.length,1)
  }
})
test('failed token commit retains reservation for review and never delivers mail',async()=>{
  for(const outcome of [{updateError:{message:'synthetic failure'}},{updateMatchesNone:true}]){
    const h=harness(outcome)
    await assert.rejects(h.inviteTeamMember(form()),/No se pudo confirmar el registro.*revisa/)
    assert.equal(h.state.rows.clinic_invitations[0].status,'pending')
    assert.equal(h.state.rows.clinic_invitations[0].token,h.state.inserted[0].token)
    assert.equal(h.state.sent.length,0)
    await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
    assert.equal(h.state.generated.length,1)
  }
})
test('unconfirmed explicit generation recovery requires review and leaves reservation pending',async()=>{
  const h=harness({linkError:{message:'synthetic rejection'},releaseMatchesNone:true})
  await assert.rejects(h.inviteTeamMember(form()),/rechazó la generación.*no se pudo liberar/)
  assert.equal(h.state.rows.clinic_invitations[0].status,'pending');assert.equal(h.state.sent.length,0)
  await assert.rejects(h.inviteTeamMember(form()),/invitación pendiente activa/)
  assert.equal(h.state.generated.length,1)
})
test('malformed FormData, invalid UUID and oversized fields never reach privileged operations',async()=>{
  for(const values of [{clinicId:'other-clinic'},{name:'a'.repeat(121)},{email:new Blob(['fake'])},{role:'clinic_owner'}]){
    const h=harness();await assert.rejects(h.inviteTeamMember(form(values)),/400 Bad Request/);noPrivilegedEffects(h)
  }
})
