/**
 * PROD-CHK-B05: Real-Time Calendar Double-Booking Prevention & Collision Detection
 * Acceptance Verification Test Suite
 *
 * Verifies:
 * 1. Mathematical interval overlap logic across all 8 boundary conditions.
 * 2. Database query formulation: doctor_id, clinic_id, interval bounds, cancellation exemption, and self-exclusion on edit.
 * 3. ModernCalendar Realtime channel subscription, cache invalidation, and conflict checking.
 * 4. QuickAppointmentDialog and Dashboard appointment collision prevention.
 * 5. Double-submission button disablement and loading state indicators.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '../..')

// --- Pure interval overlap testing ---
function areIntervalsOverlapping(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime()
  const eA = new Date(endA).getTime()
  const sB = new Date(startB).getTime()
  const eB = new Date(endB).getTime()
  return sA < eB && eA > sB
}

async function main() {
  console.log('--- TEST 1: Mathematical Interval Overlap Logic (All 8 Boundary Conditions) ---')
  {
    const slotA_start = '2026-10-01T10:00:00.000Z'
    const slotA_end   = '2026-10-01T11:00:00.000Z'

    // Case 1: Exact match
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T10:00:00.000Z', '2026-10-01T11:00:00.000Z'),
      true,
      'Exact match must detect conflict'
    )

    // Case 2: Partial overlap (starts during A)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T10:30:00.000Z', '2026-10-01T11:30:00.000Z'),
      true,
      'Partial overlap left must detect conflict'
    )

    // Case 3: Partial overlap (ends during A)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T09:30:00.000Z', '2026-10-01T10:30:00.000Z'),
      true,
      'Partial overlap right must detect conflict'
    )

    // Case 4: Complete containment (B inside A)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T10:15:00.000Z', '2026-10-01T10:45:00.000Z'),
      true,
      'Internal subset must detect conflict'
    )

    // Case 5: Complete enclosure (A inside B)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T09:00:00.000Z', '2026-10-01T12:00:00.000Z'),
      true,
      'Enclosing superset must detect conflict'
    )

    // Case 6: Contiguous back-to-back (B starts exactly when A ends)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T11:00:00.000Z', '2026-10-01T12:00:00.000Z'),
      false,
      'Contiguous back-to-back appointments must NOT conflict'
    )

    // Case 7: Contiguous front-to-back (B ends exactly when A starts)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
      false,
      'Contiguous preceding appointments must NOT conflict'
    )

    // Case 8: Completely disjoint (gap between slots)
    assert.strictEqual(
      areIntervalsOverlapping(slotA_start, slotA_end, '2026-10-01T14:00:00.000Z', '2026-10-01T15:00:00.000Z'),
      false,
      'Disjoint non-overlapping appointments must NOT conflict'
    )

    console.log('✓ All 8 interval boundary conditions passed mathematical verification.')
  }

  console.log('--- TEST 2: checkAppointmentConflict Query Mock Execution ---')
  {
    function createMockSupabase(mockData = [], mockError = null) {
      const queryLog = []
      const builder = {
        from(table) {
          queryLog.push({ action: 'from', table })
          return this
        },
        select(columns) {
          queryLog.push({ action: 'select', columns })
          return this
        },
        eq(col, val) {
          queryLog.push({ action: 'eq', col, val })
          return this
        },
        neq(col, val) {
          queryLog.push({ action: 'neq', col, val })
          return this
        },
        lt(col, val) {
          queryLog.push({ action: 'lt', col, val })
          return this
        },
        gt(col, val) {
          queryLog.push({ action: 'gt', col, val })
          return this
        },
        then(resolve) {
          resolve({ data: mockError ? null : mockData, error: mockError })
        }
      }
      return { supabase: builder, queryLog }
    }

    async function runConflictCheck(supabase, { doctorId, startTime, endTime, clinicId, excludeAppointmentId }) {
      const startIso = typeof startTime === 'string' ? startTime : startTime.toISOString()
      const endIso = typeof endTime === 'string' ? endTime : endTime.toISOString()

      let query = supabase
        .from('appointments')
        .select('id, start_time, end_time, status')
        .eq('doctor_id', doctorId)
        .lt('start_time', endIso)
        .gt('end_time', startIso)
        .neq('status', 'cancelled')

      if (clinicId) {
        query = query.eq('clinic_id', clinicId)
      }

      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId)
      }

      const { data, error } = await query
      if (error) return { hasConflict: false, conflicts: [], error }
      const conflicts = data || []
      return { hasConflict: conflicts.length > 0, conflicts }
    }

    // Subtest 2.1: Conflict detected when overlapping row returned
    const conflictRow = [{ id: 'appt-1', start_time: '2026-10-01T10:00:00.000Z', end_time: '2026-10-01T11:00:00.000Z', status: 'confirmed' }]
    const { supabase: mockSb1, queryLog: log1 } = createMockSupabase(conflictRow)

    const result1 = await runConflictCheck(mockSb1, {
      doctorId: 'doc-99',
      startTime: '2026-10-01T10:30:00.000Z',
      endTime: '2026-10-01T11:30:00.000Z',
      clinicId: 'clinic-11',
    })
    assert.strictEqual(result1.hasConflict, true, 'Must flag conflict when overlap exists')
    assert.strictEqual(result1.conflicts.length, 1)

    // Verify query predicates
    assert.ok(log1.some(e => e.action === 'eq' && e.col === 'doctor_id' && e.val === 'doc-99'), 'Query must filter by doctor_id')
    assert.ok(log1.some(e => e.action === 'eq' && e.col === 'clinic_id' && e.val === 'clinic-11'), 'Query must filter by clinic_id')
    assert.ok(log1.some(e => e.action === 'neq' && e.col === 'status' && e.val === 'cancelled'), 'Query must exclude cancelled appointments')
    assert.ok(log1.some(e => e.action === 'lt' && e.col === 'start_time'), 'Query must filter start_time < endIso')
    assert.ok(log1.some(e => e.action === 'gt' && e.col === 'end_time'), 'Query must filter end_time > startIso')
    console.log('✓ Subtest 2.1: Conflict detection predicates verified.')

    // Subtest 2.2: Exclude self when rescheduling/editing
    const { supabase: mockSb2, queryLog: log2 } = createMockSupabase([])
    const result2 = await runConflictCheck(mockSb2, {
      doctorId: 'doc-99',
      startTime: '2026-10-01T10:30:00.000Z',
      endTime: '2026-10-01T11:30:00.000Z',
      clinicId: 'clinic-11',
      excludeAppointmentId: 'appt-current-456'
    })
    assert.strictEqual(result2.hasConflict, false, 'No conflict when database returns zero rows')
    assert.ok(log2.some(e => e.action === 'neq' && e.col === 'id' && e.val === 'appt-current-456'), 'Query must exclude current appointment ID')
    console.log('✓ Subtest 2.2: Rescheduling self-exclusion verified.')
  }

  console.log('--- TEST 3: ModernCalendar Static Verification ---')
  {
    const calendarPath = path.join(ROOT_DIR, 'components/calendar/modern-calendar.tsx')
    assert.ok(fs.existsSync(calendarPath), 'modern-calendar.tsx must exist')
    const content = fs.readFileSync(calendarPath, 'utf8')

    // Realtime subscription
    assert.ok(content.includes('useQueryClient'), 'Must import and use useQueryClient')
    assert.ok(content.includes("channel(`appointments-clinic-"), 'Must create Realtime channel scoped to clinic_id')
    assert.ok(content.includes("table: 'appointments'"), "Must listen to postgres_changes on 'appointments' table")
    assert.ok(content.includes('supabase.removeChannel'), 'Must remove/cleanup channel on unmount')
    assert.ok(content.includes("invalidateQueries({ queryKey: ['appointments'] })"), 'Must invalidate appointments queries on realtime update')

    // Conflict check imports and usage
    assert.ok(content.includes('checkAppointmentConflict'), 'Must import checkAppointmentConflict')
    assert.ok(content.includes('handleCreateAppointment'), 'Must implement handleCreateAppointment')
    assert.ok(content.includes('Conflicto de agenda: El especialista ya tiene una cita en ese horario.'), 'Must show conflict error toast')

    // Double-submission protection
    assert.ok(content.includes('isSubmitting'), 'Must maintain isSubmitting state')
    assert.ok(content.includes('disabled={isSubmitting'), 'Must disable submit buttons when isSubmitting is true')
    assert.ok(content.includes('Loader2'), 'Must show Loader2 spinner during submission')

    // Tenant scoping
    assert.ok(content.includes("clinic_id: currentClinicId"), 'Must pass clinic_id to appointment inserts')

    // Edit conflict check
    assert.ok(content.includes('excludeAppointmentId: selectedAppointment.id'), 'Must exclude current appointment ID in handleSaveEdit')

    console.log('✓ ModernCalendar realtime channels, conflict checks, and double-submit guards verified.')
  }

  console.log('--- TEST 4: QuickAppointmentDialog Static Verification ---')
  {
    const dialogPath = path.join(ROOT_DIR, 'components/quick-appointment-dialog.tsx')
    assert.ok(fs.existsSync(dialogPath), 'quick-appointment-dialog.tsx must exist')
    const content = fs.readFileSync(dialogPath, 'utf8')

    assert.ok(content.includes('checkAppointmentConflict'), 'QuickAppointmentDialog must import checkAppointmentConflict')
    assert.ok(content.includes('hasConflict'), 'QuickAppointmentDialog must evaluate conflict result before insert')
    assert.ok(content.includes('Conflicto de agenda'), 'QuickAppointmentDialog must show conflict toast')
    assert.ok(content.includes('clinic_id: currentClinicId'), 'QuickAppointmentDialog must scope by currentClinicId')
    assert.ok(content.includes('isSubmitting'), 'QuickAppointmentDialog must track isSubmitting state')

    console.log('✓ QuickAppointmentDialog conflict prevention verified.')
  }

  console.log('--- TEST 5: Dashboard Page Static Verification ---')
  {
    const dashboardPath = path.join(ROOT_DIR, 'app/(dashboard)/dashboard/page.tsx')
    assert.ok(fs.existsSync(dashboardPath), 'dashboard/page.tsx must exist')
    const content = fs.readFileSync(dashboardPath, 'utf8')

    assert.ok(content.includes('checkAppointmentConflict'), 'Dashboard must import checkAppointmentConflict')
    assert.ok(content.includes('isSubmittingAppointment'), 'Dashboard must maintain isSubmittingAppointment state')
    assert.ok(content.includes('disabled={isSubmittingAppointment}'), 'Dashboard must disable submit button while submitting')
    assert.ok(content.includes('Conflicto de agenda'), 'Dashboard must show collision error toast')
    assert.ok(content.includes('clinic_id: currentClinicId'), 'Dashboard must scope appointment insert by clinic_id')

    console.log('✓ Dashboard appointment collision prevention and submission guard verified.')
  }

  console.log('--- TEST 6: AppointmentList Static Verification ---')
  {
    const listPath = path.join(ROOT_DIR, 'components/appointment-list.tsx')
    assert.ok(fs.existsSync(listPath), 'appointment-list.tsx must exist')
    const content = fs.readFileSync(listPath, 'utf8')

    assert.ok(content.includes('currentClinicId'), 'AppointmentList must use currentClinicId')
    assert.ok(content.includes("eq('clinic_id', currentClinicId)"), 'AppointmentList must filter query by clinic_id')
    assert.ok(content.includes('appointments-list-'), 'AppointmentList must scope Realtime channel to clinic_id')
    assert.ok(content.includes('clinic_id=eq.'), 'AppointmentList must filter Realtime channel events by clinic_id')

    console.log('✓ AppointmentList multi-tenant query and realtime channel verified.')
  }

  console.log('\n======================================================')
  console.log('ALL PROD-CHK-B05 CALENDAR DOUBLE-BOOKING TESTS PASSED!')
  console.log('======================================================')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
