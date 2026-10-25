'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=path.resolve(__dirname,'../../scripts/clinia-gate4-managed-m0.cjs');
function api(){assert.ok(fs.existsSync(modulePath),'M0 harness not implemented');return require(modulePath);}
function pkg(){return api().loadPackage();}
test('initialize refuses missing or merely documented authorization before mutation',()=>{
 const m=api();assert.throws(()=>m.requireApproval('initialize',{}));
 assert.throws(()=>m.requireApproval('initialize',{approvedContractSha:'0'.repeat(64),authorizationRef:'human:synthetic-only'}));
 assert.doesNotThrow(()=>m.requireApproval('dry-run',{}));
});
test('exact approval reference binds reviewed hash but is explicitly not authority by itself',()=>{
 const m=api(),p=pkg();
 const r=m.requireApproval('initialize',{approvedContractSha:p.contractSha,authorizationRef:'human:synthetic-test-only'});
 assert.equal(r.invocationMustHaveIndependentHumanApproval,true);
 assert.throws(()=>m.requireApproval('initialize',{approvedContractSha:p.contractSha,authorizationRef:'https://invalid'}));
});
function inventory(p){return {endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',containers:[],volumes:[],networks:[],running:[]};}
test('target/container/volume/network occupation and other running containers reject initialization',()=>{
 const m=api(),p=pkg();
 for(const change of [
 {containers:['supabase_db_'+p.contract.target]},
 {volumes:['supabase_db_'+p.contract.target]},
 {networks:[p.contract.network.name]},
 {running:['unrelated-running']}
 ])assert.throws(()=>m.validateInventory({...inventory(p),...change},p.contract));
 assert.doesNotThrow(()=>m.validateInventory(inventory(p),p.contract));
});
test('remote Docker endpoint and subnet conflicts are not admitted',()=>{
 const m=api(),p=pkg();
 assert.throws(()=>m.validateInventory({...inventory(p),endpoint:'tcp://remote:2375'},p.contract));
 assert.throws(()=>m.checkNetwork(['10.253.9.0/24'],[],p.contract));
 assert.throws(()=>m.checkNetwork([],['10.0.0.0/8'],p.contract));
 assert.doesNotThrow(()=>m.checkNetwork([],['0.0.0.0/0'],p.contract));
});
test('total memory cannot replace actual MemAvailable or bypass exact lower bound',()=>{
 const m=api(),p=pkg();assert.throws(()=>m.admitMemory(null,p.contract));
 assert.throws(()=>m.admitMemory(p.contract.capacity.minimumAvailableVmBytes-1,p.contract));
 assert.doesNotThrow(()=>m.admitMemory(p.contract.capacity.minimumAvailableVmBytes,p.contract));
});
test('reviewed package stays exactly three services, frozen initializer and no public ports',()=>{
 const m=api(),p=pkg();assert.deepEqual(Object.keys(p.spec.services).sort(),['auth','db','storage']);
 assert.equal(m.hash(JSON.stringify(p.spec.services.db.command)),p.contract.composeTemplate.sourceDbInitializationCommandSha256);
 const changed=structuredClone(p.spec);changed.services.db.ports=['5432:5432'];
 assert.throws(()=>m.validateSpec(changed,p.contract));
});
test('new private instantiation resolves tokens without changing native initializer or adding rest',()=>{
 const m=api(),p=pkg();
 const material={project:p.contract.target,password:'1'.repeat(64),secret:'2'.repeat(64),sodium:'3'.repeat(64),
 anon:'synthetic-anon',service:'synthetic-service',privateJwk:{kty:'EC',kid:'synthetic'},jwks:{keys:[]}};
 const s=m.instantiate(p.spec,material,p.contract);
 assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(s)));
 assert.deepEqual(s.services.db.command,p.spec.services.db.command);
 assert.ok(s.services.auth.environment.some(v=>v.includes('supabase_auth_admin:')&&v.includes('@supabase_db_'+p.contract.target)));
 assert.equal(s.services.rest,undefined);
});
function metadata(){return {database:'postgres',user:'postgres',sessionUser:'postgres',version:'170011',
 systemIdentifier:'7999999999999999999',postgresSuperuser:false,authMigrationRows:82,storageMigrationRows:74,
 authUsers:0,mfaFactors:0,buckets:0,objects:0,applicationRelations:0,applicationLedgerAbsent:true};}
