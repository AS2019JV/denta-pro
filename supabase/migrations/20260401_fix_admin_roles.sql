-- 1. Drop dependent policies
DROP POLICY IF EXISTS "Admins can delete profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert services." ON public.services;
DROP POLICY IF EXISTS "Admins can update services." ON public.services;
DROP POLICY IF EXISTS "Admins can delete services." ON public.services;

-- 2. Create the new app_role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('clinic_owner', 'doctor', 'receptionist');
    END IF;
END$$;

-- 3. Drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. Modify profiles.role to use the new enum
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE text;

-- 5. Map existing data
UPDATE public.profiles SET role = 'clinic_owner' WHERE role = 'admin' OR role = 'clinic_owner';
UPDATE public.profiles SET role = 'receptionist' WHERE role = 'reception';
UPDATE public.profiles SET role = 'doctor' WHERE role = 'doctor';
UPDATE public.profiles SET role = 'receptionist' WHERE role NOT IN ('clinic_owner', 'doctor', 'receptionist');

-- 6. Finalize the column type
ALTER TABLE public.profiles 
ALTER COLUMN role TYPE public.app_role 
USING role::public.app_role;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'doctor'::public.app_role;

-- 7. Restore policies with NEW role name 'clinic_owner'
CREATE POLICY "Admins can delete profiles." ON public.profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update all profiles." ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can insert services." ON public.services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update services." ON public.services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can delete services." ON public.services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));

-- 8. Re-create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'clinic_owner'::public.app_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;

-- 9. Re-enable the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. Update existing users metadata to sync with profiles
UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data || jsonb_build_object('role', p.role::text, 'full_name', COALESCE(p.full_name, split_part(u.email, '@', 1)))
FROM public.profiles p
WHERE u.id = p.id;
