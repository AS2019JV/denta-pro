--
-- PostgreSQL database dump
--

\restrict LYYFR89cskaKAJGiBxyd6fmb0x4yS0d0968MP1DHQbxgSiDu4HMYGauulsUUxbE

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: logs; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA "logs";


ALTER SCHEMA "logs" OWNER TO "postgres";

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: security_internal; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA "security_internal";


ALTER SCHEMA "security_internal" OWNER TO "postgres";

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."app_role" AS ENUM (
    'clinic_owner',
    'doctor',
    'receptionist'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";

--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'past_due',
    'canceled',
    'trial',
    'archived'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."user_status" AS ENUM (
    'invited',
    'active',
    'suspended'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";

--
-- Name: log_access_trigger(); Type: FUNCTION; Schema: logs; Owner: postgres
--

CREATE FUNCTION "logs"."log_access_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "logs"."log_access_trigger"() OWNER TO "postgres";

--
-- Name: check_subscription_active("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") OWNER TO "postgres";

--
-- Name: get_clinic_member_role("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") OWNER TO "postgres";

--
-- Name: get_user_clinic_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_user_clinic_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid,
    (SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1),
    (SELECT id FROM public.clinics WHERE owner_id = auth.uid() LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."get_user_clinic_id"() OWNER TO "postgres";

--
-- Name: guard_data_rights_request_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."guard_data_rights_request_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."guard_data_rights_request_insert"() OWNER TO "postgres";

--
-- Name: is_clinic_member("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") OWNER TO "postgres";

--
-- Name: protect_data_rights_requests(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."protect_data_rights_requests"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."protect_data_rights_requests"() OWNER TO "postgres";

--
-- Name: purge_clinic_data("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") OWNER TO "postgres";

--
-- Name: audit_data_rights_status(); Type: FUNCTION; Schema: security_internal; Owner: postgres
--

CREATE FUNCTION "security_internal"."audit_data_rights_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "security_internal"."audit_data_rights_status"() OWNER TO "postgres";

--
-- Name: enforce_clinician_assignment(); Type: FUNCTION; Schema: security_internal; Owner: postgres
--

CREATE FUNCTION "security_internal"."enforce_clinician_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "security_internal"."enforce_clinician_assignment"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: access_audit; Type: TABLE; Schema: logs; Owner: postgres
--

CREATE TABLE "logs"."access_audit" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "clinic_id" "uuid",
    "metadata" "jsonb"
);


ALTER TABLE "logs"."access_audit" OWNER TO "postgres";

--
-- Name: access_audit_id_seq; Type: SEQUENCE; Schema: logs; Owner: postgres
--

ALTER TABLE "logs"."access_audit" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "logs"."access_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text",
    "type" "text",
    "notes" "text",
    "clinic_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";

--
-- Name: automation_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."automation_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false,
    "reminder_template" "text" DEFAULT 'Hola {patient_name}, te recordamos tu cita el {date} a las {time} con el Dr. {doctor_name}.'::"text",
    "days_before" integer DEFAULT 1,
    "whatsapp_enabled" boolean DEFAULT false,
    "email_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."automation_settings" OWNER TO "postgres";

--
-- Name: billings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."billings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "description" "text",
    "due_date" "date",
    "invoice_number" "text",
    "appointment_id" "uuid",
    "clinic_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."billings" OWNER TO "postgres";

--
-- Name: clinic_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."clinic_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);


ALTER TABLE "public"."clinic_invitations" OWNER TO "postgres";

--
-- Name: clinic_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."clinic_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'doctor'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."clinic_members" OWNER TO "postgres";

--
-- Name: clinical_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."clinical_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid",
    "diagnosis" "bytea",
    "treatment_plan" "text",
    "xray_urls" "text"[],
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "odontogram_state" "jsonb" DEFAULT '{}'::"jsonb",
    "periodontogram_state" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."clinical_records" OWNER TO "postgres";

--
-- Name: clinics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."clinics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "owner_id" "uuid",
    "logo_url" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "disclaimer_text" "text" DEFAULT 'This estimate is valid for 30 days. Please contact the front desk for questions.'::"text",
    "working_hours" "jsonb" DEFAULT '{"fri": ["09:00", "17:00"], "mon": ["09:00", "17:00"], "sat": null, "sun": null, "thu": ["09:00", "17:00"], "tue": ["09:00", "17:00"], "wed": ["09:00", "17:00"]}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'trial'::"text",
    "trial_ends_at" timestamp with time zone,
    "bypass_subscription" boolean DEFAULT false,
    "subscription_status" "public"."subscription_status" DEFAULT 'trial'::"public"."subscription_status",
    "kushki_subscription_id" "text",
    "next_billing_date" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "size" character varying
);


ALTER TABLE "public"."clinics" OWNER TO "postgres";

--
-- Name: data_rights_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."data_rights_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "patient_id" "uuid",
    "request_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "legal_basis" "text" NOT NULL,
    "retention_note" "text",
    "requested_by_email" "text",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolution_notes" "text"
);


ALTER TABLE "public"."data_rights_requests" OWNER TO "postgres";

--
-- Name: hcu033_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."hcu033_forms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid",
    "form_data" "jsonb" NOT NULL,
    "clinic_id" "uuid" DEFAULT ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."hcu033_forms" OWNER TO "postgres";

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clinic_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "billing_id" "uuid",
    "invoice_number" "text",
    "sri_authorization" "text",
    "sri_access_key" "text",
    "xml_content" "text",
    "pdf_url" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "total_amount" numeric NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "sri_authorization_date" timestamp with time zone,
    "environment" "text" DEFAULT 'TEST'::"text"
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid",
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "clinic_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "is_read" boolean DEFAULT false,
    "link" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";

--
-- Name: patient_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."patient_files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "size" "text" NOT NULL,
    "type" "text" NOT NULL,
    "uploaded_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."patient_files" OWNER TO "postgres";

--
-- Name: patient_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."patient_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."patient_notes" OWNER TO "postgres";

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."patients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "cedula" "text",
    "email" "text",
    "phone" "text",
    "birth_date" "date",
    "gender" "text",
    "address" "text",
    "medical_history" "jsonb" DEFAULT '{}'::"jsonb",
    "clinic_id" "uuid" NOT NULL,
    "emergency_contact" "text",
    "emergency_phone" "text",
    "allergies" "text",
    "medications" "text",
    "medical_conditions" "text",
    "insurance_provider" "text",
    "policy_number" "text",
    "deleted_at" timestamp with time zone,
    "medical_alerts" "text",
    "occupation" "text",
    "guardian_name" "text",
    "referral_source" "text",
    "referred_by" "text",
    "clinical_notes" "text",
    "medical_record_number" "text",
    "tags" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "blood_type" "text",
    "marital_status" "text",
    "city" "text",
    "state" "text",
    "has_diabetes" boolean DEFAULT false,
    "has_hypertension" boolean DEFAULT false,
    "has_heart_disease" boolean DEFAULT false,
    "is_smoker" boolean DEFAULT false,
    "is_pregnant" boolean DEFAULT false,
    "preferred_contact_method" "text" DEFAULT 'phone'::"text",
    "recall_months" integer DEFAULT 6,
    "family_representative_id" "uuid",
    "internal_notes" "text",
    "account_balance" numeric DEFAULT 0,
    "family_relationship" "text",
    "is_family_head" boolean DEFAULT false,
    "last_treatment_note" "text",
    "odontogram_state" "jsonb" DEFAULT '{}'::"jsonb",
    "avatar_url" "text",
    "periodontogram_state" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."patients" OWNER TO "postgres";

--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."payment_methods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doctor_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text",
    "config" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clinic_id" "uuid" DEFAULT ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid" NOT NULL
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "status" "text" NOT NULL,
    "provider" "text" DEFAULT 'kushki'::"text",
    "provider_transaction_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";

--
-- Name: prescription_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."prescription_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clinic_id" "uuid" DEFAULT ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid" NOT NULL,
    "doctor_id" "uuid",
    "name" "text" NOT NULL,
    "data" "jsonb" NOT NULL
);


