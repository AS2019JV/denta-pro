-- Security hardening for Receptionist View
-- Explicitly cast medical_alerts to ensure consistent Type behavior

DROP VIEW IF EXISTS public.receptionist_patient_view;

CREATE VIEW public.receptionist_patient_view AS
SELECT 
    id, 
    clinic_id, 
    first_name, 
    last_name, 
    phone, 
    email, 
    -- Explicit Cast for Frontend Type Safety
    COALESCE(medical_alerts, '')::TEXT as medical_alerts, 
    created_at 
FROM public.patients
WHERE deleted_at IS NULL;

GRANT SELECT ON public.receptionist_patient_view TO authenticated;
