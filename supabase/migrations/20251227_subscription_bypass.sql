-- Add bypass flag for selective subscription override
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS bypass_subscription BOOLEAN DEFAULT false;

-- Add checking mechanism instructions (Commentary)
-- To allow a clinic unlimited access, an admin runs:
-- UPDATE public.clinics SET bypass_subscription = true WHERE id = 'clinic_uuid';
