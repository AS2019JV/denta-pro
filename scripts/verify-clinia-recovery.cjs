'use strict';
// REAL synthetic recovery, one new destination only. Source volumes are read,
// never reset/reconfigured. Archives, signing material and actor details stay private.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),net=require('node:net');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs'),sourceApi=require('./clinia-clean-api.cjs');
const {quoteCompose}=require('./prepare-clinia-compose.cjs');
const {settingsSql}=require('./clinia-pg-settings.cjs');
const action=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['preflight','run','resume-before-capture','resume-backup','resume-target','resume-empty-database'].includes(action));
const resumeTarget=['resume-target','resume-empty-database'].includes(action);
const source=sourceApi.config('clean-managed-1');
const target={project:'clinia-recovery-20261002-1',network:'clinia-recovery-20261002-1-loopback',database:'clinia_recovery',ports:{api:56511,db:56512,mail:56514}};
const privateDir=path.join(local.privateDir,target.project),output=path.join(local.repo,'docs/production/evidence/2026-10-02-recovery','attempt-1');
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const services=['db','auth','storage','kong','rest','inbucket'];const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const report={state:'NOT_STARTED',sourceProject:source.project,targetProject:target.project,ports:target.ports,steps:[],checks:[],requests:[],limits:['Synthetic local logical recovery; not production RTO/RPO or provider SLA','Same pinned local image family; not cross-version or geographically independent recovery','Realtime was not active in source and is not exercised; no external email, browser, clinical or legal certification']};
let operations=0,madeTarget=false,frozen=false,sourceWasRunning=[],madeOutput=false;
function run(args,input,binary=false){
  const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:binary?undefined:'utf8',windowsHide:true,timeout:180000,maxBuffer:128*1024*1024});
  if(r.error||r.status!==0){fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'operation-'+Date.now()+'-'+operations++ +'.private.log'),Buffer.concat([Buffer.from(r.stdout||''),Buffer.from(r.stderr||''),Buffer.from(r.error?.code||'')]),{flag:'wx'});throw Error('Local recovery operation failed; target and private diagnostics preserved');}
  return binary?r.stdout:(r.stdout||'').trim();
}
function sql(container,database,text){assert.ok([`supabase_db_${source.project}`,`supabase_db_${target.project}`].includes(container));assert.ok(['postgres',target.database].includes(database));const role=container===`supabase_db_${target.project}`?'supabase_admin':'postgres';return run(['exec','-i','--user','postgres',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',database,'-f','/dev/stdin'],text);}
const sourceSql=text=>sql(`supabase_db_${source.project}`,'postgres',text),targetSql=text=>sql(`supabase_db_${target.project}`,target.database,text);
function unquote(x){if(typeof x==='string')return x.replaceAll('$$','$');if(Array.isArray(x))return x.map(unquote);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unquote(v)]));return x;}
function persist(){if(madeOutput)fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2));}
async function step(name,fn){report.steps.push({name,state:'STARTED',startedAt:new Date().toISOString()});persist();const value=await fn();Object.assign(report.steps.at(-1),{state:'COMPLETED',completedAt:new Date().toISOString()});persist();return value;}
async function check(name,fn){await fn();report.checks.push({name,passed:true});persist();}
async function request(side,route,token,method='GET',body){
  const port=side==='source'?source.port:target.ports.api,origin='http://127.0.0.1:'+port,url=new URL(route,origin);assert.equal(url.origin,origin);
  const keys=JSON.parse(fs.readFileSync(source.keys));const headers={Authorization:'Bearer '+token,apikey:token===keys.service?keys.service:keys.anon};if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});const bytes=Buffer.from(await r.arrayBuffer());let data=null;
  if(bytes.length&&r.headers.get('content-type')?.includes('json'))try{data=JSON.parse(bytes.toString());}catch{throw Error('Invalid recovery API JSON');}
  report.requests.push({side,method,pathSha256:sha(url.pathname),status:r.status,responseSha256:sha(bytes)});return {ok:r.ok,status:r.status,data,bytes};
}
function ok(r){assert.ok(r.ok,'Recovery API rejected request HTTP '+r.status);return r.data;}
function denied(r){assert.ok([400,401,403,404,409].includes(r.status),'Recovery boundary failed, HTTP '+r.status);}
const rpc=(side,actor,name,body)=>request(side,'/rest/v1/rpc/'+name,actor.token,'POST',body);
const snapshotSql=`CREATE TEMP TABLE recovery_snapshot(schema_name text,table_name text,row_count bigint,sha256 text);
DO $snapshot$ DECLARE item record; n bigint; h text; BEGIN
FOR item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%' ORDER BY 1,2 LOOP
EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(row_hash,''|'' ORDER BY row_hash),''''),''sha256''),''hex'') FROM (SELECT encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') row_hash FROM %I.%I r) hashes',item.nspname,item.relname) INTO n,h;
INSERT INTO recovery_snapshot VALUES(item.nspname,item.relname,n,h); END LOOP; END $snapshot$;
SELECT json_agg(to_jsonb(s) ORDER BY schema_name,table_name) FROM recovery_snapshot s;`;
function snapshot(which){return JSON.parse(which(snapshotSql));}
async function preflight(){
  assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
  sourceApi.inspect('clean-managed-1',['db','auth','storage']);
  const spec=unquote(JSON.parse(fs.readFileSync(source.compose))),names=run(['container','ls','-a','--format','{{.Names}}']).split('\n');
  if(resumeTarget){
    assert.deepEqual(names.filter(x=>x.includes(target.project)),[`supabase_db_${target.project}`]);const item=JSON.parse(run(['inspect',`supabase_db_${target.project}`]))[0];assert.equal(item.Config.Labels['com.supabase.cli.project'],target.project);assert.equal(item.Image,spec.services.db.image);assert.equal(item.State.Status,'exited');assert.ok(!item.HostConfig.Privileged);assert.deepEqual(Object.keys(item.NetworkSettings.Networks),[target.network]);for(const mount of item.Mounts)if(mount.Type==='volume')assert.equal(mount.Name,'supabase_db_'+target.project);
  }else{assert.ok(!names.some(x=>x.includes(target.project)));assert.equal(run(['volume','ls','-q','--filter','name='+target.project]),'');assert.ok(!run(['network','ls','--format','{{.Name}}']).split('\n').includes(target.network));}
  if(action==='resume-before-capture'||action==='resume-backup'){
    const previous=JSON.parse(fs.readFileSync(path.join(output,'execution.json')));assert.equal(previous.state,'BLOCKED_BEFORE_TARGET');assert.equal(previous.checks.length,0);assert.equal(previous.sourceComposeSha256,sha(fs.readFileSync(source.compose)));
    if(action==='resume-before-capture'){assert.equal(previous.steps.length,0);assert.deepEqual(fs.readdirSync(privateDir),[],'Any private artifact means capture/mutation may have started');}
    else{assert.deepEqual(previous.steps.map(x=>[x.name,x.state]),[['source-positive-controls-and-byte-capture','COMPLETED'],['full-quiescent-database-and-storage-backup','STARTED']]);assert.deepEqual(fs.readdirSync(privateDir).sort(),['actors.private.json','downloaded-source','objects.private.json','operation-0.private.log','source-tables.private.json']);assert.deepEqual(snapshot(sourceSql),JSON.parse(fs.readFileSync(path.join(privateDir,'source-tables.private.json'))),'Source changed after interrupted backup; do not resume');}
  }else if(resumeTarget){
    const prior=JSON.parse(fs.readFileSync(path.join(output,'execution.json')));assert.equal(prior.state,'PARTIAL_FAILED_TARGET_PRESERVED');assert.equal(prior.targetStop,'STOPPED_VOLUMES_PRESERVED');assert.equal(prior.checks.length,0);assert.deepEqual(prior.steps.map(x=>[x.name,x.state]),[['source-positive-controls-and-byte-capture','COMPLETED'],['full-quiescent-database-and-storage-backup','COMPLETED'],['one-new-target-configuration','COMPLETED'],['restore-full-database-into-new-empty-target','STARTED']]);assert.equal(sha(fs.readFileSync(source.compose)),prior.sourceComposeSha256);assert.equal(sha(fs.readFileSync(path.join(privateDir,'database.dump'))),prior.backup.databaseSha256);assert.equal(sha(fs.readFileSync(path.join(privateDir,'storage.tar'))),prior.backup.storageTarSha256);assert.equal(sha(fs.readFileSync(path.join(privateDir,'runtime.compose.json'))),prior.targetComposeSha256);assert.deepEqual(snapshot(sourceSql),JSON.parse(fs.readFileSync(path.join(privateDir,'source-tables.private.json'))));
  }else assert.ok(!fs.existsSync(privateDir)&&!fs.existsSync(output),'One new recovery target only; preserve previous attempts');
  for(const port of Object.values(target.ports))await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error('Recovery loopback port occupied')));server.listen(port,'127.0.0.1',()=>server.close(resolve));});
  for(const v of Object.values(spec.services)){assert.match(v.image,/^sha256:[a-f0-9]{64}$/);assert.equal(run(['image','inspect',v.image,'--format','{{.Id}}']),v.image);assert.ok(!v.privileged&&!v.network_mode&&!v.devices);}
  const mem=run(['exec',`supabase_db_${source.project}`,'cat','/proc/meminfo']),disk=run(['exec',`supabase_db_${source.project}`,'df','-PB1','/var/lib/postgresql/data']);
  const availableMemoryBytes=Number(mem.match(/^MemAvailable:\s+(\d+) kB/m)?.[1])*1024,availableDiskBytes=Number(disk.split('\n').at(-1).trim().split(/\s+/)[3]);
  assert.ok(availableMemoryBytes>=768*1024*1024,'Less than 768MiB available RAM; coordinate source/primary stopping before new target');assert.ok(availableDiskBytes>=1024*1024*1024,'Less than 1GiB available local Docker disk; recovery blocked');
  report.resources={availableMemoryBytes,availableDiskBytes};report.sourceComposeSha256=sha(fs.readFileSync(source.compose));report.imageIds=Object.fromEntries(Object.entries(spec.services).map(([k,v])=>[k,v.image]));
  return spec;
}
async function main(){
  const sourceSpec=await preflight();if(action==='preflight'){console.log(JSON.stringify({state:'NEW_RECOVERY_TARGET_AVAILABLE',ports:target.ports,resources:report.resources,sourceComposeSha256:report.sourceComposeSha256}));return;}
  const freeze=path.join(local.privateDir,'clean-managed-20261002-1/recovery-freeze.private.json');
  const authorization=JSON.parse(fs.readFileSync(freeze));assert.equal(authorization.project,source.project);assert.equal(authorization.status,'TEST_WRITERS_FROZEN');assert.equal(authorization.composeSha256,report.sourceComposeSha256);assert.ok(Date.now()-Date.parse(authorization.confirmedAt)<30*60*1000,'Fresh source writer freeze required');
  if(['resume-before-capture','resume-backup','resume-target','resume-empty-database'].includes(action)){
    const previous=fs.readFileSync(path.join(output,'execution.json')),failure=action==='resume-empty-database'?'target-public-schema-failure-1.json':action==='resume-target'?'target-reserved-role-failure-1.json':action==='resume-backup'?'pretarget-backup-failure-1.json':'precreation-failure-1.json';fs.writeFileSync(path.join(output,failure),previous,{flag:'wx'});report.preCreationFailure={file:failure,sha256:sha(previous)};
    if(resumeTarget){const prior=JSON.parse(previous);Object.assign(report,prior,{state:'STARTED',error:undefined,steps:prior.steps.slice(0,3),targetStop:undefined,sourceStateRestored:undefined,resumeFailure:{file:failure,sha256:sha(previous)}});madeTarget=true;}
    if(action==='resume-backup'){const prior=JSON.parse(previous);report.storageObjects=prior.storageObjects;report.requests=prior.requests;report.steps=[prior.steps[0]];report.quiescedAt=prior.quiescedAt;}
  }else{fs.mkdirSync(privateDir);fs.mkdirSync(output,{recursive:true});}
  madeOutput=true;report.state='STARTED';report.startedAt=new Date().toISOString();persist();
  const sourceActors=JSON.parse(fs.readFileSync(action==='resume-backup'||resumeTarget?path.join(privateDir,'actors.private.json'):path.join(local.privateDir,source.project+'-actors-1.private.json'))),keys=JSON.parse(fs.readFileSync(source.keys));
  const fixtureReport=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-contract-api/clean-managed-1-1/execution.json')));assert.equal(fixtureReport.state,'CLEAN_GATEWAY_CORE_API_VERIFIED_NEW_WORKFLOWS_REMOTE_PENDING');assert.equal(fixtureReport.checks.length,27);assert.ok(fixtureReport.checks.every(x=>x.passed));
  const fixture=fixtureReport.fixtureIds;for(const value of Object.values(fixture))assert.match(value,/^[a-f0-9-]{36}$/);
  // Source API was stopped by its verifier. Start only its owned readers/login
  // control, then stop writers before a full DB + physical bytes capture.
  sourceWasRunning=JSON.parse(run(['inspect',...services.map(k=>`supabase_${k}_${source.project}`)])).filter(x=>x.State.Running).map(x=>x.Name.slice(1).split('supabase_')[1].split('_'+source.project)[0]);
  if(resumeTarget){/* Source capture already complete; no source lifecycle changes. */}
  else if(action==='resume-backup'){run(['compose','-f',source.compose,'stop','auth','storage','kong','rest','inbucket']);frozen=true;report.quiescedAt=new Date().toISOString();}
  else await step('source-positive-controls-and-byte-capture',async()=>{
    run(['compose','-f',source.compose,'up','-d','--pull','never','--wait','--wait-timeout','120',...services]);sourceApi.inspect('clean-managed-1');
    for(const label of ['doctor_A','receptionist_A','owner_B']){const actor=sourceActors[label];const session=ok(await request('source','/auth/v1/token?grant_type=password',keys.anon,'POST',{email:actor.email,password:actor.password}));assert.equal(session.user.id,actor.id);actor.token=session.access_token;}
    ok(await rpc('source',sourceActors.doctor_A,'get_patients_with_stats',{p_clinic_id:fixture.clinicA,p_patient_id:fixture.patientA}));
    const objects=JSON.parse(sourceSql("SELECT coalesce(json_agg(json_build_object('bucket',bucket_id,'name',name) ORDER BY bucket_id,name),'[]') FROM storage.objects;"));assert.ok(objects.length>0,'Actual source Storage bytes required');
    fs.mkdirSync(path.join(privateDir,'downloaded-source'));report.storageObjects=[];
    for(const [i,o]of objects.entries()){const route='/storage/v1/object/'+encodeURIComponent(o.bucket)+'/'+o.name.split('/').map(encodeURIComponent).join('/');const r=await request('source',route,keys.service);ok(r);fs.writeFileSync(path.join(privateDir,'downloaded-source',i+'.bin'),r.bytes);report.storageObjects.push({bucket:o.bucket,pathSha256:sha(o.name),bytes:r.bytes.length,sha256:sha(r.bytes)});}
    fs.writeFileSync(path.join(privateDir,'objects.private.json'),JSON.stringify(objects));fs.writeFileSync(path.join(privateDir,'actors.private.json'),JSON.stringify(sourceActors));
    run(['compose','-f',source.compose,'stop','auth','storage','kong','rest','inbucket']);frozen=true;report.quiescedAt=new Date().toISOString();
  });
  const before=resumeTarget?JSON.parse(fs.readFileSync(path.join(privateDir,'source-tables.private.json'))):await step('full-quiescent-database-and-storage-backup',async()=>{
    const snapshotBefore=snapshot(sourceSql);fs.writeFileSync(path.join(privateDir,'source-tables.private.json'),JSON.stringify(snapshotBefore));
    const roles=JSON.parse(sourceSql("SELECT json_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass',rolbypassrls,'limit',rolconnlimit,'password',rolpassword,'validUntil',rolvaliduntil,'config',(SELECT setconfig FROM pg_db_role_setting WHERE setdatabase=0 AND setrole=a.oid)) ORDER BY rolname) FROM pg_authid a WHERE rolname NOT LIKE 'pg_%';"));fs.writeFileSync(path.join(privateDir,'roles.private.json'),JSON.stringify(roles));
    const globalSettings=JSON.parse(sourceSql(`SELECT json_build_object(
      'memberships',(SELECT coalesce(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname),'[]') FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE r.rolname NOT LIKE 'pg_%' AND m.rolname NOT LIKE 'pg_%'),
      'databaseAcl',(SELECT json_agg(json_build_object('role',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.privilege_type) FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database()),
      'databaseSettings',(SELECT coalesce(json_agg(json_build_object('role',CASE WHEN s.setrole=0 THEN NULL ELSE pg_get_userbyid(s.setrole) END,'config',s.setconfig) ORDER BY s.setrole),'[]') FROM pg_db_role_setting s WHERE s.setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database())));`));
    fs.writeFileSync(path.join(privateDir,'global-settings.private.json'),JSON.stringify(globalSettings));report.globalSettingsSha256=sha(JSON.stringify({roles,globalSettings}));
    const dump=run(['exec','--user','postgres',`supabase_db_${source.project}`,'pg_dump','-U','postgres','-d','postgres','--format=custom','--quote-all-identifiers'],undefined,true);assert.ok(dump.length>0);fs.writeFileSync(path.join(privateDir,'database.dump'),dump);
    const bytes=run(['cp',`supabase_storage_${source.project}:/mnt/.`,'-'],undefined,true);assert.ok(bytes.length>0);fs.writeFileSync(path.join(privateDir,'storage.tar'),bytes);
    fs.copyFileSync(source.compose,path.join(privateDir,'source.compose.private.json'));fs.copyFileSync(source.keys,path.join(privateDir,'source.keys.private.json'));fs.copyFileSync(path.join(source.privateDir,'credentials.private.json'),path.join(privateDir,'credentials.private.json'));
    for(const service of Object.values(sourceSpec.services))for(const mount of service.volumes||[])if(mount.type==='bind'){assert.ok(mount.read_only&&path.resolve(mount.source).startsWith(source.privateDir+path.sep));fs.copyFileSync(mount.source,path.join(privateDir,path.basename(mount.source)));}
    report.backup={databaseSha256:sha(dump),databaseBytes:dump.length,storageTarSha256:sha(bytes),storageTarBytes:bytes.length,tableSnapshotSha256:sha(JSON.stringify(snapshotBefore)),tables:snapshotBefore.length,rows:snapshotBefore.reduce((n,x)=>n+Number(x.row_count),0),capturedAt:new Date().toISOString()};return snapshotBefore;
  });
  if(!resumeTarget)await step('one-new-target-configuration',async()=>{
    function rewrite(x){if(typeof x==='string')return x.replaceAll(source.project,target.project).replaceAll('56411','56511').replaceAll('56412','56512').replaceAll('56414','56514');if(Array.isArray(x))return x.map(rewrite);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[rewrite(k),rewrite(v)]));return x;}
    const spec=rewrite(sourceSpec);spec.name=target.project;spec.networks.local.name=target.network;
    for(const [name,service]of Object.entries(spec.services)){
      for(const mount of service.volumes||[])if(mount.type==='bind')mount.source=path.join(privateDir,path.basename(mount.source));
      for(const envName of ['GOTRUE_DB_DATABASE_URL','PGRST_DB_URI','DATABASE_URL']){const i=service.environment.findIndex(x=>x.startsWith(envName+'='));if(i>=0){const url=new URL(service.environment[i].slice(envName.length+1));assert.equal(url.hostname,`supabase_db_${target.project}`);url.pathname='/'+target.database;service.environment[i]=envName+'='+url.toString();}}
      if(name==='storage'){const i=service.environment.findIndex(x=>x.startsWith('TENANT_ID='));assert.ok(i>=0);service.environment[i]='TENANT_ID='+sourceSpec.services.storage.environment.find(x=>x.startsWith('TENANT_ID=')).slice(10);}
      for(const port of service.ports||[]){assert.equal(port.host_ip,'127.0.0.1');assert.ok(Object.values(target.ports).map(String).includes(port.published));}
    }
    // Retain the logical Storage tenant namespace and signing/provider settings.
    // Only infrastructure identities, DB URL path and loopback issuer move.
    const kong=path.join(privateDir,'kong-kong.yml');fs.writeFileSync(kong,rewrite(fs.readFileSync(kong,'utf8')));
    const compose=quoteCompose(spec);fs.writeFileSync(path.join(privateDir,'runtime.compose.json'),JSON.stringify(compose,null,2));report.targetComposeSha256=sha(fs.readFileSync(path.join(privateDir,'runtime.compose.json')));report.configuration={signingMaterialSha256:sha(fs.readFileSync(path.join(privateDir,'credentials.private.json'))),sourceCredentialSha256:sha(fs.readFileSync(source.keys)),logicalStorageTenantRetained:true};
    run(['compose','-f',path.join(privateDir,'runtime.compose.json'),'config','--quiet']);
  });
  if(!report.incidentAt)report.incidentAt=new Date().toISOString();if(!report.recoveryStartedAt)report.recoveryStartedAt=report.incidentAt;persist();
  const compose=path.join(privateDir,'runtime.compose.json');
  await step('restore-full-database-into-new-empty-target',async()=>{
    madeTarget=true;run(['compose','-f',compose,'up','-d','--pull','never','--wait','--wait-timeout','180','db']);
    const container=JSON.parse(run(['inspect',`supabase_db_${target.project}`]))[0];assert.equal(container.Config.Labels['com.supabase.cli.project'],target.project);assert.equal(container.Image,report.imageIds.db);assert.ok(!container.HostConfig.Privileged);
    assert.equal(sql(container.Name.slice(1),'postgres',`SELECT count(*) FROM pg_database WHERE datname='${target.database}';`),action==='resume-empty-database'?'1':'0');
    if(action!=='resume-empty-database'){
    const roles=JSON.parse(fs.readFileSync(path.join(privateDir,'roles.private.json'))),quote=x=>"'"+String(x).replaceAll("'","''")+"'",ident=x=>'"'+String(x).replaceAll('"','""')+'"';
    const roleSql=roles.map(r=>`DO $role$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=${quote(r.name)}) THEN CREATE ROLE ${ident(r.name)}; END IF; END $role$; ALTER ROLE ${ident(r.name)} WITH ${r.super?'':'NO'}SUPERUSER ${r.inherit?'':'NO'}INHERIT ${r.createRole?'':'NO'}CREATEROLE ${r.createDb?'':'NO'}CREATEDB ${r.login?'':'NO'}LOGIN ${r.replication?'':'NO'}REPLICATION ${r.bypass?'':'NO'}BYPASSRLS CONNECTION LIMIT ${r.limit} PASSWORD ${r.password===null?'NULL':quote(r.password)} VALID UNTIL ${r.validUntil===null?"'infinity'":quote(r.validUntil)}; ALTER ROLE ${ident(r.name)} RESET ALL;\n`+settingsSql('ALTER ROLE '+ident(r.name),r.config)).join('\n');
    sql(container.Name.slice(1),'postgres',roleSql+`\nCREATE DATABASE ${target.database} TEMPLATE template0 OWNER postgres; REVOKE CONNECT ON DATABASE ${target.database} FROM PUBLIC;`);
    const globalSettings=JSON.parse(fs.readFileSync(path.join(privateDir,'global-settings.private.json')));
    const existingMemberships=JSON.parse(sql(container.Name.slice(1),'postgres',"SELECT coalesce(json_agg(json_build_object('role',r.rolname,'member',m.rolname)),'[]') FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE r.rolname NOT LIKE 'pg_%' AND m.rolname NOT LIKE 'pg_%';"));
    sql(container.Name.slice(1),'postgres',existingMemberships.map(r=>`REVOKE ${ident(r.role)} FROM ${ident(r.member)};`).join('\n')+'\n'+globalSettings.memberships.map(r=>['ADMIN','INHERIT','SET'].map(option=>`GRANT ${ident(r.role)} TO ${ident(r.member)} WITH ${option} ${r[option.toLowerCase()]?'TRUE':'FALSE'};`).join('\n')).join('\n')+'\n'+globalSettings.databaseAcl.map(r=>{assert.ok(['CONNECT','CREATE','TEMPORARY'].includes(r.privilege));return `GRANT ${r.privilege} ON DATABASE ${target.database} TO ${r.role==='PUBLIC'?'PUBLIC':ident(r.role)}${r.grantable?' WITH GRANT OPTION':''};`;}).join('\n')+'\n'+globalSettings.databaseSettings.map(r=>settingsSql(r.role===null?'ALTER DATABASE '+target.database:'ALTER ROLE '+ident(r.role)+' IN DATABASE '+target.database,r.config)).join('\n'));
    }
    assert.equal(targetSql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p');"),'0');
    // pg_dump's default-public entry contains ownership/comments, not CREATE.
    // Retain template0's empty public; repair absence only after proving empty.
    if(targetSql("SELECT to_regnamespace('public') IS NULL;")==='t')targetSql('CREATE SCHEMA public AUTHORIZATION pg_database_owner;');
    run(['exec','-i','--user','postgres',`supabase_db_${target.project}`,'pg_restore','--exit-on-error','--single-transaction','-U','supabase_admin','-d',target.database],fs.readFileSync(path.join(privateDir,'database.dump')));
    const restored=snapshot(targetSql);assert.deepEqual(restored,before,'Restored table data differs from quiescent backup');report.restoredTableSnapshotSha256=sha(JSON.stringify(restored));
  });
  await step('restore-physical-storage-and-start-owned-target-providers',async()=>{
    run(['compose','-f',compose,'create','storage']);run(['cp','-',`supabase_storage_${target.project}:/mnt`],fs.readFileSync(path.join(privateDir,'storage.tar')));
    run(['compose','-f',compose,'up','-d','--pull','never','--wait','--wait-timeout','180',...services]);
    const containers=JSON.parse(run(['inspect',...services.map(k=>`supabase_${k}_${target.project}`)]));report.runtime=containers.map((x,i)=>{assert.equal(x.Image,report.imageIds[services[i]]);assert.equal(x.State.Status,'running');if(x.State.Health)assert.equal(x.State.Health.Status,'healthy');assert.ok(!x.HostConfig.Privileged);assert.deepEqual(Object.keys(x.NetworkSettings.Networks),[target.network]);for(const bindings of Object.values(x.NetworkSettings.Ports||{}))for(const b of bindings||[])assert.equal(b.HostIp,'127.0.0.1');for(const m of x.Mounts)if(m.Type==='volume')assert.ok(m.Name.includes(target.project));return {service:services[i],imageId:x.Image,state:x.State.Status,health:x.State.Health?.Status||null};});
  });
  await check('Every physical source Storage object restores exact bytes',async()=>{
    const objects=JSON.parse(fs.readFileSync(path.join(privateDir,'objects.private.json')));for(const [i,o]of objects.entries()){const route='/storage/v1/object/'+encodeURIComponent(o.bucket)+'/'+o.name.split('/').map(encodeURIComponent).join('/');const r=await request('target',route,keys.service);ok(r);assert.equal(sha(r.bytes),report.storageObjects[i].sha256);assert.equal(r.bytes.length,report.storageObjects[i].bytes);}report.restoredObjects=objects.length;report.restoredBytes=report.storageObjects.reduce((n,x)=>n+x.bytes,0);
  });
  await check('Restored Auth password identities issue fresh ordinary JWTs',async()=>{
    for(const label of ['doctor_A','receptionist_A','owner_B']){const a=sourceActors[label],session=ok(await request('target','/auth/v1/token?grant_type=password',keys.anon,'POST',{email:a.email,password:a.password}));assert.equal(session.user.id,a.id);assert.ok(session.access_token);a.token=session.access_token;}fs.writeFileSync(path.join(privateDir,'restored-actors.private.json'),JSON.stringify(sourceActors));
  });
  await check('Restored clinical RLS and patient bytes preserve role and tenant boundaries',async()=>{
    const doctor=sourceActors.doctor_A,reception=sourceActors.receptionist_A,foreign=sourceActors.owner_B;
    ok(await rpc('target',doctor,'get_patients_with_stats',{p_clinic_id:fixture.clinicA,p_patient_id:fixture.patientA}));denied(await rpc('target',reception,'get_patients_with_stats',{p_clinic_id:fixture.clinicA}));denied(await rpc('target',foreign,'get_patients_with_stats',{p_clinic_id:fixture.clinicA}));denied(await rpc('target',{token:keys.anon},'get_patients_with_stats',{p_clinic_id:fixture.clinicA}));
    const objects=JSON.parse(fs.readFileSync(path.join(privateDir,'objects.private.json'))),i=objects.findIndex(x=>x.bucket==='patient-files');assert.ok(i>=0);const o=objects[i],route='/storage/v1/object/'+o.bucket+'/'+o.name;const read=await request('target',route,doctor.token);ok(read);assert.equal(sha(read.bytes),report.storageObjects[i].sha256);for(const token of [reception.token,foreign.token,keys.anon])denied(await request('target',route,token));
  });
  await check('Clinical Storage own listing positive and foreign clinic listing empty',async()=>{
    const prefix=fixture.clinicA+'/'+fixture.patientA;
    const own=ok(await request('target','/storage/v1/object/list/patient-files',sourceActors.doctor_A.token,'POST',{prefix,limit:100,offset:0}));assert.ok(Array.isArray(own)&&own.length>0,'Owned clinical listing must contain restored objects');
    const foreign=ok(await request('target','/storage/v1/object/list/patient-files',sourceActors.owner_B.token,'POST',{prefix,limit:100,offset:0}));assert.ok(Array.isArray(foreign)&&foreign.length===0,'Foreign clinical listing disclosed objects');report.patientFileListing={ownCount:own.length,foreignCount:foreign.length};
  });
  await step('baseline-prescription-retry-contract-observation',async()=>{
    const doctor=sourceActors.doctor_A;
    const serialized=targetSql(`SELECT to_jsonb(r)::text FROM public.prescriptions r WHERE clinic_id='${fixture.clinicA}' AND doctor_id='${doctor.id}' AND issuance_snapshot IS NOT NULL ORDER BY created_at DESC LIMIT 1;`);assert.ok(serialized,'Preserved issuer prescription required for retry proof');
    const row=JSON.parse(serialized),beforeDigest=sha(serialized);
    const duplicate=await request('target','/rest/v1/prescriptions',doctor.token,'POST',{id:row.id,clinic_id:row.clinic_id,patient_id:row.patient_id,doctor_id:row.doctor_id,data:row.data});assert.ok(['23505','42501'].includes(duplicate.data?.code),'Unexpected retry contract result');assert.ok([401,403,409].includes(duplicate.status));
    const after=targetSql(`SELECT to_jsonb(r)::text FROM public.prescriptions r WHERE id='${row.id}';`);assert.equal(sha(after),beforeDigest);report.prescriptionRetry={state:duplicate.data.code==='23505'?'PRIMARY_KEY_REPLAY_REJECTED':'BLOCKED_BASELINE_INSERT_ID_GRANT_MISSING',sqlstate:duplicate.data.code,originalSha256:beforeDigest,unchanged:true};report.candidateScope='Backup predates prospective INSERT(id) grant; forward grant verification is separate';
  });
  await check('Source DB and its configuration remain unchanged after the quiescent capture',async()=>{assert.deepEqual(snapshot(sourceSql),before);assert.equal(sha(fs.readFileSync(source.compose)),report.sourceComposeSha256);});
  report.recoveryVerifiedAt=new Date().toISOString();report.syntheticRtoSeconds=(Date.parse(report.recoveryVerifiedAt)-Date.parse(report.recoveryStartedAt))/1000;report.syntheticBackupAgeAtIncidentSeconds=(Date.parse(report.incidentAt)-Date.parse(report.backup.capturedAt))/1000;report.syntheticRpoLostCommittedWrites=0;report.rpoBasis='Source test writers quiesced before both captures; exact table and byte parity; no production RPO/SLA inference';report.state='REAL_SYNTHETIC_DB_STORAGE_CONFIGURATION_RECOVERY_VERIFIED';
}
main().catch(e=>{report.state=madeTarget?'PARTIAL_FAILED_TARGET_PRESERVED':'BLOCKED_BEFORE_TARGET';report.error=e.message;process.exitCode=1;}).finally(()=>{
  if(action!=='preflight'&&madeOutput){
    if(madeTarget)try{run(['compose','-f',path.join(privateDir,'runtime.compose.json'),'stop']);report.targetStop='STOPPED_VOLUMES_PRESERVED';}catch{report.targetStop='STOP_FAILED_REQUIRES_REVIEW';process.exitCode=1;}
    if(frozen)try{if(sourceWasRunning.length)run(['compose','-f',source.compose,'up','-d','--pull','never','--wait','--wait-timeout','120',...sourceWasRunning]);report.sourceStateRestored='ORIGINAL_RUNNING_SERVICES_PRESERVED';}catch{report.sourceStateRestored='RESTART_FAILED_REQUIRES_REVIEW';process.exitCode=1;}
    report.completedAt=new Date().toISOString();persist();
  }
  if(action!=='preflight'||report.error)console.log(JSON.stringify({state:report.state,error:report.error||null,checks:report.checks.length,rtoSeconds:report.syntheticRtoSeconds,targetStop:report.targetStop,sourceStateRestored:report.sourceStateRestored,evidence:madeOutput?output:null}));
});
