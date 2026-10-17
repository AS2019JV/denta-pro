-- ============================================================================
-- Migration: 20260920_m2_clinical_services_payment_methods.sql
-- Description: Milestone 2 - Clinical Privilege Separation & Multi-Tenant Data Integrity
-- Covers:
--   - SEC-07: Clinical Role Privilege Separation (prescriptions RLS, hcu033_forms
--             tenant backfill/RLS, patients clinical columns protection trigger)
--   - SEC-12: Services Table Strict Tenant Isolation & Pricing Authorization
--   - SEC-13: Bank Payment Methods Tenant Partition & Checkout Isolation
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SEC-07: Prescriptions Table RLS Hardening
-- ============================================================================

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- 1.1 Drop all prior and legacy policies to avoid permissive OR-accumulation
DROP POLICY IF EXISTS "Prescriptions are viewable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are insertable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are updatable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are deletable by clinic owners" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors and owners can update their prescriptions" ON public.prescriptions;

-- 1.2 SELECT: Viewable by all active clinic members (needed for printing/check-in)
CREATE POLICY "Prescriptions are viewable by clinic members"
ON public.prescriptions FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- 1.3 INSERT: Clinical staff only; doctor_id strictly locked to caller auth.uid()
CREATE POLICY "Doctors and owners can insert prescriptions"
ON public.prescriptions FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')
  AND doctor_id = auth.uid()
  AND public.check_subscription_active(clinic_id)
);

-- 1.4 UPDATE: Prescribing doctor or clinic owner; doctor_id cannot be spoofed
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

-- 1.5 DELETE: Strictly clinic owner
CREATE POLICY "Prescriptions are deletable by clinic owners"
ON public.prescriptions FOR DELETE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  AND public.check_subscription_active(clinic_id)
);

-- 1.6 Performance index
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_doctor 
  ON public.prescriptions(clinic_id, doctor_id, patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;


-- ============================================================================
-- 2. SEC-07: HCU-033 Forms Schema & RLS Hardening
-- ============================================================================

-- 2.1 Ensure clinic_id column exists
ALTER TABLE public.hcu033_forms 
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;

-- 2.2 Backfill clinic_id from patients table where null
UPDATE public.hcu033_forms h
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE h.patient_id = p.id AND h.clinic_id IS NULL;

-- 2.3 Set default clinic_id from JWT
ALTER TABLE public.hcu033_forms 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

-- 2.4 Auto-sync and tenant isolation trigger for hcu033_forms
CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_sync_hcu033_form_clinic_id ON public.hcu033_forms;
CREATE TRIGGER trg_sync_hcu033_form_clinic_id
  BEFORE INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hcu033_form_clinic_id();

-- 2.5 Ensure RLS is active
ALTER TABLE public.hcu033_forms ENABLE ROW LEVEL SECURITY;

-- 2.6 Drop legacy and prior policies
DROP POLICY IF EXISTS "Users can view forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can insert forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Users can update forms in their clinic" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can insert hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can update hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinic owners can delete hcu033_forms" ON public.hcu033_forms;

-- 2.7 SELECT: Viewable by clinic members
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

-- 2.8 INSERT: Clinical staff only (doctor, clinic_owner)
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

-- 2.9 UPDATE: Clinical staff only (doctor, clinic_owner)
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

-- 2.10 DELETE: Strictly clinic owners (statutory retention protection)
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

-- 2.11 Performance index
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_tenant_patient 
  ON public.hcu033_forms(clinic_id, patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hcu033_forms TO authenticated;


-- ============================================================================
-- 3. SEC-07: Patient Clinical Columns Mutation Guard (Column-Level RBAC)
-- ============================================================================

-- 3.1 Trigger function to enforce clinical privilege separation on public.patients
CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- A. Administrative bypass (service_role, migrations, internal maintenance)
  IF (
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  ) THEN
    RETURN NEW;
  END IF;

  -- B. Prevent mutation of tenant partition key
  IF (NEW.clinic_id IS DISTINCT FROM OLD.clinic_id) THEN
    RAISE EXCEPTION 'Unauthorized patient mutation: clinic_id cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  -- C. Resolve caller role from JWT claim
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  
  -- Fallback: resolve from clinic_members if JWT claim not yet hydrated
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
    RAISE EXCEPTION 'Unauthorized clinical mutation: Non-clinical staff (%) cannot modify clinical diagnoses, dental charting, or medical history.', COALESCE(v_caller_role, 'receptionist')
      USING ERRCODE = '42501';
  END IF;

  -- Allow administrative and demographic modifications (name, phone, email, address, etc.)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
CREATE TRIGGER trg_enforce_patient_clinical_privileges
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_patient_clinical_privileges();

-- 3.2 Guard against non-clinical synthetic charting initialization on INSERT
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

  -- Receptionists can create patients during intake, but cannot inject non-empty clinical chart data
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

-- 3.3 Consolidate public.patients UPDATE RLS policy
DROP POLICY IF EXISTS "Users can update patients in their valid clinics" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;

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


-- ============================================================================
-- 4. SEC-12: Services Table Strict Tenant Isolation & Pricing Authorization
-- ============================================================================

-- 4.1 Ensure RLS is active
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 4.2 Drop all permissive and legacy policies to eliminate boolean OR bypasses
DROP POLICY IF EXISTS "Admins can insert services." ON public.services;
DROP POLICY IF EXISTS "Admins can update services." ON public.services;
DROP POLICY IF EXISTS "Admins can delete services." ON public.services;
DROP POLICY IF EXISTS "Owners can manage services" ON public.services;
DROP POLICY IF EXISTS "Users can view services in their clinic" ON public.services;
DROP POLICY IF EXISTS "Clinic members can view services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can insert services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can update services" ON public.services;
DROP POLICY IF EXISTS "Clinic owners can delete services" ON public.services;

-- 4.3 Safe column default for clinic_id if omitted in client insert payloads
ALTER TABLE public.services 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

-- 4.4 SELECT: All authenticated clinic members can view clinic services
CREATE POLICY "Clinic members can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  );

-- 4.5 INSERT: Strictly clinic owners within their own clinic
CREATE POLICY "Clinic owners can insert services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  );

-- 4.6 UPDATE: Strictly clinic owners within their own clinic
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

-- 4.7 DELETE: Strictly clinic owners within their own clinic
CREATE POLICY "Clinic owners can delete services"
  ON public.services FOR DELETE
  TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
  );

-- 4.8 Grants: authenticated CRUD, revoke anon/public
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
REVOKE ALL ON public.services FROM anon, public;

-- 4.9 Performance index
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);