ALTER TABLE "public"."prescription_templates" OWNER TO "postgres";

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."prescriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid",
    "clinic_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."prescriptions" OWNER TO "postgres";

--
-- Name: profile_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."profile_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."profile_audit_log_id_seq" OWNER TO "postgres";

--
-- Name: profile_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profile_audit_log" (
    "id" bigint DEFAULT "nextval"('"public"."profile_audit_log_id_seq"'::"regclass") NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "text"[],
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_audit_log" OWNER TO "postgres";

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."app_role",
    "avatar_url" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "specialization" "text",
    "license_number" "text",
    "bio" "text",
    "updated_at" timestamp with time zone,
    "clinic_id" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status",
    "title" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: receptionist_patient_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."receptionist_patient_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "clinic_id",
    "first_name",
    "last_name",
    "cedula",
    "phone",
    "email",
    "created_at"
   FROM "public"."patients";


ALTER VIEW "public"."receptionist_patient_view" OWNER TO "postgres";

--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#145247'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";

--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_id" "uuid" DEFAULT ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric DEFAULT 0.00 NOT NULL,
    "duration_minutes" integer DEFAULT 30,
    "category" "text" DEFAULT 'General'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "color" "text" DEFAULT '#145247'::"text",
    "category_id" "uuid"
);


