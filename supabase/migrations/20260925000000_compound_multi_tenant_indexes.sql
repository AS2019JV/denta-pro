-- ============================================================================
-- Migration: 20260925000000_compound_multi_tenant_indexes.sql
-- Description: Critical Compound Multi-Tenant Performance Indexes
-- Reference: CORRECTIONS_AND_ROADMAP.md (Section 2.1 Issue 1) & PROD-CHK-C02
--
-- Optimization Targets:
--   1. Patient Cédula Intake & Search: (clinic_id, cedula)
--   2. Real-Time Calendar Double-Booking Conflict: (clinic_id, doctor_id, start_time, end_time) WHERE status != 'cancelled'
--   3. Calendar Date Range Scans: (clinic_id, start_time)
--   4. Patient Appointment History by Doctor: (clinic_id, patient_id, doctor_id)
--   5. Prescriptions Chronological Sort: (clinic_id, created_at DESC)
--   6. Clinical Charting HCU-033 Form: (clinic_id, patient_id)
-- ============================================================================

BEGIN;

-- 1. Patient Cédula Intake & Search
-- Replaces sequential/bitmap scans with O(log N) composite index lookup for national ID lookups
CREATE INDEX IF NOT EXISTS idx_patients_clinic_cedula 
  ON public.patients (clinic_id, cedula);

-- 2. Real-Time Calendar Double-Booking Conflict Detection
-- Scopes doctor availability checks by tenant, doctor, and time boundaries.
-- Excludes cancelled appointments to maximize index density and scan speed.
CREATE INDEX IF NOT EXISTS idx_appointments_conflict 
  ON public.appointments (clinic_id, doctor_id, start_time, end_time)
  WHERE status != 'cancelled';

-- 3. Calendar Range Query Optimization
-- Speeds up modern calendar day, week, month, and list date-range filters
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start 
  ON public.appointments (clinic_id, start_time);

-- 4. Appointment Patient History by Doctor
-- Optimizes clinician follow-up history and patient appointment lists
CREATE INDEX IF NOT EXISTS idx_appointments_patient_doctor 
  ON public.appointments (clinic_id, patient_id, doctor_id);

-- 5. Prescription History Chronological Sort
-- Guarantees index-only ordered retrieval of patient prescription lists without in-memory sorting
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_created 
  ON public.prescriptions (clinic_id, created_at DESC);

-- 6. Clinical Charting HCU-033 Form Patient Index
-- Instant lookup of patient medical evaluation forms within clinic tenant boundary
CREATE INDEX IF NOT EXISTS idx_hcu033_clinic_patient 
  ON public.hcu033_forms (clinic_id, patient_id);

COMMIT;
