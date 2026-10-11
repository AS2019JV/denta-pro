-- Metadata-derived application schema fixture. NOT pg_dump, NOT backup, NOT deployable migration.
-- Target: fresh local synthetic Supabase 17 only. Mode: observed-fixture. Source SHA256: a2716b554df9b2fe09d732123d089470f9aa32a56702441833e446ab1280e013
-- Definitions are historical evidence, not reviewed canonical authorization. M7 remains NOT READY.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;
DO $fixture$ BEGIN IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' THEN RAISE EXCEPTION 'Explicit local synthetic fixture session marker required'; END IF; IF current_setting('server_version_num')::integer < 170000 OR current_setting('server_version_num')::integer >= 180000 THEN RAISE EXCEPTION 'Supabase PostgreSQL 17 required'; END IF; IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed Auth and Storage schemas required'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regclass('logs.access_audit') IS NOT NULL OR to_regclass('logs.access_audit_id_seq') IS NOT NULL OR to_regclass('public.appointments') IS NOT NULL OR to_regclass('public.automation_settings') IS NOT NULL OR to_regclass('public.billings') IS NOT NULL OR to_regclass('public.clinic_invitations') IS NOT NULL OR to_regclass('public.clinic_members') IS NOT NULL OR to_regclass('public.clinical_records') IS NOT NULL OR to_regclass('public.clinics') IS NOT NULL OR to_regclass('public.data_rights_requests') IS NOT NULL OR to_regclass('public.hcu033_forms') IS NOT NULL OR to_regclass('public.invoices') IS NOT NULL OR to_regclass('public.messages') IS NOT NULL OR to_regclass('public.notifications') IS NOT NULL OR to_regclass('public.patient_files') IS NOT NULL OR to_regclass('public.patient_notes') IS NOT NULL OR to_regclass('public.patients') IS NOT NULL OR to_regclass('public.payment_methods') IS NOT NULL OR to_regclass('public.payments') IS NOT NULL OR to_regclass('public.prescription_templates') IS NOT NULL OR to_regclass('public.prescriptions') IS NOT NULL OR to_regclass('public.profile_audit_log') IS NOT NULL OR to_regclass('public.profile_audit_log_id_seq') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.receptionist_patient_view') IS NOT NULL OR to_regclass('public.service_categories') IS NOT NULL OR to_regclass('public.services') IS NOT NULL OR to_regclass('public.treatments') IS NOT NULL THEN RAISE EXCEPTION 'Fixture requires an empty application schema; existing data/objects will not be overwritten'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regtype('public.app_role') IS NOT NULL OR to_regtype('public.subscription_status') IS NOT NULL OR to_regtype('public.user_status') IS NOT NULL THEN RAISE EXCEPTION 'Fixture type collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('logs.log_access_trigger()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.check_subscription_active(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_clinic_member_role(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_user_clinic_id()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.guard_data_rights_request_insert()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.is_clinic_member(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.protect_data_rights_requests()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.purge_clinic_data(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('security_internal.audit_data_rights_status()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('security_internal.enforce_clinician_assignment()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.appointments') AND tgname='trg_enforce_clinician_assignment') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.clinical_records') AND tgname='trg_enforce_clinician_assignment') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.data_rights_requests') AND tgname='trg_audit_data_rights_status') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.data_rights_requests') AND tgname='trg_guard_data_rights_request_insert') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.data_rights_requests') AND tgname='trg_protect_data_rights_requests') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.hcu033_forms') AND tgname='trg_enforce_clinician_assignment') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.prescriptions') AND tgname='trg_enforce_clinician_assignment') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated read for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated upload for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
-- Neutralize automatic ACLs before application DDL. Never replay broad remote default privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
CREATE SCHEMA "logs" AUTHORIZATION "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "logs" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "logs" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "logs" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "logs" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "logs" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "logs" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "logs" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "logs" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
CREATE SCHEMA "security_internal" AUTHORIZATION "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "security_internal" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "security_internal" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "security_internal" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "security_internal" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "security_internal" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "security_internal" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "security_internal" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "security_internal" REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE TYPE "public"."app_role" AS ENUM ('clinic_owner', 'doctor', 'receptionist');
CREATE TYPE "public"."subscription_status" AS ENUM ('active', 'past_due', 'canceled', 'trial', 'archived');
CREATE TYPE "public"."user_status" AS ENUM ('invited', 'active', 'suspended');
CREATE SEQUENCE "public"."profile_audit_log_id_seq" AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;
CREATE TABLE "logs"."access_audit" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY (SEQUENCE NAME "logs"."access_audit_id_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE) NOT NULL,
  "timestamp" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "actor_id" uuid,
  "actor_role" text COLLATE "default",
  "action" text COLLATE "default" NOT NULL,
  "table_name" text COLLATE "default" NOT NULL,
  "record_id" uuid,
  "clinic_id" uuid,
  "metadata" jsonb
);
ALTER TABLE "logs"."access_audit" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."appointments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "patient_id" uuid NOT NULL,
  "doctor_id" uuid,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "status" text COLLATE "default" DEFAULT 'scheduled'::text,
  "type" text COLLATE "default",
  "notes" text COLLATE "default",
  "clinic_id" uuid NOT NULL,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."automation_settings" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "user_id" uuid NOT NULL,
  "enabled" boolean DEFAULT false,
  "reminder_template" text COLLATE "default" DEFAULT 'Hola {patient_name}, te recordamos tu cita el {date} a las {time} con el Dr. {doctor_name}.'::text,
  "days_before" integer DEFAULT 1,
  "whatsapp_enabled" boolean DEFAULT false,
  "email_enabled" boolean DEFAULT true
);
ALTER TABLE "public"."automation_settings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billings" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "patient_id" uuid NOT NULL,
  "amount" numeric NOT NULL,
  "status" text COLLATE "default" DEFAULT 'pending'::text,
  "description" text COLLATE "default",
  "due_date" date,
  "invoice_number" text COLLATE "default",
  "appointment_id" uuid,
  "clinic_id" uuid NOT NULL,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."billings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."clinic_invitations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "email" text COLLATE "default" NOT NULL,
  "role" text COLLATE "default" NOT NULL,
  "invited_by" uuid NOT NULL,
  "status" text COLLATE "default" DEFAULT 'pending'::text NOT NULL,
  "token" text COLLATE "default" DEFAULT encode(gen_random_bytes(32), 'hex'::text),
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval)
);
ALTER TABLE "public"."clinic_invitations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."clinic_members" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "clinic_id" uuid NOT NULL,
  "role" text COLLATE "default" DEFAULT 'doctor'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "status" text COLLATE "default" DEFAULT 'active'::text
);
ALTER TABLE "public"."clinic_members" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."clinical_records" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "clinic_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "doctor_id" uuid,
  "diagnosis" bytea,
  "treatment_plan" text COLLATE "default",
  "xray_urls" text[] COLLATE "default",
  "notes" text COLLATE "default",
  "deleted_at" timestamp with time zone,
  "odontogram_state" jsonb DEFAULT '{}'::jsonb,
  "periodontogram_state" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE "public"."clinical_records" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."clinics" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "name" text COLLATE "default" NOT NULL,
  "owner_id" uuid,
  "logo_url" text COLLATE "default",
  "address" text COLLATE "default",
  "phone" text COLLATE "default",
  "email" text COLLATE "default",
  "settings" jsonb DEFAULT '{}'::jsonb,
  "disclaimer_text" text COLLATE "default" DEFAULT 'This estimate is valid for 30 days. Please contact the front desk for questions.'::text,
  "working_hours" jsonb DEFAULT '{"fri": ["09:00", "17:00"], "mon": ["09:00", "17:00"], "sat": null, "sun": null, "thu": ["09:00", "17:00"], "tue": ["09:00", "17:00"], "wed": ["09:00", "17:00"]}'::jsonb,
  "subscription_tier" text COLLATE "default" DEFAULT 'trial'::text,
  "trial_ends_at" timestamp with time zone,
  "bypass_subscription" boolean DEFAULT false,
  "subscription_status" subscription_status DEFAULT 'trial'::subscription_status,
  "kushki_subscription_id" text COLLATE "default",
  "next_billing_date" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "size" character varying COLLATE "default"
);
ALTER TABLE "public"."clinics" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."data_rights_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "user_id" uuid,
  "patient_id" uuid,
  "request_type" text COLLATE "default" NOT NULL,
  "status" text COLLATE "default" DEFAULT 'pending'::text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb,
  "legal_basis" text COLLATE "default" NOT NULL,
  "retention_note" text COLLATE "default",
  "requested_by_email" text COLLATE "default",
  "resolved_by" uuid,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolution_notes" text COLLATE "default"
);
ALTER TABLE "public"."data_rights_requests" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."hcu033_forms" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "patient_id" uuid NOT NULL,
  "doctor_id" uuid,
  "form_data" jsonb NOT NULL,
  "clinic_id" uuid DEFAULT (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid NOT NULL,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."hcu033_forms" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."invoices" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "clinic_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "billing_id" uuid,
  "invoice_number" text COLLATE "default",
  "sri_authorization" text COLLATE "default",
  "sri_access_key" text COLLATE "default",
  "xml_content" text COLLATE "default",
  "pdf_url" text COLLATE "default",
  "status" text COLLATE "default" DEFAULT 'draft'::text,
  "total_amount" numeric NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb,
  "sri_authorization_date" timestamp with time zone,
  "environment" text COLLATE "default" DEFAULT 'TEST'::text
);
ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."messages" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "sender_id" uuid NOT NULL,
  "receiver_id" uuid,
  "content" text COLLATE "default" NOT NULL,
  "is_read" boolean DEFAULT false,
  "clinic_id" uuid
);
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."notifications" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text COLLATE "default" NOT NULL,
  "message" text COLLATE "default" NOT NULL,
  "type" text COLLATE "default" DEFAULT 'info'::text,
  "is_read" boolean DEFAULT false,
  "link" text COLLATE "default"
);
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."patient_files" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "patient_id" uuid NOT NULL,
  "clinic_id" uuid NOT NULL,
  "name" text COLLATE "default" NOT NULL,
  "file_path" text COLLATE "default" NOT NULL,
  "size" text COLLATE "default" NOT NULL,
  "type" text COLLATE "default" NOT NULL,
  "uploaded_by" uuid,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."patient_files" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."patient_notes" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "patient_id" uuid NOT NULL,
  "clinic_id" uuid NOT NULL,
  "content" text COLLATE "default" NOT NULL,
  "author_id" uuid NOT NULL,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."patient_notes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."patients" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "first_name" text COLLATE "default" NOT NULL,
  "last_name" text COLLATE "default" NOT NULL,
  "cedula" text COLLATE "default",
  "email" text COLLATE "default",
  "phone" text COLLATE "default",
  "birth_date" date,
  "gender" text COLLATE "default",
  "address" text COLLATE "default",
  "medical_history" jsonb DEFAULT '{}'::jsonb,
  "clinic_id" uuid NOT NULL,
  "emergency_contact" text COLLATE "default",
  "emergency_phone" text COLLATE "default",
  "allergies" text COLLATE "default",
  "medications" text COLLATE "default",
  "medical_conditions" text COLLATE "default",
  "insurance_provider" text COLLATE "default",
  "policy_number" text COLLATE "default",
  "deleted_at" timestamp with time zone,
  "medical_alerts" text COLLATE "default",
  "occupation" text COLLATE "default",
  "guardian_name" text COLLATE "default",
  "referral_source" text COLLATE "default",
  "referred_by" text COLLATE "default",
  "clinical_notes" text COLLATE "default",
  "medical_record_number" text COLLATE "default",
  "tags" text[] COLLATE "default",
  "status" text COLLATE "default" DEFAULT 'active'::text,
  "blood_type" text COLLATE "default",
  "marital_status" text COLLATE "default",
  "city" text COLLATE "default",
  "state" text COLLATE "default",
  "has_diabetes" boolean DEFAULT false,
  "has_hypertension" boolean DEFAULT false,
  "has_heart_disease" boolean DEFAULT false,
  "is_smoker" boolean DEFAULT false,
  "is_pregnant" boolean DEFAULT false,
  "preferred_contact_method" text COLLATE "default" DEFAULT 'phone'::text,
  "recall_months" integer DEFAULT 6,
  "family_representative_id" uuid,
  "internal_notes" text COLLATE "default",
  "account_balance" numeric DEFAULT 0,
  "family_relationship" text COLLATE "default",
  "is_family_head" boolean DEFAULT false,
  "last_treatment_note" text COLLATE "default",
  "odontogram_state" jsonb DEFAULT '{}'::jsonb,
  "avatar_url" text COLLATE "default",
  "periodontogram_state" jsonb DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."payment_methods" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "doctor_id" uuid,
  "type" text COLLATE "default" NOT NULL,
  "title" text COLLATE "default",
  "config" jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "clinic_id" uuid DEFAULT (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid NOT NULL
);
ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "clinic_id" uuid NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text COLLATE "default" DEFAULT 'USD'::text,
  "status" text COLLATE "default" NOT NULL,
  "provider" text COLLATE "default" DEFAULT 'kushki'::text,
  "provider_transaction_id" text COLLATE "default",
  "metadata" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."prescription_templates" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "clinic_id" uuid DEFAULT (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid NOT NULL,
  "doctor_id" uuid,
  "name" text COLLATE "default" NOT NULL,
  "data" jsonb NOT NULL
);
ALTER TABLE "public"."prescription_templates" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."prescriptions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "patient_id" uuid NOT NULL,
  "doctor_id" uuid,
  "clinic_id" uuid NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE "public"."prescriptions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."profile_audit_log" (
  "id" bigint DEFAULT nextval('profile_audit_log_id_seq'::regclass) NOT NULL,
  "target_user_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text COLLATE "default",
  "action" text COLLATE "default" NOT NULL,
  "old_data" jsonb,
  "new_data" jsonb,
  "changed_fields" text[] COLLATE "default",
  "ip_address" text COLLATE "default",
  "user_agent" text COLLATE "default",
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."profile_audit_log" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."profiles" (
  "id" uuid NOT NULL,
  "full_name" text COLLATE "default",
  "role" app_role,
  "avatar_url" text COLLATE "default",
  "email" text COLLATE "default",
  "phone" text COLLATE "default",
  "address" text COLLATE "default",
  "specialization" text COLLATE "default",
  "license_number" text COLLATE "default",
  "bio" text COLLATE "default",
  "updated_at" timestamp with time zone,
  "clinic_id" uuid,
  "deleted_at" timestamp with time zone,
  "status" user_status DEFAULT 'active'::user_status,
  "title" text COLLATE "default"
);
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."service_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "name" text COLLATE "default" NOT NULL,
  "color" text COLLATE "default" DEFAULT '#145247'::text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."services" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "clinic_id" uuid DEFAULT (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid NOT NULL,
  "name" text COLLATE "default" NOT NULL,
  "description" text COLLATE "default",
  "price" numeric DEFAULT 0.00 NOT NULL,
  "duration_minutes" integer DEFAULT 30,
  "category" text COLLATE "default" DEFAULT 'General'::text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "color" text COLLATE "default" DEFAULT '#145247'::text,
  "category_id" uuid
);
ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."treatments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text COLLATE "default" NOT NULL,
  "price" numeric DEFAULT 0 NOT NULL,
  "duration" integer DEFAULT 30 NOT NULL,
  "description" text COLLATE "default",
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid,
  "clinic_id" uuid
);
ALTER TABLE "public"."treatments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "logs"."access_audit" ADD CONSTRAINT "access_audit_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."automation_settings" ADD CONSTRAINT "automation_settings_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."clinics" ADD CONSTRAINT "clinics_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."payment_methods" ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."prescription_templates" ADD CONSTRAINT "prescription_templates_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."profile_audit_log" ADD CONSTRAINT "profile_audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."service_categories" ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."services" ADD CONSTRAINT "services_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."treatments" ADD CONSTRAINT "treatments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_id_clinic_id_key" UNIQUE (id, clinic_id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE;
ALTER TABLE "public"."automation_settings" ADD CONSTRAINT "automation_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id);
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id);
ALTER TABLE "public"."clinics" ADD CONSTRAINT "clinics_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE SET NULL (patient_id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE;
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_billing_id_fkey" FOREIGN KEY (billing_id) REFERENCES billings(id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES profiles(id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id);
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE;
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id);
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE;
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_family_clinic_fkey" FOREIGN KEY (family_representative_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE SET NULL (family_representative_id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_family_representative_id_fkey" FOREIGN KEY (family_representative_id) REFERENCES patients(id);
ALTER TABLE "public"."payment_methods" ADD CONSTRAINT "payment_methods_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."payment_methods" ADD CONSTRAINT "payment_methods_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."prescription_templates" ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES auth.users(id);
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_patient_clinic_fkey" FOREIGN KEY (patient_id, clinic_id) REFERENCES patients(id, clinic_id) ON DELETE CASCADE;
ALTER TABLE "public"."profile_audit_log" ADD CONSTRAINT "profile_audit_log_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES profiles(id);
ALTER TABLE "public"."profile_audit_log" ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id);
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."service_categories" ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES service_categories(id);
ALTER TABLE "public"."services" ADD CONSTRAINT "services_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."treatments" ADD CONSTRAINT "treatments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."treatments" ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
CREATE INDEX idx_appointments_clinic_patient ON public.appointments USING btree (clinic_id, patient_id);
CREATE INDEX idx_appointments_clinic_start ON public.appointments USING btree (clinic_id, start_time);
CREATE INDEX idx_appointments_conflict ON public.appointments USING btree (clinic_id, doctor_id, start_time, end_time) WHERE (status <> 'cancelled'::text);
CREATE INDEX idx_appointments_patient_doctor ON public.appointments USING btree (clinic_id, patient_id, doctor_id);
CREATE INDEX idx_billings_clinic_patient ON public.billings USING btree (clinic_id, patient_id);
CREATE INDEX idx_clinical_records_clinic_patient ON public.clinical_records USING btree (clinic_id, patient_id);
CREATE INDEX idx_data_rights_requests_clinic_patient ON public.data_rights_requests USING btree (clinic_id, patient_id);
CREATE INDEX idx_hcu033_clinic_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX idx_invoices_clinic_patient ON public.invoices USING btree (clinic_id, patient_id);
CREATE INDEX idx_patient_files_clinic_patient ON public.patient_files USING btree (clinic_id, patient_id);
CREATE INDEX idx_patient_notes_clinic_patient ON public.patient_notes USING btree (clinic_id, patient_id);
CREATE INDEX idx_patients_clinic_cedula ON public.patients USING btree (clinic_id, cedula);
CREATE INDEX idx_prescriptions_clinic_created ON public.prescriptions USING btree (clinic_id, created_at DESC);
CREATE INDEX idx_prescriptions_clinic_patient ON public.prescriptions USING btree (clinic_id, patient_id);
CREATE OR REPLACE FUNCTION logs.log_access_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = check_clinic_id
    AND (
      bypass_subscription = true 
      OR 
      (subscription_status = 'active')
      OR
      (trial_ends_at > NOW()) 
    )
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_clinic_member_role(check_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL OR check_clinic_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = check_clinic_id
      AND user_id = auth.uid()
      AND status <> 'active'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT cm.role INTO v_role
  FROM public.clinic_members cm
  WHERE cm.clinic_id = check_clinic_id
    AND cm.user_id = auth.uid()
    AND cm.status = 'active';

  IF v_role IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = check_clinic_id
        AND owner_id = auth.uid()
    ) THEN
      v_role := 'clinic_owner';
    END IF;
  END IF;

  RETURN v_role;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid,
    (SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1),
    (SELECT id FROM public.clinics WHERE owner_id = auth.uid() LIMIT 1)
  );
