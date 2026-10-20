BEGIN; SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions; SELECT pg_advisory_xact_lock(731926,1711); DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT system_identifier::text FROM pg_control_system())<>'7692130048193495360' THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_IDENTITY_REFUSED'; END IF; END $identity$;
-- Migration window only. Known synthetic project; no application/provider ledger writes.
-- Block competing Auth/Storage data writers while the planned DDL transaction runs.
-- Exact ordinary Auth/Storage writer surface. Provider vector/analytics internals
-- and managed ledgers are excluded; no new privileges are requested.
LOCK TABLE auth.users,auth.identities,auth.sessions,auth.refresh_tokens,
 auth.mfa_factors,auth.mfa_challenges,auth.mfa_amr_claims,auth.audit_log_entries,
 storage.buckets,storage.objects IN SHARE ROW EXCLUSIVE MODE;

LOCK TABLE "logs"."access_audit","public"."appointments","public"."automation_settings","public"."billings","public"."clinic_invitations","public"."clinic_members","public"."clinical_records","public"."clinics","public"."data_rights_requests","public"."hcu033_forms","public"."invoices","public"."messages","public"."notifications","public"."patient_files","public"."patient_notes","public"."patients","public"."payment_methods","public"."payments","public"."prescription_templates","public"."prescriptions","public"."profile_audit_log","public"."profiles","public"."service_categories","public"."services","public"."treatments" IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE gate3_expected_data(proof jsonb NOT NULL) ON COMMIT DROP; INSERT INTO gate3_expected_data VALUES (:'gate3_data_proof'::jsonb);
DO $cohort$ DECLARE actual jsonb; BEGIN SELECT result INTO actual FROM (SELECT jsonb_object_agg(name,value ORDER BY name) FROM (SELECT 'logs.access_audit' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "logs"."access_audit" t) r UNION ALL SELECT 'public.appointments' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."appointments" t) r UNION ALL SELECT 'public.automation_settings' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."automation_settings" t) r UNION ALL SELECT 'public.billings' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."billings" t) r UNION ALL SELECT 'public.clinic_invitations' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."clinic_invitations" t) r UNION ALL SELECT 'public.clinic_members' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."clinic_members" t) r UNION ALL SELECT 'public.clinical_records' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."clinical_records" t) r UNION ALL SELECT 'public.clinics' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."clinics" t) r UNION ALL SELECT 'public.data_rights_requests' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."data_rights_requests" t) r UNION ALL SELECT 'public.hcu033_forms' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."hcu033_forms" t) r UNION ALL SELECT 'public.invoices' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."invoices" t) r UNION ALL SELECT 'public.messages' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."messages" t) r UNION ALL SELECT 'public.notifications' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."notifications" t) r UNION ALL SELECT 'public.patient_files' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."patient_files" t) r UNION ALL SELECT 'public.patient_notes' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."patient_notes" t) r UNION ALL SELECT 'public.patients' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."patients" t) r UNION ALL SELECT 'public.payment_methods' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."payment_methods" t) r UNION ALL SELECT 'public.payments' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."payments" t) r UNION ALL SELECT 'public.prescription_templates' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."prescription_templates" t) r UNION ALL SELECT 'public.prescriptions' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."prescriptions" t) r UNION ALL SELECT 'public.profile_audit_log' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."profile_audit_log" t) r UNION ALL SELECT 'public.profiles' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."profiles" t) r UNION ALL SELECT 'public.service_categories' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."service_categories" t) r UNION ALL SELECT 'public.services' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."services" t) r UNION ALL SELECT 'public.treatments' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "public"."treatments" t) r UNION ALL SELECT 'auth.users' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."users" t) r UNION ALL SELECT 'auth.identities' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."identities" t) r UNION ALL SELECT 'auth.sessions' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."sessions" t) r UNION ALL SELECT 'auth.refresh_tokens' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."refresh_tokens" t) r UNION ALL SELECT 'auth.mfa_factors' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."mfa_factors" t) r UNION ALL SELECT 'auth.mfa_challenges' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."mfa_challenges" t) r UNION ALL SELECT 'auth.mfa_amr_claims' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."mfa_amr_claims" t) r UNION ALL SELECT 'auth.audit_log_entries' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "auth"."audit_log_entries" t) r UNION ALL SELECT 'storage.buckets' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "storage"."buckets" t) r UNION ALL SELECT 'storage.objects' AS name,jsonb_build_object('count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(h,'|' ORDER BY h),''),'sha256'),'hex')) AS value FROM (SELECT encode(extensions.digest(to_jsonb(t)::text,'sha256'),'hex') h FROM "storage"."objects" t) r) s) AS p(result); IF actual IS DISTINCT FROM (SELECT proof FROM gate3_expected_data) THEN RAISE EXCEPTION 'GATE3_EXACT_COHORT_DRIFT_REFUSED'; END IF; END $cohort$;
SET LOCAL search_path=pg_catalog,public,extensions; DO $catalog_guard$
 DECLARE actual jsonb; expected jsonb := '{"types":[{"acl":"{=U/postgres,postgres=U/postgres,authenticated=U/postgres}","kind":"e","name":"app_role","owner":"postgres","labels":["clinic_owner","doctor","receptionist"],"schema":"public","default":null,"notNull":false,"baseType":null},{"acl":null,"kind":"e","name":"subscription_status","owner":"postgres","labels":["active","past_due","canceled","trial","archived"],"schema":"public","default":null,"notNull":false,"baseType":null},{"acl":"{=U/postgres,postgres=U/postgres,authenticated=U/postgres}","kind":"e","name":"user_status","owner":"postgres","labels":["invited","active","suspended"],"schema":"public","default":null,"notNull":false,"baseType":null}],"tables":[{"acl":"{postgres=arwdDxtm/postgres,authenticated=ar/postgres}","rls":true,"kind":"r","name":"access_audit","owner":"postgres","schema":"logs","options":null,"forceRls":false,"definition":null},{"acl":null,"rls":false,"kind":"S","name":"access_audit_id_seq","owner":"postgres","schema":"logs","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"appointments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"automation_settings","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"billings","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"clinic_invitations","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"clinic_members","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"clinical_records","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,supabase_auth_admin=r/postgres}","rls":true,"kind":"r","name":"clinics","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"dashboard_stats_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT clinic_id,\n    date_trunc(''month''::text, created_at) AS month,\n    count(id) AS total_billings,\n    sum(amount) AS total_revenue,\n    count(DISTINCT patient_id) AS unique_patients_billed\n   FROM billings\n  WHERE clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text)::uuid)\n  GROUP BY clinic_id, (date_trunc(''month''::text, created_at));"},{"acl":"{postgres=arwdDxtm/postgres,anon=arwDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"data_rights_requests","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"hcu033_forms","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"invoices","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"messages","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"notifications","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"patient_files","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"patient_notes","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"patient_stats_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT p.id AS patient_id,\n    p.clinic_id,\n    count(DISTINCT a.id) AS appointment_count,\n    COALESCE(sum(b.amount), 0::numeric) AS total_billed\n   FROM patients p\n     LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = ''completed''::text\n     LEFT JOIN billings b ON b.patient_id = p.id AND b.status = ''paid''::text\n  GROUP BY p.id, p.clinic_id;"},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwd/postgres}","rls":true,"kind":"r","name":"patients","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"payment_methods","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"payments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"prescription_templates","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"prescriptions","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"profile_audit_log","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}","rls":false,"kind":"S","name":"profile_audit_log_id_seq","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=rdDxtm/postgres,authenticated=rdDxtm/postgres,service_role=arwdDxtm/postgres,supabase_auth_admin=r/postgres}","rls":true,"kind":"r","name":"profiles","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"recall_queue","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT id,\n    clinic_id,\n    first_name,\n    last_name,\n    phone,\n    email,\n    COALESCE(medical_alerts, ''''::text) AS medical_alerts,\n    created_at\n   FROM patients\n  WHERE deleted_at IS NULL;"},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"receptionist_patient_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT p.id AS patient_id,\n    p.clinic_id,\n    p.first_name,\n    p.last_name,\n    p.phone,\n    p.email,\n    max(cr.created_at) AS last_visit_date\n   FROM patients p\n     LEFT JOIN clinical_records cr ON p.id = cr.patient_id\n  GROUP BY p.id, p.clinic_id, p.first_name, p.last_name, p.phone, p.email\n HAVING max(cr.created_at) < (now() - ''6 mons''::interval) OR max(cr.created_at) IS NULL;"},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"service_categories","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"services","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"treatments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null}],"columns":[{"acl":null,"name":"id","type":"bigint","table":"logs.access_audit","default":null,"notNull":true,"identity":"d","position":1,"generated":""},{"acl":null,"name":"timestamp","type":"timestamp with time zone","table":"logs.access_audit","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"actor_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"actor_role","type":"text","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"action","type":"text","table":"logs.access_audit","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"table_name","type":"text","table":"logs.access_audit","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"record_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"metadata","type":"jsonb","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.appointments","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.appointments","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.appointments","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.appointments","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"start_time","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"end_time","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.appointments","default":"''scheduled''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.appointments","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"notes","type":"text","table":"public.appointments","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.appointments","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.automation_settings","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.automation_settings","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.automation_settings","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"enabled","type":"boolean","table":"public.automation_settings","default":"false","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"reminder_template","type":"text","table":"public.automation_settings","default":"''Hola {patient_name}, te recordamos tu cita el {date} a las {time} con el Dr. {doctor_name}.''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"days_before","type":"integer","table":"public.automation_settings","default":"1","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"whatsapp_enabled","type":"boolean","table":"public.automation_settings","default":"false","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"email_enabled","type":"boolean","table":"public.automation_settings","default":"true","notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.billings","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.billings","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.billings","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"amount","type":"numeric","table":"public.billings","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.billings","default":"''pending''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"description","type":"text","table":"public.billings","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"due_date","type":"date","table":"public.billings","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"invoice_number","type":"text","table":"public.billings","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"appointment_id","type":"uuid","table":"public.billings","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.billings","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.billings","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinic_invitations","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"role","type":"text","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"invited_by","type":"uuid","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.clinic_invitations","default":"''pending''::text","notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"token","type":"text","table":"public.clinic_invitations","default":"encode(gen_random_bytes(32), ''hex''::text)","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinic_invitations","default":"now()","notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"expires_at","type":"timestamp with time zone","table":"public.clinic_invitations","default":"(now() + ''7 days''::interval)","notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinic_members","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.clinic_members","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.clinic_members","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"role","type":"text","table":"public.clinic_members","default":"''doctor''::text","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinic_members","default":"now()","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.clinic_members","default":"''active''::text","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinical_records","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinical_records","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.clinical_records","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"diagnosis","type":"bytea","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"treatment_plan","type":"text","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"xray_urls","type":"text[]","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"notes","type":"text","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"odontogram_state","type":"jsonb","table":"public.clinical_records","default":"''{}''::jsonb","notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"periodontogram_state","type":"jsonb","table":"public.clinical_records","default":"''{}''::jsonb","notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinics","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinics","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.clinics","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"owner_id","type":"uuid","table":"public.clinics","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"logo_url","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"address","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"settings","type":"jsonb","table":"public.clinics","default":"''{}''::jsonb","notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"disclaimer_text","type":"text","table":"public.clinics","default":"''This estimate is valid for 30 days. Please contact the front desk for questions.''::text","notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"working_hours","type":"jsonb","table":"public.clinics","default":"''{\"fri\": [\"09:00\", \"17:00\"], \"mon\": [\"09:00\", \"17:00\"], \"sat\": null, \"sun\": null, \"thu\": [\"09:00\", \"17:00\"], \"tue\": [\"09:00\", \"17:00\"], \"wed\": [\"09:00\", \"17:00\"]}''::jsonb","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"subscription_tier","type":"text","table":"public.clinics","default":"''trial''::text","notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"trial_ends_at","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"bypass_subscription","type":"boolean","table":"public.clinics","default":"false","notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"subscription_status","type":"subscription_status","table":"public.clinics","default":"''trial''::subscription_status","notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"kushki_subscription_id","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":16,"generated":""},{"acl":null,"name":"next_billing_date","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":17,"generated":""},{"acl":null,"name":"archived_at","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":18,"generated":""},{"acl":null,"name":"size","type":"character varying(50)","table":"public.clinics","default":null,"notNull":false,"identity":"","position":19,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"month","type":"timestamp with time zone","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"total_billings","type":"bigint","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"total_revenue","type":"numeric","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"unique_patients_billed","type":"bigint","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.data_rights_requests","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"request_type","type":"text","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.data_rights_requests","default":"''pending''::text","notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"details","type":"jsonb","table":"public.data_rights_requests","default":"''{}''::jsonb","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"legal_basis","type":"text","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"retention_note","type":"text","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"requested_by_email","type":"text","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"resolved_by","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"resolved_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":"now()","notNull":true,"identity":"","position":13,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":"now()","notNull":true,"identity":"","position":14,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.hcu033_forms","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.hcu033_forms","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.hcu033_forms","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"form_data","type":"jsonb","table":"public.hcu033_forms","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.hcu033_forms","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.invoices","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.invoices","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.invoices","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.invoices","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"billing_id","type":"uuid","table":"public.invoices","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"invoice_number","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"sri_authorization","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"sri_access_key","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"xml_content","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"pdf_url","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.invoices","default":"''draft''::text","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"total_amount","type":"numeric","table":"public.invoices","default":null,"notNull":true,"identity":"","position":12,"generated":""},{"acl":null,"name":"items","type":"jsonb","table":"public.invoices","default":"''[]''::jsonb","notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"sri_authorization_date","type":"timestamp with time zone","table":"public.invoices","default":null,"notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"environment","type":"text","table":"public.invoices","default":"''TEST''::text","notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.messages","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.messages","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"sender_id","type":"uuid","table":"public.messages","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"receiver_id","type":"uuid","table":"public.messages","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"content","type":"text","table":"public.messages","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"is_read","type":"boolean","table":"public.messages","default":"false","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.messages","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.notifications","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.notifications","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.notifications","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"title","type":"text","table":"public.notifications","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"message","type":"text","table":"public.notifications","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.notifications","default":"''info''::text","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"is_read","type":"boolean","table":"public.notifications","default":"false","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"link","type":"text","table":"public.notifications","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.patient_files","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.patient_files","default":"now()","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"file_path","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"size","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":7,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"uploaded_by","type":"uuid","table":"public.patient_files","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.patient_files","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.patient_notes","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.patient_notes","default":"now()","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"content","type":"text","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"author_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.patient_notes","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"appointment_count","type":"bigint","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"total_billed","type":"numeric","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.patients","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.patients","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"first_name","type":"text","table":"public.patients","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"last_name","type":"text","table":"public.patients","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"cedula","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"birth_date","type":"date","table":"public.patients","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"gender","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"address","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"medical_history","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.patients","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"emergency_contact","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"emergency_phone","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"allergies","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"medications","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":16,"generated":""},{"acl":null,"name":"medical_conditions","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":17,"generated":""},{"acl":null,"name":"insurance_provider","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":18,"generated":""},{"acl":null,"name":"policy_number","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":19,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.patients","default":null,"notNull":false,"identity":"","position":20,"generated":""},{"acl":null,"name":"medical_alerts","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":21,"generated":""},{"acl":null,"name":"occupation","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":22,"generated":""},{"acl":null,"name":"guardian_name","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":23,"generated":""},{"acl":null,"name":"referral_source","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":24,"generated":""},{"acl":null,"name":"referred_by","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":25,"generated":""},{"acl":null,"name":"clinical_notes","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":26,"generated":""},{"acl":null,"name":"medical_record_number","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":27,"generated":""},{"acl":null,"name":"tags","type":"text[]","table":"public.patients","default":null,"notNull":false,"identity":"","position":28,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.patients","default":"''active''::text","notNull":false,"identity":"","position":29,"generated":""},{"acl":null,"name":"blood_type","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":30,"generated":""},{"acl":null,"name":"marital_status","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":31,"generated":""},{"acl":null,"name":"city","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":32,"generated":""},{"acl":null,"name":"state","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":33,"generated":""},{"acl":null,"name":"has_diabetes","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":34,"generated":""},{"acl":null,"name":"has_hypertension","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":35,"generated":""},{"acl":null,"name":"has_heart_disease","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":36,"generated":""},{"acl":null,"name":"is_smoker","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":37,"generated":""},{"acl":null,"name":"is_pregnant","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":38,"generated":""},{"acl":null,"name":"preferred_contact_method","type":"text","table":"public.patients","default":"''phone''::text","notNull":false,"identity":"","position":39,"generated":""},{"acl":null,"name":"recall_months","type":"integer","table":"public.patients","default":"6","notNull":false,"identity":"","position":40,"generated":""},{"acl":null,"name":"family_representative_id","type":"uuid","table":"public.patients","default":null,"notNull":false,"identity":"","position":41,"generated":""},{"acl":null,"name":"internal_notes","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":42,"generated":""},{"acl":null,"name":"account_balance","type":"numeric","table":"public.patients","default":"0","notNull":false,"identity":"","position":43,"generated":""},{"acl":null,"name":"family_relationship","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":44,"generated":""},{"acl":null,"name":"is_family_head","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":45,"generated":""},{"acl":null,"name":"last_treatment_note","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":46,"generated":""},{"acl":null,"name":"odontogram_state","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":47,"generated":""},{"acl":null,"name":"avatar_url","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":48,"generated":""},{"acl":null,"name":"periodontogram_state","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":49,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.patients","default":"now()","notNull":false,"identity":"","position":50,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.payment_methods","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.payment_methods","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"title","type":"text","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"config","type":"jsonb","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"is_active","type":"boolean","table":"public.payment_methods","default":"true","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.payment_methods","default":"now()","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.payment_methods","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.payments","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.payments","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.payments","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"amount","type":"numeric(10,2)","table":"public.payments","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"currency","type":"text","table":"public.payments","default":"''USD''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.payments","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"provider","type":"text","table":"public.payments","default":"''kushki''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"provider_transaction_id","type":"text","table":"public.payments","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"metadata","type":"jsonb","table":"public.payments","default":"''{}''::jsonb","notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.prescription_templates","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.prescription_templates","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.prescription_templates","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.prescription_templates","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.prescription_templates","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"data","type":"jsonb","table":"public.prescription_templates","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.prescriptions","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.prescriptions","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"data","type":"jsonb","table":"public.prescriptions","default":"''{}''::jsonb","notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"id","type":"bigint","table":"public.profile_audit_log","default":"nextval(''profile_audit_log_id_seq''::regclass)","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"target_user_id","type":"uuid","table":"public.profile_audit_log","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"actor_user_id","type":"uuid","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"actor_role","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"action","type":"text","table":"public.profile_audit_log","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"old_data","type":"jsonb","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"new_data","type":"jsonb","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"changed_fields","type":"text[]","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"ip_address","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"user_agent","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.profile_audit_log","default":"now()","notNull":true,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.profiles","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=w/postgres}","name":"full_name","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"role","type":"app_role","table":"public.profiles","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":"{authenticated=w/postgres}","name":"avatar_url","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=w/postgres}","name":"phone","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=w/postgres}","name":"address","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=w/postgres}","name":"specialization","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":"{authenticated=w/postgres}","name":"license_number","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=w/postgres}","name":"bio","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":"{authenticated=w/postgres}","name":"updated_at","type":"timestamp with time zone","table":"public.profiles","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.profiles","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.profiles","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"status","type":"user_status","table":"public.profiles","default":"''active''::user_status","notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"title","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"first_name","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"last_name","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"medical_alerts","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"first_name","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"last_name","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"last_visit_date","type":"timestamp with time zone","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.service_categories","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.service_categories","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.service_categories","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"color","type":"text","table":"public.service_categories","default":"''#145247''::text","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.service_categories","default":"now()","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.services","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.services","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.services","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"description","type":"text","table":"public.services","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"price","type":"numeric(10,2)","table":"public.services","default":"0.00","notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"duration_minutes","type":"integer","table":"public.services","default":"30","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"category","type":"text","table":"public.services","default":"''General''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"is_active","type":"boolean","table":"public.services","default":"true","notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.services","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":9,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.services","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":10,"generated":""},{"acl":null,"name":"color","type":"text","table":"public.services","default":"''#145247''::text","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"category_id","type":"uuid","table":"public.services","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.treatments","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.treatments","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"price","type":"numeric","table":"public.treatments","default":"0","notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"duration","type":"integer","table":"public.treatments","default":"30","notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"description","type":"text","table":"public.treatments","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.treatments","default":"now()","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.treatments","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.treatments","default":null,"notNull":false,"identity":"","position":8,"generated":""}],"indexes":[{"name":"access_audit_pkey","ready":true,"valid":true,"schema":"logs","definition":"CREATE UNIQUE INDEX access_audit_pkey ON logs.access_audit USING btree (id)"},{"name":"idx_access_audit_clinic_id","ready":true,"valid":true,"schema":"logs","definition":"CREATE INDEX idx_access_audit_clinic_id ON logs.access_audit USING btree (clinic_id)"},{"name":"appointments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id)"},{"name":"automation_settings_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX automation_settings_pkey ON public.automation_settings USING btree (id)"},{"name":"billings_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX billings_pkey ON public.billings USING btree (id)"},{"name":"clinic_invitations_clinic_id_email_status_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_clinic_id_email_status_key ON public.clinic_invitations USING btree (clinic_id, email, status)"},{"name":"clinic_invitations_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_pkey ON public.clinic_invitations USING btree (id)"},{"name":"clinic_invitations_token_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_token_key ON public.clinic_invitations USING btree (token)"},{"name":"clinic_members_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_members_pkey ON public.clinic_members USING btree (id)"},{"name":"clinic_members_user_id_clinic_id_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_members_user_id_clinic_id_key ON public.clinic_members USING btree (user_id, clinic_id)"},{"name":"clinical_records_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinical_records_pkey ON public.clinical_records USING btree (id)"},{"name":"clinics_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinics_pkey ON public.clinics USING btree (id)"},{"name":"data_rights_requests_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX data_rights_requests_pkey ON public.data_rights_requests USING btree (id)"},{"name":"hcu033_forms_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX hcu033_forms_pkey ON public.hcu033_forms USING btree (id)"},{"name":"idx_appointments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_clinic_id ON public.appointments USING btree (clinic_id)"},{"name":"idx_billings_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_billings_clinic_id ON public.billings USING btree (clinic_id)"},{"name":"idx_clinic_invitations_email","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_invitations_email ON public.clinic_invitations USING btree (email)"},{"name":"idx_clinic_invitations_status","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_invitations_status ON public.clinic_invitations USING btree (status)"},{"name":"idx_clinic_members_auth_lookup","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_members_auth_lookup ON public.clinic_members USING btree (user_id, clinic_id, status)"},{"name":"idx_clinical_records_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinical_records_clinic_id ON public.clinical_records USING btree (clinic_id)"},{"name":"idx_data_rights_requests_tenant","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_data_rights_requests_tenant ON public.data_rights_requests USING btree (clinic_id, created_at DESC)"},{"name":"idx_data_rights_requests_type","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_data_rights_requests_type ON public.data_rights_requests USING btree (clinic_id, request_type)"},{"name":"idx_hcu033_forms_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_hcu033_forms_clinic_id ON public.hcu033_forms USING btree (clinic_id)"},{"name":"idx_hcu033_forms_tenant_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_hcu033_forms_tenant_patient ON public.hcu033_forms USING btree (clinic_id, patient_id)"},{"name":"idx_invoices_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_invoices_clinic_id ON public.invoices USING btree (clinic_id)"},{"name":"idx_messages_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_messages_clinic_id ON public.messages USING btree (clinic_id)"},{"name":"idx_patient_files_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_files_patient ON public.patient_files USING btree (patient_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patient_notes_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_notes_patient ON public.patient_notes USING btree (patient_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patients_clinic_deleted","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_clinic_deleted ON public.patients USING btree (clinic_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patients_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_clinic_id ON public.patients USING btree (clinic_id)"},{"name":"idx_patients_email","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_email ON public.patients USING btree (email)"},{"name":"idx_patients_family_rep","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_family_rep ON public.patients USING btree (family_representative_id)"},{"name":"idx_payment_methods_clinic_active","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payment_methods_clinic_active ON public.payment_methods USING btree (clinic_id, is_active)"},{"name":"idx_payment_methods_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payment_methods_clinic_id ON public.payment_methods USING btree (clinic_id)"},{"name":"idx_payments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payments_clinic_id ON public.payments USING btree (clinic_id)"},{"name":"idx_prescriptions_tenant_doctor","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_prescriptions_tenant_doctor ON public.prescriptions USING btree (clinic_id, doctor_id, patient_id)"},{"name":"idx_profiles_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_profiles_clinic_id ON public.profiles USING btree (clinic_id)"},{"name":"idx_services_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_services_clinic_id ON public.services USING btree (clinic_id)"},{"name":"idx_treatments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_treatments_clinic_id ON public.treatments USING btree (clinic_id)"},{"name":"invoices_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id)"},{"name":"messages_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id)"},{"name":"notifications_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)"},{"name":"patient_files_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patient_files_pkey ON public.patient_files USING btree (id)"},{"name":"patient_notes_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patient_notes_pkey ON public.patient_notes USING btree (id)"},{"name":"patients_cedula_clinic_unique","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patients_cedula_clinic_unique ON public.patients USING btree (cedula, clinic_id)"},{"name":"patients_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (id)"},{"name":"payment_methods_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX payment_methods_pkey ON public.payment_methods USING btree (id)"},{"name":"payments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id)"},{"name":"prescription_templates_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX prescription_templates_pkey ON public.prescription_templates USING btree (id)"},{"name":"prescriptions_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX prescriptions_pkey ON public.prescriptions USING btree (id)"},{"name":"profile_audit_log_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profile_audit_log_pkey ON public.profile_audit_log USING btree (id)"},{"name":"profiles_email_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email) WHERE (email IS NOT NULL)"},{"name":"profiles_license_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_license_key ON public.profiles USING btree (license_number) WHERE (license_number IS NOT NULL)"},{"name":"profiles_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"},{"name":"service_categories_clinic_id_name_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX service_categories_clinic_id_name_key ON public.service_categories USING btree (clinic_id, name)"},{"name":"service_categories_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX service_categories_pkey ON public.service_categories USING btree (id)"},{"name":"services_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX services_pkey ON public.services USING btree (id)"},{"name":"treatments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX treatments_pkey ON public.treatments USING btree (id)"}],"schemas":[{"acl":null,"name":"logs","owner":"postgres"},{"acl":"{pg_database_owner=UC/pg_database_owner,postgres=U/pg_database_owner,supabase_auth_admin=U/pg_database_owner}","name":"public","owner":"pg_database_owner"}],"database":"postgres","defaults":[{"acl":"{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}","type":"S","owner":"postgres","schema":"public"},{"acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","type":"f","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","type":"r","owner":"postgres","schema":"public"},{"acl":"{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}","type":"S","owner":"supabase_admin","schema":"public"},{"acl":"{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}","type":"f","owner":"supabase_admin","schema":"public"},{"acl":"{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}","type":"r","owner":"supabase_admin","schema":"public"}],"policies":[{"cmd":"DELETE","qual":"false","roles":["public"],"tablename":"access_audit","permissive":"PERMISSIVE","policyname":"No one allows delete on audit","schemaname":"logs","with_check":null},{"cmd":"UPDATE","qual":"false","roles":["public"],"tablename":"access_audit","permissive":"PERMISSIVE","policyname":"No one allows update on audit","schemaname":"logs","with_check":null},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"access_audit","permissive":"PERMISSIVE","policyname":"System can insert audit","schemaname":"logs","with_check":"true"},{"cmd":"DELETE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"Users can delete appointments in their clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"Users can insert appointments in their clinic","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"Users can update appointments in their clinic","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"Users can view appointments in their clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"automation_settings","permissive":"PERMISSIVE","policyname":"Users can insert their own settings","schemaname":"public","with_check":"(auth.uid() = user_id)"},{"cmd":"UPDATE","qual":"(auth.uid() = user_id)","roles":["public"],"tablename":"automation_settings","permissive":"PERMISSIVE","policyname":"Users can update their own settings","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(auth.uid() = user_id)","roles":["public"],"tablename":"automation_settings","permissive":"PERMISSIVE","policyname":"Users can view their own settings","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["public"],"tablename":"billings","permissive":"PERMISSIVE","policyname":"Owners can view billings","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"billings","permissive":"PERMISSIVE","policyname":"Users can insert billings in their clinic","schemaname":"public","with_check":"(patient_id IN ( SELECT patients.id\n   FROM patients\n  WHERE (patients.clinic_id = get_user_clinic_id())))"},{"cmd":"UPDATE","qual":"(patient_id IN ( SELECT patients.id\n   FROM patients\n  WHERE (patients.clinic_id = get_user_clinic_id())))","roles":["public"],"tablename":"billings","permissive":"PERMISSIVE","policyname":"Users can update billings in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((email = auth.email()) OR (email = (( SELECT users.email\n   FROM auth.users\n  WHERE (users.id = auth.uid())))::text))","roles":["public"],"tablename":"clinic_invitations","permissive":"PERMISSIVE","policyname":"Anyone can view their own invitation by email","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"(EXISTS ( SELECT 1\n   FROM clinic_members\n  WHERE ((clinic_members.clinic_id = clinic_invitations.clinic_id) AND (clinic_members.user_id = auth.uid()) AND (clinic_members.role = ''clinic_owner''::text))))","roles":["authenticated"],"tablename":"clinic_invitations","permissive":"PERMISSIVE","policyname":"Clinic owners can manage invitations","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((auth.uid() = user_id) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = clinic_members.clinic_id) AND (c.owner_id = auth.uid())))))","roles":["authenticated"],"tablename":"clinic_members","permissive":"PERMISSIVE","policyname":"Users and owners can view clinic memberships","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ''clinic_owner''::text) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"Clinic owners can delete clinical records","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"Clinical staff can insert clinical records","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"Clinical staff can update clinical records","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"Medical staff can view clinical records","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(owner_id = auth.uid())","roles":["public"],"tablename":"clinics","permissive":"PERMISSIVE","policyname":"Owners can update their own clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((id IN ( SELECT profiles.clinic_id\n   FROM profiles\n  WHERE (profiles.id = auth.uid()))) OR (owner_id = auth.uid()))","roles":["public"],"tablename":"clinics","permissive":"PERMISSIVE","policyname":"Users can view their own clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"Authenticated users can submit data rights requests","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((user_id IS NULL) OR (user_id = auth.uid())))"},{"cmd":"SELECT","qual":"(clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid)","roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"Clinic members can view data rights requests","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"Clinic owners can update data rights requests","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))"},{"cmd":"SELECT","qual":"(((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id\n   FROM patients p\n  WHERE ((p.clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(p.clinic_id) AND check_subscription_active(p.clinic_id))))))","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"Clinic members can view hcu033_forms","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"(((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ''clinic_owner''::text) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id\n   FROM patients p\n  WHERE ((p.clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ''clinic_owner''::text) AND check_subscription_active(p.clinic_id))))))","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"Clinic owners can delete hcu033_forms","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"Clinical staff can insert hcu033_forms","schemaname":"public","with_check":"(((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id\n   FROM patients p\n  WHERE ((p.clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(p.clinic_id))))))"},{"cmd":"UPDATE","qual":"(((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id\n   FROM patients p\n  WHERE ((p.clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(p.clinic_id))))))","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"Clinical staff can update hcu033_forms","schemaname":"public","with_check":"(((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id\n   FROM patients p\n  WHERE ((p.clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(p.clinic_id))))))"},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"invoices","permissive":"PERMISSIVE","policyname":"Users can insert invoices in their clinic","schemaname":"public","with_check":"(clinic_id = get_user_clinic_id())"},{"cmd":"UPDATE","qual":"(clinic_id = get_user_clinic_id())","roles":["public"],"tablename":"invoices","permissive":"PERMISSIVE","policyname":"Users can update invoices in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(clinic_id = get_user_clinic_id())","roles":["public"],"tablename":"invoices","permissive":"PERMISSIVE","policyname":"Users can view invoices in their clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"messages","permissive":"PERMISSIVE","policyname":"Users can insert messages","schemaname":"public","with_check":"(auth.uid() = sender_id)"},{"cmd":"UPDATE","qual":"(auth.uid() = sender_id)","roles":["public"],"tablename":"messages","permissive":"PERMISSIVE","policyname":"Users can update their own messages","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((auth.uid() = sender_id) OR (auth.uid() = receiver_id))","roles":["public"],"tablename":"messages","permissive":"PERMISSIVE","policyname":"Users can view their own messages","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"notifications","permissive":"PERMISSIVE","policyname":"System can insert notifications","schemaname":"public","with_check":"true"},{"cmd":"UPDATE","qual":"(auth.uid() = user_id)","roles":["public"],"tablename":"notifications","permissive":"PERMISSIVE","policyname":"Users can update their own notifications","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(auth.uid() = user_id)","roles":["public"],"tablename":"notifications","permissive":"PERMISSIVE","policyname":"Users can view their own notifications","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"Users can insert files in their clinic","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"Users can update files in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"Users can view files in their clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"Users can insert notes in their clinic","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"Users can update notes in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"Users can view notes in their clinic","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"Active clinic members can insert patients","schemaname":"public","with_check":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"Active clinic members can update patients","schemaname":"public","with_check":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"Active clinic members can view patients","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"Clinic owners can delete patients in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((is_active = true) AND (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE (b.clinic_id = payment_methods.clinic_id))))","roles":["anon","authenticated"],"tablename":"payment_methods","permissive":"PERMISSIVE","policyname":"Allow checkout viewing of active payment methods","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) OR (EXISTS ( SELECT 1\n   FROM clinic_members cm\n  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.status = ''active''::text)))) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))))","roles":["authenticated"],"tablename":"payment_methods","permissive":"PERMISSIVE","policyname":"Clinic members can view payment methods","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"(((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text)) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM clinic_members cm\n  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = ''clinic_owner''::text) AND (cm.status = ''active''::text)))))","roles":["authenticated"],"tablename":"payment_methods","permissive":"PERMISSIVE","policyname":"Clinic owners can delete payment methods","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"payment_methods","permissive":"PERMISSIVE","policyname":"Clinic owners can insert payment methods","schemaname":"public","with_check":"(((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text)) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM clinic_members cm\n  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = ''clinic_owner''::text) AND (cm.status = ''active''::text)))))"},{"cmd":"UPDATE","qual":"(((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text)) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM clinic_members cm\n  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = ''clinic_owner''::text) AND (cm.status = ''active''::text)))))","roles":["authenticated"],"tablename":"payment_methods","permissive":"PERMISSIVE","policyname":"Clinic owners can update payment methods","schemaname":"public","with_check":"(((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text)) OR (EXISTS ( SELECT 1\n   FROM clinics c\n  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM clinic_members cm\n  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = ''clinic_owner''::text) AND (cm.status = ''active''::text)))))"},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["public"],"tablename":"payments","permissive":"PERMISSIVE","policyname":"Owners can view their payments","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"Templates are deletable by their creator or clinic owners","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"Templates are insertable by clinical staff","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND (doctor_id = auth.uid()) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"Templates are updatable by their creator or clinic owners","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"Templates are viewable by clinic members","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"Doctors and owners can insert prescriptions","schemaname":"public","with_check":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND (doctor_id = auth.uid()) AND check_subscription_active(clinic_id))"},{"cmd":"UPDATE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"Doctors and owners can update their prescriptions","schemaname":"public","with_check":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))"},{"cmd":"DELETE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (get_clinic_member_role(clinic_id) = ''clinic_owner''::text) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"Prescriptions are deletable by clinic owners","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"Prescriptions are viewable by clinic members","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''clinic_owner''::app_role))))","roles":["public"],"tablename":"profile_audit_log","permissive":"PERMISSIVE","policyname":"Admins can view audit logs","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text) AND (id <> auth.uid()))","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"Clinic owners can delete members in their clinic","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"Clinic owners can update members in their clinic","schemaname":"public","with_check":"((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid))"},{"cmd":"SELECT","qual":"((id = auth.uid()) OR ((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid)))","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"Profiles are viewable by same clinic members","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(auth.uid() = id)","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"Users can update own profile","schemaname":"public","with_check":"(auth.uid() = id)"},{"cmd":"ALL","qual":"(clinic_id IN ( SELECT clinic_members.clinic_id\n   FROM clinic_members\n  WHERE (clinic_members.user_id = auth.uid())))","roles":["public"],"tablename":"service_categories","permissive":"PERMISSIVE","policyname":"Users can manage their clinic categories","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid)","roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"Clinic members can view services","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"Clinic owners can delete services","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"Clinic owners can insert services","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))"},{"cmd":"UPDATE","qual":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))","roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"Clinic owners can update services","schemaname":"public","with_check":"((clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ''clinic_owner''::text))"},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"treatments","permissive":"PERMISSIVE","policyname":"Users can insert treatments in their clinic","schemaname":"public","with_check":"(clinic_id = get_user_clinic_id())"},{"cmd":"UPDATE","qual":"(clinic_id = get_user_clinic_id())","roles":["public"],"tablename":"treatments","permissive":"PERMISSIVE","policyname":"Users can update treatments in their clinic","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"(clinic_id = get_user_clinic_id())","roles":["public"],"tablename":"treatments","permissive":"PERMISSIVE","policyname":"Users can view treatments in their clinic","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":null,"roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Anyone can update an avatar","schemaname":"storage","with_check":"(bucket_id = ''avatars''::text)"},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Anyone can upload an avatar","schemaname":"storage","with_check":"(bucket_id = ''avatars''::text)"},{"cmd":"UPDATE","qual":null,"roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Authenticated users update doctor avatars","schemaname":"storage","with_check":"((bucket_id = ''doctor-avatars''::text) AND (auth.role() = ''authenticated''::text))"},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Authenticated users upload doctor avatars","schemaname":"storage","with_check":"((bucket_id = ''doctor-avatars''::text) AND (auth.role() = ''authenticated''::text))"},{"cmd":"SELECT","qual":"(bucket_id = ''avatars''::text)","roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Avatar images are publicly accessible","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"((bucket_id = ''clinic-branding''::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id\n   FROM profiles\n  WHERE (profiles.id = auth.uid()))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Owners can delete their logos","schemaname":"storage","with_check":null},{"cmd":"UPDATE","qual":"((bucket_id = ''clinic-branding''::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id\n   FROM profiles\n  WHERE (profiles.id = auth.uid()))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Owners can update their logos","schemaname":"storage","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Owners can upload logos","schemaname":"storage","with_check":"((bucket_id = ''clinic-branding''::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id\n   FROM profiles\n  WHERE (profiles.id = auth.uid()))))"},{"cmd":"SELECT","qual":"(bucket_id = ''clinic-branding''::text)","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Public Access to Clinic Logos","schemaname":"storage","with_check":null},{"cmd":"SELECT","qual":"(bucket_id = ''doctor-avatars''::text)","roles":["public"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Public Access to Doctor Avatars","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"((bucket_id = ''patient-avatars''::text) AND ((((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || ''-%''::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated delete for patient-avatars","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"((bucket_id = ''patient-files''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND (get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY[''clinic_owner''::text, ''doctor''::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated delete for patient-files","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"((bucket_id = ''receipts''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND (((get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY[''clinic_owner''::text, ''admin''::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND (get_clinic_member_role(b.clinic_id) = ANY (ARRAY[''clinic_owner''::text, ''admin''::text])))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated delete for receipts","schemaname":"storage","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated insert for patient-avatars","schemaname":"storage","with_check":"((bucket_id = ''patient-avatars''::text) AND ((((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || ''-%''::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id))))))"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated insert for receipts","schemaname":"storage","with_check":"((bucket_id = ''receipts''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id))))))"},{"cmd":"SELECT","qual":"((bucket_id = ''patient-files''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated read for patient-files","schemaname":"storage","with_check":null},{"cmd":"SELECT","qual":"((bucket_id = ''patient-avatars''::text) AND ((((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || ''-%''::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated select for patient-avatars","schemaname":"storage","with_check":null},{"cmd":"SELECT","qual":"((bucket_id = ''receipts''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated select for receipts","schemaname":"storage","with_check":null},{"cmd":"UPDATE","qual":"((bucket_id = ''patient-avatars''::text) AND ((((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || ''-%''::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated update for patient-avatars","schemaname":"storage","with_check":null},{"cmd":"UPDATE","qual":"((bucket_id = ''patient-files''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated update for patient-files","schemaname":"storage","with_check":"((bucket_id = ''patient-files''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))"},{"cmd":"UPDATE","qual":"((bucket_id = ''receipts''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1\n   FROM billings b\n  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id))))))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated update for receipts","schemaname":"storage","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"Tenant isolated upload for patient-files","schemaname":"storage","with_check":"((bucket_id = ''patient-files''::text) AND ((storage.foldername(name))[1] ~ ''^[0-9a-fA-F-]{36}$''::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1\n   FROM patients p\n  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))"}],"triggers":[{"name":"audit_billings","table":"public.billings","enabled":"O","definition":"CREATE TRIGGER audit_billings AFTER INSERT OR DELETE OR UPDATE ON billings FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"audit_clinical_records","table":"public.clinical_records","enabled":"O","definition":"CREATE TRIGGER audit_clinical_records AFTER INSERT OR DELETE OR UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"trg_protect_data_requests_immutability","table":"public.data_rights_requests","enabled":"O","definition":"CREATE TRIGGER trg_protect_data_requests_immutability BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests()"},{"name":"trg_protect_data_rights_requests","table":"public.data_rights_requests","enabled":"O","definition":"CREATE TRIGGER trg_protect_data_rights_requests BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests()"},{"name":"audit_hcu033_forms","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER audit_hcu033_forms AFTER INSERT OR DELETE OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"tr_update_patient_odontogram","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION update_patient_odontogram_summary()"},{"name":"trg_sync_hcu033_form_clinic_id","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION sync_hcu033_form_clinic_id()"},{"name":"audit_patients","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"trg_enforce_patient_clinical_privileges","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER trg_enforce_patient_clinical_privileges BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION enforce_patient_clinical_privileges()"},{"name":"trg_guard_patient_clinical_insert","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER trg_guard_patient_clinical_insert BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION guard_patient_clinical_insert()"},{"name":"set_profiles_updated_at","table":"public.profiles","enabled":"O","definition":"CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()"},{"name":"trg_log_profile_changes","table":"public.profiles","enabled":"O","definition":"CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON profiles FOR EACH ROW WHEN (old.* IS DISTINCT FROM new.*) EXECUTE FUNCTION log_profile_changes()"},{"name":"trg_prevent_profile_privilege_escalation","table":"public.profiles","enabled":"O","definition":"CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation()"},{"name":"on_auth_user_created","table":"auth.users","enabled":"O","definition":"CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()"},{"name":"on_auth_user_verified","table":"auth.users","enabled":"O","definition":"CREATE TRIGGER on_auth_user_verified BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_verified_clinic_creation()"}],"btreeGist":{"available":"1.7","installed":null},"functions":[{"acl":null,"owner":"postgres","config":null,"bodyMd5":"414e8b229d8c609066d7e53eb16d9328","definer":true,"identity":"logs.log_access_trigger()","anonExecute":true,"definitionMd5":"bc78248fc4a35b24856ecbe970880085","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":null,"bodyMd5":"8ddbf782eb97d9730ed96ea2e71abf92","definer":true,"identity":"logs.log_patient_view(uuid)","anonExecute":true,"definitionMd5":"06526ca5c931880b63db7c69392424f4","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"c30589f5753e4fe8b198c81b739c8786","definer":true,"identity":"accept_clinic_invitation(text)","anonExecute":false,"definitionMd5":"3bd2fb4cfa5ac4a64a6a1cc80a35f761","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"90b5a8328c8a0e350f0c40a22531b395","definer":true,"identity":"archive_clinic(uuid)","anonExecute":false,"definitionMd5":"cd96d7eabb99a32b653ba00bc17912ab","serviceExecute":true,"authenticatedExecute":false},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"126c1f5fe13b73048e885bde526aa18c","definer":true,"identity":"check_subscription_active(uuid)","anonExecute":true,"definitionMd5":"476d5e111fe157889ce1e62ecef0d9a1","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"138ad918f1700969a6a106fae965b57f","definer":true,"identity":"cleanup_soft_deleted_records()","anonExecute":false,"definitionMd5":"33e09aced6db29a08ebd5ca26e5daaa3","serviceExecute":true,"authenticatedExecute":false},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":null,"bodyMd5":"f914a1cd6d3f9a51dc1e17176299a85e","definer":true,"identity":"create_tenant_clinic(text,text,text)","anonExecute":true,"definitionMd5":"85f0ec6a53e9e21c3df60af881a5d5be","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,supabase_auth_admin=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"592a14eecfc5f8850ee9bace68c11ec1","definer":true,"identity":"custom_access_token_hook(jsonb)","anonExecute":false,"definitionMd5":"24b8ee285342b0f48385ad4239a0c567","serviceExecute":true,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3714a26603df41e27491cb183bc27c79","definer":false,"identity":"enforce_patient_clinical_privileges()","anonExecute":false,"definitionMd5":"a79e4f585e4817c88f1a82e3449d4bdd","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3711d3f356f0f9471e774a6fd6b165db","definer":true,"identity":"get_checkout_payment_methods(uuid)","anonExecute":true,"definitionMd5":"cc253f79208edd996312d63d6e6c17d3","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"19218665faee08f056d3352c7a8f8986","definer":true,"identity":"get_clinic_member_role(uuid)","anonExecute":false,"definitionMd5":"3d5d933e20c5b0289c9a969879b375e1","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"00eb31f4eb9dc01cadebf592caa8fb51","definer":true,"identity":"get_family_unit_with_stats(uuid)","anonExecute":false,"definitionMd5":"dfb8907ed8265171daea44d74a10f03e","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":null,"bodyMd5":"725ba43c0eda218dad19a3ff071b14f8","definer":true,"identity":"get_patient_profile_secure(uuid)","anonExecute":true,"definitionMd5":"6f0d5f42f5840528155ad3af63add074","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"4a4b03a939ac491d4e88a8770e8a6968","definer":true,"identity":"get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid)","anonExecute":false,"definitionMd5":"8a46d6e1e9006ac2ad4c2d0794bdd061","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"495a5f7ed75aacd624fe633134c2c555","definer":true,"identity":"get_user_clinic_id()","anonExecute":true,"definitionMd5":"1979396d84364d0881165808c6f3b0db","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"c0e32787d2ec248cd16f6d567ca4cf4c","definer":false,"identity":"guard_patient_clinical_insert()","anonExecute":false,"definitionMd5":"634b6f985204b9dc1094d98b34247518","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"6ab9686af13d9f52024a3abaa727d3f2","definer":true,"identity":"handle_new_user()","anonExecute":true,"definitionMd5":"39b5cb80941f731e5a63ed71f92a461d","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"f271bbd51a6247f8a3dbf663233a1176","definer":true,"identity":"handle_verified_clinic_creation()","anonExecute":false,"definitionMd5":"e6313389105e18a967f34031293717a0","serviceExecute":true,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"56d17b366dd4fc1cf5d0d3eaca5c0f5e","definer":true,"identity":"is_clinic_member(uuid)","anonExecute":false,"definitionMd5":"c99da4022a6f776aeede36af40241391","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"4723deaaf6ca6fb5d567a480949b9473","definer":true,"identity":"log_data_rights_request(text,jsonb,text,text)","anonExecute":false,"definitionMd5":"bb481d0ad198788667dcd669551a30f5","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"4760219956f1bb9ef82a3e9fda3f98ce","definer":true,"identity":"log_profile_changes()","anonExecute":true,"definitionMd5":"183599071d98165d5218941724bd854e","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"6bf8eee596c505befaeddcceab50ee0b","definer":false,"identity":"prevent_profile_privilege_escalation()","anonExecute":false,"definitionMd5":"198d5a73a84a016edb7ef2b12dee3f03","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"ec059425c4107fcac5b027930236b8e7","definer":false,"identity":"protect_data_rights_requests()","anonExecute":false,"definitionMd5":"2d674b0de6659f65da8eae278215ae9c","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"0a5f505a9722aea8bb6e2c1980bf3642","definer":true,"identity":"purge_clinic_data(uuid)","anonExecute":false,"definitionMd5":"903d65b778c92932099d708e2b530b4e","serviceExecute":true,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"4fca9a3c19129b1c05bcdce3515d4109","definer":true,"identity":"remove_clinic_member(uuid,uuid)","anonExecute":false,"definitionMd5":"2c680635ad14d6087b89a16a9ea81d61","serviceExecute":true,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3802daae556803abe4d0ea2851f8e159","definer":true,"identity":"seed_default_services(uuid)","anonExecute":false,"definitionMd5":"9e5acd7895a25326b07ea3827340dabc","serviceExecute":true,"authenticatedExecute":false},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":null,"bodyMd5":"9b1889f56258bf9d6554213c05019c76","definer":false,"identity":"set_updated_at()","anonExecute":true,"definitionMd5":"8de7ae383447503e8949149bfb3f0efb","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"5787e68ca3339fd0760ea4a4edce29e3","definer":true,"identity":"sync_hcu033_form_clinic_id()","anonExecute":true,"definitionMd5":"4469ada6f121cd159a9d5f7f6abbe993","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":null,"bodyMd5":"81e1a38c87af593f0b79bd2ec6c12871","definer":false,"identity":"update_billing_status()","anonExecute":true,"definitionMd5":"f94ede25355a91da7389017a21b9e889","serviceExecute":true,"authenticatedExecute":true},{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","config":null,"bodyMd5":"42fbc6aa9070d1db84db9e840536e9b5","definer":true,"identity":"update_patient_odontogram_summary()","anonExecute":true,"definitionMd5":"aefe5a1b1ead05decd090ffe0033fa5c","serviceExecute":true,"authenticatedExecute":true}],"sequences":[{"max":"9223372036854775807","min":"1","name":"access_audit_id_seq","type":"bigint","cache":"1","cycle":false,"start":"1","schema":"logs","increment":"1"},{"max":"9223372036854775807","min":"1","name":"profile_audit_log_id_seq","type":"bigint","cache":"1","cycle":false,"start":"1","schema":"public","increment":"1"}],"constraints":[{"name":"access_audit_pkey","type":"p","table":"logs.access_audit","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"appointments_clinic_id_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"appointments_doctor_id_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"appointments_patient_id_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE"},{"name":"appointments_pkey","type":"p","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"appointments_status_check","type":"c","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text]))"},{"name":"automation_settings_pkey","type":"p","table":"public.automation_settings","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"automation_settings_user_id_fkey","type":"f","table":"public.automation_settings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"billings_appointment_id_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (appointment_id) REFERENCES appointments(id)"},{"name":"billings_clinic_id_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"billings_patient_id_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id)"},{"name":"billings_pkey","type":"p","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"billings_status_check","type":"c","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''paid''::text, ''pending''::text, ''overdue''::text]))"},{"name":"clinic_invitations_clinic_id_email_status_key","type":"u","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (clinic_id, email, status)"},{"name":"clinic_invitations_clinic_id_fkey","type":"f","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"clinic_invitations_invited_by_fkey","type":"f","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (invited_by) REFERENCES auth.users(id)"},{"name":"clinic_invitations_pkey","type":"p","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinic_invitations_role_check","type":"c","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))"},{"name":"clinic_invitations_status_check","type":"c","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))"},{"name":"clinic_invitations_token_key","type":"u","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (token)"},{"name":"clinic_members_clinic_id_fkey","type":"f","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"clinic_members_pkey","type":"p","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinic_members_user_id_clinic_id_key","type":"u","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (user_id, clinic_id)"},{"name":"clinic_members_user_id_fkey","type":"f","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"clinical_records_clinic_id_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"clinical_records_doctor_id_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"clinical_records_patient_id_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id)"},{"name":"clinical_records_pkey","type":"p","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinics_owner_id_fkey","type":"f","table":"public.clinics","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (owner_id) REFERENCES profiles(id)"},{"name":"clinics_pkey","type":"p","table":"public.clinics","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"data_rights_requests_clinic_id_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"data_rights_requests_patient_id_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL"},{"name":"data_rights_requests_pkey","type":"p","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"data_rights_requests_request_type_check","type":"c","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))"},{"name":"data_rights_requests_resolved_by_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"data_rights_requests_status_check","type":"c","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))"},{"name":"data_rights_requests_user_id_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"hcu033_forms_clinic_id_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"hcu033_forms_doctor_id_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"hcu033_forms_patient_id_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE"},{"name":"hcu033_forms_pkey","type":"p","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"invoices_billing_id_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (billing_id) REFERENCES billings(id)"},{"name":"invoices_clinic_id_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"invoices_patient_id_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id)"},{"name":"invoices_pkey","type":"p","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"invoices_status_check","type":"c","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''draft''::text, ''authorized''::text, ''rejected''::text, ''cancelled''::text]))"},{"name":"messages_clinic_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"messages_pkey","type":"p","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"messages_receiver_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (receiver_id) REFERENCES profiles(id)"},{"name":"messages_sender_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (sender_id) REFERENCES profiles(id)"},{"name":"notifications_pkey","type":"p","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"notifications_type_check","type":"c","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))"},{"name":"notifications_user_id_fkey","type":"f","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"patient_files_clinic_id_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"patient_files_patient_id_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE"},{"name":"patient_files_pkey","type":"p","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"patient_files_uploaded_by_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL"},{"name":"patient_notes_author_id_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL"},{"name":"patient_notes_clinic_id_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"patient_notes_patient_id_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE"},{"name":"patient_notes_pkey","type":"p","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"patients_cedula_clinic_unique","type":"u","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (cedula, clinic_id)"},{"name":"patients_clinic_id_fkey","type":"f","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"patients_family_representative_id_fkey","type":"f","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (family_representative_id) REFERENCES patients(id)"},{"name":"patients_pkey","type":"p","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"payment_methods_clinic_id_fkey","type":"f","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"payment_methods_doctor_id_fkey","type":"f","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"payment_methods_pkey","type":"p","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"payments_clinic_id_fkey","type":"f","table":"public.payments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"payments_pkey","type":"p","table":"public.payments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"prescription_templates_clinic_id_check","type":"c","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (clinic_id IS NOT NULL)"},{"name":"prescription_templates_doctor_id_fkey","type":"f","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"prescription_templates_pkey","type":"p","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"prescriptions_clinic_id_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"prescriptions_doctor_id_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL"},{"name":"prescriptions_patient_id_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE"},{"name":"prescriptions_pkey","type":"p","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"profile_audit_log_actor_user_id_fkey","type":"f","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (actor_user_id) REFERENCES profiles(id)"},{"name":"profile_audit_log_pkey","type":"p","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"profile_audit_log_target_user_id_fkey","type":"f","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE"},{"name":"profiles_clinic_id_fkey","type":"f","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"profiles_id_fkey","type":"f","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"profiles_pkey","type":"p","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"service_categories_clinic_id_fkey","type":"f","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE"},{"name":"service_categories_clinic_id_name_key","type":"u","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (clinic_id, name)"},{"name":"service_categories_pkey","type":"p","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"services_category_id_fkey","type":"f","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL"},{"name":"services_clinic_id_fkey","type":"f","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"services_pkey","type":"p","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"treatments_clinic_id_fkey","type":"f","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"treatments_pkey","type":"p","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"treatments_user_id_fkey","type":"f","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id)"}],"currentUser":"postgres","sessionUser":"postgres","serverVersion":"170011"}'::jsonb;
 n_doc jsonb; n_row jsonb; n_rows jsonb; n_value jsonb; n_section record; n_field record; n_i integer;
 BEGIN SELECT catalog INTO actual FROM (SELECT jsonb_build_object(
  'database',current_database(),'currentUser',current_user,'sessionUser',session_user,
  'serverVersion',current_setting('server_version_num'),
  'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'options',c.reloptions,'definition',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S')),
  'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum),'[]') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definitionMd5',md5(pg_get_functiondef(p.oid)),'bodyMd5',md5(replace(p.prosrc,E'\r\n',E'\n')),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind IN ('f','p')),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',co.conname,'type',co.contype,'validated',co.convalidated,'deferrable',co.condeferrable,'deferred',co.condeferred,'definition',pg_get_constraintdef(co.oid,true)) ORDER BY n.nspname,c.relname,co.conname),'[]') FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) ORDER BY n.nspname,c.relname),'[]') FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname IN ('public','logs','security_internal') OR (n.nspname='auth' AND c.relname='users'))),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname),'[]') FROM pg_policies p WHERE p.schemaname IN ('public','logs','security_internal') OR (p.schemaname='storage' AND p.tablename='objects')),
  'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text) ORDER BY n.nspname),'[]') FROM pg_namespace n WHERE n.nspname IN ('public','logs','security_internal')),
  'defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,''),'type',d.defaclobjtype,'acl',d.defaclacl::text) ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),'[]') FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN ('public','logs','security_internal')),
  'types',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',t.typtype,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'baseType',CASE WHEN t.typtype='d' THEN format_type(t.typbasetype,t.typtypmod) END,'notNull',t.typnotnull,'default',t.typdefault,'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)) ORDER BY n.nspname,t.typname),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','logs','security_internal') AND t.typtype IN ('e','d')),
  'sequences',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) ORDER BY n.nspname,c.relname),'[]') FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'btreeGist',(SELECT jsonb_build_object('available',a.default_version,'installed',a.installed_version) FROM pg_available_extensions a WHERE a.name='btree_gist')
) AS catalog) snapshot;
 FOR n_i IN 0..1 LOOP
 n_doc:=CASE WHEN n_i=0 THEN actual ELSE expected END;
 FOR n_section IN SELECT key,value FROM jsonb_each(n_doc) LOOP
 IF jsonb_typeof(n_section.value)='array' THEN
 n_rows:='[]'::jsonb;
 FOR n_row IN SELECT value FROM jsonb_array_elements(n_section.value) LOOP
 FOR n_field IN SELECT key,value FROM jsonb_each(n_row) LOOP
 n_value:=n_field.value;
 IF jsonb_typeof(n_value)='string' THEN
 n_value:=to_jsonb(replace(n_value#>>'{}',E'\r\n',E'\n'));
 IF n_field.key IN ('acl','roles') AND (n_value#>>'{}') ~ '^\{[^{}]*\}$' THEN
 SELECT to_jsonb('{'||coalesce(string_agg(v,',' ORDER BY v COLLATE "C"),'')||'}') INTO n_value
 FROM unnest(string_to_array(trim(both '{}' FROM n_value#>>'{}'),',')) v WHERE v<>'';
 END IF;
 ELSIF jsonb_typeof(n_value)='array' AND n_field.key IN ('config','options','allowed_mime_types') THEN
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_value FROM jsonb_array_elements(n_value);
 END IF;
 n_row:=jsonb_set(n_row,ARRAY[n_field.key],n_value);
 END LOOP;
 n_rows:=n_rows||jsonb_build_array(n_row);
 END LOOP;
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_rows FROM jsonb_array_elements(n_rows);
 n_doc:=jsonb_set(n_doc,ARRAY[n_section.key],n_rows);
 END IF;
 END LOOP;
 IF n_i=0 THEN actual:=n_doc; ELSE expected:=n_doc; END IF;
 END LOOP;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'GATE3_SYNTHETIC_BASELINE_DRIFT_REFUSED' USING ERRCODE='P0001'; END IF; END $catalog_guard$;
DO $data$ DECLARE counts jsonb; BEGIN SELECT result INTO counts FROM (-- Aggregate-only. No patient/clinic identifiers, contents, emails, tokens or invitations are returned/read.
-- Run first on synthetic baseline. READ ONLY wrapper is provided by the caller.
SELECT jsonb_build_object(
 'patients_without_clinic',(SELECT count(*) FROM public.patients WHERE clinic_id IS NULL),
 'appointments_without_clinic',(SELECT count(*) FROM public.appointments WHERE clinic_id IS NULL),
 'prescriptions_without_clinic',(SELECT count(*) FROM public.prescriptions WHERE clinic_id IS NULL),
 'hcu_without_clinic',(SELECT count(*) FROM public.hcu033_forms WHERE clinic_id IS NULL),
 'billings_without_clinic',(SELECT count(*) FROM public.billings WHERE clinic_id IS NULL),
 'invoices_without_clinic',(SELECT count(*) FROM public.invoices WHERE clinic_id IS NULL),
 'family_links_across_clinics',(SELECT count(*) FROM public.patients c JOIN public.patients p ON p.id=c.family_representative_id WHERE p.clinic_id IS DISTINCT FROM c.clinic_id),
 'family_links_orphan',(SELECT count(*) FROM public.patients c LEFT JOIN public.patients p ON p.id=c.family_representative_id WHERE c.family_representative_id IS NOT NULL AND p.id IS NULL),
 'duplicate_memberships',(SELECT count(*) FROM (SELECT 1 FROM public.clinic_members GROUP BY user_id,clinic_id HAVING count(*)>1) duplicates),
 'appointments_invalid_interval',(SELECT count(*) FROM public.appointments WHERE start_time IS NULL OR end_time IS NULL OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR end_time-start_time<interval '5 minutes' OR end_time-start_time>interval '8 hours'),
 'appointments_invalid_status',(SELECT count(*) FROM public.appointments WHERE status IS NULL OR status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show')),
 'appointments_active_without_doctor',(SELECT count(*) FROM public.appointments WHERE deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived') AND doctor_id IS NULL),
 'appointments_overlap_pairs',(SELECT count(*) FROM public.appointments a JOIN public.appointments b ON a.id<b.id AND a.clinic_id=b.clinic_id AND a.doctor_id=b.doctor_id AND a.start_time<b.end_time AND b.start_time<a.end_time WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.status IN ('scheduled','confirmed','arrived') AND b.status IN ('scheduled','confirmed','arrived')),
 'services_cross_clinic_category',(SELECT count(*) FROM public.services s JOIN public.service_categories c ON c.id=s.category_id WHERE c.clinic_id IS DISTINCT FROM s.clinic_id),
 'appointments_patient_tenant',(SELECT count(*) FROM public.appointments c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'prescriptions_patient_tenant',(SELECT count(*) FROM public.prescriptions c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'clinical_records_patient_tenant',(SELECT count(*) FROM public.clinical_records c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'patient_notes_patient_tenant',(SELECT count(*) FROM public.patient_notes c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'patient_files_patient_tenant',(SELECT count(*) FROM public.patient_files c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'hcu_patient_tenant',(SELECT count(*) FROM public.hcu033_forms c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'rights_patient_tenant',(SELECT count(*) FROM public.data_rights_requests c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'billings_patient_tenant',(SELECT count(*) FROM public.billings c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'invoices_patient_tenant',(SELECT count(*) FROM public.invoices c LEFT JOIN public.patients p ON p.id=c.patient_id AND p.clinic_id=c.clinic_id WHERE c.patient_id IS NOT NULL AND p.id IS NULL),
 'appointments_clinician',(SELECT count(*) FROM public.appointments c WHERE c.doctor_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.profiles p WHERE p.id=c.doctor_id AND p.status::text='active' AND (EXISTS(SELECT FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id=c.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner')) OR EXISTS(SELECT FROM public.clinics k WHERE k.id=c.clinic_id AND k.owner_id=p.id)))),
 'prescriptions_clinician',(SELECT count(*) FROM public.prescriptions c WHERE c.doctor_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.profiles p WHERE p.id=c.doctor_id AND p.status::text='active' AND (EXISTS(SELECT FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id=c.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner')) OR EXISTS(SELECT FROM public.clinics k WHERE k.id=c.clinic_id AND k.owner_id=p.id)))),
 'clinical_records_clinician',(SELECT count(*) FROM public.clinical_records c WHERE c.doctor_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.profiles p WHERE p.id=c.doctor_id AND p.status::text='active' AND (EXISTS(SELECT FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id=c.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner')) OR EXISTS(SELECT FROM public.clinics k WHERE k.id=c.clinic_id AND k.owner_id=p.id)))),
 'hcu_clinician',(SELECT count(*) FROM public.hcu033_forms c WHERE c.doctor_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.profiles p WHERE p.id=c.doctor_id AND p.status::text='active' AND (EXISTS(SELECT FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id=c.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner')) OR EXISTS(SELECT FROM public.clinics k WHERE k.id=c.clinic_id AND k.owner_id=p.id))))
) AS result) c; IF EXISTS(SELECT FROM jsonb_each_text(counts) a WHERE a.value::bigint<>0) OR (SELECT count(*) FROM public.patients)<>2 OR (SELECT count(*) FROM public.services)<>1 OR (SELECT count(*) FROM auth.users)<>2 OR (SELECT count(*) FROM auth.mfa_factors WHERE status='verified')<>2 OR (SELECT count(*) FROM storage.buckets WHERE NOT public)<>4 OR EXISTS(SELECT FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'GATE3_SYNTHETIC_OCCUPIED_DATA_REFUSED'; END IF; END $data$;
-- Only scenario A: fixed known synthetic identities; no real data acceptance.
DO $known_fixture$ BEGIN
 IF (SELECT count(*) FROM auth.users WHERE
  (id='88888888-aaaa-4aaa-8aaa-000000000001' AND email='gate3-known-1@example.invalid') OR
  (id='88888888-aaaa-4aaa-8aaa-000000000002' AND email='gate3-known-2@example.invalid'))<>2
 OR EXISTS(SELECT FROM public.profiles p WHERE p.role::text<>'clinic_owner' OR p.status<>'active' OR
  NOT ((p.id='88888888-aaaa-4aaa-8aaa-000000000001' AND p.clinic_id='88888888-1111-4111-8111-111111111111') OR
       (p.id='88888888-aaaa-4aaa-8aaa-000000000002' AND p.clinic_id='88888888-1111-4111-8111-111111111112')))
 OR (SELECT count(*) FROM public.clinics WHERE
  (id='88888888-1111-4111-8111-111111111111' AND owner_id='88888888-aaaa-4aaa-8aaa-000000000001' AND name='Synthetic Gate3 A') OR
  (id='88888888-1111-4111-8111-111111111112' AND owner_id='88888888-aaaa-4aaa-8aaa-000000000002' AND name='Synthetic Gate3 B'))<>2
 OR (SELECT count(*) FROM public.patients WHERE
  (id='88888888-2222-4222-8222-222222222222' AND clinic_id='88888888-1111-4111-8111-111111111111' AND first_name='Synthetic' AND last_name='Before M7 A') OR
  (id='88888888-2222-4222-8222-222222222223' AND clinic_id='88888888-1111-4111-8111-111111111112' AND first_name='Synthetic' AND last_name='Before M7 B'))<>2
 OR NOT EXISTS(SELECT FROM public.services WHERE id='88888888-3333-4333-8333-333333333333' AND clinic_id='88888888-1111-4111-8111-111111111111' AND name='Synthetic exact numeric boundary' AND price=99999999.99)
 OR EXISTS(SELECT FROM storage.buckets WHERE public OR id NOT IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars'))
 OR (SELECT count(*) FROM auth.mfa_factors WHERE status='verified' AND user_id IN ('88888888-aaaa-4aaa-8aaa-000000000001','88888888-aaaa-4aaa-8aaa-000000000002'))<>2
 THEN RAISE EXCEPTION 'GATE3_KNOWN_FIXTURE_CONTENT_REFUSED'; END IF;
END $known_fixture$;

-- PINNED REFERENCE: supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql
-- Apply only after staging verification. Existing inconsistent rows require clinical review.


-- A composite key prevents a child in one clinic from linking another clinic's patient.
ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.prescriptions ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.hcu033_forms ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.billings ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patients ADD CONSTRAINT patients_id_clinic_id_key UNIQUE (id, clinic_id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_patient_clinic_fkey;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.prescriptions VALIDATE CONSTRAINT prescriptions_patient_clinic_fkey;
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey;

ALTER TABLE public.clinical_records ADD CONSTRAINT clinical_records_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.clinical_records VALIDATE CONSTRAINT clinical_records_patient_clinic_fkey;
ALTER TABLE public.clinical_records DROP CONSTRAINT IF EXISTS clinical_records_patient_id_fkey;

ALTER TABLE public.patient_notes ADD CONSTRAINT patient_notes_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.patient_notes VALIDATE CONSTRAINT patient_notes_patient_clinic_fkey;
ALTER TABLE public.patient_notes DROP CONSTRAINT IF EXISTS patient_notes_patient_id_fkey;

ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.patient_files VALIDATE CONSTRAINT patient_files_patient_clinic_fkey;
ALTER TABLE public.patient_files DROP CONSTRAINT IF EXISTS patient_files_patient_id_fkey;

ALTER TABLE public.hcu033_forms ADD CONSTRAINT hcu033_forms_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.hcu033_forms VALIDATE CONSTRAINT hcu033_forms_patient_clinic_fkey;
ALTER TABLE public.hcu033_forms DROP CONSTRAINT IF EXISTS hcu033_forms_patient_id_fkey;

ALTER TABLE public.data_rights_requests ADD CONSTRAINT data_rights_requests_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE SET NULL (patient_id) NOT VALID;
ALTER TABLE public.data_rights_requests VALIDATE CONSTRAINT data_rights_requests_patient_clinic_fkey;
ALTER TABLE public.data_rights_requests DROP CONSTRAINT IF EXISTS data_rights_requests_patient_id_fkey;

-- Finance rows also carry patient identifiers. Keep their existing NO ACTION delete semantics.
ALTER TABLE public.billings ADD CONSTRAINT billings_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.billings VALIDATE CONSTRAINT billings_patient_clinic_fkey;
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_patient_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_patient_clinic_fkey;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_patient_id_fkey;

-- Support tenant-scoped clinical reads and parent-key checks as the SaaS grows.
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON public.appointments(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient ON public.prescriptions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient ON public.clinical_records(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic_patient ON public.patient_notes(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_clinic_patient ON public.patient_files(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_clinic_patient ON public.data_rights_requests(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_billings_clinic_patient ON public.billings(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_patient ON public.invoices(clinic_id, patient_id);

-- This legacy marketing table exists in some clean-install histories, but not the connected project.
DO $$
BEGIN
  IF to_regclass('public.loyalty_communications') IS NOT NULL THEN
    ALTER TABLE public.loyalty_communications ADD CONSTRAINT loyalty_communications_patient_clinic_fkey
      FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) NOT VALID;
    ALTER TABLE public.loyalty_communications VALIDATE CONSTRAINT loyalty_communications_patient_clinic_fkey;
    ALTER TABLE public.loyalty_communications DROP CONSTRAINT IF EXISTS loyalty_communications_patient_id_fkey;
  END IF;
END;
$$;

-- Patient-family links must also remain inside one clinic.
ALTER TABLE public.patients ADD CONSTRAINT patients_family_clinic_fkey
  FOREIGN KEY (family_representative_id, clinic_id)
  REFERENCES public.patients(id, clinic_id)
  ON DELETE SET NULL (family_representative_id) NOT VALID;
ALTER TABLE public.patients VALIDATE CONSTRAINT patients_family_clinic_fkey;

-- Assigning a doctor requires a current, active clinical role in the same clinic.
CREATE SCHEMA IF NOT EXISTS security_internal;
REVOKE ALL ON SCHEMA security_internal FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.doctor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.clinic_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.doctor_id AND p.status::text = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM public.clinic_members m
          WHERE m.user_id = p.id AND m.clinic_id = NEW.clinic_id
            AND m.status = 'active' AND m.role IN ('doctor', 'clinic_owner')
        )
        OR EXISTS (
          SELECT 1 FROM public.clinics c
          WHERE c.id = NEW.clinic_id AND c.owner_id = p.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Assigned clinician is not active in this clinic'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION security_internal.enforce_clinician_assignment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.appointments;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.prescriptions;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.clinical_records;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.clinical_records FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.hcu033_forms;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();

-- Rights requests: client submissions start pending and existing owner resolutions remain supported.
ALTER TABLE public.data_rights_requests ADD COLUMN IF NOT EXISTS resolution_notes text;
REVOKE INSERT, UPDATE, DELETE ON logs.access_audit FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests;
CREATE POLICY "Clinic members can view data rights requests"
  ON public.data_rights_requests FOR SELECT TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND (user_id = auth.uid() OR public.get_clinic_member_role(clinic_id) = 'clinic_owner')
  );
CREATE POLICY "Authenticated users can submit data rights requests"
  ON public.data_rights_requests FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND user_id = auth.uid()
    AND status = 'pending'
    AND resolved_by IS NULL AND resolved_at IS NULL
    AND resolution_notes IS NULL
  );
CREATE POLICY "Clinic owners can update data rights requests"
  ON public.data_rights_requests FOR UPDATE TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  )
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  );

CREATE OR REPLACE FUNCTION public.guard_data_rights_request_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL
    OR NEW.user_id IS DISTINCT FROM auth.uid()
    OR NOT public.is_clinic_member(NEW.clinic_id)
    OR NEW.status <> 'pending'
    OR NEW.resolved_by IS NOT NULL OR NEW.resolved_at IS NOT NULL
    OR NEW.resolution_notes IS NOT NULL
  THEN
    RAISE EXCEPTION 'Rights requests must start pending for the authenticated clinic member'
      USING ERRCODE = '42501';
  END IF;
  NEW.requested_by_email := auth.jwt() ->> 'email';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_data_rights_request_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_data_rights_request_insert ON public.data_rights_requests;
CREATE TRIGGER trg_guard_data_rights_request_insert
  BEFORE INSERT ON public.data_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_data_rights_request_insert();

CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL
    OR public.get_clinic_member_role(OLD.clinic_id) IS DISTINCT FROM 'clinic_owner'
  THEN
    RAISE EXCEPTION 'Only an active clinic owner may resolve rights requests'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.request_type IS DISTINCT FROM OLD.request_type
    OR NEW.details IS DISTINCT FROM OLD.details
    OR NEW.legal_basis IS DISTINCT FROM OLD.legal_basis
    OR NEW.retention_note IS DISTINCT FROM OLD.retention_note
    OR NEW.requested_by_email IS DISTINCT FROM OLD.requested_by_email
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Original rights-request evidence is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('completed', 'rejected', 'archived_custody') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes
      OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
      OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
    THEN
      RAISE EXCEPTION 'Resolved rights requests are immutable'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
    OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
  THEN
    RAISE EXCEPTION 'Resolver fields are server controlled'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IN ('completed', 'rejected', 'archived_custody')
    AND OLD.status NOT IN ('completed', 'rejected', 'archived_custody')
  THEN
    IF NEW.resolution_notes IS NULL OR btrim(NEW.resolution_notes) = '' THEN
      RAISE EXCEPTION 'Resolution requires a documented outcome or evidence reference'
        USING ERRCODE = '23514';
    END IF;
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_data_rights_requests() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_data_requests_immutability ON public.data_rights_requests;
DROP TRIGGER IF EXISTS trg_protect_data_rights_requests ON public.data_rights_requests;
CREATE TRIGGER trg_protect_data_rights_requests
  BEFORE UPDATE ON public.data_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_data_rights_requests();

CREATE OR REPLACE FUNCTION security_internal.audit_data_rights_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO logs.access_audit (
    actor_id, actor_role, action, table_name, record_id, clinic_id, metadata
  ) VALUES (
    auth.uid(),
    CASE WHEN auth.role() = 'service_role' THEN 'service_role'
      ELSE COALESCE(public.get_clinic_member_role(NEW.clinic_id), 'unknown') END,
    'UPDATE_STATUS', 'data_rights_requests', NEW.id, NEW.clinic_id,
    jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
  );
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION security_internal.audit_data_rights_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_audit_data_rights_status ON public.data_rights_requests;
CREATE TRIGGER trg_audit_data_rights_status
  AFTER UPDATE OF status ON public.data_rights_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION security_internal.audit_data_rights_status();

-- Audit actions and identifiers without copying entire clinical rows into logs.
CREATE OR REPLACE FUNCTION logs.log_access_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row_id uuid;
  v_clinic_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := OLD.id;
    v_clinic_id := OLD.clinic_id;
  ELSE
    v_row_id := NEW.id;
    v_clinic_id := NEW.clinic_id;
  END IF;
  INSERT INTO logs.access_audit (
    actor_id, actor_role, action, table_name, record_id, clinic_id, metadata
  ) VALUES (
    auth.uid(),
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', auth.role()),
    TG_OP, TG_TABLE_NAME, v_row_id, v_clinic_id,
    jsonb_build_object('operation', TG_OP)
  );
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION logs.log_access_trigger() FROM PUBLIC, anon, authenticated;

-- A 90-day archive age does not establish that medical or rights evidence may be destroyed.
-- Fail closed until a record-specific retention decision and verified export/deletion workflow exist.
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_archived_at timestamptz;
  v_status text;
BEGIN
  SELECT c.subscription_status, c.archived_at
    INTO v_status, v_archived_at
    FROM public.clinics c WHERE c.id = target_clinic_id FOR UPDATE;
  IF NOT FOUND OR v_status IS DISTINCT FROM 'archived' OR v_archived_at IS NULL
    OR v_archived_at > now() - interval '90 days'
  THEN
    RAISE EXCEPTION 'Clinic is not eligible for purge' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.patients p WHERE p.clinic_id = target_clinic_id)
    OR EXISTS (SELECT 1 FROM public.data_rights_requests r WHERE r.clinic_id = target_clinic_id)
    OR EXISTS (SELECT 1 FROM logs.access_audit a WHERE a.clinic_id = target_clinic_id)
  THEN
    RAISE EXCEPTION 'Clinical or rights evidence requires a documented retention review before purge'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.clinics c WHERE c.id = target_clinic_id;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_clinic_data(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Least-Privilege Clinical RLS (M7-BLK-04)
-- Restrict direct SELECT access on sensitive diagnostic and clinical charting tables
-- (clinical_records, hcu033_forms, patient_notes, patient_files) to doctors and clinic owners.
-- Receptionists and administrative staff are restricted to demographic, appointment,
-- and billing access (receptionist_patient_view, patients, appointments, billings).
-- ============================================================================

-- 1. Clinical Records: Narrow SELECT to doctors and clinic owners
DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;
CREATE POLICY "Medical staff can view clinical records"
ON public.clinical_records FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

-- 2. HCU-033 Forms: Narrow SELECT to doctors and clinic owners
DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can view hcu033_forms" ON public.hcu033_forms;
CREATE POLICY "Clinical staff can view hcu033_forms"
ON public.hcu033_forms FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

-- 3. Patient Notes: Narrow SELECT, INSERT, UPDATE to clinical roles
DROP POLICY IF EXISTS "Users can view notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can insert notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can update notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can view patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can insert patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can update patient notes" ON public.patient_notes;

CREATE POLICY "Clinical staff can view patient notes"
ON public.patient_notes FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Clinical staff can insert patient notes"
ON public.patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can update patient notes"
ON public.patient_notes FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND author_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

-- 4. Patient Files: Narrow SELECT, INSERT, UPDATE to clinical roles
DROP POLICY IF EXISTS "Users can view files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can insert files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can update files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can view patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can insert patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can update patient files" ON public.patient_files;

CREATE POLICY "Clinical staff can view patient files"
ON public.patient_files FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Clinical staff can insert patient files"
ON public.patient_files FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can update patient files"
ON public.patient_files FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND uploaded_by = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

-- 5. Hardened Storage Bucket 'patient-files' RLS for Clinical Staff
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;

CREATE POLICY "Tenant isolated read for patient-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'doctor')
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated upload for patient-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'doctor')
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);



-- PINNED REFERENCE: docs/production/reconciliation/operational-convergence/before-authority.sql
-- Generated OFFLINE from reviewed captures; LOCAL SYNTHETIC ONLY. Not a remote migration.
-- Read operational-convergence/README.md. Apply after M7, before encargo02.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
DO $local$ BEGIN
IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed postgres executor required'; END IF;
IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed M7 prerequisites required'; END IF;
IF EXISTS(SELECT 1 FROM public.clinics WHERE length(size)>50) THEN RAISE EXCEPTION 'Clinic size exceeds reviewed typmod; reconcile without truncation'; END IF;
END $local$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='appointments_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.appointments.appointments_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."appointments" WHERE NOT (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.appointments.appointments_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_status_check" CHECK (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_clinic_id_email_status_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (clinic_id, email, status)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_clinic_id_email_status_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE "clinic_id" IS NOT NULL AND "email" IS NOT NULL AND "status" IS NOT NULL GROUP BY clinic_id, email, status HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_invitations.clinic_invitations_clinic_id_email_status_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_email_status_key" UNIQUE (clinic_id, email, status)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."clinic_invitations" DROP CONSTRAINT "clinic_invitations_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_role_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_role_check'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE NOT (role = ANY (ARRAY['doctor'::text, 'receptionist'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.clinic_invitations.clinic_invitations_role_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_role_check" CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE NOT (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.clinic_invitations.clinic_invitations_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_status_check" CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_token_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (token)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_token_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE "token" IS NOT NULL GROUP BY token HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_invitations.clinic_invitations_token_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_token_key" UNIQUE (token)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_members'::regclass AND conname='clinic_members_user_id_clinic_id_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (user_id, clinic_id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_members.clinic_members_user_id_clinic_id_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_members" WHERE "user_id" IS NOT NULL AND "clinic_id" IS NOT NULL GROUP BY user_id, clinic_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_members.clinic_members_user_id_clinic_id_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_members" ADD CONSTRAINT "clinic_members_user_id_clinic_id_key" UNIQUE (user_id, clinic_id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_request_type_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_request_type_check'; END IF;
IF EXISTS(SELECT 1 FROM public."data_rights_requests" WHERE NOT (request_type = ANY (ARRAY['portability'::text, 'deletion'::text, 'rectification'::text, 'access'::text, 'opposition'::text, 'custody_lock'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.data_rights_requests.data_rights_requests_request_type_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_request_type_check" CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_resolved_by_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL','FOREIGN KEY (resolved_by) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_resolved_by_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (resolved_by) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_resolved_by_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."data_rights_requests" WHERE NOT (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'archived_custody'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.data_rights_requests.data_rights_requests_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_status_check" CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_user_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL','FOREIGN KEY (user_id) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_user_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (user_id) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_user_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname='notifications_type_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.notifications.notifications_type_check'; END IF;
IF EXISTS(SELECT 1 FROM public."notifications" WHERE NOT (type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.notifications.notifications_type_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_files'::regclass AND conname='patient_files_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_files.patient_files_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."patient_files" DROP CONSTRAINT "patient_files_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_files" ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_files'::regclass AND conname='patient_files_uploaded_by_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (uploaded_by) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_files.patient_files_uploaded_by_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (uploaded_by) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."patient_files" DROP CONSTRAINT "patient_files_uploaded_by_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_files" ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_notes'::regclass AND conname='patient_notes_author_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (author_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_notes.patient_notes_author_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (author_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."patient_notes" DROP CONSTRAINT "patient_notes_author_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_notes'::regclass AND conname='patient_notes_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_notes.patient_notes_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."patient_notes" DROP CONSTRAINT "patient_notes_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_cedula_clinic_unique';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (cedula, clinic_id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patients.patients_cedula_clinic_unique'; END IF;
IF EXISTS(SELECT 1 FROM public."patients" WHERE "cedula" IS NOT NULL AND "clinic_id" IS NOT NULL GROUP BY cedula, clinic_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.patients.patients_cedula_clinic_unique'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patients" ADD CONSTRAINT "patients_cedula_clinic_unique" UNIQUE (cedula, clinic_id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescription_templates'::regclass AND conname='prescription_templates_clinic_id_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (clinic_id IS NOT NULL)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescription_templates.prescription_templates_clinic_id_check'; END IF;
IF EXISTS(SELECT 1 FROM public."prescription_templates" WHERE NOT (clinic_id IS NOT NULL)) THEN RAISE EXCEPTION 'Invalid values require review: public.prescription_templates.prescription_templates_clinic_id_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescription_templates" ADD CONSTRAINT "prescription_templates_clinic_id_check" CHECK (clinic_id IS NOT NULL)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescription_templates'::regclass AND conname='prescription_templates_doctor_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (doctor_id) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescription_templates.prescription_templates_doctor_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (doctor_id) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."prescription_templates" DROP CONSTRAINT "prescription_templates_doctor_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescription_templates" ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescriptions'::regclass AND conname='prescriptions_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescriptions.prescriptions_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."prescriptions" DROP CONSTRAINT "prescriptions_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescriptions'::regclass AND conname='prescriptions_doctor_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (doctor_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescriptions.prescriptions_doctor_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (doctor_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."prescriptions" DROP CONSTRAINT "prescriptions_doctor_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.profile_audit_log'::regclass AND conname='profile_audit_log_target_user_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE','FOREIGN KEY (target_user_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.profile_audit_log.profile_audit_log_target_user_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (target_user_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."profile_audit_log" DROP CONSTRAINT "profile_audit_log_target_user_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."profile_audit_log" ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.service_categories'::regclass AND conname='service_categories_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.service_categories.service_categories_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."service_categories" DROP CONSTRAINT "service_categories_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."service_categories" ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.service_categories'::regclass AND conname='service_categories_clinic_id_name_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (clinic_id, name)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.service_categories.service_categories_clinic_id_name_key'; END IF;
IF EXISTS(SELECT 1 FROM public."service_categories" WHERE "clinic_id" IS NOT NULL AND "name" IS NOT NULL GROUP BY clinic_id, name HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.service_categories.service_categories_clinic_id_name_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."service_categories" ADD CONSTRAINT "service_categories_clinic_id_name_key" UNIQUE (clinic_id, name)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_category_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL','FOREIGN KEY (category_id) REFERENCES service_categories(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.services.services_category_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (category_id) REFERENCES service_categories(id)' THEN EXECUTE 'ALTER TABLE public."services" DROP CONSTRAINT "services_category_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES service_categories(id)'; END IF;
END $constraint$;
ALTER TABLE public.clinics ALTER COLUMN size TYPE varchar(50);
ALTER SEQUENCE public.profile_audit_log_id_seq OWNED BY public.profile_audit_log.id;
CREATE INDEX IF NOT EXISTS idx_access_audit_clinic_id ON logs.access_audit USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_email ON public.clinic_invitations USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_status ON public.clinic_invitations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_clinic_members_auth_lookup ON public.clinic_members USING btree (user_id, clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_id ON public.clinical_records USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_tenant ON public.data_rights_requests USING btree (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_type ON public.data_rights_requests USING btree (clinic_id, request_type);
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_clinic_id ON public.hcu033_forms USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_tenant_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_patient ON public.patient_files USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON public.patient_notes USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_deleted ON public.patients USING btree (clinic_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_patients_family_rep ON public.patients USING btree (family_representative_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_doctor ON public.prescriptions USING btree (clinic_id, doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles USING btree (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles USING btree (email) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_license_key ON public.profiles USING btree (license_number) WHERE (license_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON public.appointments USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start ON public.appointments USING btree (clinic_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_conflict ON public.appointments USING btree (clinic_id, doctor_id, start_time, end_time) WHERE (status <> 'cancelled'::text);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_doctor ON public.appointments USING btree (clinic_id, patient_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient ON public.clinical_records USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_clinic_patient ON public.data_rights_requests USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_hcu033_clinic_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_clinic_patient ON public.patient_files USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic_patient ON public.patient_notes USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_cedula ON public.patients USING btree (clinic_id, cedula);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_created ON public.prescriptions USING btree (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient ON public.prescriptions USING btree (clinic_id, patient_id);


-- PINNED REFERENCE: docs/production/reconciliation/encargo02/forward.sql
-- REVIEWABLE LOCAL SYNTHETIC FORWARD ONLY. NOT a deployable migration; M7 NOT READY.
-- Read README five questions / acceptance BEFORE execution. No data copies or deletes.
-- Executor must independently prove loopback Docker identity; GUCs do not prove locality.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = '';

DO $preflight$
DECLARE v_table text; v_constraint text; r record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'Reviewed postgres executor required; reconcile ownership in encargo01';
  END IF;
  -- Target/baseline/recovery authorization is checked atomically by hosted-v2 executor.
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Genuine Supabase PostgreSQL17 Auth/Storage required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass AND attname='owner_id' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'Managed Storage owner_id contract absent; review runtime version'; END IF;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','patient_notes','patient_files','hcu033_forms','data_rights_requests','billings','invoices'] LOOP
    v_constraint := v_table || '_patient_clinic_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=to_regclass('public.'||v_table) AND conname=v_constraint AND convalidated AND contype='f'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='patient_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='clinic_id')]::smallint[]
      AND confrelid='public.patients'::regclass
      AND confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='clinic_id')]::smallint[])
    THEN RAISE EXCEPTION 'Validated M7 patient/clinic constraint required on %',v_table; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_id_clinic_id_key' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_family_clinic_fkey' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.clinic_members'::regclass AND contype='u' AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='user_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='clinic_id')]::smallint[])
  THEN RAISE EXCEPTION 'M7 family/parent key and unique membership prerequisites required'; END IF;
  IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_audit_data_rights_status' AND tgenabled='O')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_protect_data_rights_requests' AND tgenabled='O')
  THEN RAISE EXCEPTION 'M7 rights protection/status audit required'; END IF;
  -- Captured M7 callbacks must match BEFORE replacement. Do not silently re-own
  -- supabase_admin-created helpers: encargo01 must reconcile that explicitly.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Application callback owner drift; reconcile explicitly in encargo01'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('logs.log_access_trigger()','a28f2f2bbb746e80661dc2f7a5275c9f'),
    ('public.guard_data_rights_request_insert()','88e654c014bc9969fe94c3580d558503'),
    ('public.protect_data_rights_requests()','fe0ff58b269ecb6cc3462e5ab73ffe59'),
    ('public.purge_clinic_data(uuid)','49eab5876aeb4502a69adc3804c35945'),
    ('security_internal.audit_data_rights_status()','043465d08eb08c1752562f09cafe048c'),
    ('security_internal.enforce_clinician_assignment()','87184b33612e86bfcc8c153db1449307')
  ) AS expected(identity,body_md5) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(r.identity)
      AND md5(replace(p.prosrc,E'\r\n',E'\n'))=r.body_md5
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      AND p.proconfig @> ARRAY['search_path=""']::text[])
    THEN RAISE EXCEPTION 'Captured M7 callback differs: %; reconcile in encargo01',r.identity; END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','hcu033_forms'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=to_regclass('public.'||v_table)
      AND t.tgname='trg_enforce_clinician_assignment' AND t.tgenabled='O' AND t.tgtype=23
      AND t.tgfoid=to_regprocedure('security_internal.enforce_clinician_assignment()') AND NOT t.tgisinternal
      AND t.tgattr::text=(SELECT a.attnum::text||' '||b.attnum::text FROM pg_catalog.pg_attribute a,pg_catalog.pg_attribute b
        WHERE a.attrelid=t.tgrelid AND b.attrelid=t.tgrelid AND a.attname='doctor_id' AND b.attname='clinic_id'))
    THEN RAISE EXCEPTION 'Exact enabled M7 clinician trigger required on %',v_table; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('trg_guard_data_rights_request_insert','public.guard_data_rights_request_insert()',7),
    ('trg_protect_data_rights_requests','public.protect_data_rights_requests()',19),
    ('trg_audit_data_rights_status','security_internal.audit_data_rights_status()',17)
  ) AS expected(name,identity,flags) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.data_rights_requests'::regclass
      AND t.tgname=r.name AND t.tgenabled='O' AND t.tgfoid=to_regprocedure(r.identity) AND t.tgtype=r.flags AND NOT t.tgisinternal)
    THEN RAISE EXCEPTION 'Exact enabled M7 rights callback required: %',r.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.clinic_members GROUP BY user_id,clinic_id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate memberships require explicit review'; END IF;
  -- Provision these empty synthetic buckets through the genuine Storage API before SQL.
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND NOT public)<>4
    OR EXISTS (SELECT 1 FROM storage.buckets WHERE public)
  THEN RAISE EXCEPTION 'All local buckets must be private; required four buckets provisioned via API'; END IF;
END;
$preflight$;

-- Neutralize observed global/schema defaults and all inherited application client grants.
-- Column privileges are independent: revoke them too before granting explicit columns.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SCHEMA logs,security_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON TYPE public.app_role,public.user_status TO authenticated;
-- subscription_status keeps existing default ACL; no redundant grant.
DO $close$
DECLARE r record; v_columns text;
BEGIN
  FOR r IN SELECT n.nspname,c.relname,c.relkind,c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S') LOOP
    IF r.relkind='S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      EXECUTE format('GRANT ALL ON SEQUENCE %I.%I TO service_role',r.nspname,r.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns FROM pg_catalog.pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
      IF v_columns IS NOT NULL THEN EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE %I.%I FROM PUBLIC,anon,authenticated',v_columns,v_columns,v_columns,v_columns,r.nspname,r.relname); END IF;
      IF r.relkind IN ('r','p') THEN
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.nspname,r.relname);
        EXECUTE format('GRANT ALL ON TABLE %I.%I TO service_role',r.nspname,r.relname);
      END IF;
      IF r.relkind='v' THEN EXECUTE format('ALTER VIEW %I.%I SET (security_invoker=true)',r.nspname,r.relname); END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.nspname,r.proname,r.args);
  END LOOP;
  -- Remove every captured policy in owned app scope, not only known naming variants.
  -- Recreate only accepted grants/policies below. Storage is synthetic project scope.
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies WHERE schemaname IN ('public','logs','security_internal') OR (schemaname='storage' AND tablename='objects') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
  END LOOP;
END;
$close$;

-- Auth callbacks never convert editable signup metadata into tenant authority.
-- Both baseline variants receive a profile-only insert callback. Onboarding and
-- invitation acceptance need their own reviewed server contract in encargo10B.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  INSERT INTO public.profiles(id,full_name,email,status)
  VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),120),NEW.email,'active'::public.user_status)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  -- Preserve the Auth row; no profile role, clinic, membership or invitation write.
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user(),public.handle_verified_clinic_creation() FROM PUBLIC,anon,authenticated,service_role;

-- Private role lookup accepts a target user ONLY for trusted clinician-assignment code.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_clinic_member_role(check_clinic_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    THEN security_internal.role_for(check_clinic_id,auth.uid()) END;
$function$;
CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT public.get_clinic_member_role(check_clinic_id) IS NOT NULL; $function$;
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  -- Deterministic preference, never authorization. No stale JWT or primary-profile fallback.
  SELECT m.clinic_id FROM public.clinic_members m
  WHERE m.user_id=auth.uid() AND public.is_clinic_member(m.clinic_id)
  ORDER BY m.created_at,m.clinic_id LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.is_clinic_member(check_clinic_id) AND EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.id=check_clinic_id AND c.archived_at IS NULL
      AND (c.bypass_subscription IS TRUE OR c.subscription_status::text='active' OR c.trial_ends_at>now()));
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    -- A committed revocation precedes denial of the next operation; writes already
    -- authorized hold these rows until completion, so revocation cannot race the write.
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Explicit demographic projection. No full-row to_jsonb(patient) return.
CREATE OR REPLACE FUNCTION security_internal.patient_demographic(p public.patients)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',p.id,'clinic_id',p.clinic_id,'first_name',p.first_name,'last_name',p.last_name,
    'cedula',p.cedula,'email',p.email,'phone',p.phone,'address',p.address,'city',p.city,'state',p.state,
    'birth_date',p.birth_date,'gender',p.gender,'status',p.status,'occupation',p.occupation,
    'guardian_name',p.guardian_name,'medical_record_number',p.medical_record_number,
    'emergency_contact',p.emergency_contact,'emergency_phone',p.emergency_phone,'marital_status',p.marital_status,
    'preferred_contact_method',p.preferred_contact_method,'avatar_url',p.avatar_url,
    'family_representative_id',p.family_representative_id,'family_relationship',p.family_relationship,
    'is_family_head',p.is_family_head,'created_at',p.created_at,'updated_at',p.updated_at);
$function$;
REVOKE ALL ON FUNCTION security_internal.patient_demographic(public.patients) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_patient_demographics(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 25,p_offset integer DEFAULT 0,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
      AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),
    'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_patient_demographics(p_clinic_id uuid,p_data jsonb,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.patients; v_input public.patients; v_key text; v_value jsonb;
  v_allowed constant text[]:=ARRAY['first_name','last_name','cedula','email','phone','address','city','state','birth_date','gender','status','occupation','guardian_name','medical_record_number','emergency_contact','emergency_phone','marital_status','preferred_contact_method'];
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>12000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF NOT(v_key=ANY(v_allowed)) OR jsonb_typeof(v_value) NOT IN ('string','null') OR length(p_data->>v_key)>500
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (p_data?'first_name' AND coalesce(length(btrim(p_data->>'first_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'last_name' AND coalesce(length(btrim(p_data->>'last_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'status' AND (p_data->>'status' IS NULL OR (p_data->>'status') NOT IN ('active','inactive')))
    OR (p_data?'preferred_contact_method' AND (p_data->>'preferred_contact_method' IS NULL OR (p_data->>'preferred_contact_method') NOT IN ('phone','email','whatsapp')))
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.patients WHERE id=p_patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT(p_data?'first_name' AND p_data?'last_name') THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
    v_row.status:='active'; v_row.preferred_contact_method:='phone';
  END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.birth_date>current_date OR (v_input.birth_date IS NOT NULL AND v_input.birth_date<date '1850-01-01')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NULL THEN
    INSERT INTO public.patients(clinic_id,first_name,last_name,cedula,email,phone,address,city,state,birth_date,gender,status,occupation,guardian_name,medical_record_number,emergency_contact,emergency_phone,marital_status,preferred_contact_method)
    VALUES(p_clinic_id,btrim(v_input.first_name),btrim(v_input.last_name),v_input.cedula,v_input.email,v_input.phone,v_input.address,v_input.city,v_input.state,v_input.birth_date,v_input.gender,v_input.status,v_input.occupation,v_input.guardian_name,v_input.medical_record_number,v_input.emergency_contact,v_input.emergency_phone,v_input.marital_status,v_input.preferred_contact_method) RETURNING * INTO v_row;
  ELSE
    UPDATE public.patients SET first_name=btrim(v_input.first_name),last_name=btrim(v_input.last_name),cedula=v_input.cedula,email=v_input.email,phone=v_input.phone,address=v_input.address,city=v_input.city,state=v_input.state,birth_date=v_input.birth_date,gender=v_input.gender,status=v_input.status,occupation=v_input.occupation,guardian_name=v_input.guardian_name,medical_record_number=v_input.medical_record_number,emergency_contact=v_input.emergency_contact,emergency_phone=v_input.emergency_phone,marital_status=v_input.marital_status,preferred_contact_method=v_input.preferred_contact_method,updated_at=now()
    WHERE id=p_patient_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.patient_demographic(v_row);
EXCEPTION WHEN data_exception OR check_violation OR unique_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_clinic_staff_directory(p_clinic_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'specialization',p.specialization,'avatar_url',p.avatar_url,'role',m.role,'title',p.title) ORDER BY p.full_name,p.id),'[]'::jsonb)
    INTO v_result FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    WHERE m.clinic_id=p_clinic_id AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL AND m.role IN ('doctor','clinic_owner','receptionist');
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION security_internal.appointment_operational(a public.appointments,p_include_notes boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',a.id,'clinic_id',a.clinic_id,'patient_id',a.patient_id,'doctor_id',a.doctor_id,'start_time',a.start_time,'end_time',a.end_time,'status',a.status,'type',a.type,'created_at',a.created_at,
    'patients',(SELECT jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) FROM public.patients p WHERE p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL),
    'profiles',(SELECT jsonb_build_object('id',p.id,'full_name',p.full_name) FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id WHERE p.id=a.doctor_id AND m.clinic_id=a.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL))
    || CASE WHEN p_include_notes THEN jsonb_build_object('notes',a.notes) ELSE '{}'::jsonb END;
$function$;
REVOKE ALL ON FUNCTION security_internal.appointment_operational(public.appointments,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_clinic_schedule(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_result jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR p_end<=p_start OR p_end-p_start>interval '93 days'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  -- Set-based joins, not a paginated patient list and not a per-appointment RPC.
  WITH matched AS MATERIALIZED (
    SELECT a.id,a.clinic_id,a.patient_id,a.doctor_id,a.start_time,a.end_time,a.status,a.type,a.created_at,a.notes,
      jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) AS patients,
      CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'full_name',d.full_name) END AS profiles
    FROM public.appointments a JOIN public.patients p ON p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL
    LEFT JOIN (SELECT pf.id,m.clinic_id,pf.full_name FROM public.profiles pf JOIN public.clinic_members m ON m.user_id=pf.id WHERE pf.status::text='active' AND pf.deleted_at IS NULL AND m.status='active' AND m.role IN ('doctor','clinic_owner')) d ON d.id=a.doctor_id AND d.clinic_id=a.clinic_id
    WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time<p_end AND a.end_time>p_start
  ) SELECT jsonb_build_object('items',coalesce(jsonb_agg((to_jsonb(matched)-'notes')||CASE WHEN v_role IN ('doctor','clinic_owner') THEN jsonb_build_object('notes',notes) ELSE '{}'::jsonb END ORDER BY start_time,id),'[]'::jsonb),'total_count',count(*)) INTO v_result FROM matched;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null')
      OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner'))
      OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000)
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time<=v_input.start_time
    OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','completed','cancelled','no_show')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF v_input.doctor_id IS NOT NULL AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'doctor' AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,v_input.type,v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=v_input.type,status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Exact identity replacement, no CASCADE: unknown dependencies must stop the review.
DROP FUNCTION IF EXISTS public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid);
CREATE FUNCTION public.get_patients_with_stats(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 12,p_offset integer DEFAULT 0,p_time_filter text DEFAULT 'all',p_badge_filter text DEFAULT 'all',p_group_by_family boolean DEFAULT false,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor']);
  -- Historical commercial badges are removed, not simulated with zero revenues.
  IF coalesce(p_time_filter,'all')<>'all' OR coalesce(p_badge_filter,'all')<>'all' OR p_group_by_family IS TRUE
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p)||jsonb_build_object('medical_history',(p).medical_history,'medical_alerts',(p).medical_alerts,'clinical_notes',(p).clinical_notes,'allergies',(p).allergies,'medications',(p).medications,'medical_conditions',(p).medical_conditions,'blood_type',(p).blood_type,'has_diabetes',(p).has_diabetes,'has_hypertension',(p).has_hypertension,'has_heart_disease',(p).has_heart_disease,'is_smoker',(p).is_smoker,'is_pregnant',(p).is_pregnant,'odontogram_state',(p).odontogram_state,'periodontogram_state',(p).periodontogram_state,'internal_notes',(p).internal_notes,'last_treatment_note',(p).last_treatment_note) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Public API allowlist; all historical finance, archive/purge, secure-profile and
-- family-statistics endpoints stay closed. Trigger execution does not need client EXECUTE.
REVOKE ALL ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) TO authenticated;

-- COLUMN_GRANTS: clinical base access excludes financial/insurance columns for all clients.
GRANT SELECT (id,created_at,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,clinic_id,emergency_contact,emergency_phone,allergies,medications,medical_conditions,deleted_at,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at) ON public.patients TO authenticated;
GRANT INSERT (clinic_id,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state) ON public.patients TO authenticated;
GRANT UPDATE (first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at,deleted_at) ON public.patients TO authenticated;
CREATE POLICY encargo02_patients_read ON public.patients FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_patients_insert ON public.patients FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_patients_update ON public.patients FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));

GRANT SELECT ON public.appointments,public.clinical_records,public.hcu033_forms,public.prescriptions,public.patient_notes,public.patient_files,public.prescription_templates TO authenticated;
-- Server defaults own IDs/creation time; updates cannot move tenant/patient/author.
GRANT INSERT (clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes) ON public.appointments TO authenticated;
GRANT UPDATE (doctor_id,start_time,end_time,status,type,notes,deleted_at) ON public.appointments TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state) ON public.clinical_records TO authenticated;
GRANT UPDATE (diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state,deleted_at) ON public.clinical_records TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,form_data) ON public.hcu033_forms TO authenticated;
GRANT UPDATE (form_data,deleted_at) ON public.hcu033_forms TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,data) ON public.prescriptions TO authenticated;
GRANT UPDATE (data) ON public.prescriptions TO authenticated;
GRANT INSERT (clinic_id,patient_id,author_id,content) ON public.patient_notes TO authenticated;
GRANT UPDATE (content,deleted_at) ON public.patient_notes TO authenticated;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (clinic_id,doctor_id,name,data) ON public.prescription_templates TO authenticated;
GRANT UPDATE (name,data) ON public.prescription_templates TO authenticated;
CREATE POLICY encargo02_appointments_read ON public.appointments FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_appointments_insert ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_appointments_update ON public.appointments FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
DO $clinical_policies$
DECLARE t text; v_author text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    v_author:=CASE t WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' ELSE 'doctor_id' END;
    EXECUTE format('CREATE POLICY encargo02_clinical_read ON public.%I FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id))',t);
    EXECUTE format('CREATE POLICY encargo02_clinical_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id) AND %I=auth.uid())',t,v_author);
    EXECUTE format('CREATE POLICY encargo02_clinical_update ON public.%I FOR UPDATE TO authenticated USING (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid()))) WITH CHECK (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid())))',t,v_author,v_author);
  END LOOP;
END;
$clinical_policies$;

-- Team authority cannot be mutated directly. A user may see their inactive own
-- membership/profile to show an honest denial, never other clinic data.
GRANT SELECT ON public.clinic_members TO authenticated;
CREATE POLICY encargo02_members_read ON public.clinic_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name,avatar_url,phone,address,bio,title,updated_at) ON public.profiles TO authenticated;
CREATE POLICY encargo02_profile_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY encargo02_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() AND status::text='active' AND deleted_at IS NULL) WITH CHECK (id=auth.uid() AND status::text='active' AND deleted_at IS NULL);
GRANT SELECT (id,name,address,phone,email,logo_url,size,working_hours,settings,disclaimer_text,created_at,owner_id) ON public.clinics TO authenticated;
GRANT UPDATE (name,address,phone,email,logo_url,working_hours,disclaimer_text) ON public.clinics TO authenticated;
CREATE POLICY encargo02_clinics_read ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id));
CREATE POLICY encargo02_clinics_update ON public.clinics FOR UPDATE TO authenticated USING (public.get_clinic_member_role(id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(id)='clinic_owner');
GRANT SELECT (id,clinic_id,name,description,duration_minutes,category,is_active,created_at,updated_at,color,category_id) ON public.services TO authenticated;
GRANT UPDATE (name,description,duration_minutes,category,is_active,color,category_id,updated_at) ON public.services TO authenticated;
CREATE POLICY encargo02_services_read ON public.services FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_services_update ON public.services FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.service_categories TO authenticated;
GRANT INSERT (clinic_id,name,color) ON public.service_categories TO authenticated;
GRANT UPDATE (name,color) ON public.service_categories TO authenticated;
CREATE POLICY encargo02_categories_read ON public.service_categories FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_categories_insert ON public.service_categories FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
CREATE POLICY encargo02_categories_update ON public.service_categories FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- M7 rights triggers remain intact; only row predicates stop depending on stale claims.
GRANT SELECT ON public.data_rights_requests TO authenticated;
GRANT INSERT (clinic_id,user_id,patient_id,request_type,details,legal_basis,retention_note) ON public.data_rights_requests TO authenticated;
GRANT UPDATE (status,resolution_notes) ON public.data_rights_requests TO authenticated;
CREATE POLICY encargo02_rights_read ON public.data_rights_requests FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id) AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
CREATE POLICY encargo02_rights_insert ON public.data_rights_requests FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id) AND user_id=auth.uid() AND status='pending' AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_notes IS NULL);
CREATE POLICY encargo02_rights_update ON public.data_rights_requests FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- AUTHORITY_TRIGGERS: no primary profile clinic or ownership fallback.
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.doctor_id IS NOT NULL AND coalesce(security_internal.role_for(NEW.clinic_id,NEW.doctor_id),'') NOT IN ('doctor','clinic_owner')
  THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
-- Safe autofill occurs before identity/author checks for HCU. clinic_id stays
-- explicit; a stale JWT default must not choose another active clinic silently.
ALTER TABLE public.hcu033_forms ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.prescription_templates ALTER COLUMN clinic_id DROP DEFAULT;
CREATE OR REPLACE FUNCTION security_internal.prepare_hcu033_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='INSERT' AND NEW.doctor_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.doctor_id:=auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS encargo02_00_prepare_author ON public.hcu033_forms;
CREATE TRIGGER encargo02_00_prepare_author BEFORE INSERT ON public.hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.prepare_hcu033_author();
-- Replace the existing production synchronization callback without a JWT or
-- patient-derived tenant fallback; keep the baseline's trigger if present.
CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.clinic_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=NEW.patient_id AND p.clinic_id=NEW.clinic_id)
  THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_patient_odontogram_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Patient + clinic partition is guaranteed by M7 and checked again here.
  -- Preserve the historical summary behavior without editing financial fields.
  IF jsonb_typeof(NEW.form_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid clinical document' USING ERRCODE='22023';
  END IF;
  IF NOT (NEW.form_data ?| ARRAY['odontograma_descripcion','odontograma_data']) THEN RETURN NEW; END IF;
  UPDATE public.patients SET last_treatment_note=CASE WHEN NEW.form_data ? 'odontograma_descripcion' THEN NEW.form_data->>'odontograma_descripcion' ELSE last_treatment_note END,
    odontogram_state=CASE WHEN NEW.form_data ? 'odontograma_data' THEN NEW.form_data->'odontograma_data' ELSE odontogram_state END,updated_at=now()
  WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.prepare_hcu033_author(),public.sync_hcu033_form_clinic_id(),public.update_patient_odontogram_summary() FROM PUBLIC,anon,authenticated,service_role;
-- Canonical callbacks in both source variants; absence in stage is not success.
DROP TRIGGER IF EXISTS trg_sync_hcu033_form_clinic_id ON public.hcu033_forms;
CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.sync_hcu033_form_clinic_id();
DROP TRIGGER IF EXISTS tr_update_patient_odontogram ON public.hcu033_forms;
CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_patient_odontogram_summary();
DO $audit_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','clinical_records','hcu033_forms'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','audit_'||t,t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()','audit_'||t,t);
  END LOOP;
END;
$audit_triggers$;
CREATE OR REPLACE FUNCTION security_internal.protect_clinical_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_author_column text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
BEGIN
  IF auth.role()='service_role' OR (auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR ((v_new?'patient_id') AND v_new->'patient_id' IS DISTINCT FROM v_old->'patient_id')
    THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='42501'; END IF;
  END IF;
  v_author_column:=CASE TG_TABLE_NAME WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' WHEN 'appointments' THEN NULL WHEN 'patients' THEN NULL ELSE 'doctor_id' END;
  IF v_author_column IS NOT NULL THEN
    IF TG_OP='INSERT' AND v_new->>v_author_column IS DISTINCT FROM auth.uid()::text
      OR TG_OP='UPDATE' AND v_new->v_author_column IS DISTINCT FROM v_old->v_author_column
    THEN RAISE EXCEPTION 'Immutable clinical author' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_TABLE_NAME='patient_files' THEN
    IF TG_OP='UPDATE' AND NEW.file_path IS DISTINCT FROM OLD.file_path
    THEN RAISE EXCEPTION 'Immutable file path' USING ERRCODE='42501'; END IF;
    IF NEW.file_path !~ ('^'||NEW.clinic_id::text||'/'||NEW.patient_id::text||'/[^/]+$')
    THEN RAISE EXCEPTION 'Invalid file path' USING ERRCODE='23514'; END IF;
  END IF;
  IF v_new?'updated_at' THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object('updated_at',now())); END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.enforce_clinician_assignment(),security_internal.protect_clinical_identity() FROM PUBLIC,anon,authenticated,service_role;
DO $identity_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','appointments','clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS encargo02_protect_identity ON public.%I',t);
    EXECUTE format('CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()',t);
  END LOOP;
END;
$identity_triggers$;

-- Category references must stay in the service's clinic, even for an owner of
-- both clinics. Existing invalid historical links stop review; never repair by deletion.
DO $category_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.services s JOIN public.service_categories c ON c.id=s.category_id WHERE s.clinic_id IS DISTINCT FROM c.clinic_id)
  THEN RAISE EXCEPTION 'Historical category/clinic mismatch requires reconciliation'; END IF;
END;
$category_preflight$;
CREATE OR REPLACE FUNCTION security_internal.protect_service_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at)
  THEN RAISE EXCEPTION 'Immutable service identity' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='services' THEN
    IF NEW.category_id IS NOT NULL THEN
      PERFORM 1 FROM public.service_categories c WHERE c.id=NEW.category_id AND c.clinic_id=NEW.clinic_id FOR KEY SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invalid category reference' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.protect_service_reference() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.services;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.service_categories;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();

CREATE OR REPLACE FUNCTION public.remove_clinic_member(p_target_user_id uuid,p_clinic_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_target_role text;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner'],true);
  IF p_target_user_id IS NULL OR p_target_user_id=auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_target_role FROM public.clinic_members WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id FOR UPDATE;
  IF NOT FOUND OR v_target_role='clinic_owner' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  -- Revoke the tenant membership only. Do not alter another clinic's profile,
  -- primary-clinic preference, clinical authorship, Auth account or historical rows.
  UPDATE public.clinic_members SET status='removed' WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_clinic_member(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid,uuid) TO authenticated;

-- Safely parse path segments before casts; policies never cast malformed input.
CREATE OR REPLACE FUNCTION security_internal.storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[]; v_clinic uuid; v_patient uuid; v_role text;
BEGIN
  v_parts:=string_to_array(p_name,'/');
  IF p_name IS NULL OR length(p_name)>500 OR p_name LIKE '%..%' THEN RETURN false; END IF;
  IF p_bucket IN ('patient-files','patient-avatars') THEN
    IF array_length(v_parts,1)<>3 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR v_parts[2]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[3],'')=''
    THEN RETURN false; END IF;
    v_clinic:=v_parts[1]::uuid; v_patient:=v_parts[2]::uuid;
    v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (p_bucket='patient-avatars' OR v_role IN ('doctor','clinic_owner'))
      AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id=v_patient AND p.clinic_id=v_clinic AND p.deleted_at IS NULL);
  ELSIF p_bucket IN ('clinic-branding','doctor-avatars') THEN
    IF array_length(v_parts,1)<>2 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[2],'')=''
    THEN RETURN false; END IF;
    IF p_bucket='doctor-avatars' THEN
      -- Read a colleague only through a shared live clinic. A removed user cannot
      -- keep avatar privileges solely because their personal profile is active.
      RETURN (NOT p_write OR v_parts[1]=auth.uid()::text) AND EXISTS (
        SELECT 1 FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id
        WHERE p.id=v_parts[1]::uuid AND p.status::text='active' AND p.deleted_at IS NULL
          AND m.status='active' AND m.role IN ('doctor','clinic_owner')
          AND public.check_subscription_active(m.clinic_id));
    END IF;
    v_clinic:=v_parts[1]::uuid; v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (NOT p_write OR v_role='clinic_owner');
  END IF;
  RETURN false;
END;
$function$;
CREATE OR REPLACE FUNCTION security_internal.storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[];
BEGIN
  IF NOT security_internal.storage_access(p_bucket,p_name,true) THEN RETURN false; END IF;
  IF p_bucket<>'patient-files' THEN RETURN true; END IF;
  -- Access helper already checked shape, UUIDs, active patient and live role.
  v_parts:=string_to_array(p_name,'/');
  RETURN NOT EXISTS (SELECT 1 FROM public.patient_files f WHERE f.clinic_id=v_parts[1]::uuid
    AND f.patient_id=v_parts[2]::uuid AND f.file_path=p_name);
END;
$function$;
CREATE OR REPLACE FUNCTION public.encargo02_storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_replace_allowed(p_bucket,p_name); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_replace_allowed(text,text),public.encargo02_storage_replace_allowed(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_replace_allowed(text,text) TO authenticated;
-- RLS calls helper through a public wrapper; private schema remains unexposed.
CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_access(p_bucket,p_name,p_write); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean),public.encargo02_storage_access(text,text,boolean) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_access(text,text,boolean) TO authenticated;
CREATE POLICY encargo02_storage_read ON storage.objects FOR SELECT TO authenticated USING (public.encargo02_storage_access(bucket_id,name,false));
CREATE POLICY encargo02_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));
CREATE POLICY encargo02_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name))
  WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name));
-- No client DELETE of patient bytes: clinical custody cannot be undone by a UI button.
CREATE POLICY encargo02_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('clinic-branding','doctor-avatars') AND owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));

-- Known historical hooks, if present, remain Auth-only. Verify configuration in01/10B.
DO $auth_hook$
BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin; END IF;
END;
$auth_hook$;
-- Explicit owner assertion for every created/replaced callback. Existing owners
-- were checked before DDL; postgres creates new functions. No ALTER OWNER repair.
DO $callback_owners$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Callback must be owned by postgres; no silent reattribution'; END IF;
END;
$callback_owners$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: docs/production/reconciliation/operational-convergence/after-authority.sql
-- Reviewed LOCAL SYNTHETIC ONLY. Run after encargo02, before agenda migration.
-- Canonical callbacks replace historical role/ownership/GUC fallbacks.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed local authority prerequisites required'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Actual maintenance sessions only; no editable custom GUC bypass.
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_changed text[]; v_before jsonb; v_after jsonb;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO v_changed FROM jsonb_object_keys(to_jsonb(NEW)) AS keys(k)
    WHERE k<>'updated_at' AND to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k;
  IF v_changed IS NULL THEN RETURN NEW; END IF;
  -- Only authorization values, never full profile/contact information in audit payload.
  v_before:=jsonb_build_object('role',OLD.role,'clinic_id',OLD.clinic_id,'status',OLD.status,'deleted_at',OLD.deleted_at);
  v_after:=jsonb_build_object('role',NEW.role,'clinic_id',NEW.clinic_id,'status',NEW.status,'deleted_at',NEW.deleted_at);
  INSERT INTO public.profile_audit_log(target_user_id,actor_user_id,actor_role,action,old_data,new_data,changed_fields)
    VALUES(NEW.id,auth.uid(),CASE WHEN auth.uid() IS NULL THEN 'maintenance' ELSE 'authenticated' END,'update_profile',v_before,v_after,v_changed);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation(),public.log_profile_changes() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_log_profile_changes ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON public.profiles FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.log_profile_changes();

CREATE OR REPLACE FUNCTION security_internal.guard_patient_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_field text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
  v_clinical constant text[]:=ARRAY['medical_history','allergies','medications','medical_conditions','medical_alerts','clinical_notes','blood_type','has_diabetes','has_hypertension','has_heart_disease','is_smoker','is_pregnant','recall_months','internal_notes','last_treatment_note','odontogram_state','periodontogram_state'];
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.account_balance IS DISTINCT FROM OLD.account_balance OR NEW.insurance_provider IS DISTINCT FROM OLD.insurance_provider OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
    THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF v_role='receptionist' THEN
      FOREACH v_field IN ARRAY v_clinical LOOP
        IF v_new->v_field IS DISTINCT FROM v_old->v_field THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      END LOOP;
    END IF;
  ELSIF v_role='receptionist' THEN
    FOREACH v_field IN ARRAY v_clinical LOOP
      IF v_field='recall_months' THEN
        IF coalesce(NEW.recall_months,6)<>6 THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      ELSIF coalesce(v_new->>v_field,'') NOT IN ('','{}','[]','false') THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_patient_scope() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
DROP TRIGGER IF EXISTS trg_guard_patient_clinical_insert ON public.patients;
CREATE TRIGGER operational_patient_scope BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION security_internal.guard_patient_scope();

-- Duplicate historical rights trigger has the same callback as the required M7
-- trigger. Keep M7's exact trigger; avoid two executions of the same operation.
DROP TRIGGER IF EXISTS trg_protect_data_requests_immutability ON public.data_rights_requests;
-- The verification callback is inert after encargo02; remove the unused event.
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
-- Optional legacy hook must stay closed when the configuration isn't verified.
DO $hook$ BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,supabase_auth_admin;
  END IF;
END $hook$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql
-- Local synthetic acceptance only. Not a remotely deployable migration until
-- canonical01/02 parity and independent release review are complete.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='agenda_no_overlap')
  THEN RAISE EXCEPTION 'Reviewed local acceptance prerequisite required'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments WHERE start_time IS NULL OR end_time IS NULL OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR end_time<=start_time OR end_time-start_time>interval '8 hours' OR status IS NULL OR status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR (deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived') AND doctor_id IS NULL))
  THEN RAISE EXCEPTION 'Invalid appointment history; stop and review without modifying data'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments a JOIN public.appointments b ON a.id<b.id AND a.clinic_id=b.clinic_id AND a.doctor_id=b.doctor_id AND a.start_time<b.end_time AND b.start_time<a.end_time WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.status IN ('scheduled','confirmed','arrived') AND b.status IN ('scheduled','confirmed','arrived'))
  THEN RAISE EXCEPTION 'Existing overlapping history; stop and review'; END IF;
END;
$preflight$;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK(status IS NOT NULL AND status IN ('scheduled','confirmed','arrived','completed','cancelled','no_show'));
ALTER TABLE public.appointments ADD CONSTRAINT agenda_finite_interval CHECK(start_time IS NOT NULL AND end_time IS NOT NULL AND isfinite(start_time) AND isfinite(end_time) AND end_time>start_time AND end_time-start_time BETWEEN interval '5 minutes' AND interval '8 hours');
ALTER TABLE public.appointments ADD CONSTRAINT agenda_active_assignment CHECK(deleted_at IS NOT NULL OR status NOT IN ('scheduled','confirmed','arrived') OR doctor_id IS NOT NULL);
ALTER TABLE public.appointments ADD CONSTRAINT agenda_no_overlap EXCLUDE USING gist (clinic_id WITH =,doctor_id WITH =,tstzrange(start_time,end_time,'[)') WITH &&) WHERE(deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived'));
CREATE INDEX agenda_visible_range ON public.appointments(clinic_id,start_time) WHERE deleted_at IS NULL;

CREATE TABLE security_internal.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
  before_values jsonb,
  after_values jsonb NOT NULL
);
ALTER TABLE security_internal.appointment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.appointment_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION security_internal.guard_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_validate_assignment boolean;
BEGIN
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF NEW.deleted_at IS NOT NULL OR (TG_OP='UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    RAISE EXCEPTION 'Use cancellation; appointment evidence must remain' USING ERRCODE='42501';
  END IF;
  IF v_role='receptionist' AND (TG_OP='INSERT' AND NEW.notes IS NOT NULL OR TG_OP='UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND NEW.status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Invalid initial state' USING ERRCODE='22023';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NOT (
    OLD.status='scheduled' AND NEW.status IN ('confirmed','arrived','cancelled','no_show') OR
    OLD.status='confirmed' AND NEW.status IN ('arrived','cancelled','no_show') OR
    OLD.status='arrived' AND NEW.status IN ('completed','cancelled') OR
    OLD.status IN ('cancelled','no_show') AND NEW.status='scheduled'
  ) THEN RAISE EXCEPTION 'Invalid state transition' USING ERRCODE='22023'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='completed' AND (NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.type IS DISTINCT FROM OLD.type) THEN
    RAISE EXCEPTION 'Completed appointment is immutable' USING ERRCODE='22023';
  END IF;
  v_validate_assignment:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN v_validate_assignment:=NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.status IN ('scheduled','confirmed','arrived') AND NEW.status IS DISTINCT FROM OLD.status; END IF;
  IF v_validate_assignment AND (NEW.doctor_id IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) NOT IN ('doctor','clinic_owner')) THEN
    RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023';
  END IF;
  IF v_validate_assignment THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.user_id=NEW.doctor_id AND m.clinic_id=NEW.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE FUNCTION security_internal.audit_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_before jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN v_before:=jsonb_build_object('start_time',OLD.start_time,'end_time',OLD.end_time,'doctor_id',OLD.doctor_id,'status',OLD.status); END IF;
  INSERT INTO security_internal.appointment_events(appointment_id,clinic_id,actor_id,operation,before_values,after_values) VALUES(NEW.id,NEW.clinic_id,auth.uid(),TG_OP,v_before,jsonb_build_object('start_time',NEW.start_time,'end_time',NEW.end_time,'doctor_id',NEW.doctor_id,'status',NEW.status));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_operational_appointment(),security_internal.audit_operational_appointment() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER trg_enforce_clinician_assignment ON public.appointments;
CREATE TRIGGER agenda_guard BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.guard_operational_appointment();
CREATE TRIGGER agenda_audit AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.audit_operational_appointment();

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql
-- Local synthetic acceptance only; not remotely deployable before01/02 gates.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR to_regprocedure('public.get_clinic_operational_report(uuid,timestamptz,timestamptz)') IS NOT NULL
  THEN RAISE EXCEPTION 'Reviewed fresh local report contract required'; END IF;
END $guard$;
CREATE FUNCTION public.get_clinic_operational_report(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_end<=p_start OR p_end-p_start>interval '366 days'
  THEN RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE='22023'; END IF;
  WITH appointments AS MATERIALIZED (
    SELECT a.start_time,a.status,a.type FROM public.appointments a
      WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time>=p_start AND a.start_time<p_end
  ), patients AS MATERIALIZED (
    SELECT p.created_at,p.status FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
  ), totals AS (
    SELECT count(*) AS appointments,count(*) FILTER(WHERE status='completed') AS completed,
      count(*) FILTER(WHERE status='no_show') AS no_show,count(*) FILTER(WHERE status='cancelled') AS cancelled FROM appointments
  ), months AS (
    SELECT generate_series(date_trunc('month',p_start AT TIME ZONE 'America/Guayaquil'),
      date_trunc('month',(p_end-interval '1 microsecond') AT TIME ZONE 'America/Guayaquil'),interval '1 month') AS month
  )
  SELECT jsonb_build_object(
    'clinic_id',p_clinic_id,'start',p_start,'end',p_end,
    'summary',jsonb_build_object('appointments',t.appointments,'activePatients',(SELECT count(*) FROM patients WHERE status='active'),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end),
      'completed',t.completed,'noShow',t.no_show,'cancelled',t.cancelled,
      'attendanceRate',round(100.0*t.completed/nullif(t.completed+t.no_show,0),1)),
    'statuses',(SELECT jsonb_object_agg(state,(SELECT count(*) FROM appointments WHERE status=state))
      FROM unnest(ARRAY['scheduled','confirmed','arrived','completed','cancelled','no_show']) states(state)),
    'monthly',(SELECT jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),
      'appointments',(SELECT count(*) FROM appointments WHERE date_trunc('month',start_time AT TIME ZONE 'America/Guayaquil')=m.month),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end AND date_trunc('month',created_at AT TIME ZONE 'America/Guayaquil')=m.month)) ORDER BY m.month) FROM months m),
    'treatments',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY grouped.count DESC,grouped.name),'[]'::jsonb)
      FROM (SELECT coalesce(nullif(btrim(type),''),'Consulta') AS name,count(*) AS count FROM appointments GROUP BY coalesce(nullif(btrim(type),''),'Consulta') ORDER BY count(*) DESC,coalesce(nullif(btrim(type),''),'Consulta') LIMIT 10) grouped)
  ) INTO v_result FROM totals t;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261001120000_invitation_pending_reservation.sql
-- PROSPECTIVE: review/apply after canonical authority and operational convergence.
-- Not applied by this change. Preserve accepted/expired history without permitting
-- more than one pending reservation per clinic and normalized recipient.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

-- Keep the duplicate preflight and replacement atomic against concurrent writes.
LOCK TABLE public.clinic_invitations IN ACCESS EXCLUSIVE MODE;
DO $checked_constraint$
DECLARE actual text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO actual
  FROM pg_constraint
  WHERE conrelid = 'public.clinic_invitations'::regclass
    AND conname = 'clinic_invitations_clinic_id_email_status_key'
    AND contype = 'u';
  IF actual IS DISTINCT FROM 'UNIQUE (clinic_id, email, status)' THEN
    RAISE EXCEPTION 'Unreviewed invitation uniqueness drift; reconcile before applying';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinic_invitations WHERE status = 'pending'
    GROUP BY clinic_id, lower(email) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending recipients require review; no records were removed';
  END IF;
END
$checked_constraint$;

ALTER TABLE public.clinic_invitations
  DROP CONSTRAINT clinic_invitations_clinic_id_email_status_key;
CREATE UNIQUE INDEX clinic_invitations_one_pending_email_idx
  ON public.clinic_invitations (clinic_id, lower(email))
  WHERE status = 'pending';


-- PINNED REFERENCE: supabase/migrations/20261001130000_durable_email_abuse_budget.sql
-- PROSPECTIVE: apply only after the canonical authority baseline is reconciled.
-- This migration is additive and atomic. It never changes Auth or Storage policy.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
     OR to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Reviewed authority baseline and pgcrypto are required';
  END IF;
END
$preflight$;

CREATE TABLE security_internal.email_abuse_budgets (
  scope text NOT NULL,
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (scope, key_hash, window_start),
  CHECK (expires_at > window_start)
);
CREATE INDEX email_abuse_budget_expiry_idx ON security_internal.email_abuse_budgets (expires_at);
ALTER TABLE security_internal.email_abuse_budgets OWNER TO postgres;
ALTER TABLE security_internal.email_abuse_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.email_abuse_budgets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.consume_email_abuse_budget(
  p_action text, p_ip_hash text, p_destination_hash text,
  p_actor_id uuid DEFAULT NULL, p_clinic_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $budget$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_count integer;
  v_retry integer := 0;
  v_scope text;
  v_key text;
  v_seconds integer;
  v_limit integer;
  v_authenticated boolean;
  v_role text;
  v_quota record;
BEGIN
  -- Grants are the primary boundary. Never accept an ordinary JWT as a limiter
  -- administrator, including one with forged user metadata or parameters.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('signup','resend','invite','transactional')
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$'
     OR p_destination_hash IS NULL OR p_destination_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid email budget request' USING ERRCODE = '22023';
  END IF;
  v_authenticated := p_action IN ('invite','transactional');
  IF (v_authenticated AND (p_actor_id IS NULL OR p_clinic_id IS NULL))
     OR (NOT v_authenticated AND (p_actor_id IS NOT NULL OR p_clinic_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid email budget authority' USING ERRCODE = '22023';
  END IF;
  IF v_authenticated THEN
    v_role := security_internal.role_for(p_clinic_id, p_actor_id);
    IF v_role IS NULL OR (p_action='invite' AND v_role<>'clinic_owner')
       OR v_role NOT IN ('clinic_owner','doctor','receptionist') THEN
      RAISE EXCEPTION 'Active email authority required' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Fixed UTC windows, deliberately conservative launch ceilings. Global is
  -- always locked first, bounding new hashed rows and serializing reservations.
  -- All remaining scopes use the same order, preventing reverse lock cycles.
  -- The subtransaction reserves every applicable scope or none. Rejected
  -- traffic must never burn the global budget and deny unrelated clinics.
  BEGIN
  FOR v_quota IN
    SELECT * FROM (VALUES
      ('00-global', encode(extensions.digest('clinia-email-global','sha256'),'hex'), 86400, 1000, true),
      ('10-ip', p_ip_hash, 600, 60, true),
      ('20-destination', p_destination_hash, 3600, 10, true),
      ('30-auth-ip', p_ip_hash, 600, 10, NOT v_authenticated),
      ('40-auth-destination', p_destination_hash, 3600, 3, NOT v_authenticated),
      ('50-actor', encode(extensions.digest('actor:' || p_actor_id::text,'sha256'),'hex'), 600, 30, v_authenticated),
      ('60-clinic', encode(extensions.digest('clinic:' || p_clinic_id::text,'sha256'),'hex'), 3600, 120, v_authenticated)
    ) AS quotas(scope, key_hash, seconds, ceiling, enabled)
    WHERE enabled ORDER BY scope
  LOOP
    v_scope := v_quota.scope; v_key := v_quota.key_hash;
    v_seconds := v_quota.seconds; v_limit := v_quota.ceiling;
    v_start := to_timestamp(floor(extract(epoch FROM v_now) / v_seconds) * v_seconds);
    INSERT INTO security_internal.email_abuse_budgets AS budget
      (scope, key_hash, window_start, expires_at, attempts)
    VALUES (v_scope, v_key, v_start, v_start + make_interval(secs => v_seconds), 1)
    ON CONFLICT (scope, key_hash, window_start) DO UPDATE
      SET attempts = least(budget.attempts + 1, v_limit + 1)
    RETURNING attempts INTO v_count;
    IF v_count > v_limit THEN
      v_retry := greatest(v_retry, greatest(1, ceil(extract(epoch FROM
        (v_start + make_interval(secs => v_seconds) - v_now)))::integer));
      RAISE EXCEPTION 'Email budget denied' USING ERRCODE = 'CL001';
    END IF;
  END LOOP;
  EXCEPTION WHEN SQLSTATE 'CL001' THEN
    NULL; -- PostgreSQL rolled back every reservation; retry remains local.
  END;

  -- Bounded cleanup during real requests; no raw emails, IPs or JWTs are stored.
  -- SKIP LOCKED avoids contending with a reservation begun in an earlier window.
  WITH expired AS (
    SELECT scope, key_hash, window_start FROM security_internal.email_abuse_budgets
    WHERE expires_at < v_now - interval '24 hours'
    ORDER BY expires_at LIMIT 200 FOR UPDATE SKIP LOCKED
  )
  DELETE FROM security_internal.email_abuse_budgets b USING expired e
  WHERE b.scope=e.scope AND b.key_hash=e.key_hash AND b.window_start=e.window_start;

  RETURN jsonb_build_object('allowed', v_retry = 0, 'retry_after_seconds', v_retry);
END
$budget$;
ALTER FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) TO service_role;
-- The deny-first baseline revokes PUBLIC schema usage. Grant only namespace
-- access for the server role; no CREATE, table or other routine grants change.
GRANT USAGE ON SCHEMA public TO service_role;


-- PINNED REFERENCE: supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql
-- PROSPECTIVE: exact canonical guard compatibility, without fabricating history.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.prevent_profile_privilege_escalation()')
      AND pg_get_userbyid(proowner)='postgres' AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND md5(replace(prosrc,E'\r\n',E'\n'))='e109bee275bcff2feb87651cbd2fdefb'
  ) THEN RAISE EXCEPTION 'Unreviewed profile guard drift; reconcile before applying'; END IF;
END
$preflight$;
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    -- Some reviewed schemas have no created_at field. Compare it when present;
    -- absent fields remain null without inventing historical timestamps.
    OR to_jsonb(NEW)->'created_at' IS DISTINCT FROM to_jsonb(OLD)->'created_at'
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC,anon,authenticated,service_role;


-- PINNED REFERENCE: supabase/migrations/20261002180423_live_session_revocation.sql
-- PROSPECTIVE canonical forward, never a blind repair of occupied cloud schemas.
-- Supabase signatures survive logout; application authority also needs a live session.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('security_internal.role_for(uuid,uuid)','762192aa8d42b261aea671bc41cbe096'),
    ('public.get_clinic_member_role(uuid)','a242b6422e41124b0660479752ca5240'),
    ('security_internal.require_clinic(uuid,text[],boolean)','9b1034be74705088e7c787e30525d1d1')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact canonical authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='banned_until' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='deleted_at' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.sessions'::regclass AND attname='not_after' AND NOT attisdropped)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='profiles')<>2
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='clinic_members')<>1
  THEN RAISE EXCEPTION 'Reviewed managed Auth schema and exact profile/member policies required'; END IF;
END $preflight$;

CREATE FUNCTION public.clinia_session_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='authenticated' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
      WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_session_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_session_active() TO authenticated;

CREATE FUNCTION security_internal.lock_clinia_session()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.clinia_session_active() IS NOT TRUE
  THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  -- Consistent order for enrollment and clinical writes. Logout or ban committed
  -- first denies the operation; a write already authorized holds these locks.
  PERFORM 1 FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL AND is_anonymous IS NOT TRUE
    AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM auth.sessions WHERE user_id=auth.uid() AND id=(auth.jwt()->>'session_id')::uuid
    AND (not_after IS NULL OR not_after>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
END $function$;
REVOKE ALL ON FUNCTION security_internal.lock_clinia_session() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    -- Assigned clinicians may be offline. Only the requesting ordinary actor
    -- must own a live session; a gated service lookup still checks live Auth.
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_session_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  IF p_write THEN PERFORM security_internal.lock_clinia_session(); END IF;
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

ALTER POLICY encargo02_profile_read ON public.profiles USING (id=auth.uid() AND public.clinia_session_active());
ALTER POLICY encargo02_profile_update ON public.profiles
  USING (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL)
  WITH CHECK (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL);
ALTER POLICY encargo02_members_read ON public.clinic_members
  USING (public.clinia_session_active() AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261002180800_trusted_enrollment.sql
-- PROSPECTIVE: apply only after reviewed canonical authority and convergence.
-- No metadata-based enrollment, profile privilege writes or historical repair.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$ BEGIN
  IF to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
    OR to_regprocedure('public.check_subscription_active(uuid)') IS NULL
    OR to_regprocedure('public.clinia_session_active()') IS NULL
    OR to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND tgname='on_auth_user_verified' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'Reviewed canonical enrollment prerequisites required'; END IF;
END $preflight$;

CREATE TABLE security_internal.clinic_registration_intents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  clinic_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  address text NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
  phone text NOT NULL CHECK (length(phone)<=40),
  size text NOT NULL CHECK (size IN ('small','medium','large')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE security_internal.clinic_registration_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.clinic_registration_intents FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.clinic_invitations
  ADD COLUMN auth_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN accepted_at timestamptz;
-- Existing invitations deliberately remain unready, requiring reviewed resend.

CREATE FUNCTION public.store_clinic_registration_intent(
  p_user_id uuid,p_clinic_id uuid,p_email text,p_name text,p_address text,p_phone text,p_size text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_existing security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_clinic_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id
      AND lower(email)=lower(btrim(p_email)) AND email_confirmed_at IS NULL
      AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- The only writer is the gated server signup path, using the Auth ID returned
  -- from its own createUser call. An existing request cannot be repurposed.
  INSERT INTO security_internal.clinic_registration_intents(user_id,clinic_id,email,name,address,phone,size)
    VALUES(p_user_id,p_clinic_id,lower(btrim(p_email)),btrim(p_name),btrim(p_address),btrim(p_phone),p_size)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_existing FROM security_internal.clinic_registration_intents WHERE user_id=p_user_id FOR UPDATE;
  IF v_existing.clinic_id IS DISTINCT FROM p_clinic_id OR v_existing.email IS DISTINCT FROM lower(btrim(p_email))
    OR v_existing.name IS DISTINCT FROM btrim(p_name) OR v_existing.address IS DISTINCT FROM btrim(p_address)
    OR v_existing.phone IS DISTINCT FROM btrim(p_phone) OR v_existing.size IS DISTINCT FROM p_size
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.complete_verified_clinic_registration()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_intent security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- Common actor lock serializes registration against simultaneous redemption.
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_intent FROM security_internal.clinic_registration_intents WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_intent.email<>v_email THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  IF v_intent.completed_at IS NOT NULL THEN
    IF security_internal.role_for(v_intent.clinic_id,auth.uid()) IS DISTINCT FROM 'clinic_owner'
    THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
    RETURN v_intent.clinic_id;
  END IF;
  -- New-account enrollment only; no silent restoration or extra trial farming
  -- for an identity that already has an active or historical membership.
  IF EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
  INSERT INTO public.clinics(id,name,address,phone,size,owner_id,subscription_tier,subscription_status,trial_ends_at,bypass_subscription)
    VALUES(v_intent.clinic_id,v_intent.name,v_intent.address,v_intent.phone,v_intent.size,auth.uid(),
      'trial','trial',now()+interval '14 days',false);
  INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
    VALUES(auth.uid(),v_intent.clinic_id,'clinic_owner','active');
  UPDATE security_internal.clinic_registration_intents SET completed_at=now() WHERE user_id=auth.uid();
  RETURN v_intent.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.complete_verified_clinic_registration() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.complete_verified_clinic_registration() TO authenticated;

CREATE FUNCTION public.redeem_verified_clinic_invitation(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_invite public.clinic_invitations%ROWTYPE; v_role text; v_status text;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
    OR p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 512
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_invite FROM public.clinic_invitations WHERE token=p_token FOR UPDATE;
  IF NOT FOUND OR NOT v_invite.auth_ready OR lower(v_invite.email)<>v_email
    OR v_invite.role IS NULL OR v_invite.role NOT IN ('doctor','receptionist')
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;

  IF v_invite.status='accepted' THEN
    IF v_invite.accepted_by IS DISTINCT FROM auth.uid()
      OR security_internal.role_for(v_invite.clinic_id,auth.uid()) IS DISTINCT FROM v_invite.role
    THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
    RETURN v_invite.clinic_id;
  END IF;
  IF v_invite.status<>'pending' OR v_invite.expires_at IS NULL OR v_invite.expires_at<=now()
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  -- Hold the issuer's live authority through commit; committed revocation wins.
  PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=m.user_id
    WHERE m.clinic_id=v_invite.clinic_id AND m.user_id=v_invite.invited_by
      AND m.role='clinic_owner' AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
    FOR SHARE OF m,p,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  IF security_internal.role_for(v_invite.clinic_id,v_invite.invited_by) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.clinics WHERE id=v_invite.clinic_id AND archived_at IS NULL
    AND (bypass_subscription IS TRUE OR subscription_status::text='active' OR trial_ends_at>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT role,status INTO v_role,v_status FROM public.clinic_members
    WHERE user_id=auth.uid() AND clinic_id=v_invite.clinic_id FOR UPDATE;
  IF FOUND THEN
    IF v_role IS DISTINCT FROM v_invite.role OR v_status IS DISTINCT FROM 'active'
    THEN RAISE EXCEPTION 'Membership conflict; reviewed restoration required' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
      VALUES(auth.uid(),v_invite.clinic_id,v_invite.role,'active');
  END IF;
  UPDATE public.clinic_invitations SET status='accepted',accepted_by=auth.uid(),accepted_at=now()
    WHERE id=v_invite.id AND status='pending';
  RETURN v_invite.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.redeem_verified_clinic_invitation(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.redeem_verified_clinic_invitation(text) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261002231730_immutable_prescription_receipts.sql
-- Prospective only, after live_session_revocation and canonical encargo02.
-- Existing records remain NULL; this does not reconstruct historical authorship.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed live session authority prerequisite required'; END IF;
END $preflight$;
ALTER TABLE public.prescriptions ADD COLUMN issuance_snapshot jsonb;
CREATE FUNCTION security_internal.freeze_prescription_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE p public.patients%ROWTYPE; d public.profiles%ROWTYPE; c public.clinics%ROWTYPE; m jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Issued prescription is immutable; custody procedure required' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL OR NEW.doctor_id IS DISTINCT FROM auth.uid() OR NEW.issuance_snapshot IS NOT NULL
  THEN RAISE EXCEPTION 'Invalid prescription issuer or receipt' USING ERRCODE='42501'; END IF;
  PERFORM security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor'],true);
  SELECT * INTO p FROM public.patients WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription patient' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription issuer' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.clinics WHERE id=NEW.clinic_id FOR SHARE;
  IF NOT FOUND OR nullif(btrim(c.name),'') IS NULL OR nullif(btrim(d.full_name),'') IS NULL
    OR nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') IS NULL
  THEN RAISE EXCEPTION 'Prescription identity incomplete' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(NEW.data) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.data->'medications') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.data->'indications') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(NEW.data->'medications') NOT BETWEEN 1 AND 20 OR length(NEW.data->>'indications')>2000
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(NEW.data->'medications') LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'object'
      OR jsonb_typeof(m->'name') IS DISTINCT FROM 'string' OR length(btrim(m->>'name')) NOT BETWEEN 1 AND 120
      OR jsonb_typeof(m->'dosage') IS DISTINCT FROM 'string' OR length(btrim(m->>'dosage')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(m->'duration') IS DISTINCT FROM 'string' OR length(btrim(m->>'duration')) NOT BETWEEN 1 AND 80
    THEN RAISE EXCEPTION 'Invalid prescription medication' USING ERRCODE='22023'; END IF;
  END LOOP;
  NEW.created_at:=statement_timestamp();
  NEW.data:=jsonb_build_object('medications',NEW.data->'medications','indications',NEW.data->>'indications');
  NEW.issuance_snapshot:=jsonb_build_object('version',1,'prescription_id',NEW.id,
    'issued_at',NEW.created_at,'clinic_id',NEW.clinic_id,'patient_id',NEW.patient_id,'doctor_id',auth.uid(),
    'clinic',jsonb_build_object('name',c.name,'address',coalesce(c.address,''),'phone',coalesce(c.phone,'')),
    'patient',jsonb_build_object('name',btrim(concat_ws(' ',p.first_name,p.last_name)),'identification',coalesce(p.cedula,'')),
    'doctor',jsonb_build_object('name',d.full_name,'specialization',coalesce(d.specialization,''),'license_number',coalesce(d.license_number,'')),
    'medications',NEW.data->'medications','indications',NEW.data->>'indications');
  -- No mutable logo URL or signature-image claim becomes historical evidence.
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.freeze_prescription_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER freeze_prescription_receipt BEFORE INSERT OR UPDATE OR DELETE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION security_internal.freeze_prescription_receipt();
REVOKE UPDATE,DELETE ON public.prescriptions FROM anon,authenticated;
REVOKE UPDATE(data) ON public.prescriptions FROM authenticated;
DROP POLICY IF EXISTS encargo02_clinical_update ON public.prescriptions;
COMMENT ON COLUMN public.prescriptions.issuance_snapshot IS 'Database-captured immutable issuance receipt. NULL historical rows require reviewed custody before reprint. No qualified signature claim.';
NOTIFY pgrst,'reload schema';



-- PINNED REFERENCE: supabase/migrations/20261002234427_enable_prescription_request_ids.sql
-- Prospective permission only; existing PK and immutable receipt enforce retries.

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


-- PINNED REFERENCE: supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql
-- PROSPECTIVE forward for the exact reviewed operational agenda + live Auth chain.
-- Ordinary appointment writes use the existing authorized RPC. Clinic queues are
-- acquired before tuple/Auth authority locks; exclusion remains the final arbiter.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE v record; a record;
  v_insert text[]:=ARRAY['clinic_id','patient_id','doctor_id','start_time','end_time','status','type','notes'];
  v_update text[]:=ARRAY['doctor_id','start_time','end_time','status','type','notes','deleted_at'];
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.save_clinic_appointment(uuid,jsonb,uuid)','997c9a0e5b2006653d777c85039c0e49'),
    ('security_internal.guard_operational_appointment()','852e98f6d3e11eb76557f652f10c725d'),
    ('security_internal.require_clinic(uuid,text[],boolean)','e7c822cbffb3195f70088e7e4617a043'),
    ('security_internal.lock_clinia_session()','69a325cf0b73743dc5a50b2c6f4a7170')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed function prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass
      AND conname='agenda_no_overlap' AND contype='x' AND convalidated)
    OR NOT has_function_privilege('authenticated','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','public.appointments','INSERT')
    OR has_table_privilege('authenticated','public.appointments','UPDATE')
    OR NOT has_table_privilege('service_role','public.appointments','INSERT')
    OR NOT has_table_privilege('service_role','public.appointments','UPDATE')
  THEN RAISE EXCEPTION 'Exact reviewed agenda RLS, exclusion and RPC privileges required'; END IF;
  FOR a IN SELECT attname FROM pg_catalog.pg_attribute
    WHERE attrelid='public.appointments'::regclass AND attnum>0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated','public.appointments',a.attname,'INSERT') IS DISTINCT FROM (a.attname=ANY(v_insert))
      OR has_column_privilege('authenticated','public.appointments',a.attname,'UPDATE') IS DISTINCT FROM (a.attname=ANY(v_update))
      OR has_column_privilege('anon','public.appointments',a.attname,'INSERT')
      OR has_column_privilege('anon','public.appointments',a.attname,'UPDATE')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'INSERT')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'UPDATE')
    THEN RAISE EXCEPTION 'Unexpected appointment column grant; stop and review: %',a.attname; END IF;
  END LOOP;
END $preflight$;

-- Bind objects that this change must preserve, including RLS policies, triggers,
-- all constraints, authority bodies and routine ACLs. This is transaction-local.
CREATE TEMP TABLE clinia_agenda_contract_before ON COMMIT DROP AS
SELECT jsonb_build_object(
  'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
  'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
    'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
    'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
    'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
  'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
  ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
) AS contract;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],false);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  -- Queue before acquiring live authority or appointment row locks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinia.appointment.clinic:'||p_clinic_id::text,0));
  -- A queued actor may have been revoked or changed role. Recheck and lock now.
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Revoke only the exact previously reviewed direct DML grants. SELECT and RLS
-- policies remain unchanged; the definer RPC still runs its live authority checks.
-- Canonical trusted service_role maintenance grants are preserved. Privileged
-- concurrent maintenance must use this clinic advisory lock before writing;
-- serialization here is proved for ordinary authenticated RPC callers.
REVOKE INSERT(clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes),
  UPDATE(doctor_id,start_time,end_time,status,type,notes,deleted_at)
  ON public.appointments FROM authenticated;

DO $postflight$
DECLARE v_after jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))='caae0bd668648dac2b32686b658be02d')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE a.attrelid='public.appointments'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND (has_column_privilege(r.role_name,'public.appointments',a.attname,'INSERT')
          OR has_column_privilege(r.role_name,'public.appointments',a.attname,'UPDATE')))
    OR EXISTS(SELECT 1 FROM (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE has_table_privilege(r.role_name,'public.appointments','INSERT') OR has_table_privilege(r.role_name,'public.appointments','UPDATE'))
  THEN RAISE EXCEPTION 'Appointment RPC serialization postcondition failed'; END IF;
  SELECT jsonb_build_object(
    'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
    'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
      'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
      'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
      'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
    'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
    ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM (SELECT contract FROM pg_temp.clinia_agenda_contract_before)
  THEN RAISE EXCEPTION 'Agenda authority, RLS, triggers, constraints or RPC ACL changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261004022340_clinical_document_delivery.sql
-- Prospective canonical upgrade only. Do not run on an occupied legacy schema.
-- Register the server Auth subject before configuring the hook. Keep disabled
-- subjects registered: disabling must never restore the human JWT role.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery')
    OR to_regclass('security_internal.document_delivery_principals') IS NOT NULL
    OR to_regprocedure('storage.allow_only_operation(text)') IS NULL
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='patient-files' AND file_size_limit=10485760)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='encargo02_storage_read' AND cmd='SELECT' AND permissive='PERMISSIVE')
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline and unused isolated role required'; END IF;
END $preflight$;

CREATE ROLE clinia_document_delivery NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT clinia_document_delivery TO authenticator;
GRANT USAGE ON SCHEMA public,storage,security_internal TO clinia_document_delivery;
GRANT SELECT ON storage.objects TO clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_principals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_internal.document_delivery_principals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_principals FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  file_id uuid NOT NULL
);
ALTER TABLE security_internal.document_delivery_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_audit FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

-- Records authorization to publish, not proof the client received/saved bytes.
-- No names, paths, bearer credentials or clinical content enter the audit row.
CREATE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.file_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role,clinia_document_delivery;
GRANT EXECUTE ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.clinia_document_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_user uuid;
BEGIN
  -- The hook is invoked only by managed Auth, never by an ordinary actor.
  v_user:=(event->>'user_id')::uuid;
  IF (event->'claims'->>'sub') IS DISTINCT FROM v_user::text
  THEN RAISE EXCEPTION 'Auth subject mismatch' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE user_id=v_user)
  THEN event:=jsonb_set(event,'{claims,role}',to_jsonb('clinia_document_delivery'::text),false); END IF;
  RETURN event;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_document_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.clinia_document_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE FUNCTION public.clinia_document_delivery_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='clinia_document_delivery' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM security_internal.document_delivery_principals p
      JOIN auth.users u ON u.id=p.user_id JOIN auth.sessions s ON s.user_id=u.id
      WHERE p.user_id=auth.uid() AND p.enabled AND (p.expires_at IS NULL OR p.expires_at>now())
        AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_document_delivery_active() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_document_delivery_active() TO clinia_document_delivery;

CREATE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active() AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.file_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;
REVOKE ALL ON FUNCTION security_internal.document_object_read_allowed(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION security_internal.document_object_read_allowed(text) TO clinia_document_delivery;

-- A restrictive policy is required: permissive policies combine with OR.
CREATE POLICY clinia_no_human_clinical_object_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id<>'patient-files');
CREATE POLICY clinia_document_delivery_read ON storage.objects
  FOR SELECT TO clinia_document_delivery USING (
    bucket_id='patient-files' AND storage.allow_only_operation('object.get_authenticated')
    AND security_internal.document_object_read_allowed(name)
  );

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND p.oid<>'public.clinia_document_delivery_active()'::regprocedure
        AND has_function_privilege('clinia_document_delivery',p.oid,'EXECUTE'))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261004220500_document_delivery_info_operation.sql
-- Forward-only correction for the managed Storage metadata preflight.
-- Exact-key metadata access is bounded by the same live principal/registry
-- checks as byte access. Listing, signing, writes and human reads stay denied.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF to_regprocedure('storage.allow_any_operation(text[])') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='security_internal.document_object_read_allowed(text)'::regprocedure
      AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(prosrc,'\s+','','g'))='1bb5e1a423735400876ea9dbde2971a5')
    OR EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_document_delivery_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['clinia_document_delivery']::name[]
      AND qual='((bucket_id = ''patient-files''::text) AND storage.allow_only_operation(''object.get_authenticated''::text) AND security_internal.document_object_read_allowed(name))')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND NOT public)<>4
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
END $preflight$;

ALTER POLICY clinia_document_delivery_read ON storage.objects USING (
  bucket_id='patient-files'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated','object.get_authenticated_info'])
  AND security_internal.document_object_read_allowed(name)
);

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'
    AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;


-- PINNED REFERENCE: supabase/migrations/20261006050131_clinical_s3_origin_delivery.sql
-- Prospective canonical staging/candidate only; never legacy occupied production.
-- S3 session-token requests retain RLS. Generated S3 keys bypass RLS and are
-- explicitly outside this design. No REST fallback or new role privileges.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='security_internal.document_object_read_allowed(text)'::regprocedure
      AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(prosrc,'\s+','','g'))='1bb5e1a423735400876ea9dbde2971a5')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_document_delivery_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['clinia_document_delivery']::name[]
      AND qual='((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''object.get_authenticated''::text, ''object.get_authenticated_info''::text]) AND security_internal.document_object_read_allowed(name))')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND NOT public)<>4
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
END $preflight$;
ALTER POLICY clinia_document_delivery_read ON storage.objects USING (
  bucket_id='patient-files'
  AND storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  AND security_internal.document_object_read_allowed(name)
);
DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;


-- PINNED REFERENCE: supabase/migrations/20261006050505_private_media_origin_boundary.sql
-- Prospective canonical staging/candidate only. Run with delivery disabled.
-- This DDL does not retire historical URLs: the controlled byte/key migration
-- must populate retired keys and switch delivery_path before enabling delivery.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0'),
    ('security_internal.protect_clinical_identity()','289457d532605e80868a41ecff9ad78a'),
    ('security_internal.document_object_read_allowed(text)','1bb5e1a423735400876ea9dbde2971a5'),
    ('public.clinia_audit_document_delivery(uuid,uuid,uuid,text)','fd51db1149a6a0de8b58cfda8bd3a307'),
    ('public.clinia_document_delivery_active()','8fa375ac766bb33cd74fee65ef7c02f7')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR to_regclass('security_internal.retired_storage_objects') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.patient_files'::regclass AND attname='delivery_path' AND NOT attisdropped)
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>6
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
  -- Compare every expression, role, command and policy kind; no permissive drift.
  FOR v IN SELECT * FROM (VALUES
    ('encargo02_storage_read','SELECT','PERMISSIVE',ARRAY['authenticated']::name[],
      'public.encargo02_storage_access(bucket_id, name, false)',NULL),
    ('encargo02_storage_insert','INSERT','PERMISSIVE',ARRAY['authenticated']::name[],NULL,
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))'),
    ('encargo02_storage_update','UPDATE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))',
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))'),
    ('encargo02_storage_delete','DELETE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((bucket_id = ANY (ARRAY[''clinic-branding''::text, ''doctor-avatars''::text])) AND (owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))',NULL),
    ('clinia_no_human_clinical_object_read','SELECT','RESTRICTIVE',ARRAY['authenticated']::name[],
      '(bucket_id <> ''patient-files''::text)',NULL),
    ('clinia_document_delivery_read','SELECT','PERMISSIVE',ARRAY['clinia_document_delivery']::name[],
      '((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''storage.s3.object.get''::text, ''storage.s3.object.info''::text]) AND security_internal.document_object_read_allowed(name))',NULL)
  ) x(policyname,cmd,permissive,roles,qual,with_check) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
      AND p.policyname=v.policyname AND p.cmd=v.cmd AND p.permissive=v.permissive AND p.roles=v.roles
      AND p.qual IS NOT DISTINCT FROM v.qual AND p.with_check IS NOT DISTINCT FROM v.with_check)
    THEN RAISE EXCEPTION 'Exact reviewed Storage policy required: %',v.policyname; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.patient_files'::regclass
    AND tgname='encargo02_protect_identity' AND tgfoid='security_internal.protect_clinical_identity()'::regprocedure
    AND tgenabled='O' AND tgtype=23)
  THEN RAISE EXCEPTION 'Unchanged patient file identity trigger required'; END IF;
END $preflight$;

CREATE TABLE security_internal.retired_storage_objects (
  bucket_id text NOT NULL CHECK (bucket_id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')),
  name text NOT NULL CHECK (length(name)>0),
  retired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id,name)
);
ALTER TABLE security_internal.retired_storage_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.retired_storage_objects FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.storage_object_retired(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT EXISTS (SELECT 1 FROM security_internal.retired_storage_objects r WHERE r.bucket_id=p_bucket AND r.name=p_name);
$function$;
REVOKE ALL ON FUNCTION security_internal.storage_object_retired(text,text) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

ALTER TABLE public.patient_files ADD COLUMN delivery_path text;
UPDATE public.patient_files SET delivery_path=file_path;
ALTER TABLE public.patient_files ALTER COLUMN delivery_path SET NOT NULL;
ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_delivery_path_scope CHECK (
  delivery_path ~ ('^'||clinic_id::text||'/'||patient_id::text||'/[^/]+$')
  AND length(delivery_path)<=500 AND delivery_path NOT LIKE '%..%'
);
-- Preserve service-role privileges only on the original columns. A table-level
-- INSERT/UPDATE grant would silently confer authority over all future columns.
REVOKE INSERT,UPDATE ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at),
  UPDATE (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at)
  ON public.patient_files TO service_role;
REVOKE INSERT(delivery_path),UPDATE(delivery_path) ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.initialize_document_delivery_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  NEW.delivery_path:=NEW.file_path;
  IF security_internal.storage_object_retired('patient-files',NEW.delivery_path)
  THEN RAISE EXCEPTION 'Retired object path' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.initialize_document_delivery_path() FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
CREATE TRIGGER clinia_initialize_delivery_path BEFORE INSERT ON public.patient_files
  FOR EACH ROW EXECUTE FUNCTION security_internal.initialize_document_delivery_path();

CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT NOT security_internal.storage_object_retired(p_bucket,p_name)
    AND security_internal.storage_access(p_bucket,p_name,p_write);
$function$;

CREATE OR REPLACE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active()
    AND NOT security_internal.storage_object_retired('patient-files',p_name) AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.delivery_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;

CREATE OR REPLACE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF security_internal.storage_object_retired('patient-files',p_path)
    OR NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.delivery_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;

-- Live ACL remains the permissive policy. These restrictions only narrow it.
CREATE POLICY clinia_private_media_origin_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  );
CREATE POLICY clinia_private_media_origin_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_only_operation('storage.object.upload')
  );
CREATE POLICY clinia_private_media_no_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'))
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));
CREATE POLICY clinia_private_media_no_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));

DO $postflight$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','clinia_document_delivery'] LOOP
    IF has_column_privilege(r,'public.patient_files','delivery_path','INSERT,UPDATE')
      OR has_table_privilege(r,'security_internal.retired_storage_objects','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_function_privilege(r,'security_internal.storage_object_retired(text,text)','EXECUTE')
      OR has_function_privilege(r,'security_internal.initialize_document_delivery_path()','EXECUTE')
    THEN RAISE EXCEPTION 'Private origin boundary privilege leak for %',r; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR (SELECT md5(regexp_replace(prosrc,'\s+','','g')) FROM pg_catalog.pg_proc
      WHERE oid='security_internal.protect_clinical_identity()'::regprocedure)<>'289457d532605e80868a41ecff9ad78a'
  THEN RAISE EXCEPTION 'Authority or immutable identity boundary changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261007045223_mandatory_clinical_mfa.sql
-- Prospective MFA gate for human clinical access on the reviewed baseline.
-- The exact function hashes and explicit relation inventory abort on drift;
-- never use this as a blind repair of an occupied production database.
-- Keep clinia_session_active() unchanged so verified-email enrollment and
-- invitation redemption can finish at AAL1; clinical authority is gated here.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $preflight$
DECLARE v record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('public.clinia_session_active()')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='bd4312480311fa40dc37425aa3d1eeb9'
  ) THEN RAISE EXCEPTION 'Reviewed live-session authority prerequisite required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('security_internal.role_for(uuid,uuid)')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='feef8739b4cf30e59de0777ad1b608be'
  ) THEN RAISE EXCEPTION 'Reviewed canonical role authority prerequisite required'; END IF;

  IF to_regprocedure('public.clinia_mfa_active()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='public')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='storage' AND tablename='objects')
  THEN RAISE EXCEPTION 'MFA migration already applied; reviewed repair required'; END IF;

  -- Explicit relation inventory: require an exact match with staging's full
  -- public RLS table set. Any missing or newly added public RLS table aborts.
  IF EXISTS (
    SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
    EXCEPT SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
  ) OR EXISTS (
    SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
    EXCEPT SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Public RLS relation inventory changed; review required'; END IF;

  -- Each reviewed table must exist as an RLS-enabled public table.
  FOR v IN SELECT relation_name FROM (VALUES
    ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
    ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
    ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
    ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
    ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
    ('prescriptions')
  ) AS inventory(relation_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v.relation_name AND c.relkind IN ('r','p')
        AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Reviewed public RLS table prerequisite required: %',v.relation_name; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='storage.objects'::regclass AND c.relrowsecurity)
    OR (SELECT count(*) FROM storage.buckets
      WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline prerequisite required'; END IF;
END $preflight$;

-- The old live-session function remains an enrollment/session check. This new
-- authority additionally binds the signed AAL2 JWT to a factor still verified
-- for this same Auth user, so stale AAL2 tokens fail after factor removal.
CREATE FUNCTION public.clinia_mfa_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_session_active() IS TRUE
    AND (auth.jwt()->>'aal')='aal2'
    AND EXISTS (SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id=auth.uid() AND f.status='verified' AND f.factor_type='totp');
$function$;
REVOKE ALL ON FUNCTION public.clinia_mfa_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_mfa_active() TO authenticated;

-- A caller asking for their own clinic role must have verified MFA. A role
-- lookup for an assigned offline user and a separately gated service lookup
-- retain their existing semantics.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_mfa_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Restrictive policies clamp older permissive JWT/metadata policies for all
-- human operations on every reviewed public application table.
CREATE POLICY clinia_mfa_gate ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinics AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_invitations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patients AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.appointments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.services AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinical_records AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.hcu033_forms AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_notes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_files AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescriptions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescription_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payment_methods AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.data_rights_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.automation_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.profile_audit_log AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.billings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.treatments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.service_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());

-- The isolated document-delivery role is not a member of authenticated and is
-- deliberately unaffected. Existing patient-files human-deny policy remains
-- in force; this gate only strengthens human Storage access for the four
-- private clinic buckets.
CREATE POLICY clinia_mfa_gate ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active())
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active());

NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261019190004_gate3_payment_method_delete_restrict.sql
-- Gate 3 conservative delta. No row update, new grant, or cascading deletion.
-- Execute only through the reviewed disposable canonical package.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE c record;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
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



REVOKE USAGE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
SET LOCAL search_path=pg_catalog,public,extensions; DO $catalog_guard$
 DECLARE actual jsonb; expected jsonb := '{"types":[{"acl":"{=U/postgres,postgres=U/postgres,authenticated=U/postgres}","kind":"e","name":"app_role","owner":"postgres","labels":["clinic_owner","doctor","receptionist"],"schema":"public","default":null,"notNull":false,"baseType":null},{"acl":null,"kind":"e","name":"subscription_status","owner":"postgres","labels":["active","past_due","canceled","trial","archived"],"schema":"public","default":null,"notNull":false,"baseType":null},{"acl":"{=U/postgres,postgres=U/postgres,authenticated=U/postgres}","kind":"e","name":"user_status","owner":"postgres","labels":["invited","active","suspended"],"schema":"public","default":null,"notNull":false,"baseType":null}],"tables":[{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"access_audit","owner":"postgres","schema":"logs","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=rwU/postgres,service_role=rwU/postgres}","rls":false,"kind":"S","name":"access_audit_id_seq","owner":"postgres","schema":"logs","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"appointments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"automation_settings","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"billings","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"clinic_invitations","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"clinic_members","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"clinical_records","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,supabase_auth_admin=r/postgres}","rls":true,"kind":"r","name":"clinics","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"dashboard_stats_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT clinic_id,\n    date_trunc(''month''::text, created_at) AS month,\n    count(id) AS total_billings,\n    sum(amount) AS total_revenue,\n    count(DISTINCT patient_id) AS unique_patients_billed\n   FROM billings\n  WHERE clinic_id = (((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text)::uuid)\n  GROUP BY clinic_id, (date_trunc(''month''::text, created_at));"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"data_rights_requests","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"hcu033_forms","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"invoices","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"messages","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"notifications","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=rdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"patient_files","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"patient_notes","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"patient_stats_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT p.id AS patient_id,\n    p.clinic_id,\n    count(DISTINCT a.id) AS appointment_count,\n    COALESCE(sum(b.amount), 0::numeric) AS total_billed\n   FROM patients p\n     LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = ''completed''::text\n     LEFT JOIN billings b ON b.patient_id = p.id AND b.status = ''paid''::text\n  GROUP BY p.id, p.clinic_id;"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"patients","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"payment_methods","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"payments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"prescription_templates","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"prescriptions","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"profile_audit_log","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=rwU/postgres,service_role=rwU/postgres}","rls":false,"kind":"S","name":"profile_audit_log_id_seq","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,supabase_auth_admin=r/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"profiles","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"recall_queue","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT id,\n    clinic_id,\n    first_name,\n    last_name,\n    phone,\n    email,\n    COALESCE(medical_alerts, ''''::text) AS medical_alerts,\n    created_at\n   FROM patients\n  WHERE deleted_at IS NULL;"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":false,"kind":"v","name":"receptionist_patient_view","owner":"postgres","schema":"public","options":["security_invoker=true"],"forceRls":false,"definition":" SELECT p.id AS patient_id,\n    p.clinic_id,\n    p.first_name,\n    p.last_name,\n    p.phone,\n    p.email,\n    max(cr.created_at) AS last_visit_date\n   FROM patients p\n     LEFT JOIN clinical_records cr ON p.id = cr.patient_id\n  GROUP BY p.id, p.clinic_id, p.first_name, p.last_name, p.phone, p.email\n HAVING max(cr.created_at) < (now() - ''6 mons''::interval) OR max(cr.created_at) IS NULL;"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"kind":"r","name":"service_categories","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"services","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","name":"treatments","owner":"postgres","schema":"public","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"appointment_events","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"clinic_registration_intents","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"document_delivery_audit","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"document_delivery_principals","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"email_abuse_budgets","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"kind":"r","name":"retired_storage_objects","owner":"postgres","schema":"security_internal","options":null,"forceRls":false,"definition":null}],"columns":[{"acl":null,"name":"id","type":"bigint","table":"logs.access_audit","default":null,"notNull":true,"identity":"d","position":1,"generated":""},{"acl":null,"name":"timestamp","type":"timestamp with time zone","table":"logs.access_audit","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"actor_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"actor_role","type":"text","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"action","type":"text","table":"logs.access_audit","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"table_name","type":"text","table":"logs.access_audit","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"record_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"metadata","type":"jsonb","table":"logs.access_audit","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.appointments","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.appointments","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.appointments","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.appointments","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"start_time","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"end_time","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.appointments","default":"''scheduled''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.appointments","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"notes","type":"text","table":"public.appointments","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.appointments","default":null,"notNull":true,"identity":"","position":10,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.appointments","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.automation_settings","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.automation_settings","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.automation_settings","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"enabled","type":"boolean","table":"public.automation_settings","default":"false","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"reminder_template","type":"text","table":"public.automation_settings","default":"''Hola {patient_name}, te recordamos tu cita el {date} a las {time} con el Dr. {doctor_name}.''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"days_before","type":"integer","table":"public.automation_settings","default":"1","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"whatsapp_enabled","type":"boolean","table":"public.automation_settings","default":"false","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"email_enabled","type":"boolean","table":"public.automation_settings","default":"true","notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.billings","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.billings","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.billings","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"amount","type":"numeric","table":"public.billings","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.billings","default":"''pending''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"description","type":"text","table":"public.billings","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"due_date","type":"date","table":"public.billings","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"invoice_number","type":"text","table":"public.billings","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"appointment_id","type":"uuid","table":"public.billings","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.billings","default":null,"notNull":true,"identity":"","position":10,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.billings","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinic_invitations","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"role","type":"text","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"invited_by","type":"uuid","table":"public.clinic_invitations","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.clinic_invitations","default":"''pending''::text","notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"token","type":"text","table":"public.clinic_invitations","default":"encode(gen_random_bytes(32), ''hex''::text)","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinic_invitations","default":"now()","notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"expires_at","type":"timestamp with time zone","table":"public.clinic_invitations","default":"(now() + ''7 days''::interval)","notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"auth_ready","type":"boolean","table":"public.clinic_invitations","default":"false","notNull":true,"identity":"","position":10,"generated":""},{"acl":null,"name":"accepted_by","type":"uuid","table":"public.clinic_invitations","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"accepted_at","type":"timestamp with time zone","table":"public.clinic_invitations","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinic_members","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.clinic_members","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.clinic_members","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"role","type":"text","table":"public.clinic_members","default":"''doctor''::text","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinic_members","default":"now()","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.clinic_members","default":"''active''::text","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.clinical_records","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.clinical_records","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.clinical_records","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":"{authenticated=a/postgres}","name":"patient_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=a/postgres}","name":"doctor_id","type":"uuid","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"diagnosis","type":"bytea","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"treatment_plan","type":"text","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"xray_urls","type":"text[]","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"notes","type":"text","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":"{authenticated=w/postgres}","name":"deleted_at","type":"timestamp with time zone","table":"public.clinical_records","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"odontogram_state","type":"jsonb","table":"public.clinical_records","default":"''{}''::jsonb","notNull":false,"identity":"","position":12,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"periodontogram_state","type":"jsonb","table":"public.clinical_records","default":"''{}''::jsonb","notNull":false,"identity":"","position":13,"generated":""},{"acl":"{authenticated=r/postgres}","name":"id","type":"uuid","table":"public.clinics","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=r/postgres}","name":"created_at","type":"timestamp with time zone","table":"public.clinics","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"name","type":"text","table":"public.clinics","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=r/postgres}","name":"owner_id","type":"uuid","table":"public.clinics","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"logo_url","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"address","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"phone","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"email","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":"{authenticated=r/postgres}","name":"settings","type":"jsonb","table":"public.clinics","default":"''{}''::jsonb","notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"disclaimer_text","type":"text","table":"public.clinics","default":"''This estimate is valid for 30 days. Please contact the front desk for questions.''::text","notNull":false,"identity":"","position":10,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"working_hours","type":"jsonb","table":"public.clinics","default":"''{\"fri\": [\"09:00\", \"17:00\"], \"mon\": [\"09:00\", \"17:00\"], \"sat\": null, \"sun\": null, \"thu\": [\"09:00\", \"17:00\"], \"tue\": [\"09:00\", \"17:00\"], \"wed\": [\"09:00\", \"17:00\"]}''::jsonb","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"subscription_tier","type":"text","table":"public.clinics","default":"''trial''::text","notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"trial_ends_at","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"bypass_subscription","type":"boolean","table":"public.clinics","default":"false","notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"subscription_status","type":"subscription_status","table":"public.clinics","default":"''trial''::subscription_status","notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"kushki_subscription_id","type":"text","table":"public.clinics","default":null,"notNull":false,"identity":"","position":16,"generated":""},{"acl":null,"name":"next_billing_date","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":17,"generated":""},{"acl":null,"name":"archived_at","type":"timestamp with time zone","table":"public.clinics","default":null,"notNull":false,"identity":"","position":18,"generated":""},{"acl":"{authenticated=r/postgres}","name":"size","type":"character varying(50)","table":"public.clinics","default":null,"notNull":false,"identity":"","position":19,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"month","type":"timestamp with time zone","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"total_billings","type":"bigint","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"total_revenue","type":"numeric","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"unique_patients_billed","type":"bigint","table":"public.dashboard_stats_view","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.data_rights_requests","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=a/postgres}","name":"user_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"patient_id","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":"{authenticated=a/postgres}","name":"request_type","type":"text","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=w/postgres}","name":"status","type":"text","table":"public.data_rights_requests","default":"''pending''::text","notNull":true,"identity":"","position":6,"generated":""},{"acl":"{authenticated=a/postgres}","name":"details","type":"jsonb","table":"public.data_rights_requests","default":"''{}''::jsonb","notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=a/postgres}","name":"legal_basis","type":"text","table":"public.data_rights_requests","default":null,"notNull":true,"identity":"","position":8,"generated":""},{"acl":"{authenticated=a/postgres}","name":"retention_note","type":"text","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"requested_by_email","type":"text","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"resolved_by","type":"uuid","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"resolved_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":"now()","notNull":true,"identity":"","position":13,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.data_rights_requests","default":"now()","notNull":true,"identity":"","position":14,"generated":""},{"acl":"{authenticated=w/postgres}","name":"resolution_notes","type":"text","table":"public.data_rights_requests","default":null,"notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.hcu033_forms","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"patient_id","type":"uuid","table":"public.hcu033_forms","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":"{authenticated=a/postgres}","name":"doctor_id","type":"uuid","table":"public.hcu033_forms","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"form_data","type":"jsonb","table":"public.hcu033_forms","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.hcu033_forms","default":null,"notNull":true,"identity":"","position":7,"generated":""},{"acl":"{authenticated=w/postgres}","name":"deleted_at","type":"timestamp with time zone","table":"public.hcu033_forms","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.invoices","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.invoices","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.invoices","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.invoices","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"billing_id","type":"uuid","table":"public.invoices","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"invoice_number","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"sri_authorization","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"sri_access_key","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"xml_content","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"pdf_url","type":"text","table":"public.invoices","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.invoices","default":"''draft''::text","notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"total_amount","type":"numeric","table":"public.invoices","default":null,"notNull":true,"identity":"","position":12,"generated":""},{"acl":null,"name":"items","type":"jsonb","table":"public.invoices","default":"''[]''::jsonb","notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"sri_authorization_date","type":"timestamp with time zone","table":"public.invoices","default":null,"notNull":false,"identity":"","position":14,"generated":""},{"acl":null,"name":"environment","type":"text","table":"public.invoices","default":"''TEST''::text","notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.messages","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.messages","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"sender_id","type":"uuid","table":"public.messages","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"receiver_id","type":"uuid","table":"public.messages","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"content","type":"text","table":"public.messages","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"is_read","type":"boolean","table":"public.messages","default":"false","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.messages","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.notifications","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.notifications","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.notifications","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"title","type":"text","table":"public.notifications","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"message","type":"text","table":"public.notifications","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.notifications","default":"''info''::text","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"is_read","type":"boolean","table":"public.notifications","default":"false","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"link","type":"text","table":"public.notifications","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":"{service_role=aw/postgres}","name":"id","type":"uuid","table":"public.patient_files","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{service_role=aw/postgres}","name":"created_at","type":"timestamp with time zone","table":"public.patient_files","default":"now()","notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"patient_id","type":"uuid","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"clinic_id","type":"uuid","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":"{authenticated=aw/postgres,service_role=aw/postgres}","name":"name","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"file_path","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"size","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":7,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"type","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":8,"generated":""},{"acl":"{authenticated=a/postgres,service_role=aw/postgres}","name":"uploaded_by","type":"uuid","table":"public.patient_files","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=w/postgres,service_role=aw/postgres}","name":"deleted_at","type":"timestamp with time zone","table":"public.patient_files","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"delivery_path","type":"text","table":"public.patient_files","default":null,"notNull":true,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.patient_notes","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.patient_notes","default":"now()","notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=a/postgres}","name":"patient_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"content","type":"text","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=a/postgres}","name":"author_id","type":"uuid","table":"public.patient_notes","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":"{authenticated=w/postgres}","name":"deleted_at","type":"timestamp with time zone","table":"public.patient_notes","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"appointment_count","type":"bigint","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"total_billed","type":"numeric","table":"public.patient_stats_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":"{authenticated=r/postgres}","name":"id","type":"uuid","table":"public.patients","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=r/postgres}","name":"created_at","type":"timestamp with time zone","table":"public.patients","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"first_name","type":"text","table":"public.patients","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"last_name","type":"text","table":"public.patients","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"cedula","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"email","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"phone","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"birth_date","type":"date","table":"public.patients","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"gender","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"address","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"medical_history","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":11,"generated":""},{"acl":"{authenticated=ar/postgres}","name":"clinic_id","type":"uuid","table":"public.patients","default":null,"notNull":true,"identity":"","position":12,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"emergency_contact","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"emergency_phone","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":14,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"allergies","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":15,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"medications","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":16,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"medical_conditions","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":17,"generated":""},{"acl":null,"name":"insurance_provider","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":18,"generated":""},{"acl":null,"name":"policy_number","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":19,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"deleted_at","type":"timestamp with time zone","table":"public.patients","default":null,"notNull":false,"identity":"","position":20,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"medical_alerts","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":21,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"occupation","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":22,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"guardian_name","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":23,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"referral_source","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":24,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"referred_by","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":25,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"clinical_notes","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":26,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"medical_record_number","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":27,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"tags","type":"text[]","table":"public.patients","default":null,"notNull":false,"identity":"","position":28,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"status","type":"text","table":"public.patients","default":"''active''::text","notNull":false,"identity":"","position":29,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"blood_type","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":30,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"marital_status","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":31,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"city","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":32,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"state","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":33,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"has_diabetes","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":34,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"has_hypertension","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":35,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"has_heart_disease","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":36,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"is_smoker","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":37,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"is_pregnant","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":38,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"preferred_contact_method","type":"text","table":"public.patients","default":"''phone''::text","notNull":false,"identity":"","position":39,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"recall_months","type":"integer","table":"public.patients","default":"6","notNull":false,"identity":"","position":40,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"family_representative_id","type":"uuid","table":"public.patients","default":null,"notNull":false,"identity":"","position":41,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"internal_notes","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":42,"generated":""},{"acl":null,"name":"account_balance","type":"numeric","table":"public.patients","default":"0","notNull":false,"identity":"","position":43,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"family_relationship","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":44,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"is_family_head","type":"boolean","table":"public.patients","default":"false","notNull":false,"identity":"","position":45,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"last_treatment_note","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":46,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"odontogram_state","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":47,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"avatar_url","type":"text","table":"public.patients","default":null,"notNull":false,"identity":"","position":48,"generated":""},{"acl":"{authenticated=arw/postgres}","name":"periodontogram_state","type":"jsonb","table":"public.patients","default":"''{}''::jsonb","notNull":false,"identity":"","position":49,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"updated_at","type":"timestamp with time zone","table":"public.patients","default":"now()","notNull":false,"identity":"","position":50,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.payment_methods","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"doctor_id","type":"uuid","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"type","type":"text","table":"public.payment_methods","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"title","type":"text","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"config","type":"jsonb","table":"public.payment_methods","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"is_active","type":"boolean","table":"public.payment_methods","default":"true","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.payment_methods","default":"now()","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.payment_methods","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.payments","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.payments","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.payments","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"amount","type":"numeric(10,2)","table":"public.payments","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"currency","type":"text","table":"public.payments","default":"''USD''::text","notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"status","type":"text","table":"public.payments","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"provider","type":"text","table":"public.payments","default":"''kushki''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"provider_transaction_id","type":"text","table":"public.payments","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"metadata","type":"jsonb","table":"public.payments","default":"''{}''::jsonb","notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.prescription_templates","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.prescription_templates","default":"now()","notNull":false,"identity":"","position":2,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.prescription_templates","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"doctor_id","type":"uuid","table":"public.prescription_templates","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"name","type":"text","table":"public.prescription_templates","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"data","type":"jsonb","table":"public.prescription_templates","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":"{authenticated=a/postgres}","name":"id","type":"uuid","table":"public.prescriptions","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.prescriptions","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=a/postgres}","name":"patient_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=a/postgres}","name":"doctor_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.prescriptions","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=a/postgres}","name":"data","type":"jsonb","table":"public.prescriptions","default":"''{}''::jsonb","notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"issuance_snapshot","type":"jsonb","table":"public.prescriptions","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"id","type":"bigint","table":"public.profile_audit_log","default":"nextval(''profile_audit_log_id_seq''::regclass)","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"target_user_id","type":"uuid","table":"public.profile_audit_log","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"actor_user_id","type":"uuid","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"actor_role","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"action","type":"text","table":"public.profile_audit_log","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"old_data","type":"jsonb","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"new_data","type":"jsonb","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"changed_fields","type":"text[]","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"ip_address","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"user_agent","type":"text","table":"public.profile_audit_log","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.profile_audit_log","default":"now()","notNull":true,"identity":"","position":11,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.profiles","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=w/postgres}","name":"full_name","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"role","type":"app_role","table":"public.profiles","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":"{authenticated=w/postgres}","name":"avatar_url","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=w/postgres}","name":"phone","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=w/postgres}","name":"address","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"specialization","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"license_number","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":"{authenticated=w/postgres}","name":"bio","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":10,"generated":""},{"acl":"{authenticated=w/postgres}","name":"updated_at","type":"timestamp with time zone","table":"public.profiles","default":null,"notNull":false,"identity":"","position":11,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.profiles","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"deleted_at","type":"timestamp with time zone","table":"public.profiles","default":null,"notNull":false,"identity":"","position":13,"generated":""},{"acl":null,"name":"status","type":"user_status","table":"public.profiles","default":"''active''::user_status","notNull":false,"identity":"","position":14,"generated":""},{"acl":"{authenticated=w/postgres}","name":"title","type":"text","table":"public.profiles","default":null,"notNull":false,"identity":"","position":15,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"first_name","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"last_name","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"medical_alerts","type":"text","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.recall_queue","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":2,"generated":""},{"acl":null,"name":"first_name","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"last_name","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"phone","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"email","type":"text","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"last_visit_date","type":"timestamp with time zone","table":"public.receptionist_patient_view","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.service_categories","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=a/postgres}","name":"clinic_id","type":"uuid","table":"public.service_categories","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"name","type":"text","table":"public.service_categories","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=aw/postgres}","name":"color","type":"text","table":"public.service_categories","default":"''#145247''::text","notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.service_categories","default":"now()","notNull":false,"identity":"","position":5,"generated":""},{"acl":"{authenticated=r/postgres}","name":"id","type":"uuid","table":"public.services","default":"uuid_generate_v4()","notNull":true,"identity":"","position":1,"generated":""},{"acl":"{authenticated=r/postgres}","name":"clinic_id","type":"uuid","table":"public.services","default":"(((auth.jwt() -> ''app_metadata''::text) ->> ''clinic_id''::text))::uuid","notNull":true,"identity":"","position":2,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"name","type":"text","table":"public.services","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"description","type":"text","table":"public.services","default":null,"notNull":false,"identity":"","position":4,"generated":""},{"acl":null,"name":"price","type":"numeric(10,2)","table":"public.services","default":"0.00","notNull":true,"identity":"","position":5,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"duration_minutes","type":"integer","table":"public.services","default":"30","notNull":false,"identity":"","position":6,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"category","type":"text","table":"public.services","default":"''General''::text","notNull":false,"identity":"","position":7,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"is_active","type":"boolean","table":"public.services","default":"true","notNull":false,"identity":"","position":8,"generated":""},{"acl":"{authenticated=r/postgres}","name":"created_at","type":"timestamp with time zone","table":"public.services","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":9,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"updated_at","type":"timestamp with time zone","table":"public.services","default":"timezone(''utc''::text, now())","notNull":true,"identity":"","position":10,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"color","type":"text","table":"public.services","default":"''#145247''::text","notNull":false,"identity":"","position":11,"generated":""},{"acl":"{authenticated=rw/postgres}","name":"category_id","type":"uuid","table":"public.services","default":null,"notNull":false,"identity":"","position":12,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"public.treatments","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"name","type":"text","table":"public.treatments","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"price","type":"numeric","table":"public.treatments","default":"0","notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"duration","type":"integer","table":"public.treatments","default":"30","notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"description","type":"text","table":"public.treatments","default":null,"notNull":false,"identity":"","position":5,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"public.treatments","default":"now()","notNull":false,"identity":"","position":6,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"public.treatments","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"public.treatments","default":null,"notNull":false,"identity":"","position":8,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"security_internal.appointment_events","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"appointment_id","type":"uuid","table":"security_internal.appointment_events","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"security_internal.appointment_events","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"actor_id","type":"uuid","table":"security_internal.appointment_events","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"happened_at","type":"timestamp with time zone","table":"security_internal.appointment_events","default":"now()","notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"operation","type":"text","table":"security_internal.appointment_events","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"before_values","type":"jsonb","table":"security_internal.appointment_events","default":null,"notNull":false,"identity":"","position":7,"generated":""},{"acl":null,"name":"after_values","type":"jsonb","table":"security_internal.appointment_events","default":null,"notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"email","type":"text","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"name","type":"text","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"address","type":"text","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"phone","type":"text","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"size","type":"text","table":"security_internal.clinic_registration_intents","default":null,"notNull":true,"identity":"","position":7,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"security_internal.clinic_registration_intents","default":"now()","notNull":true,"identity":"","position":8,"generated":""},{"acl":null,"name":"completed_at","type":"timestamp with time zone","table":"security_internal.clinic_registration_intents","default":null,"notNull":false,"identity":"","position":9,"generated":""},{"acl":null,"name":"id","type":"uuid","table":"security_internal.document_delivery_audit","default":"gen_random_uuid()","notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"authorized_at","type":"timestamp with time zone","table":"security_internal.document_delivery_audit","default":"now()","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"actor_id","type":"uuid","table":"security_internal.document_delivery_audit","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"clinic_id","type":"uuid","table":"security_internal.document_delivery_audit","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"patient_id","type":"uuid","table":"security_internal.document_delivery_audit","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"file_id","type":"uuid","table":"security_internal.document_delivery_audit","default":null,"notNull":true,"identity":"","position":6,"generated":""},{"acl":null,"name":"user_id","type":"uuid","table":"security_internal.document_delivery_principals","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"enabled","type":"boolean","table":"security_internal.document_delivery_principals","default":"false","notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"expires_at","type":"timestamp with time zone","table":"security_internal.document_delivery_principals","default":null,"notNull":false,"identity":"","position":3,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","table":"security_internal.document_delivery_principals","default":"now()","notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"scope","type":"text","table":"security_internal.email_abuse_budgets","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"key_hash","type":"text","table":"security_internal.email_abuse_budgets","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"window_start","type":"timestamp with time zone","table":"security_internal.email_abuse_budgets","default":null,"notNull":true,"identity":"","position":3,"generated":""},{"acl":null,"name":"expires_at","type":"timestamp with time zone","table":"security_internal.email_abuse_budgets","default":null,"notNull":true,"identity":"","position":4,"generated":""},{"acl":null,"name":"attempts","type":"integer","table":"security_internal.email_abuse_budgets","default":null,"notNull":true,"identity":"","position":5,"generated":""},{"acl":null,"name":"bucket_id","type":"text","table":"security_internal.retired_storage_objects","default":null,"notNull":true,"identity":"","position":1,"generated":""},{"acl":null,"name":"name","type":"text","table":"security_internal.retired_storage_objects","default":null,"notNull":true,"identity":"","position":2,"generated":""},{"acl":null,"name":"retired_at","type":"timestamp with time zone","table":"security_internal.retired_storage_objects","default":"now()","notNull":true,"identity":"","position":3,"generated":""}],"indexes":[{"name":"access_audit_pkey","ready":true,"valid":true,"schema":"logs","definition":"CREATE UNIQUE INDEX access_audit_pkey ON logs.access_audit USING btree (id)"},{"name":"idx_access_audit_clinic_id","ready":true,"valid":true,"schema":"logs","definition":"CREATE INDEX idx_access_audit_clinic_id ON logs.access_audit USING btree (clinic_id)"},{"name":"agenda_no_overlap","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX agenda_no_overlap ON public.appointments USING gist (clinic_id, doctor_id, tstzrange(start_time, end_time, ''[)''::text)) WHERE ((deleted_at IS NULL) AND (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''arrived''::text])))"},{"name":"agenda_visible_range","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX agenda_visible_range ON public.appointments USING btree (clinic_id, start_time) WHERE (deleted_at IS NULL)"},{"name":"appointments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id)"},{"name":"automation_settings_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX automation_settings_pkey ON public.automation_settings USING btree (id)"},{"name":"billings_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX billings_pkey ON public.billings USING btree (id)"},{"name":"clinic_invitations_one_pending_email_idx","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_one_pending_email_idx ON public.clinic_invitations USING btree (clinic_id, lower(email)) WHERE (status = ''pending''::text)"},{"name":"clinic_invitations_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_pkey ON public.clinic_invitations USING btree (id)"},{"name":"clinic_invitations_token_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_invitations_token_key ON public.clinic_invitations USING btree (token)"},{"name":"clinic_members_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_members_pkey ON public.clinic_members USING btree (id)"},{"name":"clinic_members_user_id_clinic_id_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinic_members_user_id_clinic_id_key ON public.clinic_members USING btree (user_id, clinic_id)"},{"name":"clinical_records_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinical_records_pkey ON public.clinical_records USING btree (id)"},{"name":"clinics_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX clinics_pkey ON public.clinics USING btree (id)"},{"name":"data_rights_requests_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX data_rights_requests_pkey ON public.data_rights_requests USING btree (id)"},{"name":"hcu033_forms_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX hcu033_forms_pkey ON public.hcu033_forms USING btree (id)"},{"name":"idx_appointments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_clinic_id ON public.appointments USING btree (clinic_id)"},{"name":"idx_appointments_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_clinic_patient ON public.appointments USING btree (clinic_id, patient_id)"},{"name":"idx_appointments_clinic_start","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_clinic_start ON public.appointments USING btree (clinic_id, start_time)"},{"name":"idx_appointments_conflict","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_conflict ON public.appointments USING btree (clinic_id, doctor_id, start_time, end_time) WHERE (status <> ''cancelled''::text)"},{"name":"idx_appointments_patient_doctor","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_appointments_patient_doctor ON public.appointments USING btree (clinic_id, patient_id, doctor_id)"},{"name":"idx_billings_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_billings_clinic_id ON public.billings USING btree (clinic_id)"},{"name":"idx_billings_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_billings_clinic_patient ON public.billings USING btree (clinic_id, patient_id)"},{"name":"idx_clinic_invitations_email","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_invitations_email ON public.clinic_invitations USING btree (email)"},{"name":"idx_clinic_invitations_status","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_invitations_status ON public.clinic_invitations USING btree (status)"},{"name":"idx_clinic_members_auth_lookup","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinic_members_auth_lookup ON public.clinic_members USING btree (user_id, clinic_id, status)"},{"name":"idx_clinical_records_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinical_records_clinic_id ON public.clinical_records USING btree (clinic_id)"},{"name":"idx_clinical_records_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_clinical_records_clinic_patient ON public.clinical_records USING btree (clinic_id, patient_id)"},{"name":"idx_data_rights_requests_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_data_rights_requests_clinic_patient ON public.data_rights_requests USING btree (clinic_id, patient_id)"},{"name":"idx_data_rights_requests_tenant","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_data_rights_requests_tenant ON public.data_rights_requests USING btree (clinic_id, created_at DESC)"},{"name":"idx_data_rights_requests_type","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_data_rights_requests_type ON public.data_rights_requests USING btree (clinic_id, request_type)"},{"name":"idx_hcu033_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_hcu033_clinic_patient ON public.hcu033_forms USING btree (clinic_id, patient_id)"},{"name":"idx_hcu033_forms_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_hcu033_forms_clinic_id ON public.hcu033_forms USING btree (clinic_id)"},{"name":"idx_hcu033_forms_tenant_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_hcu033_forms_tenant_patient ON public.hcu033_forms USING btree (clinic_id, patient_id)"},{"name":"idx_invoices_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_invoices_clinic_id ON public.invoices USING btree (clinic_id)"},{"name":"idx_invoices_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_invoices_clinic_patient ON public.invoices USING btree (clinic_id, patient_id)"},{"name":"idx_messages_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_messages_clinic_id ON public.messages USING btree (clinic_id)"},{"name":"idx_patient_files_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_files_clinic_patient ON public.patient_files USING btree (clinic_id, patient_id)"},{"name":"idx_patient_files_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_files_patient ON public.patient_files USING btree (patient_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patient_notes_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_notes_clinic_patient ON public.patient_notes USING btree (clinic_id, patient_id)"},{"name":"idx_patient_notes_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patient_notes_patient ON public.patient_notes USING btree (patient_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patients_clinic_cedula","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_clinic_cedula ON public.patients USING btree (clinic_id, cedula)"},{"name":"idx_patients_clinic_deleted","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_clinic_deleted ON public.patients USING btree (clinic_id) WHERE (deleted_at IS NULL)"},{"name":"idx_patients_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_clinic_id ON public.patients USING btree (clinic_id)"},{"name":"idx_patients_email","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_email ON public.patients USING btree (email)"},{"name":"idx_patients_family_rep","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_patients_family_rep ON public.patients USING btree (family_representative_id)"},{"name":"idx_payment_methods_clinic_active","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payment_methods_clinic_active ON public.payment_methods USING btree (clinic_id, is_active)"},{"name":"idx_payment_methods_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payment_methods_clinic_id ON public.payment_methods USING btree (clinic_id)"},{"name":"idx_payments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_payments_clinic_id ON public.payments USING btree (clinic_id)"},{"name":"idx_prescriptions_clinic_created","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_prescriptions_clinic_created ON public.prescriptions USING btree (clinic_id, created_at DESC)"},{"name":"idx_prescriptions_clinic_patient","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_prescriptions_clinic_patient ON public.prescriptions USING btree (clinic_id, patient_id)"},{"name":"idx_prescriptions_tenant_doctor","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_prescriptions_tenant_doctor ON public.prescriptions USING btree (clinic_id, doctor_id, patient_id)"},{"name":"idx_profiles_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_profiles_clinic_id ON public.profiles USING btree (clinic_id)"},{"name":"idx_services_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_services_clinic_id ON public.services USING btree (clinic_id)"},{"name":"idx_treatments_clinic_id","ready":true,"valid":true,"schema":"public","definition":"CREATE INDEX idx_treatments_clinic_id ON public.treatments USING btree (clinic_id)"},{"name":"invoices_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id)"},{"name":"messages_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id)"},{"name":"notifications_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)"},{"name":"patient_files_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patient_files_pkey ON public.patient_files USING btree (id)"},{"name":"patient_notes_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patient_notes_pkey ON public.patient_notes USING btree (id)"},{"name":"patients_cedula_clinic_unique","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patients_cedula_clinic_unique ON public.patients USING btree (cedula, clinic_id)"},{"name":"patients_id_clinic_id_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patients_id_clinic_id_key ON public.patients USING btree (id, clinic_id)"},{"name":"patients_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (id)"},{"name":"payment_methods_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX payment_methods_pkey ON public.payment_methods USING btree (id)"},{"name":"payments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id)"},{"name":"prescription_templates_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX prescription_templates_pkey ON public.prescription_templates USING btree (id)"},{"name":"prescriptions_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX prescriptions_pkey ON public.prescriptions USING btree (id)"},{"name":"profile_audit_log_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profile_audit_log_pkey ON public.profile_audit_log USING btree (id)"},{"name":"profiles_email_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email) WHERE (email IS NOT NULL)"},{"name":"profiles_license_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_license_key ON public.profiles USING btree (license_number) WHERE (license_number IS NOT NULL)"},{"name":"profiles_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"},{"name":"service_categories_clinic_id_name_key","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX service_categories_clinic_id_name_key ON public.service_categories USING btree (clinic_id, name)"},{"name":"service_categories_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX service_categories_pkey ON public.service_categories USING btree (id)"},{"name":"services_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX services_pkey ON public.services USING btree (id)"},{"name":"treatments_pkey","ready":true,"valid":true,"schema":"public","definition":"CREATE UNIQUE INDEX treatments_pkey ON public.treatments USING btree (id)"},{"name":"appointment_events_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX appointment_events_pkey ON security_internal.appointment_events USING btree (id)"},{"name":"clinic_registration_intents_clinic_id_key","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX clinic_registration_intents_clinic_id_key ON security_internal.clinic_registration_intents USING btree (clinic_id)"},{"name":"clinic_registration_intents_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX clinic_registration_intents_pkey ON security_internal.clinic_registration_intents USING btree (user_id)"},{"name":"document_delivery_audit_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX document_delivery_audit_pkey ON security_internal.document_delivery_audit USING btree (id)"},{"name":"document_delivery_principals_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX document_delivery_principals_pkey ON security_internal.document_delivery_principals USING btree (user_id)"},{"name":"email_abuse_budget_expiry_idx","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE INDEX email_abuse_budget_expiry_idx ON security_internal.email_abuse_budgets USING btree (expires_at)"},{"name":"email_abuse_budgets_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX email_abuse_budgets_pkey ON security_internal.email_abuse_budgets USING btree (scope, key_hash, window_start)"},{"name":"retired_storage_objects_pkey","ready":true,"valid":true,"schema":"security_internal","definition":"CREATE UNIQUE INDEX retired_storage_objects_pkey ON security_internal.retired_storage_objects USING btree (bucket_id, name)"}],"schemas":[{"acl":"{postgres=UC/postgres}","name":"logs","owner":"postgres"},{"acl":"{pg_database_owner=UC/pg_database_owner,postgres=U/pg_database_owner,supabase_auth_admin=U/pg_database_owner,clinia_document_delivery=U/pg_database_owner}","name":"public","owner":"pg_database_owner"},{"acl":"{postgres=UC/postgres,clinia_document_delivery=U/postgres}","name":"security_internal","owner":"postgres"}],"database":"postgres","defaults":[{"acl":"{postgres=X/postgres}","type":"f","owner":"postgres","schema":""},{"acl":"{postgres=rwU/postgres,service_role=rwU/postgres}","type":"S","owner":"postgres","schema":"public"},{"acl":"{postgres=X/postgres,service_role=X/postgres}","type":"f","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","type":"r","owner":"postgres","schema":"public"},{"acl":"{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}","type":"S","owner":"supabase_admin","schema":"public"},{"acl":"{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}","type":"f","owner":"supabase_admin","schema":"public"},{"acl":"{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}","type":"r","owner":"supabase_admin","schema":"public"}],"policies":[{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"appointments","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"encargo02_appointments_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"encargo02_appointments_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"appointments","permissive":"PERMISSIVE","policyname":"encargo02_appointments_update","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"automation_settings","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"billings","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"clinic_invitations","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"clinic_members","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"SELECT","qual":"(clinia_session_active() AND ((user_id = auth.uid()) OR (get_clinic_member_role(clinic_id) = ''clinic_owner''::text)))","roles":["authenticated"],"tablename":"clinic_members","permissive":"PERMISSIVE","policyname":"encargo02_members_read","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"clinical_records","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (doctor_id = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))","roles":["authenticated"],"tablename":"clinical_records","permissive":"PERMISSIVE","policyname":"encargo02_clinical_update","schemaname":"public","with_check":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"clinics","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"SELECT","qual":"is_clinic_member(id)","roles":["authenticated"],"tablename":"clinics","permissive":"PERMISSIVE","policyname":"encargo02_clinics_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(get_clinic_member_role(id) = ''clinic_owner''::text)","roles":["authenticated"],"tablename":"clinics","permissive":"PERMISSIVE","policyname":"encargo02_clinics_update","schemaname":"public","with_check":"(get_clinic_member_role(id) = ''clinic_owner''::text)"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"data_rights_requests","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"encargo02_rights_insert","schemaname":"public","with_check":"(is_clinic_member(clinic_id) AND (user_id = auth.uid()) AND (status = ''pending''::text) AND (resolved_by IS NULL) AND (resolved_at IS NULL) AND (resolution_notes IS NULL))"},{"cmd":"SELECT","qual":"(is_clinic_member(clinic_id) AND ((user_id = auth.uid()) OR (get_clinic_member_role(clinic_id) = ''clinic_owner''::text)))","roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"encargo02_rights_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)","roles":["authenticated"],"tablename":"data_rights_requests","permissive":"PERMISSIVE","policyname":"encargo02_rights_update","schemaname":"public","with_check":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (doctor_id = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))","roles":["authenticated"],"tablename":"hcu033_forms","permissive":"PERMISSIVE","policyname":"encargo02_clinical_update","schemaname":"public","with_check":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"invoices","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"messages","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"notifications","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"patient_files","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (uploaded_by = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (uploaded_by = auth.uid()))))","roles":["authenticated"],"tablename":"patient_files","permissive":"PERMISSIVE","policyname":"encargo02_clinical_update","schemaname":"public","with_check":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (uploaded_by = auth.uid()))))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"patient_notes","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (author_id = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (author_id = auth.uid()))))","roles":["authenticated"],"tablename":"patient_notes","permissive":"PERMISSIVE","policyname":"encargo02_clinical_update","schemaname":"public","with_check":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (author_id = auth.uid()))))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"patients","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"encargo02_patients_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"encargo02_patients_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"patients","permissive":"PERMISSIVE","policyname":"encargo02_patients_update","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"payment_methods","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"payments","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"prescription_templates","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (doctor_id = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))","roles":["authenticated"],"tablename":"prescription_templates","permissive":"PERMISSIVE","policyname":"encargo02_clinical_update","schemaname":"public","with_check":"(check_subscription_active(clinic_id) AND ((get_clinic_member_role(clinic_id) = ''clinic_owner''::text) OR ((get_clinic_member_role(clinic_id) = ''doctor''::text) AND (doctor_id = auth.uid()))))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"prescriptions","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"encargo02_clinical_insert","schemaname":"public","with_check":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id) AND (doctor_id = auth.uid()))"},{"cmd":"SELECT","qual":"((get_clinic_member_role(clinic_id) = ANY (ARRAY[''doctor''::text, ''clinic_owner''::text])) AND check_subscription_active(clinic_id))","roles":["authenticated"],"tablename":"prescriptions","permissive":"PERMISSIVE","policyname":"encargo02_clinical_read","schemaname":"public","with_check":null},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"profile_audit_log","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"profiles","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"SELECT","qual":"((id = auth.uid()) AND clinia_session_active())","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"encargo02_profile_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"((id = auth.uid()) AND clinia_session_active() AND ((status)::text = ''active''::text) AND (deleted_at IS NULL))","roles":["authenticated"],"tablename":"profiles","permissive":"PERMISSIVE","policyname":"encargo02_profile_update","schemaname":"public","with_check":"((id = auth.uid()) AND clinia_session_active() AND ((status)::text = ''active''::text) AND (deleted_at IS NULL))"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"service_categories","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"service_categories","permissive":"PERMISSIVE","policyname":"encargo02_categories_insert","schemaname":"public","with_check":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)"},{"cmd":"SELECT","qual":"is_clinic_member(clinic_id)","roles":["authenticated"],"tablename":"service_categories","permissive":"PERMISSIVE","policyname":"encargo02_categories_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)","roles":["authenticated"],"tablename":"service_categories","permissive":"PERMISSIVE","policyname":"encargo02_categories_update","schemaname":"public","with_check":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"services","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"SELECT","qual":"is_clinic_member(clinic_id)","roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"encargo02_services_read","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)","roles":["authenticated"],"tablename":"services","permissive":"PERMISSIVE","policyname":"encargo02_services_update","schemaname":"public","with_check":"(get_clinic_member_role(clinic_id) = ''clinic_owner''::text)"},{"cmd":"ALL","qual":"clinia_mfa_active()","roles":["authenticated"],"tablename":"treatments","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"public","with_check":"clinia_mfa_active()"},{"cmd":"SELECT","qual":"((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''storage.s3.object.get''::text, ''storage.s3.object.info''::text]) AND security_internal.document_object_read_allowed(name))","roles":["clinia_document_delivery"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"clinia_document_delivery_read","schemaname":"storage","with_check":null},{"cmd":"ALL","qual":"((bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text])) OR clinia_mfa_active())","roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_mfa_gate","schemaname":"storage","with_check":"((bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text])) OR clinia_mfa_active())"},{"cmd":"SELECT","qual":"(bucket_id <> ''patient-files''::text)","roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_no_human_clinical_object_read","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"(bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text]))","roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_private_media_no_delete","schemaname":"storage","with_check":null},{"cmd":"UPDATE","qual":"(bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text]))","roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_private_media_no_update","schemaname":"storage","with_check":"(bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text]))"},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_private_media_origin_insert","schemaname":"storage","with_check":"((bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text])) OR storage.allow_only_operation(''storage.object.upload''::text))"},{"cmd":"SELECT","qual":"((bucket_id <> ALL (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text])) OR storage.allow_any_operation(ARRAY[''storage.s3.object.get''::text, ''storage.s3.object.info''::text]))","roles":["authenticated"],"tablename":"objects","permissive":"RESTRICTIVE","policyname":"clinia_private_media_origin_read","schemaname":"storage","with_check":null},{"cmd":"DELETE","qual":"((bucket_id = ANY (ARRAY[''clinic-branding''::text, ''doctor-avatars''::text])) AND (owner_id = (auth.uid())::text) AND encargo02_storage_access(bucket_id, name, true))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"encargo02_storage_delete","schemaname":"storage","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"encargo02_storage_insert","schemaname":"storage","with_check":"((owner_id = (auth.uid())::text) AND encargo02_storage_access(bucket_id, name, true))"},{"cmd":"SELECT","qual":"encargo02_storage_access(bucket_id, name, false)","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"encargo02_storage_read","schemaname":"storage","with_check":null},{"cmd":"UPDATE","qual":"((owner_id = (auth.uid())::text) AND encargo02_storage_replace_allowed(bucket_id, name))","roles":["authenticated"],"tablename":"objects","permissive":"PERMISSIVE","policyname":"encargo02_storage_update","schemaname":"storage","with_check":"((owner_id = (auth.uid())::text) AND encargo02_storage_replace_allowed(bucket_id, name))"}],"triggers":[{"name":"on_auth_user_created","table":"auth.users","enabled":"O","definition":"CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()"},{"name":"agenda_audit","table":"public.appointments","enabled":"O","definition":"CREATE TRIGGER agenda_audit AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION security_internal.audit_operational_appointment()"},{"name":"agenda_guard","table":"public.appointments","enabled":"O","definition":"CREATE TRIGGER agenda_guard BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION security_internal.guard_operational_appointment()"},{"name":"encargo02_protect_identity","table":"public.appointments","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"audit_billings","table":"public.billings","enabled":"O","definition":"CREATE TRIGGER audit_billings AFTER INSERT OR DELETE OR UPDATE ON billings FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"audit_clinical_records","table":"public.clinical_records","enabled":"O","definition":"CREATE TRIGGER audit_clinical_records AFTER INSERT OR DELETE OR UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"encargo02_protect_identity","table":"public.clinical_records","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"trg_enforce_clinician_assignment","table":"public.clinical_records","enabled":"O","definition":"CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON clinical_records FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment()"},{"name":"trg_audit_data_rights_status","table":"public.data_rights_requests","enabled":"O","definition":"CREATE TRIGGER trg_audit_data_rights_status AFTER UPDATE OF status ON data_rights_requests FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION security_internal.audit_data_rights_status()"},{"name":"trg_guard_data_rights_request_insert","table":"public.data_rights_requests","enabled":"O","definition":"CREATE TRIGGER trg_guard_data_rights_request_insert BEFORE INSERT ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION guard_data_rights_request_insert()"},{"name":"trg_protect_data_rights_requests","table":"public.data_rights_requests","enabled":"O","definition":"CREATE TRIGGER trg_protect_data_rights_requests BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests()"},{"name":"audit_hcu033_forms","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER audit_hcu033_forms AFTER INSERT OR DELETE OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"encargo02_00_prepare_author","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER encargo02_00_prepare_author BEFORE INSERT ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.prepare_hcu033_author()"},{"name":"encargo02_protect_identity","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"tr_update_patient_odontogram","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION update_patient_odontogram_summary()"},{"name":"trg_enforce_clinician_assignment","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment()"},{"name":"trg_sync_hcu033_form_clinic_id","table":"public.hcu033_forms","enabled":"O","definition":"CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION sync_hcu033_form_clinic_id()"},{"name":"clinia_initialize_delivery_path","table":"public.patient_files","enabled":"O","definition":"CREATE TRIGGER clinia_initialize_delivery_path BEFORE INSERT ON patient_files FOR EACH ROW EXECUTE FUNCTION security_internal.initialize_document_delivery_path()"},{"name":"encargo02_protect_identity","table":"public.patient_files","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON patient_files FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"encargo02_protect_identity","table":"public.patient_notes","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON patient_notes FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"audit_patients","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()"},{"name":"encargo02_protect_identity","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"operational_patient_scope","table":"public.patients","enabled":"O","definition":"CREATE TRIGGER operational_patient_scope BEFORE INSERT OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION security_internal.guard_patient_scope()"},{"name":"encargo02_protect_identity","table":"public.prescription_templates","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON prescription_templates FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"encargo02_protect_identity","table":"public.prescriptions","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()"},{"name":"freeze_prescription_receipt","table":"public.prescriptions","enabled":"O","definition":"CREATE TRIGGER freeze_prescription_receipt BEFORE INSERT OR DELETE OR UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.freeze_prescription_receipt()"},{"name":"trg_enforce_clinician_assignment","table":"public.prescriptions","enabled":"O","definition":"CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment()"},{"name":"trg_log_profile_changes","table":"public.profiles","enabled":"O","definition":"CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON profiles FOR EACH ROW WHEN (old.* IS DISTINCT FROM new.*) EXECUTE FUNCTION log_profile_changes()"},{"name":"trg_prevent_profile_privilege_escalation","table":"public.profiles","enabled":"O","definition":"CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation()"},{"name":"encargo02_protect_reference","table":"public.service_categories","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference()"},{"name":"encargo02_protect_reference","table":"public.services","enabled":"O","definition":"CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON services FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference()"}],"btreeGist":{"available":"1.7","installed":"1.7"},"functions":[{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"a28f2f2bbb746e80661dc2f7a5275c9f","definer":true,"identity":"logs.log_access_trigger()","anonExecute":false,"definitionMd5":"b003cc90d68a7cf0308c20dc70229a62","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":null,"bodyMd5":"8ddbf782eb97d9730ed96ea2e71abf92","definer":true,"identity":"logs.log_patient_view(uuid)","anonExecute":false,"definitionMd5":"06526ca5c931880b63db7c69392424f4","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"c30589f5753e4fe8b198c81b739c8786","definer":true,"identity":"accept_clinic_invitation(text)","anonExecute":false,"definitionMd5":"3bd2fb4cfa5ac4a64a6a1cc80a35f761","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"90b5a8328c8a0e350f0c40a22531b395","definer":true,"identity":"archive_clinic(uuid)","anonExecute":false,"definitionMd5":"cd96d7eabb99a32b653ba00bc17912ab","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"3d8f3a223517b6f97abc7e9d59d10c6c","definer":true,"identity":"check_subscription_active(uuid)","anonExecute":false,"definitionMd5":"71c3a5e45a23529cc5862fbf2d613494","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"138ad918f1700969a6a106fae965b57f","definer":true,"identity":"cleanup_soft_deleted_records()","anonExecute":false,"definitionMd5":"33e09aced6db29a08ebd5ca26e5daaa3","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"6b9f29314088652d883b17cc8b0c17c6","definer":true,"identity":"clinia_audit_document_delivery(uuid,uuid,uuid,text)","anonExecute":false,"definitionMd5":"24737db55589a9fbd13477e3a847aba2","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,supabase_auth_admin=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"2933180e5ce61a0f6bfbd64a53a962c6","definer":true,"identity":"clinia_document_access_token_hook(jsonb)","anonExecute":false,"definitionMd5":"2bb38823dc3edee25cf591695154e4b4","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,clinia_document_delivery=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"ae94926bb6dd41f8e0da3773537204c3","definer":true,"identity":"clinia_document_delivery_active()","anonExecute":false,"definitionMd5":"c21bb1e84bb415fd067db48299a3bbc4","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"e8f5ce1dc974a072b7bb19417aaf05f9","definer":true,"identity":"clinia_mfa_active()","anonExecute":false,"definitionMd5":"e3e57ed25fbb7a5dd47547f7b60a62df","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"70c7bd92f64d849026cc8f73c4e544b9","definer":true,"identity":"clinia_session_active()","anonExecute":false,"definitionMd5":"fc93cccd07f216b57ac0d0793112b4ab","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"0887824caf050096403454f936923418","definer":true,"identity":"complete_verified_clinic_registration()","anonExecute":false,"definitionMd5":"d7c313f19dc9b485783f885602aad0ea","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"0702e30630b1f2843578121fd4519b63","definer":true,"identity":"consume_email_abuse_budget(text,text,text,uuid,uuid)","anonExecute":false,"definitionMd5":"a849a6be97f441d9055e2999fac1ffc7","serviceExecute":true,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":null,"bodyMd5":"f914a1cd6d3f9a51dc1e17176299a85e","definer":true,"identity":"create_tenant_clinic(text,text,text)","anonExecute":false,"definitionMd5":"85f0ec6a53e9e21c3df60af881a5d5be","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"592a14eecfc5f8850ee9bace68c11ec1","definer":true,"identity":"custom_access_token_hook(jsonb)","anonExecute":false,"definitionMd5":"24b8ee285342b0f48385ad4239a0c567","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"a146ffafe6893b4236775ad6e6b0f471","definer":true,"identity":"encargo02_storage_access(text,text,boolean)","anonExecute":false,"definitionMd5":"072f9090e706d37c9f5adab041017dab","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"632b760ad01d2ab602374c476d9f0627","definer":true,"identity":"encargo02_storage_replace_allowed(text,text)","anonExecute":false,"definitionMd5":"08f7495c4236a28bfd89fd632434be6d","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3714a26603df41e27491cb183bc27c79","definer":false,"identity":"enforce_patient_clinical_privileges()","anonExecute":false,"definitionMd5":"a79e4f585e4817c88f1a82e3449d4bdd","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3711d3f356f0f9471e774a6fd6b165db","definer":true,"identity":"get_checkout_payment_methods(uuid)","anonExecute":false,"definitionMd5":"cc253f79208edd996312d63d6e6c17d3","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"637e14222e9113a4d4d101c9933676c4","definer":true,"identity":"get_clinic_member_role(uuid)","anonExecute":false,"definitionMd5":"5e85dd408e2ac4f3697ad5c6439d7136","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"fc6f52866c19744d0bee9f0b0498636d","definer":true,"identity":"get_clinic_operational_report(uuid,timestamp with time zone,timestamp with time zone)","anonExecute":false,"definitionMd5":"e8efdb0574559ce7bef1c54f7bdb39b2","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"771a16a0116eba50c46aa70cdb943807","definer":true,"identity":"get_clinic_schedule(uuid,timestamp with time zone,timestamp with time zone)","anonExecute":false,"definitionMd5":"f6a1379ca8fb208c34aac200293c60e4","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"67d80bf0ef5720deb71ca12b8c3d0d19","definer":true,"identity":"get_clinic_staff_directory(uuid)","anonExecute":false,"definitionMd5":"05638c467cd4c493ba951f01c3bb5349","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"00eb31f4eb9dc01cadebf592caa8fb51","definer":true,"identity":"get_family_unit_with_stats(uuid)","anonExecute":false,"definitionMd5":"dfb8907ed8265171daea44d74a10f03e","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"10d03f170eccf056e4e4e6f755b4efaa","definer":true,"identity":"get_patient_demographics(uuid,text,integer,integer,uuid)","anonExecute":false,"definitionMd5":"a66905e6815352985b75094717e4fc98","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":null,"bodyMd5":"725ba43c0eda218dad19a3ff071b14f8","definer":true,"identity":"get_patient_profile_secure(uuid)","anonExecute":false,"definitionMd5":"6f0d5f42f5840528155ad3af63add074","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"4343a81a1969bf997ea8ea24ed6f6faa","definer":true,"identity":"get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid)","anonExecute":false,"definitionMd5":"83f9c84e5a46057bdf920074f0e6d995","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"a30adec6710a9edcd778586cffbc8a21","definer":true,"identity":"get_user_clinic_id()","anonExecute":false,"definitionMd5":"c3a13300ba63360101c2edd31299b1eb","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"88e654c014bc9969fe94c3580d558503","definer":false,"identity":"guard_data_rights_request_insert()","anonExecute":false,"definitionMd5":"b578598a6335222539e0decff3b0b563","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"c0e32787d2ec248cd16f6d567ca4cf4c","definer":false,"identity":"guard_patient_clinical_insert()","anonExecute":false,"definitionMd5":"634b6f985204b9dc1094d98b34247518","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"aba085398439a92bdfe5c2bbda7e6963","definer":true,"identity":"handle_new_user()","anonExecute":false,"definitionMd5":"ef5ae66e748bad8ee91c232abe77b307","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"a1d8be783742ec61837028f26bd05a00","definer":false,"identity":"handle_verified_clinic_creation()","anonExecute":false,"definitionMd5":"86d45ce105d7cdac81abd83a1f166adb","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"7f7f9975f665cefd0787d710148ced7a","definer":true,"identity":"is_clinic_member(uuid)","anonExecute":false,"definitionMd5":"7b2a89fd63ef9d662178d97f72e0aa8e","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"4723deaaf6ca6fb5d567a480949b9473","definer":true,"identity":"log_data_rights_request(text,jsonb,text,text)","anonExecute":false,"definitionMd5":"bb481d0ad198788667dcd669551a30f5","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"ad234461eeddb4d258993b5bbd127403","definer":true,"identity":"log_profile_changes()","anonExecute":false,"definitionMd5":"6006da077746b4f70c70132be4cacdb2","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"9fc6465459c8f16c1cee879394365365","definer":true,"identity":"prevent_profile_privilege_escalation()","anonExecute":false,"definitionMd5":"3062afe878aedd9fd6bb2134d2023c1a","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"fe0ff58b269ecb6cc3462e5ab73ffe59","definer":false,"identity":"protect_data_rights_requests()","anonExecute":false,"definitionMd5":"5c7ce6279b5a69e9ca3762aaaafc8d1e","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"49eab5876aeb4502a69adc3804c35945","definer":true,"identity":"purge_clinic_data(uuid)","anonExecute":false,"definitionMd5":"a68773dad2e02f0e941af764d2fa8dca","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"2fa2fe04c790dabb4aafff49c2989511","definer":true,"identity":"redeem_verified_clinic_invitation(text)","anonExecute":false,"definitionMd5":"3d41297208021e8f3e2dfe2828e006bd","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"441f316a931fdcf8ca0d00f321c79112","definer":true,"identity":"remove_clinic_member(uuid,uuid)","anonExecute":false,"definitionMd5":"7bb35072cf5cf8f5792a0f4366cb4343","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"b7527a7ff1ffa8d1f2c8c0166818bee1","definer":true,"identity":"save_clinic_appointment(uuid,jsonb,uuid)","anonExecute":false,"definitionMd5":"d0e5efe1892bb5ca10232ba3e79105ba","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"8504c0073aa987c02edae795d90b3b9d","definer":true,"identity":"save_patient_demographics(uuid,jsonb,uuid)","anonExecute":false,"definitionMd5":"08686679e1323e93f3f772f9e8d6d3b2","serviceExecute":false,"authenticatedExecute":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public"],"bodyMd5":"3802daae556803abe4d0ea2851f8e159","definer":true,"identity":"seed_default_services(uuid)","anonExecute":false,"definitionMd5":"9e5acd7895a25326b07ea3827340dabc","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":null,"bodyMd5":"9b1889f56258bf9d6554213c05019c76","definer":false,"identity":"set_updated_at()","anonExecute":false,"definitionMd5":"8de7ae383447503e8949149bfb3f0efb","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"65865a0605e8b407721652d05dc18a50","definer":true,"identity":"store_clinic_registration_intent(uuid,uuid,text,text,text,text,text)","anonExecute":false,"definitionMd5":"a53c7aa1f6cfc382f0a27465df96dc25","serviceExecute":true,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"3118cacf1ba392f372b551382868b92a","definer":true,"identity":"sync_hcu033_form_clinic_id()","anonExecute":false,"definitionMd5":"9edebaadcfa4f77a28f1a640d299379a","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":null,"bodyMd5":"81e1a38c87af593f0b79bd2ec6c12871","definer":false,"identity":"update_billing_status()","anonExecute":false,"definitionMd5":"f94ede25355a91da7389017a21b9e889","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"817d8cfdfc824a988175f5d5fe31693b","definer":true,"identity":"update_patient_odontogram_summary()","anonExecute":false,"definitionMd5":"3dc99d7f2fc5c078e92557e9454d188e","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"f10913e255d0d08566f2d7af3a53df32","definer":true,"identity":"security_internal.appointment_operational(appointments,boolean)","anonExecute":false,"definitionMd5":"832ef11091e86165e9b55bb693c3f500","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"043465d08eb08c1752562f09cafe048c","definer":true,"identity":"security_internal.audit_data_rights_status()","anonExecute":false,"definitionMd5":"5b53078cfa6f4fbe526ee9cfdf13d35c","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"bbf4307df8e3ee99ec744e9d4ee09ed7","definer":true,"identity":"security_internal.audit_operational_appointment()","anonExecute":false,"definitionMd5":"ecff6a0f2de6657e6ba30879635278b5","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres,clinia_document_delivery=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"828e83bdd7d0903809947b6f49b07613","definer":true,"identity":"security_internal.document_object_read_allowed(text)","anonExecute":false,"definitionMd5":"f05f8119fa74edfa69f0f7ac5bebfa1c","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"5183aba34fbbe818254cbefa91f65360","definer":true,"identity":"security_internal.enforce_clinician_assignment()","anonExecute":false,"definitionMd5":"cbb82846dbf1e55a4b48471d950f3df9","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"90362aea2b80f1fe6419ad8a78eb51c7","definer":true,"identity":"security_internal.freeze_prescription_receipt()","anonExecute":false,"definitionMd5":"07dc90f3828d2414e0d4737820a38e47","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"1dee0663fb07ef3c1d013dc0e2f2024f","definer":true,"identity":"security_internal.guard_operational_appointment()","anonExecute":false,"definitionMd5":"bbcb585e360f1e2ec8f6ee11337bf29e","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"7858c696e58ca89553f45db84be639c8","definer":true,"identity":"security_internal.guard_patient_scope()","anonExecute":false,"definitionMd5":"3ffddc17b06db63d3e276d270623e85b","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"8097f0bac3170ee95e3b2a6f98fc9ffc","definer":true,"identity":"security_internal.initialize_document_delivery_path()","anonExecute":false,"definitionMd5":"0a834e83c3890f490a455572a50558d7","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"e66c902da2cf5c6f14e1716d17c9e5e8","definer":true,"identity":"security_internal.lock_clinia_session()","anonExecute":false,"definitionMd5":"0427db17efca6f91d0bb39d86f93bb2d","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"4fffd3706d338aa66f7dbb0a7ce79778","definer":false,"identity":"security_internal.patient_demographic(patients)","anonExecute":false,"definitionMd5":"c1dea97b5b99d34ea5385c9f4022fca1","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"c9af4f21a71579015c2a6785ae4642fa","definer":true,"identity":"security_internal.prepare_hcu033_author()","anonExecute":false,"definitionMd5":"0f95ab78de88318665e96dfd3710bf11","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"d9fa4a430aa5437cc7835c01b836af9f","definer":true,"identity":"security_internal.protect_clinical_identity()","anonExecute":false,"definitionMd5":"5cabf2119761b5835b0ca1f9e3ef548b","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"121b8b32079c4c434387350a8dcbc5b1","definer":true,"identity":"security_internal.protect_service_reference()","anonExecute":false,"definitionMd5":"cda201aa6715cdaf00127a821bd31c3a","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"abfe400a65df9619e89f878eba59504d","definer":true,"identity":"security_internal.require_clinic(uuid,text[],boolean)","anonExecute":false,"definitionMd5":"c0b4d80824860b989157251812e1bb8c","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"6498c2732935b870bf3bf5a3d4df3de0","definer":true,"identity":"security_internal.role_for(uuid,uuid)","anonExecute":false,"definitionMd5":"2ac5da459fa943551e629ca1817cfeb9","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"666e6f3dedb14b8e5bb81eac86337bd8","definer":true,"identity":"security_internal.storage_access(text,text,boolean)","anonExecute":false,"definitionMd5":"2d836defdc177d632498b15c5c9e43e9","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"2b3ad77e699becb5587c67b7dea758c4","definer":true,"identity":"security_internal.storage_object_retired(text,text)","anonExecute":false,"definitionMd5":"ea5f852e9ee2cb8da5dd44a8accf7567","serviceExecute":false,"authenticatedExecute":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=\"\""],"bodyMd5":"59a74a554a8f169416b2d4ad8847c661","definer":true,"identity":"security_internal.storage_replace_allowed(text,text)","anonExecute":false,"definitionMd5":"93c66ef2487cdaff1c4ae95fdb7e1cdf","serviceExecute":false,"authenticatedExecute":false}],"sequences":[{"max":"9223372036854775807","min":"1","name":"access_audit_id_seq","type":"bigint","cache":"1","cycle":false,"start":"1","schema":"logs","increment":"1"},{"max":"9223372036854775807","min":"1","name":"profile_audit_log_id_seq","type":"bigint","cache":"1","cycle":false,"start":"1","schema":"public","increment":"1"}],"constraints":[{"name":"access_audit_pkey","type":"p","table":"logs.access_audit","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"agenda_active_assignment","type":"c","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (deleted_at IS NOT NULL OR (status <> ALL (ARRAY[''scheduled''::text, ''confirmed''::text, ''arrived''::text])) OR doctor_id IS NOT NULL)"},{"name":"agenda_finite_interval","type":"c","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (start_time IS NOT NULL AND end_time IS NOT NULL AND isfinite(start_time) AND isfinite(end_time) AND end_time > start_time AND (end_time - start_time) >= ''00:05:00''::interval AND (end_time - start_time) <= ''08:00:00''::interval)"},{"name":"agenda_no_overlap","type":"x","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"EXCLUDE USING gist (clinic_id WITH =, doctor_id WITH =, tstzrange(start_time, end_time, ''[)''::text) WITH &&) WHERE (deleted_at IS NULL AND (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''arrived''::text])))"},{"name":"appointments_clinic_id_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"appointments_doctor_id_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"appointments_patient_clinic_fkey","type":"f","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE"},{"name":"appointments_pkey","type":"p","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"appointments_status_check","type":"c","table":"public.appointments","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status IS NOT NULL AND (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''arrived''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text])))"},{"name":"automation_settings_pkey","type":"p","table":"public.automation_settings","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"automation_settings_user_id_fkey","type":"f","table":"public.automation_settings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"billings_appointment_id_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (appointment_id) REFERENCES appointments(id)"},{"name":"billings_clinic_id_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"billings_patient_clinic_fkey","type":"f","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id)"},{"name":"billings_pkey","type":"p","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"billings_status_check","type":"c","table":"public.billings","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''paid''::text, ''pending''::text, ''overdue''::text]))"},{"name":"clinic_invitations_accepted_by_fkey","type":"f","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (accepted_by) REFERENCES auth.users(id)"},{"name":"clinic_invitations_clinic_id_fkey","type":"f","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"clinic_invitations_invited_by_fkey","type":"f","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (invited_by) REFERENCES auth.users(id)"},{"name":"clinic_invitations_pkey","type":"p","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinic_invitations_role_check","type":"c","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))"},{"name":"clinic_invitations_status_check","type":"c","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))"},{"name":"clinic_invitations_token_key","type":"u","table":"public.clinic_invitations","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (token)"},{"name":"clinic_members_clinic_id_fkey","type":"f","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"clinic_members_pkey","type":"p","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinic_members_user_id_clinic_id_key","type":"u","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (user_id, clinic_id)"},{"name":"clinic_members_user_id_fkey","type":"f","table":"public.clinic_members","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"clinical_records_clinic_id_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"clinical_records_doctor_id_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"clinical_records_patient_clinic_fkey","type":"f","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id)"},{"name":"clinical_records_pkey","type":"p","table":"public.clinical_records","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinics_owner_id_fkey","type":"f","table":"public.clinics","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (owner_id) REFERENCES profiles(id)"},{"name":"clinics_pkey","type":"p","table":"public.clinics","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"data_rights_requests_clinic_id_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"data_rights_requests_patient_clinic_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE SET NULL (patient_id)"},{"name":"data_rights_requests_pkey","type":"p","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"data_rights_requests_request_type_check","type":"c","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))"},{"name":"data_rights_requests_resolved_by_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (resolved_by) REFERENCES auth.users(id)"},{"name":"data_rights_requests_status_check","type":"c","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))"},{"name":"data_rights_requests_user_id_fkey","type":"f","table":"public.data_rights_requests","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id)"},{"name":"hcu033_forms_clinic_id_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"hcu033_forms_doctor_id_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"hcu033_forms_patient_clinic_fkey","type":"f","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE"},{"name":"hcu033_forms_pkey","type":"p","table":"public.hcu033_forms","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"invoices_billing_id_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (billing_id) REFERENCES billings(id)"},{"name":"invoices_clinic_id_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"invoices_patient_clinic_fkey","type":"f","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id)"},{"name":"invoices_pkey","type":"p","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"invoices_status_check","type":"c","table":"public.invoices","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (status = ANY (ARRAY[''draft''::text, ''authorized''::text, ''rejected''::text, ''cancelled''::text]))"},{"name":"messages_clinic_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"messages_pkey","type":"p","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"messages_receiver_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (receiver_id) REFERENCES profiles(id)"},{"name":"messages_sender_id_fkey","type":"f","table":"public.messages","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (sender_id) REFERENCES profiles(id)"},{"name":"notifications_pkey","type":"p","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"notifications_type_check","type":"c","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))"},{"name":"notifications_user_id_fkey","type":"f","table":"public.notifications","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES profiles(id)"},{"name":"patient_files_clinic_id_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"patient_files_delivery_path_scope","type":"c","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (delivery_path ~ ((((''^''::text || clinic_id::text) || ''/''::text) || patient_id::text) || ''/[^/]+$''::text) AND length(delivery_path) <= 500 AND delivery_path !~~ ''%..%''::text)"},{"name":"patient_files_patient_clinic_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE"},{"name":"patient_files_pkey","type":"p","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"patient_files_uploaded_by_fkey","type":"f","table":"public.patient_files","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (uploaded_by) REFERENCES profiles(id)"},{"name":"patient_notes_author_id_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (author_id) REFERENCES profiles(id)"},{"name":"patient_notes_clinic_id_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"patient_notes_patient_clinic_fkey","type":"f","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE"},{"name":"patient_notes_pkey","type":"p","table":"public.patient_notes","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"patients_cedula_clinic_unique","type":"u","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (cedula, clinic_id)"},{"name":"patients_clinic_id_fkey","type":"f","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"patients_family_clinic_fkey","type":"f","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (family_representative_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE SET NULL (family_representative_id)"},{"name":"patients_family_representative_id_fkey","type":"f","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (family_representative_id) REFERENCES patients(id)"},{"name":"patients_id_clinic_id_key","type":"u","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (id, clinic_id)"},{"name":"patients_pkey","type":"p","table":"public.patients","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"payment_methods_clinic_id_fkey","type":"f","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"payment_methods_doctor_id_fkey","type":"f","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"payment_methods_pkey","type":"p","table":"public.payment_methods","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"payments_clinic_id_fkey","type":"f","table":"public.payments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"payments_pkey","type":"p","table":"public.payments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"prescription_templates_clinic_id_check","type":"c","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (clinic_id IS NOT NULL)"},{"name":"prescription_templates_doctor_id_fkey","type":"f","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES auth.users(id)"},{"name":"prescription_templates_pkey","type":"p","table":"public.prescription_templates","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"prescriptions_clinic_id_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"prescriptions_doctor_id_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (doctor_id) REFERENCES profiles(id)"},{"name":"prescriptions_patient_clinic_fkey","type":"f","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE"},{"name":"prescriptions_pkey","type":"p","table":"public.prescriptions","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"profile_audit_log_actor_user_id_fkey","type":"f","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (actor_user_id) REFERENCES profiles(id)"},{"name":"profile_audit_log_pkey","type":"p","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"profile_audit_log_target_user_id_fkey","type":"f","table":"public.profile_audit_log","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (target_user_id) REFERENCES profiles(id)"},{"name":"profiles_clinic_id_fkey","type":"f","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"profiles_id_fkey","type":"f","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"profiles_pkey","type":"p","table":"public.profiles","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"service_categories_clinic_id_fkey","type":"f","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"service_categories_clinic_id_name_key","type":"u","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (clinic_id, name)"},{"name":"service_categories_pkey","type":"p","table":"public.service_categories","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"services_category_id_fkey","type":"f","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (category_id) REFERENCES service_categories(id)"},{"name":"services_clinic_id_fkey","type":"f","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"services_pkey","type":"p","table":"public.services","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"treatments_clinic_id_fkey","type":"f","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (clinic_id) REFERENCES clinics(id)"},{"name":"treatments_pkey","type":"p","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"treatments_user_id_fkey","type":"f","table":"public.treatments","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id)"},{"name":"appointment_events_operation_check","type":"c","table":"security_internal.appointment_events","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (operation = ANY (ARRAY[''INSERT''::text, ''UPDATE''::text]))"},{"name":"appointment_events_pkey","type":"p","table":"security_internal.appointment_events","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"clinic_registration_intents_address_check","type":"c","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (length(address) >= 1 AND length(address) <= 300)"},{"name":"clinic_registration_intents_clinic_id_key","type":"u","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (clinic_id)"},{"name":"clinic_registration_intents_name_check","type":"c","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (length(btrim(name)) >= 1 AND length(btrim(name)) <= 160)"},{"name":"clinic_registration_intents_phone_check","type":"c","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (length(phone) <= 40)"},{"name":"clinic_registration_intents_pkey","type":"p","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (user_id)"},{"name":"clinic_registration_intents_size_check","type":"c","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (size = ANY (ARRAY[''small''::text, ''medium''::text, ''large''::text]))"},{"name":"clinic_registration_intents_user_id_fkey","type":"f","table":"security_internal.clinic_registration_intents","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id)"},{"name":"document_delivery_audit_pkey","type":"p","table":"security_internal.document_delivery_audit","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (id)"},{"name":"document_delivery_principals_pkey","type":"p","table":"security_internal.document_delivery_principals","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (user_id)"},{"name":"document_delivery_principals_user_id_fkey","type":"f","table":"security_internal.document_delivery_principals","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"email_abuse_budgets_attempts_check","type":"c","table":"security_internal.email_abuse_budgets","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (attempts > 0)"},{"name":"email_abuse_budgets_check","type":"c","table":"security_internal.email_abuse_budgets","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (expires_at > window_start)"},{"name":"email_abuse_budgets_key_hash_check","type":"c","table":"security_internal.email_abuse_budgets","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (key_hash ~ ''^[0-9a-f]{64}$''::text)"},{"name":"email_abuse_budgets_pkey","type":"p","table":"security_internal.email_abuse_budgets","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (scope, key_hash, window_start)"},{"name":"retired_storage_objects_bucket_id_check","type":"c","table":"security_internal.retired_storage_objects","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (bucket_id = ANY (ARRAY[''patient-files''::text, ''patient-avatars''::text, ''doctor-avatars''::text, ''clinic-branding''::text]))"},{"name":"retired_storage_objects_name_check","type":"c","table":"security_internal.retired_storage_objects","deferred":false,"validated":true,"deferrable":false,"definition":"CHECK (length(name) > 0)"},{"name":"retired_storage_objects_pkey","type":"p","table":"security_internal.retired_storage_objects","deferred":false,"validated":true,"deferrable":false,"definition":"PRIMARY KEY (bucket_id, name)"}],"currentUser":"postgres","sessionUser":"postgres","serverVersion":"170011"}'::jsonb;
 n_doc jsonb; n_row jsonb; n_rows jsonb; n_value jsonb; n_section record; n_field record; n_i integer;
 BEGIN SELECT catalog INTO actual FROM (SELECT jsonb_build_object(
  'database',current_database(),'currentUser',current_user,'sessionUser',session_user,
  'serverVersion',current_setting('server_version_num'),
  'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'options',c.reloptions,'definition',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S')),
  'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum),'[]') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definitionMd5',md5(pg_get_functiondef(p.oid)),'bodyMd5',md5(replace(p.prosrc,E'\r\n',E'\n')),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind IN ('f','p')),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',co.conname,'type',co.contype,'validated',co.convalidated,'deferrable',co.condeferrable,'deferred',co.condeferred,'definition',pg_get_constraintdef(co.oid,true)) ORDER BY n.nspname,c.relname,co.conname),'[]') FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) ORDER BY n.nspname,c.relname),'[]') FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname IN ('public','logs','security_internal') OR (n.nspname='auth' AND c.relname='users'))),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname),'[]') FROM pg_policies p WHERE p.schemaname IN ('public','logs','security_internal') OR (p.schemaname='storage' AND p.tablename='objects')),
  'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text) ORDER BY n.nspname),'[]') FROM pg_namespace n WHERE n.nspname IN ('public','logs','security_internal')),
  'defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,''),'type',d.defaclobjtype,'acl',d.defaclacl::text) ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),'[]') FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN ('public','logs','security_internal')),
  'types',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',t.typtype,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'baseType',CASE WHEN t.typtype='d' THEN format_type(t.typbasetype,t.typtypmod) END,'notNull',t.typnotnull,'default',t.typdefault,'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)) ORDER BY n.nspname,t.typname),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','logs','security_internal') AND t.typtype IN ('e','d')),
  'sequences',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) ORDER BY n.nspname,c.relname),'[]') FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')),
  'btreeGist',(SELECT jsonb_build_object('available',a.default_version,'installed',a.installed_version) FROM pg_available_extensions a WHERE a.name='btree_gist')
) AS catalog) snapshot;
 FOR n_i IN 0..1 LOOP
 n_doc:=CASE WHEN n_i=0 THEN actual ELSE expected END;
 FOR n_section IN SELECT key,value FROM jsonb_each(n_doc) LOOP
 IF jsonb_typeof(n_section.value)='array' THEN
 n_rows:='[]'::jsonb;
 FOR n_row IN SELECT value FROM jsonb_array_elements(n_section.value) LOOP
 FOR n_field IN SELECT key,value FROM jsonb_each(n_row) LOOP
 n_value:=n_field.value;
 IF jsonb_typeof(n_value)='string' THEN
 n_value:=to_jsonb(replace(n_value#>>'{}',E'\r\n',E'\n'));
 IF n_field.key IN ('acl','roles') AND (n_value#>>'{}') ~ '^\{[^{}]*\}$' THEN
 SELECT to_jsonb('{'||coalesce(string_agg(v,',' ORDER BY v COLLATE "C"),'')||'}') INTO n_value
 FROM unnest(string_to_array(trim(both '{}' FROM n_value#>>'{}'),',')) v WHERE v<>'';
 END IF;
 ELSIF jsonb_typeof(n_value)='array' AND n_field.key IN ('config','options','allowed_mime_types') THEN
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_value FROM jsonb_array_elements(n_value);
 END IF;
 n_row:=jsonb_set(n_row,ARRAY[n_field.key],n_value);
 END LOOP;
 n_rows:=n_rows||jsonb_build_array(n_row);
 END LOOP;
 SELECT coalesce(jsonb_agg(value ORDER BY value::text COLLATE "C"),'[]') INTO n_rows FROM jsonb_array_elements(n_rows);
 n_doc:=jsonb_set(n_doc,ARRAY[n_section.key],n_rows);
 END IF;
 END LOOP;
 IF n_i=0 THEN actual:=n_doc; ELSE expected:=n_doc; END IF;
 END LOOP;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'GATE3_SYNTHETIC_POSTCONTRACT_REFUSED' USING ERRCODE='P0001'; END IF; END $catalog_guard$;
COMMIT;