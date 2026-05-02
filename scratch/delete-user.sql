-- Script to safely delete a test user and all their associated data (Clinic, Profile, Members)
-- This handles the circular dependencies in Clinia+

DO $$
DECLARE
    target_email TEXT := 'adrisuarita@gmail.com'; -- CHANGE THIS TO THE EMAIL YOU WANT TO DELETE
    target_user_id UUID;
    target_clinic_id UUID;
BEGIN
    -- 1. Get the User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % not found', target_email;
        RETURN;
    END IF;

    -- 2. Get the Clinic ID owned by this user
    SELECT id INTO target_clinic_id FROM public.clinics WHERE owner_id = target_user_id;

    -- 3. Break circular references in profiles
    UPDATE public.profiles SET clinic_id = NULL WHERE id = target_user_id;
    
    -- 4. Delete clinic members
    DELETE FROM public.clinic_members WHERE user_id = target_user_id OR clinic_id = target_clinic_id;

    -- 5. Delete associated data that might have FKs (optional, but good for clean tests)
    DELETE FROM public.appointments WHERE clinic_id = target_clinic_id;
    DELETE FROM public.patients WHERE clinic_id = target_clinic_id;
    DELETE FROM public.services WHERE clinic_id = target_clinic_id;

    -- 6. Delete the Clinic
    IF target_clinic_id IS NOT NULL THEN
        DELETE FROM public.clinics WHERE id = target_clinic_id;
        RAISE NOTICE 'Deleted clinic %', target_clinic_id;
    END IF;

    -- 7. Delete the Profile
    DELETE FROM public.profiles WHERE id = target_user_id;
    RAISE NOTICE 'Deleted profile for %', target_user_id;

    -- 8. Delete the Auth User
    DELETE FROM auth.users WHERE id = target_user_id;
    RAISE NOTICE 'Deleted auth user %', target_user_id;

END $$;
