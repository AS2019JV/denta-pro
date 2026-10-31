'use strict';
// Offline SQL/document assembly only. No connection, credential, Docker or network code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const OUT = __dirname;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const vals = rows => rows.map(r => '(' + r.map(q).join(',') + ')').join(',\n');
const namespaces = ['public','logs','security_internal','auth','storage'];
const roles = ['postgres','supabase_storage_admin','supabase_auth_admin','anon','authenticated','service_role','authenticator'];
const schemas = [...namespaces,'extensions'];
const locks = [['auth','users'],['auth','identities'],['auth','sessions'],['auth','refresh_tokens'],['auth','mfa_factors'],['auth','mfa_challenges'],['auth','mfa_amr_claims'],['auth','audit_log_entries'],['storage','buckets'],['storage','objects']];
const required = [['public','get_patient_demographics','2950 25 23 23 2950'],['public','save_patient_demographics','2950 3802 2950'],['public','get_clinic_schedule','2950 1184 1184'],['public','get_clinic_staff_directory','2950'],['public','save_clinic_appointment','2950 3802 2950'],['public','redeem_verified_clinic_invitation','25']];
const deps = [['auth','role',''],['auth','uid',''],['storage','foldername','25']];
const unqualified = [['table','profiles',''],['table','patients',''],['table','billings',''],['function','is_clinic_member','2950'],['function','get_clinic_member_role','2950'],['function','check_subscription_active','2950']];
const limits = { outputBytes: 1048576, tables: 192, columns: 4096, functions: 512, policies: 512, constraints: 2048, triggers: 1024, indexes: 2048, defaultEntries: 2048, dependencyEdges: 8192, resolutionCandidates: 16 };
const tablePrivileges = ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN','SELECT WITH GRANT OPTION','INSERT WITH GRANT OPTION','UPDATE WITH GRANT OPTION','DELETE WITH GRANT OPTION','TRIGGER WITH GRANT OPTION'];
const flags = (fn, object, privileges) => `(SELECT string_agg(CASE WHEN r.oid IS NULL THEN 'N' WHEN ${fn}(r.oid,${object},vp.priv) IS TRUE THEN 'T' WHEN ${fn}(r.oid,${object},vp.priv) IS FALSE THEN 'F' ELSE 'N' END,'' ORDER BY vp.ord) FROM (VALUES ${privileges.map((v,i)=>`(${i+1},${q(v)})`).join(',')}) vp(ord,priv))`;
const acl = expr => `(SELECT coalesce(jsonb_agg(jsonb_build_array(a.grantor::text,a.grantee::text,a.privilege_type,a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type),'[]'::jsonb) FROM aclexplode(coalesce(${expr},'{}'::aclitem[])) a)`;
const md5 = expr => `md5(replace(${expr},E'\\r\\n',E'\\n'))`;
const nsp = `n.nspname IN (${namespaces.map(q).join(',')})`;

