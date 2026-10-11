-- PREPARED / NOT EXECUTED. Emergency closure only in independently verified
-- genuine loopback synthetic Supabase. Never restores historical privileges.
BEGIN;
SET LOCAL search_path='';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
  IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('app.encargo02_authorized',true) IS DISTINCT FROM 'reviewed-local-forward'
    OR current_user<>'postgres' OR session_user<>'postgres'
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Verified local synthetic postgres executor required'; END IF;
END;
$guard$;
DO $contain$
DECLARE r record; v_columns text;
BEGIN
  FOR r IN SELECT n.nspname,c.relname,c.relkind,c.oid FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S') LOOP
    IF r.relkind='S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns FROM pg_catalog.pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
      IF v_columns IS NOT NULL THEN
        EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE %I.%I FROM PUBLIC,anon,authenticated',v_columns,v_columns,v_columns,v_columns,r.nspname,r.relname);
      END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',r.nspname,r.proname,r.args);
  END LOOP;
  -- A false restrictive policy also blocks any future permissive Storage policy.
  EXECUTE 'DROP POLICY IF EXISTS encargo02_containment ON storage.objects';
  EXECUTE 'CREATE POLICY encargo02_containment ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING (false) WITH CHECK (false)';
END;
$contain$;
REVOKE ALL ON SCHEMA logs,security_internal FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
-- No row mutation, table/function deletion, or Storage byte operation. Service
-- credentials and previously issued signed URLs remain separate capabilities.
