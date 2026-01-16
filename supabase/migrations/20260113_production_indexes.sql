 -- Migration: Add Performance Indexes for Clinic Partitioning
-- Created: 2026-01-13
-- Description: Adds indices on clinic_id for all major tables to optimize RLS and tenant filtering.

-- 1. Core Operational Tables
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);

-- 2. Financial Tables
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON public.invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_billings_clinic_id ON public.billings(clinic_id);

-- 3. Medical Records & Forms
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_id ON public.clinical_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_hcu033_forms_clinic_id ON public.hcu033_forms(clinic_id);

-- 4. Communication & Audit (access_audit skipped if not present)
CREATE INDEX IF NOT EXISTS idx_messages_clinic_id ON public.messages(clinic_id);


-- 5. User Management (Staff access)
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles(clinic_id);
