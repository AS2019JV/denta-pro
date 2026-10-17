/**
 * Gate 6: PROD-CHK-G01 Migration Rollback & Mathematical Reversibility Test
 *
 * Scope:
 *  - Verification of mathematical 1:1 bijectivity between forward migration
 *    `supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql`
 *    and backward rollback script `supabase/migrations/rollback_20260922194927.sql`.
 *  - Reversal of all composite foreign keys (patient_id, clinic_id)
 *  - Restoration of all single-column foreign keys (patient_id) -> patients(id)
 *  - Removal of unique constraint patients_id_clinic_id_key
 *  - Safe removal of triggers, functions, and compound indexes
 *  - Zero data loss: Prohibition of DROP TABLE or TRUNCATE
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const FORWARD_SQL_PATH = path.join(
  ROOT_DIR,
  'supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql'
);
const ROLLBACK_SQL_PATH = path.join(
  ROOT_DIR,
  'supabase/migrations/rollback_20260922194927.sql'
);

describe('Gate 6: PROD-CHK-G01 Migration Reversibility & Rollback Integrity', () => {
  assert.ok(fs.existsSync(FORWARD_SQL_PATH), 'Forward migration must exist');
  assert.ok(fs.existsSync(ROLLBACK_SQL_PATH), 'Rollback script must exist');

  const forwardSql = fs.readFileSync(FORWARD_SQL_PATH, 'utf8');
  const rollbackSql = fs.readFileSync(ROLLBACK_SQL_PATH, 'utf8');

  // ==========================================================================
  // Suite 1: Transactional Safety & Non-Destructive Invariants
  // ==========================================================================
  describe('1. Transactional Safety & Non-Destructive Invariants', () => {
    test('Rollback script is wrapped in an atomic BEGIN ... COMMIT block', () => {
      assert.match(rollbackSql, /^\s*BEGIN;/m, 'Rollback must start with BEGIN;');
      assert.match(rollbackSql, /COMMIT;\s*$/m, 'Rollback must end with COMMIT;');
    });

    test('Zero destructive data operations (No DROP TABLE or TRUNCATE)', () => {
      assert.doesNotMatch(
        rollbackSql,
        /\bDROP\s+TABLE\b/i,
        'Rollback script must NEVER drop tables'
      );
      assert.doesNotMatch(
        rollbackSql,
        /\bTRUNCATE\b/i,
        'Rollback script must NEVER truncate data'
      );
    });

    test('All DROP statements use IF EXISTS idempotency guard', () => {
      const dropLines = rollbackSql
        .split('\n')
        .map(l => l.trim())
        .filter(l => !l.startsWith('--') && (l.toUpperCase().startsWith('DROP ') || l.toUpperCase().includes(' DROP ')));

      for (const line of dropLines) {
        assert.ok(
          line.toUpperCase().includes('IF EXISTS'),
          `Drop statement must include IF EXISTS: "${line}"`
        );
      }
    });
  });

  // ==========================================================================
  // Suite 2: Mathematical Foreign Key Bijectivity (1:1 Inversion)
  // ==========================================================================
  describe('2. Foreign Key Constraint Bijectivity', () => {
    const compositeFkNames = [
      'appointments_patient_clinic_fkey',
      'prescriptions_patient_clinic_fkey',
      'clinical_records_patient_clinic_fkey',
      'patient_notes_patient_clinic_fkey',
      'patient_files_patient_clinic_fkey',
      'hcu033_forms_patient_clinic_fkey',
      'data_rights_requests_patient_clinic_fkey',
      'billings_patient_clinic_fkey',
      'invoices_patient_clinic_fkey',
      'patients_family_clinic_fkey'
    ];

    const singleFkNames = [
      'appointments_patient_id_fkey',
      'prescriptions_patient_id_fkey',
      'clinical_records_patient_id_fkey',
      'patient_notes_patient_id_fkey',
      'patient_files_patient_id_fkey',
      'hcu033_forms_patient_id_fkey',
      'data_rights_requests_patient_id_fkey',
      'billings_patient_id_fkey',
      'invoices_patient_id_fkey'
    ];

    test('Every composite foreign key added in forward migration is dropped in rollback', () => {
      for (const fk of compositeFkNames) {
        assert.ok(
          forwardSql.includes(fk),
          `Forward migration must define composite constraint: ${fk}`
        );
        const dropFkRegex = new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${fk}`, 'i');
        assert.match(
          rollbackSql,
          dropFkRegex,
          `Rollback script must drop composite constraint: ${fk}`
        );
      }
    });

    test('Every single-column foreign key dropped in forward migration is restored in rollback', () => {
      for (const fk of singleFkNames) {
        assert.ok(
          forwardSql.includes(fk),
          `Forward migration must drop old single-column constraint: ${fk}`
        );
        const addFkRegex = new RegExp(`ADD\\s+CONSTRAINT\\s+${fk}\\s+FOREIGN\\s+KEY`, 'i');
        assert.match(
          rollbackSql,
          addFkRegex,
          `Rollback script must restore original single-column constraint: ${fk}`
        );
      }
    });

    test('Composite unique constraint on patients is dropped in rollback', () => {
      assert.ok(
        forwardSql.includes('patients_id_clinic_id_key'),
        'Forward migration must create patients_id_clinic_id_key'
      );
      assert.match(
        rollbackSql,
        /ALTER\s+TABLE\s+public\.patients\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+patients_id_clinic_id_key/i,
        'Rollback must drop patients_id_clinic_id_key'
      );
    });
  });

  // ==========================================================================
  // Suite 3: Index, Trigger & Function Teardown
  // ==========================================================================
  describe('3. Index, Trigger & Function Reversion', () => {
    const compoundIndexes = [
      'idx_appointments_clinic_patient',
      'idx_prescriptions_clinic_patient',
      'idx_clinical_records_clinic_patient',
      'idx_patient_notes_clinic_patient',
      'idx_patient_files_clinic_patient',
      'idx_data_rights_requests_clinic_patient',
      'idx_billings_clinic_patient',
      'idx_invoices_clinic_patient'
    ];

    test('Every compound index created in forward migration is dropped in rollback', () => {
      for (const idx of compoundIndexes) {
        assert.ok(
          forwardSql.includes(idx),
          `Forward migration must create index: ${idx}`
        );
        const dropIdxRegex = new RegExp(`DROP\\s+INDEX\\s+IF\\s+EXISTS\\s+public\\.${idx}`, 'i');
        assert.match(
          rollbackSql,
          dropIdxRegex,
          `Rollback script must drop index: ${idx}`
        );
      }
    });

    test('Every security trigger and function is dropped cleanly in rollback', () => {
      const triggers = [
        'trg_enforce_clinician_assignment',
        'trg_guard_data_rights_request_insert',
        'trg_protect_data_rights_requests',
        'trg_audit_data_rights_status'
      ];

      for (const trg of triggers) {
        assert.ok(
          forwardSql.includes(trg),
          `Forward migration must create trigger: ${trg}`
        );
        const dropTrgRegex = new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${trg}`, 'i');
        assert.match(
          rollbackSql,
          dropTrgRegex,
          `Rollback script must drop trigger: ${trg}`
        );
      }

      const functions = [
        'security_internal.enforce_clinician_assignment',
        'public.guard_data_rights_request_insert',
        'public.protect_data_rights_requests',
        'security_internal.audit_data_rights_status'
      ];

      for (const fn of functions) {
        assert.ok(
          forwardSql.includes(fn),
          `Forward migration must define function: ${fn}`
        );
        const escapedFn = fn.replace('.', '\\.');
        const dropFnRegex = new RegExp(`DROP\\s+FUNCTION\\s+IF\\s+EXISTS\\s+${escapedFn}`, 'i');
        assert.match(
          rollbackSql,
          dropFnRegex,
          `Rollback script must drop function: ${fn}`
        );
      }
    });
  });

  // ==========================================================================
  // Suite 4: RLS Policy Baseline Restoration
  // ==========================================================================
  describe('4. RLS Policy Baseline Restoration', () => {
    test('Rollback drops least-privilege clinical policies and restores previous baseline', () => {
      const clinicalStaffPolicies = [
        'Clinical staff can view patient files',
        'Clinical staff can insert patient files',
        'Clinical staff can update patient files',
        'Clinical staff can view patient notes',
        'Clinical staff can insert patient notes',
        'Clinical staff can update patient notes',
        'Clinical staff can view hcu033_forms',
        'Tenant isolated read for patient-files',
        'Tenant isolated upload for patient-files'
      ];

      for (const pol of clinicalStaffPolicies) {
        assert.ok(
          forwardSql.includes(pol),
          `Forward migration must define policy: "${pol}"`
        );
        assert.ok(
          rollbackSql.includes(`DROP POLICY IF EXISTS "${pol}"`),
          `Rollback script must drop policy: "${pol}"`
        );
      }

      // Check restored policies
      assert.ok(
        rollbackSql.includes('CREATE POLICY "Users can view files in their clinic"'),
        'Rollback must restore baseline view files policy'
      );
      assert.ok(
        rollbackSql.includes('CREATE POLICY "Users can view notes in their clinic"'),
        'Rollback must restore baseline view notes policy'
      );
      assert.ok(
        rollbackSql.includes('CREATE POLICY "Clinic members can view hcu033_forms"'),
        'Rollback must restore baseline hcu033 view policy'
      );
    });
  });
});
