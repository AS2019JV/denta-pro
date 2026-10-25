'use strict';
// M0 only. Dry-run creates no Docker/private resources. Initialize requires independently authorized invocation.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const DIR='docs/production/gate4-recovery-ops/managed-a9-2026-10-25';
const OUT=path.join(ROOT,'docs/production/evidence/2026-10-25-gate4-m0-harness');
const CONTRACT_SHA='4c8b61e0c2df354d58be32f8f3d583aba17c2b7d5979ebe55f9e9cb57c8e20d7';
const COMPOSE_SHA='fc56a725b7e325cfcffb3a60c3de333dbd8ea5de2f2512018b05206bc68d416e';
const CUSTODY_SHA='0475da8b858356ae8c3bfd39a1ca69a8b8d18b2b54a56b58e9bdcfe1c5e3d028';
const M0_CUSTODY_SHA='ac065e2de5ffa1bdf2a2b3872e25c2c5f7b8d0686cc81995ce35b81bdd8293ad';
const DEPENDENCIES=[{"path":"scripts/prepare-clinia-clean-managed.cjs","sha256":"6a38074da8077d2ed390a5f726b377dfd3856523e244ccda61ada211c68af184"},{"path":"scripts/prepare-clinia-compose.cjs","sha256":"f3c9319e1c511ddaa4ddfb2c26b1f937d9a6b5518b8a89bde457fd411dd3b2fd"},{"path":"scripts/clinia-local-runtime.cjs","sha256":"b71ab6eb651225e7b3737425d9788c7904a661a29305b942570ad6f99ec47af9"},{"path":"scripts/clinia-recovery-network.cjs","sha256":"982895d3fd325f6a00ae8d7cdf515f331d112dca1de187bf7aeae40fab764917"}];
const PRIVATE=path.join(ROOT,'.gate4-private/managed-a9');
const DOCKER=path.join(process.env.LOCALAPPDATA||'','Programs/DockerDesktop/resources/bin/docker.exe');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function noLinks(file){
 let p=path.resolve(file);
 for(;;){assert.ok(!fs.lstatSync(p).isSymbolicLink(),'Reparse/link refused');const parent=path.dirname(p);if(parent===p)break;p=parent;}
}
function validateSpec(s,c){
 assert.equal(hash(JSON.stringify(s)),hash(JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT,DIR,'managed-only.compose.proposed.json'))))),'Reviewed spec changed');
 assert.deepEqual(Object.keys(s.services).sort(),['auth','db','storage']);
 assert.equal(s.name,c.target);assert.equal(s.networks.local.internal,true);
 assert.deepEqual(s.networks.local.ipam.config,[{subnet:c.network.subnet}]);
 for(const[k,v]of Object.entries(s.services)){
  assert.deepEqual(v.ports,[]);assert.equal(v.privileged,false);assert.equal(v.pull_policy,'never');assert.equal(v.restart,'no');
  assert.equal(v.container_name,c.services[k].container);assert.equal(v.image,c.services[k].image);
  assert.equal(v.mem_limit,c.services[k].memoryBytes);assert.equal(v.memswap_limit,c.services[k].swapLimitBytes);
  for(const m of v.volumes||[])if(m.type==='bind'){assert.equal(m.read_only,true);assert.equal(path.win32.normalize(m.source),path.win32.join(c.privateArtifacts.directory,'db-pgsodium_root.key'));}
 }
 assert.equal(hash(JSON.stringify(s.services.db.command)),c.composeTemplate.sourceDbInitializationCommandSha256);
}
function loadPackage(){
 const contractFile=path.join(ROOT,DIR,'managed-only.contract.review.json'),specFile=path.join(ROOT,DIR,'managed-only.compose.proposed.json');
 for(const f of [contractFile,specFile])noLinks(f);
 assert.equal(hash(fs.readFileSync(contractFile)),CONTRACT_SHA);
 assert.equal(hash(fs.readFileSync(specFile)),COMPOSE_SHA);
 const contract=JSON.parse(fs.readFileSync(contractFile)),spec=JSON.parse(fs.readFileSync(specFile));
 assert.equal(contract.target,'clinia-gate3-20261020-a9');
 const dependencies=DEPENDENCIES.map(x=>x.path);
 for(const e of DEPENDENCIES){noLinks(path.join(ROOT,e.path));assert.equal(hash(fs.readFileSync(path.join(ROOT,e.path))),e.sha256,'Frozen dependency changed');}
 assert.equal(hash(fs.readFileSync(path.join(ROOT,'scripts/clinia-gate4-custody.ps1'))),CUSTODY_SHA);
 noLinks(path.join(ROOT,'scripts/clinia-gate4-m0-custody.ps1'));
 assert.equal(hash(fs.readFileSync(path.join(ROOT,'scripts/clinia-gate4-m0-custody.ps1'))),M0_CUSTODY_SHA);
 validateSpec(spec,contract);
 return {contract,spec,contractSha:CONTRACT_SHA,composeSha:COMPOSE_SHA,dependencies};
}
function requireApproval(mode,args){
 assert.ok(['dry-run','initialize'].includes(mode),'dry-run|initialize only');
 if(mode==='initialize'){
  assert.equal(args.approvedContractSha,CONTRACT_SHA,'Exact approved contract hash required');
  assert.match(args.authorizationRef||'',/^human:[A-Za-z0-9_.:-]{1,160}$/,'Human approval reference required; not authority by itself');
 }
 return {invocationMustHaveIndependentHumanApproval:true,reference:args.authorizationRef||null,flagsAreNotAuthorization:true};
}
function validateInventory(i,c){
 assert.equal(i.endpoint,'npipe:////./pipe/dockerDesktopLinuxEngine');
 for(const field of ['containers','volumes','networks'])assert.ok(!i[field].some(x=>x.includes(c.target)),'M0 target identity occupied');
 assert.equal(i.running.length,0,'Other running containers: exclusive start not admitted');
}
function checkNetwork(subnets,routes,c){
 const range=require('./clinia-recovery-network.cjs').range,chosen=range(c.network.subnet);
 for(const cidr of [...subnets,...routes.filter(x=>x!=='0.0.0.0/0')]){
  const r=range(cidr);assert.ok(chosen.end<r.start||r.end<chosen.start,'M0 subnet conflict');
 }
}
function admitMemory(available,c){
 assert.ok(Number.isSafeInteger(available)&&available>=c.capacity.minimumAvailableVmBytes,'Current MemAvailable below exact admission floor');
}
function instantiate(spec,m,c){
 assert.equal(m.project,c.target);assert.match(m.password,/^[a-f0-9]{64}$/);
 const uri=role=>'postgresql'+'://'+role+':'+m.password+'@supabase_db_'+c.target+':5432/postgres';
 const pairs=[['__AUTH_DATABASE_URI__',uri('supabase_auth_admin')],['__STORAGE_DATABASE_URI__',uri('supabase_storage_admin')],
 ['__PRIVATE_JWT_KEYS__',JSON.stringify([m.privateJwk])],['__PUBLIC_JWT_KEYS__',JSON.stringify(m.jwks)],
 ['__DATABASE_PASSWORD__',m.password],['__JWT_SECRET__',m.secret],['__ANON_JWT__',m.anon],['__SERVICE_JWT__',m.service]];
 const convert=v=>typeof v==='string'?pairs.reduce((s,[a,b])=>s.replaceAll(a,b),v):Array.isArray(v)?v.map(convert):
 v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,convert(x)])):v;
 const s=convert(spec);assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(s)));
 assert.deepEqual(s.services.db.command,spec.services.db.command);return s;
}
function validateMetadata(m,c){
 for(const k of ['database','user','sessionUser'])assert.equal(m[k],'postgres');
 assert.equal(m.version,c.expectedAfterInitialization.postgresVersionNum);assert.match(m.systemIdentifier,/^[0-9]{19}$/);
 assert.equal(m.postgresSuperuser,false);
 assert.equal(m.authMigrationRows,c.expectedAfterInitialization.authMigrationRows);
 assert.equal(m.storageMigrationRows,c.expectedAfterInitialization.storageMigrationRows);
 for(const k of ['authUsers','mfaFactors','buckets','objects','applicationRelations'])assert.equal(m[k],0,'Managed target not empty');
 assert.equal(m.applicationLedgerAbsent,true);
}
function assertExecutionHost(root,c,platform){
 assert.equal(platform,'win32','M0 execution requires reviewed Windows Desktop transport');
 assert.equal(path.win32.resolve(root,'.gate4-private/managed-a9'),path.win32.resolve(c.privateArtifacts.directory),'Own reviewed private location required');
}
function ownedStopCandidates(rows,spec,c){
 const ids=[];
 for(const r of rows){
  const item=Object.entries(spec.services).find(([,s])=>r.Name==='/'+s.container_name);assert.ok(item,'Unrelated cleanup candidate refused');
  const[k,s]=item;assert.equal(r.Image,s.image.split('@')[1]);
  assert.equal(r.Config.Labels['com.supabase.cli.project'],c.target);assert.equal(r.Config.Labels['clinia.service'],k);
  if(r.State.Running)ids.push(r.Id);
 }return ids;
}
function normalizedBind(value){
 let p=String(value).replaceAll('\\','/');
 for(const prefix of ['/run/desktop/mnt/host/','/host_mnt/'])if(p.startsWith(prefix))p=p.slice(prefix.length, prefix.length+1)+':/'+p.slice(prefix.length+2);
 return p.toLowerCase();
}
function validateContainers(rows,spec,c){
 assert.equal(rows.length,3);
 const selected=[];
 for(const[k,s]of Object.entries(spec.services)){
  const r=rows.find(v=>v.Name==='/'+s.container_name);assert.ok(r,'Exact owned container missing');
  assert.equal(r.Config.Labels['com.supabase.cli.project'],c.target);assert.equal(r.Config.Labels['clinia.service'],k);
  assert.equal(r.Image,s.image.split('@')[1]);assert.equal(r.State.Status,'running');assert.equal(r.State.OOMKilled,false);
  if(s.healthcheck)assert.equal(r.State.Health?.Status,'healthy');
  assert.equal(r.HostConfig.Privileged,false);assert.equal(r.HostConfig.Memory,s.mem_limit);
  assert.equal(r.HostConfig.MemorySwap,s.memswap_limit);assert.equal(r.HostConfig.PidsLimit,s.pids_limit);
  assert.equal(r.HostConfig.NanoCpus,s.cpus*1e9);
  assert.deepEqual(Object.keys(r.NetworkSettings.Networks),[c.network.name]);
  assert.ok(Object.values(r.NetworkSettings.Ports||{}).every(v=>!v||v.length===0),'Published port refused');
  assert.equal(r.Mounts.length,(s.volumes||[]).length);
  for(const v of s.volumes||[]){
   const mount=r.Mounts.find(m=>m.Destination===v.target);assert.ok(mount);assert.equal(mount.Type,v.type);assert.equal(mount.RW,!v.read_only);
   if(v.type==='volume')assert.equal(mount.Name,v.source);
   else assert.equal(normalizedBind(mount.Source),normalizedBind(v.source));
  }
  selected.push({service:k,name:r.Name,id:r.Id,image:r.Image,healthy:r.State.Health?.Status||null,publishedPorts:[],network:c.network.name,
   mounts:r.Mounts.map(m=>({type:m.Type,name:m.Name||null,destination:m.Destination,readOnly:!m.RW}))});
 }
 return selected;
}
function runSequence(f,journal){
 let submitted=false;
 try{
  journal('PRIVATE_PREPARATION_INTENT');f.prepare();
  journal('DB_START_SUBMITTED_OUTCOME_UNDETERMINED');submitted=true;f.upDb();
  journal('NATIVE_AUTH_STORAGE_START_SUBMITTED_OUTCOME_UNDETERMINED');f.upManaged();
  journal('ACTUAL_METADATA_VERIFICATION');const result=f.verify();
  journal('M0_EMPTY_MANAGED_COMPLETE_AWAIT_NEW_SCOPE');return result;
 }catch(e){
  if(submitted)try{f.stopOwned();}catch{e.cleanupRequiresOperator=true;}
  journal('FAILED_PRESERVE_NO_RETRY');throw e;
 }
}
const METADATA_SQL="BEGIN READ ONLY;SET LOCAL statement_timeout='15s';SELECT jsonb_build_object('database',current_database(),'user',current_user,'sessionUser',session_user,'version',current_setting('server_version_num'),'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),'postgresSuperuser',(SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),'authMigrationRows',(SELECT count(*) FROM auth.schema_migrations),'storageMigrationRows',(SELECT count(*) FROM storage.migrations),'authUsers',(SELECT count(*) FROM auth.users),'mfaFactors',(SELECT count(*) FROM auth.mfa_factors),'buckets',(SELECT count(*) FROM storage.buckets),'objects',(SELECT count(*) FROM storage.objects),'applicationRelations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S','f')),'applicationLedgerAbsent',to_regclass('supabase_migrations.schema_migrations') IS NULL);ROLLBACK;";
function assertDockerMode(mode,a,c){
 assert.ok(['dry-run','initialize'].includes(mode));
 if(mode==='initialize')return {readOnlyEnforced:false};
 const read=(a[0]==='ps')||(['volume','network','image','context'].includes(a[0])&&
  ((a[0]==='volume'&&a[1]==='ls')||(a[0]==='network'&&['ls','inspect'].includes(a[1]))||
   (a[0]==='image'&&a[1]==='inspect')||(a[0]==='context'&&a[1]==='inspect')));
 const config=a.length===7&&a[0]==='compose'&&a[1]==='-p'&&a[2]===c.target&&a[3]==='-f'&&
  path.resolve(a[4])===path.join(ROOT,DIR,'managed-only.compose.proposed.json')&&a[5]==='config'&&a[6]==='--quiet';
 assert.ok(read||config,'Dry-run Docker mutation/unknown command refused');return {readOnlyEnforced:true};
}
function main(argv){
 const mode=argv.shift(),args={};
 for(let n=0;n<argv.length;n+=2){const key={'--receipt':'receipt','--approved-contract-sha':'approvedContractSha','--authorization-ref':'authorizationRef'}[argv[n]];
  assert.ok(key&&argv[n+1]&&!Object.hasOwn(args,key),'Unknown or duplicate CLI argument');args[key]=argv[n+1];}
 const approval=requireApproval(mode,args);
 assert.match(args.receipt||'',/^[a-z0-9-]+\.json$/,'New public receipt basename required');
 const p=loadPackage(),c=p.contract,s=p.spec;
 assertExecutionHost(ROOT,c,process.platform);
 assert.ok(fs.existsSync(OUT));noLinks(OUT);
 const receiptFile=path.join(OUT,args.receipt),fd=fs.openSync(receiptFile,'wx');
 const report={gate:'Gate4',phase:'M0_EMPTY_MANAGED_ONLY',mode,startedAt:new Date().toISOString(),
 target:c.target,contractSha256:p.contractSha,composeTemplateSha256:p.composeSha,approval,
 state:'PREFLIGHT',managedStackStarts:0,ephemeralProbeRuns:0,applicationSql:0,m7:false,upgrade:false,open:false,restore:false,
 credentialsCreated:false,privateDirectoryCreated:false,leaseAllocated:false,recoveryRtoSeconds:null,currentSourceRpoSeconds:null};
 let privateReady=false,privateComposeHash=null,diagnostic=0;
 const start=performance.now();
 const persist=()=>{fs.ftruncateSync(fd,0);fs.writeSync(fd,JSON.stringify(report,null,2)+'\n',0,'utf8');fs.fsyncSync(fd);};
 const stage=code=>{if(code==='FAILED_PRESERVE_NO_RETRY')report.failedAtStage=report.state;report.state=code;persist();};
 function native(a,input,allowFail=false){
  const guard=assertDockerMode(mode,a,c);
  (report.dockerDispatches||=[]).push({group:a[0],operation:a[0]==='compose'?a[5]:(a[1]||'list'),...guard});
  const r=cp.spawnSync(DOCKER,['--context','desktop-linux',...a],{cwd:ROOT,input,encoding:'utf8',windowsHide:true,timeout:a[0]==='compose'?220000:30000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0){
   if(privateReady)fs.writeFileSync(path.join(PRIVATE,'m0-diagnostic-'+(++diagnostic)+'.private.log'),r.stderr||String(r.error?.code||r.status),{flag:'wx'});
   if(!allowFail)throw Error('M0_DOCKER_OPERATION_REFUSED');
  }
  return {status:r.status,stdout:(r.stdout||'').trim()};
 }
 const read=a=>native(a).stdout;
 function custody(action){
  if(mode==='dry-run')assert.equal(action,'AssertAbsent','Dry-run private creation refused');
  (report.custodyActions||=[]).push(action);
  const a=['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(ROOT,'scripts/clinia-gate4-m0-custody.ps1'),'-Action',action];
  if(action==='Create')a.push('-ApprovedContractSha',p.contractSha,'-AuthorizationReference',args.authorizationRef);
  const r=cp.spawnSync('pwsh',a,{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:32768});
  assert.equal(r.status,0,'M0 custody boundary refused');return JSON.parse(r.stdout);
 }
 function inventory(){
  const endpoint=read(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']);
  const lines=read(['ps','-a','--format','{{.Names}}|{{.State}}']).split('\n').filter(Boolean);
  const ids=read(['network','ls','--format','{{.ID}}']).split('\n').filter(Boolean);
  const nets=ids.length?JSON.parse(read(['network','inspect',...ids])):[];
  const i={endpoint,containers:lines.map(x=>x.split('|')[0]),running:lines.filter(x=>x.endsWith('|running')).map(x=>x.split('|')[0]),
   volumes:read(['volume','ls','--format','{{.Name}}']).split('\n').filter(Boolean),networks:nets.map(n=>n.Name)};
  validateInventory(i,c);
  const routes=cp.spawnSync('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',
   '@(Get-NetRoute -AddressFamily IPv4 | Select-Object -ExpandProperty DestinationPrefix -Unique) | ConvertTo-Json -Compress'],
   {encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1048576});assert.equal(routes.status,0);
  const subnets=nets.flatMap(n=>(n.IPAM?.Config||[]).map(x=>x.Subnet).filter(x=>x&&x.includes('.'))),hostRoutes=JSON.parse(routes.stdout);
  assert.ok(Array.isArray(hostRoutes));checkNetwork(subnets,hostRoutes,c);
  const images=Object.entries(s.services).map(([service,v])=>{const id=read(['image','inspect',v.image,'--format','{{.Id}}']);assert.equal(id,v.image.split('@')[1]);return {service,reference:v.image,id};});
  return {i,summary:{endpointLocal:true,targetAbsent:true,otherRunningContainers:0,networkConflicts:0,images,
   routeInventorySha256:hash(JSON.stringify({subnets,hostRoutes}))}};
 }
 function verifyPrivateCompose(){assert.ok(privateComposeHash);assert.equal(hash(fs.readFileSync(path.join(PRIVATE,'runtime.compose.json'))),privateComposeHash);}
 function compose(a){verifyPrivateCompose();return native(['compose','-p',c.target,'-f',path.join(PRIVATE,'runtime.compose.json'),...a]);}
 function stopOwned(){
  const names=read(['ps','-a','--format','{{.Names}}']).split('\n').filter(Boolean);
  const wanted=Object.values(s.services).map(v=>v.container_name).filter(n=>names.includes(n));
  const rows=wanted.length?JSON.parse(read(['inspect',...wanted])):[];
  const ids=ownedStopCandidates(rows,s,c);
  if(ids.length){native(['stop','--time','20',...ids]);const stopped=JSON.parse(read(['inspect',...ids]));assert.ok(stopped.every(r=>r.State.Running===false));}
  report.cleanup={ownedContainersStopped:ids.length,verifiedStopped:true,volumeDeletionCommands:0,failedTargetPreserved:true};
 }

 try{
  persist();
  assert.equal(cp.spawnSync('git',['branch','--show-current'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),'codex/gate4-recovery-ops');
  assert.ok(!fs.existsSync(PRIVATE),'Never reuse a private target directory');
  report.custody=custody('AssertAbsent');const before=inventory();report.preflight=before.summary;
  const config=native(['compose','-p',c.target,'-f',path.join(ROOT,DIR,'managed-only.compose.proposed.json'),'config','--quiet']);
  assert.equal(config.status,0);
  if(mode==='dry-run'){
   report.state='PASS_DRY_RUN_READ_ONLY_DISPATCH_NO_MANAGED_INITIALIZATION';
   report.liveMemoryAdmissionVerified=false;report.liveMemoryRequiredBeforeInitialize=c.capacity.minimumAvailableVmBytes;
   report.frozenDependencies=p.dependencies;report.actualManagedIdentity=null;
   report.wouldExecute=['fresh live MemAvailable probe','atomic restricted private directory and fresh signingMaterial',
    'private config --quiet','cached-image DB up --wait','cached-image auth/storage up --no-deps --wait',
    'effective Docker identity checks','fixed READ ONLY empty-managed SQL','retain Gate4 lease; no app SQL'];
  }else{
   const probe='clinia-gate4-a9-m0-memory-probe';
   assert.ok(!before.i.containers.includes(probe));
   const image=s.services.db.image,declared=JSON.parse(read(['image','inspect',image,'--format','{{json .Config.Volumes}}']))||{};
   stage('READ_ONLY_MEMORY_PROBE_SUBMITTED');
   let mem;
   try{
    report.ephemeralProbeRuns=1;
    mem=read(['run','--rm','--pull','never','--name',probe,'--label','clinia.m0.probe='+c.target,'--network','none','--read-only',
     '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','8','--memory','16m','--memory-swap','16m','--cpus','0.25',
     ...Object.keys(declared).flatMap(v=>['--tmpfs',v+':rw,noexec,nosuid,size=65536']),'--entrypoint','cat',image,'/proc/meminfo']);
   }catch(e){
    try{
     const names=read(['ps','-a','--format','{{.Names}}']).split('\n').filter(Boolean);
     if(names.includes(probe)){const row=JSON.parse(read(['inspect',probe]))[0];
      assert.equal(row.Config.Labels['clinia.m0.probe'],c.target);assert.equal(row.Image,image.split('@')[1]);
      if(row.State.Running)native(['stop','--time','5',row.Id]);}
    }catch{e.cleanupRequiresOperator=true;}
    throw e;
   }
   const available=Number(mem.match(/^MemAvailable:\s+(\d+) kB/m)?.[1])*1024;admitMemory(available,c);
   report.memory={availableVmBytes:available,minimum:c.capacity.minimumAvailableVmBytes,liveAdmissionVerified:true};
   const current=inventory();assert.deepEqual([...current.i.volumes].sort(),[...before.i.volumes].sort(),'Probe changed persistent volume inventory');
   const metadata=runSequence({
    prepare:()=>{
     report.custody=custody('Create');privateReady=true;report.privateDirectoryCreated=true;
     const lease={state:'M0_INITIALIZING_GATE4_ONLY',target:c.target,contractSha256:p.contractSha,authorizationReference:args.authorizationRef,startedAt:report.startedAt};
     fs.writeFileSync(path.join(PRIVATE,'writer-lease.json'),JSON.stringify(lease),{flag:'wx'});report.leaseAllocated=true;
     const material=require('./prepare-clinia-clean-managed.cjs').signingMaterial({project:c.target});report.secretMaterialGenerated=true;
     const instantiated=instantiate(s,material,c);
     fs.writeFileSync(path.join(PRIVATE,'credentials.private.json'),JSON.stringify(material),{flag:'wx'});report.credentialsCreated=true;
     fs.writeFileSync(path.join(PRIVATE,'db-pgsodium_root.key'),material.sodium,{flag:'wx'});
     fs.writeFileSync(path.join(PRIVATE,'runtime.compose.json'),JSON.stringify(instantiated,null,2),{flag:'wx'});
     privateComposeHash=hash(fs.readFileSync(path.join(PRIVATE,'runtime.compose.json')));
     report.privateComposeSha256=privateComposeHash;compose(['config','--quiet']);
    },
    upDb:()=>{report.managedStackStarts=1;compose(['up','-d','--pull','never','--wait','--wait-timeout','180','db']);},
    upManaged:()=>compose(['up','-d','--no-deps','--pull','never','--wait','--wait-timeout','180','auth','storage']),
    verify:()=>{
     const rows=JSON.parse(read(['inspect',...Object.values(s.services).map(v=>v.container_name)]));
     report.containers=validateContainers(rows,s,c);
     const network=JSON.parse(read(['network','inspect',c.network.name]))[0];assert.equal(network.Internal,true);
     assert.deepEqual(network.IPAM.Config.map(v=>v.Subnet),[c.network.subnet]);
     const m=JSON.parse(native(['exec','-i','--user','postgres',s.services.db.container_name,
      'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/dev/stdin'],METADATA_SQL).stdout);
     report.actualManagedMetadataObserved=m;validateMetadata(m,c);return m;
    },stopOwned
   },stage);
   report.actualManagedIdentity=metadata;report.state='PASS_M0_EMPTY_MANAGED_INITIALIZATION_NO_APP_SCOPE';
   const lease=JSON.parse(fs.readFileSync(path.join(PRIVATE,'writer-lease.json')));lease.state='M0_COMPLETE_GATE4_OWNER_AWAIT_SEPARATE_SCOPE';
   fs.writeFileSync(path.join(PRIVATE,'writer-lease.json'),JSON.stringify(lease));
   report.writer='Gate4 only; no application write authorization transferred';
  }
 }catch(e){
  report.failedAtStage||=report.state;report.state='FAIL_M0_PRESERVE_NO_RETRY';report.safeError=e.code||e.name;report.cleanupRequiresOperator=e.cleanupRequiresOperator===true;
  report.privateDirectoryExists=fs.existsSync(PRIVATE);
  report.privateFilesPresent=['credentials.private.json','db-pgsodium_root.key','runtime.compose.json','writer-lease.json'].filter(n=>fs.existsSync(path.join(PRIVATE,n)));
  report.operatorAction='Preserve receipt/private files/volumes. Inspect failed stage and private diagnostics. Reconcile read-only after transport failure; no retry or application phase.';
  if(privateReady)try{fs.writeFileSync(path.join(PRIVATE,'m0-failure-'+(++diagnostic)+'.private.log'),e.stack||e.name,{flag:'wx'});}catch{report.privateDiagnosticWriteFailed=true;}
  if(privateReady)try{
   const leaseFile=path.join(PRIVATE,'writer-lease.json');
   if(fs.existsSync(leaseFile)){const lease=JSON.parse(fs.readFileSync(leaseFile));lease.state='FAILED_PRESERVED_NO_RETRY';fs.writeFileSync(leaseFile,JSON.stringify(lease));}
  }catch{report.leaseRecordRequiresOperator=true;}
  process.exitCode=1;
 }finally{
  report.completedAt=new Date().toISOString();report.m0OrDryRunElapsedSeconds=Number(((performance.now()-start)/1000).toFixed(3));
  report.elapsedScope='This invocation only; never operational recoveryRTO/currentRPO';
  persist();fs.closeSync(fd);
  console.log(JSON.stringify({state:report.state,mode,target:c.target,receipt:receiptFile,managedStackStarts:report.managedStackStarts,
   credentialsCreated:report.credentialsCreated,leaseAllocated:report.leaseAllocated,safeError:report.safeError||null}));
 }
}
if(require.main===module){try{main(process.argv.slice(2));}catch{console.error('M0_ARGUMENT_OR_PIN_REFUSAL_NO_ACTION');process.exitCode=1;}}
module.exports={hash,loadPackage,requireApproval,validateInventory,checkNetwork,admitMemory,validateSpec,instantiate,validateMetadata,validateContainers,runSequence,assertExecutionHost,ownedStopCandidates,assertDockerMode};
