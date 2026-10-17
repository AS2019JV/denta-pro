const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const clinic = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
function harness(options = {}) {
  const state = { adminCreated: 0, calls: [], rows: [{ id, clinic_id: clinic, email: 'staff@example.invalid', role: 'receptionist', status: 'pending', expires_at: '2030-01-01', token: 'synthetic-do-not-return' }], ...options }
  const ordinary = {
    auth: { getUser: async () => state.identity || { data: { user: { email_confirmed_at: 'confirmed' } }, error: null } },
    rpc: async (name, args) => { state.calls.push({ rpc: name, args }); return { data: args.check_clinic_id === clinic ? (state.role ?? 'clinic_owner') : null, error: state.roleError || null } },
  }
  const admin = { from(table) {
    const filters = [], call = { table, filters }; state.calls.push(call)
    const builder = {
      select(columns) { call.columns = columns; return this },
      update(change) { call.change = change; return this },
      eq(column, value) { filters.push([column, value]); return this },
      order(column, direction) { call.order = [column, direction]; return this },
      limit(max) { call.limit = max; return this },
      result() {
        if (state.transportFailure) throw Error('synthetic transport failure')
        if (state.dbError) return { data: null, error: { message: 'synthetic internal secret' } }
        const matching = state.rows.filter(row => filters.every(([column, value]) => row[column] === value))
        if (call.change) { for (const row of matching) Object.assign(row, call.change); return { data: matching[0] ? { id: matching[0].id } : null, error: null } }
        return { data: matching.slice(0, call.limit).map(row => Object.fromEntries(call.columns.split(',').map(column => [column, row[column]]))), error: null }
      },
      maybeSingle() { return Promise.resolve(this.result()) },
      then(resolve, reject) { return Promise.resolve().then(() => this.result()).then(resolve, reject) },
    }
    return builder
  } }
  const module = { exports: {} }
  const source = fs.readFileSync(path.resolve(__dirname, '../../app/actions/manage-invitations.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private' } },
    require(name) {
      if (name === 'next/headers') return { cookies: async () => ({ getAll: () => [], set() {} }) }
      if (name === '@supabase/ssr') return { createServerClient: () => ordinary }
      if (name === '@supabase/supabase-js') return { createClient: () => { state.adminCreated++; return admin } }
      throw Error(name)
    },
  })
  return { state, actions: module.exports }
}
test('unauthenticated, unconfirmed, invalid and non-owner requests never create privileged client', async () => {
  for (const options of [ { identity: { data: { user: null }, error: null } }, { identity: { data: { user: {} }, error: null } }, { role: 'doctor' }, { role: 'receptionist' }, { roleError: {} } ]) {
    const h = harness(options)
    assert.equal((await h.actions.listPendingClinicInvitations(clinic)).success, false)
    assert.equal((await h.actions.revokeClinicInvitation(clinic, id)).success, false)
    assert.equal(h.state.adminCreated, 0)
  }
  const h = harness()
  assert.equal((await h.actions.listPendingClinicInvitations('invalid')).success, false)
  assert.equal((await h.actions.revokeClinicInvitation(clinic, 'invalid')).success, false)
  assert.equal(h.state.adminCreated, 0)
})
test('live role RPC rejects another clinic even for an owner elsewhere', async () => {
  const h = harness()
  assert.equal((await h.actions.listPendingClinicInvitations(other)).success, false)
  assert.equal((await h.actions.revokeClinicInvitation(other, id)).success, false)
  assert.equal(h.state.adminCreated, 0)
  assert.equal(h.state.rows[0].status, 'pending')
})
test('pending list scopes clinic and status and returns no capability or extra authority', async () => {
  const h = harness()
  h.state.rows.push({ ...h.state.rows[0], id: other, clinic_id: other }, { ...h.state.rows[0], id: clinic, status: 'accepted' })
  const result = await h.actions.listPendingClinicInvitations(clinic)
  assert.equal(result.success, true); assert.equal(result.invitations.length, 1)
  assert.deepEqual(Object.keys(result.invitations[0]).sort(), ['email', 'expires_at', 'id', 'role'])
  assert.equal(JSON.stringify(result).includes('synthetic-do-not-return'), false)
  assert.equal(h.state.calls.find(call => call.table).limit, 100)
})
test('revocation closes only its pending reservation and preserves role, membership and clocks', async () => {
  const h = harness(); const original = { ...h.state.rows[0] }
  assert.equal((await h.actions.revokeClinicInvitation(clinic, id)).success, true)
  assert.deepEqual(h.state.rows[0], { ...original, status: 'expired' })
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.calls.find(call => call.change).change)), { status: 'expired' })
  assert.equal((await h.actions.revokeClinicInvitation(clinic, id)).success, false)
})
test('accepted reservation, mismatched ID or cross-clinic row cannot be revoked', async () => {
  for (const change of [{ status: 'accepted' }, { clinic_id: other }, { id: other }]) {
    const h = harness(); Object.assign(h.state.rows[0], change); const before = { ...h.state.rows[0] }
    assert.equal((await h.actions.revokeClinicInvitation(clinic, id)).success, false)
    assert.deepEqual(h.state.rows[0], before)
  }
})
test('concurrent retries mutate once and do not report two successful revocations', async () => {
  const h = harness()
  const results = await Promise.all([h.actions.revokeClinicInvitation(clinic, id), h.actions.revokeClinicInvitation(clinic, id)])
  assert.equal(results.filter(result => result.success).length, 1)
  assert.equal(h.state.rows[0].status, 'expired')
})
test('transport and database failures never claim success or expose provider errors', async () => {
  for (const options of [{ dbError: true }, { transportFailure: true }]) {
    const h = harness(options)
    for (const result of [await h.actions.listPendingClinicInvitations(clinic), await h.actions.revokeClinicInvitation(clinic, id)]) {
      assert.equal(result.success, false)
      assert.equal(JSON.stringify(result).includes('synthetic internal secret'), false)
    }
    assert.equal(h.state.rows[0].status, 'pending')
  }
})
