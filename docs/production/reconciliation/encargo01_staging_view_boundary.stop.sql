-- Safe post-commit containment, staging phihonofwyerpfgqfekt only.
-- This stops view access; it deliberately keeps security_invoker and data intact.
-- Exact restoration of the old ACL/options would reintroduce the known bypass;
-- it requires a separate reviewed decision, not an automatic rollback.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE ALL PRIVILEGES ON TABLE public.receptionist_patient_view FROM PUBLIC, anon, authenticated;
COMMIT;
