-- Migration: Multi-clinic support
-- Created: 2025-12-15

-- 1. Create clinic_members table
CREATE TABLE IF NOT EXISTS public.clinic_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) NOT NULL,
  role text DEFAULT 'doctor',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, clinic_id)
);

ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their memberships" 
  ON public.clinic_members FOR SELECT 
  USING (auth.uid() = user_id);

-- 2. Backfill from profiles table (Preserve current links)
INSERT INTO public.clinic_members (user_id, clinic_id, role)
SELECT id, clinic_id, role FROM public.profiles 
WHERE clinic_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- 3. Create Helper Function to check membership
CREATE OR REPLACE FUNCTION public.is_clinic_member(check_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clinic_members 
    WHERE clinic_id = check_clinic_id 
    AND user_id = auth.uid()
  );
END;
$$;

-- 4. Update Policies for Patients to allow access to ANY clinic the user is a member of
-- Drop old policies relying on single get_user_clinic_id()
DROP POLICY IF EXISTS "Users can view patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;

-- Create new policies using membership check
CREATE POLICY "Users can view patients in their valid clinics"
  ON public.patients FOR SELECT
  USING ( is_clinic_member(clinic_id) );

CREATE POLICY "Users can insert patients in their valid clinics"
  ON public.patients FOR INSERT
  WITH CHECK ( is_clinic_member(clinic_id) );

CREATE POLICY "Users can update patients in their valid clinics"
  ON public.patients FOR UPDATE
  USING ( is_clinic_member(clinic_id) );
