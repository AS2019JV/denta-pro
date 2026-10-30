-- PROPOSAL ONLY. One catalog observation as directly authenticated postgres.
-- No application/native service function calls, row data, bodies, credentials or DDL.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='3s';
SET LOCAL lock_timeout='1s';
SET LOCAL idle_in_transaction_session_timeout='5s';
WITH guard AS (
 SELECT session_user='postgres' AND current_user='postgres'
   AND current_database()='postgres' AND current_setting('server_version_num')='170011'
   AND current_setting('transaction_read_only')='on'
   AND current_setting('default_transaction_read_only')='on'
   AND inet_server_addr()=inet '10.253.9.2' AND inet_server_port()=5432
   AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
   AND (SELECT system_identifier::text FROM pg_control_system())='7701080397606109221' AS accepted
), actors(name) AS (
 VALUES ('postgres'),('supabase_storage_admin'),('supabase_auth_admin'),
        ('anon'),('authenticated'),('service_role')
), schemas(name) AS (VALUES ('public'),('logs'),('security_internal'),('auth'),('storage')),
objects(schema_name,object_name) AS (
 VALUES ('auth','users'),
        ('auth','identities'),
        ('auth','sessions'),
        ('auth','refresh_tokens'),
        ('auth','mfa_factors'),
        ('auth','mfa_challenges'),
        ('auth','mfa_amr_claims'),
        ('auth','audit_log_entries'),
        ('storage','buckets'),
        ('storage','objects'),
        ('logs','access_audit'),
        ('logs','access_audit_id_seq'),
        ('public','appointments'),
        ('public','automation_settings'),
        ('public','billings'),
        ('public','clinic_invitations'),
        ('public','clinic_members'),
        ('public','clinical_records'),
        ('public','clinics'),
        ('public','dashboard_stats_view'),
        ('public','data_rights_requests'),
        ('public','hcu033_forms'),
        ('public','invoices'),
        ('public','messages'),
        ('public','notifications'),
        ('public','patient_files'),
        ('public','patient_notes'),
        ('public','patient_stats_view'),
        ('public','patients'),
        ('public','payment_methods'),
        ('public','payments'),
        ('public','prescription_templates'),
        ('public','prescriptions'),
        ('public','profile_audit_log'),
        ('public','profile_audit_log_id_seq'),
        ('public','profiles'),
        ('public','recall_queue'),
        ('public','receptionist_patient_view'),
        ('public','service_categories'),
        ('public','services'),
        ('public','treatments')
), routines(schema_name,routine_name,input_types) AS (
 VALUES ('auth','role',''::oidvector),
        ('auth','uid',''::oidvector),
        ('storage','foldername','25'::oidvector),
        ('logs','log_access_trigger',''::oidvector),
        ('logs','log_patient_view','2950'::oidvector),
        ('public','accept_clinic_invitation','25'::oidvector),
        ('public','archive_clinic','2950'::oidvector),
        ('public','check_subscription_active','2950'::oidvector),
        ('public','cleanup_soft_deleted_records',''::oidvector),
        ('public','create_tenant_clinic','25 25 25'::oidvector),
        ('public','custom_access_token_hook','3802'::oidvector),
        ('public','enforce_patient_clinical_privileges',''::oidvector),
        ('public','get_checkout_payment_methods','2950'::oidvector),
        ('public','get_clinic_member_role','2950'::oidvector),
        ('public','get_family_unit_with_stats','2950'::oidvector),
        ('public','get_patient_profile_secure','2950'::oidvector),
        ('public','get_patients_with_stats','2950 25 23 23 25 25 16 2950'::oidvector),
        ('public','get_user_clinic_id',''::oidvector),
        ('public','guard_patient_clinical_insert',''::oidvector),
        ('public','handle_new_user',''::oidvector),
        ('public','handle_verified_clinic_creation',''::oidvector),
        ('public','is_clinic_member','2950'::oidvector),
        ('public','log_data_rights_request','25 3802 25 25'::oidvector),
        ('public','log_profile_changes',''::oidvector),
        ('public','prevent_profile_privilege_escalation',''::oidvector),
        ('public','protect_data_rights_requests',''::oidvector),
        ('public','purge_clinic_data','2950'::oidvector),
        ('public','remove_clinic_member','2950 2950'::oidvector),
        ('public','seed_default_services','2950'::oidvector),
        ('public','set_updated_at',''::oidvector),
        ('public','sync_hcu033_form_clinic_id',''::oidvector),
        ('public','update_billing_status',''::oidvector),
        ('public','update_patient_odontogram_summary',''::oidvector)
), native_settings AS (
 SELECT (SELECT setting FROM pg_settings WHERE name='supautils.version' AND context='internal') AS version,
        current_setting('supautils.policy_grants',true) AS policy_grants,
        current_setting('supautils.privileged_role',true) AS privileged_role
), native_json AS (
 SELECT *, CASE WHEN pg_input_is_valid(policy_grants,'jsonb') THEN policy_grants::jsonb END AS policy_json
 FROM native_settings
)
SELECT 'G4_AUTHORITY_CURRENT_V1:'||jsonb_build_object(
 'accepted',(SELECT accepted IS TRUE FROM guard),
 'scope','CURRENT_ONLY_NOT_DDL_OR_POST_P_PROOF',
 'metadata',CASE WHEN (SELECT accepted IS TRUE FROM guard) THEN jsonb_build_object(
 'databaseCreate',has_database_privilege(current_user,current_database(),'CREATE'),
 'plpgsqlUsage',has_language_privilege(current_user,'plpgsql','USAGE'),
 'btreeGistExists',EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist'),
 'databaseOwnerIsPostgres',(SELECT pg_get_userbyid(datdba)='postgres' FROM pg_database WHERE datname=current_database()),
 'native',jsonb_build_object(
   'sharedPreloadNamesSupautils',coalesce(current_setting('shared_preload_libraries',true)~'(^|,)[[:space:]]*(\$libdir/)?supautils[[:space:]]*(,|$)',false),
   'sessionPreloadNamesSupautils',coalesce(current_setting('session_preload_libraries',true)~'(^|,)[[:space:]]*(\$libdir/)?supautils[[:space:]]*(,|$)',false),
   'versionInternalRegistered',(SELECT version IS NOT NULL FROM native_json),
   'version',(SELECT CASE WHEN version~'^v?[0-9]+(\.[0-9]+){0,3}(-[a-z0-9.-]+)?$' THEN version END FROM native_json),
   'privilegedRole',(SELECT CASE privileged_role WHEN 'postgres' THEN 'POSTGRES' WHEN 'supabase_privileged_role' THEN 'SUPABASE_PRIVILEGED_ROLE' WHEN '' THEN 'EMPTY' ELSE CASE WHEN privileged_role IS NULL THEN 'MISSING' ELSE 'UNLISTED' END END FROM native_json),
   'postgresHasExistingPrivilegedRoleUsage',(SELECT pg_has_role('postgres',r.oid,'USAGE') FROM native_json n JOIN pg_roles r ON r.rolname=n.privileged_role),
   'postgresStorageObjectsPolicyGrant',(SELECT CASE WHEN jsonb_typeof(policy_json->'postgres')='array' THEN (policy_json->'postgres')?'storage.objects' END FROM native_json)
 ),
 'actors',(SELECT jsonb_agg(jsonb_build_object('actor',a.name,'exists',r.oid IS NOT NULL,'superuser',r.rolsuper,'login',r.rolcanlogin,'bypassRLS',r.rolbypassrls,'inherit',r.rolinherit) ORDER BY a.name) FROM actors a LEFT JOIN pg_roles r ON r.rolname=a.name),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('schema',s.name,'actor',a.name,'exists',n.oid IS NOT NULL,'owner',CASE WHEN pg_get_userbyid(n.nspowner) IN ('postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin','pg_database_owner') THEN pg_get_userbyid(n.nspowner) ELSE 'UNLISTED' END,
   'ownerUsage',CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN pg_has_role(r.oid,n.nspowner,'USAGE') END,
   'usage',CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN has_schema_privilege(r.oid,n.oid,'USAGE') END,
   'create',CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN has_schema_privilege(r.oid,n.oid,'CREATE') END,
   'usageGrantOption',CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION') END)
   ORDER BY s.name,a.name) FROM schemas s CROSS JOIN actors a LEFT JOIN pg_namespace n ON n.nspname=s.name LEFT JOIN pg_roles r ON r.rolname=a.name),
 'objects',(SELECT jsonb_agg(jsonb_build_object('schema',o.schema_name,'object',o.object_name,'actor',a.name,'exists',c.oid IS NOT NULL,
   'ownerUsage',CASE WHEN r.oid IS NOT NULL AND c.oid IS NOT NULL THEN pg_has_role(r.oid,c.relowner,'USAGE') END,
   'select',CASE WHEN r.oid IS NOT NULL AND c.oid IS NOT NULL THEN has_table_privilege(r.oid,c.oid,'SELECT') END,
   'trigger',CASE WHEN r.oid IS NOT NULL AND c.oid IS NOT NULL THEN has_table_privilege(r.oid,c.oid,'TRIGGER') END,
   'shareRowExclusivePrivilege',CASE WHEN r.oid IS NOT NULL AND c.oid IS NOT NULL THEN has_table_privilege(r.oid,c.oid,'MAINTAIN,UPDATE,DELETE,TRUNCATE') END,
   'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity)
   ORDER BY o.schema_name,o.object_name,a.name) FROM objects o CROSS JOIN actors a LEFT JOIN pg_namespace n ON n.nspname=o.schema_name LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=o.object_name LEFT JOIN pg_roles r ON r.rolname=a.name),
 'routines',(SELECT jsonb_agg(jsonb_build_object('schema',q.schema_name,'routine',q.routine_name,'inputTypes',q.input_types::text,'actor',a.name,
   'exists',p.oid IS NOT NULL,'ownerUsage',CASE WHEN r.oid IS NOT NULL AND p.oid IS NOT NULL THEN pg_has_role(r.oid,p.proowner,'USAGE') END,
   'execute',CASE WHEN r.oid IS NOT NULL AND p.oid IS NOT NULL THEN has_function_privilege(r.oid,p.oid,'EXECUTE') END,
   'securityDefiner',p.prosecdef,'returnTypeOID',p.prorettype::text)
   ORDER BY q.schema_name,q.routine_name,a.name) FROM routines q CROSS JOIN actors a LEFT JOIN pg_namespace n ON n.nspname=q.schema_name LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=q.routine_name AND p.prokind='f' AND p.proargtypes=q.input_types LEFT JOIN pg_roles r ON r.rolname=a.name),
 'creatorDefaultACL',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',coalesce(n.nspname,'GLOBAL'),'objectType',d.defaclobjtype,
   'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' WHEN g.rolname IN (SELECT name FROM actors) THEN g.rolname ELSE 'UNLISTED' END,
   'grantor',CASE WHEN pg_get_userbyid(x.grantor) IN ('postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin','pg_database_owner') THEN pg_get_userbyid(x.grantor) ELSE 'UNLISTED' END,'privilege',x.privilege_type,'grantable',x.is_grantable)
   ORDER BY d.defaclnamespace,d.defaclobjtype,x.grantee,x.privilege_type),'[]'::jsonb)
   FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) x LEFT JOIN pg_roles g ON g.oid=x.grantee
   WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND (d.defaclnamespace=0 OR n.nspname IN ('public','logs','security_internal'))),
 'applicationCatalogObjectCounts',(SELECT jsonb_build_object('relations',count(*)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal'))
 ) ELSE '{}'::jsonb END
)::text;
ROLLBACK;
