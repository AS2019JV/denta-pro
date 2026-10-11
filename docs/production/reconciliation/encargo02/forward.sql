-- REVIEWABLE LOCAL SYNTHETIC FORWARD ONLY. NOT a deployable migration; M7 NOT READY.
-- Read README five questions / acceptance BEFORE execution. No data copies or deletes.
-- Executor must independently prove loopback Docker identity; GUCs do not prove locality.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = '';

DO $preflight$
DECLARE v_table text; v_constraint text; r record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'Reviewed postgres executor required; reconcile ownership in encargo01';
  END IF;
  IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('app.encargo02_authorized',true) IS DISTINCT FROM 'reviewed-local-forward'
  THEN RAISE EXCEPTION 'Reviewed local synthetic execution markers required'; END IF;
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Genuine Supabase PostgreSQL17 Auth/Storage required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass AND attname='owner_id' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'Managed Storage owner_id contract absent; review runtime version'; END IF;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','patient_notes','patient_files','hcu033_forms','data_rights_requests','billings','invoices'] LOOP
    v_constraint := v_table || '_patient_clinic_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=to_regclass('public.'||v_table) AND conname=v_constraint AND convalidated AND contype='f'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='patient_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='clinic_id')]::smallint[]
      AND confrelid='public.patients'::regclass
      AND confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='clinic_id')]::smallint[])
    THEN RAISE EXCEPTION 'Validated M7 patient/clinic constraint required on %',v_table; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_id_clinic_id_key' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_family_clinic_fkey' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.clinic_members'::regclass AND contype='u' AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='user_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='clinic_id')]::smallint[])
  THEN RAISE EXCEPTION 'M7 family/parent key and unique membership prerequisites required'; END IF;
  IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_audit_data_rights_status' AND tgenabled='O')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_protect_data_rights_requests' AND tgenabled='O')
  THEN RAISE EXCEPTION 'M7 rights protection/status audit required'; END IF;
  -- Captured M7 callbacks must match BEFORE replacement. Do not silently re-own
  -- supabase_admin-created helpers: encargo01 must reconcile that explicitly.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Application callback owner drift; reconcile explicitly in encargo01'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('logs.log_access_trigger()','a28f2f2bbb746e80661dc2f7a5275c9f'),
    ('public.guard_data_rights_request_insert()','88e654c014bc9969fe94c3580d558503'),
    ('public.protect_data_rights_requests()','fe0ff58b269ecb6cc3462e5ab73ffe59'),
    ('public.purge_clinic_data(uuid)','49eab5876aeb4502a69adc3804c35945'),
    ('security_internal.audit_data_rights_status()','043465d08eb08c1752562f09cafe048c'),
    ('security_internal.enforce_clinician_assignment()','87184b33612e86bfcc8c153db1449307')
  ) AS expected(identity,body_md5) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(r.identity)
      AND md5(replace(p.prosrc,E'\r\n',E'\n'))=r.body_md5
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      AND p.proconfig @> ARRAY['search_path=""']::text[])
    THEN RAISE EXCEPTION 'Captured M7 callback differs: %; reconcile in encargo01',r.identity; END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','hcu033_forms'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=to_regclass('public.'||v_table)
      AND t.tgname='trg_enforce_clinician_assignment' AND t.tgenabled='O' AND t.tgtype=23
      AND t.tgfoid=to_regprocedure('security_internal.enforce_clinician_assignment()') AND NOT t.tgisinternal
      AND t.tgattr::text=(SELECT a.attnum::text||' '||b.attnum::text FROM pg_catalog.pg_attribute a,pg_catalog.pg_attribute b
        WHERE a.attrelid=t.tgrelid AND b.attrelid=t.tgrelid AND a.attname='doctor_id' AND b.attname='clinic_id'))
    THEN RAISE EXCEPTION 'Exact enabled M7 clinician trigger required on %',v_table; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('trg_guard_data_rights_request_insert','public.guard_data_rights_request_insert()',7),
    ('trg_protect_data_rights_requests','public.protect_data_rights_requests()',19),
    ('trg_audit_data_rights_status','security_internal.audit_data_rights_status()',17)
  ) AS expected(name,identity,flags) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.data_rights_requests'::regclass
      AND t.tgname=r.name AND t.tgenabled='O' AND t.tgfoid=to_regprocedure(r.identity) AND t.tgtype=r.flags AND NOT t.tgisinternal)
    THEN RAISE EXCEPTION 'Exact enabled M7 rights callback required: %',r.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.clinic_members GROUP BY user_id,clinic_id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate memberships require explicit review'; END IF;
  -- Provision these empty synthetic buckets through the genuine Storage API before SQL.
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND NOT public)<>4
    OR EXISTS (SELECT 1 FROM storage.buckets WHERE public)
  THEN RAISE EXCEPTION 'All local buckets must be private; required four buckets provisioned via API'; END IF;
