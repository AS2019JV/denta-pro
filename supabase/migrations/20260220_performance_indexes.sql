-- Migration: Performance Indexes for Production
-- Created: 2026-02-20
-- Description: Adds indexes on timestamp columns to optimize range queries for reports and pagination.

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON public.patients(created_at);
CREATE INDEX IF NOT EXISTS idx_patients_first_name ON public.patients(first_name);
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON public.patients(last_name);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- Billings
CREATE INDEX IF NOT EXISTS idx_billings_created_at ON public.billings(created_at);
CREATE INDEX IF NOT EXISTS idx_billings_status ON public.billings(status);
