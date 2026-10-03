-- ============================================================================
-- Migration: 20260922_m6_security_hardening_and_contract_fix.sql
-- Description: Post-M5 Security Hardening, Legacy Storage Policy Purge, 
--              Patient RPC Contract Restoration & Clinical Active Membership RLS
-- Target: Supabase Project leqsrfyjvuxxdsubjjin (PostgreSQL 17, sa-east-1)
-- References: docs/security/M5_VERIFICATION_AND_NEXT_STEPS_2026-09-22.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. M5-03: Active Clinic Membership & Role Resolver Functions
-- (Defined first so storage and clinical table policies can reference them)
-- ============================================================================

-- 1.1 Canonical Active Clinic Membership Check
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

REVOKE ALL ON FUNCTION public.is_clinic_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(uuid) TO authenticated, service_role;

-- 1.2 Live Role Resolver Function
CREATE OR REPLACE FUNCTION public.get_clinic_member_role(check_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

REVOKE ALL ON FUNCTION public.get_clinic_member_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_member_role(uuid) TO authenticated, service_role;


-- ============================================================================
-- 2. M5-01: Legacy Storage Policy Purge & Storage Objects Consolidation
-- ============================================================================
-- Explicitly drop the 5 surviving broad/permissive policies on storage.objects
DROP POLICY IF EXISTS "Public Access to Patient Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload to Receipts" ON storage.objects;

-- Also drop any historical naming variants to prevent permissive OR-accumulation
DROP POLICY IF EXISTS "Public patient avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Public patient avatar select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public receipts access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read patient files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete patient files" ON storage.objects;

-- Ensure buckets are strictly private
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'patient-avatars';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'receipts';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520, -- 20 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/dicom']
WHERE id = 'patient-files';

-- Ensure patient-avatars canonical policies exist
DROP POLICY IF EXISTS "Tenant isolated select for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated insert for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-avatars" ON storage.objects;

CREATE POLICY "Tenant isolated select for patient-avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = ((storage.foldername(name))[2])::uuid
            AND p.clinic_id = ((storage.foldername(name))[1])::uuid
            AND p.deleted_at IS NULL
        )
      )
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

CREATE POLICY "Tenant isolated insert for patient-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = ((storage.foldername(name))[2])::uuid
            AND p.clinic_id = ((storage.foldername(name))[1])::uuid
            AND p.deleted_at IS NULL
        )
      )
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

CREATE POLICY "Tenant isolated update for patient-avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (
    (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = ((storage.foldername(name))[2])::uuid
            AND p.clinic_id = ((storage.foldername(name))[1])::uuid
            AND p.deleted_at IS NULL
        )
      )
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
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = ((storage.foldername(name))[2])::uuid
            AND p.clinic_id = ((storage.foldername(name))[1])::uuid
            AND p.deleted_at IS NULL
        )
      )
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

-- Ensure receipts canonical policies exist
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
  AND (
    -- Case A: Path is <clinic_id>/...
    (
      public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.billings b
          WHERE b.id = ((storage.foldername(name))[2])::uuid
            AND b.clinic_id = ((storage.foldername(name))[1])::uuid
        )
      )
    )
    OR
    -- Case B: Legacy / direct path <billing_id>/...
    EXISTS (
      SELECT 1 FROM public.billings b
      WHERE b.id = ((storage.foldername(name))[1])::uuid
        AND public.is_clinic_member(b.clinic_id)
    )
  )
);

CREATE POLICY "Tenant isolated insert for receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (
    -- Case A: Path is <clinic_id>/...
    (
      public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.billings b
          WHERE b.id = ((storage.foldername(name))[2])::uuid
            AND b.clinic_id = ((storage.foldername(name))[1])::uuid
        )
      )
    )
    OR
    -- Case B: Legacy / direct path <billing_id>/...
    EXISTS (
      SELECT 1 FROM public.billings b
      WHERE b.id = ((storage.foldername(name))[1])::uuid
        AND public.is_clinic_member(b.clinic_id)
    )
  )
);

CREATE POLICY "Tenant isolated update for receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (
    -- Case A: Path is <clinic_id>/...
    (
      public.is_clinic_member((storage.foldername(name))[1]::uuid)
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.billings b
          WHERE b.id = ((storage.foldername(name))[2])::uuid
            AND b.clinic_id = ((storage.foldername(name))[1])::uuid
        )
      )
    )
    OR
    -- Case B: Legacy / direct path <billing_id>/...
    EXISTS (
      SELECT 1 FROM public.billings b
      WHERE b.id = ((storage.foldername(name))[1])::uuid
        AND public.is_clinic_member(b.clinic_id)
    )
  )
);

