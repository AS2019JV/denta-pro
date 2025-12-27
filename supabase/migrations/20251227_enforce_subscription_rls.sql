-- 1. Create a Helper Function for Subscription Check
-- This caches the check, making it more efficient than a raw subquery in every RLS policy
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- If clinic_id is null, it fails.
  IF check_clinic_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = check_clinic_id
    AND (
      bypass_subscription = true 
      OR 
      (subscription_tier != 'trial') -- Paid tiers always active (simplified logic)
      OR
      (trial_ends_at > NOW()) -- Active trial
    )
  );
END;
$$;

-- 2. Update RLS Policies to Include this Check
-- A. Patients
DROP POLICY IF EXISTS "Users can view patients in their clinic" ON public.patients;
CREATE POLICY "Users can view patients in their clinic"
ON public.patients FOR SELECT
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);

DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON public.patients;
CREATE POLICY "Users can insert patients in their clinic"
ON public.patients FOR INSERT
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);

DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;
CREATE POLICY "Users can update patients in their clinic"
ON public.patients FOR UPDATE
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);


-- B. Clinical Records
DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;
CREATE POLICY "Medical staff can view clinical records"
ON public.clinical_records
FOR ALL
USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('clinic_owner', 'doctor')
    AND public.check_subscription_active(clinic_id)
);


-- C. Appointments (Previously Missing strict check)
DROP POLICY IF EXISTS "Users can view appointments in their clinic" ON public.appointments;
CREATE POLICY "Users can view appointments in their clinic"
ON public.appointments FOR SELECT
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);

DROP POLICY IF EXISTS "Users can insert appointments in their clinic" ON public.appointments;
CREATE POLICY "Users can insert appointments in their clinic"
ON public.appointments FOR INSERT
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND public.check_subscription_active(clinic_id)
);


-- D. Billings (Allow Viewing to Pay, but maybe block Creating new ones?)
-- Note: We often want to ALLOW access to Billing so they can PAY even if expired.
-- So we DO NOT add the check to the Billings "SELECT" policy for Owners.
-- But we might block Creating new Invoices if expired? 
-- Decision: Keep Billing OPEN so they can see history and pay.


-- E. Grant Execute to Authenticated
GRANT EXECUTE ON FUNCTION public.check_subscription_active TO authenticated;
