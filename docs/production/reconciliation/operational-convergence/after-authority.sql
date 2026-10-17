-- Reviewed LOCAL SYNTHETIC ONLY. Run after encargo02, before agenda migration.
-- Canonical callbacks replace historical role/ownership/GUC fallbacks.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres'
    OR current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR current_setting('app.operational_convergence_authorized',true) IS DISTINCT FROM 'reviewed-local-contract'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed local authority prerequisites required'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Actual maintenance sessions only; no editable custom GUC bypass.
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid()<>OLD.id OR OLD.status::text<>'active' OR OLD.deleted_at IS NOT NULL
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_changed text[]; v_before jsonb; v_after jsonb;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO v_changed FROM jsonb_object_keys(to_jsonb(NEW)) AS keys(k)
    WHERE k<>'updated_at' AND to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k;
  IF v_changed IS NULL THEN RETURN NEW; END IF;
  -- Only authorization values, never full profile/contact information in audit payload.
  v_before:=jsonb_build_object('role',OLD.role,'clinic_id',OLD.clinic_id,'status',OLD.status,'deleted_at',OLD.deleted_at);
  v_after:=jsonb_build_object('role',NEW.role,'clinic_id',NEW.clinic_id,'status',NEW.status,'deleted_at',NEW.deleted_at);
  INSERT INTO public.profile_audit_log(target_user_id,actor_user_id,actor_role,action,old_data,new_data,changed_fields)
    VALUES(NEW.id,auth.uid(),CASE WHEN auth.uid() IS NULL THEN 'maintenance' ELSE 'authenticated' END,'update_profile',v_before,v_after,v_changed);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation(),public.log_profile_changes() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_log_profile_changes ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
CREATE TRIGGER trg_log_profile_changes AFTER UPDATE ON public.profiles FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.log_profile_changes();

CREATE OR REPLACE FUNCTION security_internal.guard_patient_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_field text; v_new jsonb:=to_jsonb(NEW); v_old jsonb;
  v_clinical constant text[]:=ARRAY['medical_history','allergies','medications','medical_conditions','medical_alerts','clinical_notes','blood_type','has_diabetes','has_hypertension','has_heart_disease','is_smoker','is_pregnant','recall_months','internal_notes','last_treatment_note','odontogram_state','periodontogram_state'];
BEGIN
  IF auth.uid() IS NULL AND session_user='postgres' AND current_setting('app.scoped_fixture_authorized',true)='local-synthetic' THEN RETURN NEW; END IF;
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF TG_OP='UPDATE' THEN
    v_old:=to_jsonb(OLD);
    IF NEW.account_balance IS DISTINCT FROM OLD.account_balance OR NEW.insurance_provider IS DISTINCT FROM OLD.insurance_provider OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
    THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF v_role='receptionist' THEN
      FOREACH v_field IN ARRAY v_clinical LOOP
        IF v_new->v_field IS DISTINCT FROM v_old->v_field THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      END LOOP;
    END IF;
  ELSIF v_role='receptionist' THEN
    FOREACH v_field IN ARRAY v_clinical LOOP
      IF v_field='recall_months' THEN
        IF coalesce(NEW.recall_months,6)<>6 THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
      ELSIF coalesce(v_new->>v_field,'') NOT IN ('','{}','[]','false') THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_patient_scope() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges ON public.patients;
DROP TRIGGER IF EXISTS trg_guard_patient_clinical_insert ON public.patients;
CREATE TRIGGER operational_patient_scope BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION security_internal.guard_patient_scope();

-- Duplicate historical rights trigger has the same callback as the required M7
-- trigger. Keep M7's exact trigger; avoid two executions of the same operation.
DROP TRIGGER IF EXISTS trg_protect_data_requests_immutability ON public.data_rights_requests;
-- The verification callback is inert after encargo02; remove the unused event.
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
-- Optional legacy hook must stay closed when the configuration isn't verified.
DO $hook$ BEGIN
  IF to_regprocedure('public.custom_access_token_hook(jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated,service_role,supabase_auth_admin;
  END IF;
END $hook$;
NOTIFY pgrst,'reload schema';
COMMIT;