CREATE POLICY "Tenant isolated delete for receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (
    -- Case A: Path is <clinic_id>/...
    (
      public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'admin')
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.billings b
          WHERE b.id = ((storage.foldername(name))[2])::uuid
            AND b.clinic_id = ((storage.foldername(name))[1])::uuid
        )
      )
    )
    OR
    -- Case B: Legacy / direct path <billing_id>/...
    EXISTS (
      SELECT 1 FROM public.billings b
      WHERE b.id = ((storage.foldername(name))[1])::uuid
        AND public.get_clinic_member_role(b.clinic_id) IN ('clinic_owner', 'admin')
    )
  )
);


-- ============================================================================
-- 3. M5-03: Live Membership & Role Enforcement on Prescriptions, HCU, Files & Notes
-- ============================================================================

-- 3.1 Hardened Prescriptions RLS (Live Membership + Role, Not Cached JWT Claims Alone)
DROP POLICY IF EXISTS "Prescriptions are viewable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can update their prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are deletable by clinic owners" ON public.prescriptions;

CREATE POLICY "Prescriptions are viewable by clinic members"
ON public.prescriptions FOR SELECT
TO authenticated
USING (
  clinic_id IS NOT NULL
  AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Doctors and owners can insert prescriptions"
ON public.prescriptions FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IS NOT NULL
  AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('doctor', 'clinic_owner')
  AND doctor_id = auth.uid()
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Doctors and owners can update their prescriptions"
ON public.prescriptions FOR UPDATE
TO authenticated
USING (
  clinic_id IS NOT NULL
  AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND doctor_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id IS NOT NULL
  AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND doctor_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Prescriptions are deletable by clinic owners"
ON public.prescriptions FOR DELETE
TO authenticated
USING (
  clinic_id IS NOT NULL
  AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  AND public.check_subscription_active(clinic_id)
);

-- 3.2 Hardened HCU-033 Forms RLS
DROP POLICY IF EXISTS "Users can view forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can insert forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can update forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can insert hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can update hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic owners can delete hcu033_forms" ON public.hcu033_forms;

CREATE POLICY "Clinic members can view hcu033_forms"
ON public.hcu033_forms FOR SELECT
TO authenticated
USING (
  (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND public.check_subscription_active(clinic_id)
  )
  OR (
    clinic_id IS NULL
    AND patient_id IN (
      SELECT p.id FROM public.patients p
      WHERE p.clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
        AND public.is_clinic_member(p.clinic_id)
        AND public.check_subscription_active(p.clinic_id)
    )
  )
);

CREATE POLICY "Clinical staff can insert hcu033_forms"
ON public.hcu033_forms FOR INSERT
TO authenticated
WITH CHECK (
  (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) IN ('doctor', 'clinic_owner')
    AND public.check_subscription_active(clinic_id)
  )
  OR (
    clinic_id IS NULL
    AND patient_id IN (
      SELECT p.id FROM public.patients p
      WHERE p.clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
        AND public.get_clinic_member_role(p.clinic_id) IN ('doctor', 'clinic_owner')
        AND public.check_subscription_active(p.clinic_id)
    )
  )
);

CREATE POLICY "Clinical staff can update hcu033_forms"
ON public.hcu033_forms FOR UPDATE
TO authenticated
USING (
  (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) IN ('doctor', 'clinic_owner')
    AND public.check_subscription_active(clinic_id)
  )
  OR (
    clinic_id IS NULL
    AND patient_id IN (
      SELECT p.id FROM public.patients p
      WHERE p.clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
        AND public.get_clinic_member_role(p.clinic_id) IN ('doctor', 'clinic_owner')
        AND public.check_subscription_active(p.clinic_id)
    )
  )
)
WITH CHECK (
  (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) IN ('doctor', 'clinic_owner')
    AND public.check_subscription_active(clinic_id)
  )
  OR (
    clinic_id IS NULL
    AND patient_id IN (
      SELECT p.id FROM public.patients p
      WHERE p.clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
        AND public.get_clinic_member_role(p.clinic_id) IN ('doctor', 'clinic_owner')
        AND public.check_subscription_active(p.clinic_id)
    )
  )
);

CREATE POLICY "Clinic owners can delete hcu033_forms"
ON public.hcu033_forms FOR DELETE
TO authenticated
USING (
  (
    clinic_id IS NOT NULL
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    AND public.check_subscription_active(clinic_id)
  )
  OR (
    clinic_id IS NULL
    AND patient_id IN (
      SELECT p.id FROM public.patients p
      WHERE p.clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
        AND public.get_clinic_member_role(p.clinic_id) = 'clinic_owner'
        AND public.check_subscription_active(p.clinic_id)
    )
  )
);

-- 3.3 Hardened Patient Files Table RLS
DROP POLICY IF EXISTS "Users can view files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can insert files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can update files in their clinic" ON public.patient_files;

CREATE POLICY "Users can view files in their clinic"
ON public.patient_files FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Users can insert files in their clinic"
ON public.patient_files FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can update files in their clinic"
ON public.patient_files FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

