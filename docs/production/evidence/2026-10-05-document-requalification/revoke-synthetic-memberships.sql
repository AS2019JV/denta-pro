BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND m.role='doctor' AND m.status='active' AND p.role='doctor'
 AND p.email ~ '^clinia-document-(removed_a|demoted_a)-[a-f0-9]{12}@clinia\.invalid$'
 AND m.user_id IN ('9ca4975a-c71d-48d6-b1c9-bcea424a217f','a5fe4c2a-1d92-4a58-a9c0-5af322dad07e'))<>2
 THEN RAISE EXCEPTION 'Exact warmed synthetic doctor memberships required'; END IF;
END $guard$;
DELETE FROM public.clinic_members WHERE clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND user_id='9ca4975a-c71d-48d6-b1c9-bcea424a217f' AND role='doctor';
UPDATE public.clinic_members SET role='receptionist' WHERE clinic_id='d9a47157-1d36-43df-af1d-436d561ee551' AND user_id='a5fe4c2a-1d92-4a58-a9c0-5af322dad07e' AND role='doctor';
COMMIT;
SELECT now() observed_at,
 (SELECT count(*) FROM public.clinic_members WHERE user_id='9ca4975a-c71d-48d6-b1c9-bcea424a217f') removed_memberships,
 (SELECT role FROM public.clinic_members WHERE user_id='a5fe4c2a-1d92-4a58-a9c0-5af322dad07e' AND clinic_id='d9a47157-1d36-43df-af1d-436d561ee551') demoted_member_role,
 (SELECT role FROM public.profiles WHERE id='a5fe4c2a-1d92-4a58-a9c0-5af322dad07e') stale_profile_role;
