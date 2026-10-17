-- ============================================================================
-- Backward Migration / Rollback: rollback_20260922194927.sql
-- Description: Deterministic, Zero-Data-Loss Rollback for Migration 20260922194927
-- Targets:
--   1. Revert Clinical RLS & Storage policies to Milestone 6 baseline
--   2. Drop clinician assignment triggers and functions
--   3. Revert data rights requests triggers, policies, and columns
--   4. Drop compound clinical indexes
--   5. Drop composite foreign keys (patient_id, clinic_id)
--   6. Restore single-column foreign keys (patient_id) -> patients(id)
--   7. Drop composite unique constraint patients_id_clinic_id_key
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. REVERT LEAST-PRIVILEGE CLINICAL RLS & STORAGE POLICIES
-- ============================================================================

-- 1.1 Storage Bucket 'patient-files'
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;

-- Restore Milestone 6 baseline storage policies for patient-files
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

-- 1.2 Patient Files
DROP POLICY IF EXISTS "Clinical staff can view patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can insert patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can update patient files" ON public.patient_files;

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
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR uploaded_by = auth.uid()
  )
  AND public.check_subscription_active(clinic_id)
);

-- 1.3 Patient Notes
DROP POLICY IF EXISTS "Clinical staff can view patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can insert patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can update patient notes" ON public.patient_notes;

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
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR author_id = auth.uid()
  )
  AND public.check_subscription_active(clinic_id)
);

-- 1.4 HCU-033 Forms
DROP POLICY IF EXISTS "Clinical staff can view hcu033_forms" ON public.hcu033_forms;
CREATE POLICY "Clinic members can view hcu033_forms"
ON public.hcu033_forms FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

-- 1.5 Clinical Records
DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;
CREATE POLICY "Medical staff can view clinical records"
ON public.clinical_records FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.is_clinic_member(clinic_id)
  AND public.check_subscription_active(clinic_id)
);

-- ============================================================================
-- 2. REVERT DATA RIGHTS REQUESTS & AUDIT LOGS
-- ============================================================================

-- Drop audit triggers and functions added in 20260922194927
DROP TRIGGER IF EXISTS trg_audit_data_rights_status ON public.data_rights_requests;
DROP FUNCTION IF EXISTS security_internal.audit_data_rights_status();

DROP TRIGGER IF EXISTS trg_protect_data_rights_requests ON public.data_rights_requests;
DROP FUNCTION IF EXISTS public.protect_data_rights_requests();

DROP TRIGGER IF EXISTS trg_guard_data_rights_request_insert ON public.data_rights_requests;
DROP FUNCTION IF EXISTS public.guard_data_rights_request_insert();

-- Revert data_rights_requests RLS policies
DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests;

CREATE POLICY "Clinic members can view data rights requests"
  ON public.data_rights_requests FOR SELECT TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
  );

CREATE POLICY "Authenticated users can submit data rights requests"
  ON public.data_rights_requests FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "Clinic owners can update data rights requests"
  ON public.data_rights_requests FOR UPDATE TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  )
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.get_clinic_member_role(clinic_id) = 'clinic_owner'
  );

-- Drop resolution_notes column if added
ALTER TABLE public.data_rights_requests DROP COLUMN IF EXISTS resolution_notes;

-- ============================================================================
-- 3. REVERT CLINICIAN ASSIGNMENT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.appointments;
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.prescriptions;
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.clinical_records;
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.hcu033_forms;
DROP FUNCTION IF EXISTS security_internal.enforce_clinician_assignment();

-- ============================================================================
-- 4. DROP COMPOUND CLINICAL INDEXES
-- ============================================================================

DROP INDEX IF EXISTS public.idx_appointments_clinic_patient;
DROP INDEX IF EXISTS public.idx_prescriptions_clinic_patient;
DROP INDEX IF EXISTS public.idx_clinical_records_clinic_patient;
DROP INDEX IF EXISTS public.idx_patient_notes_clinic_patient;
DROP INDEX IF EXISTS public.idx_patient_files_clinic_patient;
DROP INDEX IF EXISTS public.idx_data_rights_requests_clinic_patient;
DROP INDEX IF EXISTS public.idx_billings_clinic_patient;
DROP INDEX IF EXISTS public.idx_invoices_clinic_patient;

-- ============================================================================
-- 5. REVERT COMPOSITE FOREIGN KEYS TO SINGLE-COLUMN (PATIENT_ID -> PATIENTS(ID))
-- ============================================================================

-- 5.1 Family links
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_family_clinic_fkey;

-- 5.2 Invoices
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_patient_clinic_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE NO ACTION;

-- 5.3 Billings
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_patient_clinic_fkey;
ALTER TABLE public.billings ADD CONSTRAINT billings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE NO ACTION;

-- 5.4 Data Rights Requests
ALTER TABLE public.data_rights_requests DROP CONSTRAINT IF EXISTS data_rights_requests_patient_clinic_fkey;
ALTER TABLE public.data_rights_requests ADD CONSTRAINT data_rights_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

-- 5.5 HCU-033 Forms
ALTER TABLE public.hcu033_forms DROP CONSTRAINT IF EXISTS hcu033_forms_patient_clinic_fkey;
ALTER TABLE public.hcu033_forms ADD CONSTRAINT hcu033_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 5.6 Patient Files
ALTER TABLE public.patient_files DROP CONSTRAINT IF EXISTS patient_files_patient_clinic_fkey;
ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 5.7 Patient Notes
ALTER TABLE public.patient_notes DROP CONSTRAINT IF EXISTS patient_notes_patient_clinic_fkey;
ALTER TABLE public.patient_notes ADD CONSTRAINT patient_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 5.8 Clinical Records
ALTER TABLE public.clinical_records DROP CONSTRAINT IF EXISTS clinical_records_patient_clinic_fkey;
ALTER TABLE public.clinical_records ADD CONSTRAINT clinical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE NO ACTION;

-- 5.9 Prescriptions
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_clinic_fkey;
ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 5.10 Appointments
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_clinic_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 5.11 Optional Loyalty Communications table
DO $$
BEGIN
  IF to_regclass('public.loyalty_communications') IS NOT NULL THEN
    ALTER TABLE public.loyalty_communications DROP CONSTRAINT IF EXISTS loyalty_communications_patient_clinic_fkey;
    ALTER TABLE public.loyalty_communications ADD CONSTRAINT loyalty_communications_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);
  END IF;
END;
$$;

-- ============================================================================
-- 6. DROP COMPOSITE UNIQUE CONSTRAINT ON PATIENTS
-- ============================================================================

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_id_clinic_id_key;

COMMIT;