ALTER TABLE "public"."services" OWNER TO "postgres";

--
-- Name: treatments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."treatments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "duration" integer DEFAULT 30 NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "clinic_id" "uuid"
);


ALTER TABLE "public"."treatments" OWNER TO "postgres";

--
-- Name: access_audit access_audit_pkey; Type: CONSTRAINT; Schema: logs; Owner: postgres
--

ALTER TABLE ONLY "logs"."access_audit"
    ADD CONSTRAINT "access_audit_pkey" PRIMARY KEY ("id");


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");


--
-- Name: automation_settings automation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."automation_settings"
    ADD CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id");


--
-- Name: billings billings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_pkey" PRIMARY KEY ("id");


--
-- Name: clinic_invitations clinic_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_pkey" PRIMARY KEY ("id");


--
-- Name: clinic_members clinic_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_members"
    ADD CONSTRAINT "clinic_members_pkey" PRIMARY KEY ("id");


--
-- Name: clinical_records clinical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinical_records"
    ADD CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id");


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_pkey" PRIMARY KEY ("id");


--
-- Name: data_rights_requests data_rights_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_pkey" PRIMARY KEY ("id");


--
-- Name: hcu033_forms hcu033_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."hcu033_forms"
    ADD CONSTRAINT "hcu033_forms_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: patient_files patient_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_pkey" PRIMARY KEY ("id");


--
-- Name: patient_notes patient_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id");


--
-- Name: patients patients_id_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_id_clinic_id_key" UNIQUE ("id", "clinic_id");


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: prescription_templates prescription_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescription_templates"
    ADD CONSTRAINT "prescription_templates_pkey" PRIMARY KEY ("id");


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id");


--
-- Name: profile_audit_log profile_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log"
    ADD CONSTRAINT "profile_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");


--
-- Name: treatments treatments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_pkey" PRIMARY KEY ("id");


--
-- Name: idx_appointments_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appointments_clinic_patient" ON "public"."appointments" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_appointments_clinic_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appointments_clinic_start" ON "public"."appointments" USING "btree" ("clinic_id", "start_time");


--
-- Name: idx_appointments_conflict; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appointments_conflict" ON "public"."appointments" USING "btree" ("clinic_id", "doctor_id", "start_time", "end_time") WHERE ("status" <> 'cancelled'::"text");


--
-- Name: idx_appointments_patient_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appointments_patient_doctor" ON "public"."appointments" USING "btree" ("clinic_id", "patient_id", "doctor_id");


--
-- Name: idx_billings_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_billings_clinic_patient" ON "public"."billings" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_clinical_records_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clinical_records_clinic_patient" ON "public"."clinical_records" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_data_rights_requests_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_data_rights_requests_clinic_patient" ON "public"."data_rights_requests" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_hcu033_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_hcu033_clinic_patient" ON "public"."hcu033_forms" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_invoices_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoices_clinic_patient" ON "public"."invoices" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_patient_files_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patient_files_clinic_patient" ON "public"."patient_files" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_patient_notes_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patient_notes_clinic_patient" ON "public"."patient_notes" USING "btree" ("clinic_id", "patient_id");


