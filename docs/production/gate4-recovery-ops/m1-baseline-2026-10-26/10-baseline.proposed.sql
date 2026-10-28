BEGIN; SET LOCAL statement_timeout='90s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions; SELECT pg_advisory_xact_lock(731926,1711); DO $identity$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT system_identifier::text FROM pg_control_system())<>'7701080397606109221' THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_IDENTITY_REFUSED'; END IF; END $identity$;
-- Migration window only. Known synthetic project; no application/provider ledger writes.
-- Block competing Auth/Storage data writers while the planned DDL transaction runs.
-- Exact ordinary Auth/Storage writer surface. Provider vector/analytics internals
-- and managed ledgers are excluded; no new privileges are requested.
LOCK TABLE auth.users,auth.identities,auth.sessions,auth.refresh_tokens,
 auth.mfa_factors,auth.mfa_challenges,auth.mfa_amr_claims,auth.audit_log_entries,
 storage.buckets,storage.objects IN SHARE ROW EXCLUSIVE MODE;
DO $empty$ BEGIN IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S','f')) OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal')) OR EXISTS(SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','logs','security_internal')) OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('logs','security_internal')) OR EXISTS(SELECT FROM auth.users) OR EXISTS(SELECT FROM auth.mfa_factors) OR EXISTS(SELECT FROM storage.buckets) OR EXISTS(SELECT FROM storage.objects) OR to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_EMPTY_REFUSED'; END IF; IF NOT has_schema_privilege(current_user,'public','CREATE') OR NOT has_table_privilege(current_user,'auth.users','TRIGGER') THEN RAISE EXCEPTION 'GATE3_BOOTSTRAP_PRIVILEGE_REFUSED'; END IF; END $empty$; SET LOCAL check_function_bodies=false;
-- Prevent provider defaults adding authority beyond the explicit schema-only ACLs.
-- The pinned source restores these postgres-owned defaults at the end of this transaction.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon,authenticated,service_role;



--
-- Name: logs; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA "logs";



ALTER SCHEMA "logs" OWNER TO "postgres";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';



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
    AS $$
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
$$;



ALTER FUNCTION "logs"."log_access_trigger"() OWNER TO "postgres";


--
-- Name: log_patient_view("uuid"); Type: FUNCTION; Schema: logs; Owner: postgres
--

CREATE FUNCTION "logs"."log_patient_view"("p_patient_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;



ALTER FUNCTION "logs"."log_patient_view"("p_patient_id" "uuid") OWNER TO "postgres";


--
-- Name: accept_clinic_invitation("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."accept_clinic_invitation"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."accept_clinic_invitation"("p_token" "text") OWNER TO "postgres";


--
-- Name: archive_clinic("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."archive_clinic"("target_clinic_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
$$;



ALTER FUNCTION "public"."archive_clinic"("target_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: check_subscription_active("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: cleanup_soft_deleted_records(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."cleanup_soft_deleted_records"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Delete notifications older than 90 days
  DELETE FROM public.notifications 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleanup run at %s. Safe mode active.', NOW();
END;
$$;



ALTER FUNCTION "public"."cleanup_soft_deleted_records"() OWNER TO "postgres";


--
-- Name: create_tenant_clinic("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;



ALTER FUNCTION "public"."create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text") OWNER TO "postgres";


--
-- Name: custom_access_token_hook("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


--
-- Name: enforce_patient_clinical_privileges(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."enforce_patient_clinical_privileges"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."enforce_patient_clinical_privileges"() OWNER TO "postgres";


--
-- Name: get_checkout_payment_methods("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "type" "text", "title" "text", "config" "jsonb", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") OWNER TO "postgres";


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
$$;



ALTER FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: get_family_unit_with_stats("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_family_unit_with_stats"("p_patient_id" "uuid") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "phone" "text", "avatar_url" "text", "family_relationship" "text", "is_family_head" boolean, "family_representative_id" "uuid", "appointments_count" bigint, "total_billed" numeric, "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."get_family_unit_with_stats"("p_patient_id" "uuid") OWNER TO "postgres";


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
    "clinic_id" "uuid",
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
-- Name: COLUMN "patients"."blood_type"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."blood_type" IS 'Blood type of the patient (e.g., A+, O-)';



--
-- Name: COLUMN "patients"."marital_status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."marital_status" IS 'Marital status (e.g., single, married, divorced, widowed)';



--
-- Name: COLUMN "patients"."has_diabetes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."has_diabetes" IS 'Clinical Alert: Patient has diabetes (Risk for healing/infection)';



--
-- Name: COLUMN "patients"."has_hypertension"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."has_hypertension" IS 'Clinical Alert: Patient has hypertension (Risk for anesthesia)';



--
-- Name: COLUMN "patients"."preferred_contact_method"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."preferred_contact_method" IS 'How the patient prefers to be contacted (whatsapp, email, phone)';



--
-- Name: COLUMN "patients"."recall_months"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."recall_months" IS 'Preventive care cycle in months (default 6)';



--
-- Name: COLUMN "patients"."family_representative_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."family_representative_id" IS 'Points to the patient who is the head/billing rep of this family group';



--
-- Name: COLUMN "patients"."family_relationship"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."patients"."family_relationship" IS 'The role of this patient in the family (e.g., Son, Daughter, Spouse, Aunt)';



--
-- Name: get_patient_profile_secure("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_patient_profile_secure"("p_patient_id" "uuid") RETURNS SETOF "public"."patients"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;



ALTER FUNCTION "public"."get_patient_profile_secure"("p_patient_id" "uuid") OWNER TO "postgres";


--
-- Name: get_patients_with_stats("uuid", "text", integer, integer, "text", "text", boolean, "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 12, "p_offset" integer DEFAULT 0, "p_time_filter" "text" DEFAULT 'all'::"text", "p_badge_filter" "text" DEFAULT 'all'::"text", "p_group_by_family" boolean DEFAULT false, "p_patient_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "clinic_id" "uuid", "first_name" "text", "last_name" "text", "cedula" "text", "email" "text", "phone" "text", "address" "text", "city" "text", "state" "text", "birth_date" "date", "gender" "text", "patient_status" "text", "status" "text", "occupation" "text", "guardian_name" "text", "referral_source" "text", "referred_by" "text", "clinical_notes" "text", "medical_record_number" "text", "tags" "text"[], "emergency_contact" "text", "emergency_phone" "text", "allergies" "text", "medications" "text", "medical_conditions" "text", "medical_history" "jsonb", "insurance_provider" "text", "policy_number" "text", "blood_type" "text", "marital_status" "text", "has_diabetes" boolean, "has_hypertension" boolean, "has_heart_disease" boolean, "is_smoker" boolean, "is_pregnant" boolean, "preferred_contact_method" "text", "recall_months" integer, "internal_notes" "text", "account_balance" numeric, "avatar_url" "text", "family_representative_id" "uuid", "family_relationship" "text", "is_family_head" boolean, "family_member_count" bigint, "appointments_count" bigint, "total_billed" numeric, "last_visit" timestamp with time zone, "next_appointment" timestamp with time zone, "last_treatment_note" "text", "odontogram_state" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer, "p_time_filter" "text", "p_badge_filter" "text", "p_group_by_family" boolean, "p_patient_id" "uuid") OWNER TO "postgres";


--
-- Name: get_user_clinic_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_user_clinic_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT clinic_id FROM profiles WHERE id = auth.uid();
$$;



ALTER FUNCTION "public"."get_user_clinic_id"() OWNER TO "postgres";


--
-- Name: guard_patient_clinical_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."guard_patient_clinical_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."guard_patient_clinical_insert"() OWNER TO "postgres";


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


--
-- Name: handle_verified_clinic_creation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."handle_verified_clinic_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."handle_verified_clinic_creation"() OWNER TO "postgres";


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
$$;



ALTER FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: log_data_rights_request("text", "jsonb", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."log_data_rights_request"("p_request_type" "text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_legal_basis" "text" DEFAULT 'LOPDP Art. 17'::"text", "p_retention_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."log_data_rights_request"("p_request_type" "text", "p_details" "jsonb", "p_legal_basis" "text", "p_retention_note" "text") OWNER TO "postgres";


--
-- Name: log_profile_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."log_profile_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."log_profile_changes"() OWNER TO "postgres";


--
-- Name: prevent_profile_privilege_escalation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."prevent_profile_privilege_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."prevent_profile_privilege_escalation"() OWNER TO "postgres";


--
-- Name: protect_data_rights_requests(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."protect_data_rights_requests"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."protect_data_rights_requests"() OWNER TO "postgres";


--
-- Name: purge_clinic_data("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: remove_clinic_member("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: seed_default_services("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."seed_default_services"("target_clinic_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."seed_default_services"("target_clinic_id" "uuid") OWNER TO "postgres";


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;



ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


--
-- Name: sync_hcu033_form_clinic_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."sync_hcu033_form_clinic_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;



ALTER FUNCTION "public"."sync_hcu033_form_clinic_id"() OWNER TO "postgres";


--
-- Name: update_billing_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_billing_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;



ALTER FUNCTION "public"."update_billing_status"() OWNER TO "postgres";


--
-- Name: update_patient_odontogram_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_patient_odontogram_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE patients
    SET 
        last_treatment_note = NEW.form_data->>'odontograma_descripcion',
        odontogram_state = NEW.form_data->'odontograma_data'
    WHERE id = NEW.patient_id;
    RETURN NEW;
END;
$$;



ALTER FUNCTION "public"."update_patient_odontogram_summary"() OWNER TO "postgres";


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
    "clinic_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"])))
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
    "clinic_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "billings_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'overdue'::"text"])))
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
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    CONSTRAINT "clinic_invitations_role_check" CHECK (("role" = ANY (ARRAY['doctor'::"text", 'receptionist'::"text"]))),
    CONSTRAINT "clinic_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"])))
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
    "size" character varying(50)
);



ALTER TABLE "public"."clinics" OWNER TO "postgres";


--
-- Name: dashboard_stats_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."dashboard_stats_view" WITH ("security_invoker"='true') AS
 SELECT "clinic_id",
    "date_trunc"('month'::"text", "created_at") AS "month",
    "count"("id") AS "total_billings",
    "sum"("amount") AS "total_revenue",
    "count"(DISTINCT "patient_id") AS "unique_patients_billed"
   FROM "public"."billings"
  WHERE ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid")
  GROUP BY "clinic_id", ("date_trunc"('month'::"text", "created_at"));



ALTER VIEW "public"."dashboard_stats_view" OWNER TO "postgres";


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
    CONSTRAINT "data_rights_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['portability'::"text", 'deletion'::"text", 'rectification'::"text", 'access'::"text", 'opposition'::"text", 'custody_lock'::"text"]))),
    CONSTRAINT "data_rights_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'rejected'::"text", 'archived_custody'::"text"])))
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
    "clinic_id" "uuid" DEFAULT ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid",
    "deleted_at" timestamp with time zone
);



ALTER TABLE "public"."hcu033_forms" OWNER TO "postgres";


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clinic_id" "uuid",
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
    "environment" "text" DEFAULT 'TEST'::"text",
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'authorized'::"text", 'rejected'::"text", 'cancelled'::"text"])))
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
    "link" "text",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text", 'error'::"text"])))
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
-- Name: patient_stats_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."patient_stats_view" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "patient_id",
    "p"."clinic_id",
    "count"(DISTINCT "a"."id") AS "appointment_count",
    COALESCE("sum"("b"."amount"), (0)::numeric) AS "total_billed"
   FROM (("public"."patients" "p"
     LEFT JOIN "public"."appointments" "a" ON ((("a"."patient_id" = "p"."id") AND ("a"."status" = 'completed'::"text"))))
     LEFT JOIN "public"."billings" "b" ON ((("b"."patient_id" = "p"."id") AND ("b"."status" = 'paid'::"text"))))
  GROUP BY "p"."id", "p"."clinic_id";