-- 3.4 Hardened Patient Notes Table RLS
DROP POLICY IF EXISTS "Users can view notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can insert notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can update notes in their clinic" ON public.patient_notes;

CREATE POLICY "Users can view notes in their clinic"
ON public.patient_notes FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Users can insert notes in their clinic"
ON public.patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can update notes in their clinic"
ON public.patient_notes FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

-- 3.5 Hardened Storage Bucket 'patient-files' RLS
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated update for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated delete for patient-files" ON storage.objects;

CREATE POLICY "Tenant isolated read for patient-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated upload for patient-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated update for patient-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_clinic_member((storage.foldername(name))[1]::uuid)
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Tenant isolated delete for patient-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'doctor')
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.clinic_id = ((storage.foldername(name))[1])::uuid
        AND p.deleted_at IS NULL
    )
  )
  AND public.check_subscription_active((storage.foldername(name))[1]::uuid)
);

-- 3.6 Hardened Clinical Records Table RLS (M5-03: Sibling Boundary Enforcement)
DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;
DROP POLICY IF EXISTS "Clinical staff can insert clinical records" ON public.clinical_records;
DROP POLICY IF EXISTS "Clinical staff can update clinical records" ON public.clinical_records;
DROP POLICY IF EXISTS "Clinic owners can delete clinical records" ON public.clinical_records;

CREATE POLICY "Medical staff can view clinical records"
ON public.clinical_records FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can insert clinical records"
ON public.clinical_records FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can update clinical records"
ON public.clinical_records FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinic owners can delete clinical records"
ON public.clinical_records FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  AND public.check_subscription_active(clinic_id)
);

-- 3.7 Hardened Prescription Templates Table RLS (M5-03: Sibling Boundary Enforcement)
DROP POLICY IF EXISTS "Templates are viewable by clinic members" ON public.prescription_templates;
DROP POLICY IF EXISTS "Templates are insertable by clinic members" ON public.prescription_templates;
DROP POLICY IF EXISTS "Templates are updatable by their creator or clinic owners" ON public.prescription_templates;
DROP POLICY IF EXISTS "Templates are deletable by their creator or clinic owners" ON public.prescription_templates;

CREATE POLICY "Templates are viewable by clinic members"
ON public.prescription_templates FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Templates are insertable by clinical staff"
ON public.prescription_templates FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND doctor_id = auth.uid()
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Templates are updatable by their creator or clinic owners"
ON public.prescription_templates FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND doctor_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND doctor_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Templates are deletable by their creator or clinic owners"
ON public.prescription_templates FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND doctor_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

-- 3.8 Hardened Appointments Table RLS (M5-03: Sibling Boundary Enforcement)
DROP POLICY IF EXISTS "Users can view appointments in their clinic" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert appointments in their clinic" ON public.appointments;
DROP POLICY IF EXISTS "Users can update appointments in their clinic" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete appointments in their clinic" ON public.appointments;

CREATE POLICY "Users can view appointments in their clinic"
ON public.appointments FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can insert appointments in their clinic"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can update appointments in their clinic"
ON public.appointments FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Users can delete appointments in their clinic"
ON public.appointments FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);


-- ============================================================================
-- 4. M5-02: Patient RPC (get_patients_with_stats) Contract & Runtime Fix
-- ============================================================================
-- Dynamically drop all existing overloaded signatures of get_patients_with_stats
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS func_signature 
        FROM pg_proc 
        WHERE proname = 'get_patients_with_stats' 
          AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END;
$$;

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
  clinic_id uuid,
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
  status text,
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
  medical_history jsonb,
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
  created_at timestamptz,
  updated_at timestamptz,
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

REVOKE ALL ON FUNCTION public.get_patients_with_stats(uuid, text, integer, integer, text, text, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patients_with_stats(uuid, text, integer, integer, text, text, boolean, uuid) TO authenticated, service_role;


-- ============================================================================
-- 5. Workflow Gap 3: Data Rights Requests Audit History & Terminal State Protection
-- ============================================================================
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

DROP TRIGGER IF EXISTS trg_protect_data_rights_requests ON public.data_rights_requests;
CREATE TRIGGER trg_protect_data_rights_requests
  BEFORE UPDATE ON public.data_rights_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_data_rights_requests();

REVOKE ALL ON FUNCTION public.protect_data_rights_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_data_rights_requests() TO authenticated, service_role;


-- ============================================================================
-- 6. Clinical Field Mutation Protection (enforce_patient_clinical_privileges)
-- ============================================================================
-- Ensure periodontogram_state and updated_at exist on patients table so trigger/RPC references never fail
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS periodontogram_state JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

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
GRANT EXECUTE ON FUNCTION public.enforce_patient_clinical_privileges() TO authenticated, service_role;

COMMIT;
