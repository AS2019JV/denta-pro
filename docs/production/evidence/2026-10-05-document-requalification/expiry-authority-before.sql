SELECT now() observed_at, 'before' phase, 'ae54f779-8e99-414a-87ee-b554107e7f8a' actor_id, 'd9a47157-1d36-43df-af1d-436d561ee551' clinic_id, '41069974-b77e-4d29-9fd0-383db5b3fdea' session_id,
 p.status='active' profile_active, p.deleted_at IS NULL profile_not_deleted,
 EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND m.role='doctor' AND m.status='active') doctor_membership_active,
 u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) auth_user_active,
 EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id='41069974-b77e-4d29-9fd0-383db5b3fdea' AND s.user_id=p.id) session_present
 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id='ae54f779-8e99-414a-87ee-b554107e7f8a' AND p.role='doctor' AND p.clinic_id='d9a47157-1d36-43df-af1d-436d561ee551'
 AND p.email ~ '^clinia-document-expiry_a-[a-f0-9]{12}@clinia\.invalid$';