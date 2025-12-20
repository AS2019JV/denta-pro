-- Function to handle audit logging
CREATE OR REPLACE FUNCTION logs.log_access_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO logs.access_audit (
        actor_id,
        actor_role,
        action,
        table_name,
        record_id,
        clinic_id,
        metadata
    ) VALUES (
        auth.uid(),
        (auth.jwt() -> 'app_metadata' ->> 'role'),
        TG_OP, -- 'INSERT', 'UPDATE', 'DELETE'
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN (OLD.clinic_id)::uuid
            WHEN TG_TABLE_NAME = 'profiles' THEN (NEW.clinic_id)::uuid 
            WHEN TG_TABLE_NAME = 'clinics' THEN (NEW.id)::uuid
            ELSE (NEW.clinic_id)::uuid
        END,
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW)
        )
    );
    RETURN NULL; -- Return value ignored for AFTER triggers
END;
$$;

-- Apply Triggers to Sensitive Tables

-- 1. Patients
DROP TRIGGER IF EXISTS audit_patients ON public.patients;
CREATE TRIGGER audit_patients
AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();

-- 2. Clinical Records
DROP TRIGGER IF EXISTS audit_clinical_records ON public.clinical_records;
CREATE TRIGGER audit_clinical_records
AFTER INSERT OR UPDATE OR DELETE ON public.clinical_records
FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();

-- 3. HCU033 Forms
DROP TRIGGER IF EXISTS audit_hcu033_forms ON public.hcu033_forms;
CREATE TRIGGER audit_hcu033_forms
AFTER INSERT OR UPDATE OR DELETE ON public.hcu033_forms
FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();

-- 4. Billings (Financials)
DROP TRIGGER IF EXISTS audit_billings ON public.billings;
CREATE TRIGGER audit_billings
AFTER INSERT OR UPDATE OR DELETE ON public.billings
FOR EACH ROW EXECUTE FUNCTION logs.log_access_trigger();
