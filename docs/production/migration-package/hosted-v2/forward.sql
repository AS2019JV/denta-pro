-- PINNED REFERENCE: supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql
-- Apply only after staging verification. Existing inconsistent rows require clinical review.


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



-- PINNED REFERENCE: docs/production/reconciliation/operational-convergence/before-authority.sql
-- Generated OFFLINE from reviewed captures; LOCAL SYNTHETIC ONLY. Not a remote migration.
-- Read operational-convergence/README.md. Apply after M7, before encargo02.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
DO $local$ BEGIN
IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed postgres executor required'; END IF;
IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed M7 prerequisites required'; END IF;
IF EXISTS(SELECT 1 FROM public.clinics WHERE length(size)>50) THEN RAISE EXCEPTION 'Clinic size exceeds reviewed typmod; reconcile without truncation'; END IF;
END $local$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='appointments_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.appointments.appointments_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."appointments" WHERE NOT (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.appointments.appointments_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_status_check" CHECK (status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''completed''::text, ''cancelled''::text, ''no_show''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_clinic_id_email_status_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (clinic_id, email, status)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_clinic_id_email_status_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE "clinic_id" IS NOT NULL AND "email" IS NOT NULL AND "status" IS NOT NULL GROUP BY clinic_id, email, status HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_invitations.clinic_invitations_clinic_id_email_status_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_email_status_key" UNIQUE (clinic_id, email, status)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."clinic_invitations" DROP CONSTRAINT "clinic_invitations_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_role_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_role_check'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE NOT (role = ANY (ARRAY['doctor'::text, 'receptionist'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.clinic_invitations.clinic_invitations_role_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_role_check" CHECK (role = ANY (ARRAY[''doctor''::text, ''receptionist''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE NOT (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.clinic_invitations.clinic_invitations_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_status_check" CHECK (status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''expired''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_invitations'::regclass AND conname='clinic_invitations_token_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (token)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_invitations.clinic_invitations_token_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_invitations" WHERE "token" IS NOT NULL GROUP BY token HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_invitations.clinic_invitations_token_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_invitations" ADD CONSTRAINT "clinic_invitations_token_key" UNIQUE (token)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.clinic_members'::regclass AND conname='clinic_members_user_id_clinic_id_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (user_id, clinic_id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.clinic_members.clinic_members_user_id_clinic_id_key'; END IF;
IF EXISTS(SELECT 1 FROM public."clinic_members" WHERE "user_id" IS NOT NULL AND "clinic_id" IS NOT NULL GROUP BY user_id, clinic_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.clinic_members.clinic_members_user_id_clinic_id_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."clinic_members" ADD CONSTRAINT "clinic_members_user_id_clinic_id_key" UNIQUE (user_id, clinic_id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_request_type_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_request_type_check'; END IF;
IF EXISTS(SELECT 1 FROM public."data_rights_requests" WHERE NOT (request_type = ANY (ARRAY['portability'::text, 'deletion'::text, 'rectification'::text, 'access'::text, 'opposition'::text, 'custody_lock'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.data_rights_requests.data_rights_requests_request_type_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_request_type_check" CHECK (request_type = ANY (ARRAY[''portability''::text, ''deletion''::text, ''rectification''::text, ''access''::text, ''opposition''::text, ''custody_lock''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_resolved_by_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL','FOREIGN KEY (resolved_by) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_resolved_by_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (resolved_by) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_resolved_by_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_status_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_status_check'; END IF;
IF EXISTS(SELECT 1 FROM public."data_rights_requests" WHERE NOT (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'archived_custody'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.data_rights_requests.data_rights_requests_status_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_status_check" CHECK (status = ANY (ARRAY[''pending''::text, ''processing''::text, ''completed''::text, ''rejected''::text, ''archived_custody''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.data_rights_requests'::regclass AND conname='data_rights_requests_user_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL','FOREIGN KEY (user_id) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.data_rights_requests.data_rights_requests_user_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (user_id) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."data_rights_requests" DROP CONSTRAINT "data_rights_requests_user_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname='notifications_type_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.notifications.notifications_type_check'; END IF;
IF EXISTS(SELECT 1 FROM public."notifications" WHERE NOT (type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text]))) THEN RAISE EXCEPTION 'Invalid values require review: public.notifications.notifications_type_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY[''info''::text, ''warning''::text, ''success''::text, ''error''::text]))'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_files'::regclass AND conname='patient_files_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_files.patient_files_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."patient_files" DROP CONSTRAINT "patient_files_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_files" ADD CONSTRAINT "patient_files_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_files'::regclass AND conname='patient_files_uploaded_by_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (uploaded_by) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_files.patient_files_uploaded_by_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (uploaded_by) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."patient_files" DROP CONSTRAINT "patient_files_uploaded_by_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_files" ADD CONSTRAINT "patient_files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_notes'::regclass AND conname='patient_notes_author_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (author_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_notes.patient_notes_author_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (author_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."patient_notes" DROP CONSTRAINT "patient_notes_author_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patient_notes'::regclass AND conname='patient_notes_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patient_notes.patient_notes_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."patient_notes" DROP CONSTRAINT "patient_notes_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_cedula_clinic_unique';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (cedula, clinic_id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.patients.patients_cedula_clinic_unique'; END IF;
IF EXISTS(SELECT 1 FROM public."patients" WHERE "cedula" IS NOT NULL AND "clinic_id" IS NOT NULL GROUP BY cedula, clinic_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.patients.patients_cedula_clinic_unique'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."patients" ADD CONSTRAINT "patients_cedula_clinic_unique" UNIQUE (cedula, clinic_id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescription_templates'::regclass AND conname='prescription_templates_clinic_id_check';
IF actual IS NOT NULL AND actual NOT IN ('CHECK (clinic_id IS NOT NULL)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescription_templates.prescription_templates_clinic_id_check'; END IF;
IF EXISTS(SELECT 1 FROM public."prescription_templates" WHERE NOT (clinic_id IS NOT NULL)) THEN RAISE EXCEPTION 'Invalid values require review: public.prescription_templates.prescription_templates_clinic_id_check'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescription_templates" ADD CONSTRAINT "prescription_templates_clinic_id_check" CHECK (clinic_id IS NOT NULL)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescription_templates'::regclass AND conname='prescription_templates_doctor_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (doctor_id) REFERENCES auth.users(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescription_templates.prescription_templates_doctor_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (doctor_id) REFERENCES auth.users(id)' THEN EXECUTE 'ALTER TABLE public."prescription_templates" DROP CONSTRAINT "prescription_templates_doctor_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescription_templates" ADD CONSTRAINT "prescription_templates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES auth.users(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescriptions'::regclass AND conname='prescriptions_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescriptions.prescriptions_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."prescriptions" DROP CONSTRAINT "prescriptions_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.prescriptions'::regclass AND conname='prescriptions_doctor_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL','FOREIGN KEY (doctor_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.prescriptions.prescriptions_doctor_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (doctor_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."prescriptions" DROP CONSTRAINT "prescriptions_doctor_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.profile_audit_log'::regclass AND conname='profile_audit_log_target_user_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE','FOREIGN KEY (target_user_id) REFERENCES profiles(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.profile_audit_log.profile_audit_log_target_user_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (target_user_id) REFERENCES profiles(id)' THEN EXECUTE 'ALTER TABLE public."profile_audit_log" DROP CONSTRAINT "profile_audit_log_target_user_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."profile_audit_log" ADD CONSTRAINT "profile_audit_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.service_categories'::regclass AND conname='service_categories_clinic_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE','FOREIGN KEY (clinic_id) REFERENCES clinics(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.service_categories.service_categories_clinic_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (clinic_id) REFERENCES clinics(id)' THEN EXECUTE 'ALTER TABLE public."service_categories" DROP CONSTRAINT "service_categories_clinic_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."service_categories" ADD CONSTRAINT "service_categories_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinics(id)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.service_categories'::regclass AND conname='service_categories_clinic_id_name_key';
IF actual IS NOT NULL AND actual NOT IN ('UNIQUE (clinic_id, name)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.service_categories.service_categories_clinic_id_name_key'; END IF;
IF EXISTS(SELECT 1 FROM public."service_categories" WHERE "clinic_id" IS NOT NULL AND "name" IS NOT NULL GROUP BY clinic_id, name HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: public.service_categories.service_categories_clinic_id_name_key'; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."service_categories" ADD CONSTRAINT "service_categories_clinic_id_name_key" UNIQUE (clinic_id, name)'; END IF;
END $constraint$;
DO $constraint$ DECLARE actual text; BEGIN
SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_category_id_fkey';
IF actual IS NOT NULL AND actual NOT IN ('FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL','FOREIGN KEY (category_id) REFERENCES service_categories(id)') THEN RAISE EXCEPTION 'Unreviewed constraint drift: public.services.services_category_id_fkey'; END IF;
IF actual IS NOT NULL AND actual<>'FOREIGN KEY (category_id) REFERENCES service_categories(id)' THEN EXECUTE 'ALTER TABLE public."services" DROP CONSTRAINT "services_category_id_fkey"'; actual:=NULL; END IF;
IF actual IS NULL THEN EXECUTE 'ALTER TABLE public."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY (category_id) REFERENCES service_categories(id)'; END IF;
END $constraint$;
ALTER TABLE public.clinics ALTER COLUMN size TYPE varchar(50);
ALTER SEQUENCE public.profile_audit_log_id_seq OWNED BY public.profile_audit_log.id;
CREATE INDEX IF NOT EXISTS idx_access_audit_clinic_id ON logs.access_audit USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_email ON public.clinic_invitations USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_status ON public.clinic_invitations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_clinic_members_auth_lookup ON public.clinic_members USING btree (user_id, clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_id ON public.clinical_records USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_tenant ON public.data_rights_requests USING btree (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_type ON public.data_rights_requests USING btree (clinic_id, request_type);
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_clinic_id ON public.hcu033_forms USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_tenant_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_patient ON public.patient_files USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON public.patient_notes USING btree (patient_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_deleted ON public.patients USING btree (clinic_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_patients_family_rep ON public.patients USING btree (family_representative_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_doctor ON public.prescriptions USING btree (clinic_id, doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles USING btree (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles USING btree (email) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_license_key ON public.profiles USING btree (license_number) WHERE (license_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON public.appointments USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start ON public.appointments USING btree (clinic_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_conflict ON public.appointments USING btree (clinic_id, doctor_id, start_time, end_time) WHERE (status <> 'cancelled'::text);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_doctor ON public.appointments USING btree (clinic_id, patient_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient ON public.clinical_records USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_clinic_patient ON public.data_rights_requests USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_hcu033_clinic_patient ON public.hcu033_forms USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_clinic_patient ON public.patient_files USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic_patient ON public.patient_notes USING btree (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_cedula ON public.patients USING btree (clinic_id, cedula);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_created ON public.prescriptions USING btree (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient ON public.prescriptions USING btree (clinic_id, patient_id);


-- PINNED REFERENCE: docs/production/reconciliation/encargo02/forward.sql
-- REVIEWABLE LOCAL SYNTHETIC FORWARD ONLY. NOT a deployable migration; M7 NOT READY.
-- Read README five questions / acceptance BEFORE execution. No data copies or deletes.
-- Executor must independently prove loopback Docker identity; GUCs do not prove locality.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = '';

DO $preflight$
DECLARE v_table text; v_constraint text; r record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'Reviewed postgres executor required; reconcile ownership in encargo01';
  END IF;
  -- Target/baseline/recovery authorization is checked atomically by hosted-v2 executor.
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
  THEN RAISE EXCEPTION 'Genuine Supabase PostgreSQL17 Auth/Storage required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass AND attname='owner_id' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'Managed Storage owner_id contract absent; review runtime version'; END IF;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','patient_notes','patient_files','hcu033_forms','data_rights_requests','billings','invoices'] LOOP
    v_constraint := v_table || '_patient_clinic_fkey';
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=to_regclass('public.'||v_table) AND conname=v_constraint AND convalidated AND contype='f'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='patient_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.'||v_table) AND attname='clinic_id')]::smallint[]
      AND confrelid='public.patients'::regclass
      AND confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.patients'::regclass AND attname='clinic_id')]::smallint[])
    THEN RAISE EXCEPTION 'Validated M7 patient/clinic constraint required on %',v_table; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_id_clinic_id_key' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.patients'::regclass AND conname='patients_family_clinic_fkey' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.clinic_members'::regclass AND contype='u' AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='user_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.clinic_members'::regclass AND attname='clinic_id')]::smallint[])
  THEN RAISE EXCEPTION 'M7 family/parent key and unique membership prerequisites required'; END IF;
  IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_audit_data_rights_status' AND tgenabled='O')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.data_rights_requests'::regclass AND tgname='trg_protect_data_rights_requests' AND tgenabled='O')
  THEN RAISE EXCEPTION 'M7 rights protection/status audit required'; END IF;
  -- Captured M7 callbacks must match BEFORE replacement. Do not silently re-own
  -- supabase_admin-created helpers: encargo01 must reconcile that explicitly.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Application callback owner drift; reconcile explicitly in encargo01'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('logs.log_access_trigger()','a28f2f2bbb746e80661dc2f7a5275c9f'),
    ('public.guard_data_rights_request_insert()','88e654c014bc9969fe94c3580d558503'),
    ('public.protect_data_rights_requests()','fe0ff58b269ecb6cc3462e5ab73ffe59'),
    ('public.purge_clinic_data(uuid)','49eab5876aeb4502a69adc3804c35945'),
    ('security_internal.audit_data_rights_status()','043465d08eb08c1752562f09cafe048c'),
    ('security_internal.enforce_clinician_assignment()','87184b33612e86bfcc8c153db1449307')
  ) AS expected(identity,body_md5) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(r.identity)
      AND md5(replace(p.prosrc,E'\r\n',E'\n'))=r.body_md5
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      AND p.proconfig @> ARRAY['search_path=""']::text[])
    THEN RAISE EXCEPTION 'Captured M7 callback differs: %; reconcile in encargo01',r.identity; END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['appointments','prescriptions','clinical_records','hcu033_forms'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=to_regclass('public.'||v_table)
      AND t.tgname='trg_enforce_clinician_assignment' AND t.tgenabled='O' AND t.tgtype=23
      AND t.tgfoid=to_regprocedure('security_internal.enforce_clinician_assignment()') AND NOT t.tgisinternal
      AND t.tgattr::text=(SELECT a.attnum::text||' '||b.attnum::text FROM pg_catalog.pg_attribute a,pg_catalog.pg_attribute b
        WHERE a.attrelid=t.tgrelid AND b.attrelid=t.tgrelid AND a.attname='doctor_id' AND b.attname='clinic_id'))
    THEN RAISE EXCEPTION 'Exact enabled M7 clinician trigger required on %',v_table; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('trg_guard_data_rights_request_insert','public.guard_data_rights_request_insert()',7),
    ('trg_protect_data_rights_requests','public.protect_data_rights_requests()',19),
    ('trg_audit_data_rights_status','security_internal.audit_data_rights_status()',17)
  ) AS expected(name,identity,flags) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.data_rights_requests'::regclass
      AND t.tgname=r.name AND t.tgenabled='O' AND t.tgfoid=to_regprocedure(r.identity) AND t.tgtype=r.flags AND NOT t.tgisinternal)
    THEN RAISE EXCEPTION 'Exact enabled M7 rights callback required: %',r.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.clinic_members GROUP BY user_id,clinic_id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate memberships require explicit review'; END IF;
  -- Provision these empty synthetic buckets through the genuine Storage API before SQL.
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND NOT public)<>4
    OR EXISTS (SELECT 1 FROM storage.buckets WHERE public)
  THEN RAISE EXCEPTION 'All local buckets must be private; required four buckets provisioned via API'; END IF;
END;
$preflight$;

-- Neutralize observed global/schema defaults and all inherited application client grants.
-- Column privileges are independent: revoke them too before granting explicit columns.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SCHEMA logs,security_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON TYPE public.app_role,public.user_status TO authenticated;
-- subscription_status keeps existing default ACL; no redundant grant.
DO $close$
DECLARE r record; v_columns text;
BEGIN
  FOR r IN SELECT n.nspname,c.relname,c.relkind,c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S') LOOP
    IF r.relkind='S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      EXECUTE format('GRANT ALL ON SEQUENCE %I.%I TO service_role',r.nspname,r.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated',r.nspname,r.relname);
      SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns FROM pg_catalog.pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
      IF v_columns IS NOT NULL THEN EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE %I.%I FROM PUBLIC,anon,authenticated',v_columns,v_columns,v_columns,v_columns,r.nspname,r.relname); END IF;
      IF r.relkind IN ('r','p') THEN
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.nspname,r.relname);
        EXECUTE format('GRANT ALL ON TABLE %I.%I TO service_role',r.nspname,r.relname);
      END IF;
      IF r.relkind='v' THEN EXECUTE format('ALTER VIEW %I.%I SET (security_invoker=true)',r.nspname,r.relname); END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.nspname,r.proname,r.args);
  END LOOP;
  -- Remove every captured policy in owned app scope, not only known naming variants.
  -- Recreate only accepted grants/policies below. Storage is synthetic project scope.
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies WHERE schemaname IN ('public','logs','security_internal') OR (schemaname='storage' AND tablename='objects') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
  END LOOP;
END;
$close$;

-- Auth callbacks never convert editable signup metadata into tenant authority.
-- Both baseline variants receive a profile-only insert callback. Onboarding and
-- invitation acceptance need their own reviewed server contract in encargo10B.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  INSERT INTO public.profiles(id,full_name,email,status)
  VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),120),NEW.email,'active'::public.user_status)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  -- Preserve the Auth row; no profile role, clinic, membership or invitation write.
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user(),public.handle_verified_clinic_creation() FROM PUBLIC,anon,authenticated,service_role;

-- Private role lookup accepts a target user ONLY for trusted clinician-assignment code.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_clinic_member_role(check_clinic_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    THEN security_internal.role_for(check_clinic_id,auth.uid()) END;
$function$;
CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT public.get_clinic_member_role(check_clinic_id) IS NOT NULL; $function$;
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  -- Deterministic preference, never authorization. No stale JWT or primary-profile fallback.
  SELECT m.clinic_id FROM public.clinic_members m
  WHERE m.user_id=auth.uid() AND public.is_clinic_member(m.clinic_id)
  ORDER BY m.created_at,m.clinic_id LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.is_clinic_member(check_clinic_id) AND EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.id=check_clinic_id AND c.archived_at IS NULL
      AND (c.bypass_subscription IS TRUE OR c.subscription_status::text='active' OR c.trial_ends_at>now()));
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_member_role(uuid),public.is_clinic_member(uuid),public.get_user_clinic_id(),public.check_subscription_active(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    -- A committed revocation precedes denial of the next operation; writes already
    -- authorized hold these rows until completion, so revocation cannot race the write.
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Explicit demographic projection. No full-row to_jsonb(patient) return.
CREATE OR REPLACE FUNCTION security_internal.patient_demographic(p public.patients)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',p.id,'clinic_id',p.clinic_id,'first_name',p.first_name,'last_name',p.last_name,
    'cedula',p.cedula,'email',p.email,'phone',p.phone,'address',p.address,'city',p.city,'state',p.state,
    'birth_date',p.birth_date,'gender',p.gender,'status',p.status,'occupation',p.occupation,
    'guardian_name',p.guardian_name,'medical_record_number',p.medical_record_number,
    'emergency_contact',p.emergency_contact,'emergency_phone',p.emergency_phone,'marital_status',p.marital_status,
    'preferred_contact_method',p.preferred_contact_method,'avatar_url',p.avatar_url,
    'family_representative_id',p.family_representative_id,'family_relationship',p.family_relationship,
    'is_family_head',p.is_family_head,'created_at',p.created_at,'updated_at',p.updated_at);
$function$;
REVOKE ALL ON FUNCTION security_internal.patient_demographic(public.patients) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_patient_demographics(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 25,p_offset integer DEFAULT 0,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
      AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),
    'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_patient_demographics(p_clinic_id uuid,p_data jsonb,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.patients; v_input public.patients; v_key text; v_value jsonb;
  v_allowed constant text[]:=ARRAY['first_name','last_name','cedula','email','phone','address','city','state','birth_date','gender','status','occupation','guardian_name','medical_record_number','emergency_contact','emergency_phone','marital_status','preferred_contact_method'];
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>12000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF NOT(v_key=ANY(v_allowed)) OR jsonb_typeof(v_value) NOT IN ('string','null') OR length(p_data->>v_key)>500
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (p_data?'first_name' AND coalesce(length(btrim(p_data->>'first_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'last_name' AND coalesce(length(btrim(p_data->>'last_name')),0) NOT BETWEEN 1 AND 120)
    OR (p_data?'status' AND (p_data->>'status' IS NULL OR (p_data->>'status') NOT IN ('active','inactive')))
    OR (p_data?'preferred_contact_method' AND (p_data->>'preferred_contact_method' IS NULL OR (p_data->>'preferred_contact_method') NOT IN ('phone','email','whatsapp')))
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.patients WHERE id=p_patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT(p_data?'first_name' AND p_data?'last_name') THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
    v_row.status:='active'; v_row.preferred_contact_method:='phone';
  END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.birth_date>current_date OR (v_input.birth_date IS NOT NULL AND v_input.birth_date<date '1850-01-01')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_patient_id IS NULL THEN
    INSERT INTO public.patients(clinic_id,first_name,last_name,cedula,email,phone,address,city,state,birth_date,gender,status,occupation,guardian_name,medical_record_number,emergency_contact,emergency_phone,marital_status,preferred_contact_method)
    VALUES(p_clinic_id,btrim(v_input.first_name),btrim(v_input.last_name),v_input.cedula,v_input.email,v_input.phone,v_input.address,v_input.city,v_input.state,v_input.birth_date,v_input.gender,v_input.status,v_input.occupation,v_input.guardian_name,v_input.medical_record_number,v_input.emergency_contact,v_input.emergency_phone,v_input.marital_status,v_input.preferred_contact_method) RETURNING * INTO v_row;
  ELSE
    UPDATE public.patients SET first_name=btrim(v_input.first_name),last_name=btrim(v_input.last_name),cedula=v_input.cedula,email=v_input.email,phone=v_input.phone,address=v_input.address,city=v_input.city,state=v_input.state,birth_date=v_input.birth_date,gender=v_input.gender,status=v_input.status,occupation=v_input.occupation,guardian_name=v_input.guardian_name,medical_record_number=v_input.medical_record_number,emergency_contact=v_input.emergency_contact,emergency_phone=v_input.emergency_phone,marital_status=v_input.marital_status,preferred_contact_method=v_input.preferred_contact_method,updated_at=now()
    WHERE id=p_patient_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.patient_demographic(v_row);
EXCEPTION WHEN data_exception OR check_violation OR unique_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_clinic_staff_directory(p_clinic_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'specialization',p.specialization,'avatar_url',p.avatar_url,'role',m.role,'title',p.title) ORDER BY p.full_name,p.id),'[]'::jsonb)
    INTO v_result FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    WHERE m.clinic_id=p_clinic_id AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL AND m.role IN ('doctor','clinic_owner','receptionist');
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION security_internal.appointment_operational(a public.appointments,p_include_notes boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT jsonb_build_object('id',a.id,'clinic_id',a.clinic_id,'patient_id',a.patient_id,'doctor_id',a.doctor_id,'start_time',a.start_time,'end_time',a.end_time,'status',a.status,'type',a.type,'created_at',a.created_at,
    'patients',(SELECT jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) FROM public.patients p WHERE p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL),
    'profiles',(SELECT jsonb_build_object('id',p.id,'full_name',p.full_name) FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id WHERE p.id=a.doctor_id AND m.clinic_id=a.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL))
    || CASE WHEN p_include_notes THEN jsonb_build_object('notes',a.notes) ELSE '{}'::jsonb END;
$function$;
REVOKE ALL ON FUNCTION security_internal.appointment_operational(public.appointments,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_clinic_schedule(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_result jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR p_end<=p_start OR p_end-p_start>interval '93 days'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  -- Set-based joins, not a paginated patient list and not a per-appointment RPC.
  WITH matched AS MATERIALIZED (
    SELECT a.id,a.clinic_id,a.patient_id,a.doctor_id,a.start_time,a.end_time,a.status,a.type,a.created_at,a.notes,
      jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'email',p.email) AS patients,
      CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'full_name',d.full_name) END AS profiles
    FROM public.appointments a JOIN public.patients p ON p.id=a.patient_id AND p.clinic_id=a.clinic_id AND p.deleted_at IS NULL
    LEFT JOIN (SELECT pf.id,m.clinic_id,pf.full_name FROM public.profiles pf JOIN public.clinic_members m ON m.user_id=pf.id WHERE pf.status::text='active' AND pf.deleted_at IS NULL AND m.status='active' AND m.role IN ('doctor','clinic_owner')) d ON d.id=a.doctor_id AND d.clinic_id=a.clinic_id
    WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time<p_end AND a.end_time>p_start
  ) SELECT jsonb_build_object('items',coalesce(jsonb_agg((to_jsonb(matched)-'notes')||CASE WHEN v_role IN ('doctor','clinic_owner') THEN jsonb_build_object('notes',notes) ELSE '{}'::jsonb END ORDER BY start_time,id),'[]'::jsonb),'total_count',count(*)) INTO v_result FROM matched;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null')
      OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner'))
      OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000)
    THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time<=v_input.start_time
    OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','completed','cancelled','no_show')
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF v_input.doctor_id IS NOT NULL AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'doctor' AND security_internal.role_for(p_clinic_id,v_input.doctor_id) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,v_input.type,v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=v_input.type,status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Exact identity replacement, no CASCADE: unknown dependencies must stop the review.
DROP FUNCTION IF EXISTS public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid);
CREATE FUNCTION public.get_patients_with_stats(p_clinic_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 12,p_offset integer DEFAULT 0,p_time_filter text DEFAULT 'all',p_badge_filter text DEFAULT 'all',p_group_by_family boolean DEFAULT false,p_patient_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor']);
  -- Historical commercial badges are removed, not simulated with zero revenues.
  IF coalesce(p_time_filter,'all')<>'all' OR coalesce(p_badge_filter,'all')<>'all' OR p_group_by_family IS TRUE
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>200
  THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  WITH matched AS MATERIALIZED (
    SELECT p FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL AND (p_patient_id IS NULL OR p.id=p_patient_id)
      AND (coalesce(p_search,'')='' OR concat_ws(' ',p.first_name,p.last_name,p.cedula,p.email,p.phone,p.medical_record_number) ILIKE '%'||p_search||'%')
  ), page AS (SELECT p FROM matched ORDER BY (p).created_at DESC,(p).id DESC LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(security_internal.patient_demographic(p)||jsonb_build_object('medical_history',(p).medical_history,'medical_alerts',(p).medical_alerts,'clinical_notes',(p).clinical_notes,'allergies',(p).allergies,'medications',(p).medications,'medical_conditions',(p).medical_conditions,'blood_type',(p).blood_type,'has_diabetes',(p).has_diabetes,'has_hypertension',(p).has_hypertension,'has_heart_disease',(p).has_heart_disease,'is_smoker',(p).is_smoker,'is_pregnant',(p).is_pregnant,'odontogram_state',(p).odontogram_state,'periodontogram_state',(p).periodontogram_state,'internal_notes',(p).internal_notes,'last_treatment_note',(p).last_treatment_note) ORDER BY (p).created_at DESC,(p).id DESC) FROM page),'[]'::jsonb),'total_count',(SELECT count(*) FROM matched)) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Public API allowlist; all historical finance, archive/purge, secure-profile and
-- family-statistics endpoints stay closed. Trigger execution does not need client EXECUTE.
REVOKE ALL ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_demographics(uuid,text,integer,integer,uuid),public.save_patient_demographics(uuid,jsonb,uuid),public.get_clinic_staff_directory(uuid),public.get_clinic_schedule(uuid,timestamptz,timestamptz),public.save_clinic_appointment(uuid,jsonb,uuid),public.get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid) TO authenticated;

-- COLUMN_GRANTS: clinical base access excludes financial/insurance columns for all clients.
GRANT SELECT (id,created_at,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,clinic_id,emergency_contact,emergency_phone,allergies,medications,medical_conditions,deleted_at,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at) ON public.patients TO authenticated;
GRANT INSERT (clinic_id,first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state) ON public.patients TO authenticated;
GRANT UPDATE (first_name,last_name,cedula,email,phone,birth_date,gender,address,medical_history,emergency_contact,emergency_phone,allergies,medications,medical_conditions,medical_alerts,occupation,guardian_name,referral_source,referred_by,clinical_notes,medical_record_number,tags,status,blood_type,marital_status,city,state,has_diabetes,has_hypertension,has_heart_disease,is_smoker,is_pregnant,preferred_contact_method,recall_months,family_representative_id,internal_notes,family_relationship,is_family_head,last_treatment_note,odontogram_state,avatar_url,periodontogram_state,updated_at,deleted_at) ON public.patients TO authenticated;
CREATE POLICY encargo02_patients_read ON public.patients FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_patients_insert ON public.patients FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_patients_update ON public.patients FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));

GRANT SELECT ON public.appointments,public.clinical_records,public.hcu033_forms,public.prescriptions,public.patient_notes,public.patient_files,public.prescription_templates TO authenticated;
-- Server defaults own IDs/creation time; updates cannot move tenant/patient/author.
GRANT INSERT (clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes) ON public.appointments TO authenticated;
GRANT UPDATE (doctor_id,start_time,end_time,status,type,notes,deleted_at) ON public.appointments TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state) ON public.clinical_records TO authenticated;
GRANT UPDATE (diagnosis,treatment_plan,xray_urls,notes,odontogram_state,periodontogram_state,deleted_at) ON public.clinical_records TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,form_data) ON public.hcu033_forms TO authenticated;
GRANT UPDATE (form_data,deleted_at) ON public.hcu033_forms TO authenticated;
GRANT INSERT (clinic_id,patient_id,doctor_id,data) ON public.prescriptions TO authenticated;
GRANT UPDATE (data) ON public.prescriptions TO authenticated;
GRANT INSERT (clinic_id,patient_id,author_id,content) ON public.patient_notes TO authenticated;
GRANT UPDATE (content,deleted_at) ON public.patient_notes TO authenticated;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (clinic_id,doctor_id,name,data) ON public.prescription_templates TO authenticated;
GRANT UPDATE (name,data) ON public.prescription_templates TO authenticated;
CREATE POLICY encargo02_appointments_read ON public.appointments FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL);
CREATE POLICY encargo02_appointments_insert ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
CREATE POLICY encargo02_appointments_update ON public.appointments FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id) AND deleted_at IS NULL) WITH CHECK (public.get_clinic_member_role(clinic_id) IN ('doctor','clinic_owner') AND public.check_subscription_active(clinic_id));
DO $clinical_policies$
DECLARE t text; v_author text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    v_author:=CASE t WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' ELSE 'doctor_id' END;
    EXECUTE format('CREATE POLICY encargo02_clinical_read ON public.%I FOR SELECT TO authenticated USING (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id))',t);
    EXECUTE format('CREATE POLICY encargo02_clinical_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id) IN (''doctor'',''clinic_owner'') AND public.check_subscription_active(clinic_id) AND %I=auth.uid())',t,v_author);
    EXECUTE format('CREATE POLICY encargo02_clinical_update ON public.%I FOR UPDATE TO authenticated USING (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid()))) WITH CHECK (public.check_subscription_active(clinic_id) AND (public.get_clinic_member_role(clinic_id)=''clinic_owner'' OR (public.get_clinic_member_role(clinic_id)=''doctor'' AND %I=auth.uid())))',t,v_author,v_author);
  END LOOP;
END;
$clinical_policies$;

-- Team authority cannot be mutated directly. A user may see their inactive own
-- membership/profile to show an honest denial, never other clinic data.
GRANT SELECT ON public.clinic_members TO authenticated;
CREATE POLICY encargo02_members_read ON public.clinic_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name,avatar_url,phone,address,bio,title,updated_at) ON public.profiles TO authenticated;
CREATE POLICY encargo02_profile_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY encargo02_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() AND status::text='active' AND deleted_at IS NULL) WITH CHECK (id=auth.uid() AND status::text='active' AND deleted_at IS NULL);
GRANT SELECT (id,name,address,phone,email,logo_url,size,working_hours,settings,disclaimer_text,created_at,owner_id) ON public.clinics TO authenticated;
GRANT UPDATE (name,address,phone,email,logo_url,working_hours,disclaimer_text) ON public.clinics TO authenticated;
CREATE POLICY encargo02_clinics_read ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id));
CREATE POLICY encargo02_clinics_update ON public.clinics FOR UPDATE TO authenticated USING (public.get_clinic_member_role(id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(id)='clinic_owner');
GRANT SELECT (id,clinic_id,name,description,duration_minutes,category,is_active,created_at,updated_at,color,category_id) ON public.services TO authenticated;
GRANT UPDATE (name,description,duration_minutes,category,is_active,color,category_id,updated_at) ON public.services TO authenticated;
CREATE POLICY encargo02_services_read ON public.services FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_services_update ON public.services FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
GRANT SELECT ON public.service_categories TO authenticated;
GRANT INSERT (clinic_id,name,color) ON public.service_categories TO authenticated;
GRANT UPDATE (name,color) ON public.service_categories TO authenticated;
CREATE POLICY encargo02_categories_read ON public.service_categories FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY encargo02_categories_insert ON public.service_categories FOR INSERT TO authenticated WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');
CREATE POLICY encargo02_categories_update ON public.service_categories FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- M7 rights triggers remain intact; only row predicates stop depending on stale claims.
GRANT SELECT ON public.data_rights_requests TO authenticated;
GRANT INSERT (clinic_id,user_id,patient_id,request_type,details,legal_basis,retention_note) ON public.data_rights_requests TO authenticated;
GRANT UPDATE (status,resolution_notes) ON public.data_rights_requests TO authenticated;
CREATE POLICY encargo02_rights_read ON public.data_rights_requests FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id) AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
CREATE POLICY encargo02_rights_insert ON public.data_rights_requests FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id) AND user_id=auth.uid() AND status='pending' AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_notes IS NULL);
CREATE POLICY encargo02_rights_update ON public.data_rights_requests FOR UPDATE TO authenticated USING (public.get_clinic_member_role(clinic_id)='clinic_owner') WITH CHECK (public.get_clinic_member_role(clinic_id)='clinic_owner');

-- AUTHORITY_TRIGGERS: no primary profile clinic or ownership fallback.
CREATE OR REPLACE FUNCTION security_internal.enforce_clinician_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.doctor_id IS NOT NULL AND coalesce(security_internal.role_for(NEW.clinic_id,NEW.doctor_id),'') NOT IN ('doctor','clinic_owner')
  THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
-- Safe autofill occurs before identity/author checks for HCU. clinic_id stays
-- explicit; a stale JWT default must not choose another active clinic silently.
ALTER TABLE public.hcu033_forms ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.prescription_templates ALTER COLUMN clinic_id DROP DEFAULT;
CREATE OR REPLACE FUNCTION security_internal.prepare_hcu033_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='INSERT' AND NEW.doctor_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.doctor_id:=auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS encargo02_00_prepare_author ON public.hcu033_forms;
CREATE TRIGGER encargo02_00_prepare_author BEFORE INSERT ON public.hcu033_forms FOR EACH ROW EXECUTE FUNCTION security_internal.prepare_hcu033_author();
-- Replace the existing production synchronization callback without a JWT or
-- patient-derived tenant fallback; keep the baseline's trigger if present.
CREATE OR REPLACE FUNCTION public.sync_hcu033_form_clinic_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NEW.clinic_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=NEW.patient_id AND p.clinic_id=NEW.clinic_id)
  THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_patient_odontogram_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Patient + clinic partition is guaranteed by M7 and checked again here.
  -- Preserve the historical summary behavior without editing financial fields.
  IF jsonb_typeof(NEW.form_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid clinical document' USING ERRCODE='22023';
  END IF;
  IF NOT (NEW.form_data ?| ARRAY['odontograma_descripcion','odontograma_data']) THEN RETURN NEW; END IF;
  UPDATE public.patients SET last_treatment_note=CASE WHEN NEW.form_data ? 'odontograma_descripcion' THEN NEW.form_data->>'odontograma_descripcion' ELSE last_treatment_note END,
    odontogram_state=CASE WHEN NEW.form_data ? 'odontograma_data' THEN NEW.form_data->'odontograma_data' ELSE odontogram_state END,updated_at=now()
  WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinical reference' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.prepare_hcu033_author(),public.sync_hcu033_form_clinic_id(),public.update_patient_odontogram_summary() FROM PUBLIC,anon,authenticated,service_role;
-- Canonical callbacks in both source variants; absence in stage is not success.
DROP TRIGGER IF EXISTS trg_sync_hcu033_form_clinic_id ON public.hcu033_forms;
CREATE TRIGGER trg_sync_hcu033_form_clinic_id BEFORE INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.sync_hcu033_form_clinic_id();
DROP TRIGGER IF EXISTS tr_update_patient_odontogram ON public.hcu033_forms;
CREATE TRIGGER tr_update_patient_odontogram AFTER INSERT OR UPDATE ON public.hcu033_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_patient_odontogram_summary();
DO $audit_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','clinical_records','hcu033_forms'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','audit_'||t,t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger()','audit_'||t,t);
  END LOOP;
END;
$audit_triggers$;
CREATE OR REPLACE FUNCTION security_internal.protect_clinical_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_author_column text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
BEGIN
  IF auth.role()='service_role' OR (auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR ((v_new?'patient_id') AND v_new->'patient_id' IS DISTINCT FROM v_old->'patient_id')
    THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='42501'; END IF;
  END IF;
  v_author_column:=CASE TG_TABLE_NAME WHEN 'patient_notes' THEN 'author_id' WHEN 'patient_files' THEN 'uploaded_by' WHEN 'appointments' THEN NULL WHEN 'patients' THEN NULL ELSE 'doctor_id' END;
  IF v_author_column IS NOT NULL THEN
    IF TG_OP='INSERT' AND v_new->>v_author_column IS DISTINCT FROM auth.uid()::text
      OR TG_OP='UPDATE' AND v_new->v_author_column IS DISTINCT FROM v_old->v_author_column
    THEN RAISE EXCEPTION 'Immutable clinical author' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_TABLE_NAME='patient_files' THEN
    IF TG_OP='UPDATE' AND NEW.file_path IS DISTINCT FROM OLD.file_path
    THEN RAISE EXCEPTION 'Immutable file path' USING ERRCODE='42501'; END IF;
    IF NEW.file_path !~ ('^'||NEW.clinic_id::text||'/'||NEW.patient_id::text||'/[^/]+$')
    THEN RAISE EXCEPTION 'Invalid file path' USING ERRCODE='23514'; END IF;
  END IF;
  IF v_new?'updated_at' THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object('updated_at',now())); END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.enforce_clinician_assignment(),security_internal.protect_clinical_identity() FROM PUBLIC,anon,authenticated,service_role;
DO $identity_triggers$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','appointments','clinical_records','hcu033_forms','prescriptions','patient_notes','patient_files','prescription_templates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS encargo02_protect_identity ON public.%I',t);
    EXECUTE format('CREATE TRIGGER encargo02_protect_identity BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION security_internal.protect_clinical_identity()',t);
  END LOOP;
END;
$identity_triggers$;

-- Category references must stay in the service's clinic, even for an owner of
-- both clinics. Existing invalid historical links stop review; never repair by deletion.
DO $category_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.services s JOIN public.service_categories c ON c.id=s.category_id WHERE s.clinic_id IS DISTINCT FROM c.clinic_id)
  THEN RAISE EXCEPTION 'Historical category/clinic mismatch requires reconciliation'; END IF;
