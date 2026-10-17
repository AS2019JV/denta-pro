/**
 * Gate 2: PROD-CHK-C02 Compound Multi-Tenant Performance Indexes Test
 *
 * Scope:
 *  - Verifies presence, syntax, and transaction safety of forward migration
 *    `supabase/migrations/20260925000000_compound_multi_tenant_indexes.sql`.
 *  - Verifies presence, syntax, and transaction safety of backward rollback script
 *    `supabase/migrations/rollback_20260925000000.sql`.
 *  - Verifies 1:1 bijectivity (every created index is cleanly dropped in rollback).
 *  - Verifies exact compound column coverage for:
 *      1. patients(clinic_id, cedula)
 *      2. appointments(clinic_id, doctor_id, start_time, end_time) WHERE status != 'cancelled'
 *      3. appointments(clinic_id, start_time)
 *      4. appointments(clinic_id, patient_id, doctor_id)
 *      5. prescriptions(clinic_id, created_at DESC)
 *      6. hcu033_forms(clinic_id, patient_id)
 *  - Verifies zero data-loss invariants (no DROP TABLE, TRUNCATE, or column drops).
 */

const assert = require('node:assert/strict')
const { test, describe } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const ROOT_DIR = path.resolve(__dirname, '../..')
const FORWARD_SQL_PATH = path.join(
  ROOT_DIR,
  'supabase/migrations/20260925000000_compound_multi_tenant_indexes.sql'
)
const ROLLBACK_SQL_PATH = path.join(
  ROOT_DIR,
  'supabase/migrations/rollback_20260925000000.sql'
)

