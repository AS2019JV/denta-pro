-- Metadata-derived application schema fixture. NOT pg_dump, NOT backup, NOT deployable migration.
-- Target: fresh local synthetic Supabase 17 only. Mode: deny-client. Source SHA256: 1b397bcc4406826a3fcb04bce060e1e62658f2b450a1ab9ffe67364b32aa744b
-- Definitions are historical evidence, not reviewed canonical authorization. M7 remains NOT READY.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;
DO $fixture$ BEGIN IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' THEN RAISE EXCEPTION 'Explicit local synthetic fixture session marker required'; END IF; IF current_setting('server_version_num')::integer < 170000 OR current_setting('server_version_num')::integer >= 180000 THEN RAISE EXCEPTION 'Supabase PostgreSQL 17 required'; END IF; IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed Auth and Storage schemas required'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regclass('logs.access_audit') IS NOT NULL OR to_regclass('logs.access_audit_id_seq') IS NOT NULL OR to_regclass('public.appointments') IS NOT NULL OR to_regclass('public.automation_settings') IS NOT NULL OR to_regclass('public.billings') IS NOT NULL OR to_regclass('public.clinic_invitations') IS NOT NULL OR to_regclass('public.clinic_members') IS NOT NULL OR to_regclass('public.clinical_records') IS NOT NULL OR to_regclass('public.clinics') IS NOT NULL OR to_regclass('public.dashboard_stats_view') IS NOT NULL OR to_regclass('public.data_rights_requests') IS NOT NULL OR to_regclass('public.hcu033_forms') IS NOT NULL OR to_regclass('public.invoices') IS NOT NULL OR to_regclass('public.messages') IS NOT NULL OR to_regclass('public.notifications') IS NOT NULL OR to_regclass('public.patient_files') IS NOT NULL OR to_regclass('public.patient_notes') IS NOT NULL OR to_regclass('public.patient_stats_view') IS NOT NULL OR to_regclass('public.patients') IS NOT NULL OR to_regclass('public.payment_methods') IS NOT NULL OR to_regclass('public.payments') IS NOT NULL OR to_regclass('public.prescription_templates') IS NOT NULL OR to_regclass('public.prescriptions') IS NOT NULL OR to_regclass('public.profile_audit_log') IS NOT NULL OR to_regclass('public.profile_audit_log_id_seq') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.recall_queue') IS NOT NULL OR to_regclass('public.receptionist_patient_view') IS NOT NULL OR to_regclass('public.service_categories') IS NOT NULL OR to_regclass('public.services') IS NOT NULL OR to_regclass('public.treatments') IS NOT NULL THEN RAISE EXCEPTION 'Fixture requires an empty application schema; existing data/objects will not be overwritten'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regtype('public.app_role') IS NOT NULL OR to_regtype('public.subscription_status') IS NOT NULL OR to_regtype('public.user_status') IS NOT NULL THEN RAISE EXCEPTION 'Fixture type collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('logs.log_access_trigger()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('logs.log_patient_view(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.accept_clinic_invitation(text)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.archive_clinic(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.check_subscription_active(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.cleanup_soft_deleted_records()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.create_tenant_clinic(text, text, text)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.enforce_patient_clinical_privileges()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_checkout_payment_methods(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_clinic_member_role(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_family_unit_with_stats(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_patient_profile_secure(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_patients_with_stats(uuid, text, integer, integer, text, text, boolean, uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.get_user_clinic_id()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.guard_patient_clinical_insert()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.handle_verified_clinic_creation()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.is_clinic_member(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.log_data_rights_request(text, jsonb, text, text)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.log_profile_changes()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.prevent_profile_privilege_escalation()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.protect_data_rights_requests()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.purge_clinic_data(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.remove_clinic_member(uuid, uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.seed_default_services(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.sync_hcu033_form_clinic_id()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.update_billing_status()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF to_regprocedure('public.update_patient_odontogram_summary()') IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('auth.users') AND tgname='on_auth_user_created') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('auth.users') AND tgname='on_auth_user_verified') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.billings') AND tgname='audit_billings') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.clinical_records') AND tgname='audit_clinical_records') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.data_rights_requests') AND tgname='trg_protect_data_requests_immutability') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.data_rights_requests') AND tgname='trg_protect_data_rights_requests') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.hcu033_forms') AND tgname='audit_hcu033_forms') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.hcu033_forms') AND tgname='tr_update_patient_odontogram') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.hcu033_forms') AND tgname='trg_sync_hcu033_form_clinic_id') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.patients') AND tgname='audit_patients') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.patients') AND tgname='trg_enforce_patient_clinical_privileges') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.patients') AND tgname='trg_guard_patient_clinical_insert') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.profiles') AND tgname='set_profiles_updated_at') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.profiles') AND tgname='trg_log_profile_changes') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.profiles') AND tgname='trg_prevent_profile_privilege_escalation') THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Anyone can update an avatar') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Anyone can upload an avatar') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users update doctor avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users upload doctor avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar images are publicly accessible') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can delete their logos') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can update their logos') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can upload logos') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public Access to Clinic Logos') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public Access to Doctor Avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated delete for patient-avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated delete for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated delete for receipts') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated insert for patient-avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated insert for receipts') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated read for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated select for patient-avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated select for receipts') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated update for patient-avatars') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated update for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated update for receipts') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Tenant isolated upload for patient-files') THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;
DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','clinia','clinia-assets','clinic-branding','doctor-avatars','patient-avatars','patient-files','receipts','Whats-Storage','wstorag')) THEN RAISE EXCEPTION 'Fixture bucket collision'; END IF; END $fixture$;
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
  "clinic_id" uuid,
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
  "clinic_id" uuid,
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
  "size" character varying(50) COLLATE "default"
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."data_rights_requests" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."hcu033_forms" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "patient_id" uuid NOT NULL,
  "doctor_id" uuid,
  "form_data" jsonb NOT NULL,
  "clinic_id" uuid DEFAULT (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "public"."hcu033_forms" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."invoices" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "clinic_id" uuid,
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
  "clinic_id" uuid,
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
  "amount" numeric(10,2) NOT NULL,
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
  "clinic_id" uuid,
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
  "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
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
ALTER SEQUENCE "public"."profile_audit_log_id_seq" OWNED BY "public"."profile_audit_log"."id";
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
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_email_status_key" UNIQUE (clinic_id, email, status);
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_token_key" UNIQUE (token);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_user_id_clinic_id_key" UNIQUE (user_id, clinic_id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_cedula_clinic_unique" UNIQUE (cedula, clinic_id);
ALTER TABLE "public"."service_categories" ADD CONSTRAINT "service_categories_clinic_id_name_key" UNIQUE (clinic_id, name);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_status_check" CHECK (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_status_check" CHECK (status = ANY (ARRAY['paid'::text, 'pending'::text, 'overdue'::text]));
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_role_check" CHECK (role = ANY (ARRAY['doctor'::text, 'receptionist'::text]));
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]));
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_request_type_check" CHECK (request_type = ANY (ARRAY['portability'::text, 'deletion'::text, 'rectification'::text, 'access'::text, 'opposition'::text, 'custody_lock'::text]));
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'archived_custody'::text]));
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'authorized'::text, 'rejected'::text, 'cancelled'::text]));
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text]));
ALTER TABLE "public"."prescription_templates" ADD CONSTRAINT "prescription_templates_clinic_id_check" CHECK (clinic_id IS NOT NULL);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE "public"."automation_settings" ADD CONSTRAINT "automation_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."billings" ADD CONSTRAINT "billings_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."clinic_invitations" ADD CONSTRAINT "clinic_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."clinic_members" ADD CONSTRAINT "clinic_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."clinical_records" ADD CONSTRAINT "clinical_records_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE "public"."clinics" ADD CONSTRAINT "clinics_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id);
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE "public"."data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."hcu033_forms" ADD CONSTRAINT "hcu033_forms_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_billing_id_fkey" FOREIGN KEY (billing_id) REFERENCES billings(id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES profiles(id);
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id);
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE "public"."patient_files" ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."patient_notes" ADD CONSTRAINT "patient_notes_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_family_representative_id_fkey" FOREIGN KEY (family_representative_id) REFERENCES patients(id);
ALTER TABLE "public"."payment_methods" ADD CONSTRAINT "payment_methods_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."payment_methods" ADD CONSTRAINT "payment_methods_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id);
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."prescription_templates" ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE "public"."profile_audit_log" ADD CONSTRAINT "profile_audit_log_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES profiles(id);
ALTER TABLE "public"."profile_audit_log" ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."service_categories" ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE "public"."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;
ALTER TABLE "public"."services" ADD CONSTRAINT "services_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."treatments" ADD CONSTRAINT "treatments_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE "public"."treatments" ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
CREATE INDEX idx_access_audit_clinic_id ON logs.access_audit USING btree (clinic_id);
CREATE INDEX idx_appointments_clinic_id ON public.appointments USING btree (clinic_id);
CREATE INDEX idx_billings_clinic_id ON public.billings USING btree (clinic_id);
CREATE INDEX idx_clinic_invitations_email ON public.clinic_invitations USING btree (email);
CREATE INDEX idx_clinic_invitations_status ON public.clinic_invitations USING btree (status);
CREATE INDEX idx_clinic_members_auth_lookup ON public.clinic_members USING btree (user_id, clinic_id, status);
CREATE INDEX idx_clinical_records_clinic_id ON public.clinical_records USING btree (clinic_id);
CREATE INDEX idx_data_rights_requests_tenant ON public.data_rights_requests USING btree (clinic_id, created_at DESC);
CREATE INDEX idx_data_rights_requests_type ON public.data_rights_requests USING btree (clinic_id, request_type);
CREATE INDEX idx_hcu033_forms_clinic_id ON public.hcu033_forms USING btree (clinic_id);
CREATE INDEX idx_hcu033_forms_tenant_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX idx_invoices_clinic_id ON public.invoices USING btree (clinic_id);
CREATE INDEX idx_messages_clinic_id ON public.messages USING btree (clinic_id);
CREATE INDEX idx_patient_files_patient ON public.patient_files USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_patient_notes_patient ON public.patient_notes USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_patients_clinic_deleted ON public.patients USING btree (clinic_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_patients_clinic_id ON public.patients USING btree (clinic_id);
CREATE INDEX idx_patients_email ON public.patients USING btree (email);
CREATE INDEX idx_patients_family_rep ON public.patients USING btree (family_representative_id);
CREATE INDEX idx_payment_methods_clinic_active ON public.payment_methods USING btree (clinic_id, is_active);
CREATE INDEX idx_payment_methods_clinic_id ON public.payment_methods USING btree (clinic_id);
CREATE INDEX idx_payments_clinic_id ON public.payments USING btree (clinic_id);
CREATE INDEX idx_prescriptions_tenant_doctor ON public.prescriptions USING btree (clinic_id, doctor_id, patient_id);
CREATE INDEX idx_profiles_clinic_id ON public.profiles USING btree (clinic_id);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX profiles_license_key ON public.profiles USING btree (license_number) WHERE (license_number IS NOT NULL);
CREATE INDEX idx_services_clinic_id ON public.services USING btree (clinic_id);
CREATE INDEX idx_treatments_clinic_id ON public.treatments USING btree (clinic_id);
CREATE OR REPLACE FUNCTION logs.log_access_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO logs.access_audit (
        actor_id,
        actor_role,
        action,
        table_name,
        record_id,
        clinic_id,
        metadata
    ) VALUES (
        auth.uid(),
        (auth.jwt() -> 'app_metadata' ->> 'role'),
        TG_OP, -- 'INSERT', 'UPDATE', 'DELETE'
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN (OLD.clinic_id)::uuid
            WHEN TG_TABLE_NAME = 'profiles' THEN (NEW.clinic_id)::uuid 
            WHEN TG_TABLE_NAME = 'clinics' THEN (NEW.id)::uuid
            ELSE (NEW.clinic_id)::uuid
        END,
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW)
        )
    );
    RETURN NULL; -- Return value ignored for AFTER triggers
