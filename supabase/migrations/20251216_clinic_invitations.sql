-- Migration: Add clinic_invitations table and invitation handling
-- Description: Standardized table for managing clinic staff invitations with status tracking.

CREATE TABLE IF NOT EXISTS public.clinic_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'receptionist')),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
    
    -- Ensure an email can only have one active invitation per clinic
    UNIQUE(clinic_id, email, status)
);

-- Enable RLS
ALTER TABLE public.clinic_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for clinic_invitations
CREATE POLICY "Clinic owners can manage invitations"
    ON public.clinic_invitations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clinic_members
            WHERE clinic_id = clinic_invitations.clinic_id
            AND user_id = auth.uid()
            AND role = 'clinic_owner'
        )
    );

CREATE POLICY "Anyone can view their own invitation by email"
    ON public.clinic_invitations
    FOR SELECT
    TO public
    USING (email = auth.email() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_email ON public.clinic_invitations(email);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_status ON public.clinic_invitations(status);
