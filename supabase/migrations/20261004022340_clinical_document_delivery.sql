-- Prospective canonical upgrade only. Do not run on an occupied legacy schema.
-- Register the server Auth subject before configuring the hook. Keep disabled
-- subjects registered: disabling must never restore the human JWT role.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery')
    OR to_regclass('security_internal.document_delivery_principals') IS NOT NULL
    OR to_regprocedure('storage.allow_only_operation(text)') IS NULL
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='patient-files' AND file_size_limit=10485760)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='encargo02_storage_read' AND cmd='SELECT' AND permissive='PERMISSIVE')
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline and unused isolated role required'; END IF;
END $preflight$;

CREATE ROLE clinia_document_delivery NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT clinia_document_delivery TO authenticator;
GRANT USAGE ON SCHEMA public,storage,security_internal TO clinia_document_delivery;
GRANT SELECT ON storage.objects TO clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_principals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_internal.document_delivery_principals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_principals FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  file_id uuid NOT NULL
);
ALTER TABLE security_internal.document_delivery_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_audit FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

-- Records authorization to publish, not proof the client received/saved bytes.
-- No names, paths, bearer credentials or clinical content enter the audit row.
CREATE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.file_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role,clinia_document_delivery;
GRANT EXECUTE ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.clinia_document_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_user uuid;
BEGIN
  -- The hook is invoked only by managed Auth, never by an ordinary actor.
  v_user:=(event->>'user_id')::uuid;
  IF (event->'claims'->>'sub') IS DISTINCT FROM v_user::text
  THEN RAISE EXCEPTION 'Auth subject mismatch' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE user_id=v_user)
  THEN event:=jsonb_set(event,'{claims,role}',to_jsonb('clinia_document_delivery'::text),false); END IF;
  RETURN event;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_document_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.clinia_document_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE FUNCTION public.clinia_document_delivery_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='clinia_document_delivery' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM security_internal.document_delivery_principals p
      JOIN auth.users u ON u.id=p.user_id JOIN auth.sessions s ON s.user_id=u.id
      WHERE p.user_id=auth.uid() AND p.enabled AND (p.expires_at IS NULL OR p.expires_at>now())
        AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_document_delivery_active() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_document_delivery_active() TO clinia_document_delivery;

CREATE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active() AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.file_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;
REVOKE ALL ON FUNCTION security_internal.document_object_read_allowed(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION security_internal.document_object_read_allowed(text) TO clinia_document_delivery;

-- A restrictive policy is required: permissive policies combine with OR.
CREATE POLICY clinia_no_human_clinical_object_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id<>'patient-files');
CREATE POLICY clinia_document_delivery_read ON storage.objects
  FOR SELECT TO clinia_document_delivery USING (
    bucket_id='patient-files' AND storage.allow_only_operation('object.get_authenticated')
    AND security_internal.document_object_read_allowed(name)
  );

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND p.oid<>'public.clinia_document_delivery_active()'::regprocedure
        AND has_function_privilege('clinia_document_delivery',p.oid,'EXECUTE'))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