END;
$preflight$;

-- Neutralize observed global/schema defaults and all inherited application client grants.
-- Column privileges are independent: revoke them too before granting explicit columns.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SCHEMA logs,security_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON TYPE public.app_role,public.user_status,public.subscription_status TO authenticated;
DO $close$
DECLARE r record; v_columns text;
BEGIN
  FOR r IN SELECT n.nspname,c.relname,c.relkind,c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S') LOOP
    IF r.relkind='S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      EXECUTE format('GRANT ALL ON SEQUENCE %I.%I TO service_role',r.nspname,r.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns FROM pg_catalog.pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
      IF v_columns IS NOT NULL THEN EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE %I.%I FROM PUBLIC,anon,authenticated',v_columns,v_columns,v_columns,v_columns,r.nspname,r.relname); END IF;
      IF r.relkind IN ('r','p') THEN
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.nspname,r.relname);
        EXECUTE format('GRANT ALL ON TABLE %I.%I TO service_role',r.nspname,r.relname);
      END IF;
      IF r.relkind='v' THEN EXECUTE format('ALTER VIEW %I.%I SET (security_invoker=true)',r.nspname,r.relname); END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.nspname,r.proname,r.args);
  END LOOP;
  -- Remove every captured policy in owned app scope, not only known naming variants.
  -- Recreate only accepted grants/policies below. Storage is synthetic project scope.
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies WHERE schemaname IN ('public','logs','security_internal') OR (schemaname='storage' AND tablename='objects') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
  END LOOP;
END;
$close$;

-- Auth callbacks never convert editable signup metadata into tenant authority.
-- Both baseline variants receive a profile-only insert callback. Onboarding and
-- invitation acceptance need their own reviewed server contract in encargo10B.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  INSERT INTO public.profiles(id,full_name,email,status)
  VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),120),NEW.email,'active'::public.user_status)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  -- Preserve the Auth row; no profile role, clinic, membership or invitation write.
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user(),public.handle_verified_clinic_creation() FROM PUBLIC,anon,authenticated,service_role;