END;
$category_preflight$;
CREATE OR REPLACE FUNCTION security_internal.protect_service_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.created_at IS DISTINCT FROM OLD.created_at)
  THEN RAISE EXCEPTION 'Immutable service identity' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='services' THEN
    IF NEW.category_id IS NOT NULL THEN
      PERFORM 1 FROM public.service_categories c WHERE c.id=NEW.category_id AND c.clinic_id=NEW.clinic_id FOR KEY SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invalid category reference' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.protect_service_reference() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.services;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();
DROP TRIGGER IF EXISTS encargo02_protect_reference ON public.service_categories;
CREATE TRIGGER encargo02_protect_reference BEFORE INSERT OR UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION security_internal.protect_service_reference();

CREATE OR REPLACE FUNCTION public.remove_clinic_member(p_target_user_id uuid,p_clinic_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_target_role text;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner'],true);
  IF p_target_user_id IS NULL OR p_target_user_id=auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_target_role FROM public.clinic_members WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id FOR UPDATE;
  IF NOT FOUND OR v_target_role='clinic_owner' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  -- Revoke the tenant membership only. Do not alter another clinic's profile,
  -- primary-clinic preference, clinical authorship, Auth account or historical rows.
  UPDATE public.clinic_members SET status='removed' WHERE user_id=p_target_user_id AND clinic_id=p_clinic_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_clinic_member(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid,uuid) TO authenticated;

-- Safely parse path segments before casts; policies never cast malformed input.
CREATE OR REPLACE FUNCTION security_internal.storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[]; v_clinic uuid; v_patient uuid; v_role text;
BEGIN
  v_parts:=string_to_array(p_name,'/');
  IF p_name IS NULL OR length(p_name)>500 OR p_name LIKE '%..%' THEN RETURN false; END IF;
  IF p_bucket IN ('patient-files','patient-avatars') THEN
    IF array_length(v_parts,1)<>3 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR v_parts[2]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[3],'')=''
    THEN RETURN false; END IF;
    v_clinic:=v_parts[1]::uuid; v_patient:=v_parts[2]::uuid;
    v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (p_bucket='patient-avatars' OR v_role IN ('doctor','clinic_owner'))
      AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id=v_patient AND p.clinic_id=v_clinic AND p.deleted_at IS NULL);
  ELSIF p_bucket IN ('clinic-branding','doctor-avatars') THEN
    IF array_length(v_parts,1)<>2 OR v_parts[1]!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR coalesce(v_parts[2],'')=''
    THEN RETURN false; END IF;
    IF p_bucket='doctor-avatars' THEN
      -- Read a colleague only through a shared live clinic. A removed user cannot
      -- keep avatar privileges solely because their personal profile is active.
      RETURN (NOT p_write OR v_parts[1]=auth.uid()::text) AND EXISTS (
        SELECT 1 FROM public.profiles p JOIN public.clinic_members m ON m.user_id=p.id
        WHERE p.id=v_parts[1]::uuid AND p.status::text='active' AND p.deleted_at IS NULL
          AND m.status='active' AND m.role IN ('doctor','clinic_owner')
          AND public.check_subscription_active(m.clinic_id));
    END IF;
    v_clinic:=v_parts[1]::uuid; v_role:=public.get_clinic_member_role(v_clinic);
    RETURN public.check_subscription_active(v_clinic) AND v_role IS NOT NULL AND (NOT p_write OR v_role='clinic_owner');
  END IF;
  RETURN false;
