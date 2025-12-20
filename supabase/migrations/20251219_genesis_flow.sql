-- 1. Schema Updates
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'trial';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Drop the Auto-Create Profile Trigger (Enforce "Limbo" State)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Create the Genesis RPC
CREATE OR REPLACE FUNCTION public.create_tenant_clinic(
  clinic_name TEXT,
  clinic_address TEXT,
  clinic_phone TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges
AS $$
DECLARE
  new_clinic_id UUID;
  new_profile_id UUID;
BEGIN
  -- 1. Security Check: Ensure user doesn't already belong to a clinic
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a clinic.';
  END IF;

  -- 2. Create the Clinic
  INSERT INTO public.clinics (name, address, phone, subscription_tier)
  VALUES (clinic_name, clinic_address, clinic_phone, 'trial') -- Start as trial
  RETURNING id INTO new_clinic_id;

  -- 3. Create the Owner Profile linked to this new clinic
  INSERT INTO public.profiles (id, clinic_id, role, full_name, status)
  VALUES (
    auth.uid(), 
    new_clinic_id, 
    'clinic_owner', -- <--- THIS IS WHERE THE MAGIC HAPPENS
    'Clinic Admin', -- Can be updated later via onboarding UI if we pass name
    'active'
  )
  RETURNING id INTO new_profile_id;

  RETURN json_build_object('clinic_id', new_clinic_id, 'role', 'clinic_owner');
END;
$$;

-- 4. Storage Setup (clinic-branding)
-- Check if bucket exists, if not create it
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clinic-branding', 'clinic-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Allow Owners to upload ONLY to their own folder (folder name = clinic_id)
DROP POLICY IF EXISTS "Owners manage their logo" ON storage.objects;
CREATE POLICY "Owners manage their logo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'clinic-branding' AND
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner' AND
  (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')
);

-- Public Read Access
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
CREATE POLICY "Public can view logos"
ON storage.objects
FOR SELECT
USING ( bucket_id = 'clinic-branding' );
