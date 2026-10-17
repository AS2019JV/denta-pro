'use strict';
// Existing recovered target only; encrypted package is local and synthetic.
// All new database changes roll back. No provider or application env access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {migrationChain}=require('./verify-clinia-private-media-origin.cjs');
const {snapshotSql,configurationSql}=require('./verify-clinia-recovery-agenda-overlay.cjs');
const {encrypt,decrypt}=require('./clinia-recovery-envelope.cjs');
const REPO=path.resolve(__dirname,'..'),PROJECT='clinia-recovery-20261002-1',DATABASE='clinia_recovery';
const PRIVATE=path.join(REPO,'tools/local-supabase/supabase/.temp'),DIR=path.join(PRIVATE,PROJECT);
const BASE=path.join(REPO,'docs/production/evidence/2026-10-02-recovery/attempt-1');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFileSync(file),json=file=>JSON.parse(read(file));
const FILES=['database.dump','storage.tar','roles.private.json','global-settings.private.json','credentials.private.json',
  'source.keys.private.json','source.compose.private.json','runtime.compose.json','kong-kong.yml','kong-localhost.crt',
  'kong-localhost.key','db-pgsodium_root.key','objects.private.json','source-tables.private.json'];
async function main(attempt){
  assert.match(attempt||'',/^[1-9]$/);
  const output=path.join(REPO,'docs/production/evidence/2026-10-06-recovery-private-media','attempt-'+attempt);
  const packageDir=path.join(PRIVATE,'recovery-encrypted-20261006-'+attempt),keyDir=path.join(PRIVATE,'recovery-local-keys-20261006-'+attempt);
  for(const p of [output,packageDir,keyDir])assert.ok(!fs.existsSync(p),'Fresh attempt required');
  const proofFiles=['execution.json','continuation-execution.json','request-id-overlay-execution.json','agenda-overlay-1-execution.json'].map(f=>path.join(BASE,f));
  const [original,baseline,rx,agenda]=proofFiles.map(json),oldHashes=proofFiles.map(f=>sha(read(f)));
  assert.equal(original.targetProject,PROJECT);
  for(const p of [baseline,rx,agenda]){assert.ok(p.checks.length>0&&p.checks.every(c=>c.passed));assert.equal(p.targetStop,'STOPPED_VOLUMES_PRESERVED');}
  assert.equal(agenda.state,'RESTORED_BASELINE_PLUS_REQUEST_ID_AND_PINNED_AGENDA_OVERLAYS_VERIFIED');
  const proofPath=path.join(REPO,'docs/production/evidence/2026-10-06-private-media-origin/attempt-2/execution.json'),proof=json(proofPath),chain=migrationChain();
  assert.equal(proof.status,'PARTIALLY VERIFIED');assert.ok(proof.checks.every(c=>c.passed));
  assert.deepEqual(chain.sources,proof.migrations,'Four-migration chain differs from accepted local proof');
  const originals=FILES.map(name=>({name,bytes:read(path.join(DIR,name))}));
  const entries=originals.map(x=>({name:x.name,bytes:x.bytes.length,sha256:sha(x.bytes),base64:x.bytes.toString('base64')}));
  const hashOf=name=>entries.find(e=>e.name===name).sha256;
  assert.equal(hashOf('database.dump'),original.backup.databaseSha256);assert.equal(hashOf('storage.tar'),original.backup.storageTarSha256);
  assert.equal(hashOf('credentials.private.json'),original.configuration.signingMaterialSha256);
  assert.equal(hashOf('source.keys.private.json'),original.configuration.sourceCredentialSha256);
  assert.equal(hashOf('runtime.compose.json'),original.targetComposeSha256);assert.equal(hashOf('source.compose.private.json'),original.sourceComposeSha256);
  const migrationFiles=['supabase/migrations/20261002234427_enable_prescription_request_ids.sql','supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql',...chain.sources.map(x=>x.file)];
  for(const file of migrationFiles){const bytes=read(path.join(REPO,file));entries.push({name:file,bytes:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')});}
  for(const file of proofFiles){const bytes=read(file);entries.push({name:'evidence/'+path.basename(file),bytes:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')});}
  const manifest={format:'clinia-synthetic-recovery-v1',project:PROJECT,database:DATABASE,createdAt:new Date().toISOString(),entries,
    imageIds:original.imageIds,baselineBackup:original.backup,forwardMigrations:chain.sources};
  for(const p of [output,packageDir,keyDir])fs.mkdirSync(p,{recursive:true});
  const report={state:'NOT_VERIFIED',startedAt:new Date().toISOString(),driverSha256:sha(read(__filename)),codecSha256:sha(read(path.join(__dirname,'clinia-recovery-envelope.cjs'))),
    project:PROJECT,database:DATABASE,immutableEvidenceSha256:oldHashes,sourceProofSha256:sha(read(proofPath)),migrations:chain.sources,checks:[],
    limits:['Existing synthetic baseline archive and restored target; no fresh production backup or new RTO claim',
      'Encryption key remains in a separate private directory on the same machine; independent key custody and offsite recovery unverified',
      'Rollback-only SQL role proof; no new managed Auth JWT or HTTP S3 delivery proof in recovered stack',
      'Encrypted original Auth/configuration plus six forward SQL migrations; applying migrations does not configure the managed Auth hook']};
  const persist=()=>fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2)+'\n');
  const check=(name,detail)=>{report.checks.push({name,passed:true,detail});persist();};
  const key=crypto.randomBytes(32),plaintext=Buffer.from(JSON.stringify(manifest)),encrypted=encrypt(plaintext,key);
  // Restrictive POSIX modes also apply on compatible hosts. Windows directory
  // protection inherits the existing local private-runtime access boundary.
  fs.writeFileSync(path.join(keyDir,'recovery.key.private.bin'),key,{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(packageDir,'recovery.clinia.enc'),encrypted,{flag:'wx',mode:0o600});
  const diskEnvelope=read(path.join(packageDir,'recovery.clinia.enc')),diskKey=read(path.join(keyDir,'recovery.key.private.bin'));
  const restored=JSON.parse(decrypt(diskEnvelope,diskKey));assert.deepEqual(restored,manifest);
  for(const e of restored.entries){const bytes=Buffer.from(e.base64,'base64');assert.equal(bytes.length,e.bytes);assert.equal(sha(bytes),e.sha256);}
  const wrong=crypto.randomBytes(32),altered=Buffer.from(diskEnvelope);altered[altered.length-1]^=1;
  assert.throws(()=>decrypt(diskEnvelope,wrong));assert.throws(()=>decrypt(altered,diskKey));assert.throws(()=>decrypt(diskEnvelope.subarray(0,-1),diskKey));
  key.fill(0);diskKey.fill(0);wrong.fill(0);plaintext.fill(0);
  report.package={algorithm:'AES-256-GCM',nonceBytes:12,authenticationTagBytes:16,ciphertextSha256:sha(diskEnvelope),ciphertextBytes:diskEnvelope.length,
    entries:entries.map(({base64,...e})=>e),privatePackage:path.relative(REPO,packageDir),keyStoredSeparately:true,baselineTables:original.backup.tables,
    baselineRows:original.backup.rows,baselineStorageObjects:original.storageObjects.length,baselineStorageBytes:original.storageObjects.reduce((n,o)=>n+o.bytes,0)};
  check('Encrypted DB, physical Storage bytes, Auth/configuration, forward migrations and recovery evidence round-trip with exact hashes',{files:entries.length,wrongKeyDenied:true,tamperDenied:true,truncationDenied:true});
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe'),name='supabase_db_'+PROJECT;let started=false,initial;
  function run(args,input){const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:args[0]==='start'?120000:45000,maxBuffer:8*1024*1024});
    if(r.error||r.status!==0){fs.writeFileSync(path.join(packageDir,'operation-'+Date.now()+'.private.log'),JSON.stringify({operation:args[0],status:r.status,errorCode:r.error?.code||null,signal:r.signal})+'\n'+(r.stdout||'')+(r.stderr||''),{flag:'wx'});throw Error('Owned recovery '+args[0]+' failed ('+(r.error?.code||r.status)+'); private diagnostics preserved');}return r.stdout.trim();}
  const sql=text=>run(['exec','-i','--user','postgres',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',DATABASE,'-f','/dev/stdin'],text);
  function inspect(){const c=JSON.parse(run(['inspect',name]))[0];assert.equal(c.Name,'/'+name);assert.equal(c.Config.Labels['com.supabase.cli.project'],PROJECT);
    assert.equal(c.Image,original.imageIds.db);assert.ok(!c.HostConfig.Privileged);assert.deepEqual(Object.keys(c.NetworkSettings.Networks),[PROJECT+'-loopback']);
    for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])assert.equal(b.HostIp,'127.0.0.1');return c;}
  try{
    assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
    initial=inspect();assert.ok(['exited','running'].includes(initial.State.Status));report.initialState=initial.State.Status;report.containerId=initial.Id;
    started=initial.State.Status==='exited';if(started)run(['start',name]);
    for(let i=0;i<30;i++){const c=inspect();if(c.State.Status==='running'&&c.State.Health?.Status==='healthy')break;assert.ok(i<29,'Owned DB readiness timeout');await new Promise(r=>setTimeout(r,500));}
    const before=sql(snapshotSql()),config=sql(configurationSql);report.rowsSha256Before=sha(before);report.configurationSha256Before=sha(config);
    const probe=`
      DO $verify$ DECLARE r text; BEGIN
        IF EXISTS(SELECT 1 FROM public.patient_files WHERE delivery_path IS DISTINCT FROM file_path)
          OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>10
          OR EXISTS(SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
        THEN RAISE EXCEPTION 'Recovered origin migration invariant failed'; END IF;
        FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','clinia_document_delivery'] LOOP
          IF has_column_privilege(r,'public.patient_files','delivery_path','INSERT,UPDATE')
            OR has_table_privilege(r,'security_internal.retired_storage_objects','SELECT,INSERT,UPDATE,DELETE')
          THEN RAISE EXCEPTION 'Recovered role boundary leaked'; END IF;
        END LOOP;
      END $verify$;
      SELECT json_build_object('filesBackfilled',(SELECT count(*) FROM public.patient_files),
        'policies',(SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects'),
        'deliveryPrincipalEnabled',(SELECT count(*) FROM security_internal.document_delivery_principals WHERE enabled));
      ROLLBACK;`;
    const compiled=chain.sql+probe;report.rollbackSqlSha256=sha(compiled);report.probe=JSON.parse(sql(compiled));
    assert.equal(sql(snapshotSql()),before,'Recovered preexisting rows changed');assert.equal(sql(configurationSql),config,'Recovered managed configuration changed');
    assert.equal(sql("SELECT to_regclass('security_internal.retired_storage_objects') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.patient_files'::regclass AND attname='delivery_path' AND NOT attisdropped);"),'t');
    check('Four pinned migrations install over recovered baseline plus existing Rx/agenda overlays and fully roll back',report.probe);
    for(const [i,file]of proofFiles.entries())assert.equal(sha(read(file)),oldHashes[i]);
    for(const e of originals)assert.equal(sha(read(path.join(DIR,e.name))),sha(e.bytes));
    assert.equal(inspect().Id,initial.Id);check('Original archives, Auth/configuration, prior evidence and recovered rows unchanged',{originalFiles:originals.length,existingTables:JSON.parse(before).length});
    report.state='LOCAL_ENCRYPTED_RECOVERY_PACKAGE_AND_FOUR_MIGRATION_ROLLBACK_VERIFIED';
  }catch(error){report.state='PARTIAL_BLOCKED';report.error=error.message;throw error;}
  finally{if(started)run(['stop','--time','10',name]);if(initial){report.finalState=inspect().State.Status;assert.equal(report.finalState,initial.State.Status);}
    report.completedAt=new Date().toISOString();persist();}
  console.log(JSON.stringify({state:report.state,checks:report.checks.length,finalState:report.finalState,evidence:path.relative(REPO,output)}));return report;
}
if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main,FILES,PROJECT,DATABASE};
