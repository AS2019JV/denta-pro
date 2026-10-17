-- Exact phihonofwyerpfgqfekt synthetic fixture. Operator applies through authorized MCP only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $fixture$ BEGIN
  IF (SELECT count(*) FROM auth.users WHERE id IN ('baef66ba-f8d8-4943-af16-26bb429f9fe0','272d63b1-38e3-4a60-89a2-dd07f031b2d2','1dcb64e5-1c7d-4991-8b17-68ddbdfd5306','ee0cb878-2aaa-4265-a9b0-6d03d3659b1c','2f0b0f71-b3e0-456d-ab03-d580dbd9d335','e7ffc2ba-6c50-41ab-9508-f4bb19126bbc') AND email LIKE 'clinia-%@clinia.invalid' AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND is_anonymous IS NOT TRUE)<>6
    OR (SELECT count(*) FROM public.profiles WHERE id IN ('baef66ba-f8d8-4943-af16-26bb429f9fe0','272d63b1-38e3-4a60-89a2-dd07f031b2d2','1dcb64e5-1c7d-4991-8b17-68ddbdfd5306','ee0cb878-2aaa-4265-a9b0-6d03d3659b1c','2f0b0f71-b3e0-456d-ab03-d580dbd9d335','e7ffc2ba-6c50-41ab-9508-f4bb19126bbc') AND clinic_id IS NULL)<>6
    OR EXISTS(SELECT 1 FROM public.clinic_members WHERE user_id IN ('baef66ba-f8d8-4943-af16-26bb429f9fe0','272d63b1-38e3-4a60-89a2-dd07f031b2d2','1dcb64e5-1c7d-4991-8b17-68ddbdfd5306','ee0cb878-2aaa-4265-a9b0-6d03d3659b1c','2f0b0f71-b3e0-456d-ab03-d580dbd9d335','e7ffc2ba-6c50-41ab-9508-f4bb19126bbc'))
    OR EXISTS(SELECT 1 FROM public.clinics WHERE id IN ('d9a47157-1d36-43df-af1d-436d561ee551','e9369b5f-8a98-4bc7-a48a-5683930361af'))
    OR EXISTS(SELECT 1 FROM public.patients WHERE id IN ('b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14','0b524dc4-9edd-484e-821a-635f0a9f3d69','421114c9-80e5-4533-9cfa-55966d90b162'))
    OR to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR has_column_privilege('authenticated','public.appointments','start_time','INSERT')
  THEN RAISE EXCEPTION 'Exact new synthetic Auth actors and reviewed staging chain required'; END IF;
END $fixture$;
INSERT INTO public.clinics(id,name,address,phone,owner_id,bypass_subscription) VALUES
  ('d9a47157-1d36-43df-af1d-436d561ee551','Clínica staging sintética A','Sin clínica real','000','baef66ba-f8d8-4943-af16-26bb429f9fe0',true),
  ('e9369b5f-8a98-4bc7-a48a-5683930361af','Clínica staging sintética B','Sin clínica real','000','ee0cb878-2aaa-4265-a9b0-6d03d3659b1c',true);
UPDATE public.profiles SET clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',role='clinic_owner',status='active',full_name='Sintético owner_A' WHERE id='baef66ba-f8d8-4943-af16-26bb429f9fe0';
UPDATE public.profiles SET clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',role='doctor',status='active',full_name='Sintético doctor_A' WHERE id='272d63b1-38e3-4a60-89a2-dd07f031b2d2';
UPDATE public.profiles SET clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',role='receptionist',status='active',full_name='Sintético receptionist_A' WHERE id='1dcb64e5-1c7d-4991-8b17-68ddbdfd5306';
UPDATE public.profiles SET clinic_id='e9369b5f-8a98-4bc7-a48a-5683930361af',role='clinic_owner',status='active',full_name='Sintético owner_B' WHERE id='ee0cb878-2aaa-4265-a9b0-6d03d3659b1c';
UPDATE public.profiles SET clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',role='doctor',status='active',full_name='Sintético removed_A' WHERE id='2f0b0f71-b3e0-456d-ab03-d580dbd9d335';
UPDATE public.profiles SET clinic_id='d9a47157-1d36-43df-af1d-436d561ee551',role='doctor',status='active',full_name='Sintético auth_revoked_A' WHERE id='e7ffc2ba-6c50-41ab-9508-f4bb19126bbc';
INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES
  ('baef66ba-f8d8-4943-af16-26bb429f9fe0','d9a47157-1d36-43df-af1d-436d561ee551','clinic_owner','active'),
  ('272d63b1-38e3-4a60-89a2-dd07f031b2d2','d9a47157-1d36-43df-af1d-436d561ee551','doctor','active'),
  ('1dcb64e5-1c7d-4991-8b17-68ddbdfd5306','d9a47157-1d36-43df-af1d-436d561ee551','receptionist','active'),
  ('ee0cb878-2aaa-4265-a9b0-6d03d3659b1c','e9369b5f-8a98-4bc7-a48a-5683930361af','clinic_owner','active'),
  ('2f0b0f71-b3e0-456d-ab03-d580dbd9d335','d9a47157-1d36-43df-af1d-436d561ee551','doctor','removed'),
  ('e7ffc2ba-6c50-41ab-9508-f4bb19126bbc','d9a47157-1d36-43df-af1d-436d561ee551','doctor','active');
INSERT INTO public.patients(id,clinic_id,first_name,last_name,clinical_notes,account_balance) VALUES
  ('b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14','d9a47157-1d36-43df-af1d-436d561ee551','Inventado','Staging A','Nota clínica sintética sin uso clínico',0),
  ('0b524dc4-9edd-484e-821a-635f0a9f3d69','d9a47157-1d36-43df-af1d-436d561ee551','Segundo inventado','Staging A','Segunda nota sintética',0),
  ('421114c9-80e5-4533-9cfa-55966d90b162','e9369b5f-8a98-4bc7-a48a-5683930361af','Inventado','Staging B','Nota ajena sintética',0);
COMMIT;
