-- Create the RPC for Read-Audit Beacon
CREATE OR REPLACE FUNCTION logs.log_patient_view(p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clinic_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Extract clinic_id from JWT (Performance & Security)
  -- We trust the JWT because it's signed and validated by the Hook
  v_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;

  IF v_user_id IS NOT NULL AND v_clinic_id IS NOT NULL THEN
    INSERT INTO logs.access_audit (
      clinic_id,
      user_id,
      table_name,
      record_id,
      operation,
      old_data, -- No old data for a Read
      new_data, -- Add context about the view
      created_at
    ) VALUES (
      v_clinic_id,
      v_user_id,
      'patients',
      p_patient_id,
      'SELECT',
      null,
      jsonb_build_object('source', 'patient_profile_view', 'client', 'web_dashboard'),
      now()
    );
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION logs.log_patient_view(uuid) TO authenticated;