$function$;
CREATE OR REPLACE FUNCTION public.guard_data_rights_request_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR check_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = check_clinic_id
      AND user_id = auth.uid()
      AND status <> 'active'
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.clinic_members 
    WHERE clinic_id = check_clinic_id 
      AND user_id = auth.uid()
      AND status = 'active'
    UNION
    SELECT 1 FROM public.clinics
    WHERE id = check_clinic_id
      AND owner_id = auth.uid()
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION security_internal.audit_data_rights_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE VIEW "public"."receptionist_patient_view" ("id", "clinic_id", "first_name", "last_name", "cedula", "phone", "email", "created_at") WITH (security_invoker=true) AS
 SELECT id,
    clinic_id,
    first_name,
    last_name,
    cedula,
    phone,
    email,
    created_at
   FROM patients;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON appointments FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON clinical_records FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
CREATE TRIGGER trg_audit_data_rights_status AFTER UPDATE OF status ON data_rights_requests FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION security_internal.audit_data_rights_status();
CREATE TRIGGER trg_guard_data_rights_request_insert BEFORE INSERT ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION guard_data_rights_request_insert();
CREATE TRIGGER trg_protect_data_rights_requests BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests();
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
CREATE POLICY "Medical staff can view clinical records" ON "public"."clinical_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Authenticated users can submit data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND (user_id = auth.uid()) AND (status = 'pending'::text) AND (resolved_by IS NULL) AND (resolved_at IS NULL) AND (resolution_notes IS NULL)));
CREATE POLICY "Clinic members can view data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND ((user_id = auth.uid()) OR (get_clinic_member_role(clinic_id) = 'clinic_owner'::text))));
CREATE POLICY "Clinic owners can update data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = 'clinic_owner'::text))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = 'clinic_owner'::text)));
CREATE POLICY "Clinical staff can view hcu033_forms" ON "public"."hcu033_forms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can insert patient files" ON "public"."patient_files" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can update patient files" ON "public"."patient_files" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (uploaded_by = auth.uid()))) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can view patient files" ON "public"."patient_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL)));
CREATE POLICY "Clinical staff can insert patient notes" ON "public"."patient_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can update patient notes" ON "public"."patient_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (author_id = auth.uid()))) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can view patient notes" ON "public"."patient_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL)));
CREATE POLICY "Tenant isolated read for patient-files" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated upload for patient-files" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
ALTER TABLE "logs"."access_audit" OWNER TO "postgres";
ALTER TABLE "public"."appointments" OWNER TO "postgres";
ALTER TABLE "public"."automation_settings" OWNER TO "postgres";
ALTER TABLE "public"."billings" OWNER TO "postgres";
ALTER TABLE "public"."clinic_invitations" OWNER TO "postgres";
ALTER TABLE "public"."clinic_members" OWNER TO "postgres";
ALTER TABLE "public"."clinical_records" OWNER TO "postgres";
ALTER TABLE "public"."clinics" OWNER TO "postgres";
ALTER TABLE "public"."data_rights_requests" OWNER TO "postgres";
ALTER TABLE "public"."hcu033_forms" OWNER TO "postgres";
ALTER TABLE "public"."invoices" OWNER TO "postgres";
ALTER TABLE "public"."messages" OWNER TO "postgres";
ALTER TABLE "public"."notifications" OWNER TO "postgres";
ALTER TABLE "public"."patient_files" OWNER TO "postgres";
ALTER TABLE "public"."patient_notes" OWNER TO "postgres";
ALTER TABLE "public"."patients" OWNER TO "postgres";
ALTER TABLE "public"."payment_methods" OWNER TO "postgres";
ALTER TABLE "public"."payments" OWNER TO "postgres";
ALTER TABLE "public"."prescription_templates" OWNER TO "postgres";
ALTER TABLE "public"."prescriptions" OWNER TO "postgres";
ALTER TABLE "public"."profile_audit_log" OWNER TO "postgres";
ALTER SEQUENCE "public"."profile_audit_log_id_seq" OWNER TO "postgres";
ALTER TABLE "public"."profiles" OWNER TO "postgres";
ALTER VIEW "public"."receptionist_patient_view" OWNER TO "postgres";
ALTER TABLE "public"."service_categories" OWNER TO "postgres";
ALTER TABLE "public"."services" OWNER TO "postgres";
ALTER TABLE "public"."treatments" OWNER TO "postgres";
ALTER FUNCTION "logs"."log_access_trigger"() OWNER TO "postgres";
ALTER FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_user_clinic_id"() OWNER TO "postgres";
ALTER FUNCTION "public"."guard_data_rights_request_insert"() OWNER TO "postgres";
ALTER FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."protect_data_rights_requests"() OWNER TO "postgres";
ALTER FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "security_internal"."audit_data_rights_status"() OWNER TO "postgres";
ALTER FUNCTION "security_internal"."enforce_clinician_assignment"() OWNER TO "postgres";
ALTER TYPE "public"."app_role" OWNER TO "postgres";
ALTER TYPE "public"."subscription_status" OWNER TO "postgres";
ALTER TYPE "public"."user_status" OWNER TO "postgres";
ALTER SCHEMA "logs" OWNER TO "postgres";
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
ALTER SCHEMA "security_internal" OWNER TO "postgres";
REVOKE ALL ON SCHEMA "logs" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE, CREATE ON SCHEMA "logs" TO "postgres";
REVOKE ALL ON SCHEMA "public" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE, CREATE ON SCHEMA "public" TO "pg_database_owner";
GRANT USAGE ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
REVOKE ALL ON SCHEMA "security_internal" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE, CREATE ON SCHEMA "security_internal" TO "postgres";
REVOKE ALL ON TYPE "public"."app_role" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."app_role" TO "postgres";
GRANT USAGE ON TYPE "public"."app_role" TO PUBLIC;
REVOKE ALL ON TYPE "public"."subscription_status" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."subscription_status" TO "postgres";
GRANT USAGE ON TYPE "public"."subscription_status" TO PUBLIC;
REVOKE ALL ON TYPE "public"."user_status" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."user_status" TO "postgres";
GRANT USAGE ON TYPE "public"."user_status" TO PUBLIC;
REVOKE ALL ON TABLE "logs"."access_audit" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "logs"."access_audit" TO "postgres";
REVOKE ALL ON SEQUENCE "logs"."access_audit_id_seq" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "logs"."access_audit_id_seq" TO "postgres";
REVOKE ALL ON TABLE "public"."appointments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."appointments" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."appointments" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."appointments" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."appointments" TO "service_role";
REVOKE ALL ON TABLE "public"."automation_settings" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."automation_settings" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."automation_settings" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."automation_settings" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."automation_settings" TO "service_role";
REVOKE ALL ON TABLE "public"."billings" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."billings" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."billings" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."billings" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."billings" TO "service_role";
REVOKE ALL ON TABLE "public"."clinic_invitations" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_invitations" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_invitations" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_invitations" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_invitations" TO "service_role";
REVOKE ALL ON TABLE "public"."clinic_members" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_members" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_members" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_members" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_members" TO "service_role";
REVOKE ALL ON TABLE "public"."clinical_records" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinical_records" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinical_records" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinical_records" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinical_records" TO "service_role";
REVOKE ALL ON TABLE "public"."clinics" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinics" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinics" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinics" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinics" TO "service_role";
REVOKE ALL ON TABLE "public"."data_rights_requests" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."data_rights_requests" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."data_rights_requests" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."data_rights_requests" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."data_rights_requests" TO "service_role";
REVOKE ALL ON TABLE "public"."hcu033_forms" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."hcu033_forms" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."hcu033_forms" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."hcu033_forms" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."hcu033_forms" TO "service_role";
REVOKE ALL ON TABLE "public"."invoices" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."invoices" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."invoices" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."invoices" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."invoices" TO "service_role";
REVOKE ALL ON TABLE "public"."messages" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."messages" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."messages" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."messages" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."messages" TO "service_role";
REVOKE ALL ON TABLE "public"."notifications" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."notifications" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."notifications" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."notifications" TO "service_role";
REVOKE ALL ON TABLE "public"."patient_files" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_files" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_files" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_files" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_files" TO "service_role";
REVOKE ALL ON TABLE "public"."patient_notes" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_notes" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_notes" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_notes" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_notes" TO "service_role";
REVOKE ALL ON TABLE "public"."patients" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patients" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patients" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patients" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patients" TO "service_role";
REVOKE ALL ON TABLE "public"."payment_methods" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payment_methods" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payment_methods" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payment_methods" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payment_methods" TO "service_role";
REVOKE ALL ON TABLE "public"."payments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payments" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payments" TO "service_role";
REVOKE ALL ON TABLE "public"."prescription_templates" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescription_templates" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescription_templates" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescription_templates" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescription_templates" TO "service_role";
REVOKE ALL ON TABLE "public"."prescriptions" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescriptions" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescriptions" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescriptions" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescriptions" TO "service_role";
REVOKE ALL ON TABLE "public"."profile_audit_log" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profile_audit_log" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profile_audit_log" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profile_audit_log" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profile_audit_log" TO "service_role";
REVOKE ALL ON SEQUENCE "public"."profile_audit_log_id_seq" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profile_audit_log_id_seq" TO "postgres";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profile_audit_log_id_seq" TO "anon";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profile_audit_log_id_seq" TO "authenticated";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profile_audit_log_id_seq" TO "service_role";
REVOKE ALL ON TABLE "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profiles" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profiles" TO "service_role";
REVOKE ALL ON TABLE "public"."receptionist_patient_view" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."receptionist_patient_view" TO "postgres";
GRANT SELECT ON TABLE "public"."receptionist_patient_view" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."receptionist_patient_view" TO "service_role";
REVOKE ALL ON TABLE "public"."service_categories" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."service_categories" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."service_categories" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."service_categories" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."service_categories" TO "service_role";
REVOKE ALL ON TABLE "public"."services" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."services" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."services" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."services" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."services" TO "service_role";
REVOKE ALL ON TABLE "public"."treatments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."treatments" TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."treatments" TO "anon";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."treatments" TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."treatments" TO "service_role";
REVOKE ALL ON FUNCTION "logs"."log_access_trigger"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "logs"."log_access_trigger"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."get_user_clinic_id"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."guard_data_rights_request_insert"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."guard_data_rights_request_insert"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."guard_data_rights_request_insert"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."protect_data_rights_requests"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."protect_data_rights_requests"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."protect_data_rights_requests"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "security_internal"."audit_data_rights_status"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "security_internal"."audit_data_rights_status"() TO "postgres";
REVOKE ALL ON FUNCTION "security_internal"."enforce_clinician_assignment"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "security_internal"."enforce_clinician_assignment"() TO "postgres";
COMMIT;
-- Installation proves only scoped fixture creation after actual runtime verification; it does not approve production.