describe('Gate 2: PROD-CHK-C02 Compound Multi-Tenant Indexes & Rollback Verification', () => {
  const forwardSql = fs.readFileSync(FORWARD_SQL_PATH, 'utf8')
  const rollbackSql = fs.readFileSync(ROLLBACK_SQL_PATH, 'utf8')

  describe('1. File Existence & Transaction Safety Invariants', () => {
    test('Forward migration file exists and is non-empty', () => {
      assert.ok(fs.existsSync(FORWARD_SQL_PATH), 'Forward migration file must exist')
      assert.ok(forwardSql.trim().length > 100, 'Forward migration must not be empty')
    })

    test('Rollback migration file exists and is non-empty', () => {
      assert.ok(fs.existsSync(ROLLBACK_SQL_PATH), 'Rollback migration file must exist')
      assert.ok(rollbackSql.trim().length > 100, 'Rollback migration must not be empty')
    })

    test('Forward migration is wrapped in an atomic BEGIN ... COMMIT block', () => {
      assert.match(forwardSql, /^\s*BEGIN\s*;/m, 'Forward migration must begin with BEGIN;')
      assert.match(forwardSql, /COMMIT\s*;\s*$/m, 'Forward migration must conclude with COMMIT;')
    })

    test('Rollback migration is wrapped in an atomic BEGIN ... COMMIT block', () => {
      assert.match(rollbackSql, /^\s*BEGIN\s*;/m, 'Rollback migration must begin with BEGIN;')
      assert.match(rollbackSql, /COMMIT\s*;\s*$/m, 'Rollback migration must conclude with COMMIT;')
    })

    test('Zero destructive data operations in both files', () => {
      const destructivePatterns = [/DROP\s+TABLE/i, /TRUNCATE/i, /DROP\s+COLUMN/i]
      for (const pattern of destructivePatterns) {
        assert.ok(!pattern.test(forwardSql), `Forward migration must not contain destructive statement: ${pattern}`)
        assert.ok(!pattern.test(rollbackSql), `Rollback migration must not contain destructive statement: ${pattern}`)
      }
    })
  })

  describe('2. Idempotency & Predicate Precision', () => {
    test('Every CREATE INDEX statement includes IF NOT EXISTS guard', () => {
      const createMatches = forwardSql.match(/CREATE\s+INDEX/gi) || []
      const ifNotExistsMatches = forwardSql.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) || []
      assert.strictEqual(
        createMatches.length,
        ifNotExistsMatches.length,
        'All CREATE INDEX statements must specify IF NOT EXISTS'
      )
      assert.ok(createMatches.length >= 6, 'Must create at least 6 compound indexes')
    })

    test('Every DROP INDEX statement in rollback includes IF EXISTS guard', () => {
      const dropMatches = rollbackSql.match(/DROP\s+INDEX/gi) || []
      const ifExistsMatches = rollbackSql.match(/DROP\s+INDEX\s+IF\s+EXISTS/gi) || []
      assert.strictEqual(
        dropMatches.length,
        ifExistsMatches.length,
        'All DROP INDEX statements must specify IF EXISTS'
      )
      assert.ok(dropMatches.length >= 6, 'Must drop at least 6 compound indexes')
    })
  })

  describe('3. Compound Index Coverage & Target Workflows', () => {
    test('Patient Cédula Intake: idx_patients_clinic_cedula covers (clinic_id, cedula)', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_patients_clinic_cedula\s+ON\s+public\.patients\s*\(\s*clinic_id\s*,\s*cedula\s*\)/i,
        'idx_patients_clinic_cedula must index patients(clinic_id, cedula)'
      )
    })

    test('Calendar Collision Scan: idx_appointments_conflict covers (clinic_id, doctor_id, start_time, end_time) WHERE status != cancelled', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_appointments_conflict\s+ON\s+public\.appointments\s*\(\s*clinic_id\s*,\s*doctor_id\s*,\s*start_time\s*,\s*end_time\s*\)\s+WHERE\s+status\s*!=\s*'cancelled'/i,
        'idx_appointments_conflict must index appointments(clinic_id, doctor_id, start_time, end_time) with cancelled exclusion'
      )
    })

    test('Calendar Range Queries: idx_appointments_clinic_start covers (clinic_id, start_time)', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_appointments_clinic_start\s+ON\s+public\.appointments\s*\(\s*clinic_id\s*,\s*start_time\s*\)/i,
        'idx_appointments_clinic_start must index appointments(clinic_id, start_time)'
      )
    })

    test('Appointment Patient History: idx_appointments_patient_doctor covers (clinic_id, patient_id, doctor_id)', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_appointments_patient_doctor\s+ON\s+public\.appointments\s*\(\s*clinic_id\s*,\s*patient_id\s*,\s*doctor_id\s*\)/i,
        'idx_appointments_patient_doctor must index appointments(clinic_id, patient_id, doctor_id)'
      )
    })

    test('Prescription Chronological Sort: idx_prescriptions_clinic_created covers (clinic_id, created_at DESC)', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_prescriptions_clinic_created\s+ON\s+public\.prescriptions\s*\(\s*clinic_id\s*,\s*created_at\s+DESC\s*\)/i,
        'idx_prescriptions_clinic_created must index prescriptions(clinic_id, created_at DESC)'
      )
    })

    test('Clinical Charting HCU-033: idx_hcu033_clinic_patient covers (clinic_id, patient_id)', () => {
      assert.match(
        forwardSql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_hcu033_clinic_patient\s+ON\s+public\.hcu033_forms\s*\(\s*clinic_id\s*,\s*patient_id\s*\)/i,
        'idx_hcu033_clinic_patient must index hcu033_forms(clinic_id, patient_id)'
      )
    })
  })

  describe('4. Bijective Rollback Symmetry', () => {
    test('Every index created in forward migration is dropped in rollback script', () => {
      // Extract created index names
      const forwardIndexMatches = [
        ...forwardSql.matchAll(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)
      ].map(m => m[1])

      assert.ok(forwardIndexMatches.length >= 6, 'Must find created indexes in forward migration')

      // Extract dropped index names in rollback
      const rollbackDropMatches = [
        ...rollbackSql.matchAll(/DROP\s+INDEX\s+IF\s+EXISTS\s+(?:public\.)?(\w+)/gi)
      ].map(m => m[1])

      for (const idxName of forwardIndexMatches) {
        assert.ok(
          rollbackDropMatches.includes(idxName),
          `Index ${idxName} created in forward migration must be dropped in rollback migration`
        )
      }

      assert.strictEqual(
        forwardIndexMatches.length,
        rollbackDropMatches.length,
        'Number of created indexes must match number of dropped indexes (1:1 bijection)'
      )
    })
  })

  describe('5. Alignment with Roadmap & Conflict Detection Algorithm', () => {
    test('Aligns with CORRECTIONS_AND_ROADMAP.md Section 2.1 Issue 1 recommendations', () => {
      const roadmapPath = path.join(ROOT_DIR, 'CORRECTIONS_AND_ROADMAP.md')
      assert.ok(fs.existsSync(roadmapPath), 'CORRECTIONS_AND_ROADMAP.md must exist')
      const roadmapContent = fs.readFileSync(roadmapPath, 'utf8')

      assert.ok(roadmapContent.includes('idx_patients_clinic_cedula'), 'Roadmap recommends idx_patients_clinic_cedula')
      assert.ok(roadmapContent.includes('idx_appointments_clinic_start'), 'Roadmap recommends idx_appointments_clinic_start')
      assert.ok(roadmapContent.includes('idx_prescriptions_clinic_created'), 'Roadmap recommends idx_prescriptions_clinic_created')
      assert.ok(roadmapContent.includes('idx_hcu033_clinic_patient'), 'Roadmap recommends idx_hcu033_clinic_patient')
    })

    test('Aligns with lib/calendar-conflict.ts checkAppointmentConflict predicates', () => {
      const conflictUtilPath = path.join(ROOT_DIR, 'lib/calendar-conflict.ts')
      assert.ok(fs.existsSync(conflictUtilPath), 'lib/calendar-conflict.ts must exist')
      const conflictContent = fs.readFileSync(conflictUtilPath, 'utf8')

      // checkAppointmentConflict queries doctor_id, clinic_id, start_time < end, end_time > start, status != 'cancelled'
      assert.ok(conflictContent.includes("eq('doctor_id', doctorId)"))
      assert.ok(conflictContent.includes("eq('clinic_id', clinicId)"))
      assert.ok(conflictContent.includes("lt('start_time', endIso)"))
      assert.ok(conflictContent.includes("gt('end_time', startIso)"))
      assert.ok(conflictContent.includes("neq('status', 'cancelled')"))

      // The partial index idx_appointments_conflict perfectly covers this exact predicate structure
      assert.ok(forwardSql.includes('idx_appointments_conflict'))
      assert.ok(forwardSql.includes("WHERE status != 'cancelled'"))
    })
  })
})
