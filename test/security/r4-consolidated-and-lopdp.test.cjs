/**
 * Milestone 4 Verification Test Suite: Migration Consolidation & LOPDP Alignment (R4-A & R4-B)
 * Author: teamwork_preview_worker_m4
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§ R4: Migration Consolidation & LOPDP Alignment)
 * - PROJECT.md (§ M4 Interface Contracts & Code Layout)
 * - dental-clinical-standards (LOPDP, HCU-033, Ley Orgánica de Salud Art. 7)
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT_DIR = join(__dirname, '../..');

describe('Milestone 4: R4-A Migration Consolidation & R4-B LOPDP Alignment', () => {
  const consolidatedMigrationPath = join(
    ROOT_DIR,
    'supabase/migrations/20260920_security_remediation_consolidated.sql'
  );
  const privacyTabPath = join(ROOT_DIR, 'components/settings/privacy-tab.tsx');
  const cliniaManualPath = join(ROOT_DIR, 'Clinia_manual.md');
  const architecturePath = join(ROOT_DIR, 'SYSTEM_ARCHITECTURE_AND_OPERATION.md');
  const learningsPath = join(ROOT_DIR, 'AGENT_LEARNINGS_AND_TIPS.md');

  // ==========================================
  // R4-A: Migration Consolidation & Legacy Policy Purge
  // ==========================================
  describe('R4-A: Master Forward Consolidated Migration', () => {
    test('Consolidated migration file exists and is populated', () => {
      assert.ok(
        existsSync(consolidatedMigrationPath),
        'Master consolidated migration must exist at supabase/migrations/20260920_security_remediation_consolidated.sql'
      );
      const content = readFileSync(consolidatedMigrationPath, 'utf8');
      assert.ok(content.length > 5000, 'Migration must contain genuine, comprehensive consolidated content');
      assert.ok(content.includes('BEGIN;'), 'Migration must be wrapped in a transaction block');
      assert.ok(content.includes('COMMIT;'), 'Migration must conclude with COMMIT');
    });

    test('Consolidated migration explicitly purges conflicting legacy permissive policies', () => {
      const sql = readFileSync(consolidatedMigrationPath, 'utf8');

      // Legacy policies on profiles (including multi-clinic view policy)
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can delete profiles." ON public.profiles;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.profiles;'));

      // Legacy policies on clinic_members
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can insert their own membership" ON public.clinic_members;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view their memberships" ON public.clinic_members;'));

      // Legacy policies on patients (including multi-clinic view & insert bypass policies)
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view patients in their valid clinics" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can insert patients in their valid clinics" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can update patients in their valid clinics" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view patients in their clinic" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can update patients in their clinic" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can delete patients in their clinic" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.patients;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can manage patients" ON public.patients;'));

      // Legacy policies on services
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can insert services." ON public.services;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can update services." ON public.services;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can delete services." ON public.services;'));

      // Legacy policies on payment_methods
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON public.payment_methods;'));

      // Legacy policies on storage.objects
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can upload patient files" ON storage.objects;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can read patient files" ON storage.objects;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can delete patient files" ON storage.objects;'));

      // Legacy policies on prescriptions
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Prescriptions are insertable by clinic members" ON public.prescriptions;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Prescriptions are updatable by clinic members" ON public.prescriptions;'));

      // Legacy policies on hcu033_forms
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view forms in their clinic" ON public.hcu033_forms;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can insert forms in their clinic" ON public.hcu033_forms;'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can update forms in their clinic" ON public.hcu033_forms;'));
    });

    test('Consolidated migration explicitly purges high-risk multi-clinic and subscription-bypass legacy policies', () => {
      const sql = readFileSync(consolidatedMigrationPath, 'utf8');

      // 1. Cross-tenant profile visibility leak (20251218_saas_schema.sql / 20251222_enforce_enums.sql)
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.profiles;'),
        'Must drop legacy profile view policy to prevent multi-clinic leak'
      );

      // 2. Multi-clinic patient select leak (20251215_multi_clinic_support.sql)
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Users can view patients in their valid clinics" ON public.patients;'),
        'Must drop legacy patient view policy from 20251215_multi_clinic_support.sql'
      );

      // 3. Subscription gating bypass on patient insert (20251215_multi_clinic_support.sql)
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Users can insert patients in their valid clinics" ON public.patients;'),
        'Must drop legacy patient insert policy from 20251215_multi_clinic_support.sql to prevent subscription gating bypass'
      );
    });

    test('Consolidated migration includes all milestone security controls', () => {
      const sql = readFileSync(consolidatedMigrationPath, 'utf8');

      // SEC-01 & SEC-02 & SEC-03
      assert.ok(sql.includes('handle_verified_clinic_creation'));
      assert.ok(sql.includes('new_clinic_id := gen_random_uuid();'));
      assert.ok(sql.includes('prevent_profile_privilege_escalation'));
      assert.ok(sql.includes('accept_clinic_invitation'));

      // SEC-04
      assert.ok(sql.includes('get_patients_with_stats'));

      // SEC-05
      assert.ok(sql.includes("bucket_id = 'patient-files'"));
      assert.ok(sql.includes("(storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid"));

      // SEC-07
      assert.ok(sql.includes('enforce_patient_clinical_privileges'));
      assert.ok(sql.includes('guard_patient_clinical_insert'));

      // SEC-12
      assert.ok(sql.includes('Clinic owners can insert services'));

      // SEC-13
      assert.ok(sql.includes('ALTER TABLE public.payment_methods'));
      assert.ok(sql.includes('get_checkout_payment_methods'));

      // SEC-08 & SEC-09
      assert.ok(sql.includes('CREATE OR REPLACE VIEW public.dashboard_stats_view'));
      assert.ok(sql.includes('security_invoker = true'));
      assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.archive_clinic(uuid)'));
      assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.purge_clinic_data(uuid)'));
      assert.ok(sql.includes("INTERVAL '90 days'"));
    });

    test('Consolidated migration creates public.data_rights_requests table with RLS', () => {
      const sql = readFileSync(consolidatedMigrationPath, 'utf8');

      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.data_rights_requests'));
      assert.ok(sql.includes('clinic_id UUID REFERENCES public.clinics(id)'));
      assert.ok(sql.includes('request_type TEXT NOT NULL'));
      assert.ok(sql.includes('legal_basis TEXT NOT NULL'));
      assert.ok(sql.includes('retention_note TEXT'));
      assert.ok(sql.includes('ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;'));
      assert.ok(sql.includes('log_data_rights_request'));
    });
  });

  // ==========================================
  // R4-B: Statutory LOPDP Alignment & Medical Custody Persistence
  // ==========================================
  describe('R4-B: Statutory LOPDP Alignment & Medical Custody Persistence', () => {
    test('components/settings/privacy-tab.tsx uses correct LOPDP Articles (17 & 15)', () => {
      const content = readFileSync(privacyTabPath, 'utf8');

      // Portability must cite Article 17
      assert.ok(
        content.includes('Art. 17'),
        'Privacy tab must cite Article 17 for Data Portability'
      );
      assert.ok(
        content.includes('Portabilidad de Datos (Art. 17 LOPDP)'),
        'Privacy tab must feature Portabilidad de Datos (Art. 17 LOPDP)'
      );

      // Deletion must cite Article 15
      assert.ok(
        content.includes('Art. 15'),
        'Privacy tab must cite Article 15 for Elimination / Deletion'
      );
      assert.ok(
        content.includes('Derecho de Eliminación / Baja (Art. 15 LOPDP)') ||
        content.includes('Derecho de Eliminación / Supresión (Art. 15 LOPDP)'),
        'Privacy tab must feature Derecho de Eliminación (Art. 15 LOPDP)'
      );

      // Articles 20 and 21 clarification
      assert.ok(
        content.includes('20') && content.includes('21'),
        'Privacy tab must mention Articles 20 and 21'
      );
      assert.ok(
        content.includes('valoraciones automatizadas') || content.includes('elaboración de perfiles'),
        'Privacy tab must clarify that Arts 20-21 govern automated decisions and profiling'
      );

      // Medical custody reconciliation
      assert.ok(
        content.includes('Ley Orgánica de Salud') && content.includes('Art. 7'),
        'Privacy tab must cite Ley Orgánica de Salud Art. 7'
      );
      assert.ok(
        content.includes('5 a 10 años') || content.includes('5–10 años'),
        'Privacy tab must state mandatory 5-10 year clinical history custody period'
      );

      // Persistence into public.data_rights_requests
      assert.ok(
        content.includes("from('data_rights_requests')"),
        'Privacy tab must query and insert into data_rights_requests table'
      );
      assert.ok(
        content.includes("request_type: 'portability'"),
        'Privacy tab must persist portability requests'
      );
      assert.ok(
        content.includes("request_type: 'deletion'"),
        'Privacy tab must persist deletion requests'
      );
    });

    test('Documentation files reflect statutory LOPDP citations accurately', () => {
      const manual = readFileSync(cliniaManualPath, 'utf8');
      const arch = readFileSync(architecturePath, 'utf8');
      const learnings = readFileSync(learningsPath, 'utf8');

      // Clinia_manual.md
      assert.ok(manual.includes('Art. 17 LOPDP'), 'Manual must reference Art. 17 LOPDP');
      assert.ok(manual.includes('Art. 15 LOPDP'), 'Manual must reference Art. 15 LOPDP');
      assert.ok(!manual.includes('Portability (Art. 20 LOPDP)'), 'Manual must NOT cite Art. 20 for portability');

      // SYSTEM_ARCHITECTURE_AND_OPERATION.md
      assert.ok(arch.includes('Art. 17 LOPDP'), 'Architecture doc must reference Art. 17 LOPDP');
      assert.ok(arch.includes('Art. 15 LOPDP'), 'Architecture doc must reference Art. 15 LOPDP');
      assert.ok(!arch.includes('Portability (Art. 20 LOPDP)'), 'Architecture doc must NOT cite Art. 20 for portability');
      assert.ok(!arch.includes('Suppression Safeguards (Art. 21 LOPDP)'), 'Architecture doc must NOT cite Art. 21 for suppression');

      // AGENT_LEARNINGS_AND_TIPS.md
      assert.ok(learnings.includes('Art. 17 LOPDP'), 'Learnings doc must reference Art. 17 LOPDP');
      assert.ok(learnings.includes('Art. 15 LOPDP'), 'Learnings doc must reference Art. 15 LOPDP');
      assert.ok(!learnings.includes('Portability (Art. 20 LOPDP)'), 'Learnings doc must NOT cite Art. 20 for portability');
    });
  });
});
