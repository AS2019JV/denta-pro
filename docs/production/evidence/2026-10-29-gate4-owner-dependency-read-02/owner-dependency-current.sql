-- PROPOSED ONLY: no execution authorization; CURRENT state, never a post-P proof.
-- Three fixed input signatures from the preserved source metadata; no function bodies.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
WITH guard AS (
 SELECT session_user='supabase_storage_admin' AS session_actor_matches,
        current_user='supabase_storage_admin' AS current_actor_matches,
        current_database()='postgres' AS database_matches,
        current_setting('server_version_num')='170011' AS version_matches,
        current_setting('transaction_read_only')='on' AS read_only,
        current_setting('default_transaction_read_only')='on' AS default_read_only,
        inet_server_port()=5432 AS server_port_matches,
        inet_server_addr()=inet '10.253.9.2' AS server_address_matches,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                JOIN pg_roles r ON r.oid=c.relowner
                WHERE n.nspname='storage' AND c.relname='objects'
                  AND c.oid=17300 AND c.relowner=16506
                  AND r.rolname='supabase_storage_admin' AND r.rolname=current_user)
          AS original_object_owner_matches
), admission AS (
 SELECT *, (session_actor_matches AND current_actor_matches AND database_matches
            AND version_matches AND read_only AND default_read_only
            AND server_port_matches AND server_address_matches
            AND original_object_owner_matches) IS TRUE AS accepted
 FROM guard
), requested(ord,schema_name,function_name,input_types) AS (
 VALUES (1,'auth','role',''::oidvector),
        (2,'auth','uid',''::oidvector),
        (3,'storage','foldername','25'::oidvector)
), observed AS (
 SELECT q.ord,q.schema_name,q.function_name,q.input_types,n.oid AS schema_oid,
        p.oid AS function_oid,p.proowner,p.prorettype,p.proretset,
        p.prosecdef,p.provariadic,p.pronargdefaults,
        CASE WHEN n.oid IS NOT NULL
             THEN has_schema_privilege(current_user,n.oid,'USAGE') END AS schema_usage,
        CASE WHEN p.oid IS NOT NULL
             THEN has_function_privilege(current_user,p.oid,'EXECUTE') END AS function_execute,
        (SELECT count(*) FROM pg_proc p2
         WHERE p2.pronamespace=n.oid AND p2.proname=q.function_name) AS named_routine_count
 FROM requested q CROSS JOIN admission a
 LEFT JOIN pg_namespace n ON n.nspname=q.schema_name
 LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=q.function_name
                    AND p.prokind='f' AND p.proargtypes=q.input_types
 WHERE a.accepted
)
SELECT 'G4_OWNER_DEPENDENCY_CURRENT_V1:'||jsonb_build_object(
 'observationState','CURRENT_ONLY',
 'postPStatus','NOT_VERIFIED',
 'fullPAuthority','NOT_VERIFIED',
 'identityChecks',(SELECT to_jsonb(a) FROM admission a),
 'dependencies',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'schema',o.schema_name,'function',o.function_name,
    'expectedInputTypeOIDs',o.input_types::text,
    'schemaExists',o.schema_oid IS NOT NULL,
    'exactInputSignatureExists',o.function_oid IS NOT NULL,
    'namedRoutineCount',o.named_routine_count,
    'functionOID',o.function_oid::text,'ownerOID',o.proowner::text,
    'returnTypeOID',o.prorettype::text,'returnsSet',o.proretset,
    'securityDefiner',o.prosecdef,'variadicTypeOID',o.provariadic::text,
    'defaultArgumentCount',o.pronargdefaults,
    'schemaUsage',o.schema_usage,'functionExecute',o.function_execute,
    'status',CASE WHEN o.schema_oid IS NULL THEN 'SCHEMA_ABSENT'
                  WHEN o.function_oid IS NULL THEN 'EXACT_INPUT_SIGNATURE_ABSENT'
                  WHEN o.schema_usage IS NOT TRUE THEN 'SCHEMA_USAGE_NOT_VERIFIED'
                  WHEN o.function_execute IS NOT TRUE THEN 'FUNCTION_EXECUTE_NOT_VERIFIED'
                  ELSE 'CURRENT_METADATA_ACCESS_PRESENT' END
 ) ORDER BY o.ord) FROM observed o),'[]'::jsonb)
)::text;
ROLLBACK;