ALTER VIEW "public"."patient_stats_view" OWNER TO "postgres";


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
    "amount" numeric(10,2) NOT NULL,
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
    "data" "jsonb" NOT NULL,
    CONSTRAINT "prescription_templates_clinic_id_check" CHECK (("clinic_id" IS NOT NULL))
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
    "clinic_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);



ALTER TABLE "public"."prescriptions" OWNER TO "postgres";


--
-- Name: profile_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profile_audit_log" (
    "id" bigint NOT NULL,
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
-- Name: profile_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."profile_audit_log_id_seq" OWNED BY "public"."profile_audit_log"."id";



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
-- Name: recall_queue; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."recall_queue" WITH ("security_invoker"='true') AS
 SELECT "id",
    "clinic_id",
    "first_name",
    "last_name",
    "phone",
    "email",
    COALESCE("medical_alerts", ''::"text") AS "medical_alerts",
    "created_at"
   FROM "public"."patients"
  WHERE ("deleted_at" IS NULL);



ALTER VIEW "public"."recall_queue" OWNER TO "postgres";


--
-- Name: receptionist_patient_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."receptionist_patient_view" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "patient_id",
    "p"."clinic_id",
    "p"."first_name",
    "p"."last_name",
    "p"."phone",
    "p"."email",
    "max"("cr"."created_at") AS "last_visit_date"
   FROM ("public"."patients" "p"
     LEFT JOIN "public"."clinical_records" "cr" ON (("p"."id" = "cr"."patient_id")))
  GROUP BY "p"."id", "p"."clinic_id", "p"."first_name", "p"."last_name", "p"."phone", "p"."email"
 HAVING (("max"("cr"."created_at") < ("now"() - '6 mons'::interval)) OR ("max"("cr"."created_at") IS NULL));



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
    "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
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
-- Name: profile_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."profile_audit_log_id_seq"'::"regclass");



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
-- Name: clinic_invitations clinic_invitations_clinic_id_email_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_clinic_id_email_status_key" UNIQUE ("clinic_id", "email", "status");



