-- 1. Add title column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Re-create the handle_new_user function to include the title
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, title)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'clinic_owner'::public.app_role),
    new.raw_user_meta_data->>'title'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    title = EXCLUDED.title;
  RETURN new;
END;
$$;

-- 3. Update existing profiles with title from user_metadata if available
UPDATE public.profiles p
SET title = (u.raw_user_meta_data->>'title')::text
FROM auth.users u
WHERE p.id = u.id AND u.raw_user_meta_data->>'title' IS NOT NULL;
