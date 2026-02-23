-- 20260222_loyalty_marketing.sql
-- Automated Loyalty Marketing Infrastructure

-- 1. Extend patients table for loyalty and outreach tracking
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS loyalty_notified_level TEXT DEFAULT 'None',
ADD COLUMN IF NOT EXISTS last_loyalty_outreach_at TIMESTAMP WITH TIME ZONE;

-- 2. Create Loyalty Marketing History (Production-Ready Ledger)
-- To avoid sending multiple welcome messages or spamming patients
CREATE TABLE IF NOT EXISTS public.loyalty_communications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id) NOT NULL,
    patient_id UUID REFERENCES public.patients(id) NOT NULL,
    campaign_type TEXT NOT NULL, -- 'VIP_WELCOME', 'SEASONAL_DISCOUNT', 'BIRTHDAY'
    message_content TEXT NOT NULL,
    status TEXT DEFAULT 'sent' -- 'sent', 'failed'
);

-- 3. Automation Settings Enhancement
-- Ensure the unified automation_settings table supports loyalty toggles
ALTER TABLE public.automation_settings 
ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vip_welcome_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS birthday_greet_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vip_threshold_amount DECIMAL(10,2) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS vip_threshold_appointments INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS vip_message_template TEXT DEFAULT '¡Felicidades {patient_name}! Has alcanzado el estatus VIP en {clinic_name}. Disfruta de un 15% de descuento en tu próxima cita.';

-- 4. Secure RLS for Loyalty Ledger
ALTER TABLE public.loyalty_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view loyalty history" 
ON public.loyalty_communications FOR SELECT
USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);
