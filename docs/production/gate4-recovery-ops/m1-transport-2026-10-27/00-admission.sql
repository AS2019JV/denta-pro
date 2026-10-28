BEGIN READ ONLY; SET LOCAL row_security=off; SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions; DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT system_identifier::text FROM pg_control_system())<>'7701080397606109221' THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_IDENTITY_REFUSED'; END IF; END $identity$;
DO $empty$ BEGIN IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S','f')) OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal')) OR EXISTS(SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','logs','security_internal')) OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('logs','security_internal')) OR EXISTS(SELECT FROM auth.users) OR EXISTS(SELECT FROM auth.mfa_factors) OR EXISTS(SELECT FROM storage.buckets) OR EXISTS(SELECT FROM storage.objects) OR to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_EMPTY_REFUSED'; END IF; IF NOT has_schema_privilege(current_user,'public','CREATE') OR NOT has_table_privilege(current_user,'auth.users','TRIGGER') THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_PRIVILEGE_REFUSED'; END IF; END $empty$;
DO $native$ BEGIN IF (SELECT count(*) FROM auth.schema_migrations)<>82 OR (SELECT count(*) FROM storage.migrations)<>74 OR EXISTS(SELECT FROM auth.users) OR EXISTS(SELECT FROM auth.mfa_factors) OR EXISTS(SELECT FROM storage.buckets) OR EXISTS(SELECT FROM storage.objects) OR to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN RAISE EXCEPTION 'GATE4_M1_MANAGED_DRIFT_REFUSED'; END IF; END $native$;
DO $policy_owner$ BEGIN IF NOT COALESCE((SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname='objects'),false) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='M1_STORAGE_POLICY_OWNER_REQUIRED'; END IF; END $policy_owner$;
-- Read-only, bounded affected-managed metadata; never a whole-managed-parity claim.
SELECT 'M1_META:' || jsonb_build_object(
 'identity',jsonb_build_object('database',current_database(),'user',current_user,'sessionUser',session_user,
  'version',current_setting('server_version_num'),'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),
  'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)),
 'authority',jsonb_build_object('publicCreate',has_schema_privilege(current_user,'public','CREATE'),
  'authTrigger',has_table_privilege(current_user,'auth.users','TRIGGER'),
  'storagePolicyOwner',COALESCE((SELECT pg_has_role(current_user,c.relowner,'USAGE')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname='objects'),false)),
 'managed',jsonb_build_object(
  'schemas',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname,'oid',n.oid,'ownerOID',n.nspowner,
    'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text) ORDER BY n.nspname)
    FROM pg_namespace n WHERE n.nspname IN ('auth','storage')),
  'relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'oid',c.oid,
    'ownerOID',c.relowner,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
    'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'num',a.attnum,'acl',a.attacl::text) ORDER BY a.attnum)
     FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname='auth' AND c.relname='users') OR (n.nspname='storage' AND c.relname='objects'))),
 'native',jsonb_build_object('auth',(SELECT count(*) FROM auth.schema_migrations),'storage',(SELECT count(*) FROM storage.migrations),
  'ledgerAbsent',to_regclass('supabase_migrations.schema_migrations') IS NULL),
 'counts',jsonb_build_object('users',(SELECT count(*) FROM auth.users),'mfa',(SELECT count(*) FROM auth.mfa_factors),
  'buckets',(SELECT count(*) FROM storage.buckets),'objects',(SELECT count(*) FROM storage.objects)),
 'applicationRelations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S','f')),
 'clientUsage',jsonb_build_object('anon',has_schema_privilege('anon','public','USAGE'),
  'authenticated',has_schema_privilege('authenticated','public','USAGE'),'service_role',has_schema_privilege('service_role','public','USAGE'))
)::text;
ROLLBACK;