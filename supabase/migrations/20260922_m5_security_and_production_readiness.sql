-- ============================================================================
-- Migration: 20260922_m5_security_and_production_readiness.sql
-- Description: Milestone 5 - Comprehensive Security & Production Readiness Remediation
-- Covers:
--   - PR-01: Fix definer function self-bypass (prevent_profile_privilege_escalation,
--            enforce_patient_clinical_privileges, guard_patient_clinical_insert, get_patients_with_stats).
--            Restrict client writes to safe profile columns, drop dangerous self-insert policy.
--            Preserve onboarding, invitation acceptance, and member removal via authorized context.
--   - PR-02: Hardened, tenant-isolated get_family_unit_with_stats RPC (revoke anon execution,
--            enforce caller active membership, scope all subqueries to authorized clinic).
--   - PR-03: Make patient-avatars and receipts private storage buckets with tenant-isolated RLS.
--            Enforce MIME types and size limits. Support both partitioned and legacy paths.
--   - PR-04: Fix patient count query runtime crash (SQLSTATE 42803) in get_patients_with_stats.
--   - PR-05: Enforce status = 'active' in is_clinic_member. Drop superseded permissive patient policies.
--            Explicitly clear claims in custom_access_token_hook when user is offboarded.
--   - Operational: Restrict cleanup_soft_deleted_records to service_role, set explicit search_path
--            on all functions, and enforce immutability on data_rights_requests audit log.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PR-05: Canonical Active Membership Check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR check_clinic_id IS NULL THEN
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

REVOKE ALL ON FUNCTION public.is_clinic_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(uuid) TO authenticated, service_role;


-- ============================================================================
-- 2. PR-01: Profile Privilege Escalation & Column-Level Security
-- ============================================================================

-- 2.1 Drop dangerous self-insert policies that allow arbitrary role/clinic assignment
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 2.2 Profiles are inserted exclusively by handle_new_user trigger or onboarding procedures
REVOKE INSERT ON public.profiles FROM authenticated, anon, public;

-- 2.3 Restrict client UPDATE permissions to safe demographic and preference columns
REVOKE UPDATE ON public.profiles FROM authenticated, anon, public;
GRANT UPDATE (full_name, avatar_url, phone, address, specialization, license_number, bio, updated_at) 
  ON public.profiles TO authenticated;

-- 2.4 Ensure clean self-update RLS policy
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2.5 Security Invoker Trigger Function to prevent privilege escalation
-- Note: Must NOT be SECURITY DEFINER, so current_user is the actual caller role.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon;


-- ============================================================================
-- 3. PR-01: Update Lifecycle RPCs with Authorized Internal Context
-- ============================================================================

-- 3.1 remove_clinic_member: Sets authorized context to allow clearing profile.clinic_id
CREATE OR REPLACE FUNCTION public.remove_clinic_member(
  p_target_user_id uuid,
  p_clinic_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.remove_clinic_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid, uuid) TO authenticated, service_role;

-- 3.2 accept_clinic_invitation: Sets authorized context to allow updating profile
CREATE OR REPLACE FUNCTION public.accept_clinic_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.accept_clinic_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_clinic_invitation(text) TO authenticated, service_role;

-- 3.3 handle_verified_clinic_creation: Sets authorized context for onboarding
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 4. PR-01: Fix Patient Clinical Privileges Triggers (No Definer Self-Bypass)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
CREATE TRIGGER trg_enforce_patient_clinical_privileges
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_patient_clinical_privileges();

REVOKE ALL ON FUNCTION public.enforce_patient_clinical_privileges() FROM PUBLIC, anon;

-- 4.2 Guard against non-clinical synthetic charting initialization on INSERT
CREATE OR REPLACE FUNCTION public.guard_patient_clinical_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_guard_patient_clinical_insert ON public.patients;
CREATE TRIGGER trg_guard_patient_clinical_insert
  BEFORE INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_patient_clinical_insert();

REVOKE ALL ON FUNCTION public.guard_patient_clinical_insert() FROM PUBLIC, anon;


