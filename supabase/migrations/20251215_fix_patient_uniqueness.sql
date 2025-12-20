-- Migration: Allow same cedula in different clinics
-- Created: 2025-12-15

-- 1. Drop the global unique constraint on cedula
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_cedula_key;

-- 2. Add composite unique constraint (cedula + clinic_id)
-- This ensures uniqueness within a clinic, but allows the same cedula across different clinics.
ALTER TABLE public.patients ADD CONSTRAINT patients_cedula_clinic_unique UNIQUE (cedula, clinic_id);