-- Private role lookup accepts a target user ONLY for trusted clinician-assignment code.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_clinic_member_role(check_clinic_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    THEN security_internal.role_for(check_clinic_id,auth.uid()) END;
$function$;
CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT public.get_clinic_member_role(check_clinic_id) IS NOT NULL; $function$;
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  -- Deterministic preference, never authorization. No stale JWT or primary-profile fallback.
  SELECT m.clinic_id FROM public.clinic_members m
  WHERE m.user_id=auth.uid() AND public.is_clinic_member(m.clinic_id)
  ORDER BY m.created_at,m.clinic_id LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.is_clinic_member(check_clinic_id) AND EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.id=check_clinic_id AND c.archived_at IS NULL
      AND (c.bypass_subscription IS TRUE OR c.subscription_status::text='active' OR c.trial_ends_at>now()));
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    -- A committed revocation precedes denial of the next operation; writes already
    -- authorized hold these rows until completion, so revocation cannot race the write.
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Explicit demographic projection. No full-row to_jsonb(patient) return.
CREATE OR REPLACE FUNCTION security_internal.patient_demographic(p public.patients)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',p.id,'clinic_id',p.clinic_id,'first_name',p.first_name,'last_name',p.last_name,
    'cedula',p.cedula,'email',p.email,'phone',p.phone,'address',p.address,'city',p.city,'state',p.state,
    'birth_date',p.birth_date,'gender',p.gender,'status',p.status,'occupation',p.occupation,
    'guardian_name',p.guardian_name,'medical_record_number',p.medical_record_number,
    'emergency_contact',p.emergency_contact,'emergency_phone',p.emergency_phone,'marital_status',p.marital_status,
    'preferred_contact_method',p.preferred_contact_method,'avatar_url',p.avatar_url,
    'family_representative_id',p.family_representative_id,'family_relationship',p.family_relationship,
    'is_family_head',p.is_family_head,'created_at',p.created_at,'updated_at',p.updated_at);
$function$;
REVOKE ALL ON FUNCTION security_internal.patient_demographic(public.patients) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_patient_demographics(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 25,p_offset integer DEFAULT 0,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
      AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),
    'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_patient_demographics(p_clinic_id uuid,p_data jsonb,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.patients; v_input public.patients; v_key text; v_value jsonb;
  v_allowed constant text[]:=ARRAY['first_name','last_name','cedula','email','phone','address','city','state','birth_date','gender','status','occupation','guardian_name','medical_record_number','emergency_contact','emergency_phone','marital_status','preferred_contact_method'];
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>12000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF NOT(v_key=ANY(v_allowed)) OR jsonb_typeof(v_value) NOT IN ('string','null') OR length(p_data->>v_key)>500
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (p_data?'first_name' AND coalesce(length(btrim(p_data->>'first_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'last_name' AND coalesce(length(btrim(p_data->>'last_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'status' AND (p_data->>'status' IS NULL OR (p_data->>'status') NOT IN ('active','inactive')))
    OR (p_data?'preferred_contact_method' AND (p_data->>'preferred_contact_method' IS NULL OR (p_data->>'preferred_contact_method') NOT IN ('phone','email','whatsapp')))
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.patients WHERE id=p_patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT(p_data?'first_name' AND p_data?'last_name') THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
    v_row.status:='active'; v_row.preferred_contact_method:='phone';
  END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.birth_date>current_date OR (v_input.birth_date IS NOT NULL AND v_input.birth_date<date '1850-01-01')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NULL THEN
    INSERT INTO public.patients(clinic_id,first_name,last_name,cedula,email,phone,address,city,state,birth_date,gender,status,occupation,guardian_name,medical_record_number,emergency_contact,emergency_phone,marital_status,preferred_contact_method)
    VALUES(p_clinic_id,btrim(v_input.first_name),btrim(v_input.last_name),v_input.cedula,v_input.email,v_input.phone,v_input.address,v_input.city,v_input.state,v_input.birth_date,v_input.gender,v_input.status,v_input.occupation,v_input.guardian_name,v_input.medical_record_number,v_input.emergency_contact,v_input.emergency_phone,v_input.marital_status,v_input.preferred_contact_method) RETURNING * INTO v_row;
  ELSE
    UPDATE public.patients SET first_name=btrim(v_input.first_name),last_name=btrim(v_input.last_name),cedula=v_input.cedula,email=v_input.email,phone=v_input.phone,address=v_input.address,city=v_input.city,state=v_input.state,birth_date=v_input.birth_date,gender=v_input.gender,status=v_input.status,occupation=v_input.occupation,guardian_name=v_input.guardian_name,medical_record_number=v_input.medical_record_number,emergency_contact=v_input.emergency_contact,emergency_phone=v_input.emergency_phone,marital_status=v_input.marital_status,preferred_contact_method=v_input.preferred_contact_method,updated_at=now()
    WHERE id=p_patient_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.patient_demographic(v_row);
EXCEPTION WHEN data_exception OR check_violation OR unique_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_clinic_staff_directory(p_clinic_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'specialization',p.specialization,'avatar_url',p.avatar_url,'role',m.role,'title',p.title) ORDER BY p.full_name,p.id),'[]'::jsonb)
    INTO v_result FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    WHERE m.clinic_id=p_clinic_id AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL AND m.role IN ('doctor','clinic_owner','receptionist');
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION security_internal.appointment_operational(a public.appointments,p_include_notes boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',a.id,'clinic_id',a.clinic_id,'patient_id',a.patient_id,'doctor_id',a.doctor_id,'start_time',a.start_time,'end_time',a.end_time,'status',a.status,'type',a.type,'created_at',a.created_at,
    'patients',(SELECT jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) FROM public.patients p WHERE p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL),
    'profiles',(SELECT jsonb_build_object('id',p.id,'full_name',p.full_name) FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id WHERE p.id=a.doctor_id AND m.clinic_id=a.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL))
    || CASE WHEN p_include_notes THEN jsonb_build_object('notes',a.notes) ELSE '{}'::jsonb END;
