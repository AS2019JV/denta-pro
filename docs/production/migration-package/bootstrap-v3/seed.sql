-- Known synthetic fixture only. These Auth IDs must first exist via Auth admin API.
DO $seed_guard$ BEGIN
 IF (SELECT count(*) FROM auth.users)<>2 OR (SELECT count(*) FROM auth.users WHERE id IN ('88888888-aaaa-4aaa-8aaa-000000000001','88888888-aaaa-4aaa-8aaa-000000000002'))<>2 OR EXISTS(SELECT FROM public.clinics) OR EXISTS(SELECT FROM public.patients) OR EXISTS(SELECT FROM public.services) THEN RAISE EXCEPTION 'GATE3_SYNTHETIC_SEED_REFUSED'; END IF;
END $seed_guard$;
DO $profiles_guard$ BEGIN
 IF (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE
  p.role::text='doctor' AND p.status::text='active' AND p.clinic_id IS NULL AND p.email=u.email AND
  ((p.id='88888888-aaaa-4aaa-8aaa-000000000001' AND u.email='gate3-known-1@example.invalid' AND p.full_name='gate3-known-1') OR
   (p.id='88888888-aaaa-4aaa-8aaa-000000000002' AND u.email='gate3-known-2@example.invalid' AND p.full_name='gate3-known-2')))<>2
 THEN RAISE EXCEPTION 'GATE3_PRESEED_PROFILE_CONTENT_REFUSED'; END IF;
END $profiles_guard$;
INSERT INTO public.clinics(id,name,owner_id,bypass_subscription) VALUES
 ('88888888-1111-4111-8111-111111111111','Synthetic Gate3 A','88888888-aaaa-4aaa-8aaa-000000000001',true),
 ('88888888-1111-4111-8111-111111111112','Synthetic Gate3 B','88888888-aaaa-4aaa-8aaa-000000000002',true);
UPDATE public.profiles SET clinic_id='88888888-1111-4111-8111-111111111111',role='clinic_owner',status='active' WHERE id='88888888-aaaa-4aaa-8aaa-000000000001';
UPDATE public.profiles SET clinic_id='88888888-1111-4111-8111-111111111112',role='clinic_owner',status='active' WHERE id='88888888-aaaa-4aaa-8aaa-000000000002';
INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES ('88888888-aaaa-4aaa-8aaa-000000000001','88888888-1111-4111-8111-111111111111','clinic_owner','active'),('88888888-aaaa-4aaa-8aaa-000000000002','88888888-1111-4111-8111-111111111112','clinic_owner','active');
INSERT INTO public.patients(id,clinic_id,first_name,last_name) VALUES ('88888888-2222-4222-8222-222222222222','88888888-1111-4111-8111-111111111111','Synthetic','Before M7 A'),('88888888-2222-4222-8222-222222222223','88888888-1111-4111-8111-111111111112','Synthetic','Before M7 B');
INSERT INTO public.services(id,clinic_id,name,price) VALUES ('88888888-3333-4333-8333-333333333333','88888888-1111-4111-8111-111111111111','Synthetic exact numeric boundary',99999999.99);
