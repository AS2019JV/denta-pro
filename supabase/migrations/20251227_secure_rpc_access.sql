-- Secure RPC for Fetching Patient Data + Enforced Auditing
-- Replaces the "Client-Side Beacon" with "Server-Side Guarantee"

CREATE OR REPLACE FUNCTION public.get_patient_profile_secure(p_patient_id uuid)
RETURNS SETOF public.patients
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with high privilege to ensure Logging works
AS $$
DECLARE
  v_user_clinic_id uuid;
BEGIN
  -- 1. Get User's Clinic from JWT (Trusted)
  v_user_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

  -- 2. Audit This Access (The "Read Beacon")
  -- We call the logging function we created earlier
  PERFORM logs.log_patient_view(p_patient_id);

  -- 3. Return the Record (Strictly Scoped to Clinic)
  RETURN QUERY
  SELECT * 
  FROM public.patients
  WHERE id = p_patient_id
  AND clinic_id = v_user_clinic_id -- Enforce Tenant Isolation manually since we are Security Definer
  AND deleted_at IS NULL;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_profile_secure(uuid) TO authenticated;
