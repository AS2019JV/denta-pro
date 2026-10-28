'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),ORIGINAL_ROOT='C:/Users/aleja/.codex/worktrees/clinia-gate4-recovery/denta-pro';
const DIR='docs/production/gate4-recovery-ops/m1-transport-2026-10-27';
const MAIN='docs/production/gate4-recovery-ops/m1-baseline-2026-10-26/10-baseline.proposed.sql';
const MAIN_SHA='f9195bac42cc0413af5e3b8f77ebe1793817e66e114d81c13bc1de83a7cada6a';
const M0_SHA='5fafb08d8170c9e8dea3026423e47229f5cf460dce56ebbe5bdc1b9154680f13';
const STORAGE_SCAN="const fs=require('node:fs'),q=[['/mnt',0]],r={files:0,bytes:0,links:0,other:0};let n=0;while(q.length){const [p,d]=q.pop();if(++n>1000||d>16)throw Error('M1_STORAGE_METADATA_BOUND');const s=fs.lstatSync(p);if(s.isSymbolicLink()){r.links++;continue;}if(s.isDirectory()){const dir=fs.opendirSync(p,{bufferSize:32});try{let e;while((e=dir.readSync())){if(n+q.length>=1000)throw Error('M1_STORAGE_METADATA_BOUND');q.push([p+'/'+e.name,d+1]);}}finally{dir.closeSync();}}else if(s.isFile()){r.files++;r.bytes+=s.size;}else r.other++;}console.log(JSON.stringify(r));";
const LIMIT={input:1048576,output:1048576,readMs:45000,writeMs:180000,admissionMs:60000};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function need(ok,code){if(!ok){const e=Error(code);e.code=code;throw e;}}
function safeRead(relative){
 need(typeof relative==='string'&&!relative.includes('..')&&!path.isAbsolute(relative),'M1_PATH_REFUSED');
 const file=path.join(ROOT,relative);let at=file;
 for(;;){need(!fs.lstatSync(at).isSymbolicLink(),'M1_LINK_REFUSED');const up=path.dirname(at);if(up===at)break;at=up;}
 return fs.readFileSync(file);
}
function loadPackage(){
 const raw=safeRead(DIR+'/contract.v4.json'),contract=JSON.parse(raw);
 need(contract.revision===4&&contract.target.systemIdentifier==='7701080397606109221','M1_CONTRACT_REFUSED');
 need(hash(safeRead('scripts/clinia-gate4-managed-m0.cjs'))===M0_SHA,'M1_M0_SOURCE_DRIFT');
 for(const x of contract.code)need(hash(safeRead(x.path))===x.sha256,'M1_CODE_PIN_REFUSED');
 const buffers={};for(const[k,x]of Object.entries(contract.payloads)){buffers[k]=safeRead(x.path);need(hash(buffers[k])===x.sha256,'M1_SQL_PIN_REFUSED');}
 const m0=require('./clinia-gate4-managed-m0.cjs').loadPackage();
 return {contract,contractSha:hash(raw),contractCanonical:JSON.stringify(contract),buffers,m0};
}
function validatePackage(p){
 need(JSON.stringify(p.contract)===p.contractCanonical,'M1_CONTRACT_MUTATED');
 const c=p.contract,t=c.target;
 need(c.revision===4&&t.project==='clinia-gate3-20261020-a9'&&t.database==='postgres'&&t.role==='postgres'&&t.version==='170011'&&t.systemIdentifier==='7701080397606109221','M1_TARGET_REFUSED');
 need(c.endpoint==='npipe:////./pipe/dockerDesktopLinuxEngine','M1_ENDPOINT_REFUSED');
 need(c.payloads.main.path===MAIN&&c.payloads.main.sha256===MAIN_SHA,'M1_BASELINE_REFUSED');
 need(c.payloads.pre.path===DIR+'/00-admission.sql'&&c.payloads.post.path===DIR+'/20-postcheck.sql','M1_PAYLOAD_PATH_REFUSED');
 need(Object.keys(c.payloads).sort().join(',')==='main,post,pre','M1_PAYLOAD_SET_REFUSED');
 for(const[k,x]of Object.entries(c.payloads))need(Buffer.isBuffer(p.buffers[k])&&p.buffers[k].length<=LIMIT.input&&hash(p.buffers[k])===x.sha256,'M1_INPUT_PIN_REFUSED');
}
function approval(p,a){
 need(a&&a.contractSha===p.contractSha&&/^[a-f0-9]{64}$/.test(a.contractSha),'M1_APPROVED_HASH_REQUIRED');
 need(/^human:[A-Za-z0-9_.:-]{1,160}$/.test(a.authorizationRef||'')&&a.authorizationRef.includes('M1'),'M1_HUMAN_SCOPE_REQUIRED');
 need(/^M1-[A-Z0-9-]{1,60}$/.test(a.turn||''),'M1_TURN_REQUIRED');
}
function host(h){
 const v=String(h.node).split('.').map(Number);
 need(h.platform==='win32'&&h.root.replaceAll('\\','/')===ORIGINAL_ROOT&&h.branch==='codex/gate4-recovery-ops','M1_NATIVE_CONTEXT_REFUSED');
 need(v[0]===22&&v[1]>=20,'M1_NODE22_REQUIRED');
}
function inventory(x,p){
 const c=p.contract;
 need(x.endpoint===c.endpoint,'M1_REMOTE_CONTEXT_REFUSED');
 const m=require('./clinia-gate4-managed-m0.cjs');
 m.validateContainers(x.containers,p.m0.spec,p.m0.contract);
 const names=Object.values(p.m0.spec.services).map(v=>v.container_name).sort();
 assert.deepEqual([...x.targetNames].sort(),names);
 for(const[k,v]of Object.entries(c.containers)){
  const row=x.containers.find(r=>r.Name==='/'+p.m0.spec.services[k].container_name);
  need(row.Id===v.id&&row.State.Running===true&&row.HostConfig.RestartPolicy.Name==='no','M1_PHYSICAL_IDENTITY_REFUSED');
  need(Object.keys(row.HostConfig.PortBindings||{}).length===0,'M1_CONFIGURED_PORT_REFUSED');
 }
 need(x.network.Id===c.network.id&&x.network.Name===c.network.name&&x.network.Internal===true,'M1_NETWORK_REFUSED');
 assert.deepEqual(x.network.IPAM.Config.map(v=>v.Subnet),['10.253.9.0/24']);
 assert.deepEqual(Object.keys(x.network.Containers).sort(),Object.values(c.containers).map(v=>v.id).sort());
 assert.deepEqual([...x.volumes].sort((a,b)=>a.name.localeCompare(b.name)),[...c.volumes].sort((a,b)=>a.name.localeCompare(b.name)));
}
const INSPECT_FORMAT='{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Image}},"Config":{"Labels":{"com.supabase.cli.project":{{json (index .Config.Labels "com.supabase.cli.project")}},"clinia.service":{{json (index .Config.Labels "clinia.service")}}}},"State":{"Status":{{json .State.Status}},"Running":{{json .State.Running}},"OOMKilled":{{json .State.OOMKilled}},"Health":{"Status":{{json .State.Health.Status}}}},"HostConfig":{"Privileged":{{json .HostConfig.Privileged}},"Memory":{{json .HostConfig.Memory}},"MemorySwap":{{json .HostConfig.MemorySwap}},"PidsLimit":{{json .HostConfig.PidsLimit}},"NanoCpus":{{json .HostConfig.NanoCpus}},"PortBindings":{{json .HostConfig.PortBindings}},"RestartPolicy":{"Name":{{json .HostConfig.RestartPolicy.Name}}}},"NetworkSettings":{"Networks":{{json .NetworkSettings.Networks}},"Ports":{{json .NetworkSettings.Ports}}},"Mounts":{{json .Mounts}}}';
function physical(x,p){
 inventory(x,p);assert.deepEqual(x.storageBytes,{files:0,bytes:0,links:0,other:0});
}
function inspectWithRead(p,read){
 const c=p.contract,names=Object.values(p.m0.spec.services).map(v=>v.container_name);
 function collect(){
  const endpoint=read(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']);
  need(endpoint===c.endpoint&&endpoint==='npipe:////./pipe/dockerDesktopLinuxEngine','M1_REMOTE_CONTEXT_REFUSED');
  const x={endpoint,
   containers:read(['inspect','--format',INSPECT_FORMAT,...names]).split(/\r?\n/).map(v=>JSON.parse(v)),
   network:JSON.parse(read(['network','inspect',c.network.name,'--format','{"Id":{{json .Id}},"Name":{{json .Name}},"Internal":{{json .Internal}},"IPAM":{{json .IPAM}},"Containers":{{json .Containers}}}'])),
   volumes:read(['volume','inspect',...c.volumes.map(v=>v.name),'--format','{"name":{{json .Name}},"createdAt":{{json .CreatedAt}},"driver":{{json .Driver}}}']).split(/\r?\n/).map(v=>JSON.parse(v)),
   targetNames:read(['ps','-a','--format','{{.Names}}']).split(/\r?\n/).filter(v=>v.includes(c.target.project))};
  inventory(x,p);return x;
 }
 collect(); // Complete local physical admission precedes the first exec.
 const storageBytes=JSON.parse(read(['exec',c.containers.storage.id,'node','--max-old-space-size=16','-e',STORAGE_SCAN]));
 const after={...collect(),storageBytes}; // Recheck context and complete physical state after scan.
 physical(after,p);return after;
}
function readMetadata(result){
 need(result&&!result.error&&!result.signal&&result.status===0,'M1_READ_REFUSED');
 need(Buffer.isBuffer(result.stdout)&&result.stdout.length<=LIMIT.output,'M1_OUTPUT_BOUND_REFUSED');
 const rows=result.stdout.toString('utf8').split(/\r?\n/).filter(v=>v.startsWith('M1_META:'));
 need(rows.length===1,'M1_METADATA_PROTOCOL_REFUSED');
 return JSON.parse(rows[0].slice(8));
}
function metadata(m,stage){
 need(m&&m.identity&&m.authority&&m.managed&&m.native&&m.counts&&m.clientUsage,'M1_METADATA_SHAPE_REFUSED');
 assert.deepEqual(Object.keys(m).sort(),['identity','authority','managed','native','counts','applicationRelations','clientUsage'].sort());
 const i=m.identity;
 assert.deepEqual(i,{database:'postgres',user:'postgres',sessionUser:'postgres',version:'170011',systemIdentifier:'7701080397606109221',superuser:false});
 need(m.authority.storagePolicyOwner===true&&m.authority.publicCreate===true&&m.authority.authTrigger===true,'M1_EXISTING_OWNER_AUTHORITY_REQUIRED');
 assert.deepEqual(Object.keys(m.authority).sort(),['authTrigger','publicCreate','storagePolicyOwner']);
 assert.deepEqual(m.native,{auth:82,storage:74,ledgerAbsent:true});
 assert.deepEqual(m.counts,{users:0,mfa:0,buckets:0,objects:0});
 need(m.applicationRelations===(stage==='pre'?0:31),'M1_EMPTY_BASELINE_SCOPE_REFUSED');
 need(Array.isArray(m.managed.schemas)&&m.managed.schemas.length===2&&Array.isArray(m.managed.relations)&&m.managed.relations.length===2,'M1_MANAGED_METADATA_REQUIRED');
 assert.deepEqual(Object.keys(m.managed).sort(),['relations','schemas']);
 assert.deepEqual(m.managed.schemas.map(v=>v.name),['auth','storage']);
 assert.deepEqual(m.managed.relations.map(v=>v.schema+'.'+v.name),['auth.users','storage.objects']);
 for(const s of m.managed.schemas){
  assert.deepEqual(Object.keys(s).sort(),['name','oid','ownerOID','owner','acl'].sort());
  need(Number.isSafeInteger(s.oid)&&Number.isSafeInteger(s.ownerOID)&&typeof s.owner==='string'&&(s.acl===null||typeof s.acl==='string'),'M1_SCHEMA_METADATA_REFUSED');
 }
 for(const r of m.managed.relations){
  assert.deepEqual(Object.keys(r).sort(),['schema','name','oid','ownerOID','owner','acl','rls','forceRls','columns'].sort());
  need(Number.isSafeInteger(r.oid)&&Number.isSafeInteger(r.ownerOID)&&typeof r.owner==='string'&&(r.acl===null||typeof r.acl==='string')&&typeof r.rls==='boolean'&&typeof r.forceRls==='boolean'&&Array.isArray(r.columns)&&r.columns.length>0,'M1_RELATION_METADATA_REFUSED');
  for(const a of r.columns){assert.deepEqual(Object.keys(a).sort(),['acl','name','num']);need(typeof a.name==='string'&&Number.isSafeInteger(a.num)&&(a.acl===null||typeof a.acl==='string'),'M1_COLUMN_ACL_REFUSED');}
 }
 assert.deepEqual(Object.keys(m.clientUsage).sort(),['anon','authenticated','service_role']);
 for(const v of Object.values(m.clientUsage))need(typeof v==='boolean','M1_USAGE_SHAPE_REFUSED');
 if(stage==='post')need(Object.values(m.clientUsage).every(v=>v===false),'M1_CLOSED_PUBLIC_SCOPE_REQUIRED');
}
function outcome(r){
 if(!r||r.error||r.signal||!Buffer.isBuffer(r.stdout)||r.stdout.length>LIMIT.output)return 'DISPATCH_UNKNOWN';
 const lines=r.stdout.toString('utf8').split(/\r?\n/).map(v=>v.trim()).filter(Boolean),hasCommit=lines.includes('COMMIT');
 const error=Buffer.isBuffer(r.stderr)&&r.stderr.toString('utf8').match(/ERROR:\s+([0-9A-Z]{5}):/);
 if(r.stderr&&(!Buffer.isBuffer(r.stderr)||r.stderr.length>LIMIT.output))return 'DISPATCH_UNKNOWN';
 if(r.status===0&&lines.at(-1)==='COMMIT'&&!error)return 'COMMIT_ACKNOWLEDGED';
 return r.status===3&&!hasCommit&&error?'ABORTED_PRECOMMIT':'DISPATCH_UNKNOWN';
}
function request(p,kind,input){
 need(['pre','main','post'].includes(kind),'M1_REQUEST_KIND_REFUSED');
 need(Buffer.isBuffer(input)&&input.length<=LIMIT.input&&hash(input)===p.contract.payloads[kind].sha256,'M1_EXACT_BUFFER_REQUIRED');
 const args=['--context','desktop-linux','exec','-i','--user','postgres',p.contract.containers.db.id,'psql','-X',kind==='main'?'-At':'-qAt',
 '-v','ON_ERROR_STOP=1','-v','ON_ERROR_ROLLBACK=off','-v','VERBOSITY=verbose','-h','/var/run/postgresql','-p','5432','-U','postgres','-d','postgres','-f','/dev/stdin'];
 return {args,input:Buffer.from(input),options:{shell:false,windowsHide:true,timeout:kind==='main'?LIMIT.writeMs:LIMIT.readMs,maxBuffer:LIMIT.output}};
}
function run(p,a,io){
 const r={gate:'Gate4',phase:'M1_BASELINE_ONLY',state:'ADMISSION',writeDispatches:0,commitAcknowledged:false,writerActive:false,resourcesPreserved:true,rollbackInversePerformed:false,ordinaryAccessProven:false};
 let lease=false,submitted=false;
 const mark=s=>{r.state=s;if(io.journal)io.journal(r);};
 try{
  validatePackage(p);approval(p,a);host(io.host());
  const admittedAt=io.now(),custody=io.custody();
  need(custody.valid===true&&custody.leaseState==='M0_COMPLETE_GATE4_OWNER_AWAIT_SEPARATE_SCOPE','M1_CUSTODY_REFUSED');
  physical(io.inspect(),p);
  const before=readMetadata(io.query('pre',Buffer.from(p.buffers.pre)));metadata(before,'pre');r.managedBefore=before.managed;r.authorityBefore=before.authority;
  io.acquire({turn:a.turn,authorizationRef:a.authorizationRef,contractSha:p.contractSha});lease=true;
  physical(io.inspect(),p); // Fresh complete admission after precheck/acquire and before sealed intent.
  validatePackage(p);need(io.now()-admittedAt<=LIMIT.admissionMs&&io.now()>=admittedAt,'M1_STALE_ADMISSION');
  mark('SEALED_BASELINE_DISPATCH_INTENT');
  submitted=true;r.writeDispatches=1;r.writerActive=true;
  const result=io.dispatch(Buffer.from(p.buffers.main)),state=outcome(result);
  if(state!=='COMMIT_ACKNOWLEDGED'){r.state=state;return r;}
  r.commitAcknowledged=true;mark('COMMITTED_AWAITING_POSTCHECK');
  const after=readMetadata(io.query('post',Buffer.from(p.buffers.post)));metadata(after,'post');
  r.managedAfter=after.managed;r.authorityAfter=after.authority;
  assert.deepEqual(after.managed,before.managed);assert.deepEqual(after.authority,before.authority);
  physical(io.inspect(),p);mark('COMMITTED_VERIFIED');
 }catch(e){
  r.state=r.commitAcknowledged?'COMMITTED_POSTCHECK_FAILED':submitted?'DISPATCH_UNKNOWN':'ADMISSION_REFUSED';
  if(e.operatorRequired)r.operatorRequired=true;
  r.errorCode=/^[A-Z0-9_]{1,90}$/.test(e.code||'')?e.code:'M1_GUARD_OR_DRIVER_REFUSAL';
 }finally{
  r.writerActive=false;r.reconciliationRequired=['DISPATCH_UNKNOWN','COMMITTED_POSTCHECK_FAILED'].includes(r.state);
  if(lease)try{io.finish(r);}catch{r.operatorRequired=true;}
  try{if(io.journal)io.journal(r);}catch{r.operatorRequired=true;}
 }
 return r;
}
function persistRecord(io,fd,value){const text=JSON.stringify(value);io.ftruncateSync(fd,0);io.writeSync(fd,text,0,'utf8');io.fsyncSync(fd);}
function nativeDriver(p,journal){
 const docker=path.join(process.env.LOCALAPPDATA||'','Programs/DockerDesktop/resources/bin/docker.exe');
 const git='C:/Users/aleja/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
 const privateDir=path.join(ROOT,'.gate4-private/managed-a9');let fd,dispatches=0;
 const raw=a=>{const r=cp.spawnSync(docker,['--context','desktop-linux',...a],{cwd:ROOT,shell:false,windowsHide:true,timeout:30000,maxBuffer:LIMIT.output});need(!r.error&&!r.signal&&r.status===0,'M1_INSPECT_FAILED');return r.stdout.toString('utf8').trim();};
 const sql=(kind,b)=>{const q=request(p,kind,b);const r=cp.spawnSync(docker,q.args,{cwd:ROOT,...q.options,input:q.input});
  if(r.error||r.signal||r.status!==0)try{fs.writeFileSync(path.join(privateDir,'m1-'+kind+'-diagnostic.private.log'),Buffer.isBuffer(r.stderr)?r.stderr.subarray(0,65536):String(r.error?.code||'DRIVER_FAILURE'),{flag:'wx'});}catch{}
  return {status:r.status,error:r.error?{code:r.error.code}:null,signal:r.signal,stdout:r.stdout,stderr:r.stderr};
 };
 return {now:()=>Date.now(),journal,
  host:()=>{const g=cp.spawnSync(git,['branch','--show-current'],{cwd:ROOT,encoding:'utf8',shell:false,windowsHide:true,timeout:15000});need(g.status===0,'M1_BRANCH_READ_FAILED');return {platform:process.platform,root:ROOT.replaceAll('\\','/'),branch:g.stdout.trim(),node:process.versions.node};},
  custody:()=>{const r=cp.spawnSync('C:/Users/aleja/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(ROOT,'scripts/clinia-gate4-m1-custody.ps1')],{cwd:ROOT,encoding:'utf8',shell:false,windowsHide:true,timeout:15000});need(r.status===0,'M1_PRIVATE_CUSTODY_REFUSED');return JSON.parse(r.stdout);},
  inspect:()=>inspectWithRead(p,raw),
  query:(kind,b)=>{need(['pre','post'].includes(kind),'M1_READ_KIND_REFUSED');const r=sql(kind,b);if(r.status===0&&Buffer.isBuffer(r.stdout)&&r.stdout.length<=LIMIT.output)fs.writeFileSync(path.join(privateDir,'m1-'+kind+'-metadata.private.log'),r.stdout,{flag:'wx'});return r;},
  acquire:data=>{fd=fs.openSync(path.join(privateDir,'m1-attempt.json'),'wx');try{persistRecord(fs,fd,{...data,state:'M1_DISPATCH_PENDING_NO_RETRY'});}catch(e){try{fs.closeSync(fd);}catch{}fd=undefined;e.operatorRequired=true;throw e;}},
  dispatch:b=>{need(dispatches++===0,'M1_SECOND_DISPATCH_REFUSED');return sql('main',b);},
  finish:r=>{if(fd!==undefined){persistRecord(fs,fd,{state:r.state,writerActive:false,commitAcknowledged:r.commitAcknowledged,reconciliationRequired:r.reconciliationRequired});fs.closeSync(fd);fd=undefined;}}
 };
}
function main(argv){
 need(argv.shift()==='execute','M1_SEPARATE_RUNTIME_AUTHORIZATION_REQUIRED');const a={};
 const keys={'--approved-contract-sha':'contractSha','--authorization-ref':'authorizationRef','--turn-id':'turn','--receipt':'receipt'};
 for(let i=0;i<argv.length;i+=2){need(keys[argv[i]]&&argv[i+1]&&!Object.hasOwn(a,keys[argv[i]]),'M1_ARGUMENT_REFUSED');a[keys[argv[i]]]=argv[i+1];}
 const p=loadPackage();approval(p,a);need(/^[a-z0-9-]+\.json$/.test(a.receipt||''),'M1_RECEIPT_REQUIRED');
 need(process.cwd().replaceAll('\\','/')===ORIGINAL_ROOT,'M1_ORIGINAL_CWD_REQUIRED');
 const output=path.join(ROOT,'docs/production/evidence/2026-10-27-gate4-m1-transport',a.receipt),fd=fs.openSync(output,'wx'),start=Date.now();
 const journal=r=>persistRecord(fs,fd,{...r,contractSha:p.contractSha,authorizationRef:a.authorizationRef,turn:a.turn,flagsAreNotAuthority:true,elapsedSeconds:(Date.now()-start)/1000,recoveryRto:null,currentRpo:null});
 let r;try{r=run(p,a,nativeDriver(p,journal));try{journal(r);}catch{r.operatorRequired=true;}}finally{try{fs.closeSync(fd);}catch{if(r)r.operatorRequired=true;}}
 console.log(JSON.stringify({state:r.state,writeDispatches:r.writeDispatches,commitAcknowledged:r.commitAcknowledged,writerActive:false,operatorRequired:r.operatorRequired||false}));
 if(r.state!=='COMMITTED_VERIFIED'||r.operatorRequired)process.exitCode=1;
}
module.exports={ORIGINAL_ROOT,LIMIT,STORAGE_SCAN,hash,loadPackage,validatePackage,inventory,inspectWithRead,physical,metadata,outcome,request,persistRecord,run};
if(require.main===module){try{main(process.argv.slice(2));}catch{console.error('M1_RUNTIME_REFUSED_SEE_REVIEWED_SCOPE');process.exitCode=1;}}
