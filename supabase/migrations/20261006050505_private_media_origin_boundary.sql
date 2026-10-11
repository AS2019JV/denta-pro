-- Prospective canonical staging/candidate only. Run with delivery disabled.
-- This DDL does not retire historical URLs: the controlled byte/key migration
-- must populate retired keys and switch delivery_path before enabling delivery.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0'),
    ('security_internal.protect_clinical_identity()','289457d532605e80868a41ecff9ad78a'),
    ('security_internal.document_object_read_allowed(text)','1bb5e1a423735400876ea9dbde2971a5'),
    ('public.clinia_audit_document_delivery(uuid,uuid,uuid,text)','fd51db1149a6a0de8b58cfda8bd3a307'),
    ('public.clinia_document_delivery_active()','8fa375ac766bb33cd74fee65ef7c02f7')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR to_regclass('security_internal.retired_storage_objects') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.patient_files'::regclass AND attname='delivery_path' AND NOT attisdropped)
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>6
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
  -- Compare every expression, role, command and policy kind; no permissive drift.
  FOR v IN SELECT * FROM (VALUES
    ('encargo02_storage_read','SELECT','PERMISSIVE',ARRAY['authenticated']::name[],
      'public.encargo02_storage_access(bucket_id, name, false)',NULL),
    ('encargo02_storage_insert','INSERT','PERMISSIVE',ARRAY['authenticated']::name[],NULL,
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))'),
    ('encargo02_storage_update','UPDATE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))',
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))'),
    ('encargo02_storage_delete','DELETE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((bucket_id = ANY (ARRAY[''clinic-branding''::text, ''doctor-avatars''::text])) AND (owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))',NULL),
    ('clinia_no_human_clinical_object_read','SELECT','RESTRICTIVE',ARRAY['authenticated']::name[],
      '(bucket_id <> ''patient-files''::text)',NULL),
    ('clinia_document_delivery_read','SELECT','PERMISSIVE',ARRAY['clinia_document_delivery']::name[],
      '((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''storage.s3.object.get''::text, ''storage.s3.object.info''::text]) AND security_internal.document_object_read_allowed(name))',NULL)
  ) x(policyname,cmd,permissive,roles,qual,with_check) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
      AND p.policyname=v.policyname AND p.cmd=v.cmd AND p.permissive=v.permissive AND p.roles=v.roles
      AND p.qual IS NOT DISTINCT FROM v.qual AND p.with_check IS NOT DISTINCT FROM v.with_check)
    THEN RAISE EXCEPTION 'Exact reviewed Storage policy required: %',v.policyname; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.patient_files'::regclass
    AND tgname='encargo02_protect_identity' AND tgfoid='security_internal.protect_clinical_identity()'::regprocedure
    AND tgenabled='O' AND tgtype=23)
  THEN RAISE EXCEPTION 'Unchanged patient file identity trigger required'; END IF;
END $preflight$;

CREATE TABLE security_internal.retired_storage_objects (
  bucket_id text NOT NULL CHECK (bucket_id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')),
  name text NOT NULL CHECK (length(name)>0),
  retired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id,name)
);
ALTER TABLE security_internal.retired_storage_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.retired_storage_objects FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.storage_object_retired(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT EXISTS (SELECT 1 FROM security_internal.retired_storage_objects r WHERE r.bucket_id=p_bucket AND r.name=p_name);
$function$;
REVOKE ALL ON FUNCTION security_internal.storage_object_retired(text,text) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

ALTER TABLE public.patient_files ADD COLUMN delivery_path text;
UPDATE public.patient_files SET delivery_path=file_path;
ALTER TABLE public.patient_files ALTER COLUMN delivery_path SET NOT NULL;
ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_delivery_path_scope CHECK (
  delivery_path ~ ('^'||clinic_id::text||'/'||patient_id::text||'/[^/]+$')
  AND length(delivery_path)<=500 AND delivery_path NOT LIKE '%..%'
);
-- Preserve service-role privileges only on the original columns. A table-level
-- INSERT/UPDATE grant would silently confer authority over all future columns.
REVOKE INSERT,UPDATE ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at),
  UPDATE (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at)
  ON public.patient_files TO service_role;
REVOKE INSERT(delivery_path),UPDATE(delivery_path) ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.initialize_document_delivery_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  NEW.delivery_path:=NEW.file_path;
  IF security_internal.storage_object_retired('patient-files',NEW.delivery_path)
  THEN RAISE EXCEPTION 'Retired object path' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.initialize_document_delivery_path() FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
CREATE TRIGGER clinia_initialize_delivery_path BEFORE INSERT ON public.patient_files
  FOR EACH ROW EXECUTE FUNCTION security_internal.initialize_document_delivery_path();

CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT NOT security_internal.storage_object_retired(p_bucket,p_name)
    AND security_internal.storage_access(p_bucket,p_name,p_write);
$function$;

CREATE OR REPLACE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active()
    AND NOT security_internal.storage_object_retired('patient-files',p_name) AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.delivery_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;

CREATE OR REPLACE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF security_internal.storage_object_retired('patient-files',p_path)
    OR NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.delivery_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;

-- Live ACL remains the permissive policy. These restrictions only narrow it.
CREATE POLICY clinia_private_media_origin_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  );
CREATE POLICY clinia_private_media_origin_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_only_operation('storage.object.upload')
  );
CREATE POLICY clinia_private_media_no_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'))
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));
CREATE POLICY clinia_private_media_no_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));

DO $postflight$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','clinia_document_delivery'] LOOP
    IF has_column_privilege(r,'public.patient_files','delivery_path','INSERT,UPDATE')
      OR has_table_privilege(r,'security_internal.retired_storage_objects','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_function_privilege(r,'security_internal.storage_object_retired(text,text)','EXECUTE')
      OR has_function_privilege(r,'security_internal.initialize_document_delivery_path()','EXECUTE')
    THEN RAISE EXCEPTION 'Private origin boundary privilege leak for %',r; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR (SELECT md5(regexp_replace(prosrc,'\s+','','g')) FROM pg_catalog.pg_proc
      WHERE oid='security_internal.protect_clinical_identity()'::regprocedure)<>'289457d532605e80868a41ecff9ad78a'
  THEN RAISE EXCEPTION 'Authority or immutable identity boundary changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
