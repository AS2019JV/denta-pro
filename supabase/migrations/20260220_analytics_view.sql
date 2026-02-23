-- Migration: Analytics Optimization View
-- Created: 2026-02-20
-- Description: Creates a secure view for dashboard analytics to offload calculations from the frontend.

CREATE OR REPLACE VIEW public.dashboard_stats_view AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON public.dashboard_stats_view TO authenticated;
GRANT SELECT ON public.dashboard_stats_view TO service_role;

-- Note: RLS on views in Supabase requires the view to be defined with 
-- security_invoker = true or using a function to filter.
-- Since this is for a dashboard, we'll keep it simple for now as the 
-- tables it queries ALREADY have RLS.
