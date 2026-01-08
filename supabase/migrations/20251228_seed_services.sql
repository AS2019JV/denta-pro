-- Function to seed default services for a specific clinic
CREATE OR REPLACE FUNCTION public.seed_default_services(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to ensure insertion works
SET search_path = public
AS $$
BEGIN
    -- Insert default treatments only if they don't look like duplicates (optional check, but simple insert is fine for "Import")
    -- We will insert them. The user can edit/delete them later.
    
    INSERT INTO public.services (clinic_id, name, price, duration_minutes, category, description)
    VALUES
    (target_clinic_id, 'Consulta General / Diagnóstico', 20.00, 30, 'General', 'Revisión general, incluye diagnóstico inicial.'),
    (target_clinic_id, 'Limpieza Dental (Profilaxis)', 30.00, 45, 'Preventiva', 'Eliminación de placa y pulido.'),
    (target_clinic_id, 'Resina Simple (1 superficie)', 30.00, 45, 'Restauradora', 'Restauración de caries pequeña o mediana.'),
    (target_clinic_id, 'Resina Compuesta/Compleja', 50.00, 60, 'Restauradora', 'Reconstrucción de partes mayores del diente.'),
    (target_clinic_id, 'Extracción Simple', 40.00, 45, 'Cirugía', 'Extracción no quirúrgica.'),
    (target_clinic_id, 'Cirugía de Tercer Molar (Cordal)', 100.00, 90, 'Cirugía', 'Cirugía de muela del juicio impactada.'),
    (target_clinic_id, 'Endodoncia (Tratamiento de Canal)', 150.00, 90, 'Endodoncia', 'Tratamiento de conductos (precio promedio).'),
    (target_clinic_id, 'Blanqueamiento Dental', 200.00, 60, 'Cosmética', 'Tratamiento LED/Láser en consultorio.'),
    (target_clinic_id, 'Corona de Porcelana/Zirconio', 300.00, 90, 'Restauradora', 'Alta durabilidad y estética.'),
    (target_clinic_id, 'Implante Dental (Fase Quirúrgica)', 700.00, 90, 'Cirugía', 'Colocación del implante (no incluye corona).'),
    (target_clinic_id, 'Ortodoncia (Control Mensual)', 30.00, 20, 'Ortodoncia', 'Ajuste y control mensual de brackets.');

END;
$$;
