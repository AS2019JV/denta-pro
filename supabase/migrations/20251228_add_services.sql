-- Create services/treatments table associated with clinics
CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    clinic_id uuid REFERENCES public.clinics(id) NOT NULL,
    name text NOT NULL,
    description text,
    price decimal(10, 2) NOT NULL DEFAULT 0.00,
    duration_minutes integer DEFAULT 30, -- Connected to calendar scheduling
    category text DEFAULT 'General',
    is_active boolean DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Policy: View (All authenticated users in the clinic can see services)
CREATE POLICY "Users can view services in their clinic"
ON public.services FOR SELECT
USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
);

-- Policy: Manage (Only Clinic Owner and Doctors can manage services. Receptionist might need read-only or limited edit? Sticking to Owners for managing prices)
-- Let's allow Doctors to also add treatments if needed, or stick to Owner.
-- "Best database practice": Usually only Admins manage the price list to avoid fraud.
CREATE POLICY "Owners can manage services"
ON public.services
FOR ALL
USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
);

-- Trigger for updated_at
CREATE TRIGGER update_services_modtime
    BEFORE UPDATE ON public.services
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
