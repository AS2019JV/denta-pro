const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const clinic = '33333333-3333-4333-8333-333333333333'
async function run(pathname, {role='receptionist',status='active',identity=true,envPresent=true}={}) {
  const policy=await import('../../lib/clinic-authority.mjs')
  const jar=()=>{const values=[];return{getAll:()=>values,set:(...args)=>values.push(args.length===1?args[0]:{name:args[0],value:args[1],...(args[2]||{})})}}
  const NextResponse={next:()=>({cookies:jar(),kind:'next'}),redirect:url=>({cookies:jar(),kind:'redirect',url:String(url)})}
  const request={url:'http://127.0.0.1:3400'+pathname,nextUrl:{pathname},headers:{},cookies:{getAll:()=>[],get:()=>undefined,set(){}}}
  const env={NEXT_PUBLIC_APP_URL:'https://different-environment.invalid',...(envPresent?{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:56321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-test-key'}:{})}
  const module={exports:{}}
  const source=fs.readFileSync(path.resolve(__dirname,'../../middleware.ts'),'utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(code,{module,exports:module.exports,process:{env},URL,console,
    require(id){
      if(id==='next/server')return{NextResponse}
      if(id==='@/lib/clinic-authority.mjs')return policy
      if(id==='@supabase/ssr')return{createServerClient:(_url,_key,options)=>({
        auth:{getUser:async()=>{options.cookies.setAll([{name:'synthetic-refresh',value:'synthetic',options:{path:'/'}}]);return{data:{user:identity?{id:'actor',app_metadata:{role:'clinic_owner'},user_metadata:{role:'clinic_owner'}}:null},error:null}}},
        from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:{status,clinic_id:clinic,deleted_at:null},error:null}),then:resolve=>Promise.resolve({data:[{clinic_id:clinic,status:'active',role}],error:null}).then(resolve)}},
        rpc:async()=>({data:role,error:null})
      })}
      throw Error(id)
    }})
  return module.exports.middleware(request)
}
test('reception clinical redirect preserves canonical host and refreshed cookies',async()=>{
  const result=await run('/patients/cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  assert.equal(result.url,'http://127.0.0.1:3400/patients')
  assert.equal(result.cookies.getAll()[0].name,'synthetic-refresh')
})
test('live membership/profile override forged JWT roles and suspended access',async()=>{
  assert.equal((await run('/recipes')).url,'http://127.0.0.1:3400/dashboard')
  assert.equal((await run('/dashboard',{status:'suspended'})).url,'http://127.0.0.1:3400/login?reason=access')
  assert.equal((await run('/dashboard',{role:'doctor'})).kind,'next')
  assert.equal((await run('/reports',{role:'doctor'})).kind,'next')
  assert.equal((await run('/settings',{role:'doctor'})).url,'http://127.0.0.1:3400/dashboard')
})
test('missing identity or env fails closed for every previously omitted app entry',async()=>{
  for(const entry of ['/clinic','/marketing','/pay/fixture']) {
    assert.equal((await run(entry,{identity:false})).url,'http://127.0.0.1:3400/login')
    assert.equal((await run(entry,{envPresent:false})).url,'http://127.0.0.1:3400/login?reason=unavailable')
  }
})