END;
$function$;
CREATE OR REPLACE FUNCTION logs.log_patient_view(p_patient_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Extract clinic_id from JWT (Performance & Security)
  v_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

  IF v_user_id IS NOT NULL AND v_clinic_id IS NOT NULL THEN
    INSERT INTO logs.access_audit (
      clinic_id,
      user_id,
      table_name,
      record_id,
      operation,
      old_data,
      new_data,
      created_at
    ) VALUES (
      v_clinic_id,
      v_user_id,
      'patients',
      p_patient_id,
      'SELECT',
      null,
      jsonb_build_object('source', 'patient_profile_view', 'client', 'web_dashboard'),
      now()
    );
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.accept_clinic_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation public.clinic_invitations%ROWTYPE;
  v_caller_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'User record not found.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.clinic_invitations
  WHERE token = p_token
    AND LOWER(email) = LOWER(v_caller_email)
    AND status = 'pending'
    AND expires_at > now();

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or unauthorized invitation token.' USING ERRCODE = 'P0002';
  END IF;

  -- Set transaction-scoped authorized context
  PERFORM set_config('app.authorized_internal_action', 'true', true);

  -- Enroll member into clinic_members
  INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
  VALUES (auth.uid(), v_invitation.clinic_id, v_invitation.role, 'active')
  ON CONFLICT (user_id, clinic_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

  -- Update user profile to reflect clinic assignment
  UPDATE public.profiles
  SET 
    clinic_id = v_invitation.clinic_id,
    role = v_invitation.role::public.app_role,
    status = 'active'::public.user_status,
    updated_at = now()
  WHERE id = auth.uid();

  -- Mark invitation accepted
  UPDATE public.clinic_invitations
  SET status = 'accepted'
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true, 
    'clinic_id', v_invitation.clinic_id,
    'role', v_invitation.role
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- PROD CHANGE: Removed JWT 'subscription_active' check to prevent access drift.
  -- Always verify against the live database source of truth.
  
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
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete notifications older than 90 days
  DELETE FROM public.notifications 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleanup run at %s. Safe mode active.', NOW();
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_tenant_clinic(clinic_name text, clinic_address text, clinic_phone text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_clinic_id UUID;
  new_profile_id UUID;
  user_full_name TEXT;
BEGIN
  -- 1. Security Check: Ensure user doesn't already belong to a clinic
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a clinic.';
  END IF;

  -- 2. Create the Clinic (14 Day Trial)
  INSERT INTO public.clinics (name, address, phone, subscription_tier, trial_ends_at)
  VALUES (
      clinic_name, 
      clinic_address, 
      clinic_phone, 
      'trial',
      (now() + INTERVAL '14 days') -- Enforce 14-day trial
  )
  RETURNING id INTO new_clinic_id;

  -- 3. Fetch user name from valid signup metadata
  SELECT raw_user_meta_data->>'full_name' INTO user_full_name
  FROM auth.users
  WHERE id = auth.uid();

  -- 4. Create the Owner Profile linked to this new clinic
  INSERT INTO public.profiles (id, clinic_id, role, full_name, status)
  VALUES (
    auth.uid(), 
    new_clinic_id, 
    'clinic_owner', 
    COALESCE(user_full_name, 'Clinic Admin'), 
    'active'
  )
  RETURNING id INTO new_profile_id;

  RETURN json_build_object('clinic_id', new_clinic_id, 'role', 'clinic_owner');
END;
$function$;
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  claims jsonb;
  user_role text;
  user_clinic_id uuid;
  user_status text;
  
  -- Clinic Data
  c_subscription_status text;
  c_trial_ends_at timestamptz;
  c_bypass boolean;
  
  -- Computed
  is_active boolean;
BEGIN
  -- Fetch Profile & Clinic Data in one efficient query
  SELECT 
    p.role, 
    p.clinic_id,
    p.status,
    c.subscription_status::text,
    c.trial_ends_at,
    c.bypass_subscription
  INTO 
    user_role, user_clinic_id, user_status, c_subscription_status, c_trial_ends_at, c_bypass
  FROM public.profiles p
  LEFT JOIN public.clinics c ON p.clinic_id = c.id
  WHERE p.id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Only inject tenant claims if user has an assigned clinic AND profile is active
  IF user_clinic_id IS NOT NULL AND user_status = 'active' THEN
     claims := jsonb_set(claims, '{app_metadata, clinic_id}', to_jsonb(user_clinic_id));
     claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
     
     is_active := (
        COALESCE(c_bypass, false) = true
        OR c_subscription_status = 'active'
        OR (
             (c_subscription_status IS NULL OR c_subscription_status = 'trial') 
             AND 
             (c_trial_ends_at IS NULL OR c_trial_ends_at > NOW())
           )
     );
     
     claims := jsonb_set(claims, '{app_metadata, subscription_status}', to_jsonb(COALESCE(c_subscription_status, 'trial')));
     claims := jsonb_set(claims, '{app_metadata, subscription_active}', to_jsonb(is_active));
  ELSE
     -- Explicitly clear obsolete claims if user is offboarded or suspended
     claims := jsonb_set(claims, '{app_metadata, clinic_id}', 'null'::jsonb);
     claims := jsonb_set(claims, '{app_metadata, role}', 'null'::jsonb);
     claims := jsonb_set(claims, '{app_metadata, subscription_status}', 'null'::jsonb);
     claims := jsonb_set(claims, '{app_metadata, subscription_active}', 'false'::jsonb);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  return event;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  -- A. Administrative bypass (service_role via PostgREST or internal postgres session)
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR auth.role() = 'service_role'
    OR (session_user = 'postgres' AND current_setting('request.jwt.claim.role', true) IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  -- B. Prevent mutation of tenant partition key
  IF (NEW.clinic_id IS DISTINCT FROM OLD.clinic_id) THEN
    RAISE EXCEPTION 'Unauthorized patient mutation: clinic_id cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  -- C. Resolve caller role from active clinic membership or ownership
  SELECT cm.role INTO v_caller_role
  FROM public.clinic_members cm
  WHERE cm.user_id = auth.uid()
    AND cm.clinic_id = OLD.clinic_id
    AND cm.status = 'active';

  IF v_caller_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.clinics WHERE id = OLD.clinic_id AND owner_id = auth.uid()) THEN
      v_caller_role := 'clinic_owner';
    END IF;
  END IF;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Caller is not an active member of this clinic.'
      USING ERRCODE = '42501';
  END IF;

  -- D. If caller is clinical staff (doctor or clinic_owner), permit all mutations
  IF v_caller_role IN ('doctor', 'clinic_owner') THEN
    RETURN NEW;
  END IF;

  -- E. If caller is non-clinical (e.g. receptionist):
  -- Block alterations to clinical diagnoses, dental charting, and medical history
  IF (
    NEW.odontogram_state IS DISTINCT FROM OLD.odontogram_state
    OR NEW.periodontogram_state IS DISTINCT FROM OLD.periodontogram_state
    OR NEW.medical_history IS DISTINCT FROM OLD.medical_history
    OR NEW.clinical_notes IS DISTINCT FROM OLD.clinical_notes
    OR NEW.allergies IS DISTINCT FROM OLD.allergies
    OR NEW.medications IS DISTINCT FROM OLD.medications
    OR NEW.medical_conditions IS DISTINCT FROM OLD.medical_conditions
    OR NEW.blood_type IS DISTINCT FROM OLD.blood_type
    OR NEW.has_diabetes IS DISTINCT FROM OLD.has_diabetes
    OR NEW.has_hypertension IS DISTINCT FROM OLD.has_hypertension
    OR NEW.has_heart_disease IS DISTINCT FROM OLD.has_heart_disease
    OR NEW.is_smoker IS DISTINCT FROM OLD.is_smoker
    OR NEW.is_pregnant IS DISTINCT FROM OLD.is_pregnant
  ) THEN
    RAISE EXCEPTION 'Unauthorized clinical mutation: Non-clinical staff (%) cannot modify clinical diagnoses, dental charting, or medical history.', v_caller_role
      USING ERRCODE = '42501';
  END IF;

  -- Allow administrative and demographic modifications
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_checkout_payment_methods(p_billing_id uuid)
 RETURNS TABLE(id uuid, clinic_id uuid, type text, title text, config jsonb, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id UUID;
BEGIN
  SELECT b.clinic_id INTO v_clinic_id
  FROM public.billings b
  WHERE b.id = p_billing_id;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pm.id, pm.clinic_id, pm.type, pm.title, pm.config, pm.is_active
  FROM public.payment_methods pm
  WHERE pm.clinic_id = v_clinic_id
    AND pm.is_active = true;
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

  -- If user has an explicit non-active membership, deny immediately
  IF EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = check_clinic_id
      AND user_id = auth.uid()
      AND status <> 'active'
  ) THEN
    RETURN NULL;
  END IF;

  -- 1. Check live active membership in clinic_members
  SELECT cm.role INTO v_role
  FROM public.clinic_members cm
  WHERE cm.clinic_id = check_clinic_id
    AND cm.user_id = auth.uid()
    AND cm.status = 'active';

  -- 2. Fallback: Check direct clinic ownership
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
CREATE OR REPLACE FUNCTION public.get_family_unit_with_stats(p_patient_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text, avatar_url text, family_relationship text, is_family_head boolean, family_representative_id uuid, appointments_count bigint, total_billed numeric, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_patient_clinic_id uuid;
  v_rep_id uuid;
BEGIN
  -- 1. Authentication enforcement
  IF auth.uid() IS NULL AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_patient_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Resolve target patient's clinic and family representative
  SELECT clinic_id, COALESCE(family_representative_id, id)
  INTO v_patient_clinic_id, v_rep_id
  FROM public.patients
  WHERE id = p_patient_id AND deleted_at IS NULL;

  IF v_patient_clinic_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Authorization: Caller must be an active member of the patient's clinic
  IF NOT public.is_clinic_member(v_patient_clinic_id)
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Access denied: Caller does not belong to the requested patient clinic.'
      USING ERRCODE = '42501';
  END IF;

  -- 4. Return family members strictly scoped to the same clinic and not deleted
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.avatar_url, 
    p.family_relationship,
    p.is_family_head,
    p.family_representative_id,
    (
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.patient_id = p.id
        AND a.deleted_at IS NULL
        AND a.status = 'completed'
    )::bigint AS appointments_count,
    (
      SELECT COALESCE(SUM(b.amount), 0)
      FROM public.billings b
      WHERE b.patient_id = p.id
        AND b.deleted_at IS NULL
        AND b.status = 'paid'
    )::numeric AS total_billed,
    p.status
  FROM public.patients p
  WHERE p.clinic_id = v_patient_clinic_id
    AND p.deleted_at IS NULL
    AND (
      p.id = v_rep_id 
      OR p.family_representative_id = v_rep_id
      OR p.family_representative_id IN (
        SELECT sub.id FROM public.patients sub
        WHERE sub.clinic_id = v_patient_clinic_id
          AND sub.deleted_at IS NULL
          AND sub.family_representative_id = v_rep_id
      )
    )
  ORDER BY p.is_family_head DESC, p.first_name ASC;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_patient_profile_secure(p_patient_id uuid)
 RETURNS SETOF patients
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_clinic_id uuid;
BEGIN
  -- 1. Get User's Clinic from JWT (Trusted)
  v_user_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

  -- 2. Audit This Access
  PERFORM logs.log_patient_view(p_patient_id);

  -- 3. Return the Record (Strictly Scoped to Clinic)
  RETURN QUERY
  SELECT * 
  FROM public.patients
  WHERE id = p_patient_id
  AND clinic_id = v_user_clinic_id
  AND deleted_at IS NULL;

END;
$function$;
CREATE OR REPLACE FUNCTION public.get_patients_with_stats(p_clinic_id uuid, p_search text DEFAULT ''::text, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0, p_time_filter text DEFAULT 'all'::text, p_badge_filter text DEFAULT 'all'::text, p_group_by_family boolean DEFAULT false, p_patient_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, clinic_id uuid, first_name text, last_name text, cedula text, email text, phone text, address text, city text, state text, birth_date date, gender text, patient_status text, status text, occupation text, guardian_name text, referral_source text, referred_by text, clinical_notes text, medical_record_number text, tags text[], emergency_contact text, emergency_phone text, allergies text, medications text, medical_conditions text, medical_history jsonb, insurance_provider text, policy_number text, blood_type text, marital_status text, has_diabetes boolean, has_hypertension boolean, has_heart_disease boolean, is_smoker boolean, is_pregnant boolean, preferred_contact_method text, recall_months integer, internal_notes text, account_balance numeric, avatar_url text, family_representative_id uuid, family_relationship text, is_family_head boolean, family_member_count bigint, appointments_count bigint, total_billed numeric, last_visit timestamp with time zone, next_appointment timestamp with time zone, last_treatment_note text, odontogram_state jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_search_pattern text;
  v_caller_role text;
  v_is_service_role boolean := false;
  v_effective_limit integer;
  v_effective_offset integer;
BEGIN
  -- -------------------------------------------------------------
  -- Step A: Determine if caller is trusted service_role or DB admin
  -- -------------------------------------------------------------
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR auth.role() = 'service_role'
    OR (session_user = 'postgres' AND current_setting('request.jwt.claim.role', true) IS NULL)
  ) THEN
    v_is_service_role := true;
  END IF;

  -- -------------------------------------------------------------
  -- Step B: Authentication & Tenant Membership Authorization
  -- -------------------------------------------------------------
  IF NOT v_is_service_role THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_clinic_id IS NULL THEN
      RAISE EXCEPTION 'Clinic ID is required.' USING ERRCODE = '22023';
    END IF;

    -- Strict caller tenant membership check on public.clinic_members
    SELECT cm.role INTO v_caller_role
    FROM public.clinic_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.clinic_id = p_clinic_id
      AND cm.status = 'active';

    -- Fallback: verify direct ownership in public.clinics
    IF v_caller_role IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id AND owner_id = auth.uid()) THEN
        v_caller_role := 'clinic_owner';
      END IF;
    END IF;

    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Access denied: Caller does not belong to the requested clinic.'
        USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('clinic_owner', 'admin', 'doctor', 'receptionist') THEN
      RAISE EXCEPTION 'Access denied: Caller role % is not authorized to access clinical statistics.', v_caller_role
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.check_subscription_active(p_clinic_id) THEN
      RAISE EXCEPTION 'Subscription inactive or expired for this clinic.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- -------------------------------------------------------------
  -- Step C: Bounded Pagination Limits & Search Pattern
  -- -------------------------------------------------------------
  v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 100);
  v_effective_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- -------------------------------------------------------------
  -- Step D: Calculate Total Record Count for Filtered Set
  -- (PR-04 FIX: Excludes sorting and pagination clauses in scalar count query)
  -- -------------------------------------------------------------
  SELECT COUNT(*) INTO v_total
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
    AND (p_patient_id IS NULL OR pat.id = p_patient_id)
    AND (
      p_search IS NULL OR p_search = '' OR
      LOWER(pat.first_name) LIKE v_search_pattern OR
      LOWER(pat.last_name) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.email, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.phone, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.cedula, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.medical_record_number, '')) LIKE v_search_pattern
    )
    AND (
      p_time_filter = 'all'
      OR (p_time_filter = 'recent' AND pat.created_at >= NOW() - INTERVAL '7 days')
      OR (p_time_filter = 'week' AND pat.created_at >= date_trunc('week', NOW()))
      OR (p_time_filter = 'this_month' AND pat.created_at >= date_trunc('month', NOW()))
      OR (p_time_filter = 'last_month' AND pat.created_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND pat.created_at < date_trunc('month', NOW()))
    )
    AND (
      p_badge_filter = 'all'
      OR (p_badge_filter = 'vip' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) >= COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10))
      OR (p_badge_filter = 'regular' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) BETWEEN 2 AND COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10) - 1)
      OR (p_badge_filter = 'new' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) <= 1)
    );

  -- -------------------------------------------------------------
  -- Step E: Return Patient Rows with Aggregates
  -- -------------------------------------------------------------
  RETURN QUERY
  SELECT
    pat.id,
    pat.clinic_id,
    pat.first_name,
    pat.last_name,
    pat.cedula,
    pat.email,
    pat.phone,
    pat.address,
    pat.city,
    pat.state,
    pat.birth_date,
    pat.gender,
    COALESCE(pat.status, 'active') AS patient_status,
    COALESCE(pat.status, 'active') AS status,
    pat.occupation,
    pat.guardian_name,
    pat.referral_source,
    pat.referred_by,
    pat.clinical_notes,
    pat.medical_record_number,
    pat.tags,
    pat.emergency_contact,
    pat.emergency_phone,
    pat.allergies,
    pat.medications,
    pat.medical_conditions,
    pat.medical_history,
    pat.insurance_provider,
    pat.policy_number,
    pat.blood_type,
    pat.marital_status,
    pat.has_diabetes,
    pat.has_hypertension,
    pat.has_heart_disease,
    pat.is_smoker,
    pat.is_pregnant,
    pat.preferred_contact_method,
    pat.recall_months,
    pat.internal_notes,
    pat.account_balance,
    pat.avatar_url,
    pat.family_representative_id,
    pat.family_relationship,
    pat.is_family_head,
    (
      COALESCE((
        SELECT COUNT(*) FROM public.patients fam 
        WHERE fam.family_representative_id = pat.id 
          AND fam.clinic_id = p_clinic_id
          AND fam.deleted_at IS NULL
      ), 0) + CASE WHEN pat.is_family_head THEN 1 ELSE 0 END
    )::bigint AS family_member_count,
    COALESCE((
      SELECT COUNT(*) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id
        AND apt.deleted_at IS NULL
    ), 0)::bigint AS appointments_count,
    COALESCE((
      SELECT SUM(b.amount) FROM public.billings b 
      WHERE b.patient_id = pat.id
        AND b.deleted_at IS NULL
    ), 0)::numeric AS total_billed,
    (
      SELECT MAX(apt.start_time) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id 
        AND apt.status = 'completed'
        AND apt.deleted_at IS NULL
    )::timestamptz AS last_visit,
    (
      SELECT MIN(apt.start_time) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id 
        AND apt.start_time > NOW()
        AND apt.status IN ('scheduled', 'confirmed')
        AND apt.deleted_at IS NULL
    )::timestamptz AS next_appointment,
    COALESCE(
      (
        SELECT pn.content FROM public.patient_notes pn
        WHERE pn.patient_id = pat.id
          AND pn.deleted_at IS NULL
        ORDER BY pn.created_at DESC
        LIMIT 1
      ),
      (
        SELECT apt.notes FROM public.appointments apt
        WHERE apt.patient_id = pat.id
          AND apt.status = 'completed'
          AND apt.deleted_at IS NULL
        ORDER BY apt.start_time DESC
        LIMIT 1
      )
    )::text AS last_treatment_note,
    pat.odontogram_state,
    pat.created_at,
    pat.updated_at,
    v_total AS total_count
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
    AND (p_patient_id IS NULL OR pat.id = p_patient_id)
    AND (
      p_search IS NULL OR p_search = '' OR
      LOWER(pat.first_name) LIKE v_search_pattern OR
      LOWER(pat.last_name) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.email, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.phone, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.cedula, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.medical_record_number, '')) LIKE v_search_pattern
    )
    AND (
      p_time_filter = 'all'
      OR (p_time_filter = 'recent' AND pat.created_at >= NOW() - INTERVAL '7 days')
      OR (p_time_filter = 'week' AND pat.created_at >= date_trunc('week', NOW()))
      OR (p_time_filter = 'this_month' AND pat.created_at >= date_trunc('month', NOW()))
      OR (p_time_filter = 'last_month' AND pat.created_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND pat.created_at < date_trunc('month', NOW()))
    )
    AND (
      p_badge_filter = 'all'
      OR (p_badge_filter = 'vip' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) >= COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10))
      OR (p_badge_filter = 'regular' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) BETWEEN 2 AND COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10) - 1)
      OR (p_badge_filter = 'new' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id AND a.deleted_at IS NULL
      ) <= 1)
    )
  ORDER BY
    CASE WHEN p_group_by_family THEN pat.family_representative_id END NULLS LAST,
    pat.created_at DESC
  LIMIT v_effective_limit
  OFFSET v_effective_offset;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT clinic_id FROM profiles WHERE id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.guard_patient_clinical_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR auth.role() = 'service_role'
    OR (session_user = 'postgres' AND current_setting('request.jwt.claim.role', true) IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT cm.role INTO v_caller_role
  FROM public.clinic_members cm
  WHERE cm.user_id = auth.uid()
    AND cm.clinic_id = NEW.clinic_id
    AND cm.status = 'active';

  IF v_caller_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.clinics WHERE id = NEW.clinic_id AND owner_id = auth.uid()) THEN
      v_caller_role := 'clinic_owner';
    END IF;
  END IF;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Caller is not an active member of this clinic.'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller_role IN ('doctor', 'clinic_owner') THEN
    RETURN NEW;
  END IF;

  -- Non-clinical staff cannot inject non-empty clinical chart data
  IF (
    (NEW.odontogram_state IS NOT NULL AND NEW.odontogram_state::text NOT IN ('{}', 'null', '""'))
    OR (NEW.medical_history IS NOT NULL AND NEW.medical_history::text NOT IN ('{}', '[]', 'null', '""'))
    OR (NEW.clinical_notes IS NOT NULL AND NEW.clinical_notes != '')
    OR (NEW.allergies IS NOT NULL AND NEW.allergies::text NOT IN ('{}', '[]', 'null', '""'))
    OR (NEW.medications IS NOT NULL AND NEW.medications::text NOT IN ('{}', '[]', 'null', '""'))
    OR (NEW.medical_conditions IS NOT NULL AND NEW.medical_conditions::text NOT IN ('{}', '[]', 'null', '""'))
    OR NEW.blood_type IS NOT NULL
    OR COALESCE(NEW.has_diabetes, false) != false
    OR COALESCE(NEW.has_hypertension, false) != false
    OR COALESCE(NEW.has_heart_disease, false) != false
    OR COALESCE(NEW.is_smoker, false) != false
    OR COALESCE(NEW.is_pregnant, false) != false
  ) THEN
    RAISE EXCEPTION 'Unauthorized clinical mutation: Non-clinical staff cannot initialize clinical diagnoses or charting on patient intake.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'doctor'::public.app_role,
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pending_data JSONB;
  new_clinic_id UUID;
  inserted_clinic_id UUID;
  v_invitation public.clinic_invitations%ROWTYPE;