END;
$function$;
CREATE OR REPLACE FUNCTION security_internal.storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_parts text[];
BEGIN
  IF NOT security_internal.storage_access(p_bucket,p_name,true) THEN RETURN false; END IF;
  IF p_bucket<>'patient-files' THEN RETURN true; END IF;
  -- Access helper already checked shape, UUIDs, active patient and live role.
  v_parts:=string_to_array(p_name,'/');
  RETURN NOT EXISTS (SELECT 1 FROM public.patient_files f WHERE f.clinic_id=v_parts[1]::uuid
    AND f.patient_id=v_parts[2]::uuid AND f.file_path=p_name);
END;
$function$;
CREATE OR REPLACE FUNCTION public.encargo02_storage_replace_allowed(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_replace_allowed(p_bucket,p_name); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_replace_allowed(text,text),public.encargo02_storage_replace_allowed(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_replace_allowed(text,text) TO authenticated;
-- RLS calls helper through a public wrapper; private schema remains unexposed.
CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$ SELECT security_internal.storage_access(p_bucket,p_name,p_write); $function$;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean),public.encargo02_storage_access(text,text,boolean) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION security_internal.storage_access(text,text,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.encargo02_storage_access(text,text,boolean) TO authenticated;
CREATE POLICY encargo02_storage_read ON storage.objects FOR SELECT TO authenticated USING (public.encargo02_storage_access(bucket_id,name,false));
CREATE POLICY encargo02_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));
CREATE POLICY encargo02_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name))
  WITH CHECK (owner_id=auth.uid()::text AND public.encargo02_storage_replace_allowed(bucket_id,name));
