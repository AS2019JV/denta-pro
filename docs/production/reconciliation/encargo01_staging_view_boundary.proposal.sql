-- REVIEW PROPOSAL ONLY: execute exclusively against phihonofwyerpfgqfekt.
-- Not a canonical migration. Do not db push this directory or the legacy folder.
-- The executor must verify the connector project_id and live preflight first.
-- PostgreSQL current_database() is postgres in both projects and cannot prove identity.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'receptionist_patient_view' AND c.relkind = 'v'
  ) THEN
    RAISE EXCEPTION 'Expected staging demographic view is absent; stop for review';
  END IF;
END;
$guard$;

-- Preserve the existing columns and dependencies; make reads obey base-table RLS.
ALTER VIEW public.receptionist_patient_view SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.receptionist_patient_view FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.receptionist_patient_view FROM authenticated;
-- SELECT already exists in captured staging; no new grants or policies are added.
COMMIT;
