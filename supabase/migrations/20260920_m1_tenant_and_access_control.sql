-- ============================================================================
-- Migration: 20260920_m1_tenant_and_access_control.sql
-- Description: Milestone 1 - Tenant Boundary & Core Access Control (SEC-01 to SEC-06)
-- Covers:
--   - SEC-01: Hardened handle_verified_clinic_creation trigger (gen_random_uuid server-side,
--             ignore client pending_clinic.id, no ON CONFLICT DO NOTHING, gate elevation on success)
--   - SEC-02: Profiles RLS hardening (drop global admin update/delete, restrict self-update,
--             prevent_profile_privilege_escalation trigger, remove_clinic_member RPC)
--   - SEC-03: clinic_members RLS hardening (drop self-insert, non-recursive SELECT,
--             status column, accept_clinic_invitation RPC, invitation auto-enrollment in trigger)
--   - SEC-04: Canonical get_patients_with_stats RPC with strict caller tenant & role auth
--   - SEC-05: Storage bucket patient-files RLS policies (tenant-partitioned paths, doctor/owner delete)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SEC-03: clinic_members Hardening & Schema Alignment
-- ============================================================================

-- 1.1 Ensure status column exists on clinic_members
ALTER TABLE public.clinic_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
UPDATE public.clinic_members SET status = 'active' WHERE status IS NULL;

-- 1.2 Fast lookup index for auth & membership verification
CREATE INDEX IF NOT EXISTS idx_clinic_members_auth_lookup 
  ON public.clinic_members (user_id, clinic_id, status);

-- 1.3 Drop dangerous self-insert policy that enabled arbitrary clinic joining
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.clinic_members;

-- 1.4 Drop conflicting legacy policies to prevent permissive OR accumulation
DROP POLICY IF EXISTS "Users can view their memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Clinic owners can view their clinic memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Users and owners can view clinic memberships" ON public.clinic_members;

-- 1.5 Ensure RLS is active
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- 1.6 Revoke direct client mutation permissions
REVOKE INSERT, UPDATE, DELETE ON public.clinic_members FROM authenticated, anon, public;
GRANT SELECT ON public.clinic_members TO authenticated;

-- 1.7 Create safe, non-recursive SELECT policy for clinic_members
CREATE POLICY "Users and owners can view clinic memberships"
  ON public.clinic_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.clinics c 
      WHERE c.id = clinic_members.clinic_id 
        AND c.owner_id = auth.uid()
    )
  );

-- 1.8 Idempotent backfill: Ensure every profile and clinic owner has a clinic_members record
INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
SELECT owner_id, id, 'clinic_owner', 'active'
FROM public.clinics
WHERE owner_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO UPDATE SET status = 'active';

INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
SELECT p.id, p.clinic_id, COALESCE(p.role::text, 'doctor'), 'active'
FROM public.profiles p
WHERE p.clinic_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO NOTHING;


-- ============================================================================
-- 2. SEC-02: Profiles Table RLS Hardening & Privilege Escalation Trigger
-- ============================================================================

-- 2.1 Drop global admin backdoor policies (no tenant check)
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles." ON public.profiles;

-- 2.2 Consolidate self-update policy
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2.3 Scope clinic owner updates/deletes strictly to their own clinic
DROP POLICY IF EXISTS "Clinic owners can update members in their clinic" ON public.profiles;
CREATE POLICY "Clinic owners can update members in their clinic"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  WITH CHECK (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  );

DROP POLICY IF EXISTS "Clinic owners can delete members in their clinic" ON public.profiles;
CREATE POLICY "Clinic owners can delete members in their clinic"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
    AND id != auth.uid()
  );

-- 2.4 Trigger to block non-service-role mutations of role, clinic_id, and status
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role and internal PostgreSQL administrative users
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
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

-- 2.5 Secure helper RPC for authorized member removal
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

GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid, uuid) TO authenticated;


-- ============================================================================
-- 3. SEC-01 & SEC-03: Hardened handle_verified_clinic_creation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS TRIGGER AS $$
DECLARE
  pending_data JSONB;
  new_clinic_id UUID;
  inserted_clinic_id UUID;
  v_invitation public.clinic_invitations%ROWTYPE;
