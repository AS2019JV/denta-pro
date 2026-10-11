'use strict';
// Reviewed forward path from the restored captures, in NEW local clones only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
function plan(variant,attempt){
  assert.ok(['stage','linked'].includes(variant));assert.match(String(attempt),/^[1-9]$/);
  return {variant,database:`clinia_upgrade_${variant}_20261002_${attempt}`,
    source:variant==='stage'?'clinia_restore_stage_20261001_1':'clinia_restore_linked_20261001_2',
    evidence:path.join(local.repo,'docs/production/evidence/2026-10-02-captured-upgrade',`${variant}-${attempt}`)};
}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(variant,attempt){
  const p=plan(variant,attempt),report={startedAt:new Date().toISOString(),status:'NOT VERIFIED',...p,steps:[],limits:[
    'Captured application schema on local managed template; not clean managed install',
    'Private bucket metadata fixtures; no restoration of bytes/configuration or independent API',
    'No remote migration, repair, data copy or cleanup; all targets preserved']};
  assert.ok(!fs.existsSync(p.evidence),'New evidence required');fs.mkdirSync(p.evidence,{recursive:true});
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  const persist=()=>fs.writeFileSync(path.join(p.evidence,'execution.json'),JSON.stringify(report,null,2));
  function sql(db,text,role='postgres'){
    assert.ok(['template1','postgres',p.source,p.database].includes(db));assert.ok(['postgres','supabase_admin'].includes(role));
    const r=spawnSync(docker,['--context','desktop-linux','exec','-i','--user','postgres','supabase_db_clinia-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',db,'-f','/dev/stdin'],{input:text,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:8*1024*1024});
    if(r.error||r.status!==0){const file=`captured-upgrade-${variant}-${attempt}-${report.steps.length}.private.log`;fs.writeFileSync(path.join(local.privateDir,file),(r.stdout||'')+(r.stderr||''),{flag:'wx'});report.diagnostic=file;throw Error('Reviewed forward failed; target and private diagnostic preserved');}return r.stdout.trim();
  }
  const markers="SET app.scoped_fixture_authorized='local-synthetic'; SET app.encargo02_authorized='reviewed-local-forward'; SET app.operational_convergence_authorized='reviewed-local-contract';\n";
  function step(name,text,role='postgres',db=p.database){report.steps.push({name,role,database:db,sha256:hash(text),status:'NOT VERIFIED'});persist();sql(db,markers+text,role);report.steps.at(-1).status='VERIFIED';persist();}
  try{
    report.runtime=local.inspectDatabase();
    assert.equal(sql('template1',`SELECT count(*) FROM pg_database WHERE datname='${p.database}';`),'0');
    assert.equal(sql(p.source,'SELECT count(*) FROM auth.users;'),'0','Empty captured managed template required');
    step('clone-restored-capture',`CREATE DATABASE ${p.database} TEMPLATE ${p.source} OWNER postgres; REVOKE CONNECT ON DATABASE ${p.database} FROM PUBLIC;`,'supabase_admin','template1');
    const read=relative=>fs.readFileSync(path.join(local.repo,relative),'utf8');
    const m7=read('supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql');
    assert.equal(hash(m7),'cd6fbf5ab50dc4b214b587febacb7534fb3816b1f0c76767d83aa1b6519ea47d');
    if(variant==='stage')step('m7-captured-stage-bridge',require('./clinia-captured-stage-m7-bridge.cjs').build(p.database,m7),'supabase_admin');
    else step('m7',m7,'supabase_admin');
    step('m7-exact-owners',read('docs/production/reconciliation/encargo01_local_m7_owners.sql'),'supabase_admin');
    const before=read('docs/production/reconciliation/operational-convergence/before-authority.sql');
    assert.equal(hash(before),JSON.parse(read('docs/production/reconciliation/operational-convergence/proposal-manifest.json')).sqlSha256);
    step('operational-prerequisites',before);
    const buckets=JSON.parse(sql('postgres',"SELECT json_agg(json_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) ORDER BY id) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars');"));
    assert.equal(buckets.length,4);assert.ok(buckets.every(b=>b.public===false));
    const literal=JSON.stringify(buckets).replace(/'/g,"''");
    step('private-bucket-metadata-fixtures',`INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) SELECT id,name,public,file_size_limit,allowed_mime_types FROM json_populate_recordset(NULL::storage.buckets,'${literal}'::json);`,'supabase_admin');
    for(const [name,file]of [
      ['authority','docs/production/reconciliation/encargo02/forward.sql'],
      ['operational-callbacks','docs/production/reconciliation/operational-convergence/after-authority.sql'],
      ['agenda','tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql'],
      ['reports','tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql'],
      ['canonical-catalog','docs/production/reconciliation/final-contract/verify.sql'],
      ['canonical-boundaries','docs/production/reconciliation/operational-convergence/verify-boundaries.sql'],
      ['pending-invitations','supabase/migrations/20261001120000_invitation_pending_reservation.sql'],
      ['durable-email','supabase/migrations/20261001130000_durable_email_abuse_budget.sql'],
      ['profile-guard','supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql'],
    ])step(name,read(file));
    report.status='VERIFIED';
  }catch(e){report.error=e.message;process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,steps:report.steps.map(s=>({name:s.name,status:s.status})),error:report.error||null,evidence:p.evidence}));}
}
if(require.main===module){assert.equal(process.argv.length,4);main(...process.argv.slice(2));}
module.exports={plan};
