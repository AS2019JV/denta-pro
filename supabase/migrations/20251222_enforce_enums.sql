-- 1. Create Enums if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('clinic_owner', 'doctor', 'receptionist');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('invited', 'active', 'suspended');
    END IF;
END$$;

-- 2. Drop dependent objects (Policies and Views) that block ALTER COLUMN
DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.profile_audit_log;

-- Drop blocking view identified in error
DROP VIEW IF EXISTS public.public_profiles; 
DROP VIEW IF EXISTS public_profiles; 

-- 3. Ensure Columns Exist (Fix for missing 'status' column error)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 4. Drop old constraints
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 5. Clean up / Map old data
UPDATE public.profiles SET role = 'receptionist' WHERE role = 'reception';
UPDATE public.profiles SET role = 'clinic_owner' WHERE role = 'admin';

-- 6. Migrate Columns
ALTER TABLE public.profiles 
ALTER COLUMN role TYPE public.app_role 
USING role::public.app_role;

ALTER TABLE public.profiles 
ALTER COLUMN status DROP DEFAULT; 

ALTER TABLE public.profiles 
ALTER COLUMN status TYPE public.user_status 
USING status::public.user_status;

ALTER TABLE public.profiles 
ALTER COLUMN status SET DEFAULT 'active'::public.user_status;

-- 7. Restore Policies
CREATE POLICY "Users can view profiles in their clinic"
ON public.profiles FOR SELECT
USING (
    id = auth.uid() OR
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );

CREATE POLICY "Admins can view audit logs"
  ON public.profile_audit_log
  FOR SELECT
  USING ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'clinic_owner'::public.app_role) 
  );
