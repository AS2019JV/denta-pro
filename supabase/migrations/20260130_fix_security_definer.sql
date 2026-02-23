-- Enforce RLS on views by setting security_invoker = true
-- This ensures the view executes with the permissions of the caller, not the view owner.

BEGIN;

ALTER VIEW IF EXISTS public.receptionist_patient_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.recall_queue SET (security_invoker = true);

COMMIT;
