-- ============================================================================
-- Migration: 20260920_security_remediation_consolidated.sql
-- Description: Master Forward Consolidated Security Remediation & LOPDP Alignment
-- Author: teamwork_preview_worker_m4 (Milestone 4: R4-A & R4-B)
--
-- Authoritative Scope:
--   - R4-A: Consolidation of all security policies and defenses across M1, M2, and M3
--           into a single, clean, idempotent forward migration.
--           Explicitly drops all conflicting legacy permissive policies across
--           profiles, clinic_members, patients, prescriptions, services,
--           payment_methods, hcu033_forms, and storage.objects to eradicate
--           permissive boolean OR accumulation bypasses.
--   - R4-B: Statutory LOPDP Citation Alignment & Medical Custody Persistence:
--           Creates public.data_rights_requests table for persisting data rights
--           requests under Ecuadorian LOPDP (Art. 17 Portability, Art. 15 Elimination)
--           and reconciling medical custody requirements under Ley Orgánica de Salud
--           Art. 7 and MSP technical norms (5-10 year clinical history retention).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. EXPLICIT PURGE OF CONFLICTING LEGACY PERMISSIVE POLICIES
--    Eliminates boolean OR policy accumulation across all remediated entities
-- ============================================================================

-- 0.1 profiles table legacy policies
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Clinic owners can update members in their clinic" ON public.profiles;
DROP POLICY IF EXISTS "Clinic owners can delete members in their clinic" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who created them." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by clinic members" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by same clinic members" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.profiles;

-- 0.2 clinic_members table legacy policies
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.clinic_members;
DROP POLICY IF EXISTS "Users can view their memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Clinic owners can view their clinic memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Users and owners can view clinic memberships" ON public.clinic_members;
DROP POLICY IF EXISTS "Members are viewable by clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Clinic owners can manage members" ON public.clinic_members;

-- 0.3 patients table legacy policies
DROP POLICY IF EXISTS "Users can view patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can view patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can delete patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Admins can manage patients" ON public.patients;
DROP POLICY IF EXISTS "Active clinic members can view patients" ON public.patients;
DROP POLICY IF EXISTS "Active clinic members can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Active clinic members can update patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic owners can delete patients in their clinic" ON public.patients;

-- 0.4 prescriptions table legacy policies
DROP POLICY IF EXISTS "Prescriptions are viewable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are insertable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are updatable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are deletable by clinic owners" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can update their prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Users can view prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Users can insert prescriptions" ON public.prescriptions;

-- 0.5 services table legacy policies
DROP POLICY IF EXISTS "Admins can insert services." ON public.services;
DROP POLICY IF EXISTS "Admins can update services." ON public.services;
DROP POLICY IF EXISTS "Admins can delete services." ON public.services;
DROP POLICY IF EXISTS "Owners can manage services" ON public.services;
DROP POLICY IF EXISTS "Users can view services in their clinic" ON public.services;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Clinic members can view services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can insert services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can update services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can delete services" ON public.services;

-- 0.6 payment_methods table legacy policies
DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic members can view payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic members can view payment methods for their clinic" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can insert payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can update payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can delete payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Public can view active payment methods for checkout" ON public.payment_methods;
DROP POLICY IF EXISTS "Allow checkout viewing of active payment methods" ON public.payment_methods;

-- 0.7 hcu033_forms table legacy policies
DROP POLICY IF EXISTS "Users can view forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can insert forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can update forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can insert hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can update hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic owners can delete hcu033_forms" ON public.hcu033_forms;

-- 0.8 storage.objects legacy policies for patient-files, patient-avatars, and receipts
DROP POLICY IF EXISTS "Users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated select for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated insert for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated select for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated insert for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for receipts" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for receipts" ON storage.objects;

