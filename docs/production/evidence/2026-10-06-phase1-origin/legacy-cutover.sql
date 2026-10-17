BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL app.scoped_fixture_authorized='local-synthetic';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled)
 OR EXISTS(SELECT 1 FROM security_internal.retired_storage_objects)
 OR (SELECT count(*) FROM storage.objects)<>12
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='272d63b1-38e3-4a60-89a2-dd07f031b2d2' AND email LIKE '%@clinia.invalid')
 OR NOT EXISTS(SELECT 1 FROM public.clinics WHERE id='d9a47157-1d36-43df-af1d-436d561ee551' AND owner_id='baef66ba-f8d8-4943-af16-26bb429f9fe0' AND logo_url IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.patients WHERE id='b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14' AND clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND avatar_url IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='272d63b1-38e3-4a60-89a2-dd07f031b2d2' AND avatar_url IS NULL)
 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='patient-files' AND name='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-f00b1cf6-3074-46a9-8f74-4782a176d500.pdf' AND (metadata->>'size')::integer=70)
OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='patient-files' AND name='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-3063964d-88ff-44b8-842d-02d2a419d7fe.pdf' AND (metadata->>'size')::integer=70)
OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='patient-files' AND name='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-5ec0d2e1-9ab3-4057-87f2-5c7bbaa46ef6.pdf' AND (metadata->>'size')::integer=56)
OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='clinic-branding' AND name='d9a47157-1d36-43df-af1d-436d561ee551/origin-0e6c6cd5-1902-4650-a927-668c9e9d34bd.png' AND (metadata->>'size')::integer=68)
OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='doctor-avatars' AND name='272d63b1-38e3-4a60-89a2-dd07f031b2d2/origin-ca996a67-d977-43f6-9bdf-29a80e8d52ad.png' AND (metadata->>'size')::integer=68)
OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='patient-avatars' AND name='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-8e294953-6c4f-4fa0-aad5-5501916eed5e.png' AND (metadata->>'size')::integer=68)
 THEN RAISE EXCEPTION 'Exact copied synthetic fixture baseline required'; END IF;
END $guard$;
DO $cutover$ DECLARE n integer; BEGIN
 UPDATE public.patient_files SET delivery_path='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-3063964d-88ff-44b8-842d-02d2a419d7fe.pdf' WHERE id='4e3b7af1-c025-4ab6-bda5-b48d4e11d0c8' AND delivery_path='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf' AND file_path='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Exact synthetic registered file required'; END IF;
 UPDATE public.clinics SET logo_url='d9a47157-1d36-43df-af1d-436d561ee551/origin-0e6c6cd5-1902-4650-a927-668c9e9d34bd.png' WHERE id='d9a47157-1d36-43df-af1d-436d561ee551';
 UPDATE public.profiles SET avatar_url='272d63b1-38e3-4a60-89a2-dd07f031b2d2/origin-ca996a67-d977-43f6-9bdf-29a80e8d52ad.png' WHERE id='272d63b1-38e3-4a60-89a2-dd07f031b2d2';
 UPDATE public.patients SET avatar_url='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/origin-8e294953-6c4f-4fa0-aad5-5501916eed5e.png' WHERE id='b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14';
 INSERT INTO security_internal.retired_storage_objects(bucket_id,name) VALUES ('patient-files','d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-2.pdf'),('patient-files','d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf'),('patient-files','d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/nostore-e3e326f1-f046-4703-b3eb-0cad025f159e.pdf'),('clinic-branding','d9a47157-1d36-43df-af1d-436d561ee551/hosted-1-run-3.png'),('doctor-avatars','272d63b1-38e3-4a60-89a2-dd07f031b2d2/hosted-1-run-3.png'),('patient-avatars','d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.png');
 IF EXISTS(SELECT 1 FROM public.patient_files f JOIN security_internal.retired_storage_objects r ON r.bucket_id='patient-files' AND r.name=f.delivery_path WHERE f.deleted_at IS NULL) THEN RAISE EXCEPTION 'Active file still references retired physical key'; END IF;
END $cutover$;
COMMIT;
SELECT jsonb_build_object('project','phihonofwyerpfgqfekt','observed_at',now(),'retired',(SELECT count(*) FROM security_internal.retired_storage_objects),'delivery_enabled',EXISTS(SELECT 1 FROM security_internal.document_delivery_principals WHERE enabled),'document_path',(SELECT delivery_path FROM public.patient_files WHERE id='4e3b7af1-c025-4ab6-bda5-b48d4e11d0c8')) AS state;
