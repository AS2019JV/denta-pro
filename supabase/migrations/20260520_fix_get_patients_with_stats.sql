-- Fix: Recreate get_patients_with_stats with table-qualified "status" column 
-- to resolve "column reference 'status' is ambiguous" PL/pgSQL error (42702).
-- Also ensures clinic_members backfill so RLS INSERT policies work for all users.

-- ============================================================================
-- PART 1: Fix clinic_members backfill (prevents RLS violations on patient insert)
-- ============================================================================
-- Ensure ALL profiles with a clinic_id have a corresponding clinic_members row.
-- This covers users created after the original multi_clinic_support migration.
INSERT INTO public.clinic_members (user_id, clinic_id, role)
SELECT p.id, p.clinic_id, p.role::text
FROM public.profiles p
WHERE p.clinic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm 
    WHERE cm.user_id = p.id AND cm.clinic_id = p.clinic_id
  )
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- Add INSERT policy for clinic_members (was missing - only SELECT existed)
-- Users can add themselves as members of clinics they own or belong to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clinic_members' 
    AND policyname = 'Users can insert their own membership'
  ) THEN
    CREATE POLICY "Users can insert their own membership"
      ON public.clinic_members FOR INSERT
      WITH CHECK ( auth.uid() = user_id );
  END IF;
END
$$;

