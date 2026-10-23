'use strict';
const candidateRoot=require('path').resolve(__dirname,'../../../..');
module.exports=`CREATE TEMP TABLE gate3_rows(schema_name text,table_name text,row_count bigint,sha256 text);
DO $s$ DECLARE r record; n bigint; h text; BEGIN
 FOR r IN SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal','auth','storage','supabase_migrations') AND c.relkind IN ('r','p','S') AND NOT c.relispartition ORDER BY 1,2 LOOP
 IF r.relkind='S' THEN
 EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(h,''|'' ORDER BY h),''''),''sha256''),''hex'') FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') h FROM (SELECT last_value,log_cnt,is_called FROM %I.%I) t) hashes',r.nspname,r.relname) INTO n,h;
 ELSE
 EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(h,''|'' ORDER BY h),''''),''sha256''),''hex'') FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') h FROM %I.%I t) hashes',r.nspname,r.relname) INTO n,h;
 END IF;
 INSERT INTO gate3_rows VALUES(r.nspname,r.relname,n,h); END LOOP;
END $s$;
SELECT jsonb_build_object('rowsAndSequenceValues',(SELECT jsonb_agg(to_jsonb(r) ORDER BY schema_name,table_name) FROM gate3_rows r),'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'createDb',rolcreatedb,'createRole',rolcreaterole,'login',rolcanlogin,'bypassRls',rolbypassrls,'inherit',rolinherit,'replication',rolreplication) ORDER BY rolname) FROM pg_roles),'memberships',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',u.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,u.rolname) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles u ON u.oid=a.member));`;
