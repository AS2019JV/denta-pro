'use strict';
// Pure compiler/contract verifier. No credentials, shell, database, or network access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {statements,stripReviewedWrapper}=require('./prepare-clinia-hosted-staging.cjs');
const {build}=require('./clinia-captured-stage-m7-bridge.cjs');
const {fingerprint}=require('./compare-supabase-catalogs.cjs');
const ROOT=path.resolve(__dirname,'..'),DIR='docs/production/migration-package/v1';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const load=p=>Buffer.from(fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n'));
const json=p=>JSON.parse(load(p));
const fields={tables:['schema','name'],columns:['table','name'],functions:['identity'],constraints:['table','name'],indexes:['schema','name'],triggers:['table','name'],policies:['schemaname','tablename','policyname'],schemas:['name'],defaults:['owner','schema','type'],types:['schema','name'],sequences:['schema','name']};
function compare(a,b){
  const envelope=['database','currentUser','sessionUser','serverVersion'];
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),'Missing capture section');
  assert.ok(Object.keys(a).every(k=>envelope.includes(k)||k==='btreeGist'||Object.hasOwn(fields,k)),'Unknown catalog section');
  const differences=[];
  for(const name of envelope)if(fingerprint(a[name])!==fingerprint(b[name]))differences.push({section:'envelope',identity:name,before:a[name],after:b[name]});
  for(const [section,keys] of Object.entries(fields)){
    const map=x=>{assert.ok(Array.isArray(x[section]));const m=new Map();for(const row of x[section]){const id=keys.map(k=>row[k]??'').join('|');assert.ok(!m.has(id),'Duplicate identity '+section+id);m.set(id,row);}return m;};
    const aa=map(a),bb=map(b);
    for(const id of [...new Set([...aa.keys(),...bb.keys()])].sort()){
      const before=aa.get(id)??null,after=bb.get(id)??null;
      if(fingerprint(before)!==fingerprint(after))differences.push({section,identity:id,before,after});
    }
  }
  if(fingerprint(a.btreeGist)!==fingerprint(b.btreeGist))differences.push({section:'btreeGist',before:a.btreeGist,after:b.btreeGist});
  return differences;
}
function verify(){
  const m=json(DIR+'/manifest.json');
  assert.equal(m.format,1);assert.equal(m.scope,'NEW_DISPOSABLE_ONLY');
  assert.equal(m.baseCandidate,'627ff7a4c6ccabcd7fb718846c4f4f926046b5eb');
  for(const x of m.files){assert.ok(!x.file.includes('..')&&!path.isAbsolute(x.file));assert.equal(sha(load(x.file)),x.sha256,'Source hash changed: '+x.file);}
  assert.equal(new Set(m.forward).size,m.forward.length);
  assert.ok(m.forward.every(f=>!path.basename(f).startsWith('rollback_')),'Rollback in forward path');
  return m;
}
const body=file=>stripReviewedWrapper(load(file).toString(),{file,begin:'BEGIN;',end:'COMMIT;'});
function compile(variant,project,ending='commit'){
  assert.ok(['clean','upgrade'].includes(variant));assert.equal(project,'clinia-clean-20261002-'+(variant==='clean'?'4':'5'),'Exact new disposable variant required');
  assert.ok(['commit','rollback','fail'].includes(ending));const m=verify();
  const m7=load(m.m7).toString();
  const first=variant==='clean'?stripReviewedWrapper(build('postgres',m7,{cleanManagedProject:project}),{file:'reviewed-stage-M7-bridge',begin:'BEGIN;',end:'COMMIT;'}):body(m.m7);
  const identity=`DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'supabase_admin' OR session_user<>'supabase_admin' OR current_setting('app.clean_managed_project',true) IS DISTINCT FROM '${project}' OR current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' THEN RAISE EXCEPTION 'Disposable package identity refused'; END IF; END $identity$;`;
  let sql=`BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';\n${identity}\n${first}\n${body(m.owners)}\n${load(DIR+'/buckets.sql')}\nSET LOCAL SESSION AUTHORIZATION postgres;\n${m.forward.map(body).join('\n')}\n`;
  const parts=statements(sql);assert.equal(parts.filter(x=>x.clean==='BEGIN;').length,1);
  assert.ok(!parts.some(x=>/^(COMMIT|ROLLBACK|ABORT|START\s+TRANSACTION)\b/i.test(x.clean)),'Unexpected transaction boundary');
  if(ending==='fail')sql+="DO $expected$ BEGIN RAISE EXCEPTION 'GATE3_CANONICAL_EXPECTED_AFTER_ALL_DDL'; END $expected$;\n";
  sql+=ending==='rollback'?'ROLLBACK;':'COMMIT;';
  return {sql,sha256:sha(sql),manifestSha256:sha(load(DIR+'/manifest.json')),sources:m.forward,baseline:m.baselines[variant]};
}
function expected(variant){assert.ok(['clean','upgrade'].includes(variant));verify();return json(DIR+'/expected-'+variant+'.json');}
if(require.main===module){const [action,variant,project,ending]=process.argv.slice(2);if(action==='verify')console.log(JSON.stringify({status:'PASS_PINNED_PACKAGE',files:verify().files.length}));else if(action==='compile')process.stdout.write(compile(variant,project,ending).sql);else throw Error('Use verify or compile clean|upgrade exact-new-project [commit|rollback|fail]');}
module.exports={verify,compile,compare,expected,sha,DIR};
