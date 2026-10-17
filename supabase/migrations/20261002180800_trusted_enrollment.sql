-- PROSPECTIVE: apply only after reviewed canonical authority and convergence.
-- No metadata-based enrollment, profile privilege writes or historical repair.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$ BEGIN
  IF to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
    OR to_regprocedure('public.check_subscription_active(uuid)') IS NULL
    OR to_regprocedure('public.clinia_session_active()') IS NULL
    OR to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND tgname='on_auth_user_verified' AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'Reviewed canonical enrollment prerequisites required'; END IF;
END $preflight$;

CREATE TABLE security_internal.clinic_registration_intents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  clinic_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  address text NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
  phone text NOT NULL CHECK (length(phone)<=40),
  size text NOT NULL CHECK (size IN ('small','medium','large')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE security_internal.clinic_registration_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.clinic_registration_intents FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.clinic_invitations
  ADD COLUMN auth_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN accepted_at timestamptz;
-- Existing invitations deliberately remain unready, requiring reviewed resend.

CREATE FUNCTION public.store_clinic_registration_intent(
  p_user_id uuid,p_clinic_id uuid,p_email text,p_name text,p_address text,p_phone text,p_size text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_existing security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_clinic_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id
      AND lower(email)=lower(btrim(p_email)) AND email_confirmed_at IS NULL
      AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- The only writer is the gated server signup path, using the Auth ID returned
  -- from its own createUser call. An existing request cannot be repurposed.
  INSERT INTO security_internal.clinic_registration_intents(user_id,clinic_id,email,name,address,phone,size)
    VALUES(p_user_id,p_clinic_id,lower(btrim(p_email)),btrim(p_name),btrim(p_address),btrim(p_phone),p_size)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_existing FROM security_internal.clinic_registration_intents WHERE user_id=p_user_id FOR UPDATE;
  IF v_existing.clinic_id IS DISTINCT FROM p_clinic_id OR v_existing.email IS DISTINCT FROM lower(btrim(p_email))
    OR v_existing.name IS DISTINCT FROM btrim(p_name) OR v_existing.address IS DISTINCT FROM btrim(p_address)
    OR v_existing.phone IS DISTINCT FROM btrim(p_phone) OR v_existing.size IS DISTINCT FROM p_size
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_clinic_registration_intent(uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.complete_verified_clinic_registration()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_intent security_internal.clinic_registration_intents%ROWTYPE;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
  THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  -- Common actor lock serializes registration against simultaneous redemption.
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_intent FROM security_internal.clinic_registration_intents WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_intent.email<>v_email THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
  IF v_intent.completed_at IS NOT NULL THEN
    IF security_internal.role_for(v_intent.clinic_id,auth.uid()) IS DISTINCT FROM 'clinic_owner'
    THEN RAISE EXCEPTION 'Enrollment denied' USING ERRCODE='42501'; END IF;
    RETURN v_intent.clinic_id;
  END IF;
  -- New-account enrollment only; no silent restoration or extra trial farming
  -- for an identity that already has an active or historical membership.
  IF EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'Enrollment conflict' USING ERRCODE='23514'; END IF;
  INSERT INTO public.clinics(id,name,address,phone,size,owner_id,subscription_tier,subscription_status,trial_ends_at,bypass_subscription)
    VALUES(v_intent.clinic_id,v_intent.name,v_intent.address,v_intent.phone,v_intent.size,auth.uid(),
      'trial','trial',now()+interval '14 days',false);
  INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
    VALUES(auth.uid(),v_intent.clinic_id,'clinic_owner','active');
  UPDATE security_internal.clinic_registration_intents SET completed_at=now() WHERE user_id=auth.uid();
  RETURN v_intent.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.complete_verified_clinic_registration() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.complete_verified_clinic_registration() TO authenticated;

CREATE FUNCTION public.redeem_verified_clinic_invitation(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_email text; v_invite public.clinic_invitations%ROWTYPE; v_role text; v_status text;
BEGIN
  PERFORM security_internal.lock_clinia_session();
  IF public.clinia_session_active() IS NOT TRUE OR auth.uid() IS NULL OR (auth.jwt()->>'is_anonymous')='true'
    OR p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 512
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_invite FROM public.clinic_invitations WHERE token=p_token FOR UPDATE;
  IF NOT FOUND OR NOT v_invite.auth_ready OR lower(v_invite.email)<>v_email
    OR v_invite.role IS NULL OR v_invite.role NOT IN ('doctor','receptionist')
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;

  IF v_invite.status='accepted' THEN
    IF v_invite.accepted_by IS DISTINCT FROM auth.uid()
      OR security_internal.role_for(v_invite.clinic_id,auth.uid()) IS DISTINCT FROM v_invite.role
    THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
    RETURN v_invite.clinic_id;
  END IF;
  IF v_invite.status<>'pending' OR v_invite.expires_at IS NULL OR v_invite.expires_at<=now()
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  -- Hold the issuer's live authority through commit; committed revocation wins.
  PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=m.user_id
    WHERE m.clinic_id=v_invite.clinic_id AND m.user_id=v_invite.invited_by
      AND m.role='clinic_owner' AND m.status='active' AND p.status::text='active' AND p.deleted_at IS NULL
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
    FOR SHARE OF m,p,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  IF security_internal.role_for(v_invite.clinic_id,v_invite.invited_by) IS DISTINCT FROM 'clinic_owner'
  THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.clinics WHERE id=v_invite.clinic_id AND archived_at IS NULL
    AND (bypass_subscription IS TRUE OR subscription_status::text='active' OR trial_ends_at>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation denied' USING ERRCODE='42501'; END IF;
  SELECT role,status INTO v_role,v_status FROM public.clinic_members
    WHERE user_id=auth.uid() AND clinic_id=v_invite.clinic_id FOR UPDATE;
  IF FOUND THEN
    IF v_role IS DISTINCT FROM v_invite.role OR v_status IS DISTINCT FROM 'active'
    THEN RAISE EXCEPTION 'Membership conflict; reviewed restoration required' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.clinic_members(user_id,clinic_id,role,status)
      VALUES(auth.uid(),v_invite.clinic_id,v_invite.role,'active');
  END IF;
  UPDATE public.clinic_invitations SET status='accepted',accepted_by=auth.uid(),accepted_at=now()
    WHERE id=v_invite.id AND status='pending';
  RETURN v_invite.clinic_id;
END $function$;
REVOKE ALL ON FUNCTION public.redeem_verified_clinic_invitation(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.redeem_verified_clinic_invitation(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
