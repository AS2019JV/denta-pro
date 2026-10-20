BEGIN READ ONLY; SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions; DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT system_identifier::text FROM pg_control_system())<>'7692130048193495360' THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_IDENTITY_REFUSED'; END IF; END $identity$;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s';
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

DO $counts$ BEGIN IF (SELECT count(*) FROM "logs"."access_audit")<>2 OR (SELECT count(*) FROM "public"."appointments")<>0 OR (SELECT count(*) FROM "public"."automation_settings")<>0 OR (SELECT count(*) FROM "public"."billings")<>0 OR (SELECT count(*) FROM "public"."clinic_invitations")<>0 OR (SELECT count(*) FROM "public"."clinic_members")<>2 OR (SELECT count(*) FROM "public"."clinical_records")<>0 OR (SELECT count(*) FROM "public"."clinics")<>2 OR (SELECT count(*) FROM "public"."data_rights_requests")<>0 OR (SELECT count(*) FROM "public"."hcu033_forms")<>0 OR (SELECT count(*) FROM "public"."invoices")<>0 OR (SELECT count(*) FROM "public"."messages")<>0 OR (SELECT count(*) FROM "public"."notifications")<>0 OR (SELECT count(*) FROM "public"."patient_files")<>0 OR (SELECT count(*) FROM "public"."patient_notes")<>0 OR (SELECT count(*) FROM "public"."patients")<>2 OR (SELECT count(*) FROM "public"."payment_methods")<>0 OR (SELECT count(*) FROM "public"."payments")<>0 OR (SELECT count(*) FROM "public"."prescription_templates")<>0 OR (SELECT count(*) FROM "public"."prescriptions")<>0 OR (SELECT count(*) FROM "public"."profile_audit_log")<>2 OR (SELECT count(*) FROM "public"."profiles")<>2 OR (SELECT count(*) FROM "public"."service_categories")<>0 OR (SELECT count(*) FROM "public"."services")<>1 OR (SELECT count(*) FROM "public"."treatments")<>0 OR (SELECT count(*) FROM auth.users)<>2 OR (SELECT count(*) FROM auth.mfa_factors)<>2 OR (SELECT count(*) FROM storage.buckets)<>4 OR (SELECT count(*) FROM storage.objects)<>1 OR NOT EXISTS(SELECT FROM storage.objects WHERE bucket_id='patient-files' AND name='88888888-1111-4111-8111-111111111111/88888888-2222-4222-8222-222222222222/known-synthetic.pdf') THEN RAISE EXCEPTION 'GATE3_COMPLETE_FIXTURE_COUNTS_REFUSED'; END IF; END $counts$;
ROLLBACK;