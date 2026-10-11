-- SQL integrity proof only; no fabricated JWT or assertion of API authorization.
-- All new fixture rows, audit rows and trigger state roll back.
BEGIN;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('99999999-9999-4999-8999-999999999999','integrity-test@clinia.invalid','{"full_name":"Sintético"}');
UPDATE public.profiles SET status='active',role='doctor',clinic_id='55555555-5555-4555-8555-555555555555' WHERE id='99999999-9999-4999-8999-999999999999';
INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES('99999999-9999-4999-8999-999999999999','55555555-5555-4555-8555-555555555555','doctor','active');
DO $check$ BEGIN
  BEGIN INSERT INTO public.clinic_members(user_id,clinic_id,role,status) VALUES('99999999-9999-4999-8999-999999999999','55555555-5555-4555-8555-555555555555','receptionist','active');
    RAISE EXCEPTION 'Duplicate membership accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $check$;
SELECT 'PASS duplicate membership rejected';
INSERT INTO public.patients(clinic_id,first_name,last_name,cedula) VALUES('55555555-5555-4555-8555-555555555555','Sintético','Documento','TEST-UNIQUE');
DO $check$ BEGIN
  BEGIN INSERT INTO public.patients(clinic_id,first_name,last_name,cedula) VALUES('55555555-5555-4555-8555-555555555555','Sintético','Duplicado','TEST-UNIQUE');
    RAISE EXCEPTION 'Duplicate document accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $check$;
SELECT 'PASS duplicate patient document rejected';
INSERT INTO public.service_categories(clinic_id,name) VALUES('55555555-5555-4555-8555-555555555555','Categoría sintética');
DO $check$ BEGIN
  BEGIN INSERT INTO public.service_categories(clinic_id,name) VALUES('55555555-5555-4555-8555-555555555555','Categoría sintética');
    RAISE EXCEPTION 'Duplicate category accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $check$;
SELECT 'PASS duplicate category rejected';
INSERT INTO public.clinics(id,name) VALUES('77777777-7777-4777-8777-777777777777','Otra clínica sintética');
INSERT INTO public.patients(id,clinic_id,first_name,last_name) VALUES('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777','Sintético','Ajeno');
DO $check$ BEGIN
  BEGIN UPDATE public.patients SET family_representative_id='88888888-8888-4888-8888-888888888888' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    RAISE EXCEPTION 'Cross clinic family accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $check$;
SELECT 'PASS cross clinic family FK rejected';
-- Isolate physical agenda constraints from authentication triggers in this
-- rolled-back secondary SQL test. Actual JWT transitions are a separate gate.
ALTER TABLE public.appointments DISABLE TRIGGER agenda_guard;
ALTER TABLE public.appointments DISABLE TRIGGER agenda_audit;
INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,status,type) VALUES('55555555-5555-4555-8555-555555555555','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','99999999-9999-4999-8999-999999999999','2038-01-01 14:00Z','2038-01-01 14:30Z','scheduled','Prueba');
DO $check$ BEGIN
  BEGIN INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,status,type) VALUES('55555555-5555-4555-8555-555555555555','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','99999999-9999-4999-8999-999999999999','2038-01-01 14:10Z','2038-01-01 14:40Z','scheduled','Prueba');
    RAISE EXCEPTION 'Overlap accepted'; EXCEPTION WHEN exclusion_violation THEN NULL; END;
END $check$;
INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,status,type) VALUES('55555555-5555-4555-8555-555555555555','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','99999999-9999-4999-8999-999999999999','2038-01-01 14:30Z','2038-01-01 15:00Z','scheduled','Prueba');
SELECT 'PASS overlap rejected and adjacent interval accepted';
DO $check$ BEGIN
  BEGIN UPDATE public.appointments SET status='invented' WHERE clinic_id='55555555-5555-4555-8555-555555555555';
    RAISE EXCEPTION 'Invalid appointment state accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $check$;
SELECT 'PASS invalid appointment state rejected';
DO $check$ BEGIN
  IF EXISTS(SELECT 1 FROM public.profile_audit_log WHERE target_user_id='99999999-9999-4999-8999-999999999999' AND (old_data ?| ARRAY['email','phone','full_name'] OR new_data ?| ARRAY['email','phone','full_name']))
    OR NOT EXISTS(SELECT 1 FROM public.profile_audit_log WHERE target_user_id='99999999-9999-4999-8999-999999999999' AND action='update_profile')
  THEN RAISE EXCEPTION 'Profile audit scope incorrect'; END IF;
END $check$;
SELECT 'PASS profile audit excludes personal contact payload';
ROLLBACK;
