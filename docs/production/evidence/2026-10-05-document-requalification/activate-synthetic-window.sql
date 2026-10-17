BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.profiles WHERE id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e','ab8235dd-784e-451e-a679-dc6450cc5fb9','20cfdd4b-c8b5-4f66-b96e-e1cfcc2d2a96','ae54f779-8e99-414a-87ee-b554107e7f8a') AND role IS NULL AND status='active' AND deleted_at IS NULL AND clinic_id IS NULL AND email ~ '^clinia-document-(removed_a|demoted_a|logout_a|ban_a|expiry_a)-[a-f0-9]{12}@clinia\.invalid$')<>5
 OR EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e','ab8235dd-784e-451e-a679-dc6450cc5fb9','20cfdd4b-c8b5-4f66-b96e-e1cfcc2d2a96','ae54f779-8e99-414a-87ee-b554107e7f8a','378b431f-f043-489c-820b-347901a78d11'))
 OR NOT EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE user_id='378b431f-f043-489c-820b-347901a78d11' AND enabled IS FALSE AND expires_at<now())
 THEN RAISE EXCEPTION 'Exact fresh synthetic staging baseline required'; END IF;
END $check$;
UPDATE public.profiles SET role='doctor',clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',updated_at=now()
 WHERE id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e','ab8235dd-784e-451e-a679-dc6450cc5fb9','20cfdd4b-c8b5-4f66-b96e-e1cfcc2d2a96','ae54f779-8e99-414a-87ee-b554107e7f8a');
INSERT INTO public.clinic_members (user_id,clinic_id,role,status)
 SELECT id,'d9a47157-1d36-43df-af1d-436d561ee551','doctor','active' FROM public.profiles
 WHERE id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e','ab8235dd-784e-451e-a679-dc6450cc5fb9','20cfdd4b-c8b5-4f66-b96e-e1cfcc2d2a96','ae54f779-8e99-414a-87ee-b554107e7f8a');
UPDATE security_internal.document_delivery_principals SET enabled=true,expires_at=now()+interval '90 minutes'
 WHERE user_id='378b431f-f043-489c-820b-347901a78d11';
COMMIT;
SELECT now() observed_at,
 (SELECT jsonb_agg(jsonb_build_object('id',p.id,'profile_role',p.role,'profile_status',p.status,'deleted_at',p.deleted_at,'member_role',m.role,'member_status',m.status))
  FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id AND m.clinic_id=p.clinic_id
  WHERE p.id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e','ab8235dd-784e-451e-a679-dc6450cc5fb9','20cfdd4b-c8b5-4f66-b96e-e1cfcc2d2a96','ae54f779-8e99-414a-87ee-b554107e7f8a')) actors,
 (SELECT jsonb_build_object('user_id',user_id,'enabled',enabled,'expires_at',expires_at) FROM security_internal.document_delivery_principals WHERE user_id='378b431f-f043-489c-820b-347901a78d11') principal;