BEGIN
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    pending_data := NEW.raw_user_meta_data->'pending_clinic';
    
    IF pending_data IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id AND clinic_id IS NOT NULL) THEN
         NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';
         RETURN NEW;
      END IF;

      new_clinic_id := gen_random_uuid();

      -- Set authorized internal context
      PERFORM set_config('app.authorized_internal_action', 'true', true);

      INSERT INTO public.profiles (id, full_name, role, status)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'clinic_owner'::public.app_role,
        'active'::public.user_status
      )
      ON CONFLICT (id) DO UPDATE SET
        role = 'clinic_owner'::public.app_role,
        status = 'active'::public.user_status;

      INSERT INTO public.clinics (
        id, 
        name, 
        address, 
        phone, 
        subscription_tier, 
        owner_id
      )
      VALUES (
        new_clinic_id,
        COALESCE(NULLIF(trim(pending_data->>'name'), ''), 'Mi Clínica Dental'),
        COALESCE(NULLIF(trim(pending_data->>'address'), ''), 'Ubicación por definir'),
        NULLIF(trim(pending_data->>'phone'), ''),
        COALESCE(NULLIF(trim(pending_data->>'subscription_tier'), ''), 'trial'),
        NEW.id
      )
      RETURNING id INTO inserted_clinic_id;

      IF inserted_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Clinic creation failed: clinic insertion returned no identifier for user %', NEW.id
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.profiles
      SET 
        clinic_id = inserted_clinic_id,
        role = 'clinic_owner'::public.app_role,
        status = 'active'::public.user_status,
        updated_at = now()
      WHERE id = NEW.id;
        
      INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
      VALUES (NEW.id, inserted_clinic_id, 'clinic_owner', 'active')
      ON CONFLICT (user_id, clinic_id) DO UPDATE
        SET role = 'clinic_owner', status = 'active';

      NEW.raw_app_meta_data := jsonb_set(
        COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
        '{clinic_id}',
        to_jsonb(inserted_clinic_id)
      );
      NEW.raw_app_meta_data := jsonb_set(
        NEW.raw_app_meta_data,
        '{role}',
        '"clinic_owner"'
      );

      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';

    ELSIF NEW.email IS NOT NULL THEN
      SELECT * INTO v_invitation
      FROM public.clinic_invitations
      WHERE LOWER(email) = LOWER(NEW.email)
        AND status = 'pending'
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_invitation.id IS NOT NULL THEN
        PERFORM set_config('app.authorized_internal_action', 'true', true);

        INSERT INTO public.profiles (id, full_name, role, status)
        VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          v_invitation.role::public.app_role,
          'active'::public.user_status
        )
        ON CONFLICT (id) DO UPDATE SET
          role = v_invitation.role::public.app_role,
          status = 'active'::public.user_status;

        UPDATE public.profiles
        SET 
          clinic_id = v_invitation.clinic_id,
          role = v_invitation.role::public.app_role,
          status = 'active'::public.user_status,
          updated_at = now()
        WHERE id = NEW.id;

        INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
        VALUES (NEW.id, v_invitation.clinic_id, v_invitation.role, 'active')
        ON CONFLICT (user_id, clinic_id) DO UPDATE
          SET role = EXCLUDED.role, status = 'active';

        NEW.raw_app_meta_data := jsonb_set(
          COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
          '{clinic_id}',
          to_jsonb(v_invitation.clinic_id)
        );
        NEW.raw_app_meta_data := jsonb_set(
          NEW.raw_app_meta_data,
          '{role}',
          to_jsonb(v_invitation.role)
        );

        UPDATE public.clinic_invitations
        SET status = 'accepted'
        WHERE id = v_invitation.id;
      END IF;
    END IF;
  END IF;
  
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

  -- If user has an explicit non-active membership, deny access immediately
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
CREATE OR REPLACE FUNCTION public.log_data_rights_request(p_request_type text, p_details jsonb DEFAULT '{}'::jsonb, p_legal_basis text DEFAULT 'LOPDP Art. 17'::text, p_retention_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id UUID;
  v_caller_email TEXT;
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;
  IF v_clinic_id IS NULL THEN
    SELECT clinic_id INTO v_clinic_id
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinic context not found for caller.' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.data_rights_requests (
    clinic_id,
    user_id,
    request_type,
    status,
    details,
    legal_basis,
    retention_note,
    requested_by_email
  )
  VALUES (
    v_clinic_id,
    auth.uid(),
    p_request_type,
    'pending',
    COALESCE(p_details, '{}'::jsonb),
    p_legal_basis,
    p_retention_note,
    v_caller_email
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'clinic_id', v_clinic_id,
    'request_type', p_request_type,
    'legal_basis', p_legal_basis
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_role text;
  v_changed text[] := array[]::text[];
begin
  -- detect changed columns
  if new.full_name      is distinct from old.full_name      then v_changed := array_append(v_changed,'full_name'); end if;
  if new.role           is distinct from old.role           then v_changed := array_append(v_changed,'role'); end if;
  if new.avatar_url     is distinct from old.avatar_url     then v_changed := array_append(v_changed,'avatar_url'); end if;
  if new.email          is distinct from old.email          then v_changed := array_append(v_changed,'email'); end if;
  if new.phone          is distinct from old.phone          then v_changed := array_append(v_changed,'phone'); end if;
  if new.address        is distinct from old.address        then v_changed := array_append(v_changed,'address'); end if;
  if new.specialization is distinct from old.specialization then v_changed := array_append(v_changed,'specialization'); end if;
  if new.license_number is distinct from old.license_number then v_changed := array_append(v_changed,'license_number'); end if;
  if new.bio            is distinct from old.bio            then v_changed := array_append(v_changed,'bio'); end if;

  -- actor role at time of edit (might be null if system)
  select role into v_actor_role
  from public.profiles
  where id = auth.uid();

  insert into public.profile_audit_log(
    target_user_id,
    actor_user_id,
    actor_role,
    action,
    old_data,
    new_data,
    changed_fields
  )
  values (
    new.id,
    auth.uid(),
    v_actor_role,
    coalesce(current_setting('request.audit_action', true), 'update_profile'),
    to_jsonb(old),
    to_jsonb(new),
    v_changed
  );

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Allow trusted service_role via PostgREST
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR auth.role() = 'service_role'
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Allow internal DB administrative executions (migrations / psql where no auth JWT exists)
  IF (session_user = 'postgres' AND current_setting('request.jwt.claim.role', true) IS NULL) THEN
    RETURN NEW;
  END IF;

  -- 3. Allow authorized internal procedure context (e.g. remove_clinic_member, accept_clinic_invitation)
  IF (current_setting('app.authorized_internal_action', true) = 'true') THEN
    RETURN NEW;
  END IF;

  -- Invariant: Non-service-role callers cannot mutate role
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'Unauthorized profile mutation: role cannot be modified by non-service-role callers.'
      USING ERRCODE = '42501';
  END IF;

  -- Invariant: Non-service-role callers cannot mutate clinic_id
  IF (NEW.clinic_id IS DISTINCT FROM OLD.clinic_id) THEN
    RAISE EXCEPTION 'Unauthorized profile mutation: clinic_id cannot be modified by non-service-role callers.'
      USING ERRCODE = '42501';
  END IF;

  -- Invariant: Non-service-role callers cannot mutate status
  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Unauthorized profile mutation: status cannot be modified by non-service-role callers.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR auth.role() = 'service_role'
    OR (session_user = 'postgres' AND current_setting('request.jwt.claim.role', true) IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  -- Ensure original requester, details, timestamps and request type cannot be altered
  IF (NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Immutable field: id cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.clinic_id IS DISTINCT FROM OLD.clinic_id) THEN
    RAISE EXCEPTION 'Immutable field: clinic_id cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Immutable field: user_id cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.patient_id IS DISTINCT FROM OLD.patient_id) THEN
    RAISE EXCEPTION 'Immutable field: patient_id cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.request_type IS DISTINCT FROM OLD.request_type) THEN
    RAISE EXCEPTION 'Immutable field: request_type cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.details IS DISTINCT FROM OLD.details) THEN
    RAISE EXCEPTION 'Immutable field: details cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Immutable field: created_at cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.requested_by_email IS DISTINCT FROM OLD.requested_by_email) THEN
    RAISE EXCEPTION 'Immutable field: requested_by_email cannot be modified.' USING ERRCODE = '42501';
  END IF;

  -- Terminal state protection: once resolved, requests cannot be altered or reopened
  IF (OLD.status IN ('completed', 'rejected')) THEN
    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'Terminal state violation: Cannot modify status of a resolved data rights request.' USING ERRCODE = '42501';
    END IF;
    IF (NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes) THEN
      RAISE EXCEPTION 'Terminal state violation: Cannot modify resolution notes of a resolved data rights request.' USING ERRCODE = '42501';
    END IF;
    IF (NEW.resolved_by IS DISTINCT FROM OLD.resolved_by) THEN
      RAISE EXCEPTION 'Terminal state violation: Cannot modify resolved_by of a resolved data rights request.' USING ERRCODE = '42501';
    END IF;
    IF (NEW.resolved_at IS DISTINCT FROM OLD.resolved_at) THEN
      RAISE EXCEPTION 'Terminal state violation: Cannot modify resolved_at of a resolved data rights request.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- When status transitions to completed or rejected for the first time, record resolver
  IF (NEW.status IN ('completed', 'rejected') AND OLD.status NOT IN ('completed', 'rejected')) THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
  END IF;

  -- Record append-only transition history in logs.access_audit (Workflow Gap 3)
  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'logs' AND tablename = 'access_audit') THEN
      INSERT INTO logs.access_audit (
        actor_id,
        actor_role,
        action,
        table_name,
        record_id,
        clinic_id,
        metadata
      ) VALUES (
        auth.uid(),
        COALESCE(public.get_clinic_member_role(NEW.clinic_id), 'unknown'),
        'UPDATE_STATUS',
        'data_rights_requests',
        NEW.id,
        NEW.clinic_id,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'request_type', NEW.request_type,
          'patient_id', NEW.patient_id,
          'resolved_at', NEW.resolved_at
        )
      );
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_archived_at TIMESTAMP WITH TIME ZONE;
  v_status TEXT;
