SELECT now() observed_at,p.enabled,p.expires_at>now() window_active,
 u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) auth_user_active,
 EXISTS(SELECT 1 FROM auth.sessions WHERE id='4de6699d-694a-4575-a200-7b9f6dbb9db1' AND user_id=p.user_id) session_present,
 EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='patient-files' AND name='d9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf') object_present,
 EXISTS(SELECT 1 FROM public.patient_files WHERE id='4e3b7af1-c025-4ab6-bda5-b48d4e11d0c8' AND deleted_at IS NULL) registration_active
 FROM security_internal.document_delivery_principals p JOIN auth.users u ON u.id=p.user_id WHERE p.user_id='378b431f-f043-489c-820b-347901a78d11';