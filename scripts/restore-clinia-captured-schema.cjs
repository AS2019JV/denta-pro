'use strict';
// One-shot restoration into NEW local databases only. No services, remote access or cleanup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
const targets={
  stage:{source:'clinia_stage_clean',file:'2026-09-29-staging-schema-local-client.sql',sha256:'fe8d692856e96091eac8ae48f6ce2438c6fab85ea8e4c01679a4a000cb0a4347',tables:25,functions:10,policies:11},
  linked:{source:'clinia_prod_upgrade',file:'2026-09-29-linked-schema-local-client.sql',sha256:'e251b969c0b6df8c5281ecf753aedca1af146799d84ba41fc9a892a5fdb599f3',tables:25,functions:30,policies:75},
};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function plan(variant,attempt,options={}){
  assert.ok(Object.hasOwn(targets,variant),'Captured stage or linked variant required');
  assert.match(String(attempt),/^[1-9]$/,'New attempt 1..9 required');
  assert.ok(Object.keys(options).every(key=>key==='managedTemplateStage'),'Unknown restore option');
  assert.ok(!options.managedTemplateStage||variant==='linked','Managed staging template override is linked-only');
  const database=`clinia_restore_${variant}_20261001_${attempt}`;
  return {...targets[variant],source:options.managedTemplateStage?'clinia_stage_clean':targets[variant].source,managedTemplateStage:!!options.managedTemplateStage,variant,attempt:String(attempt),database,
    file:path.join(local.privateDir,targets[variant].file),
    evidence:path.join(local.repo,'docs/production/evidence/2026-10-01-schema-restore',`${variant}-${attempt}`)};
}
function stripSql(database){
  assert.match(database,/^clinia_restore_(stage|linked)_20261001_[1-9]$/);
  return `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
    DO $target$ BEGIN IF current_database()<>'${database}' OR current_user<>'supabase_admin'
      THEN RAISE EXCEPTION 'New isolated restoration target required'; END IF; END $target$;
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS logs CASCADE;
    DROP SCHEMA IF EXISTS security_internal CASCADE;
    COMMIT;`;
}
const managedSql=`SELECT json_build_object(
  'authUsers',(SELECT count(*) FROM auth.users),'sessions',(SELECT count(*) FROM auth.sessions),
  'storageObjects',(SELECT count(*) FROM storage.objects),'buckets',(SELECT count(*) FROM storage.buckets),
  'authMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY version) FROM auth.schema_migrations m),
  'storageMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY id) FROM storage.migrations m),
  'functions',(SELECT json_agg(json_build_object('identity',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
    'bodyMd5',md5(pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage') AND p.prokind='f'),
  'tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('auth','storage') AND c.relkind IN ('r','p')),
  'extensions',(SELECT json_agg(json_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace));`;
