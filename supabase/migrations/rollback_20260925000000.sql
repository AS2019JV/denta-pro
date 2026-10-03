-- ============================================================================
-- Backward Migration / Rollback: rollback_20260925000000.sql
-- Description: Deterministic, Zero-Data-Loss Rollback for Migration 20260925000000
-- Targets:
--   Drop compound multi-tenant performance indexes cleanly and idempotently
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_patients_clinic_cedula;
DROP INDEX IF EXISTS public.idx_appointments_conflict;
DROP INDEX IF EXISTS public.idx_appointments_clinic_start;
DROP INDEX IF EXISTS public.idx_appointments_patient_doctor;
DROP INDEX IF EXISTS public.idx_prescriptions_clinic_created;
DROP INDEX IF EXISTS public.idx_hcu033_clinic_patient;

COMMIT;
