'use strict';
// Explicit isolated-host transport. Defaults to check; known shared refs always refused.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const core=require('./clinia-hosted-successor.cjs'),{compare}=require('./clinia-migration-package.cjs');
function main(action,configFile){
 assert.ok(['check','execute'].includes(action));const c=JSON.parse(fs.readFileSync(configFile,'utf8'));core.validateTarget(c.target);assert.equal(c.target.kind,'hosted-isolated');
 assert.equal(c.authorizePrivateAggregateReads,true,'Aggregate-only read scope must be explicit');
 core.validateHostedRead(c.target,c.readAuthorization);
 if(action==='execute')core.validateAuthorization(c.target,c.authorization,c.recovery);
 assert.ok(path.isAbsolute(c.psqlExecutable)&&path.isAbsolute(c.pgpassFile));
 if(action==='execute')assert.equal(c.authorization.project,c.target.project);
 const env={...process.env,PGHOST:c.target.host,PGPORT:'5432',PGUSER:'postgres',PGDATABASE:'postgres',PGSSLMODE:'verify-full',PGPASSFILE:c.pgpassFile,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=2000'};
 for(const key of ['PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGHOSTADDR'])delete env[key];
 const run=sql=>{const r=spawnSync(c.psqlExecutable,['-X','--no-password','-qAt','--set','ON_ERROR_STOP=1','--file','-'],{input:sql,encoding:'utf8',env,windowsHide:true,timeout:180000,maxBuffer:16*1024*1024});if(r.status!==0||r.error)throw Error('Isolated target operation refused/failed; SQL and credential output suppressed; no success receipt');return r.stdout.trim();};
 const raw=fs.readFileSync(path.join(core.DIR,'catalog.sql'),'utf8');const capture=JSON.parse(run("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='15s'; "+raw+' ROLLBACK;'));
 assert.equal(compare(JSON.parse(fs.readFileSync(path.join(core.DIR,'baseline-upgrade.json'))),capture).length,0,'Baseline drift');
 const counts=JSON.parse(run("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='15s'; "+fs.readFileSync(path.join(core.DIR,'invariants.sql'),'utf8')+' ROLLBACK;'));assert.ok(Object.values(counts).every(v=>v===0),'Data invariant failures');
 if(action==='execute')run(core.compile(c.target,c.authorization,c.recovery).sql);
 console.log(JSON.stringify({status:action==='check'?'PASS_ISOLATED_BASELINE_AND_AGGREGATES_ONLY':'PASS_ISOLATED_TRANSACTION_COMMIT',project:c.target.project,privateRowsExported:0,ledgerImportedOrRepaired:false,hostedGate3Accepted:false}));
}
module.exports={main};if(require.main===module){try{main(process.argv[2]||'check',process.argv[3]);}catch{console.error('BLOCKED: explicit isolated target, baseline, data, approval or recovery precondition failed. No sensitive output.');process.exitCode=1;}}