BEGIN
  -- Strict Check: Must be archived and older than retention period (double safety)
  SELECT subscription_status, archived_at
  INTO v_status, v_archived_at
  FROM public.clinics
  WHERE id = target_clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clinic not found';
  END IF;

  IF v_status IS DISTINCT FROM 'archived' OR v_archived_at IS NULL THEN
    RAISE EXCEPTION 'Cannot purge unarchived clinic';
  END IF;

  IF v_archived_at > (NOW() - INTERVAL '90 days') THEN
    RAISE EXCEPTION 'Statutory 90-day retention lock active. Purge rejected.';
  END IF;

  DELETE FROM public.clinics 
  WHERE id = target_clinic_id 
  AND subscription_status = 'archived'
  AND archived_at < NOW() - INTERVAL '90 days';
END;
$function$;
CREATE OR REPLACE FUNCTION public.remove_clinic_member(p_target_user_id uuid, p_clinic_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_owner boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller is clinic owner of p_clinic_id
  SELECT EXISTS (
    SELECT 1 FROM public.clinics WHERE id = p_clinic_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM public.clinic_members WHERE clinic_id = p_clinic_id AND user_id = auth.uid() AND role = 'clinic_owner' AND status = 'active'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Access denied: Only clinic owners can remove team members.' USING ERRCODE = '42501';
  END IF;

  -- Prevent owner from removing themselves
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove clinic owner from clinic.' USING ERRCODE = '42501';
  END IF;

  -- Set transaction-scoped authorized context for nested profile update
  PERFORM set_config('app.authorized_internal_action', 'true', true);

  -- Clear clinic assignment on profile
  UPDATE public.profiles
  SET clinic_id = NULL
  WHERE id = p_target_user_id AND clinic_id = p_clinic_id;

  -- Remove membership record
  DELETE FROM public.clinic_members
  WHERE user_id = p_target_user_id AND clinic_id = p_clinic_id;

  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.seed_default_services(target_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.services (clinic_id, name, price, duration_minutes, category, description)
  VALUES
  (target_clinic_id, 'Consulta General / Diagnóstico', 20.00, 30, 'General', 'Revisión general, incluye diagnóstico inicial.'),
  (target_clinic_id, 'Limpieza Dental (Profilaxis)', 30.00, 45, 'Preventiva', 'Eliminación de placa y pulido.'),
  (target_clinic_id, 'Resina Simple (1 superficie)', 30.00, 45, 'Restauradora', 'Restauración de caries pequeña o mediana.'),
  (target_clinic_id, 'Resina Compuesta/Compleja', 50.00, 60, 'Restauradora', 'Reconstrucción de partes mayores del diente.'),
  (target_clinic_id, 'Extracción Simple', 40.00, 45, 'Cirugía', 'Extracción no quirúrgica.'),
  (target_clinic_id, 'Cirugía de Tercer Molar (Cordal)', 100.00, 90, 'Cirugía', 'Cirugía de muela del juicio impactada.'),
  (target_clinic_id, 'Endodoncia (Tratamiento de Canal)', 150.00, 90, 'Endodoncia', 'Tratamiento de conductos (precio promedio).'),
  (target_clinic_id, 'Blanqueamiento Dental', 200.00, 60, 'Cosmética', 'Tratamiento LED/Láser en consultorio.'),
  (target_clinic_id, 'Corona de Porcelana/Zirconio', 300.00, 90, 'Restauradora', 'Alta durabilidad y estética.'),
  (target_clinic_id, 'Implante Dental (Fase Quirúrgica)', 700.00, 90, 'Cirugía', 'Colocación del implante (no incluye corona).'),
  (target_clinic_id, 'Ortodoncia (Control Mensual)', 30.00, 20, 'Ortodoncia', 'Ajuste y control mensual de brackets.')
  ON CONFLICT DO NOTHING;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-populate clinic_id from patient if omitted
  IF NEW.clinic_id IS NULL THEN
    SELECT p.clinic_id INTO NEW.clinic_id
    FROM public.patients p
    WHERE p.id = NEW.patient_id;
  END IF;

  -- Auto-populate doctor_id from caller auth.uid() if omitted
  IF NEW.doctor_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.doctor_id := auth.uid();
  END IF;

  -- Ensure patient belongs to the specified clinic (cross-tenant mismatch prevention)
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'Cross-tenant violation: Patient does not belong to the specified clinic.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_billing_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_paid DECIMAL(10,2);
    bill_amount DECIMAL(10,2);
BEGIN
    SELECT amount INTO bill_amount FROM billings WHERE id = NEW.billing_id;
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE billing_id = NEW.billing_id AND status = 'completed';
    
    IF total_paid >= bill_amount THEN
        UPDATE billings SET status = 'paid' WHERE id = NEW.billing_id;
    ELSIF total_paid > 0 THEN
        UPDATE billings SET status = 'pending' WHERE id = NEW.billing_id; -- Or 'partial'
    END IF;
    
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_patient_odontogram_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE patients
    SET 
        last_treatment_note = NEW.form_data->>'odontograma_descripcion',
        odontogram_state = NEW.form_data->'odontograma_data'
    WHERE id = NEW.patient_id;
    RETURN NEW;
END;
$function$;
CREATE VIEW "public"."dashboard_stats_view" ("clinic_id", "month", "total_billings", "total_revenue", "unique_patients_billed") WITH (security_invoker=true) AS
 SELECT clinic_id,
    date_trunc('month'::text, created_at) AS month,
    count(id) AS total_billings,
    sum(amount) AS total_revenue,
    count(DISTINCT patient_id) AS unique_patients_billed
   FROM billings
  WHERE clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text)::uuid)
  GROUP BY clinic_id, (date_trunc('month'::text, created_at));
CREATE VIEW "public"."patient_stats_view" ("patient_id", "clinic_id", "appointment_count", "total_billed") WITH (security_invoker=true) AS
 SELECT p.id AS patient_id,
    p.clinic_id,
    count(DISTINCT a.id) AS appointment_count,
    COALESCE(sum(b.amount), 0::numeric) AS total_billed
   FROM patients p
     LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = 'completed'::text
     LEFT JOIN billings b ON b.patient_id = p.id AND b.status = 'paid'::text
  GROUP BY p.id, p.clinic_id;
CREATE VIEW "public"."recall_queue" ("id", "clinic_id", "first_name", "last_name", "phone", "email", "medical_alerts", "created_at") WITH (security_invoker=true) AS
 SELECT id,
    clinic_id,
    first_name,
    last_name,
    phone,
    email,
    COALESCE(medical_alerts, ''::text) AS medical_alerts,
    created_at
   FROM patients
  WHERE deleted_at IS NULL;
CREATE VIEW "public"."receptionist_patient_view" ("patient_id", "clinic_id", "first_name", "last_name", "phone", "email", "last_visit_date") WITH (security_invoker=true) AS
 SELECT p.id AS patient_id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    max(cr.created_at) AS last_visit_date
   FROM patients p
     LEFT JOIN clinical_records cr ON p.id = cr.patient_id
  GROUP BY p.id, p.clinic_id, p.first_name, p.last_name, p.phone, p.email
 HAVING max(cr.created_at) < (now() - '6 mons'::interval) OR max(cr.created_at) IS NULL;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER on_auth_user_verified BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_verified_clinic_creation();
CREATE TRIGGER audit_billings AFTER INSERT OR DELETE OR UPDATE ON billings FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();
CREATE TRIGGER audit_clinical_records AFTER INSERT OR DELETE OR UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();
CREATE TRIGGER trg_protect_data_requests_immutability BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests();
CREATE TRIGGER trg_protect_data_rights_requests BEFORE UPDATE ON data_rights_requests FOR EACH ROW EXECUTE FUNCTION protect_data_rights_requests();
CREATE TRIGGER audit_hcu033_forms AFTER INSERT OR DELETE OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();
CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION update_patient_odontogram_summary();
CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON hcu033_forms FOR EACH ROW EXECUTE FUNCTION sync_hcu033_form_clinic_id();
CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();
CREATE TRIGGER trg_enforce_patient_clinical_privileges BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION enforce_patient_clinical_privileges();
CREATE TRIGGER trg_guard_patient_clinical_insert BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION guard_patient_clinical_insert();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON profiles FOR EACH ROW WHEN (old.* IS DISTINCT FROM new.*) EXECUTE FUNCTION log_profile_changes();
CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();
CREATE POLICY "No one allows delete on audit" ON "logs"."access_audit" AS PERMISSIVE FOR DELETE TO PUBLIC USING (false);
CREATE POLICY "No one allows update on audit" ON "logs"."access_audit" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY "System can insert audit" ON "logs"."access_audit" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "Users can delete appointments in their clinic" ON "public"."appointments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can insert appointments in their clinic" ON "public"."appointments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can update appointments in their clinic" ON "public"."appointments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can view appointments in their clinic" ON "public"."appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can insert their own settings" ON "public"."automation_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own settings" ON "public"."automation_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own settings" ON "public"."automation_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Owners can view billings" ON "public"."billings" AS PERMISSIVE FOR ALL TO PUBLIC USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Users can insert billings in their clinic" ON "public"."billings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((patient_id IN ( SELECT patients.id
   FROM patients
  WHERE (patients.clinic_id = get_user_clinic_id()))));
CREATE POLICY "Users can update billings in their clinic" ON "public"."billings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((patient_id IN ( SELECT patients.id
   FROM patients
  WHERE (patients.clinic_id = get_user_clinic_id()))));
