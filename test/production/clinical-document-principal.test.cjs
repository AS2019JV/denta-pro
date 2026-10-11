const {test}=require('node:test'),assert=require('node:assert/strict')
const token=(sub,exp,role='clinia_document_delivery')=>'a.'+Buffer.from(JSON.stringify({sub,exp,role})).toString('base64url')+'.c'
test('server transport cache coalesces logins, expires before JWT and bounds reuse to five minutes',async()=>{
  const {deliveryTokenCache}=await import('../../lib/clinical-document-principal.mjs');let now=100000,calls=0,release
  const get=deliveryTokenCache(()=>now),wait=new Promise(resolve=>{release=resolve}),signal=new AbortController().signal
  const login=async()=>{calls++;await wait;return token('broker',10000)}
  const a=get('broker',login,signal),b=get('broker',login,signal);release()
  assert.equal(await a,await b);assert.equal(calls,1)
  now+=299999;await get('broker',login,signal);assert.equal(calls,1)
  now+=1;await get('broker',login,signal);assert.equal(calls,2)
  const short=deliveryTokenCache(()=>100000)
  await assert.rejects(short('broker',async()=>token('broker',160),signal))
})
test('bad roles/subjects/expiry deny and failed login has bounded backoff',async()=>{
  const {deliveryTokenCache}=await import('../../lib/clinical-document-principal.mjs');let now=100000,calls=0
  const get=deliveryTokenCache(()=>now),signal=new AbortController().signal
  const login=async()=>{calls++;return token('broker',10000,'authenticated')}
  await assert.rejects(get('broker',login,signal));await assert.rejects(get('broker',login,signal));assert.equal(calls,1)
  now+=5000;assert.equal(await get('broker',async()=>token('broker',10000),signal),token('broker',10000))
  for(const bad of [token('foreign',10000),token('broker',undefined),token('broker',1)]) await assert.rejects(deliveryTokenCache(()=>now)('broker',async()=>bad,signal))
})
test('canceling the first waiter does not reject another waiter or discard completed transport login',async()=>{
  const {deliveryTokenCache}=await import('../../lib/clinical-document-principal.mjs');const get=deliveryTokenCache(()=>100000)
  let release;const wait=new Promise(resolve=>{release=resolve}),a=new AbortController(),b=new AbortController()
  const login=async()=>{await wait;return token('broker',10000)}
  const first=get('broker',login,a.signal),second=get('broker',login,b.signal)
  a.abort();await assert.rejects(first);release()
  assert.equal(await second,token('broker',10000))
  assert.equal(await get('broker',()=>{throw Error('Must reuse transport')},b.signal),token('broker',10000))
})