async function main(variant,attempt,options={}){
  const c=plan(variant,attempt,options),report={startedAt:new Date().toISOString(),state:'PARTIAL',database:c.database,source:c.source,managedTemplateStage:c.managedTemplateStage,steps:[],
    limits:['Captured app schemas only atop existing local managed Auth/Storage template',
      'Not a clean managed Supabase installation or complete remote backup',
      'No application forward upgrade, API/JWT/Storage bytes or deployed parity acceptance',
      'Captured dump excludes Auth hooks, Storage policies/buckets, migration history and provider configuration',
      'Any inherited local application migration history is not the remote captured history',
      'No cleanup; every created database and private diagnostic is preserved']};
  assert.ok(!fs.existsSync(c.evidence),'Evidence exists; preserve it and choose a new attempt');
  const dump=fs.readFileSync(c.file);assert.equal(digest(dump),c.sha256,'Captured dump hash differs; review without execution');
  assert.ok(dump.toString('utf8').includes('PostgreSQL database dump'),'Expected reviewed pg_dump source');
  fs.mkdirSync(c.evidence,{recursive:true});
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  function sql(database,text,singleTransaction=false){
    assert.ok(['template1',c.source,c.database].includes(database),'Local SQL destination refused');
    const args=['--context','desktop-linux','exec','-i','--user','postgres','supabase_db_clinia-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',database];
    if(singleTransaction)args.push('--single-transaction');args.push('-f','/dev/stdin');
    const r=spawnSync(docker,args,{cwd:local.repo,input:text,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:12*1024*1024});
    if(r.error||r.status!==0){
      const diagnostic=`restore-${variant}-${attempt}-${Date.now()}.private.log`;
      fs.writeFileSync(path.join(local.privateDir,diagnostic),(r.stdout||'')+(r.stderr||''),{flag:'wx'});
      report.diagnostic=diagnostic;throw new Error('Local restore SQL failed; private diagnostic and target preserved');
    }
    return r.stdout.trim();
  }
  function step(name,database,text,singleTransaction=false){
    report.steps.push({name,database,sha256:digest(text),state:'STARTED'});
    fs.writeFileSync(path.join(c.evidence,'execution.json'),JSON.stringify(report,null,2));
    const result=sql(database,text,singleTransaction);report.steps.at(-1).state='COMMITTED';return result;
  }
  try{
    report.runtime=local.inspectDatabase();
    assert.equal(sql('template1',`SELECT count(*) FROM pg_database WHERE datname='${c.database}';`),'0','Destination already exists; never reuse it');
    report.managedBefore=JSON.parse(sql(c.source,managedSql));
    for(const key of ['authUsers','sessions','storageObjects','buckets'])assert.equal(report.managedBefore[key],0,'Empty managed source required; preserve source actors/objects');
    report.sourceApp=JSON.parse(sql(c.source,"SELECT json_build_object('authTriggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal),'storagePolicies',(SELECT count(*) FROM pg_policies WHERE schemaname='storage'));"));
    const appHistoryExists=sql(c.source,"SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;")==='t';
    report.inheritedApplicationHistory={present:appHistoryExists,count:appHistoryExists?Number(sql(c.source,'SELECT count(*) FROM supabase_migrations.schema_migrations;')):0,provenance:'local template only; remote dump excludes this schema'};
    step('clone-new-target','template1',`CREATE DATABASE ${c.database} TEMPLATE ${c.source} OWNER postgres; REVOKE CONNECT ON DATABASE ${c.database} FROM PUBLIC;`);
    step('strip-app-in-new-target',c.database,stripSql(c.database));
    assert.deepEqual(JSON.parse(sql(c.database,managedSql)),report.managedBefore,'Managed Auth/Storage changed while stripping app; preserve target for review');
    report.sourceSha256=c.sha256;
    step('restore-captured-application',c.database,dump,true);
    report.restored=JSON.parse(sql(c.database,"SELECT json_build_object('tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p')),'functions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f'),'policies',(SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','logs','security_internal')),'patients',(SELECT count(*) FROM public.patients));"));
    for(const key of ['tables','functions','policies'])assert.equal(report.restored[key],c[key],`Restored ${key} differs from captured manifest`);
    assert.equal(report.restored.patients,0,'Captured schema restore must contain no patient data');
    assert.deepEqual(JSON.parse(sql(c.database,managedSql)),report.managedBefore,'Managed state changed during dump restore');
    assert.equal(sql(c.database,"SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;"),appHistoryExists?'t':'f','Inherited local application history changed');
    if(appHistoryExists)assert.equal(Number(sql(c.database,'SELECT count(*) FROM supabase_migrations.schema_migrations;')),report.inheritedApplicationHistory.count,'Inherited local application history changed');
    assert.deepEqual(JSON.parse(sql(c.source,managedSql)),report.managedBefore,'Source managed state changed');
    report.state='CAPTURED_APP_SCHEMA_RESTORED_FORWARD_API_PARITY_PENDING';
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{
    report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(c.evidence,'execution.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({state:report.state,database:c.database,steps:report.steps.map(s=>({name:s.name,state:s.state})),error:report.error||null,evidence:c.evidence}));
  }
  return report;
}
if(require.main===module){
  assert.ok([4,5].includes(process.argv.length),'Use stage|linked and a NEW attempt 1..9');
  assert.ok(process.argv.length===4||process.argv[4]==='--managed-template-stage','Unknown restore flag');
  main(process.argv[2],process.argv[3],{managedTemplateStage:process.argv.length===5}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={plan,stripSql};
