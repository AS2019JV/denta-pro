'use strict'
// Genuine local JWT/PostgREST acceptance; never reads application dotenv files.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const local = require('./clinia-local-runtime.cjs')
const attempt = process.argv[2] || '1'
if (!/^(?:[1-9]|1[0-9]|2[0-8])$/.test(attempt)) throw new Error('Attempt must be 1..28')
const day = `2037-08-${attempt.padStart(2, '0')}`
const output = path.join(
  local.repo,
  'docs/production/evidence/2026-09-28-performance/agenda-runtime-' + attempt.padStart(2, '0'),
)
const A = '33333333-3333-4333-8333-333333333333'
const B = '44444444-4444-4444-8444-444444444444'
const patientA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const patientB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const report = {
  startedAt: new Date().toISOString(),
  environment: 'local-synthetic',
  state: 'PARTIAL',
  checks: [],
  requests: [],
  created: [],
  limitations: [
    'This is the reviewed local schema, not complete remote migration parity or deployed acceptance.',
    'Concurrency covers two overlapping requests; 10-user/5000-patient load and idempotency tokens remain pending.',
    'Doctor availability across clinics and clinical/privacy UAT remain separate release gates.',
  ],
}
let madeOutput = false
function trusted(sql) {
  return local.sql('postgres', sql, 'postgres')
}
function ok(result) {
  assert.equal(result.error, null, result.error?.message)
  return result.data
}
function denied(result, code) {
  assert.ok(result.error, 'Operation should fail')
  if (code) assert.equal(result.error.code, code, result.error.message)
  assert.equal(result.data, null)
}
async function check(name, fn) {
  try {
    await fn()
    report.checks.push({ name, passed: true })
    console.log('PASS ' + name)
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message })
    console.error('FAIL ' + name + ': ' + e.message)
    process.exitCode = 1
  }
}
function client(key, actor) {
  return createClient(local.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url)
        if (url.origin !== local.url) throw new Error('Non-local request refused')
        const start = Date.now(),
          response = await fetch(input, { ...init, signal: AbortSignal.timeout(15000) })
        report.requests.push({
          actor,
          path: url.pathname,
          method: init?.method || 'GET',
          status: response.status,
          elapsedMs: Date.now() - start,
        })
        return response // No tokens, bodies, auth headers or credentials in evidence.
      },
    },
  })
}
async function main() {
  if (fs.existsSync(output)) throw new Error('Evidence exists: refusing replay or overwrite')
  fs.mkdirSync(output, { recursive: true })
  madeOutput = true
  report.runtime = local.inspectLocal()
  assert.equal(
    trusted(
      "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_no_overlap' AND conrelid='public.appointments'::regclass);",
    ),
    't',
  )
  const keys = local.keys(),
    actors = JSON.parse(
      fs.readFileSync(path.join(local.privateDir, 'encargo02-actors.private.json'), 'utf8'),
    )
  const clients = {}
  for (const label of ['owner_A', 'doctor_A', 'receptionist_A', 'removed_A', 'doctor_B']) {
    const c = client(keys.anon, label),
      a = actors[label]
    const login = ok(await c.auth.signInWithPassword({ email: a.email, password: a.password }))
    assert.equal(login.user.id, a.id)
    clients[label] = c
    const liveRole = await c.rpc('get_clinic_member_role', {
      check_clinic_id: label === 'doctor_B' ? B : A,
    })
    assert.equal(liveRole.error, null, liveRole.error?.message)
  }
  const reception = clients.receptionist_A,
    doctor = clients.doctor_A,
    owner = clients.owner_A
  const tag = 'Agenda sintética ' + crypto.randomBytes(5).toString('hex')
  const payload = (time, duration = 30, extra = {}) => ({
    patient_id: patientA,
    doctor_id: actors.doctor_A.id,
    type: tag,
    status: 'scheduled',
    start_time: `${day}T${time}:00Z`,
    end_time: new Date(Date.parse(`${day}T${time}:00Z`) + duration * 60000).toISOString(),
    ...extra,
  })
  const save = (c, data, id = null, clinic = A) =>
    c.rpc('save_clinic_appointment', { p_clinic_id: clinic, p_data: data, p_appointment_id: id })
  const remember = (row) => {
    assert.ok(row.id)
    report.created.push(row.id)
    return row
  }
  const financialSnapshot = () =>
    trusted(
      "SELECT json_build_object('billings',(SELECT count(*) FROM public.billings),'invoices',(SELECT count(*) FROM public.invoices),'payments',(SELECT count(*) FROM public.payments),'balances',(SELECT json_agg(json_build_array(id,account_balance) ORDER BY id) FROM public.patients));",
    )
  const moneyBefore = financialSnapshot()
  let winner, adjacent, cancelTarget
  await check(
    'Two ordinary JWTs racing for one interval persist exactly one appointment',
    async () => {
      const results = await Promise.all([
        save(reception, payload('13:00')),
        save(owner, payload('13:15')),
      ])
      assert.equal(results.filter((r) => !r.error).length, 1)
      const rejected = results.find((r) => r.error)
      denied(rejected, '23P01')
      assert.equal(rejected.error.message, 'Appointment interval unavailable')
      assert.equal(rejected.error.details, null)
      winner = remember(ok(results.find((r) => !r.error)))
      assert.equal(
        trusted(
          `SELECT count(*) FROM public.appointments WHERE id='${winner.id}' AND clinic_id='${A}';`,
        ),
        '1',
      )
    },
  )
  await check(
    'Consecutive appointments succeed; conflicting reschedule fails without losing original',
    async () => {
      assert.ok(winner, 'Concurrency prerequisite')
      const data = payload('14:00')
      data.start_time = winner.end_time
      data.end_time = new Date(Date.parse(data.start_time) + 30 * 60000).toISOString()
      adjacent = remember(ok(await save(reception, data)))
      denied(
        await save(
          reception,
          { start_time: winner.start_time, end_time: winner.end_time },
          adjacent.id,
        ),
        '23P01',
      )
      const persisted = JSON.parse(
        trusted(
          `SELECT json_build_object('start_time',start_time,'end_time',end_time) FROM public.appointments WHERE id='${adjacent.id}';`,
        ),
      )
      assert.equal(Date.parse(persisted.start_time), Date.parse(adjacent.start_time))
      assert.equal(Date.parse(persisted.end_time), Date.parse(adjacent.end_time))
    },
  )
  await check(
    'Reception sees operational joins and never clinical notes or financial fields',
    async () => {
      const schedule = ok(
        await reception.rpc('get_clinic_schedule', {
          p_clinic_id: A,
          p_start: day + 'T00:00:00Z',
          p_end: new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString(),
        }),
      )
      assert.equal(schedule.items.length, schedule.total_count)
      assert.ok(schedule.items.length >= 2)
      for (const row of schedule.items) {
        assert.equal(row.clinic_id, A)
        assert.ok(row.patients.first_name)
        assert.ok(row.profiles.id)
        for (const key of ['notes', 'billings', 'price', 'account_balance'])
          assert.equal(key in row, false)
      }
      denied(
        await save(reception, payload('16:00', 30, { notes: 'Forbidden clinical note' })),
        '22023',
      )
      denied(await save(reception, payload('16:00', 30, { price: '100' })), '22023')
    },
  )
  await check(
    'Foreign patient/clinician/clinic, removed actor and anonymous requests fail',
    async () => {
      denied(await save(reception, payload('16:00', 30, { patient_id: patientB })), '42501')
      denied(
        await save(reception, payload('16:00', 30, { doctor_id: actors.doctor_B.id })),
        '22023',
      )
      denied(
        await save(reception, payload('16:00', 30, { doctor_id: actors.removed_A.id })),
        '22023',
      )
      denied(await save(reception, payload('16:00', 30, { doctor_id: null })), '22023')
      denied(await save(reception, { status: 'cancelled' }, winner.id, B), '42501')
      denied(await save(clients.removed_A, payload('16:00')), '42501')
      denied(await save(client(keys.anon, 'anonymous'), payload('16:00')))
    },
  )
  await check(
    'All operational transitions persist and completed records reject reactivation/reprogramming',
    async () => {
      for (const status of ['confirmed', 'arrived', 'completed'])
        assert.equal(ok(await save(reception, { status }, winner.id)).status, status)
      denied(await save(reception, { status: 'scheduled' }, winner.id), '22023')
      denied(
        await save(
          reception,
          { start_time: day + 'T19:00:00Z', end_time: day + 'T19:30:00Z' },
          winner.id,
        ),
        '22023',
      )
      const freed = remember(
        ok(
          await save(reception, {
            ...payload('13:00'),
            start_time: winner.start_time,
            end_time: winner.end_time,
          }),
        ),
      )
      ok(await save(reception, { status: 'no_show' }, freed.id))
      ok(await save(reception, { status: 'scheduled' }, freed.id))
      ok(await save(reception, { status: 'cancelled' }, freed.id))
    },
  )
  await check(
    'Direct clinical writes cannot bypass overlap or transitions; reception cannot write base table',
    async () => {
      const base = { ...payload('17:00'), clinic_id: A }
      const row = remember(ok(await doctor.from('appointments').insert(base).select('id').single()))
      denied(await doctor.from('appointments').insert(base).select('id').single(), '23P01')
      denied(
        await doctor
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', row.id)
          .select('id')
          .single(),
        '22023',
      )
      denied(
        await reception
          .from('appointments')
          .insert({ ...payload('18:00'), clinic_id: A })
          .select('id')
          .single(),
      )
      denied(
        await doctor
          .from('appointments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', row.id)
          .select('id')
          .single(),
        '42501',
      )
      ok(await save(doctor, { status: 'cancelled' }, row.id))
    },
  )
  await check('Invalid initial states, duration and timestamp fail safely', async () => {
    for (const data of [
      payload('18:00', 1),
      payload('18:00', 481),
      payload('18:00', 30, { status: 'arrived' }),
      payload('18:00', 30, { start_time: 'invalid' }),
    ])
      denied(await save(reception, data), '22023')
  })
  await check(
    'Inactive assigned clinician can be cancelled; old JWT loses access immediately',
    async () => {
      cancelTarget = remember(ok(await save(reception, payload('20:00'))))
      trusted(
        `UPDATE public.clinic_members SET status='removed' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`,
      )
      try {
        denied(await save(doctor, { status: 'cancelled' }, cancelTarget.id), '42501')
        assert.equal(
          ok(await save(reception, { status: 'cancelled' }, cancelTarget.id)).status,
          'cancelled',
        )
        denied(await save(reception, { status: 'scheduled' }, cancelTarget.id), '22023')
      } finally {
        trusted(
          `UPDATE public.clinic_members SET status='active' WHERE clinic_id='${A}' AND user_id='${actors.doctor_A.id}';`,
        )
      }
    },
  )
  await check(
    'Operational audit records real actors without clinical content; clients cannot read private audit',
    async () => {
      const ids = report.created.map((id) => `'${id}'`).join(',')
      const audit = JSON.parse(
        trusted(
          `SELECT json_build_object('events',count(*),'actors',count(DISTINCT actor_id),'allTagged',bool_and(actor_id IS NOT NULL),'contentSafe',bool_and(NOT after_values ? 'notes' AND NOT coalesce(before_values,'{}') ? 'notes'),'clientRead',has_table_privilege('authenticated','security_internal.appointment_events','SELECT')) FROM security_internal.appointment_events WHERE appointment_id IN (${ids});`,
        ),
      )
      assert.ok(audit.events >= report.created.length + 4)
      assert.ok(audit.actors >= 2)
      assert.equal(audit.allTagged, true)
      assert.equal(audit.contentSafe, true)
      assert.equal(audit.clientRead, false)
      denied(await owner.schema('security_internal').from('appointment_events').select('*'))
      report.audit = audit
    },
  )
  await check('Agenda creates no financial records and preserves historic balances', () =>
    assert.equal(financialSnapshot(), moneyBefore),
  )
  report.finishedAt = new Date().toISOString()
  if (report.checks.every((c) => c.passed)) report.state = 'VERIFIED_LOCAL_BOUNDED'
}
main()
  .catch((e) => {
    report.failure = e.message
    console.error(e.message)
    process.exitCode = 1
  })
  .finally(() => {
    if (madeOutput)
      fs.writeFileSync(path.join(output, 'execution.json'), JSON.stringify(report, null, 2))
  })
