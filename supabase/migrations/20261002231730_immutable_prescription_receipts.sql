-- Prospective only, after live_session_revocation and canonical encargo02.
-- Existing records remain NULL; this does not reconstruct historical authorship.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.lock_clinia_session()') IS NULL
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
  THEN RAISE EXCEPTION 'Reviewed live session authority prerequisite required'; END IF;
END $preflight$;
ALTER TABLE public.prescriptions ADD COLUMN issuance_snapshot jsonb;
CREATE FUNCTION security_internal.freeze_prescription_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE p public.patients%ROWTYPE; d public.profiles%ROWTYPE; c public.clinics%ROWTYPE; m jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Issued prescription is immutable; custody procedure required' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL OR NEW.doctor_id IS DISTINCT FROM auth.uid() OR NEW.issuance_snapshot IS NOT NULL
  THEN RAISE EXCEPTION 'Invalid prescription issuer or receipt' USING ERRCODE='42501'; END IF;
  PERFORM security_internal.require_clinic(NEW.clinic_id,ARRAY['clinic_owner','doctor'],true);
  SELECT * INTO p FROM public.patients WHERE id=NEW.patient_id AND clinic_id=NEW.clinic_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription patient' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.profiles WHERE id=auth.uid() AND status::text='active' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid prescription issuer' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.clinics WHERE id=NEW.clinic_id FOR SHARE;
  IF NOT FOUND OR nullif(btrim(c.name),'') IS NULL OR nullif(btrim(d.full_name),'') IS NULL
    OR nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') IS NULL
  THEN RAISE EXCEPTION 'Prescription identity incomplete' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(NEW.data) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.data->'medications') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.data->'indications') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(NEW.data->'medications') NOT BETWEEN 1 AND 20 OR length(NEW.data->>'indications')>2000
  THEN RAISE EXCEPTION 'Invalid prescription content' USING ERRCODE='22023'; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(NEW.data->'medications') LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'object'
      OR jsonb_typeof(m->'name') IS DISTINCT FROM 'string' OR length(btrim(m->>'name')) NOT BETWEEN 1 AND 120
      OR jsonb_typeof(m->'dosage') IS DISTINCT FROM 'string' OR length(btrim(m->>'dosage')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(m->'duration') IS DISTINCT FROM 'string' OR length(btrim(m->>'duration')) NOT BETWEEN 1 AND 80
    THEN RAISE EXCEPTION 'Invalid prescription medication' USING ERRCODE='22023'; END IF;
  END LOOP;
  NEW.created_at:=statement_timestamp();
  NEW.data:=jsonb_build_object('medications',NEW.data->'medications','indications',NEW.data->>'indications');
  NEW.issuance_snapshot:=jsonb_build_object('version',1,'prescription_id',NEW.id,
    'issued_at',NEW.created_at,'clinic_id',NEW.clinic_id,'patient_id',NEW.patient_id,'doctor_id',auth.uid(),
    'clinic',jsonb_build_object('name',c.name,'address',coalesce(c.address,''),'phone',coalesce(c.phone,'')),
    'patient',jsonb_build_object('name',btrim(concat_ws(' ',p.first_name,p.last_name)),'identification',coalesce(p.cedula,'')),
    'doctor',jsonb_build_object('name',d.full_name,'specialization',coalesce(d.specialization,''),'license_number',coalesce(d.license_number,'')),
    'medications',NEW.data->'medications','indications',NEW.data->>'indications');
  -- No mutable logo URL or signature-image claim becomes historical evidence.
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION security_internal.freeze_prescription_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER freeze_prescription_receipt BEFORE INSERT OR UPDATE OR DELETE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION security_internal.freeze_prescription_receipt();
REVOKE UPDATE,DELETE ON public.prescriptions FROM anon,authenticated;
REVOKE UPDATE(data) ON public.prescriptions FROM authenticated;
DROP POLICY IF EXISTS encargo02_clinical_update ON public.prescriptions;
COMMENT ON COLUMN public.prescriptions.issuance_snapshot IS 'Database-captured immutable issuance receipt. NULL historical rows require reviewed custody before reprint. No qualified signature claim.';
NOTIFY pgrst,'reload schema';
COMMIT;