-- No client DELETE of patient bytes: clinical custody cannot be undone by a UI button.
CREATE POLICY encargo02_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('clinic-branding','doctor-avatars') AND owner_id=auth.uid()::text AND public.encargo02_storage_access(bucket_id,name,true));

-- Known historical hooks, if present, remain Auth-only. Verify configuration in01/10B.
DO $auth_hook$
BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin; END IF;
END;
$auth_hook$;
-- Explicit owner assertion for every created/replaced callback. Existing owners
-- were checked before DDL; postgres creates new functions. No ALTER OWNER repair.
DO $callback_owners$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','logs','security_internal') AND p.prokind='f' AND pg_catalog.pg_get_userbyid(p.proowner)<>'postgres')
  THEN RAISE EXCEPTION 'Callback must be owned by postgres; no silent reattribution'; END IF;
END;
$callback_owners$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: docs/production/reconciliation/operational-convergence/after-authority.sql
-- Reviewed LOCAL SYNTHETIC ONLY. Run after encargo02, before agenda migration.
-- Canonical callbacks replace historical role/ownership/GUC fallbacks.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed local authority prerequisites required'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Actual maintenance sessions only; no editable custom GUC bypass.
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_changed text[]; v_before jsonb; v_after jsonb;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO v_changed FROM jsonb_object_keys(to_jsonb(NEW)) AS keys(k)
    WHERE k<>'updated_at' AND to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k;
  IF v_changed IS NULL THEN RETURN NEW; END IF;
  -- Only authorization values, never full profile/contact information in audit payload.
  v_before:=jsonb_build_object('role',OLD.role,'clinic_id',OLD.clinic_id,'status',OLD.status,'deleted_at',OLD.deleted_at);
  v_after:=jsonb_build_object('role',NEW.role,'clinic_id',NEW.clinic_id,'status',NEW.status,'deleted_at',NEW.deleted_at);
  INSERT INTO public.profile_audit_log(target_user_id,actor_user_id,actor_role,action,old_data,new_data,changed_fields)
    VALUES(NEW.id,auth.uid(),CASE WHEN auth.uid() IS NULL THEN 'maintenance' ELSE 'authenticated' END,'update_profile',v_before,v_after,v_changed);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation(),public.log_profile_changes() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_log_profile_changes ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON public.profiles FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.log_profile_changes();

CREATE OR REPLACE FUNCTION security_internal.guard_patient_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_field text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
  v_clinical constant text[]:=ARRAY['medical_history','allergies','medications','medical_conditions','medical_alerts','clinical_notes','blood_type','has_diabetes','has_hypertension','has_heart_disease','is_smoker','is_pregnant','recall_months','internal_notes','last_treatment_note','odontogram_state','periodontogram_state'];
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.account_balance IS DISTINCT FROM OLD.account_balance OR NEW.insurance_provider IS DISTINCT FROM OLD.insurance_provider OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
    THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF v_role='receptionist' THEN
      FOREACH v_field IN ARRAY v_clinical LOOP
        IF v_new->v_field IS DISTINCT FROM v_old->v_field THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      END LOOP;
    END IF;
  ELSIF v_role='receptionist' THEN
    FOREACH v_field IN ARRAY v_clinical LOOP
      IF v_field='recall_months' THEN
        IF coalesce(NEW.recall_months,6)<>6 THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      ELSIF coalesce(v_new->>v_field,'') NOT IN ('','{}','[]','false') THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_patient_scope() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
DROP TRIGGER IF EXISTS trg_guard_patient_clinical_insert ON public.patients;
CREATE TRIGGER operational_patient_scope BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION security_internal.guard_patient_scope();

-- Duplicate historical rights trigger has the same callback as the required M7
-- trigger. Keep M7's exact trigger; avoid two executions of the same operation.
DROP TRIGGER IF EXISTS trg_protect_data_requests_immutability ON public.data_rights_requests;
-- The verification callback is inert after encargo02; remove the unused event.
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
-- Optional legacy hook must stay closed when the configuration isn't verified.
DO $hook$ BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,supabase_auth_admin;
  END IF;
END $hook$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql
-- Local synthetic acceptance only. Not a remotely deployable migration until
-- canonical01/02 parity and independent release review are complete.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='agenda_no_overlap')
  THEN RAISE EXCEPTION 'Reviewed local acceptance prerequisite required'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments WHERE start_time IS NULL OR end_time IS NULL OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR end_time<=start_time OR end_time-start_time>interval '8 hours' OR status IS NULL OR status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR (deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived') AND doctor_id IS NULL))
  THEN RAISE EXCEPTION 'Invalid appointment history; stop and review without modifying data'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments a JOIN public.appointments b ON a.id<b.id AND a.clinic_id=b.clinic_id AND a.doctor_id=b.doctor_id AND a.start_time<b.end_time AND b.start_time<a.end_time WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.status IN ('scheduled','confirmed','arrived') AND b.status IN ('scheduled','confirmed','arrived'))
  THEN RAISE EXCEPTION 'Existing overlapping history; stop and review'; END IF;
