BEGIN;
DO $guard$ BEGIN
IF (SELECT count(*) FROM security_internal.document_delivery_principals WHERE user_id='378b431f-f043-489c-820b-347901a78d11')<>1
OR EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id='378b431f-f043-489c-820b-347901a78d11')
THEN RAISE EXCEPTION 'Expected isolated staging principal required'; END IF;
END $guard$;
UPDATE security_internal.document_delivery_principals SET enabled=false WHERE user_id='378b431f-f043-489c-820b-347901a78d11';
COMMIT;
SELECT now() observed_at,user_id,enabled,expires_at,
(SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE) private_buckets,
(SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE') human_restriction,
to_regprocedure('public.clinia_document_access_token_hook(jsonb)') IS NOT NULL hook_retained,
EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper) isolated_role_retained
FROM security_internal.document_delivery_principals WHERE user_id='378b431f-f043-489c-820b-347901a78d11';
