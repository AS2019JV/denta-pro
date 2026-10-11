'use strict';
// Preparation/check ONLY. This script never starts services or creates Docker volumes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),net=require('node:net');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
const {quoteCompose}=require('./prepare-clinia-compose.cjs');
const sourceProject='clinia-acceptance';
const sourceSha256='f7ac6e41f961dbec321dc5ccda7222f377e27f55c5bb2d2222ed46a2cbe308f7';
const keys=['db','kong','auth','inbucket','realtime','rest','storage'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function plan(attempt){
  assert.match(String(attempt),/^[1-9]$/,'Exact NEW clean managed attempt 1..9 required');
  const project=`clinia-clean-20261002-${attempt}`,base=56400+Number(attempt)*10;
  return {attempt:String(attempt),project,network:project+'-loopback',
    ports:{api:base+1,db:base+2,mail:base+4},appOrigin:`http://127.0.0.1:${3500+Number(attempt)}`,
    apiUrl:`http://127.0.0.1:${base+1}`,volumes:{db:'supabase_db_'+project,storage:'supabase_storage_'+project},
    containers:keys.map(key=>`supabase_${key}_${project}`),
    privateDir:path.join(local.privateDir,'clean-managed-20261002-'+attempt)};
}
function signingMaterial(p){
  const secret=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(32).toString('hex');
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const kid=crypto.randomUUID(),metadata={kid,use:'sig',alg:'ES256',ext:true};
  const privateJwk={...privateKey.export({format:'jwk'}),...metadata,key_ops:['sign','verify']};
  const publicJwk={...publicKey.export({format:'jwk'}),...metadata,key_ops:['verify']};
  const jwks={keys:[publicJwk,{kty:'oct',k:Buffer.from(secret).toString('base64url')}]};
  const now=Math.floor(Date.now()/1000);
  const jwt=role=>{
    const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const body=Buffer.from(JSON.stringify({iss:'supabase',role,iat:now,exp:now+86400*30})).toString('base64url');
    return head+'.'+body+'.'+crypto.createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
  };
  return {secret,password,privateJwk,jwks,anon:jwt('anon'),service:jwt('service_role'),
    sodium:crypto.randomBytes(32).toString('hex'),realtimeEncryption:crypto.randomBytes(16).toString('hex'),
    realtimeSecret:crypto.randomBytes(32).toString('hex'),project:p.project};
}
const envGet=(s,key)=>s.environment.find(value=>value.startsWith(key+'='))?.slice(key.length+1);
const envSet=(s,key,value)=>{
  const old=s.environment.findIndex(item=>item.startsWith(key+'='));
  if(old===-1)s.environment.push(key+'='+value);else s.environment[old]=key+'='+value;
};
function unquote(value){
  if(typeof value==='string')return value.replaceAll('$$','$');
  if(Array.isArray(value))return value.map(unquote);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,unquote(item)]));
  return value;
}
function transform(source,p,material){
  assert.deepEqual(Object.keys(source.services).sort(),[...keys].sort(),'Exact reviewed seven-service capture required');
  const original=unquote(source),oldPassword=envGet(original.services.db,'POSTGRES_PASSWORD'),oldSecret=envGet(original.services.db,'JWT_SECRET');
  const oldAnon=envGet(original.services.storage,'ANON_KEY'),oldService=envGet(original.services.storage,'SERVICE_KEY');
  assert.ok(oldPassword&&oldSecret&&oldAnon&&oldService,'Reviewed local credentials required');
  function rewrite(value){
    if(typeof value==='string')return value.replaceAll(sourceProject,p.project)
      .replaceAll('http://127.0.0.1:56321',p.apiUrl).replaceAll('http://localhost:56321',p.apiUrl)
      .replaceAll(':'+encodeURIComponent(oldPassword)+'@',':'+material.password+'@')
      .replaceAll(':'+oldPassword+'@',':'+material.password+'@').replaceAll(oldSecret,material.secret)
      .replaceAll(oldAnon,material.anon).replaceAll(oldService,material.service);
    if(Array.isArray(value))return value.map(rewrite);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewrite(item)]));
    return value;
  }
  const result={name:p.project,services:{},volumes:{},networks:{local:{name:p.network,internal:false,
    driver:'bridge',driver_opts:{'com.docker.network.bridge.host_binding_ipv4':'127.0.0.1'},
    labels:{'clinia.environment':'clean-managed-synthetic'}}}};
  for(const key of keys){
    const s=rewrite(original.services[key]);
    assert.match(s.image,/^sha256:[0-9a-f]{64}$/,'Installed immutable image identity required');
    assert.equal(original.services[key].container_name,`supabase_${key}_${sourceProject}`);
    s.container_name=`supabase_${key}_${p.project}`;
    s.labels={'clinia.environment':'clean-managed-synthetic','clinia.source':'reviewed-cli-2.117.0-capture','com.supabase.cli.project':p.project};
    s.volumes=[];
    for(const mount of original.services[key].volumes||[]){
      if(mount.type==='volume'){
        assert.ok(['db','storage'].includes(key));assert.equal(mount.source,`supabase_${key}_${sourceProject}`);
        s.volumes.push({...mount,source:p.volumes[key]});
        result.volumes[p.volumes[key]]={name:p.volumes[key],labels:{'clinia.environment':'clean-managed-synthetic'}};
      }else{
        assert.equal(mount.type,'bind');assert.ok(mount.read_only);assert.ok(['db','kong'].includes(key));
        assert.equal(path.resolve(mount.source),path.join(local.privateDir,path.basename(mount.source)));
        s.volumes.push({...mount,source:path.join(p.privateDir,path.basename(mount.source))});
      }
    }
    for(const port of s.ports||[]){
      assert.equal(port.host_ip,'127.0.0.1');assert.equal(port.protocol,'tcp');
      const mapped={56321:p.ports.api,56322:p.ports.db,56324:p.ports.mail}[Number(port.published)];
      assert.ok(mapped,'Unreviewed port refused');port.published=String(mapped);
    }
    result.services[key]=s;
  }
  assert.deepEqual(Object.keys(result.volumes).sort(),Object.values(p.volumes).sort(),'Two entirely new managed volumes required');
  envSet(result.services.db,'POSTGRES_PASSWORD',material.password);envSet(result.services.db,'JWT_SECRET',material.secret);
  envSet(result.services.realtime,'DB_PASSWORD',material.password);
  envSet(result.services.auth,'GOTRUE_JWT_KEYS',JSON.stringify([material.privateJwk]));
  envSet(result.services.auth,'GOTRUE_JWT_ISSUER',p.apiUrl+'/auth/v1');
  envSet(result.services.auth,'GOTRUE_SITE_URL',p.appOrigin);envSet(result.services.auth,'GOTRUE_URI_ALLOW_LIST',p.appOrigin+'/**');
  envSet(result.services.auth,'API_EXTERNAL_URL',p.apiUrl);
  envSet(result.services.rest,'PGRST_JWT_SECRET',JSON.stringify(material.jwks));
  envSet(result.services.storage,'JWT_JWKS',JSON.stringify(material.jwks));
  envSet(result.services.storage,'TENANT_ID',p.project);
  envSet(result.services.realtime,'API_JWT_JWKS',JSON.stringify(material.jwks));
  envSet(result.services.realtime,'DB_ENC_KEY',material.realtimeEncryption);
  envSet(result.services.realtime,'SECRET_KEY_BASE',material.realtimeSecret);
  const encoded=JSON.stringify(result);
  // A local default password can equal a role/database name. Replace credential
  // fields and URI password components, never identifiers or initialization SQL.
  assert.ok(!encoded.includes(':'+encodeURIComponent(oldPassword)+'@'),'Old URI password survived');
  for(const value of [oldSecret,oldAnon,oldService])assert.ok(!encoded.includes(value),'Old credential survived fresh configuration');
  assert.ok(!encoded.includes(sourceProject),'Occupied project reference survived transformation');
  return {compose:quoteCompose(result),rewrite,oldAnon,oldService};
}
async function main(action,attempt){
  assert.ok(['prepare','check'].includes(action),'Use prepare|check and NEW attempt 1..9');
  const p=plan(attempt),docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  function run(args){
    const r=spawnSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:2*1024*1024});
    if(r.error||r.status!==0)throw Error('Local read-only Docker prerequisite failed');return r.stdout.trim();
  }
  assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
  const names=run(['container','ls','-a','--format','{{.Names}}']).split('\n');
  assert.ok(!names.some(name=>p.containers.includes(name)||name.includes(p.project)),'Occupied clean container identity refused');
  assert.equal(run(['container','ls','-aq','--filter','label=com.docker.compose.project='+p.project]),'','Occupied Compose project refused');
  const volumes=run(['volume','ls','-q']).split('\n');
  assert.ok(!volumes.some(name=>Object.values(p.volumes).includes(name)||name.includes(p.project)),'Existing volumes refused; never reuse/reset');
  assert.ok(!run(['network','ls','--format','{{.Name}}']).split('\n').includes(p.network),'Existing clean network refused');
  for(const port of Object.values(p.ports))await new Promise((resolve,reject)=>{
    const probe=net.createServer();probe.once('error',()=>reject(Error('Clean loopback port occupied')));
    probe.listen(port,'127.0.0.1',()=>probe.close(resolve));
  });
  if(action==='check'){
    assert.ok(fs.existsSync(path.join(p.privateDir,'runtime.compose.json')),'Prepared private runtime required');
    console.log(JSON.stringify({state:'NEW_DESTINATIONS_AVAILABLE_NOT_STARTED',project:p.project,ports:p.ports}));return;
  }
  assert.ok(!fs.existsSync(p.privateDir),'Preparation already exists; preserve and choose another attempt');
  const sourceFile=path.join(local.privateDir,'runtime.compose.json'),raw=fs.readFileSync(sourceFile);
  assert.equal(hash(raw),sourceSha256,'Reviewed official runtime capture changed; review without launch');
  const source=JSON.parse(raw),material=signingMaterial(p),{compose,rewrite,oldAnon,oldService}=transform(source,p,material);
  const imageIds=Object.fromEntries(Object.entries(compose.services).map(([key,s])=>[key,s.image]));
  for(const id of Object.values(imageIds))assert.equal(run(['image','inspect',id,'--format','{{.Id}}']),id,'Installed pinned image required; no pull permitted');
  const configFile=path.join(local.repo,'tools/local-supabase/supabase/config.toml');
  const sourceConfig=fs.readFileSync(configFile,'utf8');assert.match(sourceConfig,/^project_id = "clinia-acceptance"$/m);
  const config=sourceConfig.replace('project_id = "clinia-acceptance"',`project_id = "${p.project}"`)
    .replace(/\b56321\b/g,String(p.ports.api)).replace(/\b56322\b/g,String(p.ports.db)).replace(/\b56324\b/g,String(p.ports.mail));
  const kongFile=path.join(local.privateDir,'kong-kong.yml'),kong=fs.readFileSync(kongFile,'utf8');
  assert.ok(kong.includes(oldAnon)&&kong.includes(oldService),'Reviewed Kong API credentials required');
  fs.mkdirSync(p.privateDir,{recursive:false});
  fs.writeFileSync(path.join(p.privateDir,'runtime.compose.json'),JSON.stringify(compose,null,2),{flag:'wx'});
  fs.writeFileSync(path.join(p.privateDir,'credentials.private.json'),JSON.stringify(material),{flag:'wx'});
  fs.writeFileSync(path.join(p.privateDir,'db-pgsodium_root.key'),material.sodium,{flag:'wx'});
  fs.writeFileSync(path.join(p.privateDir,'kong-kong.yml'),rewrite(kong),{flag:'wx'});
  for(const name of ['kong-localhost.crt','kong-localhost.key'])fs.copyFileSync(path.join(local.privateDir,name),path.join(p.privateDir,name),fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(p.privateDir,'config.toml'),config,{flag:'wx'});
  const manifest={state:'PREPARED_NOT_INITIALIZED',project:p.project,ports:p.ports,network:p.network,volumes:p.volumes,imageIds,
    sourceComposeSha256:sourceSha256,sourceConfigSha256:hash(sourceConfig),preparedComposeSha256:hash(JSON.stringify(compose,null,2)),
    limits:['No Docker volume, container or network created by preparer','Fresh managed initialization and migrations must be observed at runtime',
      'Fresh Auth ES256 and legacy API credentials; local unexposed TLS certificate copied',
      'Captured application baseline is a later separate reviewed installation; not a remote backup or managed-provider parity',
      'New onboarding/prescription migrations require independent review and inclusion after runtime tests']};
  fs.writeFileSync(path.join(p.privateDir,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  console.log(JSON.stringify({state:manifest.state,project:p.project,ports:p.ports,compose:path.join(p.privateDir,'runtime.compose.json')}));
}
if(require.main===module){assert.equal(process.argv.length,4);main(process.argv[2],process.argv[3]).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={plan,signingMaterial,transform};
