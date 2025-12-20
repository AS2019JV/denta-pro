-- Add columns to capture onboarding data
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS size text,
ADD COLUMN IF NOT EXISTS previous_software text,
ADD COLUMN IF NOT EXISTS onboarding_notes text;