-- ============================================================================
-- 5. SEC-13: Bank Payment Methods Tenant Partition & Checkout Isolation
-- ============================================================================

-- 5.1 Ensure clinic_id column exists
ALTER TABLE public.payment_methods 
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;

-- 5.2 Safe Backfill:
-- A. Backfill from associated doctor profile
UPDATE public.payment_methods pm
SET clinic_id = p.clinic_id
FROM public.profiles p
WHERE pm.doctor_id = p.id
  AND pm.clinic_id IS NULL
  AND p.clinic_id IS NOT NULL;

-- B. Fallback to oldest active clinic for any legacy unassigned records
UPDATE public.payment_methods pm
SET clinic_id = (
  SELECT id FROM public.clinics 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE pm.clinic_id IS NULL
  AND EXISTS (SELECT 1 FROM public.clinics);

-- C. Delete any orphaned records that cannot be mapped to any clinic
DELETE FROM public.payment_methods WHERE clinic_id IS NULL;

-- D. Enforce NOT NULL constraint and default
ALTER TABLE public.payment_methods 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE public.payment_methods 
  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

-- 5.3 Performance and filtering indices
CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_id 
  ON public.payment_methods(clinic_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_active 
  ON public.payment_methods(clinic_id, is_active);

-- 5.4 Drop legacy and conflicting policies
DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic members can view payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic members can view payment methods for their clinic" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can insert payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can update payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Clinic owners can delete payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Public can view active payment methods for checkout" ON public.payment_methods;
DROP POLICY IF EXISTS "Allow checkout viewing of active payment methods" ON public.payment_methods;

-- 5.5 Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- 5.6 SELECT: Clinic members can view payment methods in their clinic
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

-- 5.7 SELECT: Public/patient invoice checkout for active payment methods of that clinic
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

-- 5.8 INSERT: Strictly clinic owners for their own clinic
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

-- 5.9 UPDATE: Strictly clinic owners for their own clinic
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

-- 5.10 DELETE: Strictly clinic owners for their own clinic
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

-- 5.11 Secure Public Checkout RPC (Defense-in-depth for invoice payments)
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

-- 5.12 Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT ON public.payment_methods TO anon;

COMMIT;
