const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const clinic = '33333333-3333-4333-8333-333333333333'
const deferred = () => { let resolve; const promise = new Promise(r => {resolve = r}); return {promise, resolve} }
const flush = async () => { for (let i=0;i<15;i++) await Promise.resolve() }

async function harness(withCache) {
  const policy = await import('../../lib/clinic-authority.mjs')
  const profiles = {A:deferred(), B:deferred()}
  let identity = 'A', listener, cleanup, api, stateIndex = 0, cacheClears = 0, identityCalls=0, liveRole='doctor', identityDelay
  const windowListeners=new Map(), signOutPending=deferred()
  const published = [], timers = new Map(), contexts = {}, state = []
  const react = {
    createContext: () => ({Provider:'provider'}),
    useContext: () => withCache ? {cancelQueries:async()=>{}, clear:()=>cacheClears++} : undefined,
    useRef: current => ({current}), useCallback: fn => fn,
    useState: initial => { const index=stateIndex++; state[index]=initial; return [initial, value=>{state[index]=value; if(index===0&&value) published.push(value)}] },
    useEffect: fn => { cleanup=fn() },
  }
  const supabase = {
    auth: {getUser:async()=>{identityCalls++;if(identityDelay)await identityDelay.promise;return{data:{user:{id:identity,email:'synthetic@example.invalid'}},error:null}},signOut:()=>signOutPending.promise,
      onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe(){}}}}}},
    from(table) {
      let id
      return {select(){return this},eq(key,value){if(key==='id'||key==='user_id') id=value;return this},
        maybeSingle(){return profiles[id].promise},
        then(resolve){return Promise.resolve({data:[{clinic_id:clinic,status:'active',role:'doctor',clinics:{name:'Synthetic'}}],error:null}).then(resolve)}}
    },
    rpc:async()=>({data:liveRole,error:null}),
  }
  const module = {exports:{}}
  const source=fs.readFileSync(path.join(root,'components/auth-context.tsx'),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(js,{module,exports:module.exports,document:{cookie:'',visibilityState:'visible',addEventListener(){},removeEventListener(){}},location:{protocol:'http:'},
    window:{addEventListener:(event,fn)=>windowListeners.set(event,fn),removeEventListener:event=>windowListeners.delete(event)},setTimeout:fn=>{const key={};timers.set(key,fn);return key},clearTimeout:key=>timers.delete(key),
    require(id){if(id==='react')return react;if(id==='react/jsx-runtime')return{jsx:(_type,props)=>{api=props.value;return{}}};if(id==='@tanstack/react-query')return{QueryClientContext:contexts};if(id==='@/lib/supabase')return{supabase};if(id==='sonner')return{toast:{error(){}}};if(id==='@/lib/clinic-authority.mjs')return policy;throw Error(id)}})
  module.exports.AuthProvider({children:null})
  const drain = async () => {for(const [key,fn] of [...timers]) {timers.delete(key);fn()} await flush()}
  const profile = id => ({data:{id,status:'active',deleted_at:null,clinic_id:clinic,full_name:id},error:null})
  return {published, state, drain, resolve:id=>profiles[id].resolve(profile(id)), deny:()=>{liveRole=null}, holdIdentity:()=>{identityDelay=deferred();return identityDelay.resolve}, change:()=>{identity='B';listener('SIGNED_IN',{user:{id:'B'}})}, focus:()=>windowListeners.get('focus')(), identityCalls:()=>identityCalls, logout:()=>api.logout(), resolveSignOut:()=>signOutPending.resolve(), signOut:()=>listener('SIGNED_OUT',null), cleanup:()=>cleanup(), cacheClears:()=>cacheClears}
}
for (const withCache of [false,true]) test(`previous response cannot publish between new Auth event and timer; cache=${withCache}`, async()=>{
  const h=await harness(withCache)
  await h.drain()
  h.change()
  h.resolve('A'); await flush()
  assert.equal(h.published.length,0)
  await h.drain(); h.resolve('B'); await flush()
  assert.equal(h.published.length,1); assert.equal(h.published[0].id,'B')
  if(withCache) assert.ok(h.cacheClears()>=2)
  h.cleanup()
})
test('routine focus coalesces in-flight identity checks and retains unchanged scoped cache',async()=>{
  const h=await harness(true);await h.drain();h.focus();h.focus();await h.drain();assert.equal(h.identityCalls(),1)
  h.resolve('A');await flush();const cleared=h.cacheClears();h.focus();assert.equal(h.state[0].id,'A');assert.equal(h.state[2],false);assert.equal(h.state[3],true);await h.drain();await flush();assert.equal(h.cacheClears(),cleared);assert.equal(h.state[3],false);h.cleanup()
})
test('queued refresh cannot republish identity during asynchronous logout',async()=>{
  const h=await harness(true);const logout=h.logout();await h.drain();h.resolve('A');await flush();assert.equal(h.published.length,0);assert.equal(h.identityCalls(),0);h.resolveSignOut();await logout;h.cleanup()
})
test('revoked live role clears mounted scope and cache after background verification',async()=>{
  const h=await harness(true);await h.drain();h.resolve('A');await flush();const cleared=h.cacheClears();h.deny();h.focus();await h.drain();await flush();assert.equal(h.state[0],null);assert.equal(h.state[3],false);assert.ok(h.cacheClears()>cleared);h.cleanup()
})
test('signout during delayed background verification never republishes old scope',async()=>{
  const h=await harness(true);await h.drain();h.resolve('A');await flush();const publications=h.published.length;const release=h.holdIdentity();h.focus();await h.drain();h.signOut();release();await flush();assert.equal(h.published.length,publications);assert.equal(h.state[0],null);assert.equal(h.state[3],false);h.cleanup()
})
test('signout and unmount suppress pending authority responses',async()=>{
  for(const stop of ['signOut','cleanup']) {
    const h=await harness(false); await h.drain(); h[stop](); h.resolve('A'); await flush()
    assert.equal(h.published.length,0)
    if(stop!=='cleanup')h.cleanup()
  }
})
