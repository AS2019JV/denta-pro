'use strict';
// New secondary databases only. No API switching, remote connections or resets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
const {tables}=require('./generate-clinia-operational-convergence.cjs');
const {parseAcl}=require('./generate-scoped-supabase-baseline.cjs');
const attempt=process.argv[2]||'1', flags=process.argv.slice(3), resume=flags.includes('--resume-reviewed'), includeReports=flags.includes('--include-reports');
if(!/^[1-9]$/.test(attempt)||new Set(flags).size!==flags.length||flags.some(flag=>!['--resume-reviewed','--include-reports'].includes(flag))) throw new Error('Unsupported reviewed attempt');
const directory=path.join(local.repo,'docs/production/evidence/2026-09-28-convergence/attempt-'+attempt);
const databases={stage:'clinia_contract_stage_20260928_'+attempt,prod:'clinia_contract_prod_20260928_'+attempt};
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const source=relative=>fs.readFileSync(path.join(local.repo,relative),'utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
let report={startedAt:new Date().toISOString(),state:'PARTIAL',databases,includeReports,steps:[],checks:[],limits:['Captured scoped contracts, not complete remote schema/configuration parity','Secondary databases have no independent Auth/API/Storage endpoints','SQL/catalog acceptance is not real JWT acceptance','No production mutation or clinical/LOPDP approval']};
let outputCreated=false;
const markers="SET app.scoped_fixture_authorized='local-synthetic'; SET app.encargo02_authorized='reviewed-local-forward'; SET app.operational_convergence_authorized='reviewed-local-contract';\n";
function sql(database,text,role='postgres'){
  if(!['template1','postgres',...Object.values(databases)].includes(database)||!['postgres','supabase_admin'].includes(role)) throw new Error('Target refused');
  const r=spawnSync(docker,['exec','-i','--user','postgres','supabase_db_clinia-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',database,'-f','/dev/stdin'],{cwd:local.repo,input:text,encoding:'utf8',timeout:90000,windowsHide:true,maxBuffer:20*1024*1024});
  if(r.error||r.status!==0){ const name='failure-'+Date.now()+'.log';fs.writeFileSync(path.join(directory,name),(r.stdout||'')+(r.stderr||''));report.failureFile=name;throw new Error('Local SQL failed; '+name+' preserved'); }
  return r.stdout.trim();
}
function persist(){fs.writeFileSync(path.join(directory,'execution.json'),JSON.stringify(report,null,2));}
function check(name,fn){fn();report.checks.push({name,passed:true});persist();}
function step(label,database,text,role='postgres',kind='mutation'){
  const digest=hash(text), previous=report.steps.find(s=>s.label===label);
  const state=kind==='mutation'?'COMMITTED':'VERIFIED_READ_ONLY';
  if(previous){assert.equal(previous.sha256,digest,'Reviewed SQL differs from saved step');assert.equal(previous.database,database);assert.equal(previous.role,role);assert.equal(previous.state,state);return;}
  const out=sql(database,text,role);fs.writeFileSync(path.join(directory,label+'.log'),out+'\n');
  report.steps.push({label,database,role,kind,sha256:digest,state});persist();
}
function data(database){return JSON.parse(sql(database,"SELECT jsonb_build_object('patients',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.patients p),'services',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.services s));"));}
function capture(database,label){
  let query=source('docs/production/evidence/2026-09-27/capture-scoped-metadata.sql');
  if(sql(database,"SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;")==='f') query=query.replace("(SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations)","'[]'::jsonb");
  const snapshot=JSON.parse(sql(database,'SET search_path=public,extensions,pg_catalog;\n'+query));
  snapshot.evidenceKind='actual local scoped catalog; not remote dump/backup';
  fs.writeFileSync(path.join(directory,label+'.metadata.json'),JSON.stringify(snapshot,null,2));return snapshot;
}
function contract(snapshot){
  const selected=(schema,table)=>schema==='public'&&tables.includes(table)||['logs','security_internal'].includes(schema);
  const triggerFunctions=new Set(snapshot.triggers.filter(t=>selected(t.schema,t.table)||t.schema==='auth').map(t=>t.definition.match(/EXECUTE FUNCTION ([^(]+)\(/)?.[1]));
  const callable=f=>parseAcl(f.acl,'FUNCTION',f.owner).some(a=>['PUBLIC','anon','authenticated'].includes(a.grantee)&&a.rights.includes('X'));
  const projection={};
  projection.schemas=snapshot.schemas;
  projection.defaultPrivileges=snapshot.defaultPrivileges.filter(p=>p.owner==='postgres');
  for(const key of ['relations','columns','constraints','indexes','sequences','triggers','policies','types']){
    projection[key]=snapshot[key].filter(x=>key==='policies'?(selected(x.schemaname,x.tablename)||x.schemaname==='storage'):key==='triggers'?(selected(x.schema,x.table)||x.schema==='auth'):key==='types'?x.schema==='public':key==='relations'?selected(x.schema,x.name):key==='sequences'?selected(x.schema,x.ownedBy?.table):selected(x.schema,x.table));
    if(key==='columns') projection[key]=projection[key].filter(c=>!(c.table==='services'&&c.name==='price'));
    if(key==='relations') projection[key]=projection[key].filter(r=>r.kind!=='v'&&r.kind!=='m');
  }
  projection.functions=snapshot.functions.filter(f=>f.schema==='security_internal'||callable(f)||triggerFunctions.has((f.schema==='public'?'':f.schema+'.')+f.name)||triggerFunctions.has(f.schema+'.'+f.name));
  projection.buckets=snapshot.buckets.filter(b=>['patient-files','patient-avatars','clinic-branding','doctor-avatars'].includes(b.id));
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
  return Object.fromEntries(Object.keys(projection).sort().map(k=>[k,projection[k].map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]));
}
function recordClosedDifferences(stage,prod){
  const excluded=s=>s.functions.filter(f=>!contract(s).functions.some(c=>c.schema===f.schema&&c.name===f.name&&c.identityArgs===f.identityArgs)).map(f=>({identity:`${f.schema}.${f.name}(${f.identityArgs})`,definitionSha256:hash(f.definition),acl:f.acl,authenticatedExecute:parseAcl(f.acl,'FUNCTION',f.owner).some(a=>['PUBLIC','authenticated'].includes(a.grantee)&&a.rights.includes('X'))}));
  const views=s=>s.relations.filter(r=>['v','m'].includes(r.kind)).map(r=>({identity:r.schema+'.'+r.name,sha256:hash(JSON.stringify(r))}));
  const buckets=s=>s.buckets.filter(b=>!['patient-files','patient-avatars','clinic-branding','doctor-avatars'].includes(b.id)).map(b=>({identity:b.id,sha256:hash(JSON.stringify(b)),public:b.public,decision:'Outside operational allowlist; Storage helper denies this bucket'}));
  return {stage:{closedFunctions:excluded(stage),closedViews:views(stage),closedBuckets:buckets(stage),closedFinanceColumns:stage.columns.filter(c=>c.table==='services'&&c.name==='price'||c.table==='payments'&&c.name==='amount')},prod:{closedFunctions:excluded(prod),closedViews:views(prod),closedBuckets:buckets(prod),closedFinanceColumns:prod.columns.filter(c=>c.table==='services'&&c.name==='price'||c.table==='payments'&&c.name==='amount')}};
}
async function main(){
  if(fs.existsSync(directory)){
    if(!resume)throw new Error('Evidence already exists; reviewed resume required');
    report=JSON.parse(fs.readFileSync(path.join(directory,'execution.json'),'utf8'));assert.equal(report.state,'PARTIAL');assert.equal(Boolean(report.includeReports),includeReports,'Reviewed report mode differs');report.previousFailures=[...(report.previousFailures||[]),{failure:report.failure,file:report.failureFile||'failure.log',at:report.completedAt}];delete report.failure;report.resumedAt=new Date().toISOString();
  }else{if(resume)throw new Error('No saved reviewed attempt');fs.mkdirSync(directory,{recursive:true});}
  outputCreated=true;report.runtime=local.inspectLocal();persist();
  const manifest=JSON.parse(source('docs/production/reconciliation/operational-convergence/proposal-manifest.json'));
  assert.equal(hash(source('docs/production/reconciliation/operational-convergence/before-authority.sql')),manifest.sqlSha256);
  for(const [variant,database]of Object.entries(databases)){
    const cloneLabel=variant+'-clone';
    const cloneSql=`CREATE DATABASE ${database} TEMPLATE ${variant==='stage'?'clinia_stage_clean':'clinia_prod_upgrade'} OWNER postgres; REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC;`;
    if(!report.steps.some(s=>s.label===cloneLabel)){
      assert.equal(sql('template1',`SELECT count(*) FROM pg_database WHERE datname='${database}';`),'0','New database target required');
    }
    step(cloneLabel,'template1',cloneSql,'supabase_admin');
    const seedClinic='55555555-5555-4555-8555-555555555555', seedPatient='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const price=variant==='stage'?'91.234567':'91.23';
    step(variant+'-sentinels',database,markers+`BEGIN; INSERT INTO public.clinics(id,name) VALUES('${seedClinic}','Ensayo contractual sintético'); INSERT INTO public.patients(id,clinic_id,first_name,last_name,account_balance) VALUES('${seedPatient}','${seedClinic}','Sintético','Conservar',92.15); INSERT INTO public.services(id,clinic_id,name,price) VALUES('ffffffff-ffff-4fff-8fff-ffffffffffff','${seedClinic}','Histórico cerrado',${price}); COMMIT;`);
    if(!report[variant+'Before']){report[variant+'Before']=data(database);persist();}
    step(variant+'-owners',database,markers+source('docs/production/reconciliation/encargo01_local_m7_owners.sql'),'supabase_admin');
    step(variant+'-constraints',database,markers+source('docs/production/reconciliation/operational-convergence/before-authority.sql'));
    if(!report.bucketFixture){report.bucketFixture=JSON.parse(sql('postgres',"SELECT json_agg(json_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) ORDER BY id) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars');"));persist();}
    const configs=report.bucketFixture;
    assert.equal(configs.length,4);assert.ok(configs.every(c=>c.public===false));
    const text=JSON.stringify(configs).replace(/'/g,"''");
    const bucketStep=variant+'-bucket-metadata-fixtures';
    step(bucketStep,database,`INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) SELECT id,name,public,file_size_limit,allowed_mime_types FROM json_populate_recordset(NULL::storage.buckets,'${text}'::json) ON CONFLICT(id) DO UPDATE SET public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;`,'supabase_admin');
    step(variant+'-authority',database,markers+source('docs/production/reconciliation/encargo02/forward.sql'));
    step(variant+'-callbacks',database,markers+source('docs/production/reconciliation/operational-convergence/after-authority.sql'));
    step(variant+'-agenda',database,markers+source('tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql'));
    if(includeReports)step(variant+'-reports',database,markers+source('tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql'));
    step(variant+'-catalog-assertions',database,markers+source(includeReports?'docs/production/reconciliation/final-contract/verify.sql':'docs/production/reconciliation/encargo02/verify.sql'),'postgres','read-only');
    step(variant+'-boundary-assertions',database,markers+source('docs/production/reconciliation/operational-convergence/verify-boundaries.sql'),'postgres','read-only');
    check(variant+' preserves complete patients and historical finance rows',()=>assert.deepEqual(data(database),report[variant+'Before']));
  }
  const stage=capture(databases.stage,'stage-final'),prod=capture(databases.prod,'prod-final');
  const a=contract(stage),b=contract(prod),differences=[];
  for(const key of Object.keys(a))if(JSON.stringify(a[key])!==JSON.stringify(b[key]))differences.push({category:key,stage:a[key],prod:b[key]});
  fs.writeFileSync(path.join(directory,'contract-comparison.json'),JSON.stringify({stageSha256:hash(JSON.stringify(a)),prodSha256:hash(JSON.stringify(b)),differences},null,2));
  fs.writeFileSync(path.join(directory,'closed-differences.json'),JSON.stringify(recordClosedDifferences(stage,prod),null,2));
  check('captured operational contracts converge exactly',()=>assert.equal(differences.length,0,'See contract-comparison.json'));
  for(const [variant,database]of Object.entries(databases)){
    const proof=sql(database,markers+source('docs/production/reconciliation/operational-convergence/invariants.sql'));
    fs.writeFileSync(path.join(directory,variant+'-invariants.log'),proof+'\n');
    check(variant+' seven real SQL invariants in rolled-back fixtures',()=>assert.equal(proof.split('\n').filter(s=>s.startsWith('PASS ')).length,7));
    const containment=source('docs/production/reconciliation/encargo02/containment.sql');
    assert.equal((containment.match(/^COMMIT;$/gm)||[]).length,1);
    const verify="DO $verify$ BEGIN IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND has_function_privilege('authenticated',p.oid,'EXECUTE')) OR has_any_column_privilege('authenticated','public.patients','SELECT,INSERT,UPDATE') OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='encargo02_containment' AND permissive='RESTRICTIVE' AND qual='false' AND with_check='false') THEN RAISE EXCEPTION 'Containment contract failed'; END IF; END $verify$; SELECT 'PASS containment grants closed; transaction rollback follows'; ROLLBACK;";
    const result=sql(database,markers+containment.replace(/^COMMIT;$/m,verify));
    fs.writeFileSync(path.join(directory,variant+'-containment.log'),result+'\n');
    check(variant+' containment effective grants close without deleting rows; rollback restores contract',()=>{assert.match(result,/PASS containment/);assert.deepEqual(data(database),report[variant+'Before']);assert.deepEqual(contract(capture(database,variant+'-after-containment')),variant==='stage'?a:b);});
  }
  report.state='SCOPED_SQL_CONVERGENCE_VERIFIED_API_PENDING';
}
if(require.main===module) main().catch(e=>{report.failure=e.message;report.state='PARTIAL';process.exitCode=1;console.error(e.message);}).finally(()=>{report.completedAt=new Date().toISOString();if(outputCreated)persist();console.log(JSON.stringify({state:report.state,checks:report.checks,steps:report.steps.map(s=>s.label),failure:report.failure||null,evidence:directory}));});
module.exports={contract};
