-- Prospective canonical staging/candidate only; never legacy occupied production.
-- S3 session-token requests retain RLS. Generated S3 keys bypass RLS and are
-- explicitly outside this design. No REST fallback or new role privileges.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='security_internal.document_object_read_allowed(text)'::regprocedure
      AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(prosrc,'\s+','','g'))='1bb5e1a423735400876ea9dbde2971a5')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_document_delivery_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['clinia_document_delivery']::name[]
      AND qual='((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''object.get_authenticated''::text, ''object.get_authenticated_info''::text]) AND security_internal.document_object_read_allowed(name))')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND NOT public)<>4
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
END $preflight$;
ALTER POLICY clinia_document_delivery_read ON storage.objects USING (
  bucket_id='patient-files'
  AND storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  AND security_internal.document_object_read_allowed(name)
);
DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;
COMMIT;
