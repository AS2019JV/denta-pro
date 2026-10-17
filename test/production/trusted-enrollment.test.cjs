const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path')
const root=path.resolve(__dirname,'../..')
function load(file,mocks={},env={}){
  const module={exports:{}}
  const source=fs.readFileSync(path.join(root,file),'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(compiled,{module,exports:module.exports,URL,Buffer,console:{log(){},error(){},warn(){}},
    process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public',
      SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',RESEND_API_KEY:'synthetic-resend',RESEND_FROM_EMAIL:'synthetic@example.invalid',
      NEXT_PUBLIC_APP_URL:'https://app.example.invalid',...env},cwd:()=>root},
    require(id){if(id==='server-only')return {};if(id in mocks)return mocks[id]
      if(id.startsWith('@/lib/'))return load(id.slice(2)+'.ts',mocks,env)
      return require(id)},
  })
  return module.exports
}
test('real enrollment helper uses confirmed Auth identity and delegates only narrow ordinary-client RPCs',async()=>{
  const calls=[],helper=load('lib/verified-enrollment.ts'),client={
    auth:{getUser:async()=>({data:{user:{id:'verified',email:'verified@example.invalid',email_confirmed_at:'confirmed',
      user_metadata:{clinic_id:'forged',role:'clinic_owner',pending_clinic:{id:'forged'}}}},error:null})},
    rpc:async(name,args)=>{calls.push({name,args});return {data:name.startsWith('redeem')?'clinic-id':null,error:null}},
  }
  assert.equal((await helper.finishVerifiedEnrollment(client,'signup')).success,true)
  assert.equal(calls[0].name,'complete_verified_clinic_registration');assert.equal(calls[0].args,undefined)
  assert.equal((await helper.finishVerifiedEnrollment(client,'invite','synthetic-capability')).success,true)
  assert.equal(calls[1].name,'redeem_verified_clinic_invitation')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].args)),{p_token:'synthetic-capability'})
  assert.equal((await helper.finishVerifiedEnrollment(client,'recovery')).success,true);assert.equal(calls.length,2)
})
test('unconfirmed/missing/failed identities and unusable invite capabilities cause no membership RPC',async()=>{
  const helper=load('lib/verified-enrollment.ts')
  for(const outcome of [{data:{user:null},error:null},{data:{user:{email:'x@example.invalid'}},error:null},
    {data:{user:{email:'x@example.invalid',email_confirmed_at:'confirmed'}},error:{message:'denied'}}]){
    let calls=0;const client={auth:{getUser:async()=>outcome},rpc:async()=>{calls++;return {error:null}}}
    assert.equal((await helper.finishVerifiedEnrollment(client,'invite','token')).success,false);assert.equal(calls,0)
  }
  let calls=0;const client={auth:{getUser:async()=>({data:{user:{email:'x@example.invalid',email_confirmed_at:'confirmed'}},error:null})},
    rpc:async()=>{calls++;return {error:null}}}
  for(const token of [null,{},'', 'x'.repeat(513)])assert.equal((await helper.finishVerifiedEnrollment(client,'invite',token)).success,false)
  assert.equal((await helper.finishVerifiedEnrollment(client,'unknown')).success,false);assert.equal(calls,0)
})
test('completion RPC errors or transport failures never report enrolled access',async()=>{
  const helper=load('lib/verified-enrollment.ts')
  for(const type of ['signup','invite'])for(const fails of ['error','throw']){
    const client={auth:{getUser:async()=>({data:{user:{email:'x@example.invalid',email_confirmed_at:'confirmed'}},error:null})},
      rpc:async()=>{if(fails==='throw')throw Error('synthetic failure');return {data:null,error:{message:'synthetic denied'}}}}
    assert.equal((await helper.finishVerifiedEnrollment(client,type,'token')).success,false)
  }
})
function registrationHarness(options={}){
  const state={calls:[],mails:[],...options},client={
    from(){const builder={select(){return this},eq(){return this},single:async()=>({data:null,error:null})};return builder},
    auth:{admin:{
      createUser:async payload=>{state.calls.push({createUser:payload});return {data:{user:{id:'server-created-auth-id'}},error:null}},
      generateLink:async()=>{state.calls.push({generateLink:true});return {data:{user:{id:state.linkUserId || 'server-created-auth-id'},
        properties:{action_link:'https://synthetic.invalid/verify',hashed_token:'synthetic'}},error:state.linkError || null}},
    }},
    rpc:async(name,args)=>{state.calls.push({rpc:name,args});if(state.intentThrows)throw Error('synthetic transport failure');return {error:state.intentError || null}},
  }
  const action=load('app/actions/register-clinic.ts',{
    '@supabase/supabase-js':{createClient:()=>client},
    'next/headers':{headers:async()=>new Headers()},
    '@/lib/server-email-gate':{consumeEmailBudget:async()=>({allowed:true})},
    resend:{Resend:class{emails={send:async data=>{state.mails.push(data);return {error:state.deliveryError || null}}}}},
  })
  const form=new FormData()
  for(const [key,value] of Object.entries({firstName:'Synthetic',lastName:'Patient',email:'synthetic@example.invalid',
    password:'synthetic-password',practiceName:'Server validated clinic',practiceSize:'small',
    clinicId:'attacker-existing-clinic',role:'clinic_owner',subscription_tier:'enterprise'}))form.set(key,value)
  return {state,run:()=>action.registerClinic(form)}
}
test('signup binds returned Auth ID to server-generated clinic intent before link generation; metadata contains no authority',async()=>{
  const h=registrationHarness();assert.equal((await h.run()).success,true)
  assert.equal(h.state.calls[1].rpc,'store_clinic_registration_intent')
  assert.equal(h.state.calls[1].args.p_user_id,'server-created-auth-id')
  assert.match(h.state.calls[1].args.p_clinic_id,/^[0-9a-f-]{36}$/)
  assert.equal(h.state.calls[1].args.p_name,'Server validated clinic')
  assert.deepEqual(Object.keys(h.state.calls[0].createUser.user_metadata).sort(),['full_name','phone','title'])
  assert.equal(h.state.calls[2].generateLink,true)
  assert.equal(h.state.mails.length,1)
})
test('signup intent failure stops email generation and leaves an honest support outcome',async()=>{
  for(const outcome of [{intentError:{message:'synthetic unavailable'}},{intentThrows:true}]){
    const h=registrationHarness(outcome),result=await h.run()
    assert.equal(result.success,undefined);assert.match(result.error,/cuenta fue creada.*soporte/)
    assert.equal(h.state.calls.length,2);assert.equal(h.state.mails.length,0)
  }
})
test('signup definite mail rejection keeps the already recorded server intent for confirmed retry',async()=>{
  const h=registrationHarness({deliveryError:{message:'synthetic rejection'}}),result=await h.run()
  assert.equal(result.canResend,true);assert.equal(h.state.calls[1].rpc,'store_clinic_registration_intent')
  assert.equal(h.state.calls.filter(c=>c.rpc).length,1)
})
test('signup link-generation failure retains stored intent and offers resend; identity drift requires review with no email',async()=>{
  const failed=registrationHarness({linkError:{message:'synthetic rejection'}}),retry=await failed.run()
  assert.equal(retry.canResend,true);assert.equal(failed.state.calls[1].rpc,'store_clinic_registration_intent')
  assert.equal(failed.state.mails.length,0)
  const drift=registrationHarness({linkUserId:'different-auth-id'}),review=await drift.run()
  assert.equal(review.success,undefined);assert.equal(review.canResend,undefined)
  assert.match(review.error,/soporte/);assert.equal(drift.state.mails.length,0)
})
test('real completion server action constructs only an ordinary cookie client',async()=>{
  const calls=[],action=load('app/actions/complete-verified-enrollment.ts',{
    'next/headers':{cookies:async()=>({getAll:()=>[],set(){}})},
    '@supabase/ssr':{createServerClient:(_url,key)=>{calls.push(key);return {
      auth:{getUser:async()=>({data:{user:{id:'verified',email:'x@example.invalid',email_confirmed_at:'confirmed'}},error:null})},
      rpc:async()=>({data:'clinic-id',error:null}),
    }}},
  })
  assert.equal((await action.completeVerifiedEnrollment('invite','synthetic-token')).success,true)
  assert.deepEqual(calls,['synthetic-public'])
})
