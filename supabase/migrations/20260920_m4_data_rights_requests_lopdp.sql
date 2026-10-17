-- ============================================================================
-- Migration: 20260920_m4_data_rights_requests_lopdp.sql
-- Description: Milestone 4 - Statutory LOPDP Rights Requests & Medical Custody Persistence
-- Covers:
--   - R4-B: public.data_rights_requests Table, Indices, & RLS Policies
--   - Statutory LOPDP Data Rights Helper RPC (log_data_rights_request)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Create structured audit table for LOPDP data rights requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('portability', 'deletion', 'rectification', 'access', 'opposition', 'custody_lock')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'archived_custody')),
  details JSONB DEFAULT '{}'::jsonb,
  legal_basis TEXT NOT NULL,
  retention_note TEXT,
  requested_by_email TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indices for performance and tenant scoping
CREATE INDEX IF NOT EXISTS idx_data_rights_requests_tenant 
  ON public.data_rights_requests(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_rights_requests_type 
  ON public.data_rights_requests(clinic_id, request_type);

-- ============================================================================
-- 2. Enable RLS on data_rights_requests & Establish Tenant Boundaries
-- ============================================================================

ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can view data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Authenticated users can submit data rights requests" ON public.data_rights_requests;
DROP POLICY IF EXISTS "Clinic owners can update data rights requests" ON public.data_rights_requests;

-- SELECT: Clinic members can view requests belonging to their clinic
CREATE POLICY "Clinic members can view data rights requests"
ON public.data_rights_requests FOR SELECT
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- INSERT: Authenticated users can submit requests for their own active clinic
CREATE POLICY "Authenticated users can submit data rights requests"
ON public.data_rights_requests FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- UPDATE: Strictly clinic owners can resolve or update request status
CREATE POLICY "Clinic owners can update data rights requests"
ON public.data_rights_requests FOR UPDATE
TO authenticated
USING (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
)
WITH CHECK (
  clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
);

-- DELETE: Strictly service_role (statutory privacy logs are immutable for tenant users)
REVOKE DELETE ON public.data_rights_requests FROM authenticated, anon, public;

GRANT SELECT, INSERT, UPDATE ON public.data_rights_requests TO authenticated;
GRANT ALL ON public.data_rights_requests TO service_role;

-- ============================================================================
-- 3. Helper RPC to log statutory data rights request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_data_rights_request(
  p_request_type TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_legal_basis TEXT DEFAULT 'LOPDP Art. 17',
  p_retention_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_caller_email TEXT;
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_clinic_id := (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;
  IF v_clinic_id IS NULL THEN
    SELECT clinic_id INTO v_clinic_id
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinic context not found for caller.' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.data_rights_requests (
    clinic_id,
    user_id,
    request_type,
    status,
    details,
    legal_basis,
    retention_note,
    requested_by_email
  )
  VALUES (
    v_clinic_id,
    auth.uid(),
    p_request_type,
    'pending',
    COALESCE(p_details, '{}'::jsonb),
    p_legal_basis,
    p_retention_note,
    v_caller_email
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'clinic_id', v_clinic_id,
    'request_type', p_request_type,
    'legal_basis', p_legal_basis
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
