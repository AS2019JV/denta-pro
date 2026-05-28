-- Create storage bucket for clinic branding if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-branding', 'clinic-branding', true)
ON CONFLICT (id) DO NOTHING;

-- SECURITY: Row Level Security Policies for the Bucket

-- 1. Allow authenticated users to VIEW (SELECT) files.
--    (Necessary so PDF generator or frontend can see the logo)
CREATE POLICY "Public Access to Clinic Logos"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'clinic-branding' );

-- 2. Allow Clinic Owners to UPLOAD (INSERT) files.
CREATE POLICY "Owners can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinic-branding' AND (
    is_clinic_member((storage.foldername(name))[1]::uuid)
    OR
    EXISTS (
      SELECT 1 FROM public.clinics 
      WHERE id::text = (storage.foldername(name))[1] 
      AND owner_id = auth.uid()
    )
  )
);

-- 3. Allow Owners to UPDATE/DELETE their own files
CREATE POLICY "Owners can update their logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinic-branding' AND (
    is_clinic_member((storage.foldername(name))[1]::uuid)
    OR
    EXISTS (
      SELECT 1 FROM public.clinics 
      WHERE id::text = (storage.foldername(name))[1] 
      AND owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners can delete their logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinic-branding' AND (
    is_clinic_member((storage.foldername(name))[1]::uuid)
    OR
    EXISTS (
      SELECT 1 FROM public.clinics 
      WHERE id::text = (storage.foldername(name))[1] 
      AND owner_id = auth.uid()
    )
  )
);
