BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $guard$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a' AND email ~ '^clinia-document-expiry_a-[a-f0-9]{12}@clinia\.invalid$' AND status='suspended' AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Exact suspended synthetic profile required'; END IF;
END $guard$;
UPDATE public.profiles SET status='active',deleted_at=now(),updated_at=now() WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a';
COMMIT;
SELECT now() observed_at,id,role,status,deleted_at FROM public.profiles WHERE id='ae54f779-8e99-414a-87ee-b554107e7f8a';
