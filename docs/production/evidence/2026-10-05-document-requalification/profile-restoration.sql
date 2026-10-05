BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $guard$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a' AND email ~ '^clinia-document-expiry_a-[a-f0-9]{12}@clinia\.invalid$' AND status='active' AND deleted_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Exact logically deleted synthetic profile required'; END IF;
END $guard$;
UPDATE public.profiles SET deleted_at=NULL,updated_at=now() WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a';
COMMIT;
SELECT now() observed_at,p.id,p.role,p.status,p.deleted_at,m.role member_role,m.status member_status,
 EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id='41069974-b77e-4d29-9fd0-383db5b3fdea' AND s.user_id=p.id) original_session_present
 FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id AND m.clinic_id='d9a47157-1d36-43df-af1d-436d561ee551'
 WHERE p.id='ae54f779-8e99-414a-87ee-b554107e7f8a';
