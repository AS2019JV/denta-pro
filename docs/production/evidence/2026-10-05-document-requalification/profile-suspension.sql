BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $guard$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id
 WHERE p.id='ae54f779-8e99-414a-87ee-b554107e7f8a' AND p.email ~ '^clinia-document-expiry_a-[a-f0-9]{12}@clinia\.invalid$'
 AND p.role='doctor' AND p.status='active' AND p.deleted_at IS NULL AND m.clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND m.role='doctor' AND m.status='active')
 THEN RAISE EXCEPTION 'Exact active synthetic expiry doctor required'; END IF;
END $guard$;
UPDATE public.profiles SET status='suspended',updated_at=now() WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a';
COMMIT;
SELECT now() observed_at,id,role,status,deleted_at FROM public.profiles WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a';
