'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../..');
function harness(outcome='pending',quota={allowed:true},env={}) {
  const state={requests:[],budgets:[],logs:[],privileged:[]};
  const load=file=>{
    const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const imports=name=>{
      if(name==='next/headers')return{headers:async()=>new Headers({origin:'https://app.example.invalid','x-vercel-forwarded-for':'203.0.113.1'})};
      if(name==='@/lib/server-email-gate')return{consumeEmailBudget:async args=>{state.budgets.push(args);return quota}};
      if(name==='@/lib/logger')return{maskEmail:()=> 'masked',logger:Object.fromEntries(['info','warn','error'].map(level=>[level,(...args)=>state.logs.push([level,...args])]))};
      if(name==='@supabase/supabase-js')return{createClient:(url,key,options)=>{
        const client=createClient(url,key,{...options,global:{fetch:async(input,init)=>{
          const request=new Request(input,init);state.requests.push({method:request.method,url:request.url,headers:Object.fromEntries(request.headers),body:await request.json()});
          if(outcome==='transport')throw new Error('sensitive-provider-account-state');
          if(outcome==='provider-error')return new Response(JSON.stringify({code:'email_not_confirmed',msg:'sensitive-provider-account-state'}),{status:400,headers:{'content-type':'application/json','x-supabase-api-version':'2024-01-01'}});
          return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
        }}});
        // A directory walk or token generation is a forbidden application operation.
        client.auth.admin.listUsers=async()=>{state.privileged.push('listUsers');return{data:{users:outcome==='confirmed'?[{email:'synthetic@example.invalid',email_confirmed_at:'confirmed'}]:[]},error:null}};
        client.auth.admin.generateLink=async()=>{state.privileged.push('generateLink');throw Error('Directory/token admin operation forbidden')};
        return client;
      }};
      if(name.startsWith('@/lib/'))return load(name.slice(2)+'.ts');
      return require(name);
    };
    vm.runInNewContext(js,{module:m,exports:m.exports,require:imports,URL,Buffer,console:{log(){},warn(){},error(){}},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon-key',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',NEXT_PUBLIC_APP_URL:'https://app.example.invalid',...env},cwd:()=>root}});
    return m.exports;
  };
  return{state,load,action:email=>load('app/actions/resend-confirmation.ts').resendConfirmationEmail(email)};
}
test('pending, nonexistent, confirmed and users beyond the first directory page have one neutral public result',async()=>{
  for(const outcome of ['pending','nonexistent','confirmed','beyond-first-page']){
    const h=harness(outcome),result=await h.action('  Synthetic@example.invalid ');
    assert.deepEqual(JSON.parse(JSON.stringify(result)),{accepted:true},outcome);
    assert.equal(h.state.requests.length,1,outcome+' must use the provider existing-account path');
    assert.deepEqual(h.state.privileged,[],outcome+' must not inspect a directory or generate/create an identity');
  }
});
test('real pinned SDK emits one anon-key signup resend with the fixed confirmation redirect after the durable budget',async()=>{
  const h=harness();await h.action('Synthetic@example.invalid');
  assert.equal(h.state.budgets.length,1);assert.equal(h.state.budgets[0].action,'resend');assert.equal(h.state.budgets[0].destination,'synthetic@example.invalid');
  const r=h.state.requests[0];assert.ok(r,'one ordinary provider request required');const u=new URL(r.url);
  assert.equal(r.method,'POST');assert.equal(u.pathname,'/auth/v1/resend');assert.equal(u.searchParams.get('redirect_to'),'https://app.example.invalid/auth/confirm');
  assert.equal(r.headers.apikey,'synthetic-anon-key');assert.equal(r.headers.authorization,'Bearer synthetic-anon-key');
  assert.equal(r.body.type,'signup');assert.equal(r.body.email,'synthetic@example.invalid');assert.equal('password'in r.body,false);
});
test('provider errors and transport failures do not disclose account state or claim delivery',async()=>{
  for(const outcome of ['provider-error','transport']){
    const h=harness(outcome);const result=await h.action('synthetic@example.invalid');
    assert.deepEqual(JSON.parse(JSON.stringify(result)),{accepted:true});assert.equal(result.success,undefined);assert.equal(h.state.requests.length,1);
    assert.ok(!JSON.stringify([result,h.state.logs]).includes('sensitive-provider-account-state'));
  }
});
test('invalid input and denied or unavailable budgets stop before any provider or directory operation',async()=>{
  for(const value of [null,{},'', 'invalid','a'.repeat(255)+'@example.invalid']){
    const h=harness();assert.ok((await h.action(value)).error);assert.equal(h.state.budgets.length,0);assert.equal(h.state.requests.length,0);assert.deepEqual(h.state.privileged,[]);
  }
  for(const quota of [{allowed:false,status:429,message:'Synthetic quota limit'},{allowed:false,status:503,message:'Synthetic unavailable'}]){
    const h=harness('pending',quota);assert.equal((await h.action('synthetic@example.invalid')).error,quota.message);assert.equal(h.state.budgets.length,1);assert.equal(h.state.requests.length,0);assert.deepEqual(h.state.privileged,[]);
  }
});
test('the SMTP resend token-hash template and redirect reach signup completion without inviting or recovering',()=>{
  const h=harness(),contract=h.load('lib/auth-email-contract.ts'),spec=contract.AUTH_EMAIL_CONTRACT.resendSignup;
  assert.ok(spec,'resend SMTP contract must be explicit');assert.equal(spec.provider,'supabase-smtp');
  let html=fs.readFileSync(path.join(root,spec.template),'utf8').replace(/\{\{ \.RedirectTo \}\}/g,contract.signupResendRedirect('https://app.example.invalid')).replace(/\{\{ \.TokenHash \}\}/g,'synthetic-hash');
  const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));
  const u=new URL(links.find(x=>x.includes('token_hash=')));assert.equal(u.origin,'https://app.example.invalid');assert.equal(u.pathname,'/auth/confirm');assert.equal(u.searchParams.get('type'),'signup');assert.equal(u.searchParams.get('next'),'/dashboard');assert.equal(u.searchParams.get('token_hash'),'synthetic-hash');
  for(const origin of ['http://localhost:3000','https://app.example.invalid/evil','https://evil.invalid/?next=https://app.example.invalid','https://user:pass@app.example.invalid'])assert.throws(()=>contract.signupResendRedirect(origin));
});
