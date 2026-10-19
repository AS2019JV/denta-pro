-- Gate 3 conservative delta. No row update, new grant, or cascading deletion.
-- Execute only through the reviewed disposable canonical package.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE c record;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
    OR current_setting('app.clean_managed_project',true) !~ '^clinia-clean-20261002-[45]$'
    OR current_setting('app.clean_managed_project',true) IS NULL
    OR current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
  THEN RAISE EXCEPTION 'New isolated canonical package target required'; END IF;
  SELECT * INTO STRICT c FROM pg_catalog.pg_constraint
    WHERE conrelid='public.payment_methods'::regclass AND conname='payment_methods_clinic_id_fkey';
  IF c.contype<>'f' OR c.confrelid<>'public.clinics'::regclass
    OR c.confupdtype<>'a' OR c.confdeltype NOT IN ('a','c') OR c.confmatchtype<>'s'
    OR NOT c.convalidated OR c.condeferrable OR c.condeferred
    OR replace(pg_catalog.pg_get_constraintdef(c.oid,true),'public.','') NOT IN
      ('FOREIGN KEY (clinic_id) REFERENCES clinics(id)',
       'FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE')
  THEN RAISE EXCEPTION 'Unreviewed payment method FK drift'; END IF;
  IF c.confdeltype='c' THEN
    ALTER TABLE public.payment_methods DROP CONSTRAINT payment_methods_clinic_id_fkey;
    ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE NO ACTION;
  END IF;
END $guard$;
COMMIT;