END;
$preflight$;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK(status IS NOT NULL AND status IN ('scheduled','confirmed','arrived','completed','cancelled','no_show'));
ALTER TABLE public.appointments ADD CONSTRAINT agenda_finite_interval CHECK(start_time IS NOT NULL AND end_time IS NOT NULL AND isfinite(start_time) AND isfinite(end_time) AND end_time>start_time AND end_time-start_time BETWEEN interval '5 minutes' AND interval '8 hours');
ALTER TABLE public.appointments ADD CONSTRAINT agenda_active_assignment CHECK(deleted_at IS NOT NULL OR status NOT IN ('scheduled','confirmed','arrived') OR doctor_id IS NOT NULL);
ALTER TABLE public.appointments ADD CONSTRAINT agenda_no_overlap EXCLUDE USING gist (clinic_id WITH =,doctor_id WITH =,tstzrange(start_time,end_time,'[)') WITH &&) WHERE(deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived'));
CREATE INDEX agenda_visible_range ON public.appointments(clinic_id,start_time) WHERE deleted_at IS NULL;

CREATE TABLE security_internal.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
  before_values jsonb,
  after_values jsonb NOT NULL
);
ALTER TABLE security_internal.appointment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.appointment_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION security_internal.guard_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_validate_assignment boolean;
BEGIN
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF NEW.deleted_at IS NOT NULL OR (TG_OP='UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    RAISE EXCEPTION 'Use cancellation; appointment evidence must remain' USING ERRCODE='42501';
  END IF;
  IF v_role='receptionist' AND (TG_OP='INSERT' AND NEW.notes IS NOT NULL OR TG_OP='UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND NEW.status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Invalid initial state' USING ERRCODE='22023';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NOT (
    OLD.status='scheduled' AND NEW.status IN ('confirmed','arrived','cancelled','no_show') OR
    OLD.status='confirmed' AND NEW.status IN ('arrived','cancelled','no_show') OR
    OLD.status='arrived' AND NEW.status IN ('completed','cancelled') OR
    OLD.status IN ('cancelled','no_show') AND NEW.status='scheduled'
  ) THEN RAISE EXCEPTION 'Invalid state transition' USING ERRCODE='22023'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='completed' AND (NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.type IS DISTINCT FROM OLD.type) THEN
    RAISE EXCEPTION 'Completed appointment is immutable' USING ERRCODE='22023';
  END IF;
  v_validate_assignment:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN v_validate_assignment:=NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.status IN ('scheduled','confirmed','arrived') AND NEW.status IS DISTINCT FROM OLD.status; END IF;
  IF v_validate_assignment AND (NEW.doctor_id IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) NOT IN ('doctor','clinic_owner')) THEN
    RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023';
  END IF;
  IF v_validate_assignment THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.user_id=NEW.doctor_id AND m.clinic_id=NEW.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE FUNCTION security_internal.audit_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_before jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN v_before:=jsonb_build_object('start_time',OLD.start_time,'end_time',OLD.end_time,'doctor_id',OLD.doctor_id,'status',OLD.status); END IF;
  INSERT INTO security_internal.appointment_events(appointment_id,clinic_id,actor_id,operation,before_values,after_values) VALUES(NEW.id,NEW.clinic_id,auth.uid(),TG_OP,v_before,jsonb_build_object('start_time',NEW.start_time,'end_time',NEW.end_time,'doctor_id',NEW.doctor_id,'status',NEW.status));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_operational_appointment(),security_internal.audit_operational_appointment() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER trg_enforce_clinician_assignment ON public.appointments;
CREATE TRIGGER agenda_guard BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.guard_operational_appointment();
CREATE TRIGGER agenda_audit AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.audit_operational_appointment();

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql
-- Local synthetic acceptance only; not remotely deployable before01/02 gates.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR to_regprocedure('public.get_clinic_operational_report(uuid,timestamptz,timestamptz)') IS NOT NULL
  THEN RAISE EXCEPTION 'Reviewed fresh local report contract required'; END IF;
END $guard$;
CREATE FUNCTION public.get_clinic_operational_report(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_end<=p_start OR p_end-p_start>interval '366 days'
  THEN RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE='22023'; END IF;
  WITH appointments AS MATERIALIZED (
    SELECT a.start_time,a.status,a.type FROM public.appointments a
      WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time>=p_start AND a.start_time<p_end
  ), patients AS MATERIALIZED (
    SELECT p.created_at,p.status FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
  ), totals AS (
    SELECT count(*) AS appointments,count(*) FILTER(WHERE status='completed') AS completed,
      count(*) FILTER(WHERE status='no_show') AS no_show,count(*) FILTER(WHERE status='cancelled') AS cancelled FROM appointments
  ), months AS (
    SELECT generate_series(date_trunc('month',p_start AT TIME ZONE 'America/Guayaquil'),
      date_trunc('month',(p_end-interval '1 microsecond') AT TIME ZONE 'America/Guayaquil'),interval '1 month') AS month
  )
  SELECT jsonb_build_object(
    'clinic_id',p_clinic_id,'start',p_start,'end',p_end,
    'summary',jsonb_build_object('appointments',t.appointments,'activePatients',(SELECT count(*) FROM patients WHERE status='active'),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end),
      'completed',t.completed,'noShow',t.no_show,'cancelled',t.cancelled,
      'attendanceRate',round(100.0*t.completed/nullif(t.completed+t.no_show,0),1)),
    'statuses',(SELECT jsonb_object_agg(state,(SELECT count(*) FROM appointments WHERE status=state))
      FROM unnest(ARRAY['scheduled','confirmed','arrived','completed','cancelled','no_show']) states(state)),
    'monthly',(SELECT jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),
      'appointments',(SELECT count(*) FROM appointments WHERE date_trunc('month',start_time AT TIME ZONE 'America/Guayaquil')=m.month),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end AND date_trunc('month',created_at AT TIME ZONE 'America/Guayaquil')=m.month)) ORDER BY m.month) FROM months m),
    'treatments',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY grouped.count DESC,grouped.name),'[]'::jsonb)
      FROM (SELECT coalesce(nullif(btrim(type),''),'Consulta') AS name,count(*) AS count FROM appointments GROUP BY coalesce(nullif(btrim(type),''),'Consulta') ORDER BY count(*) DESC,coalesce(nullif(btrim(type),''),'Consulta') LIMIT 10) grouped)
  ) INTO v_result FROM totals t;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261001120000_invitation_pending_reservation.sql
-- PROSPECTIVE: review/apply after canonical authority and operational convergence.
-- Not applied by this change. Preserve accepted/expired history without permitting
-- more than one pending reservation per clinic and normalized recipient.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

-- Keep the duplicate preflight and replacement atomic against concurrent writes.
LOCK TABLE public.clinic_invitations IN ACCESS EXCLUSIVE MODE;
DO $checked_constraint$
DECLARE actual text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO actual
  FROM pg_constraint
  WHERE conrelid = 'public.clinic_invitations'::regclass
    AND conname = 'clinic_invitations_clinic_id_email_status_key'
    AND contype = 'u';
  IF actual IS DISTINCT FROM 'UNIQUE (clinic_id, email, status)' THEN
    RAISE EXCEPTION 'Unreviewed invitation uniqueness drift; reconcile before applying';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinic_invitations WHERE status = 'pending'
    GROUP BY clinic_id, lower(email) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending recipients require review; no records were removed';
  END IF;
END
$checked_constraint$;

ALTER TABLE public.clinic_invitations
  DROP CONSTRAINT clinic_invitations_clinic_id_email_status_key;
CREATE UNIQUE INDEX clinic_invitations_one_pending_email_idx
  ON public.clinic_invitations (clinic_id, lower(email))
  WHERE status = 'pending';


-- PINNED REFERENCE: supabase/migrations/20261001130000_durable_email_abuse_budget.sql
-- PROSPECTIVE: apply only after the canonical authority baseline is reconciled.
-- This migration is additive and atomic. It never changes Auth or Storage policy.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
     OR to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Reviewed authority baseline and pgcrypto are required';
  END IF;
END
$preflight$;

CREATE TABLE security_internal.email_abuse_budgets (
  scope text NOT NULL,
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (scope, key_hash, window_start),
  CHECK (expires_at > window_start)
);
CREATE INDEX email_abuse_budget_expiry_idx ON security_internal.email_abuse_budgets (expires_at);
ALTER TABLE security_internal.email_abuse_budgets OWNER TO postgres;
ALTER TABLE security_internal.email_abuse_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.email_abuse_budgets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.consume_email_abuse_budget(
  p_action text, p_ip_hash text, p_destination_hash text,
  p_actor_id uuid DEFAULT NULL, p_clinic_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $budget$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_count integer;
  v_retry integer := 0;
  v_scope text;
  v_key text;
  v_seconds integer;
  v_limit integer;
  v_authenticated boolean;
  v_role text;
  v_quota record;
BEGIN
  -- Grants are the primary boundary. Never accept an ordinary JWT as a limiter
  -- administrator, including one with forged user metadata or parameters.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('signup','resend','invite','transactional')
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$'
     OR p_destination_hash IS NULL OR p_destination_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid email budget request' USING ERRCODE = '22023';
  END IF;
  v_authenticated := p_action IN ('invite','transactional');
  IF (v_authenticated AND (p_actor_id IS NULL OR p_clinic_id IS NULL))
     OR (NOT v_authenticated AND (p_actor_id IS NOT NULL OR p_clinic_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid email budget authority' USING ERRCODE = '22023';
  END IF;
  IF v_authenticated THEN
    v_role := security_internal.role_for(p_clinic_id, p_actor_id);
    IF v_role IS NULL OR (p_action='invite' AND v_role<>'clinic_owner')
       OR v_role NOT IN ('clinic_owner','doctor','receptionist') THEN
      RAISE EXCEPTION 'Active email authority required' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Fixed UTC windows, deliberately conservative launch ceilings. Global is
  -- always locked first, bounding new hashed rows and serializing reservations.
  -- All remaining scopes use the same order, preventing reverse lock cycles.
  -- The subtransaction reserves every applicable scope or none. Rejected
  -- traffic must never burn the global budget and deny unrelated clinics.
  BEGIN
  FOR v_quota IN
    SELECT * FROM (VALUES
      ('00-global', encode(extensions.digest('clinia-email-global','sha256'),'hex'), 86400, 1000, true),
      ('10-ip', p_ip_hash, 600, 60, true),
      ('20-destination', p_destination_hash, 3600, 10, true),
      ('30-auth-ip', p_ip_hash, 600, 10, NOT v_authenticated),
      ('40-auth-destination', p_destination_hash, 3600, 3, NOT v_authenticated),
      ('50-actor', encode(extensions.digest('actor:' || p_actor_id::text,'sha256'),'hex'), 600, 30, v_authenticated),
      ('60-clinic', encode(extensions.digest('clinic:' || p_clinic_id::text,'sha256'),'hex'), 3600, 120, v_authenticated)
    ) AS quotas(scope, key_hash, seconds, ceiling, enabled)
    WHERE enabled ORDER BY scope
  LOOP
    v_scope := v_quota.scope; v_key := v_quota.key_hash;
    v_seconds := v_quota.seconds; v_limit := v_quota.ceiling;
    v_start := to_timestamp(floor(extract(epoch FROM v_now) / v_seconds) * v_seconds);
    INSERT INTO security_internal.email_abuse_budgets AS budget
      (scope, key_hash, window_start, expires_at, attempts)
    VALUES (v_scope, v_key, v_start, v_start + make_interval(secs => v_seconds), 1)
    ON CONFLICT (scope, key_hash, window_start) DO UPDATE
      SET attempts = least(budget.attempts + 1, v_limit + 1)
    RETURNING attempts INTO v_count;
    IF v_count > v_limit THEN
      v_retry := greatest(v_retry, greatest(1, ceil(extract(epoch FROM
        (v_start + make_interval(secs => v_seconds) - v_now)))::integer));
      RAISE EXCEPTION 'Email budget denied' USING ERRCODE = 'CL001';
    END IF;
  END LOOP;
  EXCEPTION WHEN SQLSTATE 'CL001' THEN
    NULL; -- PostgreSQL rolled back every reservation; retry remains local.
  END;

  -- Bounded cleanup during real requests; no raw emails, IPs or JWTs are stored.
  -- SKIP LOCKED avoids contending with a reservation begun in an earlier window.
  WITH expired AS (
    SELECT scope, key_hash, window_start FROM security_internal.email_abuse_budgets
    WHERE expires_at < v_now - interval '24 hours'
    ORDER BY expires_at LIMIT 200 FOR UPDATE SKIP LOCKED
  )
  DELETE FROM security_internal.email_abuse_budgets b USING expired e
  WHERE b.scope=e.scope AND b.key_hash=e.key_hash AND b.window_start=e.window_start;

  RETURN jsonb_build_object('allowed', v_retry = 0, 'retry_after_seconds', v_retry);
END
$budget$;
ALTER FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) TO service_role;
-- The deny-first baseline revokes PUBLIC schema usage. Grant only namespace
-- access for the server role; no CREATE, table or other routine grants change.
GRANT USAGE ON SCHEMA public TO service_role;


-- PINNED REFERENCE: supabase/migrations/20261002120000_profile_guard_schema_compatibility.sql
-- PROSPECTIVE: exact canonical guard compatibility, without fabricating history.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.prevent_profile_privilege_escalation()')
      AND pg_get_userbyid(proowner)='postgres' AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND md5(replace(prosrc,E'\r\n',E'\n'))='e109bee275bcff2feb87651cbd2fdefb'
  ) THEN RAISE EXCEPTION 'Unreviewed profile guard drift; reconcile before applying'; END IF;
END
$preflight$;
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    -- Some reviewed schemas have no created_at field. Compare it when present;
    -- absent fields remain null without inventing historical timestamps.
    OR to_jsonb(NEW)->'created_at' IS DISTINCT FROM to_jsonb(OLD)->'created_at'
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC,anon,authenticated,service_role;


-- PINNED REFERENCE: supabase/migrations/20261002180423_live_session_revocation.sql
-- PROSPECTIVE canonical forward, never a blind repair of occupied cloud schemas.
-- Supabase signatures survive logout; application authority also needs a live session.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('security_internal.role_for(uuid,uuid)','762192aa8d42b261aea671bc41cbe096'),
    ('public.get_clinic_member_role(uuid)','a242b6422e41124b0660479752ca5240'),
    ('security_internal.require_clinic(uuid,text[],boolean)','9b1034be74705088e7c787e30525d1d1')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact canonical authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='banned_until' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='deleted_at' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.sessions'::regclass AND attname='not_after' AND NOT attisdropped)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='profiles')<>2
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='clinic_members')<>1
  THEN RAISE EXCEPTION 'Reviewed managed Auth schema and exact profile/member policies required'; END IF;
