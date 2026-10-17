'use strict';
// SQL invariants only, in an exact NEW disposable database. No Auth/provider proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const local=require('./clinia-local-runtime.cjs');
const migrationFile=path.join(local.repo,'supabase/migrations/20261001120000_invitation_pending_reservation.sql');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function plan(attempt){
  assert.match(String(attempt),/^[1-9]$/,'NEW invitation SQL attempt 1..9 required');
  return {database:`clinia_invitation_sql_20261002_${attempt}`,attempt:String(attempt),
    evidence:path.join(local.repo,'docs/production/evidence/2026-10-02-invitation-sql',String(attempt))};
}
function guard(database){
  assert.match(database,/^clinia_invitation_sql_20261002_[1-9]$/,'Disposable invitation target required');
  return `DO $target$ BEGIN IF current_database()<>'${database}' OR current_user<>'supabase_admin' THEN
    RAISE EXCEPTION 'New disposable invitation target required'; END IF; END $target$;`;
}
function setupSql(database){
  return `BEGIN; ${guard(database)}
    CREATE TABLE public.clinic_invitations (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      clinic_id uuid NOT NULL, email text NOT NULL,
      status text NOT NULL CHECK (status IN ('pending','accepted','expired')),
      expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
      CONSTRAINT clinic_invitations_clinic_id_email_status_key UNIQUE (clinic_id,email,status));
    COMMIT;`;
}
const clinicA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',clinicB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function cases(database,migration){
  const prefix=`BEGIN; ${guard(database)} SET LOCAL statement_timeout='60s'; `;
  return [
    {name:'normalized-pending-and-history',sql:prefix+`DO $verify$ BEGIN
      INSERT INTO public.clinic_invitations(clinic_id,email,status) VALUES ('${clinicA}','Person@clinia.invalid','pending');
      BEGIN
        INSERT INTO public.clinic_invitations(clinic_id,email,status) VALUES ('${clinicA}','person@clinia.invalid','pending');
        RAISE EXCEPTION 'Normalized duplicate pending reservation was accepted';
      EXCEPTION WHEN unique_violation THEN NULL; END;
      INSERT INTO public.clinic_invitations(clinic_id,email,status) VALUES ('${clinicB}','person@clinia.invalid','pending');
      INSERT INTO public.clinic_invitations(clinic_id,email,status,expires_at) VALUES
        ('${clinicA}','person@clinia.invalid','expired',now()-interval '1 day'),
        ('${clinicA}','person@clinia.invalid','expired',now()-interval '2 days'),
        ('${clinicA}','person@clinia.invalid','accepted',now()-interval '1 day'),
        ('${clinicA}','person@clinia.invalid','accepted',now()-interval '2 days');
      IF (SELECT count(*) FROM public.clinic_invitations)<>6 THEN RAISE EXCEPTION 'History/coexistence count differs'; END IF;
    END $verify$; ROLLBACK;`},
    {name:'duplicate-preflight-rollback',error:'Duplicate pending recipients require review',sql:prefix+`
      DROP INDEX public.clinic_invitations_one_pending_email_idx;
      ALTER TABLE public.clinic_invitations ADD CONSTRAINT clinic_invitations_clinic_id_email_status_key UNIQUE(clinic_id,email,status);
      INSERT INTO public.clinic_invitations(clinic_id,email,status) VALUES
        ('${clinicA}','Person@clinia.invalid','pending'),('${clinicA}','person@clinia.invalid','pending');
      ${migration}`},
    {name:'constraint-drift-rollback',error:'Unreviewed invitation uniqueness drift',sql:prefix+`
      DROP INDEX public.clinic_invitations_one_pending_email_idx;
      ALTER TABLE public.clinic_invitations ADD CONSTRAINT clinic_invitations_clinic_id_email_status_key UNIQUE(clinic_id,email);
      ${migration}`},
  ];
}
// Transaction abort must restore both rows and schema; identity sequences are not transactional.
const stateSql=`SELECT json_build_object('rows',(SELECT count(*) FROM public.clinic_invitations),
  'constraints',(SELECT json_agg(pg_get_constraintdef(oid,true) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass),
  'indexes',(SELECT json_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='clinic_invitations'));`;
