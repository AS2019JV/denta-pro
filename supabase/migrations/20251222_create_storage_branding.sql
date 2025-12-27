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
--    We check if the user is a 'clinic_owner' in their metadata 
--    OR if they are listed as 'clinic_owner' in profiles (more robust).
--    For simplicity and speed, we check auth.uid().
CREATE POLICY "Owners can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinic-branding' AND
  (storage.foldername(name))[1] = (
    SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid()
  )
);
-- Note: The above policy assumes the file path starts with "{clinic_id}/..."
-- Our frontend code does exactly this: `${currentClinicId}/${sanitizedFileName}`

-- 3. Allow Owners to UPDATE/DELETE their own files
CREATE POLICY "Owners can update their logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinic-branding' AND
  (storage.foldername(name))[1] = (
    SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinic-branding' AND
  (storage.foldername(name))[1] = (
    SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid()
  )
);