CREATE POLICY "Anyone can view their own invitation by email" ON "public"."clinic_invitations" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((email = auth.email()) OR (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text)));
CREATE POLICY "Clinic owners can manage invitations" ON "public"."clinic_invitations" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM clinic_members
  WHERE ((clinic_members.clinic_id = clinic_invitations.clinic_id) AND (clinic_members.user_id = auth.uid()) AND (clinic_members.role = 'clinic_owner'::text)))));
CREATE POLICY "Users and owners can view clinic memberships" ON "public"."clinic_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = clinic_members.clinic_id) AND (c.owner_id = auth.uid()))))));
CREATE POLICY "Clinic owners can delete clinical records" ON "public"."clinical_records" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = 'clinic_owner'::text) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can insert clinical records" ON "public"."clinical_records" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinical staff can update clinical records" ON "public"."clinical_records" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND check_subscription_active(clinic_id)));
CREATE POLICY "Medical staff can view clinical records" ON "public"."clinical_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Owners can update their own clinic" ON "public"."clinics" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((owner_id = auth.uid()));
CREATE POLICY "Users can view their own clinic" ON "public"."clinics" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((id IN ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (owner_id = auth.uid())));
CREATE POLICY "Authenticated users can submit data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((user_id IS NULL) OR (user_id = auth.uid()))));
CREATE POLICY "Clinic members can view data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid));
CREATE POLICY "Clinic owners can update data rights requests" ON "public"."data_rights_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Clinic members can view hcu033_forms" ON "public"."hcu033_forms" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id
   FROM patients p
  WHERE ((p.clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(p.clinic_id) AND check_subscription_active(p.clinic_id)))))));
