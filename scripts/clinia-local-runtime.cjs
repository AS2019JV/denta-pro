'use strict';
// Local-only transport for synthetic acceptance. Never loads the application's env.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname,'..');
const privateDir = path.join(repo,'tools/local-supabase/supabase/.temp');
const project = 'clinia-acceptance';
// Pure planner tests also load this module in Linux CI; execution still requires
// the verified Windows Desktop named pipe and fixed executable below.
const dockerDir = path.join(process.env.LOCALAPPDATA||'','Programs/DockerDesktop/resources/bin');
const docker = path.join(dockerDir,'docker.exe');
const env = {...process.env,PATH:dockerDir+';'+process.env.PATH};
const url = 'http://127.0.0.1:56321';
function run(args,input) {
  const r=spawnSync(docker,['--context','desktop-linux',...args],{cwd:repo,env,input,encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:12*1024*1024});
  if(r.error||r.status!==0) {
    fs.mkdirSync(privateDir,{recursive:true});
    fs.writeFileSync(path.join(privateDir,'acceptance-error.private.log'),(r.stdout||'')+(r.stderr||''));
    throw new Error(`Local Docker ${args[0]} failed (${r.status ?? r.error?.code}); private diagnostics saved`);
  }
  return r.stdout.trim();
}
function inspectConfiguration() {
  if(run(['context','show'])!=='desktop-linux'||run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'])!=='npipe:////./pipe/dockerDesktopLinuxEngine')
    throw new Error('Local Desktop named pipe required');
  if(fs.existsSync(path.join(privateDir,'project-ref'))) throw new Error('Remote link refused');
  const config=fs.readFileSync(path.join(repo,'tools/local-supabase/supabase/config.toml'),'utf8');
  if(!/^project_id = "clinia-acceptance"$/m.test(config)) throw new Error('Unexpected local project');
}
function inspectDatabase() {
  inspectConfiguration();
  const c=JSON.parse(run(['inspect',`supabase_db_${project}`]))[0];
  if(c.Name!==`/supabase_db_${project}`||c.Config.Labels['com.supabase.cli.project']!==project||c.State.Status!=='running'||
    c.State.Health?.Status!=='healthy'||c.HostConfig.Privileged||
    Object.keys(c.NetworkSettings.Networks).length!==1||!c.NetworkSettings.Networks['clinia-acceptance-loopback'])
    throw new Error('Unexpected acceptance database state');
  for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const b of bindings||[])
    if(b.HostIp!=='127.0.0.1')throw new Error('Non-loopback database publication refused');
  return {name:c.Name,imageId:c.Image,state:c.State.Status,health:c.State.Health.Status,ports:c.NetworkSettings.Ports};
}
function inspectLocal() {
  inspectConfiguration();
  const containers=JSON.parse(run(['inspect',...['db','kong','auth','inbucket','realtime','rest','storage'].map(x=>`supabase_${x}_${project}`)]));
  for(const c of containers) {
    if(c.Config.Labels['com.supabase.cli.project']!==project||c.State.Status!=='running'||c.HostConfig.Privileged||
      Object.keys(c.NetworkSettings.Networks).some(n=>n!=='clinia-acceptance-loopback')||
      (c.State.Health&&c.State.Health.Status!=='healthy')) throw new Error('Unexpected acceptance container state');
    for(const bindings of Object.values(c.NetworkSettings.Ports||{})) for(const b of bindings||[])
      if(b.HostIp!=='127.0.0.1') throw new Error('Non-loopback publication refused');
  }
  return containers.map(c=>({name:c.Name,imageId:c.Image,state:c.State.Status,health:c.State.Health?.Status||null,ports:c.NetworkSettings.Ports}));
}
function keys() {
  // Reinspect the current local Storage service; a stale capture is not authority.
  const c=JSON.parse(run(['inspect',`supabase_storage_${project}`]))[0];
  const get=name=>c.Config.Env.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  const anon=get('ANON_KEY'), service=get('SERVICE_KEY');
  if(!anon||!service) throw new Error('Official local API keys absent');
  return {anon,service};
}
function sql(database,text,role='supabase_admin') {
  if(!['postgres','clinia_stage_clean','clinia_prod_upgrade'].includes(database)||!['postgres','supabase_admin'].includes(role))
    throw new Error('SQL target/role refused');
  return run(['exec','-i','--user','postgres',`supabase_db_${project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',database,'-f','/dev/stdin'],text);
}
function sqlFile(database,relative,role='supabase_admin',extra='') {
  const file=path.resolve(repo,relative);
  if(!file.startsWith(repo+path.sep)||path.extname(file)!=='.sql') throw new Error('SQL file outside workspace');
  return sql(database,"SET app.scoped_fixture_authorized='local-synthetic';\n"+extra+fs.readFileSync(file,'utf8'),role);
}
module.exports={repo,privateDir,url,inspectLocal,inspectDatabase,keys,sql,sqlFile};
