'use strict';
// Gateway adapter for the NEW clean managed project; creates no extra API stack.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs'),{plan}=require('./prepare-clinia-clean-managed.cjs');
const services=['db','auth','storage','kong','rest','inbucket'];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function config(variant){
  assert.match(variant,/^clean-managed-[1-9]$/,'Exact isolated clean managed variant required');
  const p=plan(variant.at(-1)),manifestFile=path.join(p.privateDir,'manifest.json');
  if(fs.existsSync(manifestFile)){
    const manifest=JSON.parse(fs.readFileSync(manifestFile));
    assert.ok([p.network,p.project+'-published-loopback'].includes(manifest.network),'Unknown clean network refused');p.network=manifest.network;
  }
  return {...p,variant,database:'postgres',gateway:true,port:p.ports.api,
    compose:path.join(p.privateDir,'runtime.compose.json'),keys:path.join(p.privateDir,'api.keys.private.json')};
}
function native(c,args,input){
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0){const log=`clean-api-${Date.now()}.private.log`;fs.writeFileSync(path.join(c.privateDir,log),(r.stdout||'')+(r.stderr||''),{flag:'wx'});throw Error('Clean local API operation failed; private diagnostic preserved');}
  return r.stdout.trim();
}
function verifiedSpec(c){
  const manifest=JSON.parse(fs.readFileSync(path.join(c.privateDir,'manifest.json')));
  assert.equal(manifest.project,c.project);assert.equal(sha(fs.readFileSync(c.compose)),manifest.preparedComposeSha256);
  assert.equal(native(c,['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
  return manifest;
}
function inspect(variant,required=services){
  const c=config(variant),manifest=verifiedSpec(c),containers=JSON.parse(native(c,['inspect',...required.map(key=>`supabase_${key}_${c.project}`)]));
  return containers.map((item,i)=>{
    const key=required[i];assert.equal(item.Name,`/supabase_${key}_${c.project}`);assert.equal(item.Config.Labels['com.supabase.cli.project'],c.project);
    assert.equal(item.Image,manifest.imageIds[key]);assert.ok(!item.HostConfig.Privileged);assert.deepEqual(Object.keys(item.NetworkSettings.Networks),[c.network]);
    assert.equal(item.State.Status,'running');if(item.State.Health)assert.equal(item.State.Health.Status,'healthy');
    for(const [target,bindings]of Object.entries(item.NetworkSettings.Ports||{}))for(const b of bindings||[]){
      assert.equal(b.HostIp,'127.0.0.1');assert.equal(b.HostPort,String({5432:c.ports.db,8000:c.ports.api,8025:c.ports.mail}[target.split('/')[0]]));
    }
    const published={db:['5432/tcp',c.ports.db],kong:['8000/tcp',c.ports.api],inbucket:['8025/tcp',c.ports.mail]}[key];
    if(published){const bindings=item.NetworkSettings.Ports[published[0]];assert.ok(Array.isArray(bindings)&&bindings.length===1,'Expected published loopback binding missing');assert.equal(bindings[0].HostIp,'127.0.0.1');assert.equal(bindings[0].HostPort,String(published[1]));}
    for(const mount of item.Mounts||[])if(mount.Type==='volume')assert.ok(Object.values(c.volumes).includes(mount.Name),'Other project volume refused');
    return {name:item.Name,imageId:item.Image,state:item.State.Status,health:item.State.Health?.Status||null,ports:item.NetworkSettings.Ports};
  });
}
function sql(variant,text,role='supabase_admin'){
  assert.ok(['supabase_admin','postgres'].includes(role));const c=config(variant);inspect(variant,['db']);
  return native(c,['exec','-i','--user','postgres',`supabase_db_${c.project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres','-f','/dev/stdin'],text);
}
function managedState(variant){return JSON.parse(sql(variant,"SELECT json_build_object('authMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY version) FROM auth.schema_migrations m),'storageMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY id) FROM storage.migrations m),'authUsers',(SELECT count(*) FROM auth.users),'storageObjects',(SELECT count(*) FROM storage.objects));"));}
function read(variant){const c=config(variant);verifiedSpec(c);const keys=JSON.parse(fs.readFileSync(c.keys));assert.equal(keys.project,c.project);assert.equal(keys.database,c.database);return {c,keys};}
function start(variant){
  const c=config(variant);verifiedSpec(c);
  const app=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-clean-application',`attempt-${c.attempt}`,'execution.json')));
  assert.ok(['CLEAN_APPLICATION_HELPER_ENROLLMENT_INSTALLED_SNAPSHOT_API_PENDING',
    'CLEAN_APPLICATION_HELPER_ENROLLMENT_SNAPSHOT_INSTALLED_API_PENDING'].includes(app.status),'Exact verified clean application installation required');
  native(c,['compose','--project-name',c.project,'-f',c.compose,'up','-d','--pull','never','--wait','--wait-timeout','180',...services]);
  const runtime=inspect(variant);
  if(!fs.existsSync(c.keys)){
    const material=JSON.parse(fs.readFileSync(path.join(c.privateDir,'credentials.private.json')));
    fs.writeFileSync(c.keys,JSON.stringify({project:c.project,database:c.database,anon:material.anon,service:material.service,managedBefore:managedState(variant)}),{flag:'wx'});
  }
  return {state:'CLEAN_GATEWAY_RUNNING',project:c.project,runtime};
}
function stop(variant){const c=config(variant);verifiedSpec(c);native(c,['compose','--project-name',c.project,'-f',c.compose,'stop','kong','rest','inbucket']);return {state:'CLEAN_GATEWAY_STOPPED_DB_AUTH_STORAGE_PRESERVED'};}
function primaryAfter(variant){return inspect(variant,['db','auth','storage']);}
function route(variant,service,value){
  config(variant);assert.ok(['auth','rest','storage'].includes(service));assert.ok(value.startsWith('/')&&!value.startsWith('//'),'Relative provider route required');
  const prefix={auth:'/auth/v1',rest:'/rest/v1',storage:'/storage/v1'}[service];
  return value.startsWith(prefix+'/')?value:prefix+value;
}
if(require.main===module){assert.equal(process.argv.length,4);assert.ok(['start','stop','inspect'].includes(process.argv[2]));try{console.log(JSON.stringify({start,stop,inspect}[process.argv[2]](process.argv[3])));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={config,sql,managedState,read,start,stop,inspect,primaryAfter,route};
