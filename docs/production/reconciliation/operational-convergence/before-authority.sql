-- Generated OFFLINE from reviewed captures; LOCAL SYNTHETIC ONLY. Not a remote migration.
-- Read operational-convergence/README.md. Apply after M7, before encargo02.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
DO $local$ BEGIN
IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' OR current_setting('app.operational_convergence_authorized',true) IS DISTINCT FROM 'reviewed-local-contract' OR session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed local postgres executor required'; END IF;
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
COMMIT;
