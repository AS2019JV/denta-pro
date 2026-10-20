

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
