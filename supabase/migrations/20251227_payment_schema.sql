-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trial');
    END IF;
END$$;

-- 2. Update Clinics Table
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS kushki_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

-- 3. Create Payments Audit Table (Force Recreate to fix schema mismatch)
DROP TABLE IF EXISTS public.payments;

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clinic_id uuid REFERENCES public.clinics(id) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, 
    provider TEXT DEFAULT 'kushki',
    provider_transaction_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Enable RLS on Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy for Payments
DROP POLICY IF EXISTS "Owners can view their payments" ON public.payments;
CREATE POLICY "Owners can view their payments"
ON public.payments FOR SELECT
USING (
    clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
    AND
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'
);
