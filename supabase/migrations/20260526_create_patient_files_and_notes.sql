-- Migration: Create patient files and notes tables to eliminate hardcoded elements.
-- Created: 2026-05-26

-- ====================================================================
-- PART 1: Patient Files Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_files (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  size text NOT NULL,
  type text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamp with time zone
);

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their clinic"
  ON public.patient_files FOR SELECT
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert files in their clinic"
  ON public.patient_files FOR INSERT
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
  );

CREATE POLICY "Users can update files in their clinic"
  ON public.patient_files FOR UPDATE
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
  );

-- ====================================================================
-- PART 2: Patient Notes Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_notes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  deleted_at timestamp with time zone
);

ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their clinic"
  ON public.patient_notes FOR SELECT
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert notes in their clinic"
  ON public.patient_notes FOR INSERT
  WITH CHECK (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
  );

CREATE POLICY "Users can update notes in their clinic"
  ON public.patient_notes FOR UPDATE
  USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND public.check_subscription_active(clinic_id)
  );

-- ====================================================================
-- PART 3: Grant Permissions and Create Storage Bucket setup
-- ====================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_notes TO authenticated;

-- Ensure indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_patient_files_patient ON public.patient_files(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON public.patient_notes(patient_id) WHERE deleted_at IS NULL;

-- ====================================================================
-- PART 4: Auto-register patient-files storage bucket
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO NOTHING;

-- Grant access to storage
CREATE POLICY "Users can upload patient files" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Users can read patient files" 
  ON storage.objects FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'patient-files');

CREATE POLICY "Users can delete patient files" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'patient-files');

