-- Create a secure view for clinic owners to see their audit logs
CREATE OR REPLACE VIEW public.clinic_audit_logs AS
SELECT 
    timestamp,
    actor_id,
    actor_role,
    action,
    table_name,
    record_id,
    metadata
FROM logs.access_audit
WHERE clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner';

GRANT SELECT ON public.clinic_audit_logs TO authenticated;
