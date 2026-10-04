const { test } = require('node:test')
const assert = require('node:assert/strict')
const scope = { clinicId:'11111111-1111-4111-8111-111111111111', patientId:'22222222-2222-4222-8222-222222222222', fileId:'33333333-3333-4333-8333-333333333333' }
const origin='https://candidate.example', provider='https://isolated.supabase.co'
const path=`${scope.clinicId}/${scope.patientId}/immutable.pdf`
const payload=Buffer.from('synthetic clinical document')
const request = (extra={}, body=scope) => new Request(origin+'/api/clinical-documents', {
  method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json', ...extra }, body:JSON.stringify(body),
})
async function harness(overrides={}) {
  const {documentDeliveryHandler}=await import('../../lib/clinical-document-delivery.mjs')
  const state={ permitted:true, active:true, reads:0, checks:0, after:null }
  const allowed={path,name:'documento.pdf',userId:'doctor-a',sessionId:'live-session-a'}
  const deps={appOrigin:origin,providerOrigin:provider,
    authority:async()=>({authorize:async()=>{state.checks++; return state.permitted ? (state.after || allowed) : null}}),
    download:async actual=>{assert.equal(actual,path);state.reads++;return new Response(payload)},
    deliveryActive:async()=>state.active,
    recordAccess:async()=>true,
    ...overrides,
  }
  return {state,deps,run:documentDeliveryHandler(deps),allowed}
}
test('legitimate delivery publishes exact bytes after two authority checks with no reusable provider URL or cache validator',async()=>{
  const h=await harness(),r=await h.run(request())
  assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),payload)
  assert.equal(h.state.checks,2);assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0, must-revalidate')
  for(const header of ['cdn-cache-control','vercel-cdn-cache-control']) assert.equal(r.headers.get(header),'no-store')
  for(const header of ['location','etag','last-modified']) assert.equal(r.headers.get(header),null)
  assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/^attachment;/)
})
test('warm delivery then replay the exact client request denies each revoked authority state before Storage access',async()=>{
  // Executable application contract, not a claim of hosted JWT/provider proof.
  for(const reason of ['membership removed','demotion','logout','ban','JWT expiry','profile suspended','profile deleted','subscription expired','file deleted','patient deleted','cross tenant']) {
    const h=await harness(),original=request()
    assert.equal((await h.run(original.clone())).status,200,reason)
    h.state.permitted=false
    const denied=await h.run(original.clone())
    assert.equal(denied.status,404,reason);assert.equal(h.state.reads,1,reason)
    assert.notDeepEqual(Buffer.from(await denied.arrayBuffer()),payload,reason)
  }
})
test('revocation or changed user/session/object while upstream bytes are loading cannot publish',async()=>{
  for(const change of ['deny','path','userId','sessionId','principal']) {
    const h=await harness();h.deps.download=async()=>{
      h.state.reads++
      if(change==='deny') h.state.permitted=false
      else if(change==='principal') h.state.active=false
      else h.state.after={...h.allowed,[change]:'changed'}
      return new Response(payload)
    }
    const r=await h.run(request());assert.equal(r.status,change==='principal'?503:404)
    assert.notDeepEqual(Buffer.from(await r.arrayBuffer()),payload)
  }
})
test('invalid Authorization cannot fall back to cookies; cross-origin cookie and bearer requests deny',async()=>{
  const h=await harness()
  for(const extra of [{Authorization:'invalid'},{Authorization:'Bearer '},{Authorization:'Bearer a.b.c',Origin:'https://evil.example'},{Origin:'https://evil.example'},{Origin:''}]) {
    assert.ok([401,403].includes((await h.run(request(extra))).status));assert.equal(h.state.checks,0)
  }
  const noOrigin=new Request(origin+'/api/clinical-documents',{method:'POST',headers:{Authorization:'Bearer a.b.c','Content-Type':'application/json'},body:JSON.stringify(scope)})
  assert.equal((await h.run(noOrigin)).status,200)
})
test('raw paths, unknown fields, malformed IDs, oversized JSON and conditional/range requests are rejected',async()=>{
  const h=await harness()
  for(const body of [null,[],{...scope,path},{...scope,url:provider},{...scope,fileId:'invalid'},{...scope,fileId:'a'.repeat(600)}]) assert.equal((await h.run(request({},body))).status,body?.fileId?.length>512?503:400)
  for(const header of ['Range','If-None-Match','If-Modified-Since','If-Range']) assert.equal((await h.run(request({[header]:'anything'}))).status,400)
  assert.equal((await h.run(new Request(origin))).status,405);assert.equal(h.state.reads,0)
})
test('authority cannot substitute foreign paths or external provider URLs',async()=>{
  for(const bad of [path.replace(scope.clinicId,'44444444-4444-4444-8444-444444444444'),'https://evil.example/'+path,path+'/../escape',path+'?token=x']) {
    const h=await harness({authority:async()=>({authorize:async()=>({path:bad,name:'x',userId:'u',sessionId:'s'})})})
    assert.equal((await h.run(request())).status,404);assert.equal(h.state.reads,0)
  }
})
test('provider errors and oversized/malformed lengths or streams cannot escape as clinical content',async()=>{
  const {DOCUMENT_LIMIT}=await import('../../lib/clinical-document-delivery.mjs')
  for(const download of [async()=>new Response('provider detail',{status:403}),async()=>new Response(payload,{headers:{'Content-Length':'invalid'}}),async()=>new Response(payload,{headers:{'Content-Length':String(DOCUMENT_LIMIT+1)}}),async()=>new Response(new Uint8Array(DOCUMENT_LIMIT+1))]) {
    const h=await harness({download}),r=await h.run(request());assert.equal(r.status,503)
    assert.doesNotMatch(await r.text(),/provider detail|synthetic clinical/)
  }
})
test('bounded stream abort cancels its reader instead of leaving a hung upstream read',async()=>{
  const {boundedBytes}=await import('../../lib/clinical-document-delivery.mjs')
  const controller=new AbortController();let canceled=false
  const stream=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){canceled=true}})
  const pending=boundedBytes(stream,512,controller.signal);controller.abort()
  await assert.rejects(pending);assert.equal(canceled,true)
})
test('four held deliveries bound per-process resource use and the slot is released after denial',async()=>{
  let release;const wait=new Promise(resolve=>{release=resolve})
  const h=await harness({authority:async()=>({authorize:async()=>{await wait;return null}})})
  const pending=Array.from({length:4},()=>h.run(request()))
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal((await h.run(request())).status,429);release()
  assert.deepEqual(await Promise.all(pending.map(async r=>(await r).status)),[404,404,404,404])
  assert.equal((await h.run(request())).status,404)
})
test('slow request bodies consume concurrency slots before buffering',async()=>{
  const h=await harness(),controllers=[],pending=[]
  for(let i=0;i<4;i++) {
    const controller=new AbortController();controllers.push(controller)
    const body=new ReadableStream({pull(){return new Promise(()=>{})}})
    pending.push(h.run(new Request(origin+'/api/clinical-documents',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body,duplex:'half',signal:controller.signal})))
  }
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal((await h.run(request())).status,429);assert.equal(h.state.checks,0)
  controllers.forEach(controller=>controller.abort())
  assert.deepEqual(await Promise.all(pending.map(async r=>(await r).status)),[504,504,504,504])
  assert.equal((await h.run(request())).status,200)
})
test('a supported trailing slash in APP_URL compares the canonical browser origin',async()=>{
  const h=await harness({appOrigin:origin+'/'})
  assert.equal((await h.run(request())).status,200)
})
test('client POST discards late bytes when scope changes and sends no object URL or local storage capability',async()=>{
  const {fetchClinicalDocument}=await import('../../lib/clinical-document-client.mjs')
  let current=true
  const fetcher=async(url,init)=>{assert.equal(url,'/api/clinical-documents');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');assert.deepEqual(JSON.parse(init.body),scope);current=false;return new Response(payload,{headers:{'Content-Length':String(payload.length)}})}
  assert.equal(await fetchClinicalDocument(scope,new AbortController().signal,()=>current,fetcher),null)
  current=true
  const blob=await fetchClinicalDocument(scope,new AbortController().signal,()=>current,async()=>new Response(payload,{headers:{'Content-Length':String(payload.length)}}))
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()),payload)
})
test('client bounds the actual stream even if Content-Length lies and discards a late completed body',async()=>{
  const {fetchClinicalDocument}=await import('../../lib/clinical-document-client.mjs')
  await assert.rejects(fetchClinicalDocument(scope,new AbortController().signal,()=>true,async()=>new Response(new Uint8Array(10*1024*1024+1),{headers:{'Content-Length':'1'}})),/bound/)
  let current=true
  const stream=new ReadableStream({start(controller){controller.enqueue(payload);current=false;controller.close()}})
  assert.equal(await fetchClinicalDocument(scope,new AbortController().signal,()=>current,async()=>new Response(stream,{headers:{'Content-Length':String(payload.length)}})),null)
})
test('audit outage denies publication rather than silently delivering unrecorded clinical bytes',async()=>{
  const h=await harness({recordAccess:async()=>false}),r=await h.run(request())
  assert.equal(r.status,503);assert.notDeepEqual(Buffer.from(await r.arrayBuffer()),payload)
})
