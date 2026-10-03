'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const api=require('./clinia-contract-api.cjs'),{contract}=require('./verify-clinia-operational-convergence.cjs');
const local=require('./clinia-local-runtime.cjs');
const directory=path.join(local.repo,'docs/production/evidence/2026-10-02-captured-upgrade/parity-2');
function main(){
  assert.ok(!fs.existsSync(directory),'Preserve existing comparison evidence');fs.mkdirSync(directory,{recursive:true});
  const report={capturedAt:new Date().toISOString(),status:'NOT VERIFIED',limits:['Actual scoped local operational catalog parity; not remote parity, bytes or provider configuration']};
  try{
    function capture(variant){
      let q=fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-09-27/capture-scoped-metadata.sql'),'utf8');
      if(api.sql(variant,"SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;",'postgres')==='f')q=q.replace("(SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations)","'[]'::jsonb");
      return JSON.parse(api.sql(variant,'SET search_path=public,extensions,pg_catalog;'+q,'postgres'));
    }
    const a=capture('captured-stage'),b=capture('captured-linked-v2'),ca=contract(a),cb=contract(b);
    // The older projection omits service-only public routines. Include this new
    // privilege boundary explicitly instead of silently treating it as parity.
    for(const [snapshot,projection]of [[a,ca],[b,cb]])projection.emailBudgetRPC=snapshot.functions.filter(f=>f.schema==='public'&&f.name==='consume_email_abuse_budget');
    fs.writeFileSync(path.join(directory,'stage.metadata.json'),JSON.stringify(a,null,2));
    fs.writeFileSync(path.join(directory,'linked.metadata.json'),JSON.stringify(b,null,2));
    const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
    report.stageDatabase=api.config('captured-stage').database;report.linkedDatabase=api.config('captured-linked-v2').database;
    report.stageContractSha256=hash(ca);report.linkedContractSha256=hash(cb);
    report.differences=Object.keys(ca).filter(k=>JSON.stringify(ca[k])!==JSON.stringify(cb[k]));
    report.status=report.differences.length?'PARTIALLY VERIFIED':'VERIFIED';
  }catch{report.error='Catalog read failed; local private diagnostics preserved';process.exitCode=1;}
  finally{fs.writeFileSync(path.join(directory,'contract-comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
}
if(require.main===module){assert.equal(process.argv.length,2);main();}
module.exports={main};
