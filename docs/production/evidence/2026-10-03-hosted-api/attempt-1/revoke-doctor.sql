-- Only the owned synthetic actor in phihonofwyerpfgqfekt; never refresh its original JWT.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $owned$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='272d63b1-38e3-4a60-89a2-dd07f031b2d2' AND email LIKE 'clinia-doctor_a-%@clinia.invalid')
  THEN RAISE EXCEPTION 'Owned synthetic doctor required'; END IF; END $owned$;
UPDATE public.clinic_members SET status='removed' WHERE user_id='272d63b1-38e3-4a60-89a2-dd07f031b2d2' AND clinic_id='d9a47157-1d36-43df-af1d-436d561ee551';
COMMIT;
