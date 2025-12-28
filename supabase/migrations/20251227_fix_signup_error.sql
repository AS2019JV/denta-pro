-- FIX: Drop the legacy 'handle_new_user' trigger which attempts to auto-create profiles
-- This conflicts with the new "Genesis Flow" (Onboarding) where profiles are created manually.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Ensure profile constraints are compatible with the flow if valid
-- (We don't need to do anything else if the trigger is gone)
