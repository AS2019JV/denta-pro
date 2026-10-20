'use strict';
// Offline emitter. Never reads credentials, connects, signs approval or runs SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./clinia-gate3-bootstrap.cjs'),old=require('./clinia-hosted-successor.cjs');
function build(){
 c.verify();const t={kind:'hosted',project:c.hosted.project,systemIdentifier:c.hosted.systemIdentifier,version:c.hosted.version,role:'postgres',database:'postgres',host:'db.'+c.hosted.project+'.supabase.co',sslmode:'verify-full',syntheticOnly:true};
 const ro=c.header(t).replace('BEGIN;','BEGIN READ ONLY;').replace('SELECT pg_advisory_xact_lock(731926,1711); ','');
 const files={
  '10-baseline.sql':c.baseline(t).sql,
  '20-seed.sql':c.seed(t).sql,
  '25-fixture-precheck.sql':ro+fs.readFileSync(path.join(c.DIR,'fixture-precheck.sql'),'utf8').replace(/^BEGIN READ ONLY; /,''),
  '30-capture.sql':ro+"SET LOCAL statement_timeout='15s'; "+c.captureSql()+'; ROLLBACK;',
  '40-upgrade.sql':c.upgradeTemplate(t).sql,
  '50-open.sql':c.open(t).sql,
  '60-postchecks.sql':ro+"SET LOCAL statement_timeout='30s'; "+old.catalogGuard(JSON.parse(fs.readFileSync(path.join(c.DIR,'expected-open-contract.json'))),'GATE3_FINAL_OPEN_CONTRACT_REFUSED')+'\n'+fs.readFileSync(path.join(old.DIR,'invariants.sql'),'utf8')+'\nROLLBACK;',
  '90-quarantine.sql':c.quarantine(t).sql
 };
 return {target:t,files,plan:{status:'PENDING_RELEASE_OWNER_AUTHORIZATION',parent:c.verify().parent,scenario:'A_KNOWN_SYNTHETIC_ONLY',hostedWritesPerformed:false,files:Object.entries(files).map(([file,sql])=>({file,bytes:Buffer.byteLength(sql),sha256:c.sha(sql)})),parameter:{file:'40-upgrade.sql',name:'gate3_data_proof',type:'JSONB exact count/SHA256 map',source:'30-capture.sql after verified same-source backup, full restore and writer quiescence',arbitrarySqlAllowed:false},prohibited:['Production/shared staging','ledger import/repair','provider role/ownership grants','remote restore','billable resources','historical provenance acceptance'],abortOn:['identity or baseline drift','unknown row or fixture','backup/key/config/Storage byte omission','failed full restore including original MFA','RPO nonzero','writers not quiesced','permission error: do not elevate','timeout/postcondition/ordinary API failure','uncertain COMMIT: reconcile, never blind retry']}};
}
function emit(destination){const plan=build(),dir=path.resolve(destination);assert.ok(!fs.existsSync(dir),'Never overwrite an emitted plan');fs.mkdirSync(dir,{recursive:true});for(const [name,sql]of Object.entries(plan.files))fs.writeFileSync(path.join(dir,name),sql,{flag:'wx'});fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plan.plan,null,2)+'\n',{flag:'wx'});return plan.plan;}
module.exports={build,emit};
if(require.main===module){assert.equal(process.argv[2],'emit');assert.ok(process.argv[3]);console.log(JSON.stringify(emit(process.argv[3]),null,2));}
