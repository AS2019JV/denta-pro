'use strict';
// Actual local SQL installation evidence; not a remote clone, Auth acceptance or DR test.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const project = 'clinia-acceptance';
const dbContainer = `supabase_db_${project}`;
const dockerDir = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin');
const docker = path.join(dockerDir, 'docker.exe');
const privateDir = path.join(repo, 'tools/local-supabase/supabase/.temp');
const composeFile = path.join(privateDir, 'runtime.compose.json');
const env = { ...process.env, PATH: dockerDir + ';' + process.env.PATH,
  SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
const targets = ['clinia_stage_clean', 'clinia_prod_upgrade'];
const evidenceName = process.argv[2] || 'local-runtime';
if (!/^local-runtime(?:-[a-z0-9-]{1,40})?$/.test(evidenceName)) throw new Error('Evidence directory name refused');
const resumeReviewed = process.argv[3] === '--resume-reviewed';
if (process.argv[3] && !resumeReviewed) throw new Error('Unsupported operation');
const output = path.join(repo, 'docs/production/evidence/2026-09-27', evidenceName);
let madeOutput = false;
let quiesced = false;
const result = { startedAt: new Date().toISOString(), kind: 'local-synthetic-sql-runtime',
  project, databases: targets, noRemoteMutation: true, checks: [], limitations:
    ['Metadata-derived fixtures are not pg_dump or a complete remote clone.',
     'Secondary databases have no independent Auth/PostgREST/Storage endpoints.',
     'This checks SQL structure and integrity, not ordinary role/JWT/browser access.',
     'No clinical production, backup restoration or legal approval is claimed.'] };
function native(args, input, filename) {
  const r = spawnSync(docker, args, { cwd: repo, env, input, encoding: 'utf8',
    windowsHide: true, timeout: 90000, maxBuffer: 12 * 1024 * 1024 });
  if (filename) fs.writeFileSync(path.join(output, filename), (r.stdout || '') + (r.stderr || ''));
  if (r.error || r.status !== 0) {
    result.checks.push({ command: args[0], file: filename || null, exit: r.status, errorCode: r.error?.code });
    throw new Error(`Local ${args[0]} failed; saved evidence or private diagnostics required`);
  }
  return r.stdout.trim();
}
function sql(database, text, filename, role = 'supabase_admin') {
  if (!['postgres','template1',...targets].includes(database)) throw new Error('Database target refused');
  if (!['postgres','supabase_admin'].includes(role)) throw new Error('Maintenance role refused');
  return native(['exec','-i','--user','postgres',dbContainer,'psql','-X','-qAt','-v','ON_ERROR_STOP=1',
    '-U',role,'-d',database,'-f','/dev/stdin'], text, filename);
}
function check(name, actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  result.checks.push({ name, actual, expected, passed });
  if (!passed) throw new Error(`Acceptance check failed: ${name}`);
}
function fileHash(relative) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,relative))).digest('hex'); }
function capture(database, prefix) {
  let query = fs.readFileSync(path.join(repo,'docs/production/evidence/2026-09-27/capture-scoped-metadata.sql'),'utf8');
  const historyExists = sql(database, "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;") === 't';
  if (!historyExists) {
    const original = "(SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations)";
    if (!query.includes(original)) throw new Error('Capture history branch changed; review');
    query = query.replace(original, "'[]'::jsonb");
  }
  const snapshot = JSON.parse(sql(database, 'SET search_path=public,extensions,pg_catalog;\n' + query, prefix + '-capture.log'));
  snapshot.projectRef = 'local-synthetic:' + database;
  snapshot.evidenceKind = 'actual-local-sql-catalog';
  snapshot.localMigrationHistoryTableExists = historyExists;
  fs.writeFileSync(path.join(output, prefix + '.metadata.json'), JSON.stringify(snapshot, null, 2));
  const manifest = `docs/production/reconciliation/scoped-baseline/${prefix}-deny-v2.manifest.json`;
  const r = spawnSync(process.execPath, ['scripts/generate-scoped-supabase-baseline.cjs','verify','--manifest',manifest,
    '--actual',path.join(output,prefix+'.metadata.json'),'--output',path.join(output,prefix+'-verification.json')],
    { cwd:repo, env, encoding:'utf8', windowsHide:true });
  fs.writeFileSync(path.join(output,prefix+'-verification.log'),(r.stdout||'')+(r.stderr||''));
  result.checks.push({ name: prefix+' scoped metadata', exit:r.status, passed:r.status===0 });
  if (r.status !== 0) throw new Error(`${prefix} scoped verification differs; review saved report`);
}
function execute() {
  if (fs.existsSync(output)) throw new Error('Evidence target exists; refusing replay/overwrite');
  fs.mkdirSync(output, {recursive:true});
  madeOutput = true;
  check('Desktop context',native(['context','show']), 'desktop-linux');
  check('Local named pipe',native(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']),
    'npipe:////./pipe/dockerDesktopLinuxEngine');
  check('No remote link',fs.existsSync(path.join(privateDir,'project-ref')),false);
  const containers = JSON.parse(native(['inspect',...['db','kong','auth','inbucket','realtime','rest','storage'].map(x=>`supabase_${x}_${project}`)]));
  result.runtime = containers.map(c=>({ name:c.Name, imageId:c.Image, state:c.State.Status, health:c.State.Health?.Status||null,
    ports:c.NetworkSettings.Ports, privileged:c.HostConfig.Privileged, restart:c.HostConfig.RestartPolicy.Name,
    mounts:c.Mounts.map(m=>({type:m.Type,name:m.Name||null,target:m.Destination,readOnly:!m.RW})) }));
  for (const c of containers) {
    check(c.Name+' running',c.State.Status,'running');
    check(c.Name+' unprivileged',c.HostConfig.Privileged,false);
    if (c.State.Health) check(c.Name+' healthy',c.State.Health.Status,'healthy');
    for (const bindings of Object.values(c.NetworkSettings.Ports||{})) for(const b of bindings||[])
      check(c.Name+' port '+b.HostPort,b.HostIp,'127.0.0.1');
  }
  const empty = JSON.parse(sql('postgres', "SELECT json_build_object('version',current_setting('server_version'),'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'auth',(SELECT count(*) FROM auth.users),'objects',(SELECT count(*) FROM storage.objects),'buckets',(SELECT count(*) FROM storage.buckets),'patients',to_regclass('public.patients'));"));
  result.managedTemplate = empty;
  check('Genuine Auth empty',empty.auth,0); check('Genuine Storage empty',empty.objects,0);
  check('Buckets empty',empty.buckets,0); check('Application empty',empty.patients,null);
  check('PostgreSQL 17',/^17\./.test(empty.version),true); check('Local official admin',empty.superuser,true);
  check(resumeReviewed ? 'Reviewed clone targets present' : 'Clone targets absent',sql('template1',"SELECT count(*) FROM pg_database WHERE datname IN ('clinia_stage_clean','clinia_prod_upgrade');"),resumeReviewed ? '2' : '0');
  if (!resumeReviewed) {
  native(['compose','-f',composeFile,'stop','kong','auth','inbucket','realtime','rest','storage'],undefined,'quiesce.log');
  quiesced = true;
  try {
    sql('template1','ALTER DATABASE postgres ALLOW_CONNECTIONS false;');
    sql('template1',"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='postgres';");
    check('Template quiescent',sql('template1',"SELECT count(*) FROM pg_stat_activity WHERE datname='postgres';"),'0');
    for (const target of targets) {
      sql('template1',`CREATE DATABASE ${target} TEMPLATE postgres OWNER postgres ALLOW_CONNECTIONS true;`);
      sql(target,`REVOKE CONNECT ON DATABASE ${target} FROM PUBLIC;`);
    }
  } finally { sql('template1','ALTER DATABASE postgres ALLOW_CONNECTIONS true;'); }
  process.stdout.write('Two genuine managed local targets created; source preserved.\n');
  } else {
    check('Resume stage patients empty',sql(targets[0],'SELECT count(*) FROM public.patients;'),'0');
    check('Resume production fixture uninstalled',sql(targets[1],"SELECT to_regclass('public.patients') IS NULL;"),'t');
    result.resumedFrom='local-runtime-admin';
  }
  for (const [prefix,database] of [['stage',targets[0]],['prod',targets[1]]]) {
    const relative = `docs/production/reconciliation/scoped-baseline/${prefix}-deny-v2.sql`;
    const manifest = JSON.parse(fs.readFileSync(path.join(repo,`docs/production/reconciliation/scoped-baseline/${prefix}-deny-v2.manifest.json`),'utf8'));
    const hash = fileHash(relative);
    check(prefix+' reviewed SQL hash',hash,manifest.sqlSha256);
    if (!(resumeReviewed && prefix === 'stage')) sql(database,"SET app.scoped_fixture_authorized='local-synthetic';\n" + fs.readFileSync(path.join(repo,relative),'utf8'),prefix+'-install.log');
    capture(database,prefix);
    process.stdout.write(prefix+' fixture installed and exact scoped metadata verified.\n');
  }
  const seed = `BEGIN;
    INSERT INTO public.clinics(id,name) VALUES ('11111111-1111-4111-8111-111111111111','Clínica sintética A'),('22222222-2222-4222-8222-222222222222','Clínica sintética B');
    INSERT INTO public.patients(id,clinic_id,first_name,last_name) VALUES
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Paciente sintético','A'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Paciente sintético','B');
    COMMIT;`;
  // Historical patient guard recognizes an actual postgres maintenance session.
  // Do not fabricate JWT/service-role claims to bypass it.
  sql(targets[1],seed,'upgrade-seed.log','postgres');
  const persisted = () => sql(targets[1],"SELECT json_agg(json_build_object('id',id,'clinic',clinic_id,'first',first_name,'last',last_name) ORDER BY id) FROM public.patients;");
  const before = persisted();
  const m7 = 'supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql';
  result.m7Hash=fileHash(m7);
  sql(targets[1],fs.readFileSync(path.join(repo,m7),'utf8'),'upgrade-m7.log');
  check('M7 retained invented patients',persisted(),before);
  result.completedAt=new Date().toISOString(); result.state='SQL_BASELINES_VERIFIED_FORWARD_PENDING';
}
try { execute(); } catch(e) { result.completedAt=new Date().toISOString(); result.state='PARTIAL'; result.failure=e.message; console.error(e.message); process.exitCode=1; }
finally {
  if (quiesced) {
    try { native(['compose','-f',composeFile,'start','kong','auth','inbucket','realtime','rest','storage'],undefined,'resume.log'); result.servicesResumeRequested=true; }
    catch(e) { result.resumeFailure=e.message; process.exitCode=1; }
  }
  if(madeOutput) fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(result,null,2));
}
