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

async function harness(withCache, aal='aal2') {
  const policy = await import('../../lib/clinic-authority.mjs')
  const profiles = {A:deferred(), B:deferred()}
  let identity = 'A', listener, cleanup, api, stateIndex = 0, cacheClears = 0, identityCalls=0, profileReads=0, signOutCalls=0, liveRole='doctor', identityDelay, transportDown=false, profileFailure=null, membershipFailure=null, assuranceFailure=null, factorFailure=null, membershipsRemoved=false
  const windowListeners=new Map(), signOutPending=deferred()
  const published = [], navigations = [], errors = [], timers = new Map(), contexts = {}, state = []
  const react = {
    createContext: () => ({Provider:'provider'}),
    useContext: () => withCache ? {cancelQueries:async()=>{}, clear:()=>cacheClears++} : undefined,
    useRef: current => ({current}), useCallback: fn => fn,
    useState: initial => { const index=stateIndex++; state[index]=initial; return [initial, value=>{state[index]=value; if(index===0&&value) published.push(value)}] },
    useEffect: fn => { cleanup=fn() },
  }
  const supabase = {
    auth: {getClaims:async()=>({data:{claims:{sub:identity,role:'authenticated',aal}},error:null}),
      mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal,nextLevel:aal},error:assuranceFailure}),listFactors:async()=>({data:{totp:[{id:'factor-a',status:'verified'}]},error:factorFailure})},
      getUser:async()=>{identityCalls++;if(transportDown)return{data:{user:null},error:{name:'AuthRetryableFetchError',status:0}};if(identityDelay)await identityDelay.promise;return{data:{user:{id:identity,email:'synthetic@example.invalid'}},error:null}},signOut:()=>{signOutCalls++;return signOutPending.promise},
      onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe(){}}}}}},
    from(table) {
      profileReads++
      let id
      return {select(){return this},eq(key,value){if(key==='id'||key==='user_id') id=value;return this},
        maybeSingle(){return profileFailure?Promise.resolve({data:null,error:profileFailure,status:profileFailure.status}):profiles[id].promise},
        then(resolve){return Promise.resolve({data:membershipsRemoved?[]:[{clinic_id:clinic,status:'active',role:'doctor',clinics:{name:'Synthetic'}}],error:membershipFailure,status:membershipFailure?.status}).then(resolve)}}
    },
    rpc:async()=>({data:liveRole,error:null}),
  }
  const module = {exports:{}}
  const source=fs.readFileSync(path.join(root,'components/auth-context.tsx'),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
  const accessModule={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/access-revalidation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:accessModule,exports:accessModule.exports})
  const network={onLine:true}
  vm.runInNewContext(js,{navigator:network,module,exports:module.exports,document:{cookie:'',visibilityState:'visible',addEventListener(){},removeEventListener(){}},location:{protocol:'http:'},
    window:{location:{replace:route=>navigations.push(route)},addEventListener:(event,fn)=>windowListeners.set(event,fn),removeEventListener:event=>windowListeners.delete(event)},setTimeout:fn=>{const key={};timers.set(key,fn);return key},clearTimeout:key=>timers.delete(key),
    require(id){if(id==='@/app/actions/request-password-recovery')return{requestPasswordRecovery:async()=>({accepted:true})};if(id==='@/lib/access-revalidation')return accessModule.exports;if(id==='react')return react;if(id==='react/jsx-runtime')return{jsx:(_type,props)=>{api=props.value;return{}}};if(id==='@tanstack/react-query')return{QueryClientContext:contexts};if(id==='@/lib/supabase')return{supabase};if(id==='sonner')return{toast:{error:message=>errors.push(message)}};if(id==='@/lib/clinic-authority.mjs')return policy;throw Error(id)}})
  module.exports.AuthProvider({children:null})
  const drain = async () => {for(const [key,fn] of [...timers]) {timers.delete(key);fn()} await flush()}
  const profile = id => ({data:{id,status:'active',deleted_at:null,clinic_id:clinic,full_name:id},error:null})
  return {published, navigations, errors, state, drain, resolve:id=>profiles[id].resolve(profile(id)), deny:()=>{liveRole=null}, holdIdentity:()=>{identityDelay=deferred();return identityDelay.resolve}, change:()=>{identity='B';listener('SIGNED_IN',{user:{id:'B'}})}, focus:()=>windowListeners.get('focus')(), parallelFailure:(profile,membership)=>{profileFailure=profile;membershipFailure=membership}, mfaFailure:(assurance,factor)=>{assuranceFailure=assurance;factorFailure=factor}, removeMemberships:()=>{membershipsRemoved=true},networkFailure:value=>{transportDown=value}, offline:()=>{network.onLine=false;windowListeners.get('offline')()},online:()=>{network.onLine=true;windowListeners.get('online')()},identityCalls:()=>identityCalls, profileReads:()=>profileReads, signOutCalls:()=>signOutCalls, logout:()=>api.logout(), resolveSignOut:(error=null)=>signOutPending.resolve({error}), signOut:()=>listener('SIGNED_OUT',null), cleanup:()=>cleanup(), cacheClears:()=>cacheClears}
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
test('logout clears authority immediately and replaces the document only after provider success',async()=>{
  const h=await harness(true);await h.drain();h.resolve('A');await flush()
  assert.equal(h.state[0].id,'A');const cleared=h.cacheClears();const pending=h.logout()
  assert.equal(h.state[0],null);assert.ok(h.cacheClears()>cleared);assert.deepEqual(h.navigations,[])
  h.resolveSignOut();await pending;assert.deepEqual(h.navigations,['/login']);h.cleanup()
})
test('failed logout stays fail closed, displays a retry error and never reports navigation success',async()=>{
  const h=await harness(true);await h.drain();h.resolve('A');await flush();const pending=h.logout()
  h.resolveSignOut({message:'synthetic transport failure'});await pending;h.focus();await h.drain()
  assert.equal(h.state[0],null);assert.deepEqual(h.navigations,[]);assert.equal(h.errors.length,1)
  assert.match(h.state[4],/No pudimos cerrar tu sesión/);assert.equal(h.state[5],"failed")
  await h.logout();assert.equal(h.signOutCalls(),2);assert.equal(h.state[0],null);assert.deepEqual(h.navigations,[]);h.cleanup()
})
test('intentional logout stays pending through SIGNED_OUT and ignores repeat clicks until document navigation',async()=>{
  const h=await harness(true);await h.drain();h.resolve('A');await flush();const pending=h.logout()
  assert.equal(h.state[5],"pending");h.signOut();await flush()
  assert.equal(h.state[0],null);assert.equal(h.state[5],"pending");await h.logout();assert.equal(h.signOutCalls(),1)
  h.resolveSignOut();await pending;assert.equal(h.state[5],"pending");assert.deepEqual(h.navigations,['/login']);h.cleanup()
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
test('AAL1 first-factor sessions defer all profile and membership reads',async()=>{
  const h=await harness(false,'aal1')
  await h.drain()
  assert.equal(h.profileReads(),0)
  assert.equal(h.identityCalls(),0)
  assert.equal(h.state[0],null)
  assert.equal(h.state[4],null)
  h.cleanup()
})

test('temporary background failure keeps the verified view read-only, then online recovery revalidates',async()=>{
 const h=await harness(true);await h.drain();h.resolve('A');await flush();const cleared=h.cacheClears();
 h.networkFailure(true);h.focus();await h.drain();await flush();
 assert.equal(h.state[0].id,'A');assert.equal(h.state[1],clinic);assert.equal(h.state[2],false);assert.equal(h.state[3],true);assert.match(h.state[4],/Conexión interrumpida/);assert.equal(h.cacheClears(),cleared);
 h.networkFailure(false);h.online();await h.drain();await flush();assert.equal(h.state[0].id,'A');assert.equal(h.state[3],false);assert.equal(h.state[4],null);h.cleanup();
})
test('offline blocks interaction immediately without clearing loaded scope; explicit signout still clears it',async()=>{
 const h=await harness(true);await h.drain();h.resolve('A');await flush();const calls=h.identityCalls();const cleared=h.cacheClears();
 h.offline();assert.equal(h.state[0].id,'A');assert.equal(h.state[3],true);assert.equal(h.cacheClears(),cleared);h.focus();await h.drain();assert.equal(h.identityCalls(),calls);
 h.signOut();assert.equal(h.state[0],null);assert.equal(h.state[3],false);assert.ok(h.cacheClears()>cleared);h.cleanup();
})

test('parallel definitive profile or membership denial wins over temporary failure of the other result',async()=>{
 for(const reverse of [false,true]){const h=await harness(true);await h.drain();h.resolve('A');await flush();const cleared=h.cacheClears();const temporary={status:503,message:'temporary'},denied={status:403,code:'42501'};h.parallelFailure(reverse?denied:temporary,reverse?temporary:denied);h.focus();await h.drain();await flush();assert.equal(h.state[0],null);assert.equal(h.state[3],false);assert.ok(h.cacheClears()>cleared);h.cleanup();}
});
test('confirmed membership removal is not hidden by a simultaneous profile transport failure',async()=>{
 const h=await harness(true);await h.drain();h.resolve('A');await flush();h.parallelFailure({status:503},null);h.removeMemberships();h.focus();await h.drain();await flush();assert.equal(h.state[0],null);assert.equal(h.state[3],false);h.cleanup();
});
test('parallel MFA denial wins over temporary failure of the other MFA query',async()=>{
 for(const reverse of [false,true]){const h=await harness(true);await h.drain();h.resolve('A');await flush();const temporary={status:503},denied={status:401};h.mfaFailure(reverse?denied:temporary,reverse?temporary:denied);h.focus();await h.drain();await flush();assert.equal(h.state[0],null);assert.equal(h.state[3],false);h.cleanup();}
});