test('actual PG identity, authority, native migrations and emptiness must all match',()=>{
 const m=api(),p=pkg();assert.doesNotThrow(()=>m.validateMetadata(metadata(),p.contract));
 for(const change of [{version:'170006'},{systemIdentifier:null},{postgresSuperuser:true},{authUsers:1},
 {objects:1},{applicationRelations:1},{applicationLedgerAbsent:false},{storageMigrationRows:68}])
 assert.throws(()=>m.validateMetadata({...metadata(),...change},p.contract));
});
test('effective container image/network/ports/privileges reject drift',()=>{
 const m=api(),p=pkg(),rows=Object.entries(p.spec.services).map(([service,s])=>({
 Name:'/'+s.container_name,Id:service+'-synthetic',Image:s.image.split('@')[1],
 Config:{Labels:{'com.supabase.cli.project':p.contract.target,'clinia.service':service}},
 State:{Status:'running',OOMKilled:false,Health:{Status:'healthy'}},
 HostConfig:{Privileged:false,Memory:s.mem_limit,MemorySwap:s.memswap_limit,PidsLimit:s.pids_limit,NanoCpus:1e9},
 NetworkSettings:{Networks:{[p.contract.network.name]:{}},Ports:{}},
 Mounts:(s.volumes||[]).map(v=>({Type:v.type,Name:v.type==='volume'?v.source:undefined,
 Source:v.source,Destination:v.target,RW:!v.read_only}))
 }));
 assert.doesNotThrow(()=>m.validateContainers(rows,p.spec,p.contract));
 for(const alter of [
 r=>{r[0].HostConfig.Privileged=true;},
 r=>{r[0].Image='sha256:'+'0'.repeat(64);},
 r=>{r[0].NetworkSettings.Ports={'5432/tcp':[{HostIp:'0.0.0.0',HostPort:'5432'}]};},
 r=>{r[0].NetworkSettings.Networks={wrong:{}};},
 r=>{r[0].Mounts[0].Name='other-volume';}
 ]){const bad=structuredClone(rows);alter(bad);assert.throws(()=>m.validateContainers(bad,p.spec,p.contract));}
});
test('DB-start failure stops only owned cohort once; no retry or later phase',()=>{
 const m=api(),calls=[];
 assert.throws(()=>m.runSequence({
 prepare:()=>calls.push('prepare'),upDb:()=>{calls.push('db');throw Error('synthetic-failure');},
 upManaged:()=>calls.push('managed'),verify:()=>calls.push('verify'),stopOwned:()=>calls.push('stop')
 },()=>{}));
 assert.deepEqual(calls,['prepare','db','stop']);
});
test('private preparation failure never attempts a Docker start or stops others',()=>{
 const m=api(),calls=[];
 assert.throws(()=>m.runSequence({prepare:()=>{calls.push('prepare');throw Error('synthetic');},
 upDb:()=>calls.push('db'),upManaged:()=>calls.push('managed'),verify:()=>calls.push('verify'),stopOwned:()=>calls.push('stop')},()=>{}));
 assert.deepEqual(calls,['prepare']);
});
test('complete empty-managed sequence never dispatches application/M7/open/restore stages',()=>{
 const m=api(),calls=[];
 const result=m.runSequence({prepare:()=>calls.push('prepare'),upDb:()=>calls.push('db'),upManaged:()=>calls.push('managed'),
 verify:()=>{calls.push('verify');return metadata();},stopOwned:()=>calls.push('stop')},()=>{});
 assert.deepEqual(calls,['prepare','db','managed','verify']);assert.equal(result.systemIdentifier,metadata().systemIdentifier);
});
test('execution host is Windows and exact owned private location; package inspection stays separate',()=>{
 const m=api(),p=pkg();assert.equal(typeof m.assertExecutionHost,'function');
 assert.throws(()=>m.assertExecutionHost('/tmp/unrelated',p.contract,'linux'));
 assert.throws(()=>m.assertExecutionHost('C:/unrelated',p.contract,'win32'));
 const owned=path.win32.dirname(path.win32.dirname(p.contract.privateArtifacts.directory));
 assert.doesNotThrow(()=>m.assertExecutionHost(owned,p.contract,'win32'));
});
test('cleanup refuses a wrong-image/project container and never targets unrelated names',()=>{
 const m=api(),p=pkg();assert.equal(typeof m.ownedStopCandidates,'function');
 const service=p.spec.services.db,row={Name:'/'+service.container_name,Id:'synthetic-owned',
 Image:service.image.split('@')[1],Config:{Labels:{'com.supabase.cli.project':p.contract.target,'clinia.service':'db'}},State:{Running:true}};
 assert.deepEqual(m.ownedStopCandidates([row],p.spec,p.contract),['synthetic-owned']);
 assert.throws(()=>m.ownedStopCandidates([{...row,Image:'sha256:'+'0'.repeat(64)}],p.spec,p.contract));
 assert.throws(()=>m.ownedStopCandidates([{...row,Name:'/unrelated'}],p.spec,p.contract));
});
test('dry-run command gate refuses every Docker mutation regardless of call path',()=>{
 const m=api(),p=pkg();assert.equal(typeof m.assertDockerMode,'function');
 for(const args of [['run','image'],['stop','id'],['network','create','name'],['volume','rm','name'],
 ['image','pull','ref'],['compose','-p',p.contract.target,'-f','file','up','-d']])
 assert.throws(()=>m.assertDockerMode('dry-run',args,p.contract));
 for(const args of [['ps','-a'],['volume','ls'],['network','inspect','id'],['image','inspect','ref']])
 assert.doesNotThrow(()=>m.assertDockerMode('dry-run',args,p.contract));
});
