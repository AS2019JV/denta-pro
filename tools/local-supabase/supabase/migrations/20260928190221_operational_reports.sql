-- Local synthetic acceptance only; not remotely deployable before01/02 gates.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path='';
DO $guard$ BEGIN
  IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic'
    OR session_user<>'postgres' OR current_user<>'postgres'
    OR to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
    OR to_regprocedure('public.get_clinic_operational_report(uuid,timestamptz,timestamptz)') IS NOT NULL
  THEN RAISE EXCEPTION 'Reviewed fresh local report contract required'; END IF;
END $guard$;
CREATE FUNCTION public.get_clinic_operational_report(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM security_internal.require_clinic(p_clinic_id,ARRAY['clinic_owner','doctor','receptionist']);
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_end<=p_start OR p_end-p_start>interval '366 days'
  THEN RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE='22023'; END IF;
  WITH appointments AS MATERIALIZED (
    SELECT a.start_time,a.status,a.type FROM public.appointments a
      WHERE a.clinic_id=p_clinic_id AND a.deleted_at IS NULL AND a.start_time>=p_start AND a.start_time<p_end
  ), patients AS MATERIALIZED (
    SELECT p.created_at,p.status FROM public.patients p WHERE p.clinic_id=p_clinic_id AND p.deleted_at IS NULL
  ), totals AS (
    SELECT count(*) AS appointments,count(*) FILTER(WHERE status='completed') AS completed,
      count(*) FILTER(WHERE status='no_show') AS no_show,count(*) FILTER(WHERE status='cancelled') AS cancelled FROM appointments
  ), months AS (
    SELECT generate_series(date_trunc('month',p_start AT TIME ZONE 'America/Guayaquil'),
      date_trunc('month',(p_end-interval '1 microsecond') AT TIME ZONE 'America/Guayaquil'),interval '1 month') AS month
  )
  SELECT jsonb_build_object(
    'clinic_id',p_clinic_id,'start',p_start,'end',p_end,
    'summary',jsonb_build_object('appointments',t.appointments,'activePatients',(SELECT count(*) FROM patients WHERE status='active'),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end),
      'completed',t.completed,'noShow',t.no_show,'cancelled',t.cancelled,
      'attendanceRate',round(100.0*t.completed/nullif(t.completed+t.no_show,0),1)),
    'statuses',(SELECT jsonb_object_agg(state,(SELECT count(*) FROM appointments WHERE status=state))
      FROM unnest(ARRAY['scheduled','confirmed','arrived','completed','cancelled','no_show']) states(state)),
    'monthly',(SELECT jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),
      'appointments',(SELECT count(*) FROM appointments WHERE date_trunc('month',start_time AT TIME ZONE 'America/Guayaquil')=m.month),
      'newPatients',(SELECT count(*) FROM patients WHERE created_at>=p_start AND created_at<p_end AND date_trunc('month',created_at AT TIME ZONE 'America/Guayaquil')=m.month)) ORDER BY m.month) FROM months m),
    'treatments',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY grouped.count DESC,grouped.name),'[]'::jsonb)
      FROM (SELECT coalesce(nullif(btrim(type),''),'Consulta') AS name,count(*) AS count FROM appointments GROUP BY coalesce(nullif(btrim(type),''),'Consulta') ORDER BY count(*) DESC,coalesce(nullif(btrim(type),''),'Consulta') LIMIT 10) grouped)
  ) INTO v_result FROM totals t;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_clinic_operational_report(uuid,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
