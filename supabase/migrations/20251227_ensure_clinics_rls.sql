-- Ensure RLS is enabled on clinics
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 1. View Policy: Members can view their own clinic
-- Relies on the JWT claim injected by the hook
DROP POLICY IF EXISTS "Members can view their own clinic" ON public.clinics;
CREATE POLICY "Members can view their own clinic"
ON public.clinics
FOR SELECT
USING (
  id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- 2. Update Policy: Only Owners can update their clinic
DROP POLICY IF EXISTS "Owners can update their own clinic" ON public.clinics;
CREATE POLICY "Owners can update their own clinic"
ON public.clinics
FOR UPDATE
USING (
  id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND 
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
);

-- 3. Insert Policy: Disable client-side creation
-- Clinic creation is now handled exclusively by the Server Action / Service Role
-- or the 'genesis' RPC (if used). 
-- This prevents users from creating arbitrary clinics via the API.
DROP POLICY IF EXISTS "Users can create clinics" ON public.clinics;
-- No INSERT policy = Deny All by default