--
-- Name: clinic_invitations clinic_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_pkey" PRIMARY KEY ("id");



--
-- Name: clinic_invitations clinic_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_token_key" UNIQUE ("token");



--
-- Name: clinic_members clinic_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_members"
    ADD CONSTRAINT "clinic_members_pkey" PRIMARY KEY ("id");



--
-- Name: clinic_members clinic_members_user_id_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_members"
    ADD CONSTRAINT "clinic_members_user_id_clinic_id_key" UNIQUE ("user_id", "clinic_id");



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
-- Name: patients patients_cedula_clinic_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_cedula_clinic_unique" UNIQUE ("cedula", "clinic_id");



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
-- Name: service_categories service_categories_clinic_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_clinic_id_name_key" UNIQUE ("clinic_id", "name");



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
-- Name: idx_access_audit_clinic_id; Type: INDEX; Schema: logs; Owner: postgres
--

CREATE INDEX "idx_access_audit_clinic_id" ON "logs"."access_audit" USING "btree" ("clinic_id");



--
-- Name: idx_appointments_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_appointments_clinic_id" ON "public"."appointments" USING "btree" ("clinic_id");



--
-- Name: idx_billings_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_billings_clinic_id" ON "public"."billings" USING "btree" ("clinic_id");



--
-- Name: idx_clinic_invitations_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clinic_invitations_email" ON "public"."clinic_invitations" USING "btree" ("email");



--
-- Name: idx_clinic_invitations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clinic_invitations_status" ON "public"."clinic_invitations" USING "btree" ("status");



--
-- Name: idx_clinic_members_auth_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clinic_members_auth_lookup" ON "public"."clinic_members" USING "btree" ("user_id", "clinic_id", "status");



--
-- Name: idx_clinical_records_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clinical_records_clinic_id" ON "public"."clinical_records" USING "btree" ("clinic_id");



--
-- Name: idx_data_rights_requests_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_data_rights_requests_tenant" ON "public"."data_rights_requests" USING "btree" ("clinic_id", "created_at" DESC);



--
-- Name: idx_data_rights_requests_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_data_rights_requests_type" ON "public"."data_rights_requests" USING "btree" ("clinic_id", "request_type");



--
-- Name: idx_hcu033_forms_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_hcu033_forms_clinic_id" ON "public"."hcu033_forms" USING "btree" ("clinic_id");



--
-- Name: idx_hcu033_forms_tenant_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_hcu033_forms_tenant_patient" ON "public"."hcu033_forms" USING "btree" ("clinic_id", "patient_id");



--
-- Name: idx_invoices_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_invoices_clinic_id" ON "public"."invoices" USING "btree" ("clinic_id");



--
-- Name: idx_messages_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_messages_clinic_id" ON "public"."messages" USING "btree" ("clinic_id");



--
-- Name: idx_patient_files_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patient_files_patient" ON "public"."patient_files" USING "btree" ("patient_id") WHERE ("deleted_at" IS NULL);



