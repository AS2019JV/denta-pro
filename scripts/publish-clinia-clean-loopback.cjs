'use strict';
// Preserve the new clean internal network/data volumes; move only this runtime to
// a new bridge with actual loopback publication. No application DDL or reset.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process'),{plan}=require('./prepare-clinia-clean-managed.cjs');
const local=require('./clinia-local-runtime.cjs');const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(attempt,resumeForce=false){
  const p=plan(attempt),newNetwork=p.project+'-published-loopback',composeFile=path.join(p.privateDir,'runtime.compose.json'),manifestFile=path.join(p.privateDir,'manifest.json');
  const original=fs.readFileSync(composeFile),manifest=JSON.parse(fs.readFileSync(manifestFile)),spec=JSON.parse(original);
  assert.equal(sha(original),manifest.preparedComposeSha256);
  if(resumeForce){assert.equal(manifest.network,newNetwork);assert.equal(manifest.publicationCorrection.priorNetwork,p.network);assert.equal(spec.networks.local.internal,false);}
  else{assert.equal(manifest.network,p.network);assert.equal(spec.networks.local.internal,true);}
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');let sequence=0;
  function run(args,input){const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:6*1024*1024});fs.writeFileSync(path.join(p.privateDir,`publication-${Date.now()}-${sequence++}.private.log`),(r.stdout||'')+(r.stderr||''),{flag:'wx'});if(r.error||r.status!==0)throw Error('Clean publication operation failed; all networks/volumes/logs preserved');return r.stdout.trim();}
  assert.equal(run(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),'npipe:////./pipe/dockerDesktopLinuxEngine');
  if(!resumeForce)assert.ok(!run(['network','ls','--format','{{.Name}}']).split('\n').includes(newNetwork),'New publication network already exists');
  const services=['db','auth','storage','kong','rest','inbucket'];
  const containers=JSON.parse(run(['inspect',...services.map(key=>`supabase_${key}_${p.project}`)]));
  containers.forEach((c,i)=>{assert.equal(c.Name,`/supabase_${services[i]}_${p.project}`);assert.equal(c.Image,manifest.imageIds[services[i]]);assert.equal(c.Config.Labels['com.supabase.cli.project'],p.project);assert.ok(!c.HostConfig.Privileged);if(!resumeForce)assert.deepEqual(Object.keys(c.NetworkSettings.Networks),[p.network]);else assert.ok(Object.keys(c.NetworkSettings.Networks).every(name=>[p.network,newNetwork].includes(name)));for(const m of c.Mounts||[])if(m.Type==='volume')assert.ok(Object.values(p.volumes).includes(m.Name));});
  const stateSql="SELECT json_build_object('auth',(SELECT json_agg(to_jsonb(m) ORDER BY version) FROM auth.schema_migrations m),'storage',(SELECT json_agg(to_jsonb(m) ORDER BY id) FROM storage.migrations m),'users',(SELECT count(*) FROM auth.users),'objects',(SELECT count(*) FROM storage.objects),'patients',(SELECT count(*) FROM public.patients));";
  const sql=()=>JSON.parse(run(['exec','--user','postgres',`supabase_db_${p.project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',stateSql]));
  const before=resumeForce?JSON.parse(fs.readFileSync(path.join(p.privateDir,fs.readdirSync(p.privateDir).filter(name=>/^publication-\d+-3\.private\.log$/.test(name)).sort().at(-1)),'utf8')):sql();assert.equal(before.users,0);assert.equal(before.objects,0);assert.equal(before.patients,0);
  if(!resumeForce){
  fs.writeFileSync(path.join(p.privateDir,'runtime.internal-before-publication.private.json'),original,{flag:'wx'});
  fs.writeFileSync(path.join(p.privateDir,'manifest.internal-before-publication.private.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  spec.networks.local.name=newNetwork;spec.networks.local.internal=false;
  const updated=JSON.stringify(spec,null,2);fs.writeFileSync(composeFile,updated);
  manifest.network=newNetwork;manifest.publicationCorrection={priorNetwork:p.network,priorComposeSha256:manifest.preparedComposeSha256,reason:'Internal bridge suppressed HostConfig loopback published ports; old network preserved'};
  manifest.preparedComposeSha256=sha(updated);fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
  }
  run(['compose','--project-name',p.project,'-f',composeFile,'config','--quiet']);
  run(['compose','--project-name',p.project,'-f',composeFile,'up','-d','--force-recreate','--pull','never','--wait','--wait-timeout','180',...services]);
  const runtime=require('./clinia-clean-api.cjs').inspect('clean-managed-'+attempt),after=sql();assert.deepEqual(after,before,'Managed migrations or synthetic data changed during publication');
  const priorNetworkPreserved=run(['network','ls','--format','{{.Name}}']).split('\n').includes(p.network);
  const evidence=path.join(local.repo,'docs/production/evidence/2026-10-02-clean-managed',`attempt-${attempt}`,'publication.json');
  fs.writeFileSync(evidence,JSON.stringify({status:'LOOPBACK_PUBLICATION_VERIFIED',oldNetwork:p.network,newNetwork,priorNetworkPreserved,networkLineage:priorNetworkPreserved?'Original network preserved':'Compose removed empty original network during rename; original private config and failure logs preserved',volumes:p.volumes,runtime,managedBefore:before,managedAfter:after,composeSha256:manifest.preparedComposeSha256,completedAt:new Date().toISOString()},null,2),{flag:'wx'});
  console.log(JSON.stringify({status:'LOOPBACK_PUBLICATION_VERIFIED',project:p.project,ports:p.ports,evidence}));
}
if(require.main===module){assert.ok(process.argv.length===3||(process.argv.length===4&&process.argv[3]==='--resume-force-recreate'));try{main(process.argv[2],process.argv.length===4);}catch(error){console.error(error.message);process.exitCode=1;}}
