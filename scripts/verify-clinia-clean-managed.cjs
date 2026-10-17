'use strict';
// Local managed initialization only, before any captured application installation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs'),{plan}=require('./prepare-clinia-clean-managed.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const snapshotSql=`DO $snapshot$
DECLARE item record; count_rows bigint; values_json jsonb := '{}'::jsonb; history jsonb;
BEGIN
  FOR item IN SELECT * FROM (VALUES ('authUsers','auth.users'),('authSessions','auth.sessions'),
    ('storageObjects','storage.objects'),('storageBuckets','storage.buckets'),
    ('authMigrations','auth.schema_migrations'),('storageMigrations','storage.migrations')) AS wanted(key,table_name) LOOP
    count_rows := NULL;
    IF to_regclass(item.table_name) IS NOT NULL THEN EXECUTE format('SELECT count(*) FROM %s',to_regclass(item.table_name)) INTO count_rows; END IF;
    values_json := values_json || jsonb_build_object(item.key,count_rows);
  END LOOP;
  IF to_regclass('auth.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT jsonb_agg(version ORDER BY version) FROM auth.schema_migrations' INTO history;
    values_json := values_json || jsonb_build_object('authMigrationVersions',history);
  END IF;
  IF to_regclass('storage.migrations') IS NOT NULL THEN
    EXECUTE 'SELECT jsonb_agg(jsonb_build_object(''id'',id,''name'',name) ORDER BY id) FROM storage.migrations' INTO history;
    values_json := values_json || jsonb_build_object('storageMigrationVersions',history);
  END IF;
  values_json := values_json || jsonb_build_object(
    'patients',to_regclass('public.patients'),
    'applicationTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p')),
    'authTriggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid=to_regclass('auth.users') AND NOT tgisinternal),
    'managedFunctions',(SELECT jsonb_agg(jsonb_build_object('identity',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','definitionMd5',md5(pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage') AND p.prokind='f'),
    'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension),
    'postgresVersion',current_setting('server_version'));
  RAISE NOTICE 'CLINIA_SNAPSHOT=%',values_json;