--
-- Name: idx_patient_notes_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patient_notes_patient" ON "public"."patient_notes" USING "btree" ("patient_id") WHERE ("deleted_at" IS NULL);



--
-- Name: idx_patients_clinic_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patients_clinic_deleted" ON "public"."patients" USING "btree" ("clinic_id") WHERE ("deleted_at" IS NULL);



--
-- Name: idx_patients_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patients_clinic_id" ON "public"."patients" USING "btree" ("clinic_id");



--
-- Name: idx_patients_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patients_email" ON "public"."patients" USING "btree" ("email");



--
-- Name: idx_patients_family_rep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_patients_family_rep" ON "public"."patients" USING "btree" ("family_representative_id");



--
-- Name: idx_payment_methods_clinic_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_methods_clinic_active" ON "public"."payment_methods" USING "btree" ("clinic_id", "is_active");



--
-- Name: idx_payment_methods_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payment_methods_clinic_id" ON "public"."payment_methods" USING "btree" ("clinic_id");



--
-- Name: idx_payments_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_payments_clinic_id" ON "public"."payments" USING "btree" ("clinic_id");



--
-- Name: idx_prescriptions_tenant_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_prescriptions_tenant_doctor" ON "public"."prescriptions" USING "btree" ("clinic_id", "doctor_id", "patient_id");



--
-- Name: idx_profiles_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_clinic_id" ON "public"."profiles" USING "btree" ("clinic_id");



--
-- Name: idx_services_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_services_clinic_id" ON "public"."services" USING "btree" ("clinic_id");



--
-- Name: idx_treatments_clinic_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_treatments_clinic_id" ON "public"."treatments" USING "btree" ("clinic_id");



--
-- Name: profiles_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_email_key" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



--
-- Name: profiles_license_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_license_key" ON "public"."profiles" USING "btree" ("license_number") WHERE ("license_number" IS NOT NULL);



--
-- Name: billings audit_billings; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_billings" AFTER INSERT OR DELETE OR UPDATE ON "public"."billings" FOR EACH ROW EXECUTE FUNCTION "logs"."log_access_trigger"();



--
-- Name: clinical_records audit_clinical_records; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_clinical_records" AFTER INSERT OR DELETE OR UPDATE ON "public"."clinical_records" FOR EACH ROW EXECUTE FUNCTION "logs"."log_access_trigger"();



--
-- Name: hcu033_forms audit_hcu033_forms; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_hcu033_forms" AFTER INSERT OR DELETE OR UPDATE ON "public"."hcu033_forms" FOR EACH ROW EXECUTE FUNCTION "logs"."log_access_trigger"();



--
-- Name: patients audit_patients; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "audit_patients" AFTER INSERT OR DELETE OR UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "logs"."log_access_trigger"();



--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



--
-- Name: hcu033_forms tr_update_patient_odontogram; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "tr_update_patient_odontogram" AFTER INSERT OR UPDATE ON "public"."hcu033_forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_patient_odontogram_summary"();



--
-- Name: patients trg_enforce_patient_clinical_privileges; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_enforce_patient_clinical_privileges" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_patient_clinical_privileges"();



--
-- Name: patients trg_guard_patient_clinical_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_guard_patient_clinical_insert" BEFORE INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."guard_patient_clinical_insert"();



--
-- Name: profiles trg_log_profile_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_log_profile_changes" AFTER UPDATE ON "public"."profiles" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."log_profile_changes"();



--
-- Name: profiles trg_prevent_profile_privilege_escalation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_prevent_profile_privilege_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_privilege_escalation"();



--
-- Name: data_rights_requests trg_protect_data_requests_immutability; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_protect_data_requests_immutability" BEFORE UPDATE ON "public"."data_rights_requests" FOR EACH ROW EXECUTE FUNCTION "public"."protect_data_rights_requests"();



--
-- Name: data_rights_requests trg_protect_data_rights_requests; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_protect_data_rights_requests" BEFORE UPDATE ON "public"."data_rights_requests" FOR EACH ROW EXECUTE FUNCTION "public"."protect_data_rights_requests"();



--
-- Name: hcu033_forms trg_sync_hcu033_form_clinic_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_sync_hcu033_form_clinic_id" BEFORE INSERT OR UPDATE ON "public"."hcu033_forms" FOR EACH ROW EXECUTE FUNCTION "public"."sync_hcu033_form_clinic_id"();



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
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



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
-- Name: billings billings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



--
-- Name: clinic_invitations clinic_invitations_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinic_invitations"
    ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



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
-- Name: clinical_records clinical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinical_records"
    ADD CONSTRAINT "clinical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



--
-- Name: clinics clinics_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



--
-- Name: data_rights_requests data_rights_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



--
-- Name: data_rights_requests data_rights_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE SET NULL;



--
-- Name: data_rights_requests data_rights_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



--
-- Name: data_rights_requests data_rights_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."data_rights_requests"
    ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



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
-- Name: hcu033_forms hcu033_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."hcu033_forms"
    ADD CONSTRAINT "hcu033_forms_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



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
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



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
    ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



--
-- Name: patient_files patient_files_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



--
-- Name: patient_files patient_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_files"
    ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



--
-- Name: patient_notes patient_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



--
-- Name: patient_notes patient_notes_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



--
-- Name: patient_notes patient_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



--
-- Name: patients patients_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");



--
-- Name: patients patients_family_representative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_family_representative_id_fkey" FOREIGN KEY ("family_representative_id") REFERENCES "public"."patients"("id");



--
-- Name: payment_methods payment_methods_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



--
-- Name: prescriptions prescriptions_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



--
-- Name: prescriptions prescriptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



