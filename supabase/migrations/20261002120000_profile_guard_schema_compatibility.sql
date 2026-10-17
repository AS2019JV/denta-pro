-- PROSPECTIVE: exact canonical guard compatibility, without fabricating history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.prevent_profile_privilege_escalation()')
      AND pg_get_userbyid(proowner)='postgres' AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND md5(replace(prosrc,E'\r\n',E'\n'))='e109bee275bcff2feb87651cbd2fdefb'
  ) THEN RAISE EXCEPTION 'Unreviewed profile guard drift; reconcile before applying'; END IF;
END
$preflight$;
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    -- Some reviewed schemas have no created_at field. Compare it when present;
    -- absent fields remain null without inventing historical timestamps.
    OR to_jsonb(NEW)->'created_at' IS DISTINCT FROM to_jsonb(OLD)->'created_at'
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