BEGIN
  -- Trigger executes BEFORE UPDATE on auth.users when email transitions from unconfirmed to confirmed
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    pending_data := NEW.raw_user_meta_data->'pending_clinic';
    
    -- ------------------------------------------------------------------------
    -- CASE A: New Clinic Registration (SEC-01)
    -- ------------------------------------------------------------------------
    IF pending_data IS NOT NULL THEN
      
      -- Guard: If user already has an assigned clinic, strip metadata and skip
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id AND clinic_id IS NOT NULL) THEN
         NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';
         RETURN NEW;
      END IF;

      -- SEC-01 FIX: Discard any client-supplied ID (pending_data->>'id').
      -- Cryptographic fresh UUID is strictly generated on the server.
      new_clinic_id := gen_random_uuid();

      -- Ensure profile record exists to satisfy foreign key (clinics.owner_id -> profiles.id)
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

      -- 1. Create Clinic with server-generated UUID (no ON CONFLICT DO NOTHING)
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

      -- SEC-01 Invariant: Profile and metadata elevation ONLY occurs if clinic insertion succeeded
      IF inserted_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Clinic creation failed: clinic insertion returned no identifier for user %', NEW.id
          USING ERRCODE = 'P0001';
      END IF;

      -- 2. Bind Profile to newly created clinic
      UPDATE public.profiles
      SET 
        clinic_id = inserted_clinic_id,
        role = 'clinic_owner'::public.app_role,
        status = 'active'::public.user_status,
        updated_at = now()
      WHERE id = NEW.id;
        
      -- 3. Register owner membership in clinic_members
      INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
      VALUES (NEW.id, inserted_clinic_id, 'clinic_owner', 'active')
      ON CONFLICT (user_id, clinic_id) DO UPDATE
        SET role = 'clinic_owner', status = 'active';

      -- 4. Update Auth Metadata (app_metadata) so issued JWT contains claims immediately
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

      -- 5. Clear pending clinic metadata
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';

    -- ------------------------------------------------------------------------
    -- CASE B: Staff Member Email Confirmation via Verified Invitation (SEC-03)
    -- ------------------------------------------------------------------------
    ELSIF NEW.email IS NOT NULL THEN
      -- Search for an active, unexpired invitation for this verified email
      SELECT * INTO v_invitation
      FROM public.clinic_invitations
      WHERE LOWER(email) = LOWER(NEW.email)
        AND status = 'pending'
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_invitation.id IS NOT NULL THEN
        -- 1. Ensure profile exists with invited role
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

        -- 2. Update profile with invited clinic and role
        UPDATE public.profiles
        SET 
          clinic_id = v_invitation.clinic_id,
          role = v_invitation.role::public.app_role,
          status = 'active'::public.user_status,
          updated_at = now()
        WHERE id = NEW.id;

        -- 3. Enroll member into clinic_members
        INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
        VALUES (NEW.id, v_invitation.clinic_id, v_invitation.role, 'active')
        ON CONFLICT (user_id, clinic_id) DO UPDATE
          SET role = EXCLUDED.role, status = 'active';

        -- 4. Update Auth Metadata for JWT
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

        -- 5. Mark invitation accepted
        UPDATE public.clinic_invitations
        SET status = 'accepted'
        WHERE id = v_invitation.id;
      END IF;

    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.handle_verified_clinic_creation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_verified_clinic_creation();


-- ============================================================================
-- 4. SEC-03: Authenticated Invitation Acceptance RPC
-- ============================================================================

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
  -- 1. Enforce session authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Retrieve caller's verified email from auth.users
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'User record not found.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Match pending, non-expired invitation by token AND caller email
  SELECT * INTO v_invitation
  FROM public.clinic_invitations
  WHERE token = p_token
    AND LOWER(email) = LOWER(v_caller_email)
    AND status = 'pending'
    AND expires_at > now();

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or unauthorized invitation token.'
      USING ERRCODE = 'P0002';
  END IF;

  -- 4. Enroll member into clinic_members
  INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
  VALUES (auth.uid(), v_invitation.clinic_id, v_invitation.role, 'active')
  ON CONFLICT (user_id, clinic_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

  -- 5. Update user profile to reflect clinic assignment
  UPDATE public.profiles
  SET 
    clinic_id = v_invitation.clinic_id,
    role = v_invitation.role::public.app_role,
    status = 'active'::public.user_status,
    updated_at = now()
  WHERE id = auth.uid();

  -- 6. Mark invitation accepted
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

REVOKE ALL ON FUNCTION public.accept_clinic_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_clinic_invitation(TEXT) TO authenticated;


-- ============================================================================
-- 5. SEC-04: Canonical get_patients_with_stats RPC with Strict Tenant & Role Auth
-- ============================================================================

-- Dynamically drop all existing overloaded signatures of get_patients_with_stats
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS prod
        FROM pg_proc 
        WHERE proname = 'get_patients_with_stats' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.prod;
        RAISE NOTICE 'Dropped function %', r.prod;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_patients_with_stats(
  p_clinic_id uuid,
  p_search text DEFAULT '',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_time_filter text DEFAULT 'all',
  p_badge_filter text DEFAULT 'all',
  p_group_by_family boolean DEFAULT false,
  p_patient_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  cedula text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  birth_date date,
  gender text,
  patient_status text,
  occupation text,
  guardian_name text,
  referral_source text,
  referred_by text,
  clinical_notes text,
  medical_record_number text,
  tags text[],
  emergency_contact text,
  emergency_phone text,
  allergies text,
  medications text,
  medical_conditions text,
  insurance_provider text,
  policy_number text,
  blood_type text,
  marital_status text,
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
  -- Step A: Determine if caller is trusted service_role
  -- -------------------------------------------------------------
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
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
    )
  ORDER BY
    CASE WHEN p_group_by_family THEN pat.family_representative_id END NULLS LAST,
    pat.created_at DESC
  LIMIT v_effective_limit
  OFFSET v_effective_offset;

  -- -------------------------------------------------------------
  -- Step E: Return Patient Rows with Aggregates
  -- -------------------------------------------------------------
  RETURN QUERY
  SELECT
    pat.id,
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
    COALESCE(pat.status, 'active')::text AS patient_status,
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

REVOKE ALL ON FUNCTION public.get_patients_with_stats FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patients_with_stats TO authenticated, service_role;


-- ============================================================================
-- 6. SEC-05: Storage Bucket 'patient-files' Tenant & Role Isolation
-- ============================================================================

-- 6.1 Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets
SET public = false
WHERE id = 'patient-files';

-- 6.2 Drop open/legacy storage policies
DROP POLICY IF EXISTS "Users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-files" ON storage.objects;

-- 6.3 Tenant-isolated SELECT (Read / Download via Signed URL)
CREATE POLICY "Tenant isolated read for patient-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- 6.4 Tenant-isolated INSERT (Upload)
CREATE POLICY "Tenant isolated upload for patient-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- 6.5 Tenant-isolated UPDATE (Upsert support)
CREATE POLICY "Tenant isolated update for patient-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
)
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- 6.6 Tenant & Role-isolated DELETE
CREATE POLICY "Tenant isolated delete for patient-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('clinic_owner', 'doctor')
);

COMMIT;