async function main(attempt){
  const c=plan(attempt),migration=fs.readFileSync(migrationFile,'utf8');
  assert.ok(!fs.existsSync(c.evidence),'Evidence exists; preserve it and choose a NEW attempt');
  const report={state:'PARTIAL',startedAt:new Date().toISOString(),database:c.database,migrationSha256:sha(migration),cases:[],
    limits:['Disposable SQL constraint/transaction evidence only; not ordinary JWT, application invitation or provider evidence',
      'Minimal invitation table; not full schema migration convergence', 'No cleanup; disposable database and diagnostics preserved']};
  fs.mkdirSync(c.evidence,{recursive:true});
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  function sql(database,text,expectedError){
    assert.ok(['template1',c.database].includes(database),'SQL destination refused');
    const r=spawnSync(docker,['--context','desktop-linux','exec','-i','--user','postgres','supabase_db_clinia-acceptance',
      'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',database,'-f','/dev/stdin'],
      {cwd:local.repo,input:text,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:2*1024*1024});
    if(r.error||r.status!==0){
      const diagnostic=`invitation-sql-${attempt}-${Date.now()}.private.log`;
      fs.mkdirSync(local.privateDir,{recursive:true});
      fs.writeFileSync(path.join(local.privateDir,diagnostic),(r.stdout||'')+(r.stderr||''),{flag:'wx'});
      if(!r.error&&expectedError&&r.status!==0&&(r.stderr||'').includes(expectedError))return {expectedRejection:true,diagnostic};
      throw new Error(`Invitation SQL failed; private diagnostic ${diagnostic}; disposable target preserved`);
    }
    assert.ok(!expectedError,'Expected SQL preflight rejection did not occur');
    return r.stdout.trim();
  }
  try{
    report.runtime=local.inspectDatabase();
    assert.equal(sql('template1',`SELECT count(*) FROM pg_database WHERE datname='${c.database}';`),'0','Destination exists; never reuse');
    sql('template1',`CREATE DATABASE ${c.database} TEMPLATE template0 OWNER postgres; REVOKE CONNECT ON DATABASE ${c.database} FROM PUBLIC;`);
    sql(c.database,setupSql(c.database));
    sql(c.database,guard(c.database)+'\n'+migration);
    const baseline=JSON.parse(sql(c.database,stateSql));
    assert.equal(baseline.rows,0);
    assert.ok(baseline.indexes.some(value=>value.includes('clinic_invitations_one_pending_email_idx')&&value.includes('lower(email)')&&value.includes("'pending'")));
    assert.ok(!baseline.constraints.includes('UNIQUE (clinic_id, email, status)'));
    for(const test of cases(c.database,migration)){
      const result=sql(c.database,test.sql,test.error);
      assert.deepEqual(JSON.parse(sql(c.database,stateSql)),baseline,`${test.name}: schema/rows did not roll back`);
      report.cases.push({name:test.name,state:'PASS',sqlSha256:sha(test.sql),diagnostic:result?.diagnostic||null});
      fs.writeFileSync(path.join(c.evidence,'execution.json'),JSON.stringify(report,null,2));
    }
    report.state='PASS_SQL_INVARIANTS_ONLY';
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{
    report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(c.evidence,'execution.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({state:report.state,database:c.database,cases:report.cases.map(({name,state})=>({name,state})),error:report.error||null,evidence:c.evidence}));
  }
  return report;
}
if(require.main===module){
  assert.equal(process.argv.length,3,'Use one NEW disposable attempt 1..9');
  main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={plan,guard,setupSql,cases};
