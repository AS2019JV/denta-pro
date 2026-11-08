'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function harness(options={}){
 const events={budget:0,links:[],mail:[],warnings:[]};
 function load(file){const module={exports:{}};const source=fs.readFileSync(path.join(root,file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const imports=name=>{
  if(name==='next/headers')return{headers:async()=>({get:()=>null})};
  if(name==='@/lib/server-email-gate')return{consumeEmailBudget:async()=>{events.budget++;return options.blocked?{allowed:false,message:'Límite temporal'}:{allowed:true}}};
  if(name==='@supabase/supabase-js')return{createClient:()=>({auth:{admin:{generateLink:async args=>{events.links.push(args);if(options.missing)return{data:null,error:{message:'sensitive-directory'}};return{error:null,data:{properties:{hashed_token:options.badToken?'injection<>':'synthetic+token/=',verification_type:options.wrongType?'invite':'recovery'},user:{email:options.wrongEmail?'other@example.invalid':'owner@example.invalid'}}}},createUser:()=>{throw Error('Account creation forbidden')}}}})};
  if(name==='resend')return{Resend:class{emails={send:async value=>{events.mail.push(value);if(options.throws)throw Error('sensitive provider token');return{error:options.providerError?{message:'sensitive provider token'}:null}}}}};
  if(name==='node:fs')return{readFileSync:p=>fs.readFileSync(p,'utf8')};
  if(name.startsWith('@/lib/'))return load(name.slice(2)+'.ts');
  return require(name);
 };
 vm.runInNewContext(js,{module,exports:module.exports,require:imports,URL,process:{cwd:()=>root,env:{NEXT_PUBLIC_APP_URL:options.badOrigin?'http://localhost':'https://app.example.invalid',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',RESEND_API_KEY:'synthetic-only',RESEND_FROM_EMAIL:'sender@example.invalid'}},console:{warn:value=>events.warnings.push(value)}});return module.exports;}
 return{events,request:email=>load('app/actions/request-password-recovery.ts').requestPasswordRecovery(email)};
}
test('recovery validates email and configured origin before budget or privileged Auth calls',async()=>{
 for(const options of [{badOrigin:true},{}]){const h=harness(options);const result=await h.request(options.badOrigin?'owner@example.invalid':'invalid');assert.equal(typeof result.error,'string');assert.equal(h.events.budget,0);assert.equal(h.events.links.length,0);}
});
test('recovery quota denies before token generation or provider send',async()=>{
 const h=harness({blocked:true});assert.equal((await h.request('owner@example.invalid')).error,'Límite temporal');assert.equal(h.events.links.length,0);assert.equal(h.events.mail.length,0);
});
test('recovery sends canonical escaped Auth token through existing provider, never creates an account',async()=>{
 const h=harness();assert.equal((await h.request('OWNER@example.invalid')).accepted,true);assert.equal(h.events.links[0].type,'recovery');assert.equal(h.events.links[0].options.redirectTo,'https://app.example.invalid/update-password');assert.equal(h.events.mail.length,1);
 const html=h.events.mail[0].html;assert.ok(!html.includes('{{'));assert.ok(html.includes('token_hash=synthetic%2Btoken%2F%3D&type=recovery&next=/update-password'));assert.ok(!html.includes('localhost'));
});
test('missing accounts, invalid token binding and provider failures have identical non-delivery acknowledgements',async()=>{
 for(const options of [{missing:true},{wrongEmail:true},{wrongType:true},{badToken:true},{providerError:true},{throws:true}]){const h=harness(options);assert.equal(JSON.stringify(await h.request('owner@example.invalid')),'{"accepted":true}');assert.ok(h.events.warnings.every(line=>!line.includes('sensitive')));if(options.missing||options.wrongEmail||options.wrongType||options.badToken)assert.equal(h.events.mail.length,0);}
});