--
-- Name: idx_patients_clinic_cedula; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patients_clinic_cedula" ON "public"."patients" USING "btree" ("clinic_id", "cedula");


--
-- Name: idx_prescriptions_clinic_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_prescriptions_clinic_created" ON "public"."prescriptions" USING "btree" ("clinic_id", "created_at" DESC);


--
-- Name: idx_prescriptions_clinic_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_prescriptions_clinic_patient" ON "public"."prescriptions" USING "btree" ("clinic_id", "patient_id");


--
-- Name: data_rights_requests trg_audit_data_rights_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_audit_data_rights_status" AFTER UPDATE OF "status" ON "public"."data_rights_requests" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "security_internal"."audit_data_rights_status"();


--
-- Name: appointments trg_enforce_clinician_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_enforce_clinician_assignment" BEFORE INSERT OR UPDATE OF "doctor_id", "clinic_id" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "security_internal"."enforce_clinician_assignment"();


--
-- Name: clinical_records trg_enforce_clinician_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_enforce_clinician_assignment" BEFORE INSERT OR UPDATE OF "doctor_id", "clinic_id" ON "public"."clinical_records" FOR EACH ROW EXECUTE FUNCTION "security_internal"."enforce_clinician_assignment"();


--
-- Name: hcu033_forms trg_enforce_clinician_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_enforce_clinician_assignment" BEFORE INSERT OR UPDATE OF "doctor_id", "clinic_id" ON "public"."hcu033_forms" FOR EACH ROW EXECUTE FUNCTION "security_internal"."enforce_clinician_assignment"();


--
-- Name: prescriptions trg_enforce_clinician_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_enforce_clinician_assignment" BEFORE INSERT OR UPDATE OF "doctor_id", "clinic_id" ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "security_internal"."enforce_clinician_assignment"();


--
-- Name: data_rights_requests trg_guard_data_rights_request_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_guard_data_rights_request_insert" BEFORE INSERT ON "public"."data_rights_requests" FOR EACH ROW EXECUTE FUNCTION "public"."guard_data_rights_request_insert"();


--
-- Name: data_rights_requests trg_protect_data_rights_requests; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_protect_data_rights_requests" BEFORE UPDATE ON "public"."data_rights_requests" FOR EACH ROW EXECUTE FUNCTION "public"."protect_data_rights_requests"();


--
-- Name: appointments appointments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id");


--
-- Name: appointments appointments_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE CASCADE;


--
-- Name: automation_settings automation_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."automation_settings"
    ADD CONSTRAINT "automation_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");


--
-- Name: billings billings_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");


--
-- Name: billings billings_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: billings billings_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id");


--
-- Name: clinic_invitations clinic_invitations_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: clinic_invitations clinic_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");


--
-- Name: clinic_members clinic_members_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_members"
    ADD CONSTRAINT "clinic_members_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: clinic_members clinic_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_members"
    ADD CONSTRAINT "clinic_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");


--
-- Name: clinical_records clinical_records_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinical_records"
    ADD CONSTRAINT "clinical_records_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: clinical_records clinical_records_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinical_records"
    ADD CONSTRAINT "clinical_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id");


--
-- Name: clinical_records clinical_records_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinical_records"
    ADD CONSTRAINT "clinical_records_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id");


--
-- Name: clinics clinics_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");


--
-- Name: data_rights_requests data_rights_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: data_rights_requests data_rights_requests_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE SET NULL ("patient_id");


--
-- Name: data_rights_requests data_rights_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");


--
-- Name: data_rights_requests data_rights_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: hcu033_forms hcu033_forms_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."hcu033_forms"
    ADD CONSTRAINT "hcu033_forms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: hcu033_forms hcu033_forms_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."hcu033_forms"
    ADD CONSTRAINT "hcu033_forms_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id");