$function$;
REVOKE ALL ON FUNCTION security_internal.appointment_operational(public.appointments,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_clinic_schedule(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_result jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR p_end<=p_start OR p_end-p_start>interval '93 days'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  -- Set-based joins, not a paginated patient list and not a per-appointment RPC.
  WITH matched AS MATERIALIZED (
    SELECT a.id,a.clinic_id,a.patient_id,a.doctor_id,a.start_time,a.end_time,a.status,a.type,a.created_at,a.notes,
      jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) AS patients,
      CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'full_name',d.full_name) END AS profiles
    FROM public.appointments a JOIN public.patients p ON p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL
    LEFT JOIN (SELECT pf.id,m.clinic_id,pf.full_name FROM public.profiles pf JOIN public.clinic_members m ON m.user_id=pf.id WHERE pf.status::text='active' AND pf.deleted_at IS NULL AND m.status='active' AND m.role IN ('doctor','clinic_owner')) d ON d.id=a.doctor_id AND d.clinic_id=a.clinic_id
    WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time<p_end AND a.end_time>p_start
  ) SELECT jsonb_build_object('items',coalesce(jsonb_agg((to_jsonb(matched)-'notes')||CASE WHEN v_role IN ('doctor','clinic_owner') THEN jsonb_build_object('notes',notes) ELSE '{}'::jsonb END ORDER BY start_time,id),'[]'::jsonb),'total_count',count(*)) INTO v_result FROM matched;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null')
      OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner'))
      OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000)
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time<=v_input.start_time
    OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','completed','cancelled','no_show')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF v_input.doctor_id IS NOT NULL AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'doctor' AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,v_input.type,v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=v_input.type,status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Exact identity replacement, no CASCADE: unknown dependencies must stop the review.
DROP FUNCTION IF EXISTS public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid);
CREATE FUNCTION public.get_patients_with_stats(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 12,p_offset integer DEFAULT 0,p_time_filter text DEFAULT 'all',p_badge_filter text DEFAULT 'all',p_group_by_family boolean DEFAULT false,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor']);
  -- Historical commercial badges are removed, not simulated with zero revenues.
  IF coalesce(p_time_filter,'all')<>'all' OR coalesce(p_badge_filter,'all')<>'all' OR p_group_by_family IS TRUE
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p)||jsonb_build_object('medical_history',(p).medical_history,'medical_alerts',(p).medical_alerts,'clinical_notes',(p).clinical_notes,'allergies',(p).allergies,'medications',(p).medications,'medical_conditions',(p).medical_conditions,'blood_type',(p).blood_type,'has_diabetes',(p).has_diabetes,'has_hypertension',(p).has_hypertension,'has_heart_disease',(p).has_heart_disease,'is_smoker',(p).is_smoker,'is_pregnant',(p).is_pregnant,'odontogram_state',(p).odontogram_state,'periodontogram_state',(p).periodontogram_state,'internal_notes',(p).internal_notes,'last_treatment_note',(p).last_treatment_note) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Public API allowlist; all historical finance, archive/purge, secure-profile and
-- family-statistics endpoints stay closed. Trigger execution does not need client EXECUTE.
REVOKE ALL ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) TO authenticated;

