'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const TEST_ORIGIN='https://app.cliniaplus.com';
// Synthetic, explicit sandbox configuration only. Never inherited from a host.
const gateEnv={NEXT_PUBLIC_APP_URL:TEST_ORIGIN,CLINIA_EMAIL_ENABLED:'1',VERCEL:'1',EMAIL_ABUSE_HASH_SECRET:'synthetic-fixture-hmac-secret-for-tests-only'};
function loadCurrentSource(file,sandbox){
 const cache=new Map(),external=sandbox.require;
 function load(filename){
  assert.ok(filename.startsWith(root+path.sep));if(cache.has(filename))return cache.get(filename);
  const module={exports:{}};cache.set(filename,module.exports);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{...sandbox,module,exports:module.exports,URL,Buffer,TextEncoder,
   require(name){if(name==='server-only')return {};if(name.startsWith('@/lib/')&&name!=='@/lib/env')return load(path.join(root,name.slice(2)+'.ts'));return external(name);}
  },{filename});return module.exports;
 }
 return load(file);
}
const ALLOW_BUDGET=Object.freeze({allowed:true,retry_after_seconds:0});
function durableBudgetFixture(reply=ALLOW_BUDGET){
 const calls=[];return {calls,async rpc(name,args){assert.equal(name,'consume_email_abuse_budget');assert.ok(['invite','transactional'].includes(args.p_action));for(const key of ['p_ip_hash','p_destination_hash'])assert.match(args[key],/^[a-f0-9]{64}$/);calls.push(args);return {data:typeof reply==='function'?reply(args,calls.length):reply,error:null};}};
}
module.exports={loadCurrentSource,TEST_ORIGIN,gateEnv,ALLOW_BUDGET,durableBudgetFixture};
