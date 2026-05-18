UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"clinic_owner"}'::jsonb;
UPDATE public.profiles SET role = 'clinic_owner';
