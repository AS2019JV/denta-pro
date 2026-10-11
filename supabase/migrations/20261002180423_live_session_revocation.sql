-- PROSPECTIVE canonical forward, never a blind repair of occupied cloud schemas.
-- Supabase signatures survive logout; application authority also needs a live session.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('security_internal.role_for(uuid,uuid)','762192aa8d42b261aea671bc41cbe096'),
    ('public.get_clinic_member_role(uuid)','a242b6422e41124b0660479752ca5240'),
    ('security_internal.require_clinic(uuid,text[],boolean)','9b1034be74705088e7c787e30525d1d1')
  ) x(signature,body_hash) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v.signature)
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND md5(regexp_replace(p.prosrc,'\s+','','g'))=v.body_hash)
    THEN RAISE EXCEPTION 'Exact canonical authority prerequisite required: %',v.signature; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='banned_until' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='deleted_at' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='auth.sessions'::regclass AND attname='not_after' AND NOT attisdropped)
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='profiles')<>2
    OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='clinic_members')<>1
  THEN RAISE EXCEPTION 'Reviewed managed Auth schema and exact profile/member policies required'; END IF;
END $preflight$;

CREATE FUNCTION public.clinia_session_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT auth.role()='authenticated' AND auth.uid() IS NOT NULL
    AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
    AND EXISTS (SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
      WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
        AND (u.banned_until IS NULL OR u.banned_until<=now())
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.id=CASE WHEN (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
          THEN (auth.jwt()->>'session_id')::uuid END);
$function$;
REVOKE ALL ON FUNCTION public.clinia_session_active() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinia_session_active() TO authenticated;

CREATE FUNCTION security_internal.lock_clinia_session()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.clinia_session_active() IS NOT TRUE
  THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  -- Consistent order for enrollment and clinical writes. Logout or ban committed
  -- first denies the operation; a write already authorized holds these locks.
  PERFORM 1 FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL AND is_anonymous IS NOT TRUE
    AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM auth.sessions WHERE user_id=auth.uid() AND id=(auth.jwt()->>'session_id')::uuid
    AND (not_after IS NULL OR not_after>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
END $function$;
REVOKE ALL ON FUNCTION security_internal.lock_clinia_session() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.role_for(p_clinic_id uuid,p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT m.role FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
    JOIN auth.users u ON u.id=p.id
  WHERE m.clinic_id=p_clinic_id AND m.user_id=p_user_id AND m.status='active'
    AND p.status::text='active' AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    -- Assigned clinicians may be offline. Only the requesting ordinary actor
    -- must own a live session; a gated service lookup still checks live Auth.
    AND (p_user_id IS DISTINCT FROM auth.uid() OR auth.role()='service_role' OR public.clinia_session_active())
    AND m.role IN ('clinic_owner','doctor','receptionist');
$function$;
REVOKE ALL ON FUNCTION security_internal.role_for(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION security_internal.require_clinic(p_clinic_id uuid,p_roles text[],p_write boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text;
BEGIN
  IF p_write THEN PERFORM security_internal.lock_clinia_session(); END IF;
  v_role:=public.get_clinic_member_role(p_clinic_id);
  IF v_role IS NULL OR NOT(v_role=ANY(p_roles)) OR NOT public.check_subscription_active(p_clinic_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_write THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.clinic_id=p_clinic_id AND m.user_id=auth.uid() AND m.status='active'
        AND m.role=v_role AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_role;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.require_clinic(uuid,text[],boolean) FROM PUBLIC,anon,authenticated,service_role;

ALTER POLICY encargo02_profile_read ON public.profiles USING (id=auth.uid() AND public.clinia_session_active());
ALTER POLICY encargo02_profile_update ON public.profiles
  USING (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL)
  WITH CHECK (id=auth.uid() AND public.clinia_session_active() AND status::text='active' AND deleted_at IS NULL);
ALTER POLICY encargo02_members_read ON public.clinic_members
  USING (public.clinia_session_active() AND (user_id=auth.uid() OR public.get_clinic_member_role(clinic_id)='clinic_owner'));
NOTIFY pgrst,'reload schema';
COMMIT;
