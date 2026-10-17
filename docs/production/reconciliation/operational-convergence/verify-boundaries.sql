BEGIN READ ONLY;
SET LOCAL search_path='';
DO $verify$
DECLARE v_kind "char"; v_schema oid; v_acl aclitem[];
BEGIN
  IF NOT has_schema_privilege('authenticated','public','USAGE')
    OR has_schema_privilege('authenticated','public','CREATE') OR has_schema_privilege('anon','public','CREATE')
    OR has_schema_privilege('authenticated','logs','USAGE,CREATE') OR has_schema_privilege('anon','logs','USAGE,CREATE')
    OR has_schema_privilege('authenticated','security_internal','USAGE,CREATE') OR has_schema_privilege('anon','security_internal','USAGE,CREATE')
  THEN RAISE EXCEPTION 'Schema boundary differs'; END IF;
  FOREACH v_kind IN ARRAY ARRAY['r','S','f']::"char"[] LOOP
    FOREACH v_schema IN ARRAY ARRAY[0,(SELECT oid FROM pg_namespace WHERE nspname='public')]::oid[] LOOP
      SELECT defaclacl INTO v_acl FROM pg_default_acl WHERE defaclrole='postgres'::regrole AND defaclnamespace=v_schema AND defaclobjtype=v_kind;
      -- Missing GLOBAL function default means PUBLIC EXECUTE; missing schema
      -- default adds nothing. Evaluate actual defaults rather than row presence.
      IF v_schema=0 THEN v_acl:=coalesce(v_acl,acldefault(v_kind,'postgres'::regrole)); END IF;
      IF EXISTS(SELECT 1 FROM aclexplode(coalesce(v_acl,'{}'::aclitem[])) a WHERE a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))
      THEN RAISE EXCEPTION 'Client default privilege leaked: kind %, schema %',v_kind,v_schema; END IF;
    END LOOP;
  END LOOP;
END $verify$;
SELECT 'PASS schema usage and restrictive global/schema defaults';
ROLLBACK;