-- COLUMN_GRANTS: clinical base access excludes financial/insurance columns for all clients.
GRANT SELECT (id,created_at,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,clinic_id,emergency_contact,emergency_phone,allergies,medications,medical_conditions,deleted_at,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at) ON public.patients TO authenticated;
GRANT INSERT (clinic_id,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state) ON public.patients TO authenticated;
GRANT UPDATE (first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at,deleted_at) ON public.patients TO authenticated;
CREATE POLICY encargo02_patients_read ON public.patients FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_patients_insert ON public.patients FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_patients_update ON public.patients FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));

GRANT SELECT ON public.appointments,public.clinical_records,public.hcu033_forms,public.prescriptions,public.patient_notes,public.patient_files,public.prescription_templates TO authenticated;
-- Server defaults own IDs/creation time; updates cannot move tenant/patient/author.
GRANT INSERT (clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes) ON public.appointments TO authenticated;
GRANT UPDATE (doctor_id,start_time,end_time,status,type,notes,deleted_at) ON public.appointments TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state) ON public.clinical_records TO authenticated;
GRANT UPDATE (diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state,deleted_at) ON public.clinical_records TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,form_data) ON public.hcu033_forms TO authenticated;
GRANT UPDATE (form_data,deleted_at) ON public.hcu033_forms TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,data) ON public.prescriptions TO authenticated;
GRANT UPDATE (data) ON public.prescriptions TO authenticated;
GRANT INSERT (clinic_id,patient_id,author_id,content) ON public.patient_notes TO authenticated;
GRANT UPDATE (content,deleted_at) ON public.patient_notes TO authenticated;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (clinic_id,doctor_id,name,data) ON public.prescription_templates TO authenticated;
GRANT UPDATE (name,data) ON public.prescription_templates TO authenticated;
CREATE POLICY encargo02_appointments_read ON public.appointments FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_appointments_insert ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_appointments_update ON public.appointments FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
DO $clinical_policies$
DECLARE t text; v_author text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    v_author:=CASE t WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' ELSE 'doctor_id' END;
    EXECUTE format('CREATE POLICY encargo02_clinical_read ON public.%I FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id))',t);
    EXECUTE format('CREATE POLICY encargo02_clinical_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id) AND %I=auth.uid())',t,v_author);
    EXECUTE format('CREATE POLICY encargo02_clinical_update ON public.%I FOR UPDATE TO authenticated USING (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid()))) WITH CHECK (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid())))',t,v_author,v_author);
  END LOOP;
END;
$clinical_policies$;