END $preflight$;

CREATE FUNCTION public.clinia_session_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='authenticated' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
      WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_session_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_session_active() TO authenticated;

CREATE FUNCTION security_internal.lock_clinia_session()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.clinia_session_active() IS NOT TRUE
  THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  -- Consistent order for enrollment and clinical writes. Logout or ban committed
  -- first denies the operation; a write already authorized holds these locks.
  PERFORM 1 FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL AND is_anonymous IS NOT TRUE
    AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM auth.sessions WHERE user_id=auth.uid() AND id=(auth.jwt()->>'session_id')::uuid
    AND (not_after IS NULL OR not_after>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
END $function$;
REVOKE ALL ON FUNCTION security_internal.lock_clinia_session() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    -- Assigned clinicians may be offline. Only the requesting ordinary actor
    -- must own a live session; a gated service lookup still checks live Auth.
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_session_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  IF p_write THEN PERFORM security_internal.lock_clinia_session(); END IF;
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

ALTER POLICY encargo02_profile_read ON public.profiles USING (id=auth.uid() AND public.clinia_session_active());
ALTER POLICY encargo02_profile_update ON public.profiles
  USING (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL)
  WITH CHECK (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL);
ALTER POLICY encargo02_members_read ON public.clinic_members
  USING (public.clinia_session_active() AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261002180800_trusted_enrollment.sql
-- PROSPECTIVE: apply only after reviewed canonical authority and convergence.
-- No metadata-based enrollment, profile privilege writes or historical repair.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$ BEGIN
  IF to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
    OR to_regprocedure('public.check_subscription_active(uuid)') IS NULL
    OR to_regprocedure('public.clinia_session_active()') IS NULL
    OR to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND tgname='on_auth_user_verified' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'Reviewed canonical enrollment prerequisites required'; END IF;
END $preflight$;

CREATE TABLE security_internal.clinic_registration_intents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  clinic_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  address text NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
  phone text NOT NULL CHECK (length(phone)<=40),
  size text NOT NULL CHECK (size IN ('small','medium','large')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE security_internal.clinic_registration_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.clinic_registration_intents FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.clinic_invitations
  ADD COLUMN auth_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN accepted_at timestamptz;
-- Existing invitations deliberately remain unready, requiring reviewed resend.

CREATE FUNCTION public.store_clinic_registration_intent(
  p_user_id uuid,p_clinic_id uuid,p_email text,p_name text,p_address text,p_phone text,p_size text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_existing security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_clinic_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id
      AND lower(email)=lower(btrim(p_email)) AND email_confirmed_at IS NULL
      AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- The only writer is the gated server signup path, using the Auth ID returned
  -- from its own createUser call. An existing request cannot be repurposed.
  INSERT INTO security_internal.clinic_registration_intents(user_id,clinic_id,email,name,address,phone,size)
    VALUES(p_user_id,p_clinic_id,lower(btrim(p_email)),btrim(p_name),btrim(p_address),btrim(p_phone),p_size)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_existing FROM security_internal.clinic_registration_intents WHERE user_id=p_user_id FOR UPDATE;
  IF v_existing.clinic_id IS DISTINCT FROM p_clinic_id OR v_existing.email IS DISTINCT FROM lower(btrim(p_email))
    OR v_existing.name IS DISTINCT FROM btrim(p_name) OR v_existing.address IS DISTINCT FROM btrim(p_address)
    OR v_existing.phone IS DISTINCT FROM btrim(p_phone) OR v_existing.size IS DISTINCT FROM p_size
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.complete_verified_clinic_registration()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_intent security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- Common actor lock serializes registration against simultaneous redemption.
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_intent FROM security_internal.clinic_registration_intents WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_intent.email<>v_email THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  IF v_intent.completed_at IS NOT NULL THEN
    IF security_internal.role_for(v_intent.clinic_id,auth.uid()) IS DISTINCT FROM 'clinic_owner'
    THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
    RETURN v_intent.clinic_id;
  END IF;
  -- New-account enrollment only; no silent restoration or extra trial farming
  -- for an identity that already has an active or historical membership.
  IF EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
  INSERT INTO public.clinics(id,name,address,phone,size,owner_id,subscription_tier,subscription_status,trial_ends_at,bypass_subscription)
    VALUES(v_intent.clinic_id,v_intent.name,v_intent.address,v_intent.phone,v_intent.size,auth.uid(),
      'trial','trial',now()+interval '14 days',false);
  INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
    VALUES(auth.uid(),v_intent.clinic_id,'clinic_owner','active');
  UPDATE security_internal.clinic_registration_intents SET completed_at=now() WHERE user_id=auth.uid();
  RETURN v_intent.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.complete_verified_clinic_registration() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.complete_verified_clinic_registration() TO authenticated;

CREATE FUNCTION public.redeem_verified_clinic_invitation(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_invite public.clinic_invitations%ROWTYPE; v_role text; v_status text;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
    OR p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 512
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_invite FROM public.clinic_invitations WHERE token=p_token FOR UPDATE;
  IF NOT FOUND OR NOT v_invite.auth_ready OR lower(v_invite.email)<>v_email
    OR v_invite.role IS NULL OR v_invite.role NOT IN ('doctor','receptionist')
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;

  IF v_invite.status='accepted' THEN
    IF v_invite.accepted_by IS DISTINCT FROM auth.uid()
      OR security_internal.role_for(v_invite.clinic_id,auth.uid()) IS DISTINCT FROM v_invite.role
    THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
    RETURN v_invite.clinic_id;
  END IF;
  IF v_invite.status<>'pending' OR v_invite.expires_at IS NULL OR v_invite.expires_at<=now()
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  -- Hold the issuer's live authority through commit; committed revocation wins.
  PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=m.user_id
    WHERE m.clinic_id=v_invite.clinic_id AND m.user_id=v_invite.invited_by
      AND m.role='clinic_owner' AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
    FOR SHARE OF m,p,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  IF security_internal.role_for(v_invite.clinic_id,v_invite.invited_by) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.clinics WHERE id=v_invite.clinic_id AND archived_at IS NULL
    AND (bypass_subscription IS TRUE OR subscription_status::text='active' OR trial_ends_at>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT role,status INTO v_role,v_status FROM public.clinic_members
    WHERE user_id=auth.uid() AND clinic_id=v_invite.clinic_id FOR UPDATE;
  IF FOUND THEN
    IF v_role IS DISTINCT FROM v_invite.role OR v_status IS DISTINCT FROM 'active'
    THEN RAISE EXCEPTION 'Membership conflict; reviewed restoration required' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
      VALUES(auth.uid(),v_invite.clinic_id,v_invite.role,'active');
  END IF;
  UPDATE public.clinic_invitations SET status='accepted',accepted_by=auth.uid(),accepted_at=now()
    WHERE id=v_invite.id AND status='pending';
  RETURN v_invite.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.redeem_verified_clinic_invitation(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.redeem_verified_clinic_invitation(text) TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261002231730_immutable_prescription_receipts.sql
-- Prospective only, after live_session_revocation and canonical encargo02.
-- Existing records remain NULL; this does not reconstruct historical authorship.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed live session authority prerequisite required'; END IF;
END $preflight$;
ALTER TABLE public.prescriptions ADD COLUMN issuance_snapshot jsonb;
CREATE FUNCTION security_internal.freeze_prescription_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE p public.patients%ROWTYPE; d public.profiles%ROWTYPE; c public.clinics%ROWTYPE; m jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Issued prescription is immutable; custody procedure required' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL OR NEW.doctor_id IS DISTINCT FROM auth.uid() OR NEW.issuance_snapshot IS NOT NULL
  THEN RAISE EXCEPTION 'Invalid prescription issuer or receipt' USING ERRCODE='42501'; END IF;
  PERFORM security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor'],true);
  SELECT * INTO p FROM public.patients WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription patient' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription issuer' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.clinics WHERE id=NEW.clinic_id FOR SHARE;
  IF NOT FOUND OR nullif(btrim(c.name),'') IS NULL OR nullif(btrim(d.full_name),'') IS NULL
    OR nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') IS NULL
  THEN RAISE EXCEPTION 'Prescription identity incomplete' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(NEW.data) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.data->'medications') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.data->'indications') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(NEW.data->'medications') NOT BETWEEN 1 AND 20 OR length(NEW.data->>'indications')>2000
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(NEW.data->'medications') LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'object'
      OR jsonb_typeof(m->'name') IS DISTINCT FROM 'string' OR length(btrim(m->>'name')) NOT BETWEEN 1 AND 120
      OR jsonb_typeof(m->'dosage') IS DISTINCT FROM 'string' OR length(btrim(m->>'dosage')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(m->'duration') IS DISTINCT FROM 'string' OR length(btrim(m->>'duration')) NOT BETWEEN 1 AND 80
    THEN RAISE EXCEPTION 'Invalid prescription medication' USING ERRCODE='22023'; END IF;
  END LOOP;
  NEW.created_at:=statement_timestamp();
  NEW.data:=jsonb_build_object('medications',NEW.data->'medications','indications',NEW.data->>'indications');
  NEW.issuance_snapshot:=jsonb_build_object('version',1,'prescription_id',NEW.id,
    'issued_at',NEW.created_at,'clinic_id',NEW.clinic_id,'patient_id',NEW.patient_id,'doctor_id',auth.uid(),
    'clinic',jsonb_build_object('name',c.name,'address',coalesce(c.address,''),'phone',coalesce(c.phone,'')),
    'patient',jsonb_build_object('name',btrim(concat_ws(' ',p.first_name,p.last_name)),'identification',coalesce(p.cedula,'')),
    'doctor',jsonb_build_object('name',d.full_name,'specialization',coalesce(d.specialization,''),'license_number',coalesce(d.license_number,'')),
    'medications',NEW.data->'medications','indications',NEW.data->>'indications');
  -- No mutable logo URL or signature-image claim becomes historical evidence.
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.freeze_prescription_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER freeze_prescription_receipt BEFORE INSERT OR UPDATE OR DELETE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION security_internal.freeze_prescription_receipt();
REVOKE UPDATE,DELETE ON public.prescriptions FROM anon,authenticated;
REVOKE UPDATE(data) ON public.prescriptions FROM authenticated;
DROP POLICY IF EXISTS encargo02_clinical_update ON public.prescriptions;
COMMENT ON COLUMN public.prescriptions.issuance_snapshot IS 'Database-captured immutable issuance receipt. NULL historical rows require reviewed custody before reprint. No qualified signature claim.';
NOTIFY pgrst,'reload schema';



-- PINNED REFERENCE: supabase/migrations/20261002234427_enable_prescription_request_ids.sql
-- Prospective permission only; existing PK and immutable receipt enforce retries.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('security_internal.freeze_prescription_receipt()')
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='991bb0106792a1323e357dcc3e3cf1b7'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.prescriptions'::regclass
      AND t.tgname='freeze_prescription_receipt' AND NOT t.tgisinternal
      AND t.tgenabled='O' AND t.tgtype=31
      AND t.tgfoid=to_regprocedure('security_internal.freeze_prescription_receipt()')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_attribute a
      ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.prescriptions'::regclass AND i.indisprimary
      AND i.indnkeyatts=1 AND i.indisvalid AND i.indisready AND a.attname='id'
  ) THEN RAISE EXCEPTION 'Exact immutable receipt and primary key prerequisites required'; END IF;
  IF has_table_privilege('authenticated','public.prescriptions','INSERT')
    OR has_column_privilege('anon','public.prescriptions','id','INSERT')
    OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.prescriptions'::regclass
      AND a.attnum>0 AND NOT a.attisdropped
      AND a.attname NOT IN ('id','clinic_id','patient_id','doctor_id','data')
      AND has_column_privilege('authenticated',a.attrelid,a.attnum,'INSERT'))
  THEN RAISE EXCEPTION 'Unexpected broad prescription insert privileges'; END IF;
END $preflight$;
GRANT INSERT(id) ON public.prescriptions TO authenticated;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql
-- PROSPECTIVE forward for the exact reviewed operational agenda + live Auth chain.
-- Ordinary appointment writes use the existing authorized RPC. Clinic queues are
-- acquired before tuple/Auth authority locks; exclusion remains the final arbiter.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE v record; a record;
  v_insert text[]:=ARRAY['clinic_id','patient_id','doctor_id','start_time','end_time','status','type','notes'];
  v_update text[]:=ARRAY['doctor_id','start_time','end_time','status','type','notes','deleted_at'];
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.save_clinic_appointment(uuid,jsonb,uuid)','997c9a0e5b2006653d777c85039c0e49'),
    ('security_internal.guard_operational_appointment()','852e98f6d3e11eb76557f652f10c725d'),
    ('security_internal.require_clinic(uuid,text[],boolean)','e7c822cbffb3195f70088e7e4617a043'),
    ('security_internal.lock_clinia_session()','69a325cf0b73743dc5a50b2c6f4a7170')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed function prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass
      AND conname='agenda_no_overlap' AND contype='x' AND convalidated)
    OR NOT has_function_privilege('authenticated','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.save_clinic_appointment(uuid,jsonb,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','public.appointments','INSERT')
    OR has_table_privilege('authenticated','public.appointments','UPDATE')
    OR NOT has_table_privilege('service_role','public.appointments','INSERT')
    OR NOT has_table_privilege('service_role','public.appointments','UPDATE')
  THEN RAISE EXCEPTION 'Exact reviewed agenda RLS, exclusion and RPC privileges required'; END IF;
  FOR a IN SELECT attname FROM pg_catalog.pg_attribute
    WHERE attrelid='public.appointments'::regclass AND attnum>0 AND NOT attisdropped LOOP
    IF has_column_privilege('authenticated','public.appointments',a.attname,'INSERT') IS DISTINCT FROM (a.attname=ANY(v_insert))
      OR has_column_privilege('authenticated','public.appointments',a.attname,'UPDATE') IS DISTINCT FROM (a.attname=ANY(v_update))
      OR has_column_privilege('anon','public.appointments',a.attname,'INSERT')
      OR has_column_privilege('anon','public.appointments',a.attname,'UPDATE')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'INSERT')
      OR NOT has_column_privilege('service_role','public.appointments',a.attname,'UPDATE')
    THEN RAISE EXCEPTION 'Unexpected appointment column grant; stop and review: %',a.attname; END IF;
  END LOOP;
END $preflight$;

-- Bind objects that this change must preserve, including RLS policies, triggers,
-- all constraints, authority bodies and routine ACLs. This is transaction-local.
CREATE TEMP TABLE clinia_agenda_contract_before ON COMMIT DROP AS
SELECT jsonb_build_object(
  'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
  'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
    'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
    'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
    'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
  'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
  ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
) AS contract;

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],false);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  -- Queue before acquiring live authority or appointment row locks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinia.appointment.clinic:'||p_clinic_id::text,0));
  -- A queued actor may have been revoked or changed role. Recheck and lock now.
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;

