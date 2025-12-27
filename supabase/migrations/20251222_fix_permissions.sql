-- Final Permission Sanity Check
-- Ensure 'authenticated' user has Table-Level permissions 
-- (RLS Policies will then filter the specific rows)

-- 1. Patients: Everyone (authenticated) needs CRUD, RLS restricts WHO sees WHAT.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;

-- 2. Clinical Records: Doctors/Owners need CRUD.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_records TO authenticated;

-- 3. Billings: Owners need CRUD.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billings TO authenticated;

-- 4. Audit: Insert only (system/trigger usually, but users trigger it)
GRANT INSERT ON logs.access_audit TO authenticated;
-- Select is restricted by RLS to Admins
GRANT SELECT ON logs.access_audit TO authenticated;

-- 5. Profiles: Self-manage
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- 6. Grant usage on custom types/enums
GRANT USAGE ON TYPE public.app_role TO authenticated;
GRANT USAGE ON TYPE public.user_status TO authenticated;

-- 7. Ensure Sequences are accessible (for IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
