-- LOCAL SYNTHETIC ONLY. Not a deployment migration or a remote repair.
-- Five questions/acceptance: see tools/local-supabase/README.md.
-- Reconcile only three newly created M7 functions and their private schema.
-- The executor independently verifies Docker identity and loopback ports.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path='';
DO $review$
DECLARE r record; v_owner text;
BEGIN
  IF current_user<>'supabase_admin' OR session_user<>'supabase_admin'
    OR current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Verified genuine local admin executor required'; END IF;
  SELECT pg_catalog.pg_get_userbyid(nspowner) INTO v_owner
    FROM pg_catalog.pg_namespace WHERE nspname='security_internal';
  IF v_owner NOT IN ('postgres','supabase_admin') OR v_owner IS NULL
  THEN RAISE EXCEPTION 'Unexpected private schema owner'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('security_internal.enforce_clinician_assignment()','87184b33612e86bfcc8c153db1449307'),
    ('security_internal.audit_data_rights_status()','043465d08eb08c1752562f09cafe048c'),
    ('public.guard_data_rights_request_insert()','88e654c014bc9969fe94c3580d558503')
  ) AS expected(identity,body_md5) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(r.identity)
      AND md5(replace(p.prosrc,E'\r\n',E'\n'))=r.body_md5
      AND pg_catalog.pg_get_userbyid(p.proowner) IN ('postgres','supabase_admin')
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
    THEN RAISE EXCEPTION 'Exact closed M7 callback required: %',r.identity; END IF;
  END LOOP;
END;
$review$;
ALTER SCHEMA security_internal OWNER TO postgres;
ALTER FUNCTION security_internal.enforce_clinician_assignment() OWNER TO postgres;
ALTER FUNCTION security_internal.audit_data_rights_status() OWNER TO postgres;
ALTER FUNCTION public.guard_data_rights_request_insert() OWNER TO postgres;
COMMIT;