-- Revoke only the exact previously reviewed direct DML grants. SELECT and RLS
-- policies remain unchanged; the definer RPC still runs its live authority checks.
-- Canonical trusted service_role maintenance grants are preserved. Privileged
-- concurrent maintenance must use this clinic advisory lock before writing;
-- serialization here is proved for ordinary authenticated RPC callers.
REVOKE INSERT(clinic_id,patient_id,doctor_id,start_time,end_time,status,type,notes),
  UPDATE(doctor_id,start_time,end_time,status,type,notes,deleted_at)
  ON public.appointments FROM authenticated;

DO $postflight$
DECLARE v_after jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))='caae0bd668648dac2b32686b658be02d')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a CROSS JOIN (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE a.attrelid='public.appointments'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND (has_column_privilege(r.role_name,'public.appointments',a.attname,'INSERT')
          OR has_column_privilege(r.role_name,'public.appointments',a.attname,'UPDATE')))
    OR EXISTS(SELECT 1 FROM (VALUES ('authenticated'),('anon')) r(role_name)
      WHERE has_table_privilege(r.role_name,'public.appointments','INSERT') OR has_table_privilege(r.role_name,'public.appointments','UPDATE'))
  THEN RAISE EXCEPTION 'Appointment RPC serialization postcondition failed'; END IF;
  SELECT jsonb_build_object(
    'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid='public.appointments'::regclass),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,tgname,pg_get_triggerdef(oid),tgenabled,tgfoid) ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='appointments'),
    'authority',(SELECT jsonb_agg(jsonb_build_array(oid,md5(regexp_replace(prosrc,'[[:space:]]+','','g')),proowner,prosecdef,provolatile,proconfig,proacl::text) ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN (
      'security_internal.guard_operational_appointment()'::regprocedure,'security_internal.audit_operational_appointment()'::regprocedure,
      'security_internal.require_clinic(uuid,text[],boolean)'::regprocedure,'security_internal.lock_clinia_session()'::regprocedure,
      'public.clinia_session_active()'::regprocedure,'security_internal.role_for(uuid,uuid)'::regprocedure)),
    'rpcAcl',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.save_clinic_appointment(uuid,jsonb,uuid)'::regprocedure)
    ,'serviceTableAcl',(SELECT relacl::text FROM pg_catalog.pg_class WHERE oid='public.appointments'::regclass)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM (SELECT contract FROM pg_temp.clinia_agenda_contract_before)
  THEN RAISE EXCEPTION 'Agenda authority, RLS, triggers, constraints or RPC ACL changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261004022340_clinical_document_delivery.sql
-- Prospective canonical upgrade only. Do not run on an occupied legacy schema.
-- Register the server Auth subject before configuring the hook. Keep disabled
-- subjects registered: disabling must never restore the human JWT role.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery')
    OR to_regclass('security_internal.document_delivery_principals') IS NOT NULL
    OR to_regprocedure('storage.allow_only_operation(text)') IS NULL
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='patient-files' AND file_size_limit=10485760)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='encargo02_storage_read' AND cmd='SELECT' AND permissive='PERMISSIVE')
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline and unused isolated role required'; END IF;
END $preflight$;

CREATE ROLE clinia_document_delivery NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT clinia_document_delivery TO authenticator;
GRANT USAGE ON SCHEMA public,storage,security_internal TO clinia_document_delivery;
GRANT SELECT ON storage.objects TO clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_principals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_internal.document_delivery_principals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_principals FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE TABLE security_internal.document_delivery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  file_id uuid NOT NULL
);
ALTER TABLE security_internal.document_delivery_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.document_delivery_audit FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

-- Records authorization to publish, not proof the client received/saved bytes.
-- No names, paths, bearer credentials or clinical content enter the audit row.
CREATE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.file_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role,clinia_document_delivery;
GRANT EXECUTE ON FUNCTION public.clinia_audit_document_delivery(uuid,uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.clinia_document_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_user uuid;
BEGIN
  -- The hook is invoked only by managed Auth, never by an ordinary actor.
  v_user:=(event->>'user_id')::uuid;
  IF (event->'claims'->>'sub') IS DISTINCT FROM v_user::text
  THEN RAISE EXCEPTION 'Auth subject mismatch' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE user_id=v_user)
  THEN event:=jsonb_set(event,'{claims,role}',to_jsonb('clinia_document_delivery'::text),false); END IF;
  RETURN event;
END $function$;
REVOKE ALL ON FUNCTION public.clinia_document_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.clinia_document_access_token_hook(jsonb) TO supabase_auth_admin;

CREATE FUNCTION public.clinia_document_delivery_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='clinia_document_delivery' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM security_internal.document_delivery_principals p
      JOIN auth.users u ON u.id=p.user_id JOIN auth.sessions s ON s.user_id=u.id
      WHERE p.user_id=auth.uid() AND p.enabled AND (p.expires_at IS NULL OR p.expires_at>now())
        AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_document_delivery_active() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_document_delivery_active() TO clinia_document_delivery;

CREATE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active() AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.file_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;
REVOKE ALL ON FUNCTION security_internal.document_object_read_allowed(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION security_internal.document_object_read_allowed(text) TO clinia_document_delivery;

-- A restrictive policy is required: permissive policies combine with OR.
CREATE POLICY clinia_no_human_clinical_object_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id<>'patient-files');
CREATE POLICY clinia_document_delivery_read ON storage.objects
  FOR SELECT TO clinia_document_delivery USING (
    bucket_id='patient-files' AND storage.allow_only_operation('object.get_authenticated')
    AND security_internal.document_object_read_allowed(name)
  );

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND p.oid<>'public.clinia_document_delivery_active()'::regprocedure
        AND has_function_privilege('clinia_document_delivery',p.oid,'EXECUTE'))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261004220500_document_delivery_info_operation.sql
-- Forward-only correction for the managed Storage metadata preflight.
-- Exact-key metadata access is bounded by the same live principal/registry
-- checks as byte access. Listing, signing, writes and human reads stay denied.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF to_regprocedure('storage.allow_any_operation(text[])') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='security_internal.document_object_read_allowed(text)'::regprocedure
      AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(prosrc,'\s+','','g'))='1bb5e1a423735400876ea9dbde2971a5')
    OR EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_document_delivery_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['clinia_document_delivery']::name[]
      AND qual='((bucket_id = ''patient-files''::text) AND storage.allow_only_operation(''object.get_authenticated''::text) AND security_internal.document_object_read_allowed(name))')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND NOT public)<>4
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
END $preflight$;

ALTER POLICY clinia_document_delivery_read ON storage.objects USING (
  bucket_id='patient-files'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated','object.get_authenticated_info'])
  AND security_internal.document_object_read_allowed(name)
);

DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'
    AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;


-- PINNED REFERENCE: supabase/migrations/20261006050131_clinical_s3_origin_delivery.sql
-- Prospective canonical staging/candidate only; never legacy occupied production.
-- S3 session-token requests retain RLS. Generated S3 keys bypass RLS and are
-- explicitly outside this design. No REST fallback or new role privileges.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='security_internal.document_object_read_allowed(text)'::regprocedure
      AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(prosrc,'\s+','','g'))='1bb5e1a423735400876ea9dbde2971a5')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_document_delivery_read' AND cmd='SELECT' AND permissive='PERMISSIVE'
      AND roles=ARRAY['clinia_document_delivery']::name[]
      AND qual='((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''object.get_authenticated''::text, ''object.get_authenticated_info''::text]) AND security_internal.document_object_read_allowed(name))')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='clinia_no_human_clinical_object_read' AND permissive='RESTRICTIVE'
      AND roles=ARRAY['authenticated']::name[] AND qual='(bucket_id <> ''patient-files''::text)')
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND NOT public)<>4
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
END $preflight$;
ALTER POLICY clinia_document_delivery_read ON storage.objects USING (
  bucket_id='patient-files'
  AND storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  AND security_internal.document_object_read_allowed(name)
);
DO $postflight$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Isolated delivery role acquired unintended privileges'; END IF;
END $postflight$;


