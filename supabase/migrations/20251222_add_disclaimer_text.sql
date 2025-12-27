ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS disclaimer_text TEXT 
DEFAULT 'This estimate is valid for 30 days. Please contact the front desk for questions.';