-- 0.9 data_rights_requests policies (safe conditional check)
DO $$
BEGIN
  IF to_regclass('public.data_rights_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests';
  END IF;
END $$;


-- ============================================================================
-- 1. SEC-01 & SEC-03: CLINIC ONBOARDING & MEMBERSHIP ENROLLMENT HARDENING
-- ============================================================================

-- 1.1 Align clinic_members schema
ALTER TABLE public.clinic_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
UPDATE public.clinic_members SET status = 'active' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_members_auth_lookup 
  ON public.clinic_members (user_id, clinic_id, status);

ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- Revoke direct client mutation permissions on membership table
REVOKE INSERT, UPDATE, DELETE ON public.clinic_members FROM authenticated, anon, public;
GRANT SELECT ON public.clinic_members TO authenticated;

-- Non-recursive SELECT policy for clinic memberships
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

-- Idempotent membership backfill
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

-- 1.2 Hardened handle_verified_clinic_creation trigger function (SEC-01 & SEC-03)
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS TRIGGER AS $$
DECLARE
  pending_data JSONB;
  new_clinic_id UUID;
  inserted_clinic_id UUID;
  v_invitation public.clinic_invitations%ROWTYPE;
BEGIN
  -- Trigger executes BEFORE UPDATE on auth.users when email transitions to confirmed
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

      -- Create Clinic with server-generated UUID (no ON CONFLICT DO NOTHING)
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

      -- Bind Profile to newly created clinic
      UPDATE public.profiles
      SET 
        clinic_id = inserted_clinic_id,
        role = 'clinic_owner'::public.app_role,
        status = 'active'::public.user_status,
        updated_at = now()
      WHERE id = NEW.id;
        
      -- Register owner membership in clinic_members
      INSERT INTO public.clinic_members (user_id, clinic_id, role, status)
      VALUES (NEW.id, inserted_clinic_id, 'clinic_owner', 'active')
      ON CONFLICT (user_id, clinic_id) DO UPDATE
        SET role = 'clinic_owner', status = 'active';

      -- Update Auth Metadata (app_metadata) so issued JWT contains claims immediately
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

      -- Clear pending clinic metadata
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

-- 1.3 Authenticated Invitation Acceptance RPC (SEC-03)
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
-- 2. SEC-02: PROFILES TABLE PRIVILEGE ESCALATION GUARD & RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2.1 Self-update policy: User can only update their own row
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2.2 Clinic owner update policy scoped strictly to their own clinic
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

-- 2.3 Clinic owner delete policy scoped strictly to their own clinic
CREATE POLICY "Clinic owners can delete members in their clinic"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
    AND id != auth.uid()
  );

-- 2.4 SELECT policy: Users can view their own profile and profiles of same clinic
CREATE POLICY "Profiles are viewable by same clinic members"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      clinic_id IS NOT NULL
      AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    )
  );

-- 2.5 Trigger to block non-service-role mutations of role, clinic_id, and status
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role and internal administrative contexts
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

-- 2.6 Helper RPC for authorized member removal
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

  SELECT EXISTS (
    SELECT 1 FROM public.clinics WHERE id = p_clinic_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM public.clinic_members WHERE clinic_id = p_clinic_id AND user_id = auth.uid() AND role = 'clinic_owner' AND status = 'active'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Access denied: Only clinic owners can remove team members.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove clinic owner from clinic.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET clinic_id = NULL
  WHERE id = p_target_user_id AND clinic_id = p_clinic_id;

  DELETE FROM public.clinic_members
  WHERE user_id = p_target_user_id AND clinic_id = p_clinic_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid, uuid) TO authenticated;


-- ============================================================================
-- 3. SEC-04: CANONICAL PATIENT STATISTICS RPC WITH STRICT TENANT & ROLE AUTH
-- ============================================================================

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
        RAISE NOTICE 'Dropped overloaded function %', r.prod;
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
  -- Determine if caller is trusted service_role
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    v_is_service_role := true;
  END IF;

  -- Authentication & Tenant Membership Authorization
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

    -- Deny if caller does not belong to target clinic
    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Access denied: Caller does not belong to the requested clinic.'
        USING ERRCODE = '42501';
    END IF;

    -- Role authorization
    IF v_caller_role NOT IN ('clinic_owner', 'admin', 'doctor', 'receptionist') THEN
      RAISE EXCEPTION 'Access denied: Caller role % is not authorized to access clinical statistics.', v_caller_role
        USING ERRCODE = '42501';
    END IF;

    -- Active subscription or trial check
    IF NOT public.check_subscription_active(p_clinic_id) THEN
      RAISE EXCEPTION 'Subscription inactive or expired for this clinic.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Bounded Pagination Limits
  v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 100);
  v_effective_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Total count for pagination
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

  -- Return rows
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
-- 4. SEC-05: STORAGE BUCKET 'patient-files' TENANT & ROLE ISOLATION
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets
SET public = false
WHERE id = 'patient-files';