-- PINNED REFERENCE: supabase/migrations/20261006050505_private_media_origin_boundary.sql
-- Prospective canonical staging/candidate only. Run with delivery disabled.
-- This DDL does not retire historical URLs: the controlled byte/key migration
-- must populate retired keys and switch delivery_path before enabling delivery.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('public.clinia_session_active()','bd4312480311fa40dc37425aa3d1eeb9'),
    ('security_internal.role_for(uuid,uuid)','feef8739b4cf30e59de0777ad1b608be'),
    ('public.encargo02_storage_access(text,text,boolean)','1f43a68f2af65873abaca311d2fc8e13'),
    ('security_internal.storage_access(text,text,boolean)','5d7fdbfabfa1c53748172a0ce3c464f0'),
    ('security_internal.protect_clinical_identity()','289457d532605e80868a41ecff9ad78a'),
    ('security_internal.document_object_read_allowed(text)','1bb5e1a423735400876ea9dbde2971a5'),
    ('public.clinia_audit_document_delivery(uuid,uuid,uuid,text)','fd51db1149a6a0de8b58cfda8bd3a307'),
    ('public.clinia_document_delivery_active()','8fa375ac766bb33cd74fee65ef7c02f7')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact reviewed authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
    OR to_regclass('security_internal.retired_storage_objects') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.patient_files'::regclass AND attname='delivery_path' AND NOT attisdropped)
    OR (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects')<>6
  THEN RAISE EXCEPTION 'Reviewed disabled-principal/private Storage baseline required'; END IF;
  -- Compare every expression, role, command and policy kind; no permissive drift.
  FOR v IN SELECT * FROM (VALUES
    ('encargo02_storage_read','SELECT','PERMISSIVE',ARRAY['authenticated']::name[],
      'public.encargo02_storage_access(bucket_id, name, false)',NULL),
    ('encargo02_storage_insert','INSERT','PERMISSIVE',ARRAY['authenticated']::name[],NULL,
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))'),
    ('encargo02_storage_update','UPDATE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))',
      '((owner_id = (auth.uid())::text) AND public.encargo02_storage_replace_allowed(bucket_id, name))'),
    ('encargo02_storage_delete','DELETE','PERMISSIVE',ARRAY['authenticated']::name[],
      '((bucket_id = ANY (ARRAY[''clinic-branding''::text, ''doctor-avatars''::text])) AND (owner_id = (auth.uid())::text) AND public.encargo02_storage_access(bucket_id, name, true))',NULL),
    ('clinia_no_human_clinical_object_read','SELECT','RESTRICTIVE',ARRAY['authenticated']::name[],
      '(bucket_id <> ''patient-files''::text)',NULL),
    ('clinia_document_delivery_read','SELECT','PERMISSIVE',ARRAY['clinia_document_delivery']::name[],
      '((bucket_id = ''patient-files''::text) AND storage.allow_any_operation(ARRAY[''storage.s3.object.get''::text, ''storage.s3.object.info''::text]) AND security_internal.document_object_read_allowed(name))',NULL)
  ) x(policyname,cmd,permissive,roles,qual,with_check) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
      AND p.policyname=v.policyname AND p.cmd=v.cmd AND p.permissive=v.permissive AND p.roles=v.roles
      AND p.qual IS NOT DISTINCT FROM v.qual AND p.with_check IS NOT DISTINCT FROM v.with_check)
    THEN RAISE EXCEPTION 'Exact reviewed Storage policy required: %',v.policyname; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.patient_files'::regclass
    AND tgname='encargo02_protect_identity' AND tgfoid='security_internal.protect_clinical_identity()'::regprocedure
    AND tgenabled='O' AND tgtype=23)
  THEN RAISE EXCEPTION 'Unchanged patient file identity trigger required'; END IF;
END $preflight$;

CREATE TABLE security_internal.retired_storage_objects (
  bucket_id text NOT NULL CHECK (bucket_id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')),
  name text NOT NULL CHECK (length(name)>0),
  retired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id,name)
);
ALTER TABLE security_internal.retired_storage_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.retired_storage_objects FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.storage_object_retired(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT EXISTS (SELECT 1 FROM security_internal.retired_storage_objects r WHERE r.bucket_id=p_bucket AND r.name=p_name);
$function$;
REVOKE ALL ON FUNCTION security_internal.storage_object_retired(text,text) FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

ALTER TABLE public.patient_files ADD COLUMN delivery_path text;
UPDATE public.patient_files SET delivery_path=file_path;
ALTER TABLE public.patient_files ALTER COLUMN delivery_path SET NOT NULL;
ALTER TABLE public.patient_files ADD CONSTRAINT patient_files_delivery_path_scope CHECK (
  delivery_path ~ ('^'||clinic_id::text||'/'||patient_id::text||'/[^/]+$')
  AND length(delivery_path)<=500 AND delivery_path NOT LIKE '%..%'
);
-- Preserve service-role privileges only on the original columns. A table-level
-- INSERT/UPDATE grant would silently confer authority over all future columns.
REVOKE INSERT,UPDATE ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
GRANT INSERT (clinic_id,patient_id,uploaded_by,name,file_path,size,type) ON public.patient_files TO authenticated;
GRANT UPDATE (name,deleted_at) ON public.patient_files TO authenticated;
GRANT INSERT (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at),
  UPDATE (id,created_at,patient_id,clinic_id,name,file_path,size,type,uploaded_by,deleted_at)
  ON public.patient_files TO service_role;
REVOKE INSERT(delivery_path),UPDATE(delivery_path) ON public.patient_files FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;

CREATE FUNCTION security_internal.initialize_document_delivery_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  NEW.delivery_path:=NEW.file_path;
  IF security_internal.storage_object_retired('patient-files',NEW.delivery_path)
  THEN RAISE EXCEPTION 'Retired object path' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.initialize_document_delivery_path() FROM PUBLIC,anon,authenticated,service_role,clinia_document_delivery;
CREATE TRIGGER clinia_initialize_delivery_path BEFORE INSERT ON public.patient_files
  FOR EACH ROW EXECUTE FUNCTION security_internal.initialize_document_delivery_path();

CREATE OR REPLACE FUNCTION public.encargo02_storage_access(p_bucket text,p_name text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT NOT security_internal.storage_object_retired(p_bucket,p_name)
    AND security_internal.storage_access(p_bucket,p_name,p_write);
$function$;

CREATE OR REPLACE FUNCTION security_internal.document_object_read_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_document_delivery_active()
    AND NOT security_internal.storage_object_retired('patient-files',p_name) AND EXISTS (
    SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
    WHERE f.delivery_path=p_name AND f.deleted_at IS NULL AND p.deleted_at IS NULL
      AND split_part(p_name,'/',1)=f.clinic_id::text AND split_part(p_name,'/',2)=f.patient_id::text
      AND array_length(string_to_array(p_name,'/'),1)=3
  );
$function$;

CREATE OR REPLACE FUNCTION public.clinia_audit_document_delivery(p_clinic_id uuid,p_patient_id uuid,p_file_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['doctor','clinic_owner'],false);
  IF security_internal.storage_object_retired('patient-files',p_path)
    OR NOT EXISTS (SELECT 1 FROM public.patient_files f JOIN public.patients p
      ON p.id=f.patient_id AND p.clinic_id=f.clinic_id
      WHERE f.id=p_file_id AND f.clinic_id=p_clinic_id AND f.patient_id=p_patient_id
        AND f.delivery_path=p_path AND f.deleted_at IS NULL AND p.deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Document denied' USING ERRCODE='42501'; END IF;
  INSERT INTO security_internal.document_delivery_audit(actor_id,clinic_id,patient_id,file_id)
    VALUES(auth.uid(),p_clinic_id,p_patient_id,p_file_id);
  RETURN true;
END $function$;

-- Live ACL remains the permissive policy. These restrictions only narrow it.
CREATE POLICY clinia_private_media_origin_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_any_operation(ARRAY['storage.s3.object.get','storage.s3.object.info'])
  );
CREATE POLICY clinia_private_media_origin_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR storage.allow_only_operation('storage.object.upload')
  );
CREATE POLICY clinia_private_media_no_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'))
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));
CREATE POLICY clinia_private_media_no_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding'));

DO $postflight$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','clinia_document_delivery'] LOOP
    IF has_column_privilege(r,'public.patient_files','delivery_path','INSERT,UPDATE')
      OR has_table_privilege(r,'security_internal.retired_storage_objects','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_function_privilege(r,'security_internal.storage_object_retired(text,text)','EXECUTE')
      OR has_function_privilege(r,'security_internal.initialize_document_delivery_path()','EXECUTE')
    THEN RAISE EXCEPTION 'Private origin boundary privilege leak for %',r; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='clinia_document_delivery'
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='clinia_document_delivery'::regrole)
    OR has_table_privilege('clinia_document_delivery','storage.objects','INSERT,UPDATE,DELETE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('clinia_document_delivery',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR (SELECT md5(regexp_replace(prosrc,'\s+','','g')) FROM pg_catalog.pg_proc
      WHERE oid='security_internal.protect_clinical_identity()'::regprocedure)<>'289457d532605e80868a41ecff9ad78a'
  THEN RAISE EXCEPTION 'Authority or immutable identity boundary changed'; END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261007045223_mandatory_clinical_mfa.sql
-- Prospective MFA gate for human clinical access on the reviewed baseline.
-- The exact function hashes and explicit relation inventory abort on drift;
-- never use this as a blind repair of an occupied production database.
-- Keep clinia_session_active() unchanged so verified-email enrollment and
-- invitation redemption can finish at AAL1; clinical authority is gated here.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $preflight$
DECLARE v record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('public.clinia_session_active()')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='bd4312480311fa40dc37425aa3d1eeb9'
  ) THEN RAISE EXCEPTION 'Reviewed live-session authority prerequisite required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('security_internal.role_for(uuid,uuid)')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='feef8739b4cf30e59de0777ad1b608be'
  ) THEN RAISE EXCEPTION 'Reviewed canonical role authority prerequisite required'; END IF;

  IF to_regprocedure('public.clinia_mfa_active()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='public')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='storage' AND tablename='objects')
  THEN RAISE EXCEPTION 'MFA migration already applied; reviewed repair required'; END IF;

  -- Explicit relation inventory: require an exact match with staging's full
  -- public RLS table set. Any missing or newly added public RLS table aborts.
  IF EXISTS (
    SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
    EXCEPT SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
  ) OR EXISTS (
    SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
    EXCEPT SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Public RLS relation inventory changed; review required'; END IF;

  -- Each reviewed table must exist as an RLS-enabled public table.
  FOR v IN SELECT relation_name FROM (VALUES
    ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
    ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
    ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
    ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
    ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
    ('prescriptions')
  ) AS inventory(relation_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v.relation_name AND c.relkind IN ('r','p')
        AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Reviewed public RLS table prerequisite required: %',v.relation_name; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='storage.objects'::regclass AND c.relrowsecurity)
    OR (SELECT count(*) FROM storage.buckets
      WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline prerequisite required'; END IF;
END $preflight$;

-- The old live-session function remains an enrollment/session check. This new
-- authority additionally binds the signed AAL2 JWT to a factor still verified
-- for this same Auth user, so stale AAL2 tokens fail after factor removal.
CREATE FUNCTION public.clinia_mfa_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_session_active() IS TRUE
    AND (auth.jwt()->>'aal')='aal2'
    AND EXISTS (SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id=auth.uid() AND f.status='verified' AND f.factor_type='totp');
$function$;
REVOKE ALL ON FUNCTION public.clinia_mfa_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_mfa_active() TO authenticated;

-- A caller asking for their own clinic role must have verified MFA. A role
-- lookup for an assigned offline user and a separately gated service lookup
-- retain their existing semantics.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_mfa_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Restrictive policies clamp older permissive JWT/metadata policies for all
-- human operations on every reviewed public application table.
CREATE POLICY clinia_mfa_gate ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinics AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_invitations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patients AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.appointments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.services AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinical_records AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.hcu033_forms AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_notes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_files AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescriptions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescription_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payment_methods AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.data_rights_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.automation_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.profile_audit_log AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.billings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.treatments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.service_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());

-- The isolated document-delivery role is not a member of authenticated and is
-- deliberately unaffected. Existing patient-files human-deny policy remains
-- in force; this gate only strengthens human Storage access for the four
-- private clinic buckets.
CREATE POLICY clinia_mfa_gate ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active())
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active());

NOTIFY pgrst,'reload schema';


-- PINNED REFERENCE: supabase/migrations/20261019190004_gate3_payment_method_delete_restrict.sql
-- Gate 3 conservative delta. No row update, new grant, or cascading deletion.
-- Execute only through the reviewed disposable canonical package.

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE c record;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
  THEN RAISE EXCEPTION 'New isolated canonical package target required'; END IF;
  SELECT * INTO STRICT c FROM pg_catalog.pg_constraint
    WHERE conrelid='public.payment_methods'::regclass AND conname='payment_methods_clinic_id_fkey';
  IF c.contype<>'f' OR c.confrelid<>'public.clinics'::regclass
    OR c.confupdtype<>'a' OR c.confdeltype NOT IN ('a','c') OR c.confmatchtype<>'s'
    OR NOT c.convalidated OR c.condeferrable OR c.condeferred
    OR replace(pg_catalog.pg_get_constraintdef(c.oid,true),'public.','') NOT IN
      ('FOREIGN KEY (clinic_id) REFERENCES clinics(id)',
       'FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE')
  THEN RAISE EXCEPTION 'Unreviewed payment method FK drift'; END IF;
  IF c.confdeltype='c' THEN
    ALTER TABLE public.payment_methods DROP CONSTRAINT payment_methods_clinic_id_fkey;
    ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE NO ACTION;
  END IF;
END $guard$;


