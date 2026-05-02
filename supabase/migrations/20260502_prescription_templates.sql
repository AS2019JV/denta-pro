-- Create prescription_templates table
CREATE TABLE IF NOT EXISTS public.prescription_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    clinic_id UUID DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid NOT NULL,
    doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    
    -- Ensure clinic isolation
    CONSTRAINT prescription_templates_clinic_id_check CHECK (clinic_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.prescription_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Templates are viewable by clinic members"
    ON public.prescription_templates FOR SELECT
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Templates are insertable by clinic members"
    ON public.prescription_templates FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Templates are updatable by their creator or clinic owners"
    ON public.prescription_templates FOR UPDATE
    USING (
        clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid 
        AND (
            doctor_id = auth.uid() 
            OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
        )
    );

CREATE POLICY "Templates are deletable by their creator or clinic owners"
    ON public.prescription_templates FOR DELETE
    USING (
        clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid 
        AND (
            doctor_id = auth.uid() 
            OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
        )
    );