function assemble() {
const sql = `-- PROPOSED ONLY. No execution or credential use is authorized by this file.
-- Exact original hosted target; this is NOT the a9 local profile.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SET LOCAL idle_in_transaction_session_timeout='15s';
DO $identity$
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR current_database()<>'postgres'
    OR current_setting('server_version_num')<>'170011'
    OR current_setting('transaction_read_only')<>'on'
    OR current_setting('default_transaction_read_only')<>'on'
    OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) IS DISTINCT FROM false
    OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '7692130048193495360'
 THEN RAISE EXCEPTION 'CLINIA_HOSTED_IDENTITY_REFUSED'; END IF;
 -- Original managed prerequisites only. New application RPCs may be MISSING.
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='storage' AND c.relname='objects' AND r.rolname='supabase_storage_admin')
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='auth' AND c.relname='users' AND r.rolname='supabase_auth_admin')
 OR to_regclass('auth.schema_migrations') IS NULL OR to_regclass('storage.migrations') IS NULL
 THEN RAISE EXCEPTION 'CLINIA_HOSTED_MANAGED_PREREQUISITE_REFUSED'; END IF;
END; $identity$;
WITH role_targets(name) AS (VALUES ${vals(roles.map(x=>[x]))}),
 schema_targets(name) AS (VALUES ${vals(schemas.map(x=>[x]))}),
 lock_targets(schema_name,name) AS (VALUES ${vals(locks)}),
 required_rpcs(schema_name,name,args) AS (VALUES ${vals(required)}),
 dependency_targets(schema_name,name,args) AS (VALUES ${vals(deps)}),
 unqualified_targets(kind,name,args) AS (VALUES ${vals(unqualified)}),
 creators(name) AS (VALUES ('postgres'),('supabase_auth_admin'),('supabase_storage_admin')),
 default_contexts(name) AS (VALUES ('GLOBAL'),${schemas.map(x=>'('+q(x)+')').join(',')}),
 default_kinds(kind) AS (VALUES ('r'),('S'),('f'),('T'),('n')),
 native_settings AS (
  SELECT (SELECT setting FROM pg_settings WHERE name='supautils.version' AND context='internal') v,
   current_setting('supautils.policy_grants',true) grants,
   current_setting('supautils.privileged_role',true) privileged_role
 ), native AS (
  SELECT *,CASE WHEN pg_input_is_valid(grants,'jsonb') THEN grants::jsonb END j FROM native_settings
 ), observed_objects(classid,objid) AS (
  SELECT 'pg_namespace'::regclass::oid,n.oid FROM pg_namespace n WHERE n.nspname IN (${schemas.map(q).join(',')})
  UNION SELECT 'pg_class'::regclass::oid,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}
  UNION SELECT 'pg_proc'::regclass::oid,p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${nsp} AND p.prokind IN ('f','p')
  UNION SELECT 'pg_type'::regclass::oid,t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${nsp}
  UNION SELECT 'pg_constraint'::regclass::oid,x.oid FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}
  UNION SELECT 'pg_trigger'::regclass::oid,t.oid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND NOT t.tgisinternal
  UNION SELECT 'pg_policy'::regclass::oid,p.oid FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}
  UNION SELECT 'pg_rewrite'::regclass::oid,w.oid FROM pg_rewrite w JOIN pg_class c ON c.oid=w.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}
  UNION SELECT 'pg_attrdef'::regclass::oid,a.oid FROM pg_attrdef a JOIN pg_class c ON c.oid=a.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}
  UNION SELECT 'pg_default_acl'::regclass::oid,d.oid FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN (${schemas.map(q).join(',')})
 ), dependency_edges AS (
  SELECT d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype FROM pg_depend d
  WHERE EXISTS(SELECT 1 FROM observed_objects o WHERE o.classid=d.classid AND o.objid=d.objid)
     OR EXISTS(SELECT 1 FROM observed_objects o WHERE o.classid=d.refclassid AND o.objid=d.refobjid)
 ), counts AS (
  SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND c.relkind IN ('r','p','v','m','S','f')) tables,
   (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped) columns,
   (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${nsp} AND p.prokind IN ('f','p')) functions,
   (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}) policies,
   (SELECT count(*) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}) constraints,
   (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND NOT t.tgisinternal) triggers,
   (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}) indexes,
   (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN (${schemas.map(q).join(',')})) default_entries,
   (SELECT count(*) FROM dependency_edges) dependency_edges
 ), admission AS (
  SELECT *,tables<=${limits.tables} AND columns<=${limits.columns} AND functions<=${limits.functions}
   AND policies<=${limits.policies} AND constraints<=${limits.constraints} AND triggers<=${limits.triggers}
   AND indexes<=${limits.indexes} AND default_entries<=${limits.defaultEntries}
   AND dependency_edges<=${limits.dependencyEdges} AS accepted FROM counts
 ), payload AS (
 SELECT jsonb_build_object(
  'protocol','CLINIA_HOSTED_OBSERVATION_V1','state','CAPTURED_CURRENT_ONLY',
  'identity',jsonb_build_object('project','fbtlldubzomocuhpvweg','database',current_database(),'currentUser',current_user,'sessionUser',session_user,'version',current_setting('server_version_num'),'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),'superuser',false,'readOnly',current_setting('transaction_read_only'),'defaultReadOnly',current_setting('default_transaction_read_only')),
  'limits',jsonb_build_object('byteLimit',${limits.outputBytes},'counts',(SELECT to_jsonb(a) FROM admission a)),
  'catalog',CASE WHEN (SELECT accepted FROM admission) THEN jsonb_build_object(
   'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',n.nspname,'oid',n.oid::text,'ownerOID',n.nspowner::text,'aclNull',n.nspacl IS NULL,'acl',${acl('n.nspacl')}) ORDER BY n.nspname),'[]') FROM pg_namespace n WHERE n.nspname IN (${schemas.map(q).join(',')})),
   'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'oid',c.oid::text,'kind',c.relkind,'ownerOID',c.relowner::text,'aclNull',c.relacl IS NULL,'acl',${acl('c.relacl')},'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'viewMd5',CASE WHEN c.relkind IN ('v','m') THEN ${md5('pg_get_viewdef(c.oid,true)')} END,'optionsMd5',md5(coalesce(array_to_string(c.reloptions,E'\\n'),''))) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND c.relkind IN ('r','p','v','m','S','f')),
   'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('tableOID',c.oid::text,'name',a.attname,'position',a.attnum,'typeOID',a.atttypid::text,'typeMod',a.atttypmod,'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'aclNull',a.attacl IS NULL,'acl',${acl('a.attacl')},'defaultMd5',${md5('pg_get_expr(d.adbin,d.adrelid)')},'effective', (SELECT jsonb_agg(jsonb_build_array(rt.name,${flags('has_column_privilege','c.oid,a.attnum',['SELECT','INSERT','UPDATE','REFERENCES'])}) ORDER BY rt.name) FROM role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name)) ORDER BY n.nspname,c.relname,a.attnum),'[]') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE ${nsp} AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped),
   'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'oid',p.oid::text,'kind',p.prokind,'inputTypes',p.proargtypes::text,'returnTypeOID',p.prorettype::text,'returnsSet',p.proretset,'defaults',p.pronargdefaults,'variadicOID',p.provariadic::text,'ownerOID',p.proowner::text,'languageOID',p.prolang::text,'definer',p.prosecdef,'aclNull',p.proacl IS NULL,'acl',${acl('p.proacl')},'definitionMd5',${md5('pg_get_functiondef(p.oid)')},'bodyMd5',${md5('p.prosrc')},'searchPath',(SELECT jsonb_agg(CASE trim(both '"' FROM trim(token)) WHEN 'pg_catalog' THEN 'pg_catalog' WHEN 'public' THEN 'public' WHEN 'auth' THEN 'auth' WHEN 'storage' THEN 'storage' WHEN 'extensions' THEN 'extensions' WHEN '$user' THEN '$user' WHEN 'pg_temp' THEN 'pg_temp' ELSE '#'||md5(token) END ORDER BY ord) FROM unnest(p.proconfig) cfg CROSS JOIN LATERAL unnest(string_to_array(substring(cfg FROM 13),',')) WITH ORDINALITY t(token,ord) WHERE cfg LIKE 'search_path=%'),'otherConfigMd5',(SELECT jsonb_agg(md5(cfg) ORDER BY ord) FROM unnest(p.proconfig) WITH ORDINALITY t(cfg,ord) WHERE cfg NOT LIKE 'search_path=%')) ORDER BY n.nspname,p.proname,p.proargtypes),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${nsp} AND p.prokind IN ('f','p')),
   'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_array(x.oid::text,x.conrelid::text,x.conname,x.contype,x.convalidated,x.condeferrable,x.condeferred,x.confrelid::text,x.confupdtype,x.confdeltype,${md5('pg_get_constraintdef(x.oid,true)')}) ORDER BY n.nspname,c.relname,x.conname),'[]') FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}),
   'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_array(i.indexrelid::text,i.indrelid::text,ic.relname,i.indisvalid,i.indisready,${md5('pg_get_indexdef(i.indexrelid)')}) ORDER BY n.nspname,c.relname,ic.relname),'[]') FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}),
   'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_array(t.oid::text,t.tgrelid::text,t.tgname,t.tgfoid::text,t.tgenabled,${md5('pg_get_triggerdef(t.oid,true)')}) ORDER BY n.nspname,c.relname,t.tgname),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} AND NOT t.tgisinternal),
   'policies',(SELECT coalesce(jsonb_agg(jsonb_build_array(p.oid::text,p.polrelid::text,p.polname,p.polcmd,p.polpermissive,p.polroles::text,${md5('pg_get_expr(p.polqual,p.polrelid)')},${md5('pg_get_expr(p.polwithcheck,p.polrelid)')}) ORDER BY n.nspname,c.relname,p.polname),'[]') FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}),
   'defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('creatorOID',d.defaclrole::text,'schemaOID',d.defaclnamespace::text,'kind',d.defaclobjtype,'acl',${acl('d.defaclacl')}) ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]') FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN (${schemas.map(q).join(',')})),
   'types',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'oid',t.oid::text,'ownerOID',t.typowner::text,'kind',t.typtype,'baseTypeOID',t.typbasetype::text,'notNull',t.typnotnull,'defaultMd5',md5(t.typdefault),'aclNull',t.typacl IS NULL,'acl',${acl('t.typacl')},'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)) ORDER BY n.nspname,t.typname),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${nsp} AND t.typtype IN ('e','d')),
   'sequences',(SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid::text,s.seqtypid::text,s.seqstart::text,s.seqincrement::text,s.seqmin::text,s.seqmax::text,s.seqcache::text,s.seqcycle) ORDER BY n.nspname,c.relname),'[]') FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp}),
   'dependencyEdges',(SELECT coalesce(jsonb_agg(jsonb_build_array(d.classid::text,d.objid::text,d.objsubid,d.refclassid::text,d.refobjid::text,d.refobjsubid,d.deptype) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') FROM dependency_edges d)
  ) ELSE NULL END,
  'authority',CASE WHEN (SELECT accepted FROM admission) THEN jsonb_build_object(
   'roles',(SELECT jsonb_agg(jsonb_build_array(t.name,r.oid::text,r.rolsuper,r.rolcanlogin,r.rolinherit,r.rolbypassrls) ORDER BY t.name) FROM role_targets t LEFT JOIN pg_roles r ON r.rolname=t.name),
   'ownerRoles',(SELECT coalesce(jsonb_agg(jsonb_build_array(r.oid::text,CASE WHEN r.rolname IN ('postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin','pg_database_owner','anon','authenticated','service_role','authenticator') THEN r.rolname ELSE '#'||md5(r.rolname) END) ORDER BY r.oid),'[]') FROM pg_roles r WHERE r.oid IN (SELECT n.nspowner FROM pg_namespace n WHERE n.nspname IN (${schemas.map(q).join(',')}) UNION SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${nsp} UNION SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${nsp} UNION SELECT t.typowner FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${nsp} AND t.typtype IN ('e','d'))),
   'database',(SELECT jsonb_agg(jsonb_build_array(t.name,${flags('has_database_privilege','current_database()',['CONNECT','CREATE','TEMPORARY'])}) ORDER BY t.name) FROM role_targets t LEFT JOIN pg_roles r ON r.rolname=t.name),
   'memberships',(SELECT jsonb_agg(jsonb_build_array(a.name,b.name,CASE WHEN r.oid IS NOT NULL AND s.oid IS NOT NULL THEN pg_has_role(r.oid,s.oid,'MEMBER') END,CASE WHEN r.oid IS NOT NULL AND s.oid IS NOT NULL THEN pg_has_role(r.oid,s.oid,'USAGE') END,CASE WHEN r.oid IS NOT NULL AND s.oid IS NOT NULL THEN pg_has_role(r.oid,s.oid,'SET') END) ORDER BY a.name,b.name) FROM role_targets a CROSS JOIN role_targets b LEFT JOIN pg_roles r ON r.rolname=a.name LEFT JOIN pg_roles s ON s.rolname=b.name),
   'schemas',(SELECT jsonb_agg(jsonb_build_array(st.name,rt.name,n.oid IS NOT NULL,CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN ${flags('has_schema_privilege','n.oid',['USAGE','CREATE','USAGE WITH GRANT OPTION','CREATE WITH GRANT OPTION'])} END,CASE WHEN r.oid IS NOT NULL AND n.oid IS NOT NULL THEN pg_has_role(r.oid,n.nspowner,'USAGE') END) ORDER BY st.name,rt.name) FROM schema_targets st CROSS JOIN role_targets rt LEFT JOIN pg_namespace n ON n.nspname=st.name LEFT JOIN pg_roles r ON r.rolname=rt.name),
   'tables',(SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid::text,rt.name,${flags('has_table_privilege','c.oid',tablePrivileges)},CASE WHEN r.oid IS NOT NULL THEN pg_has_role(r.oid,c.relowner,'USAGE') END) ORDER BY c.oid,rt.name),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name WHERE ${nsp} AND c.relkind IN ('r','p','v','m','f')),
   'functions',(SELECT coalesce(jsonb_agg(jsonb_build_array(p.oid::text,rt.name,${flags('has_function_privilege','p.oid',['EXECUTE','EXECUTE WITH GRANT OPTION'])},CASE WHEN r.oid IS NOT NULL THEN pg_has_role(r.oid,p.proowner,'USAGE') END) ORDER BY p.oid,rt.name),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name WHERE ${nsp} AND p.prokind IN ('f','p')),
   'locks',(SELECT jsonb_agg(jsonb_build_array(t.schema_name,t.name,rt.name,c.oid IS NOT NULL,CASE WHEN r.oid IS NOT NULL AND c.oid IS NOT NULL THEN has_table_privilege(r.oid,c.oid,'MAINTAIN,UPDATE,DELETE,TRUNCATE') END) ORDER BY t.schema_name,t.name,rt.name) FROM lock_targets t CROSS JOIN role_targets rt LEFT JOIN pg_namespace n ON n.nspname=t.schema_name LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.name LEFT JOIN pg_roles r ON r.rolname=rt.name),
   'sequences',(SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid::text,rt.name,${flags('has_sequence_privilege','c.oid',['USAGE','SELECT','UPDATE','USAGE WITH GRANT OPTION','SELECT WITH GRANT OPTION','UPDATE WITH GRANT OPTION'])}) ORDER BY c.oid,rt.name),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name WHERE ${nsp} AND c.relkind='S'),
   'languages',(SELECT jsonb_agg(jsonb_build_array(lt.name,rt.name,l.oid IS NOT NULL,l.lanpltrusted,${flags('has_language_privilege','l.oid',['USAGE'])}) ORDER BY lt.name,rt.name) FROM (VALUES ('sql'),('plpgsql')) lt(name) CROSS JOIN role_targets rt LEFT JOIN pg_language l ON l.lanname=lt.name LEFT JOIN pg_roles r ON r.rolname=rt.name),
   'types',(SELECT coalesce(jsonb_agg(jsonb_build_array(t.oid::text,rt.name,${flags('has_type_privilege','t.oid',['USAGE','USAGE WITH GRANT OPTION'])}) ORDER BY t.oid,rt.name),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace CROSS JOIN role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name WHERE (${nsp} AND t.typtype IN ('e','d')) OR (n.nspname='pg_catalog' AND t.typname IN ('uuid','text','jsonb','int4','bool','trigger','timestamptz'))),
   'implicitDefaults',(SELECT jsonb_agg(jsonb_build_object('creator',cr.name,'schema',dc.name,'kind',dk.kind,'globalExplicit',g.oid IS NOT NULL,'schemaExplicit',l.oid IS NOT NULL,'combinedACL',${acl("coalesce(g.defaclacl,acldefault((CASE dk.kind WHEN 'S' THEN 's' ELSE dk.kind END)::\"char\",r.oid))||coalesce(l.defaclacl,'{}'::aclitem[])")}) ORDER BY cr.name,dc.name,dk.kind) FROM creators cr CROSS JOIN default_contexts dc CROSS JOIN default_kinds dk LEFT JOIN pg_roles r ON r.rolname=cr.name LEFT JOIN pg_namespace n ON n.nspname=dc.name LEFT JOIN pg_default_acl g ON g.defaclrole=r.oid AND g.defaclnamespace=0 AND g.defaclobjtype=dk.kind::"char" LEFT JOIN pg_default_acl l ON dc.name<>'GLOBAL' AND l.defaclrole=r.oid AND l.defaclnamespace=n.oid AND l.defaclobjtype=dk.kind::"char"),
   'native',(SELECT jsonb_build_object('versionRegisteredInternal',v IS NOT NULL,'version',CASE WHEN length(v)<=32 AND v~'^v?[0-9]+(\\.[0-9]+){0,3}(-[a-z0-9.-]+)?$' THEN v END,'sharedPreloadNamesSupautils',coalesce(current_setting('shared_preload_libraries',true)~'(^|,)[[:space:]]*(\\$libdir/)?supautils[[:space:]]*(,|$)',false),'sessionPreloadNamesSupautils',coalesce(current_setting('session_preload_libraries',true)~'(^|,)[[:space:]]*(\\$libdir/)?supautils[[:space:]]*(,|$)',false),'postgresPolicyGrantStorageObjects',CASE WHEN jsonb_typeof(j->'postgres')='array' THEN (j->'postgres')?'storage.objects' END,'policyConfigValidJSON',CASE WHEN grants IS NULL THEN NULL ELSE pg_input_is_valid(grants,'jsonb') END,'privilegedRoleLabel',CASE privileged_role WHEN 'postgres' THEN 'POSTGRES' WHEN 'supabase_privileged_role' THEN 'SUPABASE_PRIVILEGED_ROLE' WHEN '' THEN 'EMPTY' ELSE CASE WHEN privileged_role IS NULL THEN 'MISSING' ELSE 'UNLISTED' END END,'policyDDLQualified',false) FROM native)
  ) ELSE NULL END,
  'dependencies',(SELECT jsonb_agg(jsonb_build_object('schema',d.schema_name,'name',d.name,'inputTypes',d.args,'schemaExists',n.oid IS NOT NULL,'signatureExists',p.oid IS NOT NULL,'functionOID',p.oid::text,'returnTypeOID',p.prorettype::text,'variadicOID',p.provariadic::text,'defaults',p.pronargdefaults,'actors',(SELECT jsonb_agg(jsonb_build_array(rt.name,CASE WHEN n.oid IS NOT NULL AND r.oid IS NOT NULL THEN has_schema_privilege(r.oid,n.oid,'USAGE') END,CASE WHEN p.oid IS NOT NULL AND r.oid IS NOT NULL THEN has_function_privilege(r.oid,p.oid,'EXECUTE') END) ORDER BY rt.name) FROM role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name)) ORDER BY d.schema_name,d.name) FROM dependency_targets d LEFT JOIN pg_namespace n ON n.nspname=d.schema_name LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=d.name AND p.proargtypes=d.args::oidvector AND p.prokind='f'),
  'requiredRPCs',(SELECT jsonb_agg(jsonb_build_object('schema',q.schema_name,'name',q.name,'inputTypes',q.args,'oid',p.oid::text,'state',CASE WHEN p.oid IS NULL THEN 'MISSING' ELSE 'PRESENT_NOT_RUNTIME_TESTED' END) ORDER BY q.name) FROM required_rpcs q LEFT JOIN pg_namespace n ON n.nspname=q.schema_name LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=q.name AND p.proargtypes=q.args::oidvector AND p.prokind='f'),
  'resolution',(SELECT jsonb_agg(jsonb_build_object('kind',q.kind,'name',q.name,'expectedArgs',q.args,'actor',rt.name,'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.rank,x.oid),'[]') FROM (SELECT st.rank,n.oid::text AS schema_oid,c.oid::text AS oid,NULL::text AS args,NULL::integer AS defaults,NULL::text AS variadic FROM (VALUES (1,'pg_catalog'),(2,'public'),(3,'extensions')) st(rank,name) JOIN pg_namespace n ON n.nspname=st.name JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.name WHERE q.kind='table' AND r.oid IS NOT NULL AND has_schema_privilege(r.oid,n.oid,'USAGE') UNION ALL SELECT st.rank,n.oid::text,p.oid::text,p.proargtypes::text,p.pronargdefaults,p.provariadic::text FROM (VALUES (1,'pg_catalog'),(2,'public'),(3,'extensions')) st(rank,name) JOIN pg_namespace n ON n.nspname=st.name JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=q.name AND p.prokind='f' WHERE q.kind='function' AND r.oid IS NOT NULL AND has_schema_privilege(r.oid,n.oid,'USAGE') ORDER BY rank,oid LIMIT ${limits.resolutionCandidates+1}) x),'postP','EXPECTED_AFTER_P_NOT_VERIFIED') ORDER BY q.kind,q.name,rt.name) FROM unqualified_targets q CROSS JOIN role_targets rt LEFT JOIN pg_roles r ON r.rolname=rt.name),
  'ledgers',jsonb_build_object('authHistoryCount',(SELECT count(*) FROM auth.schema_migrations),'storageHistoryCount',(SELECT count(*) FROM storage.migrations),'applicationLedgerPresent',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'applicationLedgerRows','NOT_READ','historyBodies','NOT_READ','historyCountsAreServiceVersions',false),
  'cohort',jsonb_build_object('state','DEFERRED_SEPARATE_ROW_WHITELIST_AND_APPROVAL','applicationRowsRead',false,'authMFASessionRowsHashed',false,'invitationsQueried',false,'dataConservation','NOT_VERIFIED'),
  'postP','NOT_VERIFIED','migrationReady',false,'applicationRuntime','NOT_VERIFIED','managedConfiguration','SEPARATE_AUTHORIZED_READ_REQUIRED'
 ) AS doc
 ), encoded AS (SELECT doc,octet_length('CLINIA_HOSTED_OBSERVATION_V1:'||doc::text||E'\\n') bytes FROM payload)
SELECT CASE WHEN (SELECT accepted FROM admission) IS NOT TRUE THEN 'CLINIA_HOSTED_OBSERVATION_V1:'||jsonb_build_object('protocol','CLINIA_HOSTED_OBSERVATION_V1','state','REFUSED_CARDINALITY_LIMIT','metadataReturned',false)::text
 WHEN bytes>${limits.outputBytes} THEN 'CLINIA_HOSTED_OBSERVATION_V1:'||jsonb_build_object('protocol','CLINIA_HOSTED_OBSERVATION_V1','state','REFUSED_OUTPUT_LIMIT','metadataReturned',false)::text
 ELSE 'CLINIA_HOSTED_OBSERVATION_V1:'||doc::text END FROM encoded;
ROLLBACK;
`;
return { sql, contract: { schemaVersion:1, state:'OFFLINE_PROPOSAL_NOT_AUTHORIZED', product:{MVP:'5a81247cb857a5c9ff4df2601c68241450813758',tree:'18cea82a8352fee737880d1a2725accba5e5fd92',baselineRC5:'ba47f5273fef85fca1cf92784c8ff8c7b50faf54',ownMVPPreview:null,ownMVPVerifiedCI:null}, target:{project:'fbtlldubzomocuhpvweg',name:'clinia-test',database:'postgres',actor:'postgres',superuser:false,version:'170011',systemIdentifier:'7692130048193495360',tlsHost:'db.fbtlldubzomocuhpvweg.supabase.co',tlsMode:'verify-full'}, roles, namespaces, schemas, locks, requiredRPCs:required, dependencies:deps, unqualified, limits, flags:{alphabet:['T','F','N'],table:tablePrivileges,column:['SELECT','INSERT','UPDATE','REFERENCES'],schema:['USAGE','CREATE','USAGE WITH GRANT OPTION','CREATE WITH GRANT OPTION'],function:['EXECUTE','EXECUTE WITH GRANT OPTION'],database:['CONNECT','CREATE','TEMPORARY'],sequence:['USAGE','SELECT','UPDATE','USAGE WITH GRANT OPTION','SELECT WITH GRANT OPTION','UPDATE WITH GRANT OPTION']}, normalization:'Only CRLF to LF inside definition/body/expression fingerprints; ACL OID entries sorted without removing entries. No current/full-parity or function-semantic acceptance.', output:'One complete prefixed JSON line or fixed refusal; no truncation. Identity DO executes before payload statements. Snapshot REPEATABLE READ READ ONLY.', serverTimeouts:{statementMs:15000,lockMs:2000,idleTransactionMs:15000}, SQLRuntime:'NOT_PARSED_OR_EXECUTED_BY_POSTGRES', futureTransport:{executorAdded:false,sourceSHA:null,CI:null,approval:null,turn:null,stdinOrReviewedExistingHostedFileTransportRequired:true,neverReuseA9IdentityOrCredential:true}, historicalReference:{directory:'.temp/gate3-hosted-access',specificEncryptedFile:'.temp/gate3-hosted-access/access.dpapi.json',specificField:'DatabasePassword',source:'docs/production/evidence/2026-10-21-gate3-access-resume-2/import-gate3-password-file.ps1',credentialContentsRead:false,currentExistenceCustodyAuthorization:'PENDING_FRESH_METADATA_ATTESTATION',currentCredentialValidity:'NOT_VERIFIED',a9ReferenceNotApplicable:true}, cohort:{rowHashesDeferred:true,reason:'No new row whitelist or access to Auth/MFA/session/invitation rows is authorized by this metadata proposal.'}, entitlement:{futureOnly:true,status:'active',bypassSubscription:false,trialEndsAt:null,archivedAt:null,profileStatus:'active',membershipStatus:'active',noSevenDayCommercialExpiry:true,invitationTTLIsSeparate:true,sourceFunction:'public.check_subscription_active(uuid)',guards:'Membership and archived-clinic guard must match approved successor contract; metadata hashes do not execute the function.'}, noReadinessInheritance:['RC5 CI526','offline03 CI9','dependency02 CI68','p8 recovery'], nativeOperations:0 } };
}
module.exports = { assemble };
if (require.main === module) {
 const a = assemble();
 a.contract.SQLSHA256 = hash(a.sql);
 fs.writeFileSync(path.join(OUT,'observe.proposed.sql'),a.sql);
 fs.writeFileSync(path.join(OUT,'contract.json'),JSON.stringify(a.contract,null,2)+'\n');
 console.log(JSON.stringify({SQLSHA256:a.contract.SQLSHA256,SQLBytes:Buffer.byteLength(a.sql),nativeOperations:0,credentialReads:0}));
}
