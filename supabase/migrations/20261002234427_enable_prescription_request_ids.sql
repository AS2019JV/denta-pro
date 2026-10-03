-- Prospective permission only; existing PK and immutable receipt enforce retries.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('security_internal.freeze_prescription_receipt()')
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='991bb0106792a1323e357dcc3e3cf1b7'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.prescriptions'::regclass
      AND t.tgname='freeze_prescription_receipt' AND NOT t.tgisinternal
      AND t.tgenabled='O' AND t.tgtype=31
      AND t.tgfoid=to_regprocedure('security_internal.freeze_prescription_receipt()')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_attribute a
      ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.prescriptions'::regclass AND i.indisprimary
      AND i.indnkeyatts=1 AND i.indisvalid AND i.indisready AND a.attname='id'
  ) THEN RAISE EXCEPTION 'Exact immutable receipt and primary key prerequisites required'; END IF;
  IF has_table_privilege('authenticated','public.prescriptions','INSERT')
    OR has_column_privilege('anon','public.prescriptions','id','INSERT')
    OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.prescriptions'::regclass
      AND a.attnum>0 AND NOT a.attisdropped
      AND a.attname NOT IN ('id','clinic_id','patient_id','doctor_id','data')
      AND has_column_privilege('authenticated',a.attrelid,a.attnum,'INSERT'))
  THEN RAISE EXCEPTION 'Unexpected broad prescription insert privileges'; END IF;
END $preflight$;
GRANT INSERT(id) ON public.prescriptions TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
