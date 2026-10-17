'use strict';
// Synthetic API services for reviewed secondary databases. Never starts a database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
const variants={stage:{database:'clinia_contract_stage_20260928_3',port:56331},prod:{database:'clinia_contract_prod_20260928_3',port:56341},
  'captured-linked':{database:'clinia_upgrade_linked_20261002_1',port:56351,project:'clinia-captured-linked-20261002-1'},
  'captured-stage':{database:'clinia_upgrade_stage_20261002_3',port:56361,project:'clinia-captured-stage-20261002-3'},
  'captured-linked-v2':{database:'clinia_upgrade_linked_20261002_2',port:56371,project:'clinia-captured-linked-20261002-2'}};
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const network='clinia-acceptance-loopback', dbContainer='supabase_db_clinia-acceptance';
function native(args,input){
  const r=spawnSync(docker,['--context','desktop-linux',...args],{cwd:local.repo,input,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0){fs.mkdirSync(local.privateDir,{recursive:true});fs.writeFileSync(path.join(local.privateDir,'contract-api-'+Date.now()+'.private.log'),(r.stdout||'')+(r.stderr||''));throw new Error('Local Docker operation failed; private diagnostic preserved');}
  return r.stdout.trim();
}
function config(variant){
  assert.ok(Object.hasOwn(variants,variant),'Reviewed variant required');
  const project=variants[variant].project||'clinia-contract-'+variant+'-3';
  return {...variants[variant],variant,project,compose:path.join(local.privateDir,project+'.compose.private.json'),keys:path.join(local.privateDir,project+'.keys.private.json')};
}
function sql(variant,text,role='supabase_admin'){
  const c=config(variant);local.inspectLocal();
  assert.ok(['supabase_admin','postgres'].includes(role),'Reviewed local SQL role required');
  return native(['exec','-i','--user','postgres',dbContainer,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',c.database,'-f','/dev/stdin'],text);
}
function managedState(variant){
  return JSON.parse(sql(variant,"SELECT json_build_object('authMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY version) FROM auth.schema_migrations m),'storageMigrations',(SELECT json_agg(to_jsonb(m) ORDER BY id) FROM storage.migrations m),'authUsers',(SELECT count(*) FROM auth.users),'storageObjects',(SELECT count(*) FROM storage.objects));"));
}
function jwt(secret,role,issuer){
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role,iss:issuer,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400});
  return unsigned+'.'+crypto.createHmac('sha256',secret).update(unsigned).digest('base64url');
}
function sourceEnvironment(container){return Object.fromEntries(container.Config.Env.map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));}
function connection(original,database,user){
  const u=new URL(original);assert.ok(['postgres:','postgresql:'].includes(u.protocol));
  assert.equal(u.username,user);assert.ok(u.password);assert.equal(u.pathname,'/postgres');
  assert.ok(['supabase_db',dbContainer].includes(u.hostname),'Only the inspected local cluster is permitted');
  assert.ok(!u.port||u.port==='5432');assert.equal(u.search,'');
  u.hostname=dbContainer;u.pathname='/'+database;return u.toString();
}
function read(variant){
  const c=config(variant),spec=JSON.parse(fs.readFileSync(c.compose,'utf8')),keys=JSON.parse(fs.readFileSync(c.keys,'utf8'));
  assert.equal(spec.name,c.project);assert.equal(keys.database,c.database);assert.equal(keys.project,c.project);
  assert.deepEqual(Object.keys(spec.services).sort(),['auth','rest','storage']);
  for(const [service,s]of Object.entries(spec.services)){
    assert.equal(s.container_name,c.project+'-'+service);assert.match(s.image,/^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(s.networks,[network]);assert.deepEqual(s.cap_drop,['ALL']);assert.deepEqual(s.security_opt,['no-new-privileges:true']);assert.equal(s.read_only,true);assert.equal(s.restart,'no');
    assert.equal(s.labels['clinia.contract.database'],c.database);assert.equal(s.labels['clinia.contract.project'],c.project);
    assert.equal(s.ports.length,1);const binding=s.ports[0];assert.equal(binding.host_ip,'127.0.0.1');assert.equal(binding.published,String(c.port+['auth','rest','storage'].indexOf(service)));
    const uri=s.environment[{auth:'GOTRUE_DB_DATABASE_URL',rest:'PGRST_DB_URI',storage:'DATABASE_URL'}[service]],u=new URL(uri);
    assert.equal(u.hostname,dbContainer);assert.equal(u.pathname,'/'+c.database);
    assert.equal(u.username,{auth:'supabase_auth_admin',rest:'authenticator',storage:'supabase_storage_admin'}[service]);
    assert.ok(!s.privileged&&!s.network_mode&&!s.pid&&!s.devices&&!s.build);
    if(service!=='storage')assert.ok(!s.volumes);else assert.deepEqual(s.volumes,[{type:'volume',source:c.project+'-bytes',target:'/mnt'}]);
  }
  assert.equal(spec.services.auth.environment.GOTRUE_JWT_SECRET,keys.secret,'Auth key mismatch; private configuration requires review');
  assert.equal(spec.services.rest.environment.PGRST_JWT_SECRET,keys.secret,'REST key mismatch; private configuration requires review');
  assert.equal(spec.services.rest.environment.PGRST_DB_CONFIG,'false');
  assert.equal(spec.services.storage.environment.AUTH_JWT_SECRET,keys.secret,'Storage key mismatch; private configuration requires review');
  assert.equal(spec.services.storage.environment.ANON_KEY,keys.anon,'Anonymous key mismatch; private configuration requires review');assert.equal(spec.services.storage.environment.SERVICE_KEY,keys.service,'Service key mismatch; private configuration requires review');
  return {c,spec,keys};
}
function prepare(variant){
  const c=config(variant);local.inspectLocal();assert.ok(!fs.existsSync(c.compose)&&!fs.existsSync(c.keys),'New configuration only; preserve existing private files');
  const names=native(['ps','-a','--format','{{.Names}}']).split(/\r?\n/);assert.ok(!names.some(n=>n.startsWith(c.project+'-')),'Services already exist');
  assert.ok(!native(['volume','ls','--format','{{.Name}}']).split(/\r?\n/).includes(c.project+'-bytes'),'Empty new bytes volume required');
  const source=JSON.parse(native(['inspect','supabase_auth_clinia-acceptance','supabase_rest_clinia-acceptance','supabase_storage_clinia-acceptance']));
  const env=source.map(sourceEnvironment),secret=crypto.randomBytes(48).toString('base64url'),issuer='http://127.0.0.1:'+c.port;
  const keys={project:c.project,database:c.database,secret,anon:jwt(secret,'anon',issuer),service:jwt(secret,'service_role',issuer),managedBefore:managedState(variant)};
  const environments={
    auth:{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:issuer,GOTRUE_SITE_URL:'http://127.0.0.1:3400',GOTRUE_URI_ALLOW_LIST:'http://127.0.0.1:3400',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:connection(env[0].GOTRUE_DB_DATABASE_URL,c.database,'supabase_auth_admin'),GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_ISSUER:issuer,GOTRUE_JWT_VALID_METHODS:'HS256',GOTRUE_JWT_VALIDMETHODS:'HS256',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_PASSWORD_MIN_LENGTH:'12',GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:'9',GOTRUE_SMTP_ADMIN_EMAIL:'synthetic@clinia.invalid',GOTRUE_MAILER_AUTOCONFIRM:'false'},
    rest:{PGRST_DB_URI:connection(env[1].PGRST_DB_URI,c.database,'authenticator'),PGRST_DB_SCHEMAS:'public',PGRST_DB_EXTRA_SEARCH_PATH:'public,extensions',PGRST_DB_ANON_ROLE:'anon',PGRST_DB_CONFIG:'false',PGRST_JWT_SECRET:secret,PGRST_DB_MAX_ROWS:'1000',PGRST_DB_POOL:'3',PGRST_SERVER_PORT:'3000'},
    storage:{DATABASE_URL:connection(env[2].DATABASE_URL,c.database,'supabase_storage_admin'),AUTH_JWT_SECRET:secret,ANON_KEY:keys.anon,SERVICE_KEY:keys.service,TENANT_ID:c.project,STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/mnt',FILE_SIZE_LIMIT:'10485760',UPLOAD_FILE_SIZE_LIMIT:'10485760',UPLOAD_FILE_SIZE_LIMIT_STANDARD:'10485760',S3_PROTOCOL_ENABLED:'false',ENABLE_IMAGE_TRANSFORMATION:'false',IMAGE_TRANSFORMATION_ENABLED:'false',POSTGREST_URL:'http://'+c.project+'-rest:3000',DB_MIGRATIONS_FREEZE_AT:env[2].DB_MIGRATIONS_FREEZE_AT||''},
  };
  const services={};
  for(const [i,service]of ['auth','rest','storage'].entries()){
    const s=source[i];services[service]={image:s.Image,container_name:c.project+'-'+service,command:s.Config.Cmd,environment:environments[service],user:s.Config.User||undefined,networks:[network],ports:[{target:[9999,3000,5000][i],published:String(c.port+i),host_ip:'127.0.0.1',protocol:'tcp'}],labels:{'clinia.contract.project':c.project,'clinia.contract.database':c.database},restart:'no',read_only:true,tmpfs:['/tmp:rw,noexec,nosuid,size=67108864'],cap_drop:['ALL'],security_opt:['no-new-privileges:true'],mem_limit:service==='storage'?'512m':'256m',cpus:1};
    if(s.Config.Healthcheck)services[service].healthcheck={test:s.Config.Healthcheck.Test,interval:'10s',timeout:'2s',retries:3,start_period:'10s'};
    if(service==='storage')services[service].volumes=[{type:'volume',source:c.project+'-bytes',target:'/mnt'}];
  }
  const spec={name:c.project,services,networks:{[network]:{external:true,name:network}},volumes:{[c.project+'-bytes']:{name:c.project+'-bytes',labels:{'clinia.contract.project':c.project}}}};
  fs.writeFileSync(c.keys,JSON.stringify(keys,null,2),{flag:'wx'});fs.writeFileSync(c.compose,JSON.stringify(spec,null,2),{flag:'wx'});read(variant);
  return {state:'PREPARED',project:c.project,database:c.database,ports:[c.port,c.port+1,c.port+2],managedBefore:keys.managedBefore};
}
function inspect(variant){
  const {c}=read(variant);local.inspectLocal();
  const containers=JSON.parse(native(['inspect',...['auth','rest','storage'].map(s=>c.project+'-'+s)]));
  for(const s of containers){assert.equal(s.Config.Labels['clinia.contract.project'],c.project);assert.equal(s.HostConfig.Privileged,false);assert.deepEqual(Object.keys(s.NetworkSettings.Networks),[network]);for(const bindings of Object.values(s.NetworkSettings.Ports||{}))for(const b of bindings||[])assert.equal(b.HostIp,'127.0.0.1');}
  return containers.map(s=>({name:s.Name,imageId:s.Image,state:s.State.Status,health:s.State.Health?.Status||null,ports:s.NetworkSettings.Ports,mounts:s.Mounts.map(m=>({type:m.Type,name:m.Name,target:m.Destination}))}));
}
async function start(variant){
  const {c}=read(variant);local.inspectLocal();
  const active=native(['ps','--filter','label=clinia.contract.project','--format','{{.Names}}']).split(/\r?\n/).filter(Boolean);
  assert.equal(active.length,0,'Stop the preceding isolated API first');
  sql(variant,`GRANT CONNECT ON DATABASE ${c.database} TO supabase_auth_admin,authenticator,supabase_storage_admin;`);
  try{
    native(['compose','-f',c.compose,'up','-d','--pull','never','--wait','--wait-timeout','45']);
    const runtime=inspect(variant);assert.ok(runtime.every(s=>s.state==='running'&&(!s.health||s.health==='healthy')),'Isolated services are not ready');
    await Promise.all(['/health','/','/status'].map(async(route,i)=>{
      const response=await fetch('http://127.0.0.1:'+(c.port+i)+route,{signal:AbortSignal.timeout(10000),redirect:'error'});
      const allowed=i===1?[200,401,403]:[200];assert.ok(allowed.includes(response.status),'Isolated HTTP readiness failed');await response.body?.cancel();
    }));
    assert.deepEqual(managedState(variant),read(variant).keys.managedBefore,'Managed migration/state changed unexpectedly; review preserved clone');
    return runtime;
  }catch(e){
    try{native(['compose','-f',c.compose,'stop','--timeout','10']);}catch{throw new Error('Isolated startup failed; automatic stop also failed; inspect only this candidate');}
    throw new Error('Isolated startup failed and candidate stopped; '+e.message);
  }
}
function stop(variant){const {c}=read(variant);local.inspectLocal();native(['compose','-f',c.compose,'stop']);return {state:'STOPPED_VOLUMES_PRESERVED',database:c.database};}
function diagnose(variant){
  const {c,spec,keys}=read(variant);local.inspectLocal();const result=[];
  for(const service of ['auth','rest','storage']){
    const r=spawnSync(docker,['--context','desktop-linux','logs','--tail','30',c.project+'-'+service],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    assert.ok(!r.error&&r.status===0,'Cannot read isolated service diagnostics');
    let log=(r.stdout||'')+(r.stderr||'');
    for(const value of [keys.secret,keys.anon,keys.service,...Object.values(spec.services).map(s=>new URL(s.environment.GOTRUE_DB_DATABASE_URL||s.environment.PGRST_DB_URI||s.environment.DATABASE_URL).password)])if(value)log=log.split(value).join('[REDACTED]');
    log=log.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[DB URI REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT REDACTED]');
    const state=JSON.parse(native(['inspect',c.project+'-'+service]))[0].State;
    result.push({service,state:state.Status,exitCode:state.ExitCode,oomKilled:state.OOMKilled,health:state.Health?.Status,healthProbes:state.Health?.Log?.slice(-3).map(h=>({exitCode:h.ExitCode,output:h.Output.slice(0,300)})),log:log.slice(-6000)});
  }
  return result;
}
if(require.main===module){(async()=>{const [operation,variant]=process.argv.slice(2);assert.equal(process.argv.length,4);assert.ok(['prepare','start','stop','inspect','diagnose'].includes(operation));console.log(JSON.stringify(await {prepare,start,stop,inspect,diagnose}[operation](variant)));})().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={config,read,prepare,start,stop,inspect,sql,managedState};
