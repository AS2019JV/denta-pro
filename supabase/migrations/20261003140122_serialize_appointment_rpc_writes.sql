-- PROSPECTIVE forward for the exact reviewed operational agenda + live Auth chain.
-- Ordinary appointment writes use the existing authorized RPC. Clinic queues are
-- acquired before tuple/Auth authority locks; exclusion remains the final arbiter.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE v record; a record;
  v_insert text[]:=ARRAY['clinic_id','patient_id','doctor_id','start_time','end_time','status','type','notes'];
  v_update text[]:=ARRAY['doctor_id','start_time','end_time','status','type','notes','deleted_at'];
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.save_clinic_appointment(uuid,jsonb,uuid)','997c9a0e5b2006653d777c85039c0e49'),
    ('security_internal.guard_operational_appointment()','852e98f6d3e11eb76557f652f10c725d'),
    ('security_internal.require_clinic(uuid,text[],boolean)','e7c822cbffb3195f70088e7e4617a043'),
    ('security_internal.lock_clinia_session()','69a325cf0b73743dc5a50b2c6f4a7170')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed function prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass
      AND conname='agenda_no_overlap' AND contype='x' AND convalidated)
    OR NOT has_function_privilege('authenticated','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','public.appointments','INSERT')
    OR has_table_privilege('authenticated','public.appointments','UPDATE')
    OR NOT has_table_privilege('service_role','public.appointments','INSERT')
    OR NOT has_table_privilege('service_role','public.appointments','UPDATE')
  THEN RAISE EXCEPTION 'Exact reviewed agenda RLS, exclusion and RPC privileges required'; END IF;
  FOR a IN SELECT attname FROM pg_catalog.pg_attribute
    WHERE attrelid='public.appointments'::regclass AND attnum>0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated','public.appointments',a.attname,'INSERT') IS DISTINCT FROM (a.attname=ANY(v_insert))
      OR has_column_privilege('authenticated','public.appointments',a.attname,'UPDATE') IS DISTINCT FROM (a.attname=ANY(v_update))
      OR has_column_privilege('anon','public.appointments',a.attname,'INSERT')
      OR has_column_privilege('anon','public.appointments',a.attname,'UPDATE')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'INSERT')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'UPDATE')
    THEN RAISE EXCEPTION 'Unexpected appointment column grant; stop and review: %',a.attname; END IF;
  END LOOP;
END $preflight$;

-- Bind objects that this change must preserve, including RLS policies, triggers,
-- all constraints, authority bodies and routine ACLs. This is transaction-local.
CREATE TEMP TABLE clinia_agenda_contract_before ON COMMIT DROP AS
SELECT jsonb_build_object(
  'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
  'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
    'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
    'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
    'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
  'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
  ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
) AS contract;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],false);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  -- Queue before acquiring live authority or appointment row locks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinia.appointment.clinic:'||p_clinic_id::text,0));
  -- A queued actor may have been revoked or changed role. Recheck and lock now.
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Revoke only the exact previously reviewed direct DML grants. SELECT and RLS
-- policies remain unchanged; the definer RPC still runs its live authority checks.
-- Canonical trusted service_role maintenance grants are preserved. Privileged
-- concurrent maintenance must use this clinic advisory lock before writing;
-- serialization here is proved for ordinary authenticated RPC callers.
REVOKE INSERT(clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes),
  UPDATE(doctor_id,start_time,end_time,status,type,notes,deleted_at)
  ON public.appointments FROM authenticated;

DO $postflight$
DECLARE v_after jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))='caae0bd668648dac2b32686b658be02d')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE a.attrelid='public.appointments'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND (has_column_privilege(r.role_name,'public.appointments',a.attname,'INSERT')
          OR has_column_privilege(r.role_name,'public.appointments',a.attname,'UPDATE')))
    OR EXISTS(SELECT 1 FROM (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE has_table_privilege(r.role_name,'public.appointments','INSERT') OR has_table_privilege(r.role_name,'public.appointments','UPDATE'))
  THEN RAISE EXCEPTION 'Appointment RPC serialization postcondition failed'; END IF;
  SELECT jsonb_build_object(
    'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
    'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
      'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
      'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
      'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
    'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
    ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM (SELECT contract FROM pg_temp.clinia_agenda_contract_before)
  THEN RAISE EXCEPTION 'Agenda authority, RLS, triggers, constraints or RPC ACL changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
