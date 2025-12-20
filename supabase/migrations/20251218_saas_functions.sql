-- 1. AUTH HOOK FUNCTION
-- Creates the hook function to inject claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text; 
  user_clinic_id uuid;
BEGIN
  -- 1. Fetch role and clinic_id from public.profiles
  SELECT role, clinic_id INTO user_role, user_clinic_id
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- 2. Inject into JWT claims
  if user_clinic_id is not null then
    claims := jsonb_set(claims, '{app_metadata, clinic_id}', to_jsonb(user_clinic_id));
    claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
  end if;

  -- 3. Return modified event
  event := jsonb_set(event, '{claims}', claims);
  return event;
END;
$$;

-- Grant permissions (Supabase Auth needs this)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;

-- 2. SOFT DELETE CRON JOB
-- Requires pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete notifications older than 90 days
    DELETE FROM public.notifications 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleanup run at %s. Safe mode active.', NOW();
END;
$$;

-- Schedule it (Daily at 3am)
-- Wrap in DO block to avoid error if already scheduled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-soft-delete') THEN
        PERFORM cron.schedule(
            'cleanup-soft-delete',
            '0 3 * * *',
            'SELECT public.cleanup_soft_deleted_records()'
        );
    END IF;
END
$$;
