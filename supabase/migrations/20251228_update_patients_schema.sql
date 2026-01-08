ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS guardian_name text,
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS referred_by text,
ADD COLUMN IF NOT EXISTS clinical_notes text,
ADD COLUMN IF NOT EXISTS medical_record_number text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ADD COLUMN IF NOT EXISTS tags text[];

-- Optional: Add an index on email or phone if needed for faster lookups during import
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(email);
