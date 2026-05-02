CREATE OR REPLACE FUNCTION public.handle_verified_clinic_creation()
RETURNS TRIGGER AS $$
DECLARE
  pending_data JSONB;
  new_clinic_id UUID;
BEGIN
  -- Check if email was just confirmed (transition from NULL to NOT NULL)
  -- AND we have pending clinic data in metadata
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    pending_data := NEW.raw_user_meta_data->'pending_clinic';
    
    IF pending_data IS NOT NULL THEN
      
      -- Verify we don't already have a clinic for this user (double safety)
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id AND clinic_id IS NOT NULL) THEN
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
      
      -- 2. Update Profile (created by handle_new_user)
      UPDATE public.profiles
      SET 
        clinic_id = new_clinic_id,
        role = 'clinic_owner'::public.app_role
      WHERE id = NEW.id;
        
      -- 3. Update Auth Metadata (app_metadata) so JWT has correct claims immediately
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

      -- 4. Roundup: Clear the pending data
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'pending_clinic';
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