-- ============================================================================
-- PART 2: Recreate get_patients_with_stats fixing "status" ambiguity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patients_with_stats(
  p_clinic_id uuid,
  p_search text DEFAULT '',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_time_filter text DEFAULT 'all',
  p_badge_filter text DEFAULT 'all',
  p_group_by_family boolean DEFAULT false,
  p_patient_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  cedula text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  birth_date date,
  gender text,
  patient_status text,
  occupation text,
  guardian_name text,
  referral_source text,
  referred_by text,
  clinical_notes text,
  medical_record_number text,
  tags text[],
  emergency_contact text,
  emergency_phone text,
  allergies text,
  medications text,
  medical_conditions text,
  insurance_provider text,
  policy_number text,
  blood_type text,
  marital_status text,
  has_diabetes boolean,
  has_hypertension boolean,
  has_heart_disease boolean,
  is_smoker boolean,
  is_pregnant boolean,
  preferred_contact_method text,
  recall_months integer,
  internal_notes text,
  account_balance numeric,
  avatar_url text,
  family_representative_id uuid,
  family_relationship text,
  is_family_head boolean,
  family_member_count bigint,
  appointments_count bigint,
  total_billed numeric,
  last_visit timestamptz,
  next_appointment timestamptz,
  last_treatment_note text,
  odontogram_state jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total bigint;
  v_search_pattern text;
BEGIN
  -- Build search pattern
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Count total matching records
  SELECT COUNT(*) INTO v_total
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND (p_patient_id IS NULL OR pat.id = p_patient_id)
    AND (
      p_search IS NULL OR p_search = '' OR
      LOWER(pat.first_name) LIKE v_search_pattern OR
      LOWER(pat.last_name) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.email, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.phone, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.cedula, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.medical_record_number, '')) LIKE v_search_pattern
    )
    AND (
      p_time_filter = 'all'
      OR (p_time_filter = 'recent' AND pat.created_at >= NOW() - INTERVAL '7 days')
      OR (p_time_filter = 'week' AND pat.created_at >= date_trunc('week', NOW()))
      OR (p_time_filter = 'this_month' AND pat.created_at >= date_trunc('month', NOW()))
      OR (p_time_filter = 'last_month' AND pat.created_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND pat.created_at < date_trunc('month', NOW()))
    );

  RETURN QUERY
  SELECT
    pat.id,
    pat.first_name,
    pat.last_name,
    pat.cedula,
    pat.email,
    pat.phone,
    pat.address,
    pat.city,
    pat.state,
    pat.birth_date,
    pat.gender,
    COALESCE(pat.status, 'active') AS patient_status,
    pat.occupation,
    pat.guardian_name,
    pat.referral_source,
    pat.referred_by,
    pat.clinical_notes,
    pat.medical_record_number,
    pat.tags,
    pat.emergency_contact,
    pat.emergency_phone,
    pat.allergies,
    pat.medications,
    pat.medical_conditions,
    pat.insurance_provider,
    pat.policy_number,
    pat.blood_type,
    pat.marital_status,
    pat.has_diabetes,
    pat.has_hypertension,
    pat.has_heart_disease,
    pat.is_smoker,
    pat.is_pregnant,
    pat.preferred_contact_method,
    pat.recall_months,
    pat.internal_notes,
    pat.account_balance,
    pat.avatar_url,
    pat.family_representative_id,
    pat.family_relationship,
    pat.is_family_head,
    -- Family member count
    COALESCE((
      SELECT COUNT(*) FROM public.patients fam 
      WHERE fam.family_representative_id = pat.id 
        AND fam.clinic_id = p_clinic_id
    ), 0) + CASE WHEN pat.is_family_head THEN 1 ELSE 0 END AS family_member_count,
    -- Appointments count
    COALESCE((
      SELECT COUNT(*) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id
    ), 0) AS appointments_count,
    -- Total billed
    COALESCE((
      SELECT SUM(b.amount) FROM public.billings b 
      WHERE b.patient_id = pat.id
    ), 0) AS total_billed,
    -- Last visit
    (
      SELECT MAX(apt.start_time) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id 
        AND apt.status = 'completed'
    ) AS last_visit,
    -- Next appointment
    (
      SELECT MIN(apt.start_time) FROM public.appointments apt 
      WHERE apt.patient_id = pat.id 
        AND apt.start_time > NOW()
        AND apt.status IN ('scheduled', 'confirmed')
    ) AS next_appointment,
    -- Last treatment note (from most recent completed appointment)
    (
      SELECT apt.notes FROM public.appointments apt
      WHERE apt.patient_id = pat.id
        AND apt.status = 'completed'
      ORDER BY apt.start_time DESC
      LIMIT 1
    ) AS last_treatment_note,
    -- Odontogram state
    pat.odontogram_state,
    -- Total count for pagination
    v_total AS total_count
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND (p_patient_id IS NULL OR pat.id = p_patient_id)
    AND (
      p_search IS NULL OR p_search = '' OR
      LOWER(pat.first_name) LIKE v_search_pattern OR
      LOWER(pat.last_name) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.email, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.phone, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.cedula, '')) LIKE v_search_pattern OR
      LOWER(COALESCE(pat.medical_record_number, '')) LIKE v_search_pattern
    )
    AND (
      p_time_filter = 'all'
      OR (p_time_filter = 'recent' AND pat.created_at >= NOW() - INTERVAL '7 days')
      OR (p_time_filter = 'week' AND pat.created_at >= date_trunc('week', NOW()))
      OR (p_time_filter = 'this_month' AND pat.created_at >= date_trunc('month', NOW()))
      OR (p_time_filter = 'last_month' AND pat.created_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND pat.created_at < date_trunc('month', NOW()))
    )
    AND (
      p_badge_filter = 'all'
      OR (p_badge_filter = 'vip' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id
      ) >= COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10))
      OR (p_badge_filter = 'regular' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id
      ) BETWEEN 2 AND COALESCE((
        SELECT (c.settings->>'vip_threshold_appointments')::int 
        FROM public.clinics c WHERE c.id = p_clinic_id
      ), 10) - 1)
      OR (p_badge_filter = 'new' AND (
        SELECT COUNT(*) FROM public.appointments a WHERE a.patient_id = pat.id
      ) <= 1)
    )
  ORDER BY
    CASE WHEN p_group_by_family THEN pat.family_representative_id END NULLS LAST,
    pat.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
