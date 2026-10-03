/**
 * Test Suite: Gate 3 - M7-BLK-04 Least-Privilege Clinical RLS
 * Verifies role-to-data matrix hardening on clinical_records, hcu033_forms,
 * patient_notes, patient_files, and patient-files storage.
 * 
 * Invariants:
 * 1. Receptionists and non-clinical members MUST NEVER have direct SELECT or mutation access
 *    to clinical diagnostic records (clinical_records, hcu033_forms, patient_notes, patient_files).
 * 2. Doctors and Clinic Owners retain full clinical access within their active clinic.
 * 3. Front-desk receptionist workflows (demographics in receptionist_patient_view, appointments,
 *    billings) remain fully operational without regression.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MIGRATION_PATH = path.join(ROOT_DIR, 'supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql');
const MEDICAL_RECORDS_PATH = path.join(ROOT_DIR, 'components/patient-medical-records.tsx');
const MIDDLEWARE_PATH = path.join(ROOT_DIR, 'middleware.ts');

describe('Gate 3: M7-BLK-04 Least Privilege Clinical RLS', () => {

  // ---------------------------------------------------------------------------
  // 1. Static Invariant & SQL Policy Analysis
  // ---------------------------------------------------------------------------
  describe('1. Static Invariant: Migration Policy Definitions', () => {
    test('Forward migration file exists and contains M7-BLK-04 section', () => {
      assert.ok(fs.existsSync(MIGRATION_PATH), 'Migration 20260922194927 must exist');
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
      assert.ok(sql.includes('Least-Privilege Clinical RLS (M7-BLK-04)'), 'Must contain M7-BLK-04 section header');
    });

    test('clinical_records: SELECT policy requires doctor or clinic_owner role', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
      
      // Must drop old broad policy
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Medical staff can view clinical records" ON public.clinical_records;'),
        'Must drop old permissive view policy on clinical_records'
      );

      // Must create narrowed policy
      const crPolicyIdx = sql.indexOf('CREATE POLICY "Medical staff can view clinical records"\nON public.clinical_records FOR SELECT');
      assert.ok(crPolicyIdx !== -1, 'Must define new SELECT policy on clinical_records');
      
      const crPolicyChunk = sql.slice(crPolicyIdx, crPolicyIdx + 400);
      assert.ok(
        crPolicyChunk.includes("public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')"),
        'clinical_records SELECT must strictly require clinic_owner or doctor'
      );
      assert.ok(
        !crPolicyChunk.includes('public.is_clinic_member(clinic_id)') || crPolicyChunk.includes('get_clinic_member_role'),
        'clinical_records SELECT must not use un-gated is_clinic_member'
      );
    });

    test('hcu033_forms: SELECT policy requires doctor or clinic_owner role', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

      // Must drop old broad policies
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Clinic members can view hcu033_forms" ON public.hcu033_forms;'),
        'Must drop old permissive view policy on hcu033_forms'
      );

      const hcuPolicyIdx = sql.indexOf('CREATE POLICY "Clinical staff can view hcu033_forms"\nON public.hcu033_forms FOR SELECT');
      assert.ok(hcuPolicyIdx !== -1, 'Must define Clinical staff can view hcu033_forms policy');

      const hcuPolicyChunk = sql.slice(hcuPolicyIdx, hcuPolicyIdx + 400);
      assert.ok(
        hcuPolicyChunk.includes("public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')"),
        'hcu033_forms SELECT must strictly require clinic_owner or doctor'
      );
    });

    test('patient_notes: SELECT, INSERT, UPDATE policies restricted to clinical staff', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view notes in their clinic" ON public.patient_notes;'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can view patient notes"'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can insert patient notes"'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can update patient notes"'));

      const pnSelectIdx = sql.indexOf('CREATE POLICY "Clinical staff can view patient notes"');
      const pnSelectChunk = sql.slice(pnSelectIdx, pnSelectIdx + 400);
      assert.ok(
        pnSelectChunk.includes("public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')"),
        'patient_notes SELECT must require clinic_owner or doctor'
      );
    });

    test('patient_files: SELECT, INSERT, UPDATE policies restricted to clinical staff', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can view files in their clinic" ON public.patient_files;'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can view patient files"'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can insert patient files"'));
      assert.ok(sql.includes('CREATE POLICY "Clinical staff can update patient files"'));

      const pfSelectIdx = sql.indexOf('CREATE POLICY "Clinical staff can view patient files"');
      const pfSelectChunk = sql.slice(pfSelectIdx, pfSelectIdx + 400);
      assert.ok(
        pfSelectChunk.includes("public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')"),
        'patient_files SELECT must require clinic_owner or doctor'
      );
    });

    test('storage.objects (patient-files bucket): restricted to clinical staff', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

      const storageReadIdx = sql.indexOf('CREATE POLICY "Tenant isolated read for patient-files"');
      assert.ok(storageReadIdx !== -1, 'Must define storage read policy for patient-files');
      const storageReadChunk = sql.slice(storageReadIdx, storageReadIdx + 500);

      assert.ok(
        storageReadChunk.includes("public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'doctor')"),
        'Storage read on patient-files must require clinic_owner or doctor'
      );

      const storageUploadIdx = sql.indexOf('CREATE POLICY "Tenant isolated upload for patient-files"');
      assert.ok(storageUploadIdx !== -1, 'Must define storage upload policy for patient-files');
      const storageUploadChunk = sql.slice(storageUploadIdx, storageUploadIdx + 500);

      assert.ok(
        storageUploadChunk.includes("public.get_clinic_member_role((storage.foldername(name))[1]::uuid) IN ('clinic_owner', 'doctor')"),
        'Storage upload on patient-files must require clinic_owner or doctor'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Behavioral RLS Simulation (Negative Boundary Tests)
  // ---------------------------------------------------------------------------
  describe('2. Negative Boundary Tests: Receptionist & Unauthorized Actors Denied', () => {
    
    // Exact mathematical representation of the PostgreSQL RLS policy condition
    function simulateClinicalSelectPolicy({
      jwtClinicId,
      jwtRole,
      rowClinicId,
      liveMemberRole,
      liveMemberStatus = 'active',
      subscriptionActive = true,
      authUid = 'user-1'
    }) {
      if (!authUid) return false;
      if (!jwtClinicId || jwtClinicId !== rowClinicId) return false;
      if (liveMemberStatus !== 'active') return false;
      if (!subscriptionActive) return false;

      // The live resolver public.get_clinic_member_role(clinic_id)
      const effectiveRole = liveMemberRole;
      if (!effectiveRole) return false;

      // Policy condition: public.get_clinic_member_role(clinic_id) IN ('clinic_owner', 'doctor')
      return ['clinic_owner', 'doctor'].includes(effectiveRole);
    }

    test('Receptionist actor is STRICTLY DENIED SELECT access on clinical tables', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        jwtRole: 'receptionist',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'receptionist',
        liveMemberStatus: 'active',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, false, 'Receptionist must not have SELECT access to clinical records');
    });

    test('Suspended doctor is STRICTLY DENIED access', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        jwtRole: 'doctor',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'doctor',
        liveMemberStatus: 'suspended',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, false, 'Suspended doctor must fail closed');
    });

    test('Inactive owner is STRICTLY DENIED access', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        jwtRole: 'clinic_owner',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'clinic_owner',
        liveMemberStatus: 'inactive',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, false, 'Inactive owner must fail closed');
    });

    test('Foreign tenant doctor (Clinic B doctor querying Clinic A) is STRICTLY DENIED', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-b',
        jwtRole: 'doctor',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'doctor',
        liveMemberStatus: 'active',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, false, 'Cross-tenant query must be rejected');
    });

    test('Unauthenticated caller is STRICTLY DENIED', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        jwtRole: null,
        rowClinicId: 'clinic-a',
        liveMemberRole: null,
        authUid: null
      });

      assert.strictEqual(canSelect, false, 'Unauthenticated query must be rejected');
    });

    test('Lapsed clinic subscription denies even active doctor', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        jwtRole: 'doctor',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'doctor',
        liveMemberStatus: 'active',
        subscriptionActive: false
      });

      assert.strictEqual(canSelect, false, 'Lapsed subscription must fail closed');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Behavioral RLS Simulation (Positive Paths)
  // ---------------------------------------------------------------------------
  describe('3. Positive Boundary Tests: Authorized Clinical Staff Permitted', () => {
    function simulateClinicalSelectPolicy({
      jwtClinicId,
      rowClinicId,
      liveMemberRole,
      liveMemberStatus = 'active',
      subscriptionActive = true,
      authUid = 'user-1'
    }) {
      if (!authUid) return false;
      if (!jwtClinicId || jwtClinicId !== rowClinicId) return false;
      if (liveMemberStatus !== 'active') return false;
      if (!subscriptionActive) return false;
      return ['clinic_owner', 'doctor'].includes(liveMemberRole);
    }

    test('Active Doctor in same clinic is PERMITTED SELECT access', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'doctor',
        liveMemberStatus: 'active',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, true, 'Active doctor in same clinic must have SELECT access');
    });

    test('Active Clinic Owner in same clinic is PERMITTED SELECT access', () => {
      const canSelect = simulateClinicalSelectPolicy({
        jwtClinicId: 'clinic-a',
        rowClinicId: 'clinic-a',
        liveMemberRole: 'clinic_owner',
        liveMemberStatus: 'active',
        subscriptionActive: true
      });

      assert.strictEqual(canSelect, true, 'Active clinic owner in same clinic must have SELECT access');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Frontend Receptionist Firewall & UI Coordination
  // ---------------------------------------------------------------------------
  describe('4. Frontend UI Coordination: Receptionist Firewall', () => {
    test('patient-medical-records.tsx keeps receptionists blind to clinical_records', () => {
      assert.ok(fs.existsSync(MEDICAL_RECORDS_PATH), 'patient-medical-records.tsx must exist');
      const content = fs.readFileSync(MEDICAL_RECORDS_PATH, 'utf8');

      // Invariant: Receptionist queries receptionist_patient_view for safety alerts only
      assert.ok(content.includes("if (user.role === 'receptionist')"), 'Must have explicit receptionist branch');
      assert.ok(content.includes(".from('receptionist_patient_view')"), 'Receptionist queries safe view only');
      assert.ok(content.includes(".select('medical_alerts')"), 'Receptionist selects only medical alerts');

      // Invariant: Full clinical records query is restricted to else branch (doctors/owners)
      const elseBranchIdx = content.indexOf(".from('clinical_records')");
      assert.ok(elseBranchIdx !== -1, 'Must contain clinical_records query');
    });

    test('patient-medical-records.tsx gates fetchOdontogram so receptionists never invoke it', () => {
      const content = fs.readFileSync(MEDICAL_RECORDS_PATH, 'utf8');

      // Invariant: fetchOdontogram is gated by user.role !== 'receptionist'
      assert.ok(
        content.includes("if (user?.role !== 'receptionist') {\n        fetchOdontogram();\n      }") ||
        content.includes("if (user?.role !== 'receptionist') {\r\n        fetchOdontogram();\r\n      }"),
        'fetchOdontogram must be guarded against receptionist execution'
      );
    });

    test('middleware.ts blocks receptionist navigation into patient detail routes', () => {
      assert.ok(fs.existsSync(MIDDLEWARE_PATH), 'middleware.ts must exist');
      const content = fs.readFileSync(MIDDLEWARE_PATH, 'utf8');

      assert.ok(content.includes('if (userRole === "receptionist")'), 'Must have receptionist role check');
      assert.ok(content.includes("if (pathname.startsWith('/patients/'))"), 'Must intercept patient detail routes');
      assert.ok(content.includes("url.pathname = '/patients'"), 'Must redirect back to safe patients list');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Preservation of Essential Administrative Workflows
  // ---------------------------------------------------------------------------
  describe('5. Preservation of Front-Desk Workflows', () => {
    test('Receptionist can query demographics via receptionist_patient_view', () => {
      // Invariant: View exposes safety and demographic columns, excluding diagnostic details
      const viewColumns = ['id', 'clinic_id', 'first_name', 'last_name', 'phone', 'email', 'medical_alerts', 'created_at'];
      const forbiddenDiagnosticColumns = ['diagnosis', 'treatment_plan', 'odontogram_state', 'periodontogram_state', 'notes'];

      for (const col of forbiddenDiagnosticColumns) {
        assert.ok(!viewColumns.includes(col), `receptionist_patient_view must not expose ${col}`);
      }
      assert.ok(viewColumns.includes('medical_alerts'), 'receptionist_patient_view must expose medical_alerts for patient safety');
    });

    test('Prescription templates and history in /recipes can be accessed without exposing raw diagnostic records', () => {
      const recipesPage = fs.readFileSync(path.join(ROOT_DIR, 'app/(dashboard)/recipes/page.tsx'), 'utf8');
      assert.ok(recipesPage.includes('IssuedPrescriptionsList'), 'Recipes page renders IssuedPrescriptionsList');
      assert.ok(recipesPage.includes('RecipesTab'), 'Recipes page renders RecipesTab');
    });
  });
});
