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
