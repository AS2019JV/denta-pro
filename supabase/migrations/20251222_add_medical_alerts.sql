-- 1. Add medical_alerts column to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS medical_alerts TEXT;

-- 2. Drop the existing restricted view
DROP VIEW IF EXISTS public.receptionist_patient_view;

-- 3. Recreate the view including medical_alerts
-- Receptionists need to see safety warnings (medical_alerts)
-- But NOT the deep clinical records (diagnosis, treatment_plan, notes in clinical_records table)
CREATE VIEW public.receptionist_patient_view AS
SELECT 
    id, 
    clinic_id, 
    first_name, 
    last_name, 
    phone, 
    email, 
    medical_alerts, -- Added
    created_at 
FROM public.patients
WHERE deleted_at IS NULL;

-- 4. Grant permissions (ensure authenticated users can select from this view)
GRANT SELECT ON public.receptionist_patient_view TO authenticated;