-- Team authority cannot be mutated directly. A user may see their inactive own
-- membership/profile to show an honest denial, never other clinic data.
GRANT SELECT ON public.clinic_members TO authenticated;
CREATE POLICY encargo02_members_read ON public.clinic_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name,avatar_url,phone,address,bio,title,updated_at) ON public.profiles TO authenticated;
CREATE POLICY encargo02_profile_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY encargo02_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() AND status::text='active' AND deleted_at IS NULL) WITH CHECK (id=auth.uid() AND status::text='active' AND deleted_at IS NULL);
GRANT SELECT (id,name,address,phone,email,logo_url,size,working_hours,settings,disclaimer_text,created_at,owner_id) ON public.clinics TO authenticated;
GRANT UPDATE (name,address,phone,email,logo_url,working_hours,disclaimer_text) ON public.clinics TO authenticated;
CREATE POLICY encargo02_clinics_read ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id));
CREATE POLICY encargo02_clinics_update ON public.clinics FOR UPDATE TO authenticated USING (public.get_clinic_member_role(id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(id)='clinic_owner');
GRANT SELECT (id,clinic_id,name,description,duration_minutes,category,is_active,created_at,updated_at,color,category_id) ON public.services TO authenticated;
GRANT UPDATE (name,description,duration_minutes,category,is_active,color,category_id,updated_at) ON public.services TO authenticated;
CREATE POLICY encargo02_services_read ON public.services FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_services_update ON public.services FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.service_categories TO authenticated;
GRANT INSERT (clinic_id,name,color) ON public.service_categories TO authenticated;
GRANT UPDATE (name,color) ON public.service_categories TO authenticated;
CREATE POLICY encargo02_categories_read ON public.service_categories FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_categories_insert ON public.service_categories FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
CREATE POLICY encargo02_categories_update ON public.service_categories FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- M7 rights triggers remain intact; only row predicates stop depending on stale claims.
GRANT SELECT ON public.data_rights_requests TO authenticated;
GRANT INSERT (clinic_id,user_id,patient_id,request_type,details,legal_basis,retention_note) ON public.data_rights_requests TO authenticated;
GRANT UPDATE (status,resolution_notes) ON public.data_rights_requests TO authenticated;
CREATE POLICY encargo02_rights_read ON public.data_rights_requests FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id) AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
CREATE POLICY encargo02_rights_insert ON public.data_rights_requests FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id) AND user_id=auth.uid() AND status='pending' AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_notes IS NULL);
CREATE POLICY encargo02_rights_update ON public.data_rights_requests FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- AUTHORITY_TRIGGERS: no primary profile clinic or ownership fallback.
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.doctor_id IS NOT NULL AND coalesce(security_internal.role_for(NEW.clinic_id,NEW.doctor_id),'') NOT IN ('doctor','clinic_owner')
  THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