END $snapshot$;`;
function assertEmpty(snapshot){
  assert.equal(snapshot.patients,null,'Application patient table exists');
  assert.equal(snapshot.applicationTables,0,'Application table exists');
  assert.equal(snapshot.authTriggers,0,'Application Auth hook exists before application install');
  for(const key of ['authUsers','authSessions','storageObjects','storageBuckets'])assert.ok(snapshot[key]===null||snapshot[key]===0,'Fresh managed fixture is occupied');
}
function main(action,attempt,resumeBeforeCreation=false){
  assert.ok(['db','managed'].includes(action),'Use db|managed and prepared attempt');
  assert.ok(!resumeBeforeCreation||action==='db','Pre-creation retry is DB-only');
  const p=plan(attempt),compose=path.join(p.privateDir,'runtime.compose.json'),manifest=JSON.parse(fs.readFileSync(path.join(p.privateDir,'manifest.json')));
  assert.equal(manifest.project,p.project);assert.equal(sha(fs.readFileSync(compose)),manifest.preparedComposeSha256,'Prepared private configuration changed');
  const evidence=path.join(local.repo,'docs/production/evidence/2026-10-02-clean-managed',`attempt-${attempt}`),file=path.join(evidence,'execution.json');
  const report=action==='db'&&!resumeBeforeCreation?{status:'NOT VERIFIED',project:p.project,ports:p.ports,volumes:p.volumes,imageIds:manifest.imageIds,startedAt:new Date().toISOString(),
    limits:['Fresh managed initialization only; no application install, provider deployment parity or backup-byte recovery',
      'Only new db/auth/storage services started; API7 and ordinary JWT verification pending']}:JSON.parse(fs.readFileSync(file));
  if(action==='db'&&!resumeBeforeCreation){assert.ok(!fs.existsSync(evidence),'New managed initialization evidence required');fs.mkdirSync(evidence,{recursive:true});}
  else if(resumeBeforeCreation){
    assert.equal(report.status,'NOT VERIFIED');assert.ok(!report.runtimeMutationStarted&&!report.imageDatabase,'Docker creation was already attempted; preserve target and use NEW attempt');
    report.preCreationFailures=[...(report.preCreationFailures||[]),{error:report.error,updatedAt:report.updatedAt}];delete report.error;
  }
  else assert.equal(report.status,'IMAGE_DATABASE_INITIALIZED_APP_EMPTY','DB-only baseline required');
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  let operation=0;
  function run(args,input,allowNotice=false){
    const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:4*1024*1024});
    const privateLog=path.join(p.privateDir,`${action}-${Date.now()}-${operation++}.private.log`);
    fs.writeFileSync(privateLog,(r.stdout||'')+(r.stderr||''),{flag:'wx'});
    if(r.error||r.status!==0)throw Error('Local managed initialization failed; private diagnostics and all volumes preserved');
    return allowNotice?(r.stdout||'')+(r.stderr||''):r.stdout.trim();
  }
  const persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));
  try{
    assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
    if(action==='db'){
      assert.equal(run(['volume','ls','-q','--filter','name='+p.project]),'','Fresh volumes required');
      assert.equal(run(['container','ls','-aq','--filter','label=com.docker.compose.project='+p.project]),'','New project required');
    }
    run(['compose','--project-name',p.project,'-f',compose,'config','--quiet']);
    const services=action==='db'?['db']:['db','auth','storage'];
    report.runtimeMutationStarted=true;persist();
    run(['compose','--project-name',p.project,'-f',compose,'up','-d','--pull','never','--wait','--wait-timeout','180',...services]);
    report.runtime=services.map(key=>{
      const c=JSON.parse(run(['inspect',`supabase_${key}_${p.project}`]))[0];
      assert.equal(c.Name,`/supabase_${key}_${p.project}`);assert.equal(c.Config.Labels['com.supabase.cli.project'],p.project);
      assert.equal(c.Image,manifest.imageIds[key]);assert.equal(c.State.Status,'running');assert.ok(!c.HostConfig.Privileged);
      assert.deepEqual(Object.keys(c.NetworkSettings.Networks),[p.network]);
      if(c.State.Health)assert.equal(c.State.Health.Status,'healthy');
      for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])assert.equal(b.HostIp,'127.0.0.1');
      for(const m of c.Mounts||[])if(m.Type==='volume')assert.ok(Object.values(p.volumes).includes(m.Name),'Occupied/source volume refused');
      return {name:c.Name,imageId:c.Image,status:c.State.Status,health:c.State.Health?.Status||null,ports:c.NetworkSettings.Ports};
    });
    const output=run(['exec','-i','--user','postgres',`supabase_db_${p.project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-f','/dev/stdin'],snapshotSql,true);
    const line=output.split('\n').find(line=>line.includes('CLINIA_SNAPSHOT='));assert.ok(line,'Managed snapshot notice missing');
    const snapshot=JSON.parse(line.slice(line.indexOf('CLINIA_SNAPSHOT=')+16));assertEmpty(snapshot);
    if(action==='db'){report.imageDatabase=snapshot;report.status='IMAGE_DATABASE_INITIALIZED_APP_EMPTY';}
    else{
      assert.ok(snapshot.authMigrations>(report.imageDatabase.authMigrations??0),'Auth migrations did not advance from fresh image');
      assert.ok(snapshot.storageMigrations>(report.imageDatabase.storageMigrations??0),'Storage migrations did not advance from fresh image');
      report.managedInitialized=snapshot;report.status='FRESH_MANAGED_INITIALIZED_APP_EMPTY';
    }
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{report.updatedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,project:p.project,error:report.error||null,evidence}));}
}
if(require.main===module){assert.ok([4,5].includes(process.argv.length));assert.ok(process.argv.length===4||process.argv[4]==='--resume-before-creation');try{main(process.argv[2],process.argv[3],process.argv.length===5);}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={snapshotSql,assertEmpty};