CREATE POLICY "Clinic owners can delete hcu033_forms" ON "public"."hcu033_forms" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = 'clinic_owner'::text) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id
   FROM patients p
  WHERE ((p.clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = 'clinic_owner'::text) AND check_subscription_active(p.clinic_id)))))));
CREATE POLICY "Clinical staff can insert hcu033_forms" ON "public"."hcu033_forms" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id
   FROM patients p
  WHERE ((p.clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(p.clinic_id)))))));
CREATE POLICY "Clinical staff can update hcu033_forms" ON "public"."hcu033_forms" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id
   FROM patients p
  WHERE ((p.clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(p.clinic_id))))))) WITH CHECK ((((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(clinic_id)) OR ((clinic_id IS NULL) AND (patient_id IN ( SELECT p.id
   FROM patients p
  WHERE ((p.clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(p.clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND check_subscription_active(p.clinic_id)))))));
CREATE POLICY "Users can insert invoices in their clinic" ON "public"."invoices" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((clinic_id = get_user_clinic_id()));
CREATE POLICY "Users can update invoices in their clinic" ON "public"."invoices" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((clinic_id = get_user_clinic_id()));
CREATE POLICY "Users can view invoices in their clinic" ON "public"."invoices" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((clinic_id = get_user_clinic_id()));
CREATE POLICY "Users can insert messages" ON "public"."messages" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = sender_id));
CREATE POLICY "Users can update their own messages" ON "public"."messages" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = sender_id));
CREATE POLICY "Users can view their own messages" ON "public"."messages" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "System can insert notifications" ON "public"."notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON "public"."notifications" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON "public"."notifications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert files in their clinic" ON "public"."patient_files" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can update files in their clinic" ON "public"."patient_files" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can view files in their clinic" ON "public"."patient_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL)));
CREATE POLICY "Users can insert notes in their clinic" ON "public"."patient_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can update notes in their clinic" ON "public"."patient_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Users can view notes in their clinic" ON "public"."patient_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id) AND (deleted_at IS NULL)));
CREATE POLICY "Active clinic members can insert patients" ON "public"."patients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Active clinic members can update patients" ON "public"."patients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id))) WITH CHECK (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Active clinic members can view patients" ON "public"."patients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Clinic owners can delete patients in their clinic" ON "public"."patients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Allow checkout viewing of active payment methods" ON "public"."payment_methods" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM billings b
  WHERE (b.clinic_id = payment_methods.clinic_id)))));
