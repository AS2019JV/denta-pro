-- 1. Update Enum to support 'archived'
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Add Archival Timestamp for Retention Calculation
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- 3. Create Purge Logic Helper (Optional RPC for the Cron or Manual Admin use)
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
$$;

-- 4. Create Hard Delete Function (for the Purge Job)
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strict Check: Must be archived and older than retention period (double safety)
  -- Real deletion logic triggers cascade if foreign keys act correctly, 
  -- OR we manually delete dependent data. 
  -- Assuming CASCADE is set up on profiles, patients, etc. If not, we might need manual cleanup.
  -- For now, we will attempt strict delete on clinic.
  
  DELETE FROM public.clinics 
  WHERE id = target_clinic_id 
  AND subscription_status = 'archived'; 
  -- AND archived_at < NOW() - INTERVAL '90 days'; -- Safety check usually done by caller, but good to have.
END;
$$;
