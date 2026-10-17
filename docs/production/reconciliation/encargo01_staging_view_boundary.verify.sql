-- Read only. Run exclusively with connector project_id=phihonofwyerpfgqfekt.
-- One result ensures connectors returning the last result retain every check.
SELECT jsonb_build_object(
  'observed_at', now(),
  'view', (
    SELECT jsonb_build_object('options', c.reloptions, 'acl', c.relacl::text,
      'definition', pg_get_viewdef(c.oid, true))
    FROM pg_class c WHERE c.oid = 'public.receptionist_patient_view'::regclass
  ),
  'effective_privileges', (
    SELECT jsonb_agg(jsonb_build_object('role', role_name, 'privilege', privilege,
      'allowed', has_table_privilege(role_name, 'public.receptionist_patient_view', privilege))
      ORDER BY role_name, privilege)
    FROM unnest(ARRAY['anon','authenticated']) AS role_name
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE',
      'REFERENCES','TRIGGER','MAINTAIN']) AS privilege
  ),
  'anon_column_access', has_any_column_privilege('anon',
    'public.receptionist_patient_view', 'SELECT,INSERT,UPDATE,REFERENCES'),
  'patients_rls', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.patients'::regclass),
  'patient_policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='patients')
) AS verification;