--
-- Name: profile_audit_log profile_audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log"
    ADD CONSTRAINT "profile_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id");



--
-- Name: profile_audit_log profile_audit_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_audit_log"
    ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



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
-- Name: access_audit No one allows delete on audit; Type: POLICY; Schema: logs; Owner: postgres
--

CREATE POLICY "No one allows delete on audit" ON "logs"."access_audit" FOR DELETE USING (false);



--
-- Name: access_audit No one allows update on audit; Type: POLICY; Schema: logs; Owner: postgres
--

CREATE POLICY "No one allows update on audit" ON "logs"."access_audit" FOR UPDATE USING (false);



--
-- Name: access_audit System can insert audit; Type: POLICY; Schema: logs; Owner: postgres
--

CREATE POLICY "System can insert audit" ON "logs"."access_audit" FOR INSERT WITH CHECK (true);



--
-- Name: access_audit; Type: ROW SECURITY; Schema: logs; Owner: postgres
--

ALTER TABLE "logs"."access_audit" ENABLE ROW LEVEL SECURITY;


--
-- Name: patients Active clinic members can insert patients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active clinic members can insert patients" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: patients Active clinic members can update patients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active clinic members can update patients" ON "public"."patients" FOR UPDATE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id"))) WITH CHECK ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: patients Active clinic members can view patients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active clinic members can view patients" ON "public"."patients" FOR SELECT TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: profile_audit_log Admins can view audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view audit logs" ON "public"."profile_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'clinic_owner'::"public"."app_role")))));



--
-- Name: payment_methods Allow checkout viewing of active payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow checkout viewing of active payment methods" ON "public"."payment_methods" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."billings" "b"
  WHERE ("b"."clinic_id" = "payment_methods"."clinic_id")))));



--
-- Name: clinic_invitations Anyone can view their own invitation by email; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view their own invitation by email" ON "public"."clinic_invitations" FOR SELECT USING ((("email" = "auth"."email"()) OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



--
-- Name: data_rights_requests Authenticated users can submit data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can submit data rights requests" ON "public"."data_rights_requests" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))));



--
-- Name: data_rights_requests Clinic members can view data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic members can view data rights requests" ON "public"."data_rights_requests" FOR SELECT TO "authenticated" USING (("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid"));



--
-- Name: hcu033_forms Clinic members can view hcu033_forms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic members can view hcu033_forms" ON "public"."hcu033_forms" FOR SELECT TO "authenticated" USING (((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")) OR (("clinic_id" IS NULL) AND ("patient_id" IN ( SELECT "p"."id"
   FROM "public"."patients" "p"
  WHERE (("p"."clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("p"."clinic_id") AND "public"."check_subscription_active"("p"."clinic_id")))))));



--
-- Name: payment_methods Clinic members can view payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic members can view payment methods" ON "public"."payment_methods" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."clinic_members" "cm"
  WHERE (("cm"."clinic_id" = "payment_methods"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "payment_methods"."clinic_id") AND ("c"."owner_id" = "auth"."uid"()))))));



--
-- Name: services Clinic members can view services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic members can view services" ON "public"."services" FOR SELECT TO "authenticated" USING (("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid"));



--
-- Name: clinical_records Clinic owners can delete clinical records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete clinical records" ON "public"."clinical_records" FOR DELETE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: hcu033_forms Clinic owners can delete hcu033_forms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete hcu033_forms" ON "public"."hcu033_forms" FOR DELETE TO "authenticated" USING (((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") AND "public"."check_subscription_active"("clinic_id")) OR (("clinic_id" IS NULL) AND ("patient_id" IN ( SELECT "p"."id"
   FROM "public"."patients" "p"
  WHERE (("p"."clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("p"."clinic_id") = 'clinic_owner'::"text") AND "public"."check_subscription_active"("p"."clinic_id")))))));



--
-- Name: profiles Clinic owners can delete members in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete members in their clinic" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text") AND ("id" <> "auth"."uid"())));



--
-- Name: patients Clinic owners can delete patients in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete patients in their clinic" ON "public"."patients" FOR DELETE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: payment_methods Clinic owners can delete payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete payment methods" ON "public"."payment_methods" FOR DELETE TO "authenticated" USING (((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "payment_methods"."clinic_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."clinic_members" "cm"
  WHERE (("cm"."clinic_id" = "payment_methods"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'clinic_owner'::"text") AND ("cm"."status" = 'active'::"text"))))));



--
-- Name: services Clinic owners can delete services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can delete services" ON "public"."services" FOR DELETE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: payment_methods Clinic owners can insert payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can insert payment methods" ON "public"."payment_methods" FOR INSERT TO "authenticated" WITH CHECK (((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "payment_methods"."clinic_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."clinic_members" "cm"
  WHERE (("cm"."clinic_id" = "payment_methods"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'clinic_owner'::"text") AND ("cm"."status" = 'active'::"text"))))));



--
-- Name: services Clinic owners can insert services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can insert services" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: clinic_invitations Clinic owners can manage invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can manage invitations" ON "public"."clinic_invitations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clinic_members"
  WHERE (("clinic_members"."clinic_id" = "clinic_invitations"."clinic_id") AND ("clinic_members"."user_id" = "auth"."uid"()) AND ("clinic_members"."role" = 'clinic_owner'::"text")))));



--
-- Name: data_rights_requests Clinic owners can update data rights requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can update data rights requests" ON "public"."data_rights_requests" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: profiles Clinic owners can update members in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can update members in their clinic" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text"))) WITH CHECK ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid")));