--
-- Name: hcu033_forms hcu033_forms_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."hcu033_forms"
    ADD CONSTRAINT "hcu033_forms_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE CASCADE;


--
-- Name: invoices invoices_billing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "public"."billings"("id");


--
-- Name: invoices invoices_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: invoices invoices_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id");


--
-- Name: messages messages_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id");


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");


--
-- Name: patient_files patient_files_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: patient_files patient_files_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE CASCADE;


--
-- Name: patient_files patient_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");


--
-- Name: patient_notes patient_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");


--
-- Name: patient_notes patient_notes_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: patient_notes patient_notes_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE CASCADE;


--
-- Name: patients patients_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: patients patients_family_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_family_clinic_fkey" FOREIGN KEY ("family_representative_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE SET NULL ("family_representative_id");


--
-- Name: patients patients_family_representative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_family_representative_id_fkey" FOREIGN KEY ("family_representative_id") REFERENCES "public"."patients"("id");


--
-- Name: payment_methods payment_methods_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: payment_methods payment_methods_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id");


--
-- Name: payments payments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: prescription_templates prescription_templates_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescription_templates"
    ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id");


--
-- Name: prescriptions prescriptions_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: prescriptions prescriptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id");


--
-- Name: prescriptions prescriptions_patient_clinic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_patient_clinic_fkey" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "public"."patients"("id", "clinic_id") ON DELETE CASCADE;


--
-- Name: profile_audit_log profile_audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log"
    ADD CONSTRAINT "profile_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id");


--
-- Name: profile_audit_log profile_audit_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log"
    ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id");


--
-- Name: profiles profiles_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: service_categories service_categories_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id");


--
-- Name: services services_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: treatments treatments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");


--
-- Name: treatments treatments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: access_audit; Type: ROW SECURITY; Schema: logs; Owner: postgres
--

ALTER TABLE "logs"."access_audit" ENABLE ROW LEVEL SECURITY;

--
-- Name: data_rights_requests Authenticated users can submit data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can submit data rights requests" ON "public"."data_rights_requests" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND ("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND ("resolved_by" IS NULL) AND ("resolved_at" IS NULL) AND ("resolution_notes" IS NULL)));


--
-- Name: data_rights_requests Clinic members can view data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic members can view data rights requests" ON "public"."data_rights_requests" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND (("user_id" = "auth"."uid"()) OR ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text"))));


--
-- Name: data_rights_requests Clinic owners can update data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can update data rights requests" ON "public"."data_rights_requests" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text")));


--
-- Name: patient_files Clinical staff can insert patient files; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can insert patient files" ON "public"."patient_files" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: patient_notes Clinical staff can insert patient notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can insert patient notes" ON "public"."patient_notes" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: patient_files Clinical staff can update patient files; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can update patient files" ON "public"."patient_files" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("uploaded_by" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: patient_notes Clinical staff can update patient notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can update patient notes" ON "public"."patient_notes" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("author_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: hcu033_forms Clinical staff can view hcu033_forms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can view hcu033_forms" ON "public"."hcu033_forms" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: patient_files Clinical staff can view patient files; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can view patient files" ON "public"."patient_files" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id") AND ("deleted_at" IS NULL)));


--
-- Name: patient_notes Clinical staff can view patient notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can view patient notes" ON "public"."patient_notes" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id") AND ("deleted_at" IS NULL)));


--
-- Name: clinical_records Medical staff can view clinical records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Medical staff can view clinical records" ON "public"."clinical_records" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."automation_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: billings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."billings" ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_invitations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clinic_invitations" ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clinic_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clinical_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: clinics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clinics" ENABLE ROW LEVEL SECURITY;

--
-- Name: data_rights_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."data_rights_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: hcu033_forms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."hcu033_forms" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."patient_files" ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."patient_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."prescription_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."prescriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profile_audit_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: service_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;

--
-- Name: treatments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."treatments" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "log_access_trigger"(); Type: ACL; Schema: logs; Owner: postgres
--

REVOKE ALL ON FUNCTION "logs"."log_access_trigger"() FROM PUBLIC;


--
-- Name: FUNCTION "check_subscription_active"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_clinic_member_role"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_user_clinic_id"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "service_role";


