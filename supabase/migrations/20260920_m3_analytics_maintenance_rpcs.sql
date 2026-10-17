-- ============================================================================
-- Migration: 20260920_m3_analytics_maintenance_rpcs.sql
-- Description: Milestone 3 - API, Maintenance, & Payment Hardening (SEC-08, SEC-09)
-- Covers:
--   - SEC-08: Dashboard Analytics View Isolation with security_invoker = true
--             and explicit clinic_id tenant filter
--   - SEC-09: Maintenance RPCs Execution Revocation from public/authenticated/anon
--             and re-enabling statutory 90-day retention lock in purge_clinic_data
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SEC-08: Dashboard Analytics View Isolation
-- ============================================================================
-- Prior view (20260220_analytics_view.sql) lacked WITH (security_invoker = true)
-- and lacked WHERE clinic_id = ... filter, allowing any authenticated tenant to
-- read billing sums, revenues, and patient counts across all clinics.

DROP VIEW IF EXISTS public.dashboard_stats_view;

CREATE VIEW public.dashboard_stats_view
WITH (security_invoker = true) AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

GRANT SELECT ON public.dashboard_stats_view TO authenticated;
GRANT SELECT ON public.dashboard_stats_view TO service_role;


-- ============================================================================
-- 2. SEC-09: Maintenance RPCs Hardening & Statutory Retention Lock
-- ============================================================================
-- archive_clinic, purge_clinic_data, and seed_default_services were SECURITY DEFINER
-- functions with default EXECUTE privileges to PUBLIC, allowing any user to archive
-- or permanently destroy competitor clinics.

-- 2.1 Recreate purge_clinic_data with re-enabled 90-day retention guard
CREATE OR REPLACE FUNCTION public.purge_clinic_data(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_at TIMESTAMP WITH TIME ZONE;
  v_status TEXT;
BEGIN
  -- Strict Check: Must be archived and older than retention period (double safety)
  SELECT subscription_status, archived_at
  INTO v_status, v_archived_at
  FROM public.clinics
  WHERE id = target_clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clinic not found';
  END IF;

  IF v_status IS DISTINCT FROM 'archived' OR v_archived_at IS NULL THEN
    RAISE EXCEPTION 'Cannot purge unarchived clinic';
  END IF;

  IF v_archived_at > (NOW() - INTERVAL '90 days') THEN
    RAISE EXCEPTION 'Statutory 90-day retention lock active. Purge rejected.';
  END IF;

  DELETE FROM public.clinics 
  WHERE id = target_clinic_id 
  AND subscription_status = 'archived'
  AND archived_at < NOW() - INTERVAL '90 days';
END;
$$;

-- 2.2 Recreate archive_clinic with explicit search_path
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
$$;

-- 2.3 Recreate seed_default_services with explicit search_path
CREATE OR REPLACE FUNCTION public.seed_default_services(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.services (clinic_id, name, price, duration_minutes, category, description)
  VALUES
  (target_clinic_id, 'Consulta General / Diagnóstico', 20.00, 30, 'General', 'Revisión general, incluye diagnóstico inicial.'),
  (target_clinic_id, 'Limpieza Dental (Profilaxis)', 30.00, 45, 'Preventiva', 'Eliminación de placa y pulido.'),
  (target_clinic_id, 'Resina Simple (1 superficie)', 30.00, 45, 'Restauradora', 'Restauración de caries pequeña o mediana.'),
  (target_clinic_id, 'Resina Compuesta/Compleja', 50.00, 60, 'Restauradora', 'Reconstrucción de partes mayores del diente.'),
  (target_clinic_id, 'Extracción Simple', 40.00, 45, 'Cirugía', 'Extracción no quirúrgica.'),
  (target_clinic_id, 'Cirugía de Tercer Molar (Cordal)', 100.00, 90, 'Cirugía', 'Cirugía de muela del juicio impactada.'),
  (target_clinic_id, 'Endodoncia (Tratamiento de Canal)', 150.00, 90, 'Endodoncia', 'Tratamiento de conductos (precio promedio).'),
  (target_clinic_id, 'Blanqueamiento Dental', 200.00, 60, 'Cosmética', 'Tratamiento LED/Láser en consultorio.'),
  (target_clinic_id, 'Corona de Porcelana/Zirconio', 300.00, 90, 'Restauradora', 'Alta durabilidad y estética.'),
  (target_clinic_id, 'Implante Dental (Fase Quirúrgica)', 700.00, 90, 'Cirugía', 'Colocación del implante (no incluye corona).'),
  (target_clinic_id, 'Ortodoncia (Control Mensual)', 30.00, 20, 'Ortodoncia', 'Ajuste y control mensual de brackets.')
  ON CONFLICT DO NOTHING;
END;
$$;

-- 2.4 Revoke public execution on maintenance functions
REVOKE ALL ON FUNCTION public.archive_clinic(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.purge_clinic_data(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.seed_default_services(uuid) FROM PUBLIC, authenticated, anon;

-- 2.5 Grant execute strictly to service_role
GRANT EXECUTE ON FUNCTION public.archive_clinic(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_clinic_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_default_services(uuid) TO service_role;

COMMIT;
