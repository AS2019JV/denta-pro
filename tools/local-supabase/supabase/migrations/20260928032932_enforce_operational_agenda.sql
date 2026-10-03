-- Local synthetic acceptance only. Not a remotely deployable migration until
-- canonical01/02 parity and independent release review are complete.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='agenda_no_overlap')
  THEN RAISE EXCEPTION 'Reviewed local acceptance prerequisite required'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments WHERE start_time IS NULL OR end_time IS NULL OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR end_time<=start_time OR end_time-start_time>interval '8 hours' OR status IS NULL OR status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR (deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived') AND doctor_id IS NULL))
  THEN RAISE EXCEPTION 'Invalid appointment history; stop and review without modifying data'; END IF;
  IF EXISTS(SELECT 1 FROM public.appointments a JOIN public.appointments b ON a.id<b.id AND a.clinic_id=b.clinic_id AND a.doctor_id=b.doctor_id AND a.start_time<b.end_time AND b.start_time<a.end_time WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.status IN ('scheduled','confirmed','arrived') AND b.status IN ('scheduled','confirmed','arrived'))
  THEN RAISE EXCEPTION 'Existing overlapping history; stop and review'; END IF;
END;
$preflight$;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK(status IS NOT NULL AND status IN ('scheduled','confirmed','arrived','completed','cancelled','no_show'));
ALTER TABLE public.appointments ADD CONSTRAINT agenda_finite_interval CHECK(start_time IS NOT NULL AND end_time IS NOT NULL AND isfinite(start_time) AND isfinite(end_time) AND end_time>start_time AND end_time-start_time BETWEEN interval '5 minutes' AND interval '8 hours');
ALTER TABLE public.appointments ADD CONSTRAINT agenda_active_assignment CHECK(deleted_at IS NOT NULL OR status NOT IN ('scheduled','confirmed','arrived') OR doctor_id IS NOT NULL);
ALTER TABLE public.appointments ADD CONSTRAINT agenda_no_overlap EXCLUDE USING gist (clinic_id WITH =,doctor_id WITH =,tstzrange(start_time,end_time,'[)') WITH &&) WHERE(deleted_at IS NULL AND status IN ('scheduled','confirmed','arrived'));
CREATE INDEX agenda_visible_range ON public.appointments(clinic_id,start_time) WHERE deleted_at IS NULL;

CREATE TABLE security_internal.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
  before_values jsonb,
  after_values jsonb NOT NULL
);
ALTER TABLE security_internal.appointment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.appointment_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION security_internal.guard_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_validate_assignment boolean;
BEGIN
  v_role:=security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF NEW.deleted_at IS NOT NULL OR (TG_OP='UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    RAISE EXCEPTION 'Use cancellation; appointment evidence must remain' USING ERRCODE='42501';
  END IF;
  IF v_role='receptionist' AND (TG_OP='INSERT' AND NEW.notes IS NOT NULL OR TG_OP='UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND NEW.status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Invalid initial state' USING ERRCODE='22023';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NOT (
    OLD.status='scheduled' AND NEW.status IN ('confirmed','arrived','cancelled','no_show') OR
    OLD.status='confirmed' AND NEW.status IN ('arrived','cancelled','no_show') OR
    OLD.status='arrived' AND NEW.status IN ('completed','cancelled') OR
    OLD.status IN ('cancelled','no_show') AND NEW.status='scheduled'
  ) THEN RAISE EXCEPTION 'Invalid state transition' USING ERRCODE='22023'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='completed' AND (NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.type IS DISTINCT FROM OLD.type) THEN
    RAISE EXCEPTION 'Completed appointment is immutable' USING ERRCODE='22023';
  END IF;
  v_validate_assignment:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN v_validate_assignment:=NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR NEW.status IN ('scheduled','confirmed','arrived') AND NEW.status IS DISTINCT FROM OLD.status; END IF;
  IF v_validate_assignment AND (NEW.doctor_id IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) IS NULL OR security_internal.role_for(NEW.clinic_id,NEW.doctor_id) NOT IN ('doctor','clinic_owner')) THEN
    RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023';
  END IF;
  IF v_validate_assignment THEN
    PERFORM 1 FROM public.clinic_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.user_id=NEW.doctor_id AND m.clinic_id=NEW.clinic_id AND m.status='active' AND m.role IN ('doctor','clinic_owner') AND p.status::text='active' AND p.deleted_at IS NULL FOR SHARE OF m,p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid clinician assignment' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE FUNCTION security_internal.audit_operational_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_before jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN v_before:=jsonb_build_object('start_time',OLD.start_time,'end_time',OLD.end_time,'doctor_id',OLD.doctor_id,'status',OLD.status); END IF;
  INSERT INTO security_internal.appointment_events(appointment_id,clinic_id,actor_id,operation,before_values,after_values) VALUES(NEW.id,NEW.clinic_id,auth.uid(),TG_OP,v_before,jsonb_build_object('start_time',NEW.start_time,'end_time',NEW.end_time,'doctor_id',NEW.doctor_id,'status',NEW.status));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION security_internal.guard_operational_appointment(),security_internal.audit_operational_appointment() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER trg_enforce_clinician_assignment ON public.appointments;
CREATE TRIGGER agenda_guard BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.guard_operational_appointment();
CREATE TRIGGER agenda_audit AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION security_internal.audit_operational_appointment();

CREATE OR REPLACE FUNCTION public.save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text; v_row public.appointments; v_input public.appointments; v_key text; v_value jsonb;
BEGIN
  v_role:=security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist'],true);
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF v_key NOT IN ('patient_id','doctor_id','start_time','end_time','type','status','notes') OR jsonb_typeof(v_value) NOT IN ('string','null') OR (v_key='notes' AND v_role NOT IN ('doctor','clinic_owner')) OR (v_key IN ('type','notes') AND length(p_data->>v_key)>2000) THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.appointments WHERE id=p_appointment_id AND clinic_id=p_clinic_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
    IF p_data?'patient_id' AND (p_data->>'patient_id')::uuid IS DISTINCT FROM v_row.patient_id THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  ELSE v_row.status:='scheduled'; END IF;
  v_input:=jsonb_populate_record(v_row,p_data);
  IF v_input.patient_id IS NULL OR v_input.doctor_id IS NULL OR v_input.start_time IS NULL OR v_input.end_time IS NULL OR NOT isfinite(v_input.start_time) OR NOT isfinite(v_input.end_time) OR v_input.end_time-v_input.start_time NOT BETWEEN interval '5 minutes' AND interval '8 hours' OR v_input.status IS NULL OR v_input.status NOT IN ('scheduled','confirmed','arrived','completed','cancelled','no_show') OR coalesce(length(btrim(v_input.type)),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_input.patient_id AND clinic_id=p_clinic_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments(clinic_id,patient_id,doctor_id,start_time,end_time,type,status,notes) VALUES(p_clinic_id,v_input.patient_id,v_input.doctor_id,v_input.start_time,v_input.end_time,btrim(v_input.type),v_input.status,v_input.notes) RETURNING * INTO v_row;
  ELSE
    UPDATE public.appointments SET doctor_id=v_input.doctor_id,start_time=v_input.start_time,end_time=v_input.end_time,type=btrim(v_input.type),status=v_input.status,notes=v_input.notes WHERE id=p_appointment_id AND clinic_id=p_clinic_id RETURNING * INTO v_row;
  END IF;
  RETURN security_internal.appointment_operational(v_row,v_role IN ('doctor','clinic_owner'));
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Appointment interval unavailable' USING ERRCODE='23P01';
WHEN data_exception OR check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_clinic_appointment(uuid,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
