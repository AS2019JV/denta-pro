-- Aggregate metadata only; no names, paths, owners, URLs or clinical bytes.
SELECT jsonb_build_object(
 'required',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'mime',allowed_mime_types) ORDER BY id),'[]') FROM storage.buckets WHERE id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars')),
 'outsidePublicBuckets',(SELECT count(*) FROM storage.buckets WHERE public AND id NOT IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars')),
 'outsidePublicObjects',(SELECT count(*) FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE b.public AND b.id NOT IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars')),
 'requiredObjects',(SELECT count(*) FROM storage.objects WHERE bucket_id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars')),
 'requiredObjectsOverLocalFixtureLimit',(SELECT count(*) FROM storage.objects WHERE bucket_id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND CASE WHEN metadata->>'size' ~ '^[0-9]+$' THEN (metadata->>'size')::numeric>CASE WHEN bucket_id='patient-files' THEN 10485760 ELSE 2097152 END ELSE false END),
 'requiredUnsupportedUploadMime',(SELECT count(*) FROM storage.objects WHERE bucket_id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND coalesce(metadata->>'mimetype','') NOT IN ('image/png','image/jpeg','image/webp','application/pdf')),
 'requiredUnknownSizeMetadata',(SELECT count(*) FROM storage.objects WHERE bucket_id IN ('patient-files','patient-avatars','clinic-branding','doctor-avatars') AND NOT coalesce(metadata->>'size','') ~ '^[0-9]+$')
) AS aggregate_metadata;
