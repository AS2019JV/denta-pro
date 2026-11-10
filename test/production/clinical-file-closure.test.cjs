'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const loadPolicy=require('./helpers/pilot-policy.cjs');
function policy(env={}){
 const mod={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('lib/pilot-policy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,process:{env}});
 return mod.exports;
}
function load(file,p){
 const mod={exports:{}},unexpected=()=>{throw Error('Unexpected provider, credential, PDF or cookie effect')};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module:mod,exports:mod.exports,Response,URL,process:{env:{}},
 require(name){
  if(name==='@/lib/pilot-policy')return p;
  if(name==='@/lib/operational-observability')return{observeResponse:(_name,run)=>run()};
  if(name==='@/lib/clinical-document-principal.mjs')return{deliveryTokenCache:()=>unexpected};
  if(name==='next/server')return{NextResponse:{json:Response.json,next:()=>({kind:'next'})}};
  return new Proxy({},{get:()=>unexpected});
 }});
 return mod.exports;
}
test('clinical file delivery defaults closed outside synthetic pilot too',()=>{
 const p=policy();assert.equal(p.SYNTHETIC_PILOT,false);assert.equal(p.CLINICAL_FILES_QA,false);assert.equal(p.clinicalFilesServerQA(),false);
});
test('verification opt-in cannot release Production or another backend',()=>{
 const allowed={NEXT_PUBLIC_CLINIA_FILES_QA:'1',CLINIA_FILES_QA:'1',VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://fbtlldubzomocuhpvweg.supabase.co'};
 assert.equal(policy(allowed).clinicalFilesServerQA(),true);
 for(const env of [{...allowed,VERCEL_ENV:'production'},{...allowed,VERCEL_ENV:'development'},
  {...allowed,CLINIA_FILES_QA:undefined},{...allowed,NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},
  {...allowed,NEXT_PUBLIC_CLINIA_FILES_QA:undefined}])
  assert.equal(policy(env).clinicalFilesServerQA(),false);
});
test('closed document handlers return noncacheable denial before credentials or origin fetch',async()=>{
 const p=loadPolicy(undefined,false);
 for(const file of ['clinical-documents','private-media']){
  const route=load('app/api/'+file+'/route.ts',p);
  const r=await route.POST(new Request('https://closed.invalid/api/'+file,{method:'POST'}));
  assert.equal(r.status,403);assert.equal((await r.json()).error,p.CLINICAL_FILES_UNAVAILABLE);
  assert.match(r.headers.get('cache-control'),/private, no-store/);
  assert.equal(r.headers.get('cdn-cache-control'),'no-store');
  assert.equal(r.headers.has('content-disposition'),false);
 }
});
test('closed PDF and prescription paths cannot invoke engine, clinical reads or issuance',async()=>{
 const p=loadPolicy(undefined,false),pdf=load('lib/pdf-client.ts',p);
 for(const name of ['generatePrescription','exportPersistedPrescription','generateHCU033','exportPersistedHCU033'])
  await assert.rejects(pdf[name](),new RegExp(p.CLINICAL_FILES_UNAVAILABLE));
 const result=await load('app/actions/save-prescription.ts',p).savePrescription(null);
 assert.equal(result.success,false);assert.equal(result.error,p.CLINICAL_FILES_UNAVAILABLE);
});
test('closed document paths deny every HTTP operation before provider effects',async()=>{
 const p=loadPolicy(undefined,false),{middleware}=load('middleware.ts',p);
 for(const path of ['/api/clinical-documents','/api/private-media','/api/clinical-documents/fixture.json','/api/private-media/fixture.png'])
  for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']){
   const r=await middleware({url:'https://closed.invalid'+path,nextUrl:{pathname:path},headers:{},method});
   assert.equal(r.status,403);assert.match(r.headers.get('cache-control'),/no-store/);
   assert.equal((await r.json()).error,p.CLINICAL_FILES_UNAVAILABLE);
  }
});

test('file QA exception leaves every other synthetic exclusion closed',async()=>{
 const p=policy({NEXT_PUBLIC_CLINIA_PILOT_MODE:'synthetic',NEXT_PUBLIC_CLINIA_FILES_QA:'1',
  CLINIA_FILES_QA:'1',VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://fbtlldubzomocuhpvweg.supabase.co'});
 assert.equal(p.clinicalFilesServerQA(),true);
 const {middleware}=load('middleware.ts',p);
 for(const path of ['/billing','/recipes','/api/payments','/api/send-email']){
  const r=await middleware({url:'https://closed.invalid'+path,nextUrl:{pathname:path},headers:{}});
  assert.equal(r.status,403);assert.equal((await r.json()).error,p.PILOT_UNAVAILABLE);
 }
});

test('partial and complete API QA configuration never releases direct uploads or clinical PDFs',async()=>{
 const allowed={NEXT_PUBLIC_CLINIA_FILES_QA:'1',CLINIA_FILES_QA:'1',VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://fbtlldubzomocuhpvweg.supabase.co'};
 for(const env of [allowed,{...allowed,CLINIA_FILES_QA:undefined},{...allowed,VERCEL_ENV:'production'}]){
  const p=policy(env);assert.equal(p.CLINICAL_DOCUMENTS_RELEASED,false);
  const pdf=load('lib/pdf-client.ts',p);
  for(const method of ['generatePrescription','exportPersistedPrescription','generateHCU033','exportPersistedHCU033'])
   await assert.rejects(pdf[method](),new RegExp(p.CLINICAL_FILES_UNAVAILABLE));
  assert.equal((await load('app/actions/save-prescription.ts',p).savePrescription(null)).success,false);
 }
});
test('operational report PDF also denies before cached data or PDF import with the real closed policy',async()=>{
 const p=policy(),file='app/(dashboard)/reports/page.tsx';
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fn;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='exportPdf')fn=n.initializer.getText(source);ts.forEachChild(n,visit)}
 visit(source);assert.ok(fn);
 const mod={exports:{}},messages=[];
 const code=ts.transpileModule('module.exports='+fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:mod,exports:mod.exports,...p,toast:{error:m=>messages.push(m)},query:new Proxy({},{get(){throw Error('Unexpected cached clinical read')}})});
 await mod.exports();assert.deepEqual(messages,[p.CLINICAL_FILES_UNAVAILABLE]);
});