-- Safe autofill occurs before identity/author checks for HCU. clinic_id stays
-- explicit; a stale JWT default must not choose another active clinic silently.
ALTER TABLE public.hcu033_forms ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.prescription_templates ALTER COLUMN clinic_id DROP DEFAULT;
CREATE OR REPLACE FUNCTION security_internal.prepare_hcu033_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='INSERT' AND NEW.doctor_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.doctor_id:=auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS encargo02_00_prepare_author ON public.hcu033_forms;
CREATE TRIGGER encargo02_00_prepare_author BEFORE INSERT ON public.hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.prepare_hcu033_author();
-- Replace the existing production synchronization callback without a JWT or
-- patient-derived tenant fallback; keep the baseline's trigger if present.
CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.clinic_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=NEW.patient_id AND p.clinic_id=NEW.clinic_id)
  THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_patient_odontogram_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Patient + clinic partition is guaranteed by M7 and checked again here.
  -- Preserve the historical summary behavior without editing financial fields.
  IF jsonb_typeof(NEW.form_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid clinical document' USING ERRCODE='22023';
  END IF;
  IF NOT (NEW.form_data ?| ARRAY['odontograma_descripcion','odontograma_data']) THEN RETURN NEW; END IF;
  UPDATE public.patients SET last_treatment_note=CASE WHEN NEW.form_data ? 'odontograma_descripcion' THEN NEW.form_data->>'odontograma_descripcion' ELSE last_treatment_note END,
    odontogram_state=CASE WHEN NEW.form_data ? 'odontograma_data' THEN NEW.form_data->'odontograma_data' ELSE odontogram_state END,updated_at=now()
  WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.prepare_hcu033_author(),public.sync_hcu033_form_clinic_id(),public.update_patient_odontogram_summary() FROM PUBLIC,anon,authenticated,service_role;
-- Canonical callbacks in both source variants; absence in stage is not success.
DROP TRIGGER IF EXISTS trg_sync_hcu033_form_clinic_id ON public.hcu033_forms;
CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.sync_hcu033_form_clinic_id();
DROP TRIGGER IF EXISTS tr_update_patient_odontogram ON public.hcu033_forms;
CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_patient_odontogram_summary();
DO $audit_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','clinical_records','hcu033_forms'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','audit_'||t,t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()','audit_'||t,t);
  END LOOP;
END;
$audit_triggers$;
CREATE OR REPLACE FUNCTION security_internal.protect_clinical_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_author_column text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
BEGIN
  IF auth.role()='service_role' OR (auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR ((v_new?'patient_id') AND v_new->'patient_id' IS DISTINCT FROM v_old->'patient_id')
    THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='42501'; END IF;
  END IF;
  v_author_column:=CASE TG_TABLE_NAME WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' WHEN 'appointments' THEN NULL WHEN 'patients' THEN NULL ELSE 'doctor_id' END;
  IF v_author_column IS NOT NULL THEN
    IF TG_OP='INSERT' AND v_new->>v_author_column IS DISTINCT FROM auth.uid()::text
      OR TG_OP='UPDATE' AND v_new->v_author_column IS DISTINCT FROM v_old->v_author_column
    THEN RAISE EXCEPTION 'Immutable clinical author' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_TABLE_NAME='patient_files' THEN
    IF TG_OP='UPDATE' AND NEW.file_path IS DISTINCT FROM OLD.file_path
    THEN RAISE EXCEPTION 'Immutable file path' USING ERRCODE='42501'; END IF;
    IF NEW.file_path !~ ('^'||NEW.clinic_id::text||'/'||NEW.patient_id::text||'/[^/]+$')
    THEN RAISE EXCEPTION 'Invalid file path' USING ERRCODE='23514'; END IF;
  END IF;
  IF v_new?'updated_at' THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object('updated_at',now())); END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.enforce_clinician_assignment(),security_internal.protect_clinical_identity() FROM PUBLIC,anon,authenticated,service_role;
DO $identity_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','appointments','clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS encargo02_protect_identity ON public.%I',t);
    EXECUTE format('CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()',t);
  END LOOP;
END;
$identity_triggers$;

-- Category references must stay in the service's clinic, even for an owner of
-- both clinics. Existing invalid historical links stop review; never repair by deletion.
DO $category_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.services s JOIN public.service_categories c ON c.id=s.category_id WHERE s.clinic_id IS DISTINCT FROM c.clinic_id)
  THEN RAISE EXCEPTION 'Historical category/clinic mismatch requires reconciliation'; END IF;
END;
$category_preflight$;
CREATE OR REPLACE FUNCTION security_internal.protect_service_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at)
  THEN RAISE EXCEPTION 'Immutable service identity' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='services' THEN
    IF NEW.category_id IS NOT NULL THEN
      PERFORM 1 FROM public.service_categories c WHERE c.id=NEW.category_id AND c.clinic_id=NEW.clinic_id FOR KEY SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invalid category reference' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.protect_service_reference() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.services;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.service_categories;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();