CREATE POLICY "Clinic members can view payment methods" ON "public"."payment_methods" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) OR (EXISTS ( SELECT 1
   FROM clinic_members cm
  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid()))))));
CREATE POLICY "Clinic owners can delete payment methods" ON "public"."payment_methods" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM clinic_members cm
  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = 'clinic_owner'::text) AND (cm.status = 'active'::text))))));
CREATE POLICY "Clinic owners can insert payment methods" ON "public"."payment_methods" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM clinic_members cm
  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = 'clinic_owner'::text) AND (cm.status = 'active'::text))))));
CREATE POLICY "Clinic owners can update payment methods" ON "public"."payment_methods" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM clinic_members cm
  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = 'clinic_owner'::text) AND (cm.status = 'active'::text)))))) WITH CHECK ((((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = payment_methods.clinic_id) AND (c.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM clinic_members cm
  WHERE ((cm.clinic_id = payment_methods.clinic_id) AND (cm.user_id = auth.uid()) AND (cm.role = 'clinic_owner'::text) AND (cm.status = 'active'::text))))));
CREATE POLICY "Owners can view their payments" ON "public"."payments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Templates are deletable by their creator or clinic owners" ON "public"."prescription_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id)));
CREATE POLICY "Templates are insertable by clinical staff" ON "public"."prescription_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND (doctor_id = auth.uid()) AND check_subscription_active(clinic_id)));
CREATE POLICY "Templates are updatable by their creator or clinic owners" ON "public"."prescription_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id)));
CREATE POLICY "Templates are viewable by clinic members" ON "public"."prescription_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Doctors and owners can insert prescriptions" ON "public"."prescriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = ANY (ARRAY['doctor'::text, 'clinic_owner'::text])) AND (doctor_id = auth.uid()) AND check_subscription_active(clinic_id)));
CREATE POLICY "Doctors and owners can update their prescriptions" ON "public"."prescriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id))) WITH CHECK (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND ((get_clinic_member_role(clinic_id) = 'clinic_owner'::text) OR ((get_clinic_member_role(clinic_id) = 'doctor'::text) AND (doctor_id = auth.uid()))) AND check_subscription_active(clinic_id)));
CREATE POLICY "Prescriptions are deletable by clinic owners" ON "public"."prescriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (get_clinic_member_role(clinic_id) = 'clinic_owner'::text) AND check_subscription_active(clinic_id)));
CREATE POLICY "Prescriptions are viewable by clinic members" ON "public"."prescriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND is_clinic_member(clinic_id) AND check_subscription_active(clinic_id)));
CREATE POLICY "Admins can view audit logs" ON "public"."profile_audit_log" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'clinic_owner'::app_role)))));
CREATE POLICY "Clinic owners can delete members in their clinic" ON "public"."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text) AND (id <> auth.uid())));
CREATE POLICY "Clinic owners can update members in their clinic" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text))) WITH CHECK (((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid)));
CREATE POLICY "Profiles are viewable by same clinic members" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id = auth.uid()) OR ((clinic_id IS NOT NULL) AND (clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid))));
CREATE POLICY "Users can update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can manage their clinic categories" ON "public"."service_categories" AS PERMISSIVE FOR ALL TO PUBLIC USING ((clinic_id IN ( SELECT clinic_members.clinic_id
   FROM clinic_members
  WHERE (clinic_members.user_id = auth.uid()))));
