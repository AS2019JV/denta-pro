-- 1. Grant Permissions to Auth Admin (Required for Hook to read Clinics)
GRANT SELECT ON public.clinics TO supabase_auth_admin;

-- 2. Update the Auth Hook (Caching Strategy)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_clinic_id uuid;
  
  -- Clinic Data
  c_subscription_status text;
  c_trial_ends_at timestamptz;
  c_bypass boolean;
  
  -- Computed
  is_active boolean;
BEGIN
  -- Fetch Profile & Clinic Data in one efficient query
  SELECT 
    p.role, 
    p.clinic_id,
    c.subscription_status::text,
    c.trial_ends_at,
    c.bypass_subscription
  INTO 
    user_role, user_clinic_id, c_subscription_status, c_trial_ends_at, c_bypass
  FROM public.profiles p
  LEFT JOIN public.clinics c ON p.clinic_id = c.id
  WHERE p.id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_clinic_id IS NOT NULL THEN
     -- 1. Standard Claims
     claims := jsonb_set(claims, '{app_metadata, clinic_id}', to_jsonb(user_clinic_id));
     claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
     
     -- 2. Subscription Caching (Optimization)
     -- Compute 'Active' status once at login/refresh time to save DB CPU on RLS
     is_active := (
        COALESCE(c_bypass, false) = true
        OR c_subscription_status = 'active'
        OR (
             (c_subscription_status IS NULL OR c_subscription_status = 'trial') 
             AND 
             (c_trial_ends_at IS NULL OR c_trial_ends_at > NOW())
           )
     );
     
     -- Inject into JWT
     claims := jsonb_set(claims, '{app_metadata, subscription_status}', to_jsonb(COALESCE(c_subscription_status, 'trial')));
     claims := jsonb_set(claims, '{app_metadata, subscription_active}', to_jsonb(is_active));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  return event;
END;
$$;

-- 3. Optimize the RLS Helper Function to use JWT Cache
-- This instantly optimizes ALL policies (Patients, Records, Appointments) 
-- that rely on this function.
CREATE OR REPLACE FUNCTION public.check_subscription_active(check_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  jwt_active boolean;
BEGIN
  -- Optimistic Check: Read from JWT (Zero Cost)
  -- Note: We trust the JWT 'clinic_id' matches the 'check_clinic_id' usually, 
  -- but RLS policies enforce "clinic_id = auth.jwt()->clinic_id" anyway.
  
  -- Attempt to read pre-calculated status
  jwt_active := (auth.jwt() -> 'app_metadata' ->> 'subscription_active')::boolean;
  
  IF jwt_active IS NOT NULL THEN
    RETURN jwt_active;
  END IF;

  -- Fallback: DB Lookup (If JWT is old or missing claim)
  -- This ensures robustness if the Hook failed or Token is legacy.
  RETURN EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = check_clinic_id
    AND (
      bypass_subscription = true 
      OR 
      (subscription_status = 'active')
      OR
      (trial_ends_at > NOW()) 
    )
  );
END;
$$;
