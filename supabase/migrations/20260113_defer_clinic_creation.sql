-- Function to handle clinic creation upon email verification
-- This ensures clinics are only created AFTER the user verifies their email, preventing duplicates.

CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS TRIGGER AS $$
DECLARE
  pending_data JSONB;
  new_clinic_id UUID;
  new_profile_id UUID;
BEGIN
  -- Check if email was just confirmed (transition from NULL to NOT NULL)
  -- AND we have pending clinic data in metadata
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    pending_data := NEW.raw_user_meta_data->'pending_clinic';
    
    IF pending_data IS NOT NULL THEN
      
      -- Verify we don't already have a clinic for this user (double safety)
      -- Check profiles table (id = user_id)
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id AND clinic_id IS NOT NULL) THEN
         -- Already has clinic, assume processed or manual intervention. 
         -- Clear pending data to avoid confusion.
         NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';
         RETURN NEW;
      END IF;

      -- Use provided ID or generate new one
      IF (pending_data->>'id') IS NOT NULL AND (pending_data->>'id') != '' THEN
         new_clinic_id := (pending_data->>'id')::uuid;
      ELSE
         new_clinic_id := gen_random_uuid();
      END IF;

      -- 1. Create Clinic
      INSERT INTO public.clinics (id, name, address, phone, subscription_tier, owner_id)
      VALUES (
        new_clinic_id,
        pending_data->>'name',
        pending_data->>'address',
        pending_data->>'phone',
        COALESCE(pending_data->>'subscription_tier', 'trial'),
        NEW.id
      )
      ON CONFLICT (id) DO NOTHING;
      
      -- 2. Create/Upsert Profile
      INSERT INTO public.profiles (id, clinic_id, role, full_name, status)
      VALUES (
        NEW.id,
        new_clinic_id,
        'clinic_owner',
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'active'
      )
      ON CONFLICT (id) DO UPDATE SET
        clinic_id = excluded.clinic_id,
        role = excluded.role,
        status = excluded.status;
        
      -- 3. Create Membership (Backfill support)
      INSERT INTO public.clinic_members (user_id, clinic_id, role)
      VALUES (NEW.id, new_clinic_id, 'clinic_owner')
      ON CONFLICT (user_id, clinic_id) DO NOTHING;

      -- 4. Update Auth Metadata (app_metadata) so JWT has correct claims immediately
      NEW.raw_app_meta_data := jsonb_set(
        COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
        '{clinic_id}',
        to_jsonb(new_clinic_id)
      );
      
      NEW.raw_app_meta_data := jsonb_set(
        NEW.raw_app_meta_data,
        '{role}',
        '"clinic_owner"'
      );

      -- 5. Roundup: Clear the pending data
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_verified_clinic_creation();