CREATE POLICY "Clinic members can view services" ON "public"."services" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid));
CREATE POLICY "Clinic owners can delete services" ON "public"."services" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Clinic owners can insert services" ON "public"."services" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Clinic owners can update services" ON "public"."services" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text))) WITH CHECK (((clinic_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'clinic_id'::text))::uuid) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'clinic_owner'::text)));
CREATE POLICY "Users can insert treatments in their clinic" ON "public"."treatments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((clinic_id = get_user_clinic_id()));
CREATE POLICY "Users can update treatments in their clinic" ON "public"."treatments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((clinic_id = get_user_clinic_id()));
CREATE POLICY "Users can view treatments in their clinic" ON "public"."treatments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((clinic_id = get_user_clinic_id()));
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('avatars','avatars',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('clinia','clinia',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('clinia-assets','clinia-assets',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('clinic-branding','clinic-branding',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('doctor-avatars','doctor-avatars',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('patient-avatars','patient-avatars',false,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('patient-files','patient-files',false,20971520,ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/dicom']::text[]);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('receipts','receipts',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('Whats-Storage','Whats-Storage',false,NULL,NULL);
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('wstorag','wstorag',false,NULL,NULL);
ALTER TABLE "logs"."access_audit" OWNER TO "postgres";
ALTER TABLE "public"."appointments" OWNER TO "postgres";
ALTER TABLE "public"."automation_settings" OWNER TO "postgres";
ALTER TABLE "public"."billings" OWNER TO "postgres";
ALTER TABLE "public"."clinic_invitations" OWNER TO "postgres";
ALTER TABLE "public"."clinic_members" OWNER TO "postgres";
ALTER TABLE "public"."clinical_records" OWNER TO "postgres";
ALTER TABLE "public"."clinics" OWNER TO "postgres";
ALTER VIEW "public"."dashboard_stats_view" OWNER TO "postgres";
ALTER TABLE "public"."data_rights_requests" OWNER TO "postgres";
ALTER TABLE "public"."hcu033_forms" OWNER TO "postgres";
ALTER TABLE "public"."invoices" OWNER TO "postgres";
ALTER TABLE "public"."messages" OWNER TO "postgres";
ALTER TABLE "public"."notifications" OWNER TO "postgres";
ALTER TABLE "public"."patient_files" OWNER TO "postgres";
ALTER TABLE "public"."patient_notes" OWNER TO "postgres";
ALTER VIEW "public"."patient_stats_view" OWNER TO "postgres";
ALTER TABLE "public"."patients" OWNER TO "postgres";
ALTER TABLE "public"."payment_methods" OWNER TO "postgres";
ALTER TABLE "public"."payments" OWNER TO "postgres";
ALTER TABLE "public"."prescription_templates" OWNER TO "postgres";
ALTER TABLE "public"."prescriptions" OWNER TO "postgres";
ALTER TABLE "public"."profile_audit_log" OWNER TO "postgres";
ALTER TABLE "public"."profiles" OWNER TO "postgres";
ALTER VIEW "public"."recall_queue" OWNER TO "postgres";
ALTER VIEW "public"."receptionist_patient_view" OWNER TO "postgres";
ALTER TABLE "public"."service_categories" OWNER TO "postgres";
ALTER TABLE "public"."services" OWNER TO "postgres";
ALTER TABLE "public"."treatments" OWNER TO "postgres";
ALTER FUNCTION "logs"."log_access_trigger"() OWNER TO "postgres";
ALTER FUNCTION "logs"."log_patient_view"(p_patient_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."accept_clinic_invitation"(p_token text) OWNER TO "postgres";
ALTER FUNCTION "public"."archive_clinic"(target_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."cleanup_soft_deleted_records"() OWNER TO "postgres";
ALTER FUNCTION "public"."create_tenant_clinic"(clinic_name text, clinic_address text, clinic_phone text) OWNER TO "postgres";
ALTER FUNCTION "public"."custom_access_token_hook"(event jsonb) OWNER TO "postgres";
ALTER FUNCTION "public"."enforce_patient_clinical_privileges"() OWNER TO "postgres";
ALTER FUNCTION "public"."get_checkout_payment_methods"(p_billing_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_family_unit_with_stats"(p_patient_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_patient_profile_secure"(p_patient_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_patients_with_stats"(p_clinic_id uuid, p_search text, p_limit integer, p_offset integer, p_time_filter text, p_badge_filter text, p_group_by_family boolean, p_patient_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."get_user_clinic_id"() OWNER TO "postgres";
ALTER FUNCTION "public"."guard_patient_clinical_insert"() OWNER TO "postgres";
ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
ALTER FUNCTION "public"."handle_verified_clinic_creation"() OWNER TO "postgres";
ALTER FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."log_data_rights_request"(p_request_type text, p_details jsonb, p_legal_basis text, p_retention_note text) OWNER TO "postgres";
ALTER FUNCTION "public"."log_profile_changes"() OWNER TO "postgres";
ALTER FUNCTION "public"."prevent_profile_privilege_escalation"() OWNER TO "postgres";
ALTER FUNCTION "public"."protect_data_rights_requests"() OWNER TO "postgres";
ALTER FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."remove_clinic_member"(p_target_user_id uuid, p_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."seed_default_services"(target_clinic_id uuid) OWNER TO "postgres";
ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";
ALTER FUNCTION "public"."sync_hcu033_form_clinic_id"() OWNER TO "postgres";
ALTER FUNCTION "public"."update_billing_status"() OWNER TO "postgres";
ALTER FUNCTION "public"."update_patient_odontogram_summary"() OWNER TO "postgres";
ALTER TYPE "public"."app_role" OWNER TO "postgres";
ALTER TYPE "public"."subscription_status" OWNER TO "postgres";
ALTER TYPE "public"."user_status" OWNER TO "postgres";
ALTER SCHEMA "logs" OWNER TO "postgres";
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
REVOKE ALL ON SCHEMA "logs" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE, CREATE ON SCHEMA "logs" TO "postgres";
REVOKE ALL ON SCHEMA "public" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE, CREATE ON SCHEMA "public" TO "pg_database_owner";
REVOKE ALL ON TYPE "public"."app_role" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."app_role" TO "postgres";
REVOKE ALL ON TYPE "public"."subscription_status" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."subscription_status" TO "postgres";
REVOKE ALL ON TYPE "public"."user_status" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT USAGE ON TYPE "public"."user_status" TO "postgres";
REVOKE ALL ON TABLE "logs"."access_audit" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "logs"."access_audit" TO "postgres";
REVOKE ALL ON SEQUENCE "logs"."access_audit_id_seq" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "logs"."access_audit_id_seq" TO "postgres";
REVOKE ALL ON TABLE "public"."appointments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."appointments" TO "postgres";
REVOKE ALL ON TABLE "public"."automation_settings" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."automation_settings" TO "postgres";
REVOKE ALL ON TABLE "public"."billings" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."billings" TO "postgres";
REVOKE ALL ON TABLE "public"."clinic_invitations" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_invitations" TO "postgres";
REVOKE ALL ON TABLE "public"."clinic_members" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinic_members" TO "postgres";
REVOKE ALL ON TABLE "public"."clinical_records" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinical_records" TO "postgres";
REVOKE ALL ON TABLE "public"."clinics" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."clinics" TO "postgres";
REVOKE ALL ON TABLE "public"."dashboard_stats_view" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."dashboard_stats_view" TO "postgres";
REVOKE ALL ON TABLE "public"."data_rights_requests" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."data_rights_requests" TO "postgres";
REVOKE ALL ON TABLE "public"."hcu033_forms" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."hcu033_forms" TO "postgres";
REVOKE ALL ON TABLE "public"."invoices" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."invoices" TO "postgres";
REVOKE ALL ON TABLE "public"."messages" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."messages" TO "postgres";
REVOKE ALL ON TABLE "public"."notifications" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."notifications" TO "postgres";
REVOKE ALL ON TABLE "public"."patient_files" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_files" TO "postgres";
REVOKE ALL ON TABLE "public"."patient_notes" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_notes" TO "postgres";
REVOKE ALL ON TABLE "public"."patient_stats_view" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patient_stats_view" TO "postgres";
REVOKE ALL ON TABLE "public"."patients" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."patients" TO "postgres";
REVOKE ALL ON TABLE "public"."payment_methods" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payment_methods" TO "postgres";
REVOKE ALL ON TABLE "public"."payments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."payments" TO "postgres";
REVOKE ALL ON TABLE "public"."prescription_templates" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescription_templates" TO "postgres";
REVOKE ALL ON TABLE "public"."prescriptions" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."prescriptions" TO "postgres";
REVOKE ALL ON TABLE "public"."profile_audit_log" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profile_audit_log" TO "postgres";
REVOKE ALL ON SEQUENCE "public"."profile_audit_log_id_seq" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."profile_audit_log_id_seq" TO "postgres";
REVOKE ALL ON TABLE "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."profiles" TO "postgres";
REVOKE ALL ON TABLE "public"."recall_queue" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."recall_queue" TO "postgres";
REVOKE ALL ON TABLE "public"."receptionist_patient_view" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."receptionist_patient_view" TO "postgres";
REVOKE ALL ON TABLE "public"."service_categories" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."service_categories" TO "postgres";
REVOKE ALL ON TABLE "public"."services" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."services" TO "postgres";
REVOKE ALL ON TABLE "public"."treatments" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "public"."treatments" TO "postgres";
REVOKE ALL ON FUNCTION "logs"."log_access_trigger"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "logs"."log_access_trigger"() TO "postgres";
REVOKE ALL ON FUNCTION "logs"."log_patient_view"(p_patient_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "logs"."log_patient_view"(p_patient_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."accept_clinic_invitation"(p_token text) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."accept_clinic_invitation"(p_token text) TO "postgres";
REVOKE ALL ON FUNCTION "public"."archive_clinic"(target_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."archive_clinic"(target_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."check_subscription_active"(check_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."cleanup_soft_deleted_records"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."cleanup_soft_deleted_records"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."create_tenant_clinic"(clinic_name text, clinic_address text, clinic_phone text) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."create_tenant_clinic"(clinic_name text, clinic_address text, clinic_phone text) TO "postgres";
REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"(event jsonb) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."custom_access_token_hook"(event jsonb) TO "postgres";
REVOKE ALL ON FUNCTION "public"."enforce_patient_clinical_privileges"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."enforce_patient_clinical_privileges"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_checkout_payment_methods"(p_billing_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_checkout_payment_methods"(p_billing_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_clinic_member_role"(check_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_family_unit_with_stats"(p_patient_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_family_unit_with_stats"(p_patient_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_patient_profile_secure"(p_patient_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_patient_profile_secure"(p_patient_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_patients_with_stats"(p_clinic_id uuid, p_search text, p_limit integer, p_offset integer, p_time_filter text, p_badge_filter text, p_group_by_family boolean, p_patient_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_patients_with_stats"(p_clinic_id uuid, p_search text, p_limit integer, p_offset integer, p_time_filter text, p_badge_filter text, p_group_by_family boolean, p_patient_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_user_clinic_id"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."get_user_clinic_id"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."guard_patient_clinical_insert"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."guard_patient_clinical_insert"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."handle_verified_clinic_creation"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."handle_verified_clinic_creation"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."is_clinic_member"(check_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."log_data_rights_request"(p_request_type text, p_details jsonb, p_legal_basis text, p_retention_note text) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."log_data_rights_request"(p_request_type text, p_details jsonb, p_legal_basis text, p_retention_note text) TO "postgres";
REVOKE ALL ON FUNCTION "public"."log_profile_changes"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."log_profile_changes"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."protect_data_rights_requests"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."protect_data_rights_requests"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."purge_clinic_data"(target_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."remove_clinic_member"(p_target_user_id uuid, p_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."remove_clinic_member"(p_target_user_id uuid, p_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."seed_default_services"(target_clinic_id uuid) FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."seed_default_services"(target_clinic_id uuid) TO "postgres";
REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_hcu033_form_clinic_id"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."sync_hcu033_form_clinic_id"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."update_billing_status"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."update_billing_status"() TO "postgres";
REVOKE ALL ON FUNCTION "public"."update_patient_odontogram_summary"() FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
GRANT EXECUTE ON FUNCTION "public"."update_patient_odontogram_summary"() TO "postgres";
REVOKE ALL ("full_name") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("avatar_url") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("phone") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("address") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("specialization") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("license_number") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("bio") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
REVOKE ALL ("updated_at") ON "public"."profiles" FROM PUBLIC, "pg_database_owner", "postgres", "anon", "authenticated", "service_role", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin";
COMMIT;
-- Installation proves only scoped fixture creation after actual runtime verification; it does not approve production.
