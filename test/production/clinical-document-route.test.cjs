const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the actual route and delivery handler. Only Auth/database/HTTP providers
// are simulated: these application integration contracts are not hosted RLS proof.
const origin = 'https://candidate.example'
const provider = 'https://isolated.supabase.co'
const scope = { clinicId: '11111111-1111-4111-8111-111111111111', patientId: '22222222-2222-4222-8222-222222222222', fileId: '33333333-3333-4333-8333-333333333333' }
const actor = '44444444-4444-4444-8444-444444444444'
const session = '55555555-5555-4555-8555-555555555555'
const principal = '66666666-6666-4666-8666-666666666666'
const foreign = '77777777-7777-4777-8777-777777777777'
const objectPath = `${scope.clinicId}/${scope.patientId}/immutable.pdf`
const bytes = Buffer.from('synthetic clinical bytes')
const humanToken = 'human.caller.jwt'
const brokerToken = `header.${Buffer.from(JSON.stringify({ role: 'clinia_document_delivery', sub: principal, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.signature`
function request(headers = {}, body = scope) {
  return new Request(`${origin}/api/clinical-documents`, { method: 'POST', headers: {
    origin, 'content-type': 'application/json', ...headers,
  }, body: JSON.stringify(body) })
}
async function harness(options = {}) {
  const delivery = await import('../../lib/clinical-document-delivery.mjs')
  const principalCache = await import('../../lib/clinical-document-principal.mjs')
  const state = {
    userId: actor, sessionId: session, sessionActive: true, banned: false,
    role: 'doctor', membershipActive: true, subscription: true,
    profile: { id: actor, status: 'active', deleted_at: null },
    file: { id: scope.fileId, clinic_id: scope.clinicId, patient_id: scope.patientId, deleted_at: null, file_path: objectPath, name: 'clinical.pdf' },
    patient: { id: scope.patientId, clinic_id: scope.clinicId, deleted_at: null },
    brokerActive: true, brokerUser: principal, brokerToken,
    clients: [], identities: [], claims: [], queries: [], rpc: [], fetches: [], logins: [], cookieWrites: [], cookieReads: 0,
    ...options,
  }
  const store = { getAll() { state.cookieReads++; return [{ name: 'synthetic-session', value: 'synthetic-cookie' }] },
    set(...values) { state.cookieWrites.push(values) } }
  function caller(kind, config) {
    return {
      auth: {
        async getUser(token) {
          state.identities.push({ kind, token })
          if (state.refreshCookies) config.cookies.setAll([{ name: 'synthetic-session', value: 'refreshed-cookie', options: { httpOnly: true } }])
          return { data: { user: state.userId ? { id: state.userId } : null }, error: state.identityError || null }
        },
        async getClaims(token) {
          state.claims.push({ kind, token })
          state.onClaims?.()
          if (state.claimsThrow) throw state.claimsThrow
          return { data: { claims: { sub: state.userId, session_id: state.sessionId, role: state.claimRole || 'authenticated' } }, error: state.claimsError || null }
        },
      },
      async rpc(name, args) {
        state.rpc.push({ kind, name, args })
        const data = name === 'clinia_session_active' ? state.sessionActive && !state.banned
          : name === 'get_clinic_member_role' ? (state.membershipActive && args.check_clinic_id === scope.clinicId ? state.role : null)
          : name === 'check_subscription_active' ? state.subscription : undefined
        if (name === 'clinia_audit_document_delivery') {
          assert.equal(kind==='cookie'||kind==='bearer',true)
          assert.deepEqual(JSON.parse(JSON.stringify(args)),{p_clinic_id:scope.clinicId,p_patient_id:scope.patientId,p_file_id:scope.fileId,p_path:objectPath})
          return {data:state.auditActive!==false,error:state.auditError||null}
        }
        assert.notEqual(data, undefined, name)
        return { data, error: state.rpcError || null }
      },
      from(table) {
        const query = { kind, table, columns: null, filters: [] }; state.queries.push(query)
        const builder = {
          select(columns) { query.columns = columns; return this },
          eq(key, value) { query.filters.push(['eq', key, value]); return this },
          is(key, value) { query.filters.push(['is', key, value]); return this },
          async maybeSingle() {
            const row = { profiles: state.profile, patient_files: state.file, patients: state.patient }[table]
            assert.ok(['profiles', 'patient_files', 'patients'].includes(table), table)
            return { data: row && query.filters.every(([, key, value]) => row[key] === value) ? { ...row } : null,
              error: state.queryError?.table === table ? state.queryError : null }
          },
        }
        return builder
      },
    }
  }
  const broker = {
    auth: {
      async signInWithPassword(input) { state.logins.push(input); return { data: {
        user: { id: state.brokerUser }, session: { access_token: state.brokerToken },
      }, error: state.loginError || null } },
      async getSession() { return { data: { session: { access_token: state.brokerToken } }, error: null } },
    },
    async rpc(name) { assert.equal(name, 'clinia_document_delivery_active'); state.rpc.push({ kind: 'broker', name }); return { data: state.brokerActive, error: state.brokerError || null } },
  }
  const env = { CLINIA_DOCUMENT_DELIVERY_EMAIL: 'broker@example.invalid', CLINIA_DOCUMENT_DELIVERY_PASSWORD: 'synthetic-password', CLINIA_DOCUMENT_DELIVERY_USER_ID: principal, ...(options.env || {}) }
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../app/api/clinical-documents/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, process: { env }, Buffer, URL, AbortSignal,
    fetch: async (url, init) => {
      state.fetches.push({ url: String(url), init })
      if (state.onFetch) await state.onFetch(state)
      return new Response(bytes)
    },
    require(name) {
      if (name === 'server-only') return {}
      if (name === '@/lib/env') return { env: { NEXT_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SUPABASE_URL: provider, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon' } }
      if (name === '@/lib/clinical-document-delivery.mjs') return delivery
      if (name === '@/lib/clinical-document-principal.mjs') return principalCache
      if (name === 'next/headers') return { cookies: async () => store }
      if (name === '@supabase/ssr') return { createServerClient(url, key, config) {
        assert.equal(url, provider); assert.equal(key, 'synthetic-anon'); state.clients.push({ kind: 'cookie', config }); config.cookies.getAll(); return caller('cookie', config)
      } }
      if (name === '@supabase/supabase-js') return { createClient(url, key, config) {
        assert.equal(url, provider); assert.equal(key, 'synthetic-anon')
        const header = config.global.headers?.Authorization
        const kind = header === `Bearer ${humanToken}` ? 'bearer' : header ? 'broker-rpc' : 'broker-login'; state.clients.push({ kind, config })
        return kind.startsWith('broker') ? broker : caller(kind, config)
      } }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return { state, POST: module.exports.POST }
}
async function deny(response, status = 404) {
  assert.equal(response.status, status)
  assert.equal(await response.text(), 'No se pudo entregar el documento.')
  assert.match(response.headers.get('cache-control'), /no-store/)
}

test('actual cookie route checks exact live scope twice and forwards only isolated broker authorization', async () => {
  const h = await harness({ refreshCookies: true }), response = await h.POST(request())
  assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  assert.deepEqual(h.state.clients.map(c => c.kind), ['cookie', 'broker-login', 'broker-rpc'])
  assert.equal(h.state.cookieReads, 1); assert.equal(h.state.cookieWrites.length, 2)
  assert.deepEqual(h.state.identities, [{ kind: 'cookie', token: undefined }, { kind: 'cookie', token: undefined }])
  assert.equal(h.state.claims.length, 2)
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(h.state.queries.slice(i * 3, i * 3 + 3).map(q => [q.table, q.columns, q.filters]), [
      ['profiles', 'id', [['eq', 'id', actor], ['eq', 'status', 'active'], ['is', 'deleted_at', null]]],
      ['patient_files', 'id,file_path,name', [['eq', 'id', scope.fileId], ['eq', 'clinic_id', scope.clinicId], ['eq', 'patient_id', scope.patientId], ['is', 'deleted_at', null]]],
      ['patients', 'id', [['eq', 'id', scope.patientId], ['eq', 'clinic_id', scope.clinicId], ['is', 'deleted_at', null]]],
    ])
  }
  const rpcs = h.state.rpc.filter(r => r.kind !== 'broker' && r.name !== 'clinia_audit_document_delivery')
  assert.deepEqual(rpcs.map(r => r.name), ['clinia_session_active', 'get_clinic_member_role', 'check_subscription_active', 'clinia_session_active', 'get_clinic_member_role', 'check_subscription_active'])
  for (const r of rpcs.filter(r => r.name !== 'clinia_session_active')) assert.deepEqual(JSON.parse(JSON.stringify(r.args)), { check_clinic_id: scope.clinicId })
  const upstream = h.state.fetches[0]
  assert.equal(upstream.url, `${provider}/storage/v1/object/authenticated/patient-files/${objectPath}`)
  assert.equal(upstream.init.headers.Authorization, `Bearer ${brokerToken}`)
  assert.equal(upstream.init.headers.apikey, 'synthetic-anon'); assert.equal(upstream.init.cache, 'no-store'); assert.equal(upstream.init.redirect, 'error')
  assert.ok(upstream.init.signal instanceof AbortSignal)
})

test('explicit Bearer uses the exact token for identity, claims and ordinary RLS without cookie fallback', async () => {
  const h = await harness(), input = request({ authorization: `Bearer ${humanToken}` }); input.headers.delete('origin')
  assert.equal((await h.POST(input)).status, 200)
  assert.deepEqual(h.state.clients.map(c => c.kind), ['bearer', 'broker-login', 'broker-rpc']); assert.equal(h.state.cookieReads, 0)
  assert.equal(h.state.clients[0].config.global.headers.Authorization, `Bearer ${humanToken}`)
  for (const call of [...h.state.identities, ...h.state.claims]) assert.equal(call.token, humanToken)
  assert.equal(h.state.fetches[0].init.headers.Authorization, `Bearer ${brokerToken}`)
  assert.notEqual(h.state.fetches[0].init.headers.Authorization, `Bearer ${humanToken}`)
})

test('invalid or rejected explicit Bearer never falls back to a valid browser cookie', async () => {
  for (const header of ['Basic synthetic', 'Bearer ', 'Bearer invalid token']) {
    const h = await harness(); await deny(await h.POST(request({ authorization: header })), 401); assert.equal(h.state.clients.length, 0)
  }
  const h = await harness({ identityError: { message: 'raw token rejection' } })
  await deny(await h.POST(request({ authorization: `Bearer ${humanToken}` })))
  assert.deepEqual(h.state.clients.map(c => c.kind), ['bearer']); assert.equal(h.state.fetches.length, 0)
})

test('ordinary live denial blocks broker login and Storage fetch for each concrete revoked state', async () => {
  for (const [label, change] of [
    ['removed membership', s => { s.membershipActive = false }], ['demoted', s => { s.role = 'receptionist' }],
    ['logout', s => { s.sessionActive = false }], ['ban', s => { s.banned = true }],
    ['expired JWT', s => { s.claimsError = { message: 'expired synthetic JWT' } }],
    ['suspended profile', s => { s.profile.status = 'suspended' }], ['deleted profile', s => { s.profile.deleted_at = '2026-10-03' }],
    ['expired subscription', s => { s.subscription = false }], ['deleted file', s => { s.file.deleted_at = '2026-10-03' }],
    ['deleted patient', s => { s.patient.deleted_at = '2026-10-03' }], ['missing session claim', s => { s.sessionId = null }],
  ]) {
    const h = await harness(); change(h.state); await deny(await h.POST(request()))
    assert.equal(h.state.logins.length, 0, label); assert.equal(h.state.fetches.length, 0, label)
  }
})

test('plain SDK claims exceptions fail closed before clinical queries, broker login or Storage', async () => {
  for (const message of ['JWT has expired', 'Missing exp claim', 'Claims verification unavailable']) {
    const h = await harness({ claimsThrow: new Error(message) })
    await deny(await h.POST(request({ authorization: `Bearer ${humanToken}` })))
    assert.equal(h.state.claims.length, 1)
    assert.equal(h.state.queries.length, 0); assert.equal(h.state.rpc.length, 0)
    assert.equal(h.state.logins.length, 0); assert.equal(h.state.fetches.length, 0)
  }
  const rejected = await harness({ identityError: { message: 'Rejected identity' }, claimsThrow: new Error('Must not run') })
  await deny(await rejected.POST(request({ authorization: `Bearer ${humanToken}` })))
  assert.equal(rejected.state.claims.length, 0)
  const cancellation = new AbortController()
  const aborted = await harness({ onClaims: () => cancellation.abort(), claimsThrow: new Error('Canceled verification') })
  await deny(await aborted.POST(new Request(request({ authorization: `Bearer ${humanToken}` }), { signal: cancellation.signal })), 504)
  assert.equal(aborted.state.fetches.length, 0)
  const revokedDuringFetch = await harness({ onFetch: state => { state.claimsThrow = new Error('JWT has expired') } })
  await deny(await revokedDuringFetch.POST(request({ authorization: `Bearer ${humanToken}` })))
  assert.equal(revokedDuringFetch.state.fetches.length, 1); assert.equal(revokedDuringFetch.state.claims.length, 2)
  assert.equal(revokedDuringFetch.state.rpc.some(call => call.name === 'clinia_audit_document_delivery'), false)
})

test('foreign clinic, patient and file scopes cannot access the legitimate object', async () => {
  for (const field of ['clinicId', 'patientId', 'fileId']) {
    const h = await harness(); await deny(await h.POST(request({}, { ...scope, [field]: foreign })))
    assert.equal(h.state.logins.length, 0); assert.equal(h.state.fetches.length, 0)
  }
})

test('the same original Bearer succeeds once then denies after live logout or removal', async () => {
  for (const change of [s => { s.sessionActive = false }, s => { s.membershipActive = false }]) {
    const h = await harness(), input = request({ authorization: `Bearer ${humanToken}` })
    assert.equal((await h.POST(input.clone())).status, 200); change(h.state)
    await deny(await h.POST(input.clone())); assert.equal(h.state.fetches.length, 1)
    assert.ok(h.state.identities.every(c => c.token === humanToken))
  }
})

test('revocation committed during upstream fetch discards buffered clinical bytes', async () => {
  for (const change of [s => { s.membershipActive = false }, s => { s.role = 'receptionist' }, s => { s.sessionActive = false },
    s => { s.banned = true }, s => { s.subscription = false }, s => { s.profile.status = 'suspended' },
    s => { s.file.deleted_at = '2026-10-03' }, s => { s.patient.deleted_at = '2026-10-03' }, s => { s.file.file_path = objectPath.replace('immutable', 'changed') }]) {
    const h = await harness({ onFetch: change }); await deny(await h.POST(request()))
    assert.equal(h.state.fetches.length, 1); assert.equal(h.state.identities.length, 2)
  }
})

test('user and session identity remain pinned across buffering even when both new identities are otherwise valid', async () => {
  for (const change of [s => { s.userId = foreign; s.profile.id = foreign }, s => { s.sessionId = foreign }]) {
    const h = await harness({ onFetch: change }); await deny(await h.POST(request()))
    assert.equal(h.state.identities.length, 2); assert.equal(h.state.queries.length, 3)
  }
})

test('missing broker configuration or incorrect broker identity/role fails closed without forwarding human authority', async () => {
  for (const key of ['CLINIA_DOCUMENT_DELIVERY_EMAIL', 'CLINIA_DOCUMENT_DELIVERY_PASSWORD', 'CLINIA_DOCUMENT_DELIVERY_USER_ID']) {
    const h = await harness({ env: { [key]: '' } }); await deny(await h.POST(request()), 503)
    assert.equal(h.state.logins.length, 0); assert.equal(h.state.fetches.length, 0)
  }
  for (const options of [{ brokerUser: foreign }, { brokerToken: humanToken }, { loginError: { message: 'raw broker details' } }, { brokerActive: false }]) {
    const h = await harness(options); await deny(await h.POST(request()), 503); assert.equal(h.state.fetches.length, 0)
  }
})

test('broker revocation during fetch denies publication and query/RPC errors expose no provider details', async () => {
  const revoked = await harness({ onFetch: s => { s.brokerActive = false } })
  await deny(await revoked.POST(request()), 503); assert.equal(revoked.state.fetches.length, 1)
  for (const options of [{ rpcError: { message: 'raw SQL detail' } }, { queryError: { table: 'patient_files', message: 'raw clinical detail' } }]) {
    const h = await harness(options); await deny(await h.POST(request())); assert.equal(h.state.fetches.length, 0)
  }
})
test('actual route cannot publish if its ordinary-actor audit fails',async()=>{
  for(const options of [{auditActive:false},{auditError:{message:'raw audit detail'}}]){
    const h=await harness(options);await deny(await h.POST(request()),503)
    assert.equal(h.state.fetches.length,1);assert.equal(h.state.rpc.filter(x=>x.name==='clinia_audit_document_delivery').length,1)
  }
})