--
-- Name: FUNCTION "guard_data_rights_request_insert"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."guard_data_rights_request_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_data_rights_request_insert"() TO "service_role";


--
-- Name: FUNCTION "is_clinic_member"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "protect_data_rights_requests"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."protect_data_rights_requests"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_data_rights_requests"() TO "service_role";


--
-- Name: FUNCTION "purge_clinic_data"("target_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "audit_data_rights_status"(); Type: ACL; Schema: security_internal; Owner: postgres
--

REVOKE ALL ON FUNCTION "security_internal"."audit_data_rights_status"() FROM PUBLIC;


--
-- Name: FUNCTION "enforce_clinician_assignment"(); Type: ACL; Schema: security_internal; Owner: postgres
--

REVOKE ALL ON FUNCTION "security_internal"."enforce_clinician_assignment"() FROM PUBLIC;


--
-- Name: TABLE "appointments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";


--
-- Name: TABLE "automation_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."automation_settings" TO "anon";
GRANT ALL ON TABLE "public"."automation_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_settings" TO "service_role";


--
-- Name: TABLE "billings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."billings" TO "anon";
GRANT ALL ON TABLE "public"."billings" TO "authenticated";
GRANT ALL ON TABLE "public"."billings" TO "service_role";


--
-- Name: TABLE "clinic_invitations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clinic_invitations" TO "anon";
GRANT ALL ON TABLE "public"."clinic_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_invitations" TO "service_role";


--
-- Name: TABLE "clinic_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clinic_members" TO "anon";
GRANT ALL ON TABLE "public"."clinic_members" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_members" TO "service_role";


--
-- Name: TABLE "clinical_records"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clinical_records" TO "anon";
GRANT ALL ON TABLE "public"."clinical_records" TO "authenticated";
GRANT ALL ON TABLE "public"."clinical_records" TO "service_role";


--
-- Name: TABLE "clinics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clinics" TO "anon";
GRANT ALL ON TABLE "public"."clinics" TO "authenticated";
GRANT ALL ON TABLE "public"."clinics" TO "service_role";


--
-- Name: TABLE "data_rights_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."data_rights_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_rights_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_rights_requests" TO "service_role";


--
-- Name: TABLE "hcu033_forms"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."hcu033_forms" TO "anon";
GRANT ALL ON TABLE "public"."hcu033_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."hcu033_forms" TO "service_role";


--
-- Name: TABLE "invoices"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";


--
-- Name: TABLE "messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";


--
-- Name: TABLE "notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";


--
-- Name: TABLE "patient_files"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."patient_files" TO "anon";
GRANT ALL ON TABLE "public"."patient_files" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_files" TO "service_role";


--
-- Name: TABLE "patient_notes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."patient_notes" TO "anon";
GRANT ALL ON TABLE "public"."patient_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_notes" TO "service_role";


--
-- Name: TABLE "patients"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";


--
-- Name: TABLE "payment_methods"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";


--
-- Name: TABLE "payments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";


--
-- Name: TABLE "prescription_templates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."prescription_templates" TO "anon";
GRANT ALL ON TABLE "public"."prescription_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prescription_templates" TO "service_role";


--
-- Name: TABLE "prescriptions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."prescriptions" TO "anon";
GRANT ALL ON TABLE "public"."prescriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."prescriptions" TO "service_role";


--
-- Name: SEQUENCE "profile_audit_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "service_role";


--
-- Name: TABLE "profile_audit_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profile_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."profile_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_audit_log" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "receptionist_patient_view"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."receptionist_patient_view" TO "authenticated";
GRANT ALL ON TABLE "public"."receptionist_patient_view" TO "service_role";


--
-- Name: TABLE "service_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";


--
-- Name: TABLE "services"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";


--
-- Name: TABLE "treatments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."treatments" TO "anon";
GRANT ALL ON TABLE "public"."treatments" TO "authenticated";
GRANT ALL ON TABLE "public"."treatments" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

\unrestrict LYYFR89cskaKAJGiBxyd6fmb0x4yS0d0968MP1DHQbxgSiDu4HMYGauulsUUxbE