-- ============================================================================
-- 5. PR-02: Hardened get_family_unit_with_stats RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_family_unit_with_stats(p_patient_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  family_relationship text,
  is_family_head boolean,
  family_representative_id uuid,
  appointments_count bigint,
  total_billed numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

-- Strictly revoke anonymous and public access
REVOKE ALL ON FUNCTION public.get_family_unit_with_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_unit_with_stats(uuid) TO authenticated, service_role;


-- ============================================================================
-- 6. PR-04: Fix get_patients_with_stats (SQLSTATE 42803 & Definer Bypass)
-- ============================================================================

-- Dynamically drop all existing overloaded signatures of get_patients_with_stats
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';' AS drop_cmd
        FROM pg_proc
        WHERE proname = 'get_patients_with_stats' 
          AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE r.drop_cmd;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_patients_with_stats(
  p_clinic_id uuid,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_time_filter text DEFAULT 'all',
  p_badge_filter text DEFAULT 'all',
  p_group_by_family boolean DEFAULT false,
  p_patient_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  cedula text,
  medical_record_number text,
  date_of_birth date,
  gender text,
  address text,
  city text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  allergies jsonb,
  medications jsonb,
  medical_conditions jsonb,
  medical_history jsonb,
  clinical_notes text,
  blood_type text,
  has_diabetes boolean,
  has_hypertension boolean,
  has_heart_disease boolean,
  is_smoker boolean,
  is_pregnant boolean,
  preferred_contact_method text,
  recall_months integer,
  internal_notes text,
  account_balance numeric,
  avatar_url text,
  family_representative_id uuid,
  family_relationship text,
  is_family_head boolean,
  family_member_count bigint,
  appointments_count bigint,
  total_billed numeric,
  last_visit timestamptz,
  next_appointment timestamptz,
  last_treatment_note text,
  odontogram_state jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

    -- Raise exception if caller does not belong to the target clinic
    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Access denied: Caller does not belong to the requested clinic.'
        USING ERRCODE = '42501';
    END IF;

    -- Role authorization: Only authorized clinic roles may view clinical patient data
    IF v_caller_role NOT IN ('clinic_owner', 'admin', 'doctor', 'receptionist') THEN
      RAISE EXCEPTION 'Access denied: Caller role % is not authorized to access clinical statistics.', v_caller_role
        USING ERRCODE = '42501';
    END IF;

    -- Subscription check: clinic must have active subscription or active trial
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
    pat.email,
    pat.phone,
    pat.cedula,
    pat.medical_record_number,
    pat.date_of_birth,
    pat.gender,
    pat.address,
    pat.city,
    pat.status,
    pat.created_at,
    pat.updated_at,
    pat.allergies,
    pat.medications,
    pat.medical_conditions,
    pat.medical_history,
    pat.clinical_notes,
    pat.blood_type,
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
    v_total::bigint AS total_count
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

REVOKE ALL ON FUNCTION public.get_patients_with_stats(uuid, text, integer, integer, text, text, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patients_with_stats(uuid, text, integer, integer, text, text, boolean, uuid) TO authenticated, service_role;


-- ============================================================================
-- 7. PR-05: Patients Table RLS Consolidation
-- ============================================================================

-- Drop all superseded and permissive legacy policies
DROP POLICY IF EXISTS "Users can view patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can view patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can delete patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Admins can manage patients" ON public.patients;

-- Canonical active membership policies for patients
CREATE POLICY "Active clinic members can view patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  );

CREATE POLICY "Active clinic members can insert patients"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  );

CREATE POLICY "Active clinic members can update patients"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  )
  WITH CHECK (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  );

CREATE POLICY "Clinic owners can delete patients in their clinic"
  ON public.patients FOR DELETE
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  );


-- ============================================================================
-- 8. PR-05: Token Hook Revocation & Obsolete Claims Clearance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin, service_role;


-- ============================================================================
-- 9. PR-03: Storage Buckets Privacy & Tenant Isolation (patient-avatars & receipts)
-- ============================================================================

-- 9.1 Make patient-avatars bucket private with strict MIME and size limits
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'patient-avatars';

-- Drop legacy/public policies on storage.objects for patient-avatars
DROP POLICY IF EXISTS "Public patient avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Public patient avatar select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated select for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated insert for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-avatars" ON storage.objects;

-- Tenant-isolated SELECT (Read / Download via Signed URL)
CREATE POLICY "Tenant isolated select for patient-avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (
    -- Path format A: {clinic_id}/{patient_id}/...
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
    )
    OR
    -- Path format B: legacy format checked against authorized clinic member
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE (
        (storage.foldername(name))[1] = p.id::text
        OR name LIKE p.id::text || '-%'
      )
      AND p.deleted_at IS NULL
      AND public.is_clinic_member(p.clinic_id)
    )
  )
);

-- Tenant-isolated INSERT (Upload)
CREATE POLICY "Tenant isolated insert for patient-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE (
        (storage.foldername(name))[1] = p.id::text
        OR name LIKE p.id::text || '-%'
      )
      AND p.deleted_at IS NULL
      AND public.is_clinic_member(p.clinic_id)
    )
  )
);

-- Tenant-isolated UPDATE / DELETE (Doctor/Owner only)
CREATE POLICY "Tenant isolated update for patient-avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE (
        (storage.foldername(name))[1] = p.id::text
        OR name LIKE p.id::text || '-%'
      )
      AND p.deleted_at IS NULL
      AND public.is_clinic_member(p.clinic_id)
    )
  )
);

CREATE POLICY "Tenant isolated delete for patient-avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE (
        (storage.foldername(name))[1] = p.id::text
        OR name LIKE p.id::text || '-%'
      )
      AND p.deleted_at IS NULL
      AND public.is_clinic_member(p.clinic_id)
    )
  )
);

-- 9.2 Secure receipts bucket: private, 10MB limit, tenant-isolated
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'receipts';

DROP POLICY IF EXISTS "Public receipts access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated select for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated insert for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for receipts" ON storage.objects;

CREATE POLICY "Tenant isolated select for receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated insert for receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated update for receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated delete for receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
);


-- ============================================================================
-- 10. Operational Hardening: Immutability & Definitive Search Paths
-- ============================================================================

-- 10.1 Restrict operational maintenance RPC to service_role
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete notifications older than 90 days
  DELETE FROM public.notifications 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleanup run at %s. Safe mode active.', NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_soft_deleted_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_soft_deleted_records() TO service_role;

-- 10.2 Set search_path on handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 10.3 Enforce immutable request history on data_rights_requests
CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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
  IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Immutable field: created_at cannot be modified.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.requested_by_email IS DISTINCT FROM OLD.requested_by_email) THEN
    RAISE EXCEPTION 'Immutable field: requested_by_email cannot be modified.' USING ERRCODE = '42501';
  END IF;

  -- When status transitions to completed or rejected, set resolved_by and resolved_at
  IF (NEW.status IN ('completed', 'rejected') AND OLD.status NOT IN ('completed', 'rejected')) THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_data_rights_requests ON public.data_rights_requests;
CREATE TRIGGER trg_protect_data_requests_immutability
  BEFORE UPDATE ON public.data_rights_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_data_rights_requests();

REVOKE ALL ON FUNCTION public.protect_data_rights_requests() FROM PUBLIC, anon;

COMMIT;
