'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mod=path.resolve(__dirname,'../../scripts/clinia-gate4-m1-transport.cjs');
function api(){assert.ok(fs.existsSync(mod),'M1 transport not implemented');return require(mod);}
function fixture(){
 const a=api(),p=a.loadPackage(),calls=[],before={
  identity:{database:'postgres',user:'postgres',sessionUser:'postgres',version:'170011',systemIdentifier:'7701080397606109221',superuser:false},
  authority:{publicCreate:true,authTrigger:true,storagePolicyOwner:true},
  managed:{schemas:[{name:'auth',oid:1,ownerOID:2,owner:'synthetic_auth_owner',acl:null},{name:'storage',oid:3,ownerOID:4,owner:'synthetic_storage_owner',acl:'{synthetic=U/owner}'}],
   relations:[{schema:'auth',name:'users',oid:5,ownerOID:2,owner:'synthetic_auth_owner',acl:null,rls:false,forceRls:false,columns:[{name:'id',num:1,acl:null}]},
    {schema:'storage',name:'objects',oid:6,ownerOID:4,owner:'synthetic_storage_owner',acl:null,rls:true,forceRls:false,columns:[{name:'id',num:1,acl:null}]}]},
  native:{auth:82,storage:74,ledgerAbsent:true},counts:{users:0,mfa:0,buckets:0,objects:0},applicationRelations:0,clientUsage:{anon:true,authenticated:true,service_role:true}};
 const after=structuredClone(before);after.applicationRelations=31;after.clientUsage={anon:false,authenticated:false,service_role:false};
 const physical={storageBytes:{files:0,bytes:0,links:0,other:0},endpoint:p.contract.endpoint,containers:[],network:{Id:p.contract.network.id,Name:p.contract.network.name,Internal:true,IPAM:{Config:[{Subnet:'10.253.9.0/24'}]},Containers:{}},volumes:structuredClone(p.contract.volumes),targetNames:[]};
 for(const[k,s]of Object.entries(p.m0.spec.services)){
  const id=p.contract.containers[k].id;physical.targetNames.push(s.container_name);physical.network.Containers[id]={Name:s.container_name};
  physical.containers.push({Id:id,Name:'/'+s.container_name,Config:{Labels:{'com.supabase.cli.project':p.m0.contract.target,'clinia.service':k}},Image:s.image.split('@')[1],
   State:{Status:'running',Running:true,OOMKilled:false,Health:{Status:'healthy'}},HostConfig:{Privileged:false,Memory:s.mem_limit,MemorySwap:s.memswap_limit,PidsLimit:s.pids_limit,NanoCpus:s.cpus*1e9,RestartPolicy:{Name:'no'}},
   NetworkSettings:{Networks:{[p.contract.network.name]:{}},Ports:{}},Mounts:(s.volumes||[]).map(v=>({Type:v.type,Name:v.type==='volume'?v.source:undefined,Source:v.source,Destination:v.target,RW:!v.read_only}))});
 }
 let clock=0;
 const io={now:()=>clock,host:()=>({platform:'win32',root:a.ORIGINAL_ROOT,branch:'codex/gate4-recovery-ops',node:'22.20.0'}),
  custody:()=>({valid:true,leaseState:'M0_COMPLETE_GATE4_OWNER_AWAIT_SEPARATE_SCOPE'}),
  inspect:()=>{calls.push('inspect');return structuredClone(physical);},
  query:(kind,b)=>{calls.push(kind);assert.ok(Buffer.isBuffer(b));return {status:0,stdout:Buffer.from('M1_META:'+JSON.stringify(kind==='pre'?before:after)+'\n'),stderr:Buffer.alloc(0)};},
  acquire:()=>calls.push('lease'),finish:()=>calls.push('finish'),journal:()=>{},
  dispatch:b=>{calls.push('write');assert.ok(b.equals(p.buffers.main));return {status:0,stdout:Buffer.from('BEGIN\nDO\nCOMMIT\n'),stderr:Buffer.alloc(0)};}};
 const approval={contractSha:p.contractSha,authorizationRef:'human:synthetic-M1-only',turn:'M1-SYNTHETIC'};
 return {a,p,io,calls,before,after,physical,approval,advance:n=>{clock+=n;}};
}
test('import has no native driver activity',()=>{const cp=require('node:child_process'),old=cp.spawnSync;cp.spawnSync=()=>{throw Error('Native I/O forbidden on import');};try{api();}finally{cp.spawnSync=old;}});
test('one exact sealed buffer reaches driver and committed postchecks close writer',()=>{const f=fixture(),r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_VERIFIED');assert.equal(r.writeDispatches,1);assert.equal(f.calls.filter(x=>x==='write').length,1);assert.equal(f.calls.at(-1),'finish');assert.equal(r.writerActive,false);});
test('missing or M0 authority reference refuses before any physical I/O',()=>{for(const approval of [{},{authorizationRef:'human:20261025-block-d-M0-01'}]){const f=fixture(),r=f.a.run(f.p,approval,f.io);assert.equal(r.state,'ADMISSION_REFUSED');assert.deepEqual(f.calls,[]);}});
test('contract mutation, corrupt main bytes and unknown payload path refuse before dispatch',()=>{for(const mutate of [f=>{f.p.buffers.main[0]^=1;},f=>{f.p.contract.payloads.main.path='../other.sql';},f=>{f.p.contract.target.systemIdentifier='7701080397606109222';}]){const f=fixture();mutate(f);const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}});
test('wrong native host/branch/runtime refuses',()=>{for(const change of [{platform:'linux'},{root:'C:/other'},{branch:'main'},{node:'24.0.0'}]){const f=fixture(),host=f.io.host();f.io.host=()=>({...host,...change});assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');}});
test('custody or occupied attempt lease refuses without SQL write',()=>{for(const change of [f=>{f.io.custody=()=>({valid:false});},f=>{f.io.acquire=()=>{throw Error('occupied');};}]){const f=fixture();change(f);assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}});
test('effective owner required; MEMBER alone never grants policy authority',()=>{const f=fixture();f.before.authority.storagePolicyOwner=false;f.before.authority.memberOnly=true;const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));});
test('public CREATE/auth TRIGGER and nonsuperuser identity must all hold',()=>{for(const mutate of [m=>{m.authority.publicCreate=false;},m=>{m.authority.authTrigger=false;},m=>{m.identity.superuser=true;},m=>{m.identity.systemIdentifier='7701080397606109222';},m=>{m.identity.version='170012';}]){const f=fixture();mutate(f.before);assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}});
test('accounts, MFA, buckets, bytes metadata and app occupation refuse empty quarantine',()=>{for(const key of ['users','mfa','buckets','objects']){const f=fixture();f.before.counts[key]=1;assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');}const f=fixture();f.before.applicationRelations=1;assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');});
test('remote endpoint, fourth target service, wrong IDs/network/volume/caps refuse',()=>{for(const mutate of [x=>x.endpoint='tcp://remote',x=>x.targetNames.push('supabase_rest_clinia-gate3-20261020-a9'),x=>x.containers[0].Id='0'.repeat(64),x=>x.network.Internal=false,x=>x.network.Id='0'.repeat(64),x=>x.network.Containers.extra={},x=>x.volumes[0].createdAt='other',x=>x.containers[0].HostConfig.Memory+=1,x=>x.containers[0].NetworkSettings.Ports={'5432/tcp':[{}]}]){const f=fixture();mutate(f.physical);assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}});
test('stale admission and payload mutation during admission never dispatch',()=>{for(const mutate of [f=>f.advance(60001),f=>{f.p.buffers.main[0]^=1;}]){const f=fixture(),acquire=f.io.acquire;f.io.acquire=()=>{acquire();mutate(f);};assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}});
test('SQLSTATE script failure before COMMIT is aborted, never retried',()=>{const f=fixture();f.io.dispatch=()=>{f.calls.push('write');return {status:3,stdout:Buffer.from('BEGIN\nDO\n'),stderr:Buffer.from('ERROR:  42501: synthetic denied\n')};};const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'ABORTED_PRECOMMIT');assert.equal(r.writeDispatches,1);assert.ok(!f.calls.includes('post'));});
test('timeout, throw, signal, transport exit and missing COMMIT ACK stay UNKNOWN',()=>{for(const output of [null,{status:null,error:{code:'ETIMEDOUT'}},{status:2,stdout:Buffer.alloc(0)},{status:0,stdout:Buffer.from('DO\n')},{status:3,stdout:Buffer.from('COMMIT\n'),stderr:Buffer.from('ERROR:  42501: synthetic\n')},{status:3,stdout:Buffer.alloc(0),stderr:Buffer.from('unclassified error')}]){const f=fixture();f.io.dispatch=()=>{f.calls.push('write');if(output===null)throw Error('transport');return output;};const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'DISPATCH_UNKNOWN');assert.equal(r.writeDispatches,1);assert.ok(!f.calls.includes('post'));}});
test('postcheck error after COMMIT is committed failure, no inverse/second write',()=>{const f=fixture(),query=f.io.query;f.io.query=(k,b)=>k==='post'?{status:3,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)}:query(k,b);const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_POSTCHECK_FAILED');assert.equal(r.commitAcknowledged,true);assert.equal(r.writeDispatches,1);});
test('managed owner/table ACL/schema ACL/RLS/column ACL drift all fail after commit',()=>{for(const mutate of [m=>m.relations[0].owner='changed',m=>m.relations[1].acl='changed',m=>m.schemas[0].acl='changed',m=>m.relations[1].rls=false,m=>m.relations[1].columns[0].acl='changed']){const f=fixture();mutate(f.after.managed);assert.equal(f.a.run(f.p,f.approval,f.io).state,'COMMITTED_POSTCHECK_FAILED');}});
test('postcondition public USAGE, nonempty scope or unexpected service never accepted',()=>{for(const mutate of [f=>f.after.clientUsage.anon=true,f=>f.after.counts.users=1,f=>f.after.native.auth=83,f=>{let n=0,inspect=f.io.inspect;f.io.inspect=()=>{const x=inspect();if(++n===3)x.targetNames.push('rest');return x;};}]){const f=fixture();mutate(f);assert.equal(f.a.run(f.p,f.approval,f.io).state,'COMMITTED_POSTCHECK_FAILED');}});
test('native request sends Buffer unchanged with ON_ERROR_STOP and fixed local socket/ID',()=>{const f=fixture(),b=f.p.buffers.main,r=f.a.request(f.p,'main',b);assert.ok(Buffer.isBuffer(r.input));assert.ok(r.input.equals(b));assert.ok(r.args.includes('ON_ERROR_STOP=1'));assert.ok(r.args.includes('/var/run/postgresql'));assert.ok(r.args.includes(f.p.contract.containers.db.id));assert.ok(!r.args.includes('-qAt'));assert.equal(r.options.shell,false);assert.ok(r.options.timeout>0);assert.ok(!JSON.stringify(r.args).includes('SET ROLE'));});
test('input/output bounds and malformed read-only metadata refuse safely',()=>{const f=fixture();assert.throws(()=>f.a.request(f.p,'main',Buffer.alloc(1024*1024+1)));for(const stdout of [Buffer.from('M1_META:{}\n'),Buffer.from('M1_META:{}\nM1_META:{}\n'),Buffer.alloc(1024*1024+1)]){const g=fixture();g.io.query=()=>({status:0,stdout});assert.equal(g.a.run(g.p,g.approval,g.io).state,'ADMISSION_REFUSED');assert.ok(!g.calls.includes('write'));}});
test('lease finalization error preserves committed classification and operator-required flag',()=>{const f=fixture();f.io.finish=()=>{throw Error('journal failure');};const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_VERIFIED');assert.equal(r.operatorRequired,true);});

test('repeated receipt updates always write at position zero with injected filesystem',()=>{
 const a=api(),events=[],io={ftruncateSync:(fd,n)=>events.push(['truncate',fd,n]),writeSync:(fd,s,pos,enc)=>{events.push(['write',pos,enc]);JSON.parse(s);},fsyncSync:()=>{}};
 a.persistRecord(io,7,{stage:'long-first-state'});a.persistRecord(io,7,{s:1});
 assert.deepEqual(events.filter(x=>x[0]==='write'),[['write',0,'utf8'],['write',0,'utf8']]);
});
test('contradictory COMMIT plus server error is UNKNOWN and never a rollback',()=>{
 const f=fixture();f.io.dispatch=()=>({status:0,stdout:Buffer.from('COMMIT\n'),stderr:Buffer.from('ERROR:  42501: synthetic\n')});
 assert.equal(f.a.run(f.p,f.approval,f.io).state,'DISPATCH_UNKNOWN');
});
test('receipt failure after COMMIT stays committed failure and never redispatches',()=>{
 const f=fixture();f.io.journal=r=>{if(r.state==='COMMITTED_AWAITING_POSTCHECK')throw Error('synthetic output failure');};
 const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_POSTCHECK_FAILED');assert.equal(r.commitAcknowledged,true);assert.equal(r.writeDispatches,1);
});

test('running flag and configured host binding refuse before single dispatch',()=>{
 for(const mutate of [x=>x.containers[0].State.Running=false,x=>x.containers[0].HostConfig.PortBindings={'5432/tcp':[{}]}]){
  const f=fixture();mutate(f.physical);assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));
 }
});
test('input Buffer preserves every sealed byte and never aliases caller storage',()=>{
 const f=fixture(),b=f.p.buffers.main,r=f.a.request(f.p,'main',b);
 assert.equal(f.a.hash(r.input),'f9195bac42cc0413af5e3b8f77ebe1793817e66e114d81c13bc1de83a7cada6a');
 assert.notEqual(r.input,b);assert.equal(r.options.encoding,undefined);r.input[0]^=1;assert.equal(f.a.hash(b),'f9195bac42cc0413af5e3b8f77ebe1793817e66e114d81c13bc1de83a7cada6a');
});
const childProcess=require('node:child_process'),originalSpawn=childProcess.spawnSync,originalRead=fs.readFileSync,originalOpen=fs.openSync;
let nativeAttempts=0,privateAttempts=0;
test.before(()=>{
 childProcess.spawnSync=()=>{nativeAttempts++;throw Error('Synthetic suite forbids native commands');};
 fs.readFileSync=function(file,...args){if(typeof file==='string'&&file.replaceAll('\\','/').includes('/.gate4-private/')){privateAttempts++;throw Error('Private reads forbidden');}return originalRead.call(this,file,...args);};
 fs.openSync=function(file,...args){if(typeof file==='string'&&file.replaceAll('\\','/').includes('/.gate4-private/')){privateAttempts++;throw Error('Private opens forbidden');}return originalOpen.call(this,file,...args);};
});
test.after(()=>{
 childProcess.spawnSync=originalSpawn;fs.readFileSync=originalRead;fs.openSync=originalOpen;
 assert.equal(nativeAttempts,0,'Unexpected native command attempt');assert.equal(privateAttempts,0,'Unexpected private access attempt');
});

test('validated before and after ACL observations are retained even when comparison fails',()=>{
 const f=fixture();f.after.managed.relations[1].acl='changed';
 const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_POSTCHECK_FAILED');
 assert.equal(r.managedBefore.relations[1].acl,null);assert.equal(r.managedAfter.relations[1].acl,'changed');
 assert.equal(r.resourcesPreserved,true);assert.equal(r.rollbackInversePerformed,false);
});

test('storage file/byte/symlink presence refuses empty quarantine before dispatch',()=>{
 for(const key of ['files','bytes','links','other']){const f=fixture();f.physical.storageBytes[key]=1;assert.equal(f.a.run(f.p,f.approval,f.io).state,'ADMISSION_REFUSED');assert.ok(!f.calls.includes('write'));}
});
test('storage scanner uses only injected metadata I/O and never follows a link or reads contents',()=>{
 const a=api(),vm=require('node:vm'),seen=[],out=[];
 const fake={lstatSync:p=>{seen.push(p);return {isSymbolicLink:()=>p.endsWith('/link'),isDirectory:()=>p==='/mnt',isFile:()=>p.endsWith('/file'),size:4};},opendirSync:()=>{const a=['link','file'];return {readSync:()=>a.length?{name:a.shift()}:null,closeSync:()=>{}};},readFileSync:()=>{throw Error('Contents forbidden');}};
 vm.runInNewContext(a.STORAGE_SCAN,{require:n=>{assert.equal(n,'node:fs');return fake;},console:{log:s=>out.push(s)}});
 assert.deepEqual(JSON.parse(out[0]),{files:1,bytes:4,links:1,other:0});assert.ok(!seen.includes('/outside'));
});
test('storage metadata walk refuses unbounded trees with injected filesystem',()=>{
 const a=api(),vm=require('node:vm');
 const fake={lstatSync:()=>({isSymbolicLink:()=>false,isDirectory:()=>true,isFile:()=>false}),opendirSync:()=>{let done=false;return {readSync:()=>done?null:(done=true,{name:'child'}),closeSync:()=>{}};}};
 assert.throws(()=>vm.runInNewContext(a.STORAGE_SCAN,{require:()=>fake,console:{log:()=>{}}}),/M1_STORAGE_METADATA_BOUND/);
});

test('new read-only guards use existing effective owner rights and reject hidden-row counts',()=>{
 const f=fixture(),parse=require('../../scripts/prepare-clinia-hosted-staging.cjs').statements;
 for(const kind of ['pre','post']){
  const sql=f.p.buffers[kind].toString('utf8');assert.ok(sql.startsWith('BEGIN READ ONLY; SET LOCAL row_security=off;'));
  assert.ok(sql.endsWith('ROLLBACK;'));
  assert.ok(parse(sql).every(s=>/^(BEGIN READ ONLY;|SET LOCAL|DO |SELECT |ROLLBACK;)/.test(s.clean)));
 }
 const pre=f.p.buffers.pre.toString('utf8');assert.match(pre,/pg_has_role\(current_user,c\.relowner,'USAGE'\)/);
 assert.ok(!pre.includes("'MEMBER'"));assert.ok(!/\b(GRANT|ALTER OWNER|SET ROLE)\b/.test(pre));
});

function inspectionReader(f,change){
 const calls=[];let rounds=0;
 return {calls,read:a=>{
  calls.push(a[0]);
  if(a[0]==='context'){rounds++;return f.physical.endpoint;}
  let x=structuredClone(f.physical);if(change)change(x,rounds);
  if(a[0]==='inspect')return x.containers.map(v=>JSON.stringify(v)).join('\n');
  if(a[0]==='network')return JSON.stringify(x.network);
  if(a[0]==='volume')return x.volumes.map(v=>JSON.stringify(v)).join('\n');
  if(a[0]==='ps')return x.targetNames.join('\n');
  if(a[0]==='exec')return JSON.stringify(x.storageBytes);
  throw Error('Unexpected inspection command');
 }};
}
test('native inspection rejects remote context immediately before any exec or inventory',()=>{
 const f=fixture();assert.equal(typeof f.a.inspectWithRead,'function');f.physical.endpoint='tcp://remote';
 const r=inspectionReader(f);assert.throws(()=>f.a.inspectWithRead(f.p,r.read),/M1_REMOTE_CONTEXT_REFUSED/);
 assert.deepEqual(r.calls,['context']);
});
test('complete invalid inventory refuses before the first storage exec',()=>{
 for(const mutate of [x=>x.containers[0].Id='0'.repeat(64),x=>x.containers[0].Image='other',x=>x.containers[0].Mounts=[],
  x=>x.containers[0].State.Health.Status='unhealthy',x=>x.containers[0].HostConfig.PortBindings={port:[{}]},
  x=>x.network.Id='other',x=>x.network.Internal=false,x=>x.volumes[0].createdAt='other',x=>x.targetNames.push('supabase_rest_clinia-gate3-20261020-a9')]){
  const f=fixture();assert.equal(typeof f.a.inspectWithRead,'function');const r=inspectionReader(f,x=>mutate(x));
  assert.throws(()=>f.a.inspectWithRead(f.p,r.read));assert.equal(r.calls.filter(x=>x==='exec').length,0);
 }
});
test('inspection rechecks all identities after the one permitted storage scan',()=>{
 const f=fixture();assert.equal(typeof f.a.inspectWithRead,'function');
 const bad=inspectionReader(f,(x,round)=>{if(round===2)x.containers[0].State.Health.Status='unhealthy';});
 assert.throws(()=>f.a.inspectWithRead(f.p,bad.read));assert.equal(bad.calls.filter(x=>x==='exec').length,1);
 const good=inspectionReader(f);assert.doesNotThrow(()=>f.a.inspectWithRead(f.p,good.read));
 assert.equal(good.calls.filter(x=>x==='context').length,2);assert.equal(good.calls.filter(x=>x==='exec').length,1);
 assert.ok(good.calls.indexOf('ps')<good.calls.indexOf('exec'));
});

function checkCustodySource(source){
 const s=source.replaceAll('\r\n','\n'),sid=s.indexOf('$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User'),
  allowed=s.indexOf("$taskAllowed=@($taskSid.Value,'S-1-5-18')"),first=s.search(/^Assert-Custody /m),
  leaseGuard=s.indexOf('Assert-Custody $taskLeasePath'),read=s.indexOf('Get-Content -LiteralPath $taskLeasePath');
 assert.ok(sid>=0&&allowed>sid&&first>allowed,'Original SID/SYSTEM allowlist dependencies must precede guards');
 assert.ok(leaseGuard>first&&read>leaseGuard,'Original file ACL/reparse guard must precede lease read');
 const list=s.split('\n').filter(x=>x.startsWith('$taskAllowed='));
 assert.deepEqual(list,["$taskAllowed=@($taskSid.Value,'S-1-5-18')"]);
}
test('custody helper contract initializes original SID/SYSTEM and guards lease before read',()=>{
 checkCustodySource(fs.readFileSync(path.resolve(__dirname,'../../scripts/clinia-gate4-m1-custody.ps1'),'utf8'));
});
test('custody helper contract regression rejects missing/broadened allowlist or late lease guard',()=>{
 const s=fs.readFileSync(path.resolve(__dirname,'../../scripts/clinia-gate4-m1-custody.ps1'),'utf8');
 assert.doesNotThrow(()=>checkCustodySource(s));
 for(const bad of [
  s.replace(/\$taskSid=\[Security\.Principal\.WindowsIdentity\]::GetCurrent\(\)\.User\r?\n/,''),
  s.replace(/\$taskAllowed=@\([^\n]+\)\r?\n/,''),
  s.replace("'S-1-5-18')","'S-1-5-18','S-1-1-0')"),
  s.replace(/Assert-Custody \$taskLeasePath\r?\n/,'')+'\nAssert-Custody $taskLeasePath\n'
 ])assert.throws(()=>checkCustodySource(bad));
});


for(const [name,mutate] of [
 ['health',x=>{x.containers[0].State.Health.Status='unhealthy';}],
 ['network',x=>{x.network.Internal=false;}],
 ['ports',x=>{x.containers[0].HostConfig.PortBindings={'5432/tcp':[{}]};}],
 ['context',x=>{x.endpoint='tcp://synthetic-remote';}]
])test('last admission refuses '+name+' drift during precheck or acquire before write intent',()=>{
 for(const stage of ['pre','acquire']){
  const f=fixture(),query=f.io.query,acquire=f.io.acquire,intents=[];
  f.io.journal=r=>{if(r.state==='SEALED_BASELINE_DISPATCH_INTENT')intents.push(r.state);};
  if(stage==='pre')f.io.query=(kind,b)=>{const result=query(kind,b);if(kind==='pre')mutate(f.physical);return result;};
  else f.io.acquire=data=>{acquire(data);mutate(f.physical);};
  const r=f.a.run(f.p,f.approval,f.io);
  assert.equal(r.state,'ADMISSION_REFUSED',stage);assert.equal(r.writeDispatches,0,stage);
  assert.equal(r.commitAcknowledged,false);assert.equal(r.writerActive,false);
  assert.equal(f.calls.filter(x=>x==='write').length,0);assert.deepEqual(intents,[]);
  assert.equal(f.calls.filter(x=>x==='finish').length,1);
 }
});

test('final physical admission precedes sealed intent and the single dispatch',()=>{
 const f=fixture();f.io.journal=r=>f.calls.push(r.state);
 const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'COMMITTED_VERIFIED');
 assert.deepEqual(f.calls.slice(0,6),['inspect','pre','lease','inspect','SEALED_BASELINE_DISPATCH_INTENT','write']);
 assert.equal(f.calls.filter(x=>x==='inspect').length,3);assert.equal(r.writeDispatches,1);
});

test('age and sealed bytes are rechecked after the final inspection completes',()=>{
 for(const mutate of [f=>f.advance(60001),f=>f.advance(-1),f=>{f.p.buffers.main[0]^=1;}]){
  const f=fixture(),inspect=f.io.inspect;let calls=0;
  f.io.inspect=()=>{const x=inspect();if(++calls===2)mutate(f);return x;};
  const r=f.a.run(f.p,f.approval,f.io);assert.equal(r.state,'ADMISSION_REFUSED');assert.equal(r.writeDispatches,0);
  assert.ok(!f.calls.includes('write'));assert.equal(calls,2);
 }
});