--
-- Name: payment_methods Clinic owners can update payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can update payment methods" ON "public"."payment_methods" FOR UPDATE TO "authenticated" USING (((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "payment_methods"."clinic_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."clinic_members" "cm"
  WHERE (("cm"."clinic_id" = "payment_methods"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'clinic_owner'::"text") AND ("cm"."status" = 'active'::"text")))))) WITH CHECK (((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "payment_methods"."clinic_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."clinic_members" "cm"
  WHERE (("cm"."clinic_id" = "payment_methods"."clinic_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'clinic_owner'::"text") AND ("cm"."status" = 'active'::"text"))))));



--
-- Name: services Clinic owners can update services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinic owners can update services" ON "public"."services" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: clinical_records Clinical staff can insert clinical records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can insert clinical records" ON "public"."clinical_records" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: hcu033_forms Clinical staff can insert hcu033_forms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can insert hcu033_forms" ON "public"."hcu033_forms" FOR INSERT TO "authenticated" WITH CHECK (((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("clinic_id")) OR (("clinic_id" IS NULL) AND ("patient_id" IN ( SELECT "p"."id"
   FROM "public"."patients" "p"
  WHERE (("p"."clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("p"."clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("p"."clinic_id")))))));



--
-- Name: clinical_records Clinical staff can update clinical records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can update clinical records" ON "public"."clinical_records" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: hcu033_forms Clinical staff can update hcu033_forms; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clinical staff can update hcu033_forms" ON "public"."hcu033_forms" FOR UPDATE TO "authenticated" USING (((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("clinic_id")) OR (("clinic_id" IS NULL) AND ("patient_id" IN ( SELECT "p"."id"
   FROM "public"."patients" "p"
  WHERE (("p"."clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("p"."clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("p"."clinic_id"))))))) WITH CHECK (((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("clinic_id")) OR (("clinic_id" IS NULL) AND ("patient_id" IN ( SELECT "p"."id"
   FROM "public"."patients" "p"
  WHERE (("p"."clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("p"."clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND "public"."check_subscription_active"("p"."clinic_id")))))));



--
-- Name: prescriptions Doctors and owners can insert prescriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Doctors and owners can insert prescriptions" ON "public"."prescriptions" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['doctor'::"text", 'clinic_owner'::"text"])) AND ("doctor_id" = "auth"."uid"()) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: prescriptions Doctors and owners can update their prescriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Doctors and owners can update their prescriptions" ON "public"."prescriptions" FOR UPDATE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("doctor_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id"))) WITH CHECK ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("doctor_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: clinical_records Medical staff can view clinical records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Medical staff can view clinical records" ON "public"."clinical_records" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: clinics Owners can update their own clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can update their own clinic" ON "public"."clinics" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



--
-- Name: billings Owners can view billings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can view billings" ON "public"."billings" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: payments Owners can view their payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can view their payments" ON "public"."payments" FOR SELECT USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'clinic_owner'::"text")));



--
-- Name: prescriptions Prescriptions are deletable by clinic owners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Prescriptions are deletable by clinic owners" ON "public"."prescriptions" FOR DELETE TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: prescriptions Prescriptions are viewable by clinic members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Prescriptions are viewable by clinic members" ON "public"."prescriptions" FOR SELECT TO "authenticated" USING ((("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: profiles Profiles are viewable by same clinic members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Profiles are viewable by same clinic members" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (("clinic_id" IS NOT NULL) AND ("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid"))));



--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



--
-- Name: prescription_templates Templates are deletable by their creator or clinic owners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Templates are deletable by their creator or clinic owners" ON "public"."prescription_templates" FOR DELETE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("doctor_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: prescription_templates Templates are insertable by clinical staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Templates are insertable by clinical staff" ON "public"."prescription_templates" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND ("doctor_id" = "auth"."uid"()) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: prescription_templates Templates are updatable by their creator or clinic owners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Templates are updatable by their creator or clinic owners" ON "public"."prescription_templates" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("doctor_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND (("public"."get_clinic_member_role"("clinic_id") = 'clinic_owner'::"text") OR (("public"."get_clinic_member_role"("clinic_id") = 'doctor'::"text") AND ("doctor_id" = "auth"."uid"()))) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: prescription_templates Templates are viewable by clinic members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Templates are viewable by clinic members" ON "public"."prescription_templates" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: clinic_members Users and owners can view clinic memberships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and owners can view clinic memberships" ON "public"."clinic_members" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."clinics" "c"
  WHERE (("c"."id" = "clinic_members"."clinic_id") AND ("c"."owner_id" = "auth"."uid"()))))));



--
-- Name: appointments Users can delete appointments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete appointments in their clinic" ON "public"."appointments" FOR DELETE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND ("public"."get_clinic_member_role"("clinic_id") = ANY (ARRAY['clinic_owner'::"text", 'doctor'::"text"])) AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: appointments Users can insert appointments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert appointments in their clinic" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: billings Users can insert billings in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert billings in their clinic" ON "public"."billings" FOR INSERT WITH CHECK (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."clinic_id" = "public"."get_user_clinic_id"()))));



--
-- Name: patient_files Users can insert files in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert files in their clinic" ON "public"."patient_files" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: invoices Users can insert invoices in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert invoices in their clinic" ON "public"."invoices" FOR INSERT WITH CHECK (("clinic_id" = "public"."get_user_clinic_id"()));



--
-- Name: messages Users can insert messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert messages" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



--
-- Name: patient_notes Users can insert notes in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert notes in their clinic" ON "public"."patient_notes" FOR INSERT TO "authenticated" WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: automation_settings Users can insert their own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own settings" ON "public"."automation_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



--
-- Name: treatments Users can insert treatments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert treatments in their clinic" ON "public"."treatments" FOR INSERT WITH CHECK (("clinic_id" = "public"."get_user_clinic_id"()));



