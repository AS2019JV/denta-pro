-- PREPARED / NOT EXECUTED. Read-only catalog assertions after the reviewed local
-- forward. This is not JWT/PostgREST/Auth/Storage acceptance evidence.
BEGIN READ ONLY;
SET LOCAL search_path='';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE r record; v_schema text; v_name text;
  v_allowed text[]:=ARRAY[
    'public.get_clinic_member_role(uuid)','public.is_clinic_member(uuid)','public.get_user_clinic_id()',
    'public.check_subscription_active(uuid)','public.get_patient_demographics(uuid,text,integer,integer,uuid)',
    'public.save_patient_demographics(uuid,jsonb,uuid)','public.get_clinic_staff_directory(uuid)',
    'public.get_clinic_schedule(uuid,timestamptz,timestamptz)','public.save_clinic_appointment(uuid,jsonb,uuid)',
    'public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid)',
    'public.remove_clinic_member(uuid,uuid)','public.encargo02_storage_access(text,text,boolean)',
    'public.encargo02_storage_replace_allowed(text,text)'];
BEGIN
  IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('app.encargo02_authorized',true) IS DISTINCT FROM 'reviewed-local-forward'
    OR current_user<>'postgres' OR session_user<>'postgres'
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Verified local synthetic postgres executor required'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Application callback owner drift'; END IF;
  FOREACH v_name IN ARRAY ARRAY['account_balance','insurance_provider','policy_number'] LOOP
    IF has_column_privilege('authenticated','public.patients',v_name,'SELECT,INSERT,UPDATE')
      OR has_column_privilege('anon','public.patients',v_name,'SELECT,INSERT,UPDATE')
    THEN RAISE EXCEPTION 'Patient finance grant leaked: %',v_name; END IF;
  END LOOP;
  IF has_column_privilege('authenticated','public.services','price','SELECT,INSERT,UPDATE')
    OR has_column_privilege('anon','public.services','price','SELECT,INSERT,UPDATE')
  THEN RAISE EXCEPTION 'Service finance grant leaked'; END IF;
  FOREACH v_name IN ARRAY ARRAY['billings','invoices','payments','expenses','budgets'] LOOP
    IF to_regclass('public.'||v_name) IS NOT NULL AND (has_any_column_privilege('authenticated','public.'||v_name,'SELECT,INSERT,UPDATE')
      OR has_table_privilege('authenticated','public.'||v_name,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon','public.'||v_name,'SELECT,INSERT,UPDATE'))
    THEN RAISE EXCEPTION 'Financial table grant leaked: %',v_name; END IF;
  END LOOP;
  FOREACH v_name IN ARRAY v_allowed LOOP
    IF to_regprocedure(v_name) IS NULL OR NOT has_function_privilege('authenticated',to_regprocedure(v_name),'EXECUTE')
    THEN RAISE EXCEPTION 'Required exact public contract/grant absent: %',v_name; END IF;
  END LOOP;
  -- All app functions are closed to anonymous. Authenticated has exactly these
  -- public endpoints; private helpers and legacy functions are not callable.
  FOR r IN SELECT p.oid,n.nspname,p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    IF has_function_privilege('anon',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'Anonymous function grant leaked: %.%',r.nspname,r.proname; END IF;
    IF has_function_privilege('authenticated',r.oid,'EXECUTE') AND r.oid NOT IN
      (SELECT to_regprocedure(identity) FROM unnest(v_allowed) AS expected(identity))
    THEN RAISE EXCEPTION 'Unlisted function grant leaked: %.%',r.nspname,r.proname; END IF;
    IF has_function_privilege('authenticated',r.oid,'EXECUTE') AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=r.oid
      AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']::text[])
    THEN RAISE EXCEPTION 'Public callback security contract differs: %.%',r.nspname,r.proname; END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,c.relname,c.oid,c.relkind,c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m') LOOP
    IF r.relkind IN ('r','p') AND NOT r.relrowsecurity THEN RAISE EXCEPTION 'RLS absent: %.%',r.nspname,r.relname; END IF;
    IF r.relkind IN ('v','m') AND (has_any_column_privilege('authenticated',r.oid,'SELECT') OR has_any_column_privilege('anon',r.oid,'SELECT'))
    THEN RAISE EXCEPTION 'Client view access leaked: %.%',r.nspname,r.relname; END IF;
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY['appointments','clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates','data_rights_requests','service_categories'] LOOP
    IF has_column_privilege('authenticated','public.'||v_name,'created_at','INSERT,UPDATE') THEN RAISE EXCEPTION 'Creation timestamp grant leaked: %',v_name; END IF;
  END LOOP;
  IF has_column_privilege('authenticated','public.service_categories','clinic_id','UPDATE')
    OR has_column_privilege('authenticated','public.service_categories','id','INSERT,UPDATE')
  THEN RAISE EXCEPTION 'Category identity grant leaked'; END IF;
  FOREACH v_name IN ARRAY ARRAY['appointments','prescriptions','clinical_records','patient_notes','patient_files','hcu033_forms','data_rights_requests','billings','invoices'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=to_regclass('public.'||v_name) AND conname=v_name||'_patient_clinic_fkey' AND convalidated)
    THEN RAISE EXCEPTION 'M7 validated constraint missing: %',v_name; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'encargo02_storage_%')<>4
    OR EXISTS (SELECT 1 FROM storage.buckets WHERE public)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname NOT LIKE 'encargo02_storage_%')
  THEN RAISE EXCEPTION 'Storage private policy contract differs'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
    AND tgfoid=to_regprocedure('public.handle_new_user()') AND tgenabled='O')
    OR (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.handle_verified_clinic_creation()')) ~* '(INSERT|UPDATE|DELETE)\s+.*(profiles|clinics|clinic_members|clinic_invitations)'
  THEN RAISE EXCEPTION 'Auth signup authority closure differs'; END IF;
END;
$verify$;
SELECT n.nspname AS schema,p.proname AS function,pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS definer,p.proconfig AS settings,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' ORDER BY 1,2,3;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
WHERE schemaname IN ('public','logs','security_internal') OR (schemaname='storage' AND tablename='objects') ORDER BY 1,2,3;
ROLLBACK;
