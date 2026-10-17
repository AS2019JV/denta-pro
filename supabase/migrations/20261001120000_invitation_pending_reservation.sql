-- PROSPECTIVE: review/apply after canonical authority and operational convergence.
-- Not applied by this change. Preserve accepted/expired history without permitting
-- more than one pending reservation per clinic and normalized recipient.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

-- Keep the duplicate preflight and replacement atomic against concurrent writes.
LOCK TABLE public.clinic_invitations IN ACCESS EXCLUSIVE MODE;
DO $checked_constraint$
DECLARE actual text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO actual
  FROM pg_constraint
  WHERE conrelid = 'public.clinic_invitations'::regclass
    AND conname = 'clinic_invitations_clinic_id_email_status_key'
    AND contype = 'u';
  IF actual IS DISTINCT FROM 'UNIQUE (clinic_id, email, status)' THEN
    RAISE EXCEPTION 'Unreviewed invitation uniqueness drift; reconcile before applying';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinic_invitations WHERE status = 'pending'
    GROUP BY clinic_id, lower(email) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending recipients require review; no records were removed';
  END IF;
END
$checked_constraint$;

ALTER TABLE public.clinic_invitations
  DROP CONSTRAINT clinic_invitations_clinic_id_email_status_key;
CREATE UNIQUE INDEX clinic_invitations_one_pending_email_idx
  ON public.clinic_invitations (clinic_id, lower(email))
  WHERE status = 'pending';
COMMIT;
