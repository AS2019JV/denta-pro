-- 0. Ensure subscription_tier exists (Dependency from Genesis Flow)
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'trial';

-- 1. Add trial_ends_at column to clinics table
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill existing trial clinics (if any)
UPDATE public.clinics
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE subscription_tier = 'trial' AND trial_ends_at IS NULL;

-- 3. Update the create_tenant_clinic function to explicitly set trial end date
CREATE OR REPLACE FUNCTION public.create_tenant_clinic(
  clinic_name TEXT,
  clinic_address TEXT,
  clinic_phone TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_clinic_id UUID;
  new_profile_id UUID;
  user_full_name TEXT;
BEGIN
  -- 1. Security Check: Ensure user doesn't already belong to a clinic
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a clinic.';
  END IF;

  -- 2. Create the Clinic (14 Day Trial)
  INSERT INTO public.clinics (name, address, phone, subscription_tier, trial_ends_at)
  VALUES (
      clinic_name, 
      clinic_address, 
      clinic_phone, 
      'trial',
      (now() + INTERVAL '14 days') -- Enforce 14-day trial
  )
  RETURNING id INTO new_clinic_id;

  -- 3. Fetch user name from valid signup metadata
  SELECT raw_user_meta_data->>'full_name' INTO user_full_name
  FROM auth.users
  WHERE id = auth.uid();

  -- 4. Create the Owner Profile linked to this new clinic
  INSERT INTO public.profiles (id, clinic_id, role, full_name, status)
  VALUES (
    auth.uid(), 
    new_clinic_id, 
    'clinic_owner', 
    COALESCE(user_full_name, 'Clinic Admin'), 
    'active'
  )
  RETURNING id INTO new_profile_id;

  RETURN json_build_object('clinic_id', new_clinic_id, 'role', 'clinic_owner');
END;
$$;