CREATE POLICY "Tenant isolated read for patient-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

CREATE POLICY "Tenant isolated upload for patient-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

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

CREATE POLICY "Tenant isolated delete for patient-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('clinic_owner', 'doctor')
);


-- ============================================================================
-- 5. SEC-07: CLINICAL PRIVILEGE SEPARATION (PRESCRIPTIONS, HCU-033, PATIENTS)
-- ============================================================================

-- 5.1 Prescriptions table RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prescriptions are viewable by clinic members"
ON public.prescriptions FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

CREATE POLICY "Doctors and owners can insert prescriptions"
ON public.prescriptions FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND doctor_id = auth.uid()
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Doctors and owners can update their prescriptions"
ON public.prescriptions FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND (doctor_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner')
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND (doctor_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner')
);

CREATE POLICY "Prescriptions are deletable by clinic owners"
ON public.prescriptions FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  AND public.check_subscription_active(clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_doctor 
  ON public.prescriptions(clinic_id, doctor_id, patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;

-- 5.2 HCU-033 forms schema & RLS
ALTER TABLE public.hcu033_forms 
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;

UPDATE public.hcu033_forms h
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE h.patient_id = p.id AND h.clinic_id IS NULL;

ALTER TABLE public.hcu033_forms 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    SELECT p.clinic_id INTO NEW.clinic_id
    FROM public.patients p
    WHERE p.id = NEW.patient_id;
  END IF;

  IF NEW.doctor_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.doctor_id := auth.uid();
  END IF;

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

DROP TRIGGER IF EXISTS trg_sync_hcu033_form_clinic_id ON public.hcu033_forms;
CREATE TRIGGER trg_sync_hcu033_form_clinic_id
  BEFORE INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hcu033_form_clinic_id();

ALTER TABLE public.hcu033_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view hcu033_forms"
ON public.hcu033_forms FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  OR patient_id IN (
    SELECT id FROM public.patients 
    WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  )
);

CREATE POLICY "Clinical staff can insert hcu033_forms"
ON public.hcu033_forms FOR INSERT
TO authenticated
WITH CHECK (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    OR (
      clinic_id IS NULL AND patient_id IN (
        SELECT id FROM public.patients 
        WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
      )
    )
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND public.check_subscription_active(
    COALESCE(clinic_id, (SELECT p.clinic_id FROM public.patients p WHERE p.id = patient_id))
  )
);

CREATE POLICY "Clinical staff can update hcu033_forms"
ON public.hcu033_forms FOR UPDATE
TO authenticated
USING (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    OR patient_id IN (
      SELECT id FROM public.patients 
      WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    )
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND public.check_subscription_active(
    COALESCE(clinic_id, (SELECT p.clinic_id FROM public.patients p WHERE p.id = patient_id))
  )
)
WITH CHECK (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    OR patient_id IN (
      SELECT id FROM public.patients 
      WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    )
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
);

CREATE POLICY "Clinic owners can delete hcu033_forms"
ON public.hcu033_forms FOR DELETE
TO authenticated
USING (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    OR patient_id IN (
      SELECT id FROM public.patients 
      WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    )
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  AND public.check_subscription_active(
    COALESCE(clinic_id, (SELECT p.clinic_id FROM public.patients p WHERE p.id = patient_id))
  )
);

CREATE INDEX IF NOT EXISTS idx_hcu033_forms_tenant_patient 
  ON public.hcu033_forms(clinic_id, patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hcu033_forms TO authenticated;

-- 5.3 Patients clinical mutation guard triggers & RLS
CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    RETURN NEW;
  END IF;

  IF (NEW.clinic_id IS DISTINCT FROM OLD.clinic_id) THEN
    RAISE EXCEPTION 'Unauthorized patient mutation: clinic_id cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  
  IF v_caller_role IS NULL THEN
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
  END IF;

  IF v_caller_role IN ('doctor', 'clinic_owner') THEN
    RETURN NEW;
  END IF;

  -- Non-clinical staff cannot alter medical conditions, diagnoses, or dental charting
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
    RAISE EXCEPTION 'Unauthorized clinical mutation: Non-clinical staff (%) cannot modify clinical diagnoses, dental charting, or medical history.', COALESCE(v_caller_role, 'receptionist')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
CREATE TRIGGER trg_enforce_patient_clinical_privileges
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_patient_clinical_privileges();

CREATE OR REPLACE FUNCTION public.guard_patient_clinical_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    RETURN NEW;
  END IF;

  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role IN ('doctor', 'clinic_owner') THEN
    RETURN NEW;
  END IF;

  IF (
    (NEW.odontogram_state IS NOT NULL AND NEW.odontogram_state::text != '{}'::text AND NEW.odontogram_state::text != 'null')
  ) THEN
    RAISE EXCEPTION 'Unauthorized clinical intake: Non-clinical staff cannot initialize dental charting state.'
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

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patients in their clinic"
ON public.patients FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

CREATE POLICY "Users can insert patients in their clinic"
ON public.patients FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can update patients in their clinic"
ON public.patients FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can delete patients in their clinic"
ON public.patients FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  AND public.check_subscription_active(clinic_id)
);


-- ============================================================================
-- 6. SEC-12 & SEC-13: SERVICES & BANK PAYMENT METHODS TENANT PARTITIONING
-- ============================================================================

-- 6.1 Services table RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

CREATE POLICY "Clinic members can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  );

CREATE POLICY "Clinic owners can insert services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  );

CREATE POLICY "Clinic owners can update services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  );

CREATE POLICY "Clinic owners can delete services"
  ON public.services FOR DELETE
  TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
REVOKE ALL ON public.services FROM anon, public;

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);

-- 6.2 Payment Methods table RLS & schema
ALTER TABLE public.payment_methods 
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;

UPDATE public.payment_methods pm
SET clinic_id = p.clinic_id
FROM public.profiles p
WHERE pm.doctor_id = p.id
  AND pm.clinic_id IS NULL
  AND p.clinic_id IS NOT NULL;

UPDATE public.payment_methods pm
SET clinic_id = (
  SELECT id FROM public.clinics 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE pm.clinic_id IS NULL
  AND EXISTS (SELECT 1 FROM public.clinics);

DELETE FROM public.payment_methods WHERE clinic_id IS NULL;

ALTER TABLE public.payment_methods 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE public.payment_methods 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_id 
  ON public.payment_methods(clinic_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_active 
  ON public.payment_methods(clinic_id, is_active);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view payment methods"
ON public.payment_methods FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  OR
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = payment_methods.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = payment_methods.clinic_id
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Allow checkout viewing of active payment methods"
ON public.payment_methods FOR SELECT
TO authenticated, anon
USING (
  is_active = true
  AND
  EXISTS (
    SELECT 1 FROM public.billings b
    WHERE b.clinic_id = payment_methods.clinic_id
  )
);

CREATE POLICY "Clinic owners can insert payment methods"
ON public.payment_methods FOR INSERT
TO authenticated
WITH CHECK (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = payment_methods.clinic_id
      AND c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = payment_methods.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'clinic_owner'
      AND cm.status = 'active'
  )
);

CREATE POLICY "Clinic owners can update payment methods"
ON public.payment_methods FOR UPDATE
TO authenticated
USING (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = payment_methods.clinic_id
      AND c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = payment_methods.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'clinic_owner'
      AND cm.status = 'active'
  )
)
WITH CHECK (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = payment_methods.clinic_id
      AND c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = payment_methods.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'clinic_owner'
      AND cm.status = 'active'
  )
);

