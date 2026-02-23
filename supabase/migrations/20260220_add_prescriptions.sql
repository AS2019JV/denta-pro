-- Create prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clinic_id UUID DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid,
    data JSONB NOT NULL,
    
    -- Ensure clinic isolation
    CONSTRAINT prescriptions_clinic_id_check CHECK (clinic_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Prescriptions are viewable by clinic members"
    ON public.prescriptions FOR SELECT
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are insertable by clinic members"
    ON public.prescriptions FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are deletable by clinic owners"
    ON public.prescriptions FOR DELETE
    USING (
        clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
    );

-- Audit log integration (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'logs' AND tablename = 'access_audit') THEN
        -- Add triggers for auditing if needed, or rely on existing centralized audit
    END IF;
END $$;
