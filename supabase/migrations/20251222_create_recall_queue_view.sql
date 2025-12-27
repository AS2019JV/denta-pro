-- Drop if exists to avoid errors on re-run
DROP VIEW IF EXISTS public.recall_queue;

CREATE OR REPLACE VIEW public.recall_queue AS
SELECT 
  p.id AS patient_id,
  p.clinic_id,
  p.first_name,
  p.last_name,
  p.phone,
  p.email,
  MAX(cr.created_at) as last_visit_date
FROM public.patients p
LEFT JOIN public.clinical_records cr ON p.id = cr.patient_id
GROUP BY p.id, p.clinic_id, p.first_name, p.last_name, p.phone, p.email
HAVING MAX(cr.created_at) < NOW() - INTERVAL '6 months' -- Flag if seen > 6 months ago
   OR MAX(cr.created_at) IS NULL; -- Or never seen (new patients who ghosted)

-- Grant access to the view
GRANT SELECT ON public.recall_queue TO authenticated;
