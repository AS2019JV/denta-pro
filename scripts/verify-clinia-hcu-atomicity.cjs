'use strict';
// HCU-only, rollback-only regression on the existing owned clean synthetic DB.
// Starts only that DB when stopped and restores its prior stopped state. SQL
// role/JWT claims exercise triggers/RLS; this is not an HTTP JWT/browser test.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const api=require('./clinia-clean-api.cjs'),local=require('./clinia-local-runtime.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const md5=value=>crypto.createHash('md5').update(value.replace(/\s+/g,'')).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function body(file,name){
  const text=fs.readFileSync(path.join(local.repo,file),'utf8');
  const result=[...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([\w.]+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)].find(m=>m[1]===name);
  assert.ok(result,'Canonical function missing: '+name);return result[2];
}
async function main(attempt){
  assert.match(attempt||'',/^[1-9]$/,'Fresh HCU attempt 1..9 required');
  const variant='clean-managed-1',c=api.config(variant),name='supabase_db_'+c.project;
  const output=path.join(local.repo,'docs/production/evidence/2026-10-03-hcu-save','attempt-'+attempt);
  assert.ok(!fs.existsSync(output),'Use a fresh evidence attempt');
  // Verifies the exact saved project/compose hash and local Desktop endpoint.
  api.read(variant);
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  function native(args){
    const r=spawnSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});
    assert.equal(r.status,0,'Owned DB operation failed');return r.stdout.trim();
  }
  const initial=JSON.parse(native(['inspect',name]))[0];
  assert.equal(initial.Name,'/'+name);assert.equal(initial.Config.Labels['com.supabase.cli.project'],c.project);
  assert.ok(!initial.HostConfig.Privileged);assert.deepEqual(Object.keys(initial.NetworkSettings.Networks),[c.network]);
  assert.ok(['exited','running'].includes(initial.State.Status));
  const started=initial.State.Status==='exited';
  const sources=['components/hcu033-form.tsx','test/production/hcu-context-loading.test.cjs',
    'docs/production/reconciliation/encargo02/forward.sql','supabase/migrations/20261002180423_live_session_revocation.sql'];
  const report={state:'PARTIAL',startedAt:new Date().toISOString(),project:c.project,
    sourceHashes:Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(path.join(local.repo,file)))])),
    driverSha256:sha(fs.readFileSync(__filename)),initialState:initial.State.Status,checks:[],
    limits:['Existing owned clean-managed-1 synthetic database only; no remote connection',
      'All probe rows, temporary failure trigger and audit effects are rolled back',
      'Authenticated SQL role with synthetic live-session claims, not cryptographic HTTP JWT or browser proof',
      'No clinical, consent, retention, prescription or privacy acceptance']};
  fs.mkdirSync(output,{recursive:true});
  const persist=()=>fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(report,null,2)+'\n');persist();
  try {
    if(started)native(['start',name]);
    let healthy=false;
    for(let i=0;i<30;i++){
      const item=JSON.parse(native(['inspect',name]))[0];
      if(item.State.Status==='running'&&item.State.Health?.Status==='healthy'){healthy=true;break}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert.ok(healthy,'Owned DB did not become healthy');report.runtime=api.inspect(variant,['db']);
    const expected={
      'public.update_patient_odontogram_summary()':body('docs/production/reconciliation/encargo02/forward.sql','public.update_patient_odontogram_summary'),
      'security_internal.protect_clinical_identity()':body('docs/production/reconciliation/encargo02/forward.sql','security_internal.protect_clinical_identity'),
      'security_internal.require_clinic(uuid,text[],boolean)':body('supabase/migrations/20261002180423_live_session_revocation.sql','security_internal.require_clinic'),
      'security_internal.lock_clinia_session()':body('supabase/migrations/20261002180423_live_session_revocation.sql','security_internal.lock_clinia_session'),
    };
    const catalog=JSON.parse(api.sql(variant,`SELECT json_build_object('functions',(SELECT json_agg(json_build_object(
      'name',oid::regprocedure::text,'owner',proowner::regrole::text,'definer',prosecdef,'config',proconfig,
      'md5',md5(regexp_replace(prosrc,'[[:space:]]+','','g'))) ORDER BY oid::regprocedure::text)
      FROM pg_proc WHERE oid IN (${Object.keys(expected).map(x=>"'"+x+"'::regprocedure").join(',')})),
      'triggers',(SELECT json_agg(json_build_object('name',tgname,'enabled',tgenabled,'type',tgtype,'function',tgfoid::regprocedure::text))
      FROM pg_trigger WHERE tgrelid='public.hcu033_forms'::regclass AND NOT tgisinternal),
      'hcuRls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.hcu033_forms'::regclass),
      'patientRls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.patients'::regclass));`,'postgres'));
    for(const fn of catalog.functions){const key=fn.name.includes('.')?fn.name:'public.'+fn.name;assert.equal(fn.md5,md5(expected[key]));assert.equal(fn.owner,'postgres');assert.equal(fn.definer,true);assert.deepEqual(fn.config,['search_path=""'])}
    assert.equal(catalog.functions.length,4);assert.equal(catalog.hcuRls,true);assert.equal(catalog.patientRls,true);
    const trigger=catalog.triggers.find(x=>x.name==='tr_update_patient_odontogram');
    assert.equal(trigger?.enabled,'O');assert.equal(trigger.type,21);assert.equal(trigger.function,'update_patient_odontogram_summary()');
    for(const name of ['encargo02_protect_identity','trg_sync_hcu033_form_clinic_id','trg_enforce_clinician_assignment'])assert.equal(catalog.triggers.find(x=>x.name===name)?.enabled,'O');
    report.catalog=catalog;report.checks.push({name:'Exact canonical active synchronization and live authority prerequisite',passed:true});persist();
    const fixtures=JSON.parse(fs.readFileSync(path.join(local.repo,'docs/production/evidence/2026-10-02-contract-api/clean-managed-1-1/execution.json'))).fixtureIds;
    const actors=JSON.parse(fs.readFileSync(path.join(local.privateDir,c.project+'-actors-1.private.json')));
    const patient=fixtures.patientA,clinic=fixtures.clinicA,doctor=actors.doctor_A.id;
    for(const value of [patient,clinic,doctor])assert.match(value,uuid);
    const snapshot=()=>api.sql(variant,`SELECT json_build_object('hcuCount',(SELECT count(*) FROM public.hcu033_forms),
      'auditCount',(SELECT count(*) FROM logs.access_audit),'patientMd5',(SELECT md5(to_jsonb(p)::text) FROM public.patients p WHERE id='${patient}' AND clinic_id='${clinic}'),
      'probeTriggerCount',(SELECT count(*) FROM pg_trigger WHERE tgname='zz_hcu_atomicity_failure'));`,'postgres');
    report.before=JSON.parse(snapshot());
    const result=JSON.parse(api.sql(variant,`BEGIN;
      SET LOCAL statement_timeout='15s';
      DO $claims$ DECLARE s uuid; BEGIN
        SELECT id INTO s FROM auth.sessions WHERE user_id='${doctor}' AND (not_after IS NULL OR not_after>now()) ORDER BY created_at DESC LIMIT 1;
        IF s IS NULL THEN RAISE EXCEPTION 'Synthetic live session prerequisite missing'; END IF;
        PERFORM set_config('request.jwt.claims',json_build_object('role','authenticated','sub','${doctor}','session_id',s,'is_anonymous',false)::text,true);
        IF public.get_clinic_member_role('${clinic}') IS DISTINCT FROM 'doctor' THEN RAISE EXCEPTION 'Synthetic authority prerequisite missing'; END IF;
      END $claims$;
      CREATE TEMP TABLE hcu_probe_result(result jsonb);
      CREATE FUNCTION pg_temp.reject_hcu_summary() RETURNS trigger LANGUAGE plpgsql AS $reject$
      BEGIN IF current_setting('app.hcu_summary_reject',true)='yes' THEN RAISE EXCEPTION 'Synthetic HCU summary rejected' USING ERRCODE='23514'; END IF; RETURN NEW; END $reject$;
      CREATE TRIGGER zz_hcu_atomicity_failure BEFORE UPDATE OF odontogram_state ON public.patients FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_hcu_summary();
      DO $probe$ DECLARE saved_id uuid; hc bigint; ac bigint; patient_before jsonb;
        form jsonb:='{"odontograma_data":{"11":{"surfaces":{"top":"caries:red"}}},"odontograma_descripcion":"HCU ATOMIC SYNTHETIC"}'::jsonb;
      BEGIN
        SET LOCAL ROLE authenticated;
        INSERT INTO public.hcu033_forms(clinic_id,patient_id,doctor_id,form_data) VALUES('${clinic}','${patient}','${doctor}',form) RETURNING id INTO saved_id;
        RESET ROLE;
        IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id='${patient}' AND clinic_id='${clinic}' AND odontogram_state=form->'odontograma_data' AND last_treatment_note=form->>'odontograma_descripcion')
        THEN RAISE EXCEPTION 'Successful HCU insert did not synchronize summary'; END IF;
        SELECT count(*) INTO hc FROM public.hcu033_forms;SELECT count(*) INTO ac FROM logs.access_audit;
        SELECT to_jsonb(p) INTO patient_before FROM public.patients p WHERE id='${patient}' AND clinic_id='${clinic}';
        PERFORM set_config('app.hcu_summary_reject','yes',true);
        BEGIN
          SET LOCAL ROLE authenticated;
          INSERT INTO public.hcu033_forms(clinic_id,patient_id,doctor_id,form_data) VALUES('${clinic}','${patient}','${doctor}',form||'{"odontograma_descripcion":"MUST ROLL BACK"}'::jsonb);
          RESET ROLE;RAISE EXCEPTION 'Expected summary failure was not raised';
        EXCEPTION WHEN check_violation THEN RESET ROLE; END;
        IF hc<>(SELECT count(*) FROM public.hcu033_forms) OR ac<>(SELECT count(*) FROM logs.access_audit)
          OR patient_before IS DISTINCT FROM (SELECT to_jsonb(p) FROM public.patients p WHERE id='${patient}' AND clinic_id='${clinic}')
        THEN RAISE EXCEPTION 'Rejected summary left HCU, patient or audit effects'; END IF;
        INSERT INTO hcu_probe_result VALUES(jsonb_build_object('ordinaryRoleInsertSynchronized',true,'summaryFailureSqlstate','23514',
          'rejectedHcuCountUnchanged',true,'rejectedPatientUnchanged',true,'rejectedAuditCountUnchanged',true));
      END $probe$;
      SELECT result FROM hcu_probe_result;
      ROLLBACK;`,'postgres'));
    report.probe=result;report.after=JSON.parse(snapshot());assert.deepEqual(report.after,report.before);
    report.checks.push({name:'Successful authenticated-role HCU synchronizes patient within INSERT',passed:true},
      {name:'Forced summary UPDATE rejection rolls back HCU, patient and audit effects',passed:true},
      {name:'Outer ROLLBACK preserves original rows and removes temporary failure trigger',passed:true});
    report.state='VERIFIED_LOCAL_HCU_ATOMICITY';
  } catch(error){report.error=String(error.message).slice(0,300);throw error}
  finally {
    if(started)native(['stop','--time','10',name]);
    report.finalState=JSON.parse(native(['inspect',name]))[0].State.Status;
    assert.equal(report.finalState,initial.State.Status,'Prior DB state not restored');
    report.completedAt=new Date().toISOString();persist();
  }
  console.log(JSON.stringify({state:report.state,checks:report.checks,finalState:report.finalState,evidence:path.relative(local.repo,output)}));
}
if(require.main===module)main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main};
