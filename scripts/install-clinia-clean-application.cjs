'use strict';
// One-shot captured application install on an independently initialized NEW runtime.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs'),{plan}=require('./prepare-clinia-clean-managed.cjs');
const {snapshotSql,assertEmpty}=require('./verify-clinia-clean-managed.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(attempt,verificationOnly=false){
  const p=plan(attempt),managed=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-clean-managed',`attempt-${attempt}`,'execution.json')));
  assert.equal(managed.project,p.project);assert.equal(managed.status,'FRESH_MANAGED_INITIALIZED_APP_EMPTY');
  const evidence=path.join(local.repo,'docs/production/evidence/2026-10-02-clean-application',`attempt-${attempt}`),file=path.join(evidence,'execution.json');
  if(!verificationOnly)assert.ok(!fs.existsSync(evidence),'Application install already attempted; preserve it');
  const dump=fs.readFileSync(path.join(local.privateDir,'2026-09-29-staging-schema-local-client.sql'));
  assert.equal(sha(dump),'fe8d692856e96091eac8ae48f6ce2438c6fab85ea8e4c01679a4a000cb0a4347');
  const manifest=JSON.parse(fs.readFileSync(path.join(p.privateDir,'manifest.json'))),compose=path.join(p.privateDir,'runtime.compose.json');
  assert.equal(sha(fs.readFileSync(compose)),manifest.preparedComposeSha256);
  if(!verificationOnly)fs.mkdirSync(evidence,{recursive:true});
  const report=verificationOnly?JSON.parse(fs.readFileSync(file)):{status:'NOT VERIFIED',project:p.project,database:'postgres',startedAt:new Date().toISOString(),managedEvidence:path.relative(local.repo,path.join(local.repo,'docs/production/evidence/2026-10-02-clean-managed',`attempt-${attempt}`,'execution.json')),steps:[],
    limits:['Captured stage application schema, separately forward-reconciled on fresh managed initialization',
      'No clinical/Storage bytes copied; bucket metadata fixtures only', 'API/Auth ordinary-JWT and immutable-prescription overlay pending',
      'Not deployed provider/hook parity or full disaster recovery; no cleanup']};
  if(verificationOnly){
    assert.equal(report.project,p.project);assert.equal(report.status,'NOT VERIFIED');
    assert.ok(report.steps.length===17&&report.steps.every(step=>step.status==='VERIFIED'));
    assert.ok(report.error.startsWith('Managed extensions changed'),'Only known post-install verification continuation allowed');
    report.verificationFailures=[...(report.verificationFailures||[]),{error:report.error,completedAt:report.completedAt}];delete report.error;
  }
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');let operation=0;
  const persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));
  function run(args,input){
    const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:12*1024*1024});
    const log=`app-install-${Date.now()}-${operation++}.private.log`;fs.writeFileSync(path.join(p.privateDir,log),(r.stdout||'')+(r.stderr||''),{flag:'wx'});
    if(r.error||r.status!==0){report.diagnostic=log;throw Error('Clean application operation failed; target and private diagnostics preserved');}
    return {stdout:r.stdout.trim(),combined:(r.stdout||'')+(r.stderr||'')};
  }
  const markers=`SET app.clean_managed_project='${p.project}'; SET app.scoped_fixture_authorized='local-synthetic'; SET app.encargo02_authorized='reviewed-local-forward'; SET app.operational_convergence_authorized='reviewed-local-contract';\n`;
  function sql(text,role='postgres',atomic=false){
    assert.ok(['postgres','supabase_admin'].includes(role));
    const args=['exec','-i','--user','postgres',`supabase_db_${p.project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'];
    if(atomic)args.push('--single-transaction');args.push('-f','/dev/stdin');return run(args,markers+text);
  }
  function snapshot(){const out=sql(snapshotSql).combined;const line=out.split('\n').find(line=>line.includes('CLINIA_SNAPSHOT='));assert.ok(line);return JSON.parse(line.slice(line.indexOf('CLINIA_SNAPSHOT=')+16));}
  function step(name,text,role='postgres',atomic=false){report.steps.push({name,role,sha256:sha(text),status:'NOT VERIFIED'});persist();sql(text,role,atomic);report.steps.at(-1).status='VERIFIED';persist();}
  const read=relative=>fs.readFileSync(path.join(local.repo,relative),'utf8');
  function unchangedManaged(before,after,allowApplicationExtension=false){
    for(const key of ['authMigrations','storageMigrations','authMigrationVersions','storageMigrationVersions','managedFunctions','postgresVersion'])assert.deepEqual(after[key],before[key],`Managed ${key} changed while installing application`);
    if(allowApplicationExtension){
      const additions=after.extensions.filter(ext=>!before.extensions.some(prior=>prior.name===ext.name));
      assert.deepEqual(additions,[{name:'btree_gist',version:'1.7'}],'Only reviewed agenda prerequisite may be added');
      assert.deepEqual(after.extensions.filter(ext=>ext.name!=='btree_gist'),before.extensions,'Existing managed extension changed');
      report.applicationExtensionAdditions=additions;
    }else assert.deepEqual(after.extensions,before.extensions,'Managed extensions changed while installing application');
    assert.equal(after.authUsers,0);assert.equal(after.authSessions,0);assert.equal(after.storageObjects,0);
  }
  try{
    assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']).stdout,'npipe:////./pipe/dockerDesktopLinuxEngine');
    const c=JSON.parse(run(['inspect',`supabase_db_${p.project}`]).stdout)[0];
    assert.equal(c.Name,`/supabase_db_${p.project}`);assert.equal(c.Config.Labels['com.supabase.cli.project'],p.project);assert.equal(c.Image,manifest.imageIds.db);
    assert.equal(c.State.Health.Status,'healthy');assert.ok(!c.HostConfig.Privileged);assert.deepEqual(Object.keys(c.NetworkSettings.Networks),[p.network]);
    assert.ok(c.Mounts.some(m=>m.Type==='volume'&&m.Name===p.volumes.db));
    for(const ports of Object.values(c.NetworkSettings.Ports||{}))for(const port of ports||[])assert.equal(port.HostIp,'127.0.0.1');
    if(!verificationOnly){
    report.managedBefore=snapshot();assertEmpty(report.managedBefore);unchangedManaged(managed.managedInitialized,report.managedBefore);
    run(['compose','--project-name',p.project,'-f',compose,'stop','auth','storage']);
    step('strip-verified-empty-public-schema',`BEGIN; SET LOCAL lock_timeout='5s';
      DO $empty$ BEGIN IF current_database()<>'postgres' OR current_user<>'supabase_admin'
        OR current_setting('app.clean_managed_project',true) IS DISTINCT FROM '${p.project}'
        OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets)
        OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p'))
        OR to_regnamespace('logs') IS NOT NULL OR to_regnamespace('security_internal') IS NOT NULL
        THEN RAISE EXCEPTION 'Only genuinely fresh managed application-empty target allowed'; END IF; END $empty$;
      DROP SCHEMA public CASCADE; COMMIT;`,'supabase_admin');
    unchangedManaged(report.managedBefore,snapshot());
    step('captured-stage-application-schema',dump,'supabase_admin',true);
    const m7=read('supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql');
    step('m7-captured-stage-bridge',require('./clinia-captured-stage-m7-bridge.cjs').build('postgres',m7,{cleanManagedProject:p.project}),'supabase_admin');
    step('m7-exact-owners',read('docs/production/reconciliation/encargo01_local_m7_owners.sql'),'supabase_admin');
    const before=read('docs/production/reconciliation/operational-convergence/before-authority.sql');
    assert.equal(sha(before),JSON.parse(read('docs/production/reconciliation/operational-convergence/proposal-manifest.json')).sqlSha256);
    step('operational-prerequisites',before);
    const buckets=[['patient-files',10485760,['application/pdf','image/png','image/jpeg']],...['patient-avatars','clinic-branding','doctor-avatars'].map(name=>[name,2097152,['image/png','image/jpeg','image/webp']])];
    step('private-bucket-metadata-fixtures','INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES '+buckets.map(([name,size,mimes])=>`('${name}','${name}',false,${size},ARRAY[${mimes.map(x=>`'${x}'`).join(',')}])`).join(',')+';','supabase_admin');
    for(const [name,relative,pinned]of [
      ['authority','docs/production/reconciliation/encargo02/forward.sql'],
      ['operational-callbacks','docs/production/reconciliation/operational-convergence/after-authority.sql'],
      ['agenda','tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql'],
      ['reports','tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql'],
      ['canonical-catalog','docs/production/reconciliation/final-contract/verify.sql'],
      ['canonical-boundaries','docs/production/reconciliation/operational-convergence/verify-boundaries.sql'],
      ['pending-invitations','supabase/migrations/20261001120000_invitation_pending_reservation.sql'],
      ['durable-email','supabase/migrations/20261001130000_durable_email_abuse_budget.sql'],
      ['profile-guard','supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql'],
      ['live-session-revocation','supabase/migrations/20261002180423_live_session_revocation.sql','9e9e28f2b8871c5218a19b84918974061541808b141279d6b0fab7f666af0c9d'],
      ['trusted-enrollment','supabase/migrations/20261002180800_trusted_enrollment.sql','bcc0c79413c07f78be13de15c6d11f324e0a538084e8e7ee1e60c39c482c67f3'],
    ]){const text=read(relative);if(pinned)assert.equal(sha(text),pinned,'Reviewed overlay changed');step(name,text);}
    }
    report.managedAfter=snapshot();unchangedManaged(report.managedBefore,report.managedAfter,true);assert.equal(report.managedAfter.storageBuckets,4);
    assert.equal(sql('SELECT count(*) FROM public.patients;').stdout,'0');
    run(['compose','--project-name',p.project,'-f',compose,'up','-d','--pull','never','--wait','--wait-timeout','180','db','auth','storage']);
    report.status='CLEAN_APPLICATION_HELPER_ENROLLMENT_INSTALLED_SNAPSHOT_API_PENDING';
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,project:p.project,steps:report.steps.map(({name,status})=>({name,status})),error:report.error||null,evidence}));}
}
if(require.main===module){assert.ok(process.argv.length===3||(process.argv.length===4&&process.argv[2]==='verify'));try{main(process.argv.at(-1),process.argv.length===4);}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={main};
