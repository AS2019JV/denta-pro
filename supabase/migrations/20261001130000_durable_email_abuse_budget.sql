-- PROSPECTIVE: apply only after the canonical authority baseline is reconciled.
-- This migration is additive and atomic. It never changes Auth or Storage policy.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF to_regprocedure('security_internal.require_clinic(uuid,text[],boolean)') IS NULL
     OR to_regprocedure('security_internal.role_for(uuid,uuid)') IS NULL
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Reviewed authority baseline and pgcrypto are required';
  END IF;
END
$preflight$;

CREATE TABLE security_internal.email_abuse_budgets (
  scope text NOT NULL,
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (scope, key_hash, window_start),
  CHECK (expires_at > window_start)
);
CREATE INDEX email_abuse_budget_expiry_idx ON security_internal.email_abuse_budgets (expires_at);
ALTER TABLE security_internal.email_abuse_budgets OWNER TO postgres;
ALTER TABLE security_internal.email_abuse_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_internal.email_abuse_budgets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.consume_email_abuse_budget(
  p_action text, p_ip_hash text, p_destination_hash text,
  p_actor_id uuid DEFAULT NULL, p_clinic_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $budget$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_count integer;
  v_retry integer := 0;
  v_scope text;
  v_key text;
  v_seconds integer;
  v_limit integer;
  v_authenticated boolean;
  v_role text;
  v_quota record;
BEGIN
  -- Grants are the primary boundary. Never accept an ordinary JWT as a limiter
  -- administrator, including one with forged user metadata or parameters.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('signup','resend','invite','transactional')
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$'
     OR p_destination_hash IS NULL OR p_destination_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid email budget request' USING ERRCODE = '22023';
  END IF;
  v_authenticated := p_action IN ('invite','transactional');
  IF (v_authenticated AND (p_actor_id IS NULL OR p_clinic_id IS NULL))
     OR (NOT v_authenticated AND (p_actor_id IS NOT NULL OR p_clinic_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid email budget authority' USING ERRCODE = '22023';
  END IF;
  IF v_authenticated THEN
    v_role := security_internal.role_for(p_clinic_id, p_actor_id);
    IF v_role IS NULL OR (p_action='invite' AND v_role<>'clinic_owner')
       OR v_role NOT IN ('clinic_owner','doctor','receptionist') THEN
      RAISE EXCEPTION 'Active email authority required' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Fixed UTC windows, deliberately conservative launch ceilings. Global is
  -- always locked first, bounding new hashed rows and serializing reservations.
  -- All remaining scopes use the same order, preventing reverse lock cycles.
  -- The subtransaction reserves every applicable scope or none. Rejected
  -- traffic must never burn the global budget and deny unrelated clinics.
  BEGIN
  FOR v_quota IN
    SELECT * FROM (VALUES
      ('00-global', encode(extensions.digest('clinia-email-global','sha256'),'hex'), 86400, 1000, true),
      ('10-ip', p_ip_hash, 600, 60, true),
      ('20-destination', p_destination_hash, 3600, 10, true),
      ('30-auth-ip', p_ip_hash, 600, 10, NOT v_authenticated),
      ('40-auth-destination', p_destination_hash, 3600, 3, NOT v_authenticated),
      ('50-actor', encode(extensions.digest('actor:' || p_actor_id::text,'sha256'),'hex'), 600, 30, v_authenticated),
      ('60-clinic', encode(extensions.digest('clinic:' || p_clinic_id::text,'sha256'),'hex'), 3600, 120, v_authenticated)
    ) AS quotas(scope, key_hash, seconds, ceiling, enabled)
    WHERE enabled ORDER BY scope
  LOOP
    v_scope := v_quota.scope; v_key := v_quota.key_hash;
    v_seconds := v_quota.seconds; v_limit := v_quota.ceiling;
    v_start := to_timestamp(floor(extract(epoch FROM v_now) / v_seconds) * v_seconds);
    INSERT INTO security_internal.email_abuse_budgets AS budget
      (scope, key_hash, window_start, expires_at, attempts)
    VALUES (v_scope, v_key, v_start, v_start + make_interval(secs => v_seconds), 1)
    ON CONFLICT (scope, key_hash, window_start) DO UPDATE
      SET attempts = least(budget.attempts + 1, v_limit + 1)
    RETURNING attempts INTO v_count;
    IF v_count > v_limit THEN
      v_retry := greatest(v_retry, greatest(1, ceil(extract(epoch FROM
        (v_start + make_interval(secs => v_seconds) - v_now)))::integer));
      RAISE EXCEPTION 'Email budget denied' USING ERRCODE = 'CL001';
    END IF;
  END LOOP;
  EXCEPTION WHEN SQLSTATE 'CL001' THEN
    NULL; -- PostgreSQL rolled back every reservation; retry remains local.
  END;

  -- Bounded cleanup during real requests; no raw emails, IPs or JWTs are stored.
  -- SKIP LOCKED avoids contending with a reservation begun in an earlier window.
  WITH expired AS (
    SELECT scope, key_hash, window_start FROM security_internal.email_abuse_budgets
    WHERE expires_at < v_now - interval '24 hours'
    ORDER BY expires_at LIMIT 200 FOR UPDATE SKIP LOCKED
  )
  DELETE FROM security_internal.email_abuse_budgets b USING expired e
  WHERE b.scope=e.scope AND b.key_hash=e.key_hash AND b.window_start=e.window_start;

  RETURN jsonb_build_object('allowed', v_retry = 0, 'retry_after_seconds', v_retry);
END
$budget$;
ALTER FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_email_abuse_budget(text,text,text,uuid,uuid) TO service_role;
-- The deny-first baseline revokes PUBLIC schema usage. Grant only namespace
-- access for the server role; no CREATE, table or other routine grants change.
GRANT USAGE ON SCHEMA public TO service_role;
COMMIT;