CREATE POLICY "Clinic owners can delete payment methods"
ON public.payment_methods FOR DELETE
TO authenticated
USING (
  (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = payment_methods.clinic_id
      AND c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = payment_methods.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'clinic_owner'
      AND cm.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.get_checkout_payment_methods(p_billing_id UUID)
RETURNS TABLE (
  id UUID,
  clinic_id UUID,
  type TEXT,
  title TEXT,
  config JSONB,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_checkout_payment_methods(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_payment_methods(UUID) TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT ON public.payment_methods TO anon;


-- ============================================================================
-- 7. SEC-08 & SEC-09: ANALYTICS VIEW ISOLATION & MAINTENANCE RPC REVOCATION
-- ============================================================================

-- 7.1 Analytics view recreation with security_invoker and tenant filter (SEC-08)
CREATE OR REPLACE VIEW public.dashboard_stats_view 
WITH (security_invoker = true) AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

GRANT SELECT ON public.dashboard_stats_view TO authenticated;
GRANT SELECT ON public.dashboard_stats_view TO service_role;

-- 7.2 Maintenance RPCs Hardening & Permission Revocation (SEC-09)
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_is_service_role boolean := false;
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    v_is_service_role := true;
  END IF;

  IF NOT v_is_service_role THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Verify caller owns the target clinic
    IF NOT EXISTS (
      SELECT 1 FROM public.clinics WHERE id = target_clinic_id AND owner_id = auth.uid()
      UNION
      SELECT 1 FROM public.clinic_members WHERE clinic_id = target_clinic_id AND user_id = auth.uid() AND role = 'clinic_owner' AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Access denied: Only clinic owners can archive their clinic.' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_at timestamptz;
BEGIN
  -- Strictly restricted to service_role or administrative callers
  IF NOT (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Access denied: purge_clinic_data is restricted to service_role.'
      USING ERRCODE = '42501';
  END IF;

  -- Statutory medical custody check: Clinic must be archived and 90-day retention lock elapsed
  SELECT archived_at INTO v_archived_at
  FROM public.clinics
  WHERE id = target_clinic_id AND subscription_status = 'archived';

  IF v_archived_at IS NULL THEN
    RAISE EXCEPTION 'Clinic is not archived or does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_archived_at >= NOW() - INTERVAL '90 days' THEN
    RAISE EXCEPTION 'Retention lock active: Clinic cannot be purged before 90-day retention period elapsed.'
      USING ERRCODE = '22000';
  END IF;

  DELETE FROM public.clinics 
  WHERE id = target_clinic_id 
    AND subscription_status = 'archived'
    AND archived_at < NOW() - INTERVAL '90 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_services(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := false;
BEGIN
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    v_is_service_role := true;
  END IF;

  IF NOT v_is_service_role THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.clinics WHERE id = target_clinic_id AND owner_id = auth.uid()
      UNION
      SELECT 1 FROM public.clinic_members WHERE clinic_id = target_clinic_id AND user_id = auth.uid() AND role = 'clinic_owner' AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Access denied: Only clinic owners can seed services.' USING ERRCODE = '42501';
    END IF;
  END IF;

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

-- Revoke public execution on maintenance functions
REVOKE ALL ON FUNCTION public.archive_clinic(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.purge_clinic_data(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.seed_default_services(uuid) FROM PUBLIC, authenticated, anon;

-- Grant execute strictly to service_role
GRANT EXECUTE ON FUNCTION public.archive_clinic(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_clinic_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_default_services(uuid) TO service_role;


-- ============================================================================
-- 8. R4-B: STATUTORY LOPDP RIGHTS REQUESTS & MEDICAL CUSTODY PERSISTENCE
-- ============================================================================

-- 8.1 Create structured audit table for LOPDP data rights requests
CREATE TABLE IF NOT EXISTS public.data_rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('portability', 'deletion', 'rectification', 'access', 'opposition', 'custody_lock')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'archived_custody')),
  details JSONB DEFAULT '{}'::jsonb,
  legal_basis TEXT NOT NULL,
  retention_note TEXT,
  requested_by_email TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indices for performance and tenant scoping
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_tenant 
  ON public.data_rights_requests(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_rights_requests_type 
  ON public.data_rights_requests(clinic_id, request_type);

-- 8.2 Enable RLS on data_rights_requests
ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests;

-- SELECT: Clinic members can view requests belonging to their clinic
CREATE POLICY "Clinic members can view data rights requests"
ON public.data_rights_requests FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- INSERT: Authenticated users can submit requests for their own active clinic
CREATE POLICY "Authenticated users can submit data rights requests"
ON public.data_rights_requests FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- UPDATE: Strictly clinic owners can resolve or update request status
CREATE POLICY "Clinic owners can update data rights requests"
ON public.data_rights_requests FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
);

-- DELETE: Strictly service_role (statutory privacy logs are immutable for tenant users)
REVOKE DELETE ON public.data_rights_requests FROM authenticated, anon, public;

GRANT SELECT, INSERT, UPDATE ON public.data_rights_requests TO authenticated;
GRANT ALL ON public.data_rights_requests TO service_role;

-- 8.3 Helper RPC to log statutory data rights request
CREATE OR REPLACE FUNCTION public.log_data_rights_request(
  p_request_type TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_legal_basis TEXT DEFAULT 'LOPDP Art. 17',
  p_retention_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