--
-- Name: service_categories Users can manage their clinic categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage their clinic categories" ON "public"."service_categories" USING (("clinic_id" IN ( SELECT "clinic_members"."clinic_id"
   FROM "public"."clinic_members"
  WHERE ("clinic_members"."user_id" = "auth"."uid"()))));



--
-- Name: appointments Users can update appointments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update appointments in their clinic" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id"))) WITH CHECK ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: billings Users can update billings in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update billings in their clinic" ON "public"."billings" FOR UPDATE USING (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."clinic_id" = "public"."get_user_clinic_id"()))));



--
-- Name: patient_files Users can update files in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update files in their clinic" ON "public"."patient_files" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: invoices Users can update invoices in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update invoices in their clinic" ON "public"."invoices" FOR UPDATE USING (("clinic_id" = "public"."get_user_clinic_id"()));



--
-- Name: patient_notes Users can update notes in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update notes in their clinic" ON "public"."patient_notes" FOR UPDATE TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



--
-- Name: messages Users can update their own messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own messages" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "sender_id"));



--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



--
-- Name: automation_settings Users can update their own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own settings" ON "public"."automation_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



--
-- Name: treatments Users can update treatments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update treatments in their clinic" ON "public"."treatments" FOR UPDATE USING (("clinic_id" = "public"."get_user_clinic_id"()));



--
-- Name: appointments Users can view appointments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view appointments in their clinic" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id")));



--
-- Name: patient_files Users can view files in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view files in their clinic" ON "public"."patient_files" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id") AND ("deleted_at" IS NULL)));



--
-- Name: invoices Users can view invoices in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view invoices in their clinic" ON "public"."invoices" FOR SELECT USING (("clinic_id" = "public"."get_user_clinic_id"()));



--
-- Name: patient_notes Users can view notes in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view notes in their clinic" ON "public"."patient_notes" FOR SELECT TO "authenticated" USING ((("clinic_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'clinic_id'::"text"))::"uuid") AND "public"."is_clinic_member"("clinic_id") AND "public"."check_subscription_active"("clinic_id") AND ("deleted_at" IS NULL)));



--
-- Name: clinics Users can view their own clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own clinic" ON "public"."clinics" FOR SELECT USING ((("id" IN ( SELECT "profiles"."clinic_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("owner_id" = "auth"."uid"())));



--
-- Name: messages Users can view their own messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own messages" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



--
-- Name: automation_settings Users can view their own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own settings" ON "public"."automation_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



--
-- Name: treatments Users can view treatments in their clinic; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view treatments in their clinic" ON "public"."treatments" FOR SELECT USING (("clinic_id" = "public"."get_user_clinic_id"()));



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

GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";



--
-- Name: TYPE "app_role"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE "public"."app_role" TO "authenticated";



--
-- Name: TYPE "user_status"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TYPE "public"."user_status" TO "authenticated";



--
-- Name: FUNCTION "log_patient_view"("p_patient_id" "uuid"); Type: ACL; Schema: logs; Owner: postgres
--

GRANT ALL ON FUNCTION "logs"."log_patient_view"("p_patient_id" "uuid") TO "authenticated";



