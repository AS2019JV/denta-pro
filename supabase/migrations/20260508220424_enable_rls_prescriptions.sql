-- Habilitar RLS explícitamente por precaución
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores si existían (opcional)
DROP POLICY IF EXISTS "Prescriptions are viewable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are insertable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are updatable by clinic members" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions are deletable by clinic owners" ON public.prescriptions;

-- Crear políticas basadas en clinic_id desde los app_metadata del token JWT
CREATE POLICY "Prescriptions are viewable by clinic members"
    ON public.prescriptions FOR SELECT
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are insertable by clinic members"
    ON public.prescriptions FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are updatable by clinic members"
    ON public.prescriptions FOR UPDATE
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are deletable by clinic owners"
    ON public.prescriptions FOR DELETE
    USING (
        clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
    );
