-- Prospective MFA gate for human clinical access on the reviewed baseline.
-- The exact function hashes and explicit relation inventory abort on drift;
-- never use this as a blind repair of an occupied production database.
-- Keep clinia_session_active() unchanged so verified-email enrollment and
-- invitation redemption can finish at AAL1; clinical authority is gated here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $preflight$
DECLARE v record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('public.clinia_session_active()')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='bd4312480311fa40dc37425aa3d1eeb9'
  ) THEN RAISE EXCEPTION 'Reviewed live-session authority prerequisite required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('security_internal.role_for(uuid,uuid)')
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))='feef8739b4cf30e59de0777ad1b608be'
  ) THEN RAISE EXCEPTION 'Reviewed canonical role authority prerequisite required'; END IF;

  IF to_regprocedure('public.clinia_mfa_active()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='public')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE policyname='clinia_mfa_gate' AND schemaname='storage' AND tablename='objects')
  THEN RAISE EXCEPTION 'MFA migration already applied; reviewed repair required'; END IF;

  -- Explicit relation inventory: require an exact match with staging's full
  -- public RLS table set. Any missing or newly added public RLS table aborts.
  IF EXISTS (
    SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
    EXCEPT SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
  ) OR EXISTS (
    SELECT relation_name FROM (VALUES
      ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
      ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
      ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
      ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
      ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
      ('prescriptions')
    ) AS inventory(relation_name)
    EXCEPT SELECT c.relname::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Public RLS relation inventory changed; review required'; END IF;

  -- Each reviewed table must exist as an RLS-enabled public table.
  FOR v IN SELECT relation_name FROM (VALUES
    ('patients'),('automation_settings'),('profile_audit_log'),('payment_methods'),
    ('messages'),('billings'),('treatments'),('notifications'),('invoices'),('payments'),
    ('services'),('clinics'),('patient_files'),('clinical_records'),('hcu033_forms'),
    ('patient_notes'),('prescription_templates'),('clinic_members'),('profiles'),
    ('service_categories'),('data_rights_requests'),('appointments'),('clinic_invitations'),
    ('prescriptions')
  ) AS inventory(relation_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v.relation_name AND c.relkind IN ('r','p')
        AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Reviewed public RLS table prerequisite required: %',v.relation_name; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='storage.objects'::regclass AND c.relrowsecurity)
    OR (SELECT count(*) FROM storage.buckets
      WHERE id IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding') AND public IS FALSE)<>4
  THEN RAISE EXCEPTION 'Reviewed private Storage baseline prerequisite required'; END IF;
END $preflight$;

-- The old live-session function remains an enrollment/session check. This new
-- authority additionally binds the signed AAL2 JWT to a factor still verified
-- for this same Auth user, so stale AAL2 tokens fail after factor removal.
CREATE FUNCTION public.clinia_mfa_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.clinia_session_active() IS TRUE
    AND (auth.jwt()->>'aal')='aal2'
    AND EXISTS (SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id=auth.uid() AND f.status='verified' AND f.factor_type='totp');
$function$;
REVOKE ALL ON FUNCTION public.clinia_mfa_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_mfa_active() TO authenticated;

-- A caller asking for their own clinic role must have verified MFA. A role
-- lookup for an assigned offline user and a separately gated service lookup
-- retain their existing semantics.
CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_mfa_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Restrictive policies clamp older permissive JWT/metadata policies for all
-- human operations on every reviewed public application table.
CREATE POLICY clinia_mfa_gate ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinics AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinic_invitations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patients AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.appointments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.services AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.clinical_records AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.hcu033_forms AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_notes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.patient_files AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescriptions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.prescription_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.payment_methods AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.data_rights_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.automation_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.profile_audit_log AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.billings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.treatments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());
CREATE POLICY clinia_mfa_gate ON public.service_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.clinia_mfa_active()) WITH CHECK (public.clinia_mfa_active());

-- The isolated document-delivery role is not a member of authenticated and is
-- deliberately unaffected. Existing patient-files human-deny policy remains
-- in force; this gate only strengthens human Storage access for the four
-- private clinic buckets.
CREATE POLICY clinia_mfa_gate ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active())
  WITH CHECK (bucket_id NOT IN ('patient-files','patient-avatars','doctor-avatars','clinic-branding')
    OR public.clinia_mfa_active());

NOTIFY pgrst,'reload schema';
COMMIT;