CREATE OR REPLACE FUNCTION public.remove_clinic_member(p_target_user_id uuid,p_clinic_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_target_role text;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner'],true);
  IF p_target_user_id IS NULL OR p_target_user_id=auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_target_role FROM public.clinic_members WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id FOR UPDATE;
  IF NOT FOUND OR v_target_role='clinic_owner' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  -- Revoke the tenant membership only. Do not alter another clinic's profile,
  -- primary-clinic preference, clinical authorship, Auth account or historical rows.
  UPDATE public.clinic_members SET status='removed' WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_clinic_member(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid,uuid) TO authenticated;

-- Safely parse path segments before casts; policies never cast malformed input.
CREATE OR REPLACE FUNCTION security_internal.storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[]; v_clinic uuid; v_patient uuid; v_role text;
BEGIN
  v_parts:=string_to_array(p_name,'/');
  IF p_name IS NULL OR length(p_name)>500 OR p_name LIKE '%..%' THEN RETURN false; END IF;
  IF p_bucket IN ('patient-files','patient-avatars') THEN
    IF array_length(v_parts,1)<>3 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR v_parts[2]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[3],'')=''
    THEN RETURN false; END IF;
    v_clinic:=v_parts[1]::uuid; v_patient:=v_parts[2]::uuid;
    v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (p_bucket='patient-avatars' OR v_role IN ('doctor','clinic_owner'))
      AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id=v_patient AND p.clinic_id=v_clinic AND p.deleted_at IS NULL);
  ELSIF p_bucket IN ('clinic-branding','doctor-avatars') THEN
    IF array_length(v_parts,1)<>2 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[2],'')=''
    THEN RETURN false; END IF;
    IF p_bucket='doctor-avatars' THEN
      -- Read a colleague only through a shared live clinic. A removed user cannot
      -- keep avatar privileges solely because their personal profile is active.
      RETURN (NOT p_write OR v_parts[1]=auth.uid()::text) AND EXISTS (
        SELECT 1 FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id
        WHERE p.id=v_parts[1]::uuid AND p.status::text='active' AND p.deleted_at IS NULL
          AND m.status='active' AND m.role IN ('doctor','clinic_owner')
          AND public.check_subscription_active(m.clinic_id));
    END IF;
    v_clinic:=v_parts[1]::uuid; v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (NOT p_write OR v_role='clinic_owner');
  END IF;
  RETURN false;
END;
$function$;
CREATE OR REPLACE FUNCTION security_internal.storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[];
BEGIN
  IF NOT security_internal.storage_access(p_bucket,p_name,true) THEN RETURN false; END IF;
  IF p_bucket<>'patient-files' THEN RETURN true; END IF;
  -- Access helper already checked shape, UUIDs, active patient and live role.
  v_parts:=string_to_array(p_name,'/');
  RETURN NOT EXISTS (SELECT 1 FROM public.patient_files f WHERE f.clinic_id=v_parts[1]::uuid
    AND f.patient_id=v_parts[2]::uuid AND f.file_path=p_name);
END;
$function$;
CREATE OR REPLACE FUNCTION public.encargo02_storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_replace_allowed(p_bucket,p_name); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_replace_allowed(text,text),public.encargo02_storage_replace_allowed(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_replace_allowed(text,text) TO authenticated;
-- RLS calls helper through a public wrapper; private schema remains unexposed.
CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_access(p_bucket,p_name,p_write); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean),public.encargo02_storage_access(text,text,boolean) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_access(text,text,boolean) TO authenticated;
CREATE POLICY encargo02_storage_read ON storage.objects FOR SELECT TO authenticated USING (public.encargo02_storage_access(bucket_id,name,false));
CREATE POLICY encargo02_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));
CREATE POLICY encargo02_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name))
  WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name));
-- No client DELETE of patient bytes: clinical custody cannot be undone by a UI button.
CREATE POLICY encargo02_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('clinic-branding','doctor-avatars') AND owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));

-- Known historical hooks, if present, remain Auth-only. Verify configuration in01/10B.
DO $auth_hook$
BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin; END IF;
END;
$auth_hook$;
-- Explicit owner assertion for every created/replaced callback. Existing owners
-- were checked before DDL; postgres creates new functions. No ALTER OWNER repair.
DO $callback_owners$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Callback must be owned by postgres; no silent reattribution'; END IF;
END;
$callback_owners$;
NOTIFY pgrst,'reload schema';
COMMIT;
