-- Apply only after staging verification. Existing inconsistent rows require clinical review.
BEGIN;

-- A composite key prevents a child in one clinic from linking another clinic's patient.
ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.prescriptions ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.hcu033_forms ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.billings ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patients ADD CONSTRAINT patients_id_clinic_id_key UNIQUE (id, clinic_id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_patient_clinic_fkey;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.prescriptions VALIDATE CONSTRAINT prescriptions_patient_clinic_fkey;
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey;

ALTER TABLE public.clinical_records ADD CONSTRAINT clinical_records_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.clinical_records VALIDATE CONSTRAINT clinical_records_patient_clinic_fkey;
ALTER TABLE public.clinical_records DROP CONSTRAINT IF EXISTS clinical_records_patient_id_fkey;

ALTER TABLE public.patient_notes ADD CONSTRAINT patient_notes_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.patient_notes VALIDATE CONSTRAINT patient_notes_patient_clinic_fkey;
ALTER TABLE public.patient_notes DROP CONSTRAINT IF EXISTS patient_notes_patient_id_fkey;

ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.patient_files VALIDATE CONSTRAINT patient_files_patient_clinic_fkey;
ALTER TABLE public.patient_files DROP CONSTRAINT IF EXISTS patient_files_patient_id_fkey;

ALTER TABLE public.hcu033_forms ADD CONSTRAINT hcu033_forms_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.hcu033_forms VALIDATE CONSTRAINT hcu033_forms_patient_clinic_fkey;
ALTER TABLE public.hcu033_forms DROP CONSTRAINT IF EXISTS hcu033_forms_patient_id_fkey;

ALTER TABLE public.data_rights_requests ADD CONSTRAINT data_rights_requests_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE SET NULL (patient_id) NOT VALID;
ALTER TABLE public.data_rights_requests VALIDATE CONSTRAINT data_rights_requests_patient_clinic_fkey;
ALTER TABLE public.data_rights_requests DROP CONSTRAINT IF EXISTS data_rights_requests_patient_id_fkey;

-- Finance rows also carry patient identifiers. Keep their existing NO ACTION delete semantics.
ALTER TABLE public.billings ADD CONSTRAINT billings_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.billings VALIDATE CONSTRAINT billings_patient_clinic_fkey;
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_patient_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_patient_clinic_fkey FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_patient_clinic_fkey;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_patient_id_fkey;

-- Support tenant-scoped clinical reads and parent-key checks as the SaaS grows.
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON public.appointments(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient ON public.prescriptions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient ON public.clinical_records(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic_patient ON public.patient_notes(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_clinic_patient ON public.patient_files(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_clinic_patient ON public.data_rights_requests(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_billings_clinic_patient ON public.billings(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_patient ON public.invoices(clinic_id, patient_id);

-- This legacy marketing table exists in some clean-install histories, but not the connected project.
DO $$
BEGIN
  IF to_regclass('public.loyalty_communications') IS NOT NULL THEN
    ALTER TABLE public.loyalty_communications ADD CONSTRAINT loyalty_communications_patient_clinic_fkey
      FOREIGN KEY (patient_id, clinic_id) REFERENCES public.patients(id, clinic_id) NOT VALID;
    ALTER TABLE public.loyalty_communications VALIDATE CONSTRAINT loyalty_communications_patient_clinic_fkey;
    ALTER TABLE public.loyalty_communications DROP CONSTRAINT IF EXISTS loyalty_communications_patient_id_fkey;
  END IF;
END;
$$;

-- Patient-family links must also remain inside one clinic.
ALTER TABLE public.patients ADD CONSTRAINT patients_family_clinic_fkey
  FOREIGN KEY (family_representative_id, clinic_id)
  REFERENCES public.patients(id, clinic_id)
  ON DELETE SET NULL (family_representative_id) NOT VALID;
ALTER TABLE public.patients VALIDATE CONSTRAINT patients_family_clinic_fkey;

-- Assigning a doctor requires a current, active clinical role in the same clinic.
CREATE SCHEMA IF NOT EXISTS security_internal;
REVOKE ALL ON SCHEMA security_internal FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
REVOKE ALL ON FUNCTION security_internal.enforce_clinician_assignment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.appointments;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.prescriptions;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.clinical_records;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.clinical_records FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();
DROP TRIGGER IF EXISTS trg_enforce_clinician_assignment ON public.hcu033_forms;
CREATE TRIGGER trg_enforce_clinician_assignment BEFORE INSERT OR UPDATE OF doctor_id, clinic_id ON public.hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.enforce_clinician_assignment();

-- Rights requests: client submissions start pending and existing owner resolutions remain supported.
ALTER TABLE public.data_rights_requests ADD COLUMN IF NOT EXISTS resolution_notes text;
REVOKE INSERT, UPDATE, DELETE ON logs.access_audit FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests;
CREATE POLICY "Clinic members can view data rights requests"
  ON public.data_rights_requests FOR SELECT TO authenticated
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND (user_id = auth.uid() OR public.get_clinic_member_role(clinic_id) = 'clinic_owner')
  );
CREATE POLICY "Authenticated users can submit data rights requests"
  ON public.data_rights_requests FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.is_clinic_member(clinic_id)
    AND user_id = auth.uid()
    AND status = 'pending'
    AND resolved_by IS NULL AND resolved_at IS NULL
    AND resolution_notes IS NULL
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

CREATE OR REPLACE FUNCTION public.guard_data_rights_request_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
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
REVOKE ALL ON FUNCTION public.guard_data_rights_request_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_data_rights_request_insert ON public.data_rights_requests;
CREATE TRIGGER trg_guard_data_rights_request_insert
  BEFORE INSERT ON public.data_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_data_rights_request_insert();

CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
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
REVOKE ALL ON FUNCTION public.protect_data_rights_requests() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_data_requests_immutability ON public.data_rights_requests;
DROP TRIGGER IF EXISTS trg_protect_data_rights_requests ON public.data_rights_requests;
CREATE TRIGGER trg_protect_data_rights_requests
  BEFORE UPDATE ON public.data_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_data_rights_requests();

CREATE OR REPLACE FUNCTION security_internal.audit_data_rights_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
REVOKE ALL ON FUNCTION security_internal.audit_data_rights_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_audit_data_rights_status ON public.data_rights_requests;
CREATE TRIGGER trg_audit_data_rights_status
  AFTER UPDATE OF status ON public.data_rights_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION security_internal.audit_data_rights_status();

-- Audit actions and identifiers without copying entire clinical rows into logs.
CREATE OR REPLACE FUNCTION logs.log_access_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
REVOKE ALL ON FUNCTION logs.log_access_trigger() FROM PUBLIC, anon, authenticated;

-- A 90-day archive age does not establish that medical or rights evidence may be destroyed.
-- Fail closed until a record-specific retention decision and verified export/deletion workflow exist.
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
REVOKE ALL ON FUNCTION public.purge_clinic_data(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Least-Privilege Clinical RLS (M7-BLK-04)
-- Restrict direct SELECT access on sensitive diagnostic and clinical charting tables
-- (clinical_records, hcu033_forms, patient_notes, patient_files) to doctors and clinic owners.
-- Receptionists and administrative staff are restricted to demographic, appointment,
-- and billing access (receptionist_patient_view, patients, appointments, billings).
-- ============================================================================

-- 1. Clinical Records: Narrow SELECT to doctors and clinic owners
DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;
CREATE POLICY "Medical staff can view clinical records"
ON public.clinical_records FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

-- 2. HCU-033 Forms: Narrow SELECT to doctors and clinic owners
DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;
DROP POLICY IF EXISTS "Clinical staff can view hcu033_forms" ON public.hcu033_forms;
CREATE POLICY "Clinical staff can view hcu033_forms"
ON public.hcu033_forms FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

-- 3. Patient Notes: Narrow SELECT, INSERT, UPDATE to clinical roles
DROP POLICY IF EXISTS "Users can view notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can insert notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Users can update notes in their clinic" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can view patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can insert patient notes" ON public.patient_notes;
DROP POLICY IF EXISTS "Clinical staff can update patient notes" ON public.patient_notes;

CREATE POLICY "Clinical staff can view patient notes"
ON public.patient_notes FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Clinical staff can insert patient notes"
ON public.patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can update patient notes"
ON public.patient_notes FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND author_id = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

-- 4. Patient Files: Narrow SELECT, INSERT, UPDATE to clinical roles
DROP POLICY IF EXISTS "Users can view files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can insert files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Users can update files in their clinic" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can view patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can insert patient files" ON public.patient_files;
DROP POLICY IF EXISTS "Clinical staff can update patient files" ON public.patient_files;

CREATE POLICY "Clinical staff can view patient files"
ON public.patient_files FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Clinical staff can insert patient files"
ON public.patient_files FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
  AND public.check_subscription_active(clinic_id)
);

CREATE POLICY "Clinical staff can update patient files"
ON public.patient_files FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (
    public.get_clinic_member_role(clinic_id) = 'clinic_owner'
    OR (public.get_clinic_member_role(clinic_id) = 'doctor' AND uploaded_by = auth.uid())
  )
  AND public.check_subscription_active(clinic_id)
);

-- 5. Hardened Storage Bucket 'patient-files' RLS for Clinical Staff
DROP POLICY IF EXISTS "Tenant isolated read for patient-files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated upload for patient-files" ON storage.objects;

CREATE POLICY "Tenant isolated read for patient-files"
ON storage.objects FOR SELECT
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

CREATE POLICY "Tenant isolated upload for patient-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
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

COMMIT;