--
-- Name: FUNCTION "accept_clinic_invitation"("p_token" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."accept_clinic_invitation"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."accept_clinic_invitation"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."accept_clinic_invitation"("p_token" "text") TO "service_role";



--
-- Name: FUNCTION "archive_clinic"("target_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."archive_clinic"("target_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."archive_clinic"("target_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "check_subscription_active"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."check_subscription_active"("check_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "cleanup_soft_deleted_records"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cleanup_soft_deleted_records"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."cleanup_soft_deleted_records"() TO "service_role";



--
-- Name: FUNCTION "create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."create_tenant_clinic"("clinic_name" "text", "clinic_address" "text", "clinic_phone" "text") TO "service_role";



--
-- Name: FUNCTION "custom_access_token_hook"("event" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



--
-- Name: FUNCTION "enforce_patient_clinical_privileges"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."enforce_patient_clinical_privileges"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."enforce_patient_clinical_privileges"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."enforce_patient_clinical_privileges"() TO "service_role";



--
-- Name: FUNCTION "get_checkout_payment_methods"("p_billing_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_checkout_payment_methods"("p_billing_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "get_clinic_member_role"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_clinic_member_role"("check_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "get_family_unit_with_stats"("p_patient_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_family_unit_with_stats"("p_patient_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_family_unit_with_stats"("p_patient_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_family_unit_with_stats"("p_patient_id" "uuid") TO "service_role";



--
-- Name: TABLE "patients"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."patients" TO "anon";

GRANT ALL ON TABLE "public"."patients" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."patients" TO "authenticated";



--
-- Name: FUNCTION "get_patient_profile_secure"("p_patient_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_patient_profile_secure"("p_patient_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_patient_profile_secure"("p_patient_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_patient_profile_secure"("p_patient_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer, "p_time_filter" "text", "p_badge_filter" "text", "p_group_by_family" boolean, "p_patient_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer, "p_time_filter" "text", "p_badge_filter" "text", "p_group_by_family" boolean, "p_patient_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer, "p_time_filter" "text", "p_badge_filter" "text", "p_group_by_family" boolean, "p_patient_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_patients_with_stats"("p_clinic_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer, "p_time_filter" "text", "p_badge_filter" "text", "p_group_by_family" boolean, "p_patient_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "get_user_clinic_id"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_user_clinic_id"() TO "service_role";



--
-- Name: FUNCTION "guard_patient_clinical_insert"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."guard_patient_clinical_insert"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."guard_patient_clinical_insert"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."guard_patient_clinical_insert"() TO "service_role";



--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



--
-- Name: FUNCTION "handle_verified_clinic_creation"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."handle_verified_clinic_creation"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."handle_verified_clinic_creation"() TO "service_role";



--
-- Name: FUNCTION "is_clinic_member"("check_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_clinic_member"("check_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "log_data_rights_request"("p_request_type" "text", "p_details" "jsonb", "p_legal_basis" "text", "p_retention_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."log_data_rights_request"("p_request_type" "text", "p_details" "jsonb", "p_legal_basis" "text", "p_retention_note" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."log_data_rights_request"("p_request_type" "text", "p_details" "jsonb", "p_legal_basis" "text", "p_retention_note" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_data_rights_request"("p_request_type" "text", "p_details" "jsonb", "p_legal_basis" "text", "p_retention_note" "text") TO "service_role";



--
-- Name: FUNCTION "log_profile_changes"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."log_profile_changes"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_profile_changes"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_profile_changes"() TO "service_role";



--
-- Name: FUNCTION "prevent_profile_privilege_escalation"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "service_role";



--
-- Name: FUNCTION "protect_data_rights_requests"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."protect_data_rights_requests"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."protect_data_rights_requests"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."protect_data_rights_requests"() TO "service_role";



--
-- Name: FUNCTION "purge_clinic_data"("target_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."purge_clinic_data"("target_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."remove_clinic_member"("p_target_user_id" "uuid", "p_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "seed_default_services"("target_clinic_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."seed_default_services"("target_clinic_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."seed_default_services"("target_clinic_id" "uuid") TO "service_role";



--
-- Name: FUNCTION "set_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



--
-- Name: FUNCTION "sync_hcu033_form_clinic_id"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_hcu033_form_clinic_id"() TO "anon";

GRANT ALL ON FUNCTION "public"."sync_hcu033_form_clinic_id"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."sync_hcu033_form_clinic_id"() TO "service_role";



--
-- Name: FUNCTION "update_billing_status"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_billing_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_billing_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_billing_status"() TO "service_role";



--
-- Name: FUNCTION "update_patient_odontogram_summary"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_patient_odontogram_summary"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_patient_odontogram_summary"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_patient_odontogram_summary"() TO "service_role";



--
-- Name: TABLE "access_audit"; Type: ACL; Schema: logs; Owner: postgres
--

GRANT SELECT,INSERT ON TABLE "logs"."access_audit" TO "authenticated";



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

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."clinic_members" TO "anon";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."clinic_members" TO "authenticated";

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

GRANT SELECT ON TABLE "public"."clinics" TO "supabase_auth_admin";



--
-- Name: TABLE "dashboard_stats_view"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."dashboard_stats_view" TO "anon";

GRANT ALL ON TABLE "public"."dashboard_stats_view" TO "authenticated";

GRANT ALL ON TABLE "public"."dashboard_stats_view" TO "service_role";



--
-- Name: TABLE "data_rights_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."data_rights_requests" TO "anon";

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."data_rights_requests" TO "authenticated";

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
-- Name: TABLE "patient_stats_view"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."patient_stats_view" TO "anon";

GRANT ALL ON TABLE "public"."patient_stats_view" TO "authenticated";

GRANT ALL ON TABLE "public"."patient_stats_view" TO "service_role";



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
-- Name: TABLE "profile_audit_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profile_audit_log" TO "service_role";

GRANT SELECT ON TABLE "public"."profile_audit_log" TO "authenticated";



--
-- Name: SEQUENCE "profile_audit_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."profile_audit_log_id_seq" TO "service_role";



--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."profiles" TO "supabase_auth_admin";



--
-- Name: COLUMN "profiles"."full_name"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."avatar_url"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."phone"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."address"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("address") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."specialization"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("specialization") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."license_number"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("license_number") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."bio"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("bio") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: COLUMN "profiles"."updated_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



--
-- Name: TABLE "recall_queue"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."recall_queue" TO "anon";

GRANT ALL ON TABLE "public"."recall_queue" TO "authenticated";

GRANT ALL ON TABLE "public"."recall_queue" TO "service_role";



--
-- Name: TABLE "receptionist_patient_view"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."receptionist_patient_view" TO "anon";

GRANT ALL ON TABLE "public"."receptionist_patient_view" TO "authenticated";

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
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER on_auth_user_verified BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_verified_clinic_creation();
CREATE POLICY "Anyone can update an avatar" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Anyone can upload an avatar" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Authenticated users update doctor avatars" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" WITH CHECK (((bucket_id = 'doctor-avatars'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Authenticated users upload doctor avatars" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((bucket_id = 'doctor-avatars'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Avatar images are publicly accessible" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Owners can delete their logos" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Owners can update their logos" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Owners can upload logos" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Public Access to Clinic Logos" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((bucket_id = 'clinic-branding'::text));
CREATE POLICY "Public Access to Doctor Avatars" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'doctor-avatars'::text));
CREATE POLICY "Tenant isolated delete for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated delete for patient-files" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated delete for receipts" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (((get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'admin'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND (get_clinic_member_role(b.clinic_id) = ANY (ARRAY['clinic_owner'::text, 'admin'::text]))))))));
CREATE POLICY "Tenant isolated insert for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated insert for receipts" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated read for patient-files" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated select for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated select for receipts" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated update for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated update for patient-files" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))) WITH CHECK (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated update for receipts" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated upload for patient-files" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));

SET LOCAL check_function_bodies=true; REVOKE USAGE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
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
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'GATE3_BASELINE_POSTCONTRACT_REFUSED' USING ERRCODE='P0001'; END IF; END $catalog_guard$;COMMIT;