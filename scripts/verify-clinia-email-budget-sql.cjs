'use strict';
// Actual PostgreSQL concurrency and grants in a NEW local clone. SQL claims are
// explicit fixtures; these tests are not Auth-issued JWT/API acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {Client}=require('pg');
const local=require('./clinia-local-runtime.cjs');
function plan(attempt){
  assert.match(String(attempt),/^[1-9]$/,'New attempt 1..9 required');
  return {database:`clinia_email_budget_20261002_${attempt}`,source:'clinia_contract_stage_20260928_3',
    evidence:path.join(local.repo,'docs/production/evidence/2026-10-02-email-budget',`attempt-${attempt}`)};
}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(attempt){
  const p=plan(attempt),report={startedAt:new Date().toISOString(),status:'NOT VERIFIED',database:p.database,source:p.source,
    checks:[],limits:['Actual local PostgreSQL17 SQL grants/concurrency with synthetic SQL role claims',
      'Not ordinary Auth JWTs or deployed email/provider acceptance','No remote mutation or cleanup; clone preserved']};
  assert.ok(!fs.existsSync(p.evidence),'Evidence exists; choose a new attempt');
  fs.mkdirSync(p.evidence,{recursive:true});
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  const clients=[];
  function native(args,input){
    const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:4*1024*1024});
    if(r.error||r.status!==0){
      fs.writeFileSync(path.join(local.privateDir,`email-budget-${attempt}-${Date.now()}.private.log`),(r.stdout||'')+(r.stderr||''),{flag:'wx'});
      throw Error('Local SQL operation failed; private diagnostic preserved');
    }return r.stdout.trim();
  }
  function sql(database,text){
    assert.ok(['template1',p.source,p.database].includes(database));
    return native(['exec','-i','--user','postgres','supabase_db_clinia-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',database,'-f','/dev/stdin'],text);
  }
  function persist(){fs.writeFileSync(path.join(p.evidence,'execution.json'),JSON.stringify(report,null,2));}
  async function check(name,fn){await fn();report.checks.push({name,status:'VERIFIED'});persist();}
  try{
    report.runtime=local.inspectDatabase();
    assert.equal(sql('template1',`SELECT count(*) FROM pg_database WHERE datname='${p.database}';`),'0','New database required');
    assert.equal(sql(p.source,"SELECT to_regprocedure('security_internal.role_for(uuid,uuid)') IS NOT NULL;"),'t','Canonical authority required');
    sql('template1',`CREATE DATABASE ${p.database} TEMPLATE ${p.source} OWNER postgres; REVOKE CONNECT ON DATABASE ${p.database} FROM PUBLIC;`);
    report.created=true;persist();
    const migration=fs.readFileSync(path.join(local.repo,'supabase/migrations/20261001130000_durable_email_abuse_budget.sql'),'utf8');
    report.migrationSha256=hash(migration);persist();sql(p.database,migration);
    const profileGuard=fs.readFileSync(path.join(local.repo,'supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql'),'utf8');
    report.profileGuardSha256=hash(profileGuard);persist();sql(p.database,profileGuard);
    const liveSession=fs.readFileSync(path.join(local.repo,'supabase/migrations/20261002180423_live_session_revocation.sql'),'utf8');
    report.liveSessionSha256=hash(liveSession);persist();sql(p.database,liveSession);
    const info=JSON.parse(native(['inspect','supabase_db_clinia-acceptance']))[0];
    assert.deepEqual(info.NetworkSettings.Ports['5432/tcp'],[{HostIp:'127.0.0.1',HostPort:'56322'}],'Exact inspected TCP endpoint required');
    const password=info.Config.Env.find(x=>x.startsWith('POSTGRES_PASSWORD='))?.slice(18);
    assert.ok(password,'Local credential unavailable');
    async function connect(role='postgres'){
      const c=new Client({host:'127.0.0.1',port:56322,user:'postgres',password,database:p.database,
        connectionTimeoutMillis:10000,query_timeout:15000,application_name:'clinia-synthetic-email-budget'});
      clients.push(c);await c.connect();
      await c.query("SET statement_timeout='12s'; SET lock_timeout='10s';");
      if(role!=='postgres'){
        assert.ok(['service_role','anon','authenticated'].includes(role));await c.query('SET ROLE '+role);
        await c.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.role',$2,false)",[JSON.stringify({role}),role]);
      }return c;
    }
    const admin=await connect(),service=await connect('service_role');
    const startedWindow=Number((await admin.query("SELECT floor(extract(epoch FROM clock_timestamp())/600) AS bucket;")).rows[0].bucket);
    const second=Number((await admin.query("SELECT extract(epoch FROM clock_timestamp())::bigint % 600 AS seconds;")).rows[0].seconds);
    assert.ok(second<570,'Window edge too close; preserve attempt and run later');
    const actor='11111111-1111-4111-8111-111111111111',clinic='22222222-2222-4222-8222-222222222222',sessionId=crypto.randomUUID();
    await admin.query("BEGIN; SET LOCAL app.scoped_fixture_authorized='local-synthetic';");
    await admin.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'budget-synthetic@clinia.invalid',now(),'{}')",[actor]);
    await admin.query('INSERT INTO auth.sessions(id,user_id,not_after) VALUES($1,$2,now()+interval \'1 hour\')',[sessionId,actor]);
    await admin.query("INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES($1,'Synthetic budget only',$2,true)",[clinic,actor]);
    await admin.query("UPDATE public.profiles SET clinic_id=$2,role='clinic_owner',status='active' WHERE id=$1",[actor,clinic]);
    await admin.query("INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES($1,$2,'clinic_owner','active')",[actor,clinic]);
    await admin.query('COMMIT');
    await check('Own profile update succeeds without created_at; authority changes denied',async()=>{
      const own=await connect('authenticated');
      await own.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub',$2,false)",[JSON.stringify({role:'authenticated',sub:actor,session_id:sessionId}),actor]);
      assert.equal((await own.query("UPDATE public.profiles SET full_name='Synthetic profile edit' WHERE id=$1 RETURNING id",[actor])).rowCount,1);
      await assert.rejects(()=>own.query("UPDATE public.profiles SET role='doctor' WHERE id=$1",[actor]),e=>e.code==='42501');
    });
    const invoke=(c,action,ip,destination,a=null,b=null)=>c.query('SELECT public.consume_email_abuse_budget($1,$2,$3,$4,$5) AS result',[action,hash(ip),hash(destination),a,b]).then(r=>r.rows[0].result);
    const snapshot=()=>admin.query('SELECT scope,key_hash,window_start,expires_at,attempts FROM security_internal.email_abuse_budgets ORDER BY scope,key_hash,window_start').then(r=>JSON.stringify(r.rows));
    await check('Anonymous/authenticated execution denied; service cannot read private counters',async()=>{
      for(const role of ['anon','authenticated']){const c=await connect(role);await assert.rejects(()=>invoke(c,'signup','ip','destination'),e=>e.code==='42501');}
      await assert.rejects(()=>service.query('SELECT * FROM security_internal.email_abuse_budgets'),e=>e.code==='42501');
    });
    await check('Malformed request and stale or non-owner actor rejected without counters',async()=>{
      const before=await snapshot();
      async function rejected(fn,code){try{await fn();assert.fail('Request unexpectedly allowed');}catch(e){assert.equal(e.code,code,'Expected '+code+'; got '+e.code);}}
      await rejected(()=>service.query("SELECT public.consume_email_abuse_budget('signup','raw-ip','raw-email')"),'22023');
      await rejected(()=>invoke(service,'invite','ip','destination','33333333-3333-4333-8333-333333333333',clinic),'42501');
      assert.equal(await snapshot(),before);
    });
    await check('Concurrent destination reservations allow exactly three of twelve',async()=>{
      const pool=await Promise.all(Array.from({length:12},()=>connect('service_role')));
      const results=await Promise.all(pool.map((c,i)=>invoke(c,'resend','parallel-ip-'+i,'parallel-destination')));
      assert.equal(results.filter(r=>r.allowed).length,3);
      assert.ok(results.filter(r=>!r.allowed).every(r=>r.retry_after_seconds>0&&r.retry_after_seconds<=3600));
      const before=await snapshot();for(let i=0;i<100;i++)assert.equal((await invoke(service,'resend','parallel-ip-0','parallel-destination')).allowed,false);
      assert.equal(await snapshot(),before,'Rejected traffic burned a quota');
    });
    await check('Anonymous IP quota is shared between signup/resend',async()=>{
      for(let i=0;i<10;i++)assert.equal((await invoke(service,i%2?'signup':'resend','shared-anonymous-ip','ip-destination-'+i)).allowed,true);
      const before=await snapshot();assert.equal((await invoke(service,'signup','shared-anonymous-ip','eleventh')).allowed,false);assert.equal(await snapshot(),before);
    });
    await check('Actor quota shared across invite/transactional and live demotion denial',async()=>{
      for(let i=0;i<30;i++)assert.equal((await invoke(service,i%2?'invite':'transactional','actor-ip-'+i,'actor-destination-'+i,actor,clinic)).allowed,true);
      const before=await snapshot();assert.equal((await invoke(service,'invite','actor-over','actor-over',actor,clinic)).allowed,false);assert.equal(await snapshot(),before);
      await admin.query("UPDATE public.clinic_members SET role='doctor' WHERE user_id=$1 AND clinic_id=$2",[actor,clinic]);
      await assert.rejects(()=>invoke(service,'invite','new-ip','new-destination',actor,clinic),e=>e.code==='42501');assert.equal(await snapshot(),before);
    });
    const team=Array.from({length:7},()=>crypto.randomUUID()),teamClinic=crypto.randomUUID();
    await admin.query("BEGIN; SET LOCAL app.scoped_fixture_authorized='local-synthetic';");
    for(let i=0;i<team.length;i++)await admin.query('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)',[team[i],`budget-team-${i}@clinia.invalid`,{}]);
    await admin.query("INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES($1,'Synthetic team budget',$2,true)",[teamClinic,team[0]]);
    for(const id of team){
      await admin.query("UPDATE public.profiles SET clinic_id=$2,role='clinic_owner',status='active' WHERE id=$1",[id,teamClinic]);
      await admin.query("INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES($1,$2,'clinic_owner','active')",[id,teamClinic]);
    }
    await admin.query('COMMIT');
    await check('Shared authenticated IP ceiling sixty across seven actors',async()=>{
      for(let i=0;i<60;i++)assert.equal((await invoke(service,'transactional','common-team-ip','common-ip-destination-'+i,team[i%6],teamClinic)).allowed,true);
      const before=await snapshot();assert.equal((await invoke(service,'invite','common-team-ip','common-ip-over',team[6],teamClinic)).allowed,false);assert.equal(await snapshot(),before);
    });
    await check('Clinic ceiling one hundred twenty across actors and IPs',async()=>{
      for(let i=0;i<60;i++)assert.equal((await invoke(service,'invite','clinic-ip-'+i,'clinic-destination-'+i,team[i%6],teamClinic)).allowed,true);
      const before=await snapshot();assert.equal((await invoke(service,'transactional','clinic-over-ip','clinic-over-destination',team[6],teamClinic)).allowed,false);assert.equal(await snapshot(),before);
    });
    const destinationClinic=crypto.randomUUID();
    await admin.query("BEGIN; SET LOCAL app.scoped_fixture_authorized='local-synthetic';");
    await admin.query("INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES($1,'Synthetic destination budget',$2,true)",[destinationClinic,team[6]]);
    await admin.query("INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES($1,$2,'clinic_owner','active')",[team[6],destinationClinic]);
    await admin.query('COMMIT');
    await check('Common destination ceiling ten across invite/transactional actions',async()=>{
      for(let i=0;i<10;i++)assert.equal((await invoke(service,i%2?'invite':'transactional','destination-ip-'+i,'common-team-destination',team[6],destinationClinic)).allowed,true);
      const before=await snapshot();assert.equal((await invoke(service,'transactional','destination-over-ip','common-team-destination',team[6],destinationClinic)).allowed,false);assert.equal(await snapshot(),before);
    });
    await check('Suspended/deleted profiles and removed members lose server budget authority',async()=>{
      await admin.query("SELECT set_config('app.scoped_fixture_authorized','local-synthetic',false)");
      for(const mutation of ["status='suspended'","status='active',deleted_at=now()"]){
        await admin.query('UPDATE public.profiles SET '+mutation+' WHERE id=$1',[team[6]]);
        const before=await snapshot();await assert.rejects(()=>invoke(service,'invite','revoked-ip','revoked-destination',team[6],destinationClinic),e=>e.code==='42501');assert.equal(await snapshot(),before);
      }
      await admin.query("UPDATE public.profiles SET status='active',deleted_at=NULL WHERE id=$1",[team[6]]);
      await admin.query("UPDATE public.clinic_members SET status='removed' WHERE user_id=$1 AND clinic_id=$2",[team[6],destinationClinic]);
      const before=await snapshot();await assert.rejects(()=>invoke(service,'invite','revoked-ip','revoked-destination',team[6],destinationClinic),e=>e.code==='42501');assert.equal(await snapshot(),before);
    });
    await check('Bounded expiry cleanup skips locked rows and preserves current windows',async()=>{
      const current=(await admin.query('SELECT count(*)::integer AS n FROM security_internal.email_abuse_budgets WHERE expires_at>now()')).rows[0].n;
      await admin.query("INSERT INTO security_internal.email_abuse_budgets SELECT 'cleanup-fixture',encode(extensions.digest(i::text,'sha256'),'hex'),now()-interval '3 days',now()-interval '2 days',1 FROM generate_series(1,205) i");
      const locked=await connect();await locked.query('BEGIN');await locked.query("SELECT 1 FROM security_internal.email_abuse_budgets WHERE scope='cleanup-fixture' ORDER BY key_hash LIMIT 1 FOR UPDATE");
      assert.equal((await invoke(service,'signup','cleanup-ip-1','cleanup-destination-1')).allowed,true);
      assert.equal((await admin.query("SELECT count(*)::integer AS n FROM security_internal.email_abuse_budgets WHERE scope='cleanup-fixture'")).rows[0].n,5);
      await locked.query('COMMIT');assert.equal((await invoke(service,'signup','cleanup-ip-2','cleanup-destination-2')).allowed,true);
      assert.equal((await admin.query("SELECT count(*)::integer AS n FROM security_internal.email_abuse_budgets WHERE scope='cleanup-fixture'")).rows[0].n,0);
      assert.ok((await admin.query('SELECT count(*)::integer AS n FROM security_internal.email_abuse_budgets WHERE expires_at>now()')).rows[0].n>=current);
    });
    await check('Global ceiling rejects atomically without new identity rows',async()=>{
      await admin.query("UPDATE security_internal.email_abuse_budgets SET attempts=1000 WHERE scope='00-global'");
      const before=await snapshot();assert.equal((await invoke(service,'signup','global-new-ip','global-new-destination')).allowed,false);assert.equal(await snapshot(),before);
    });
    assert.equal(Number((await admin.query("SELECT floor(extract(epoch FROM clock_timestamp())/600) AS bucket;")).rows[0].bucket),startedWindow,'Window crossed; quota proof inconclusive, preserve attempt');
    report.status='VERIFIED';
  }catch(e){const diagnostic=`email-budget-${attempt}-validation.private.log`;fs.writeFileSync(path.join(local.privateDir,diagnostic),String(e.stack||e),{flag:'wx'});report.diagnostic=diagnostic;report.error=String(e.code||'')+' '+(e.name==='AssertionError'?e.message.split('\n')[0]:'Local validation failed; inspect private diagnostics');process.exitCode=1;}
  finally{await Promise.allSettled(clients.map(c=>c.end()));report.completedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,checks:report.checks,error:report.error||null,evidence:p.evidence}));}
}
if(require.main===module){assert.equal(process.argv.length,3);main(process.argv[2]).catch(()=>{console.error('Email budget harness could not start');process.exitCode=1;});}
module.exports={plan};
