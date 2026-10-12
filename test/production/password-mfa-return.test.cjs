const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, requireModule) {
  const module = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(output, { module, exports: module.exports, require: requireModule, URLSearchParams,
    window: { location: { search: testSearch } }, setTimeout() {} })
  return module.exports
}
let testSearch = ''
const policy = load('lib/password-update.ts', () => { throw Error('Unexpected dependency') })
function fixture(aal = 'aal1', verified = true) {
  const state = { aal, next: verified ? 'aal2' : 'aal1', verified, updates: 0, enrollments: 0, refreshes: 0 }
  const client = { auth: {
    getUser: async () => ({ data: { user: state.noUser ? null : { id: 'recipient', email_confirmed_at: 'confirmed' } }, error: state.identityError }),
    getClaims: async () => ({ data: { claims: { sub: state.subject || 'recipient', role: 'authenticated', aal: state.aal } }, error: null }),
    updateUser: async () => { state.updates++; return { error: state.updateError } },
    refreshSession: async () => { state.refreshes++; return { data: { session: {} }, error: null } },
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.current || state.aal, nextLevel: state.next }, error: state.assuranceError }),
      listFactors: async () => ({ data: { all: state.listMissing ? undefined : [{ id: 'existing-factor', factor_type: 'totp', status: state.verified ? 'verified' : 'unverified' }],
        totp: state.verified ? [{ id: 'existing-factor', status: 'verified' }] : [] }, error: state.listError }),
      challenge: async () => ({ data: { id: 'synthetic-challenge' }, error: null }),
      verify: async () => { if (!state.verificationError) state.aal = 'aal2'; return { error: state.verificationError } },
      enroll: async () => { state.enrollments++; throw Error('Should not enroll existing factor') },
    },
  } }
  return { state, client }
}
function page(file, h, search = '') {
  testSearch = search
  let cursor = 0, effects = [], tree
  const state = [], routes = []
  const router = { replace: route => routes.push(route), push: route => routes.push(route) }
  const react = {
    useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value }] },
    useRef: current => ({ current }), useEffect: effect => { effects.push(effect) },
  }
  const jsx = (type, props) => ({ type, props })
  const component = load(file, id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'next/navigation') return { useRouter: () => router }
    if (id === '@/lib/supabase') return { supabase: h.client }
    if (id === '@/lib/password-update') return policy
    if (id === '@/components/auth-context') return { useAuth: () => ({ refreshProfile: async () => {} }) }
    if (id === '@/lib/mfa-enrollment') return {}
    if (id === 'framer-motion') return { motion: { div: 'motion-div' } }
    return new Proxy({}, { get: (_, name) => name })
  }).default
  const render = () => { cursor = 0; effects = []; tree = component(); return tree }
  const find = (predicate, node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const child of node) { const result = find(predicate, child); if (result) return result } }
    else { if (predicate(node)) return node; return find(predicate, node.props?.children) }
  }
  render()
  return { state, routes, render, find: predicate => find(predicate, tree), mount: async () => { effects.forEach(effect => effect()); for (let n = 0; n < 25; n++) await Promise.resolve(); render() },
    submit: () => find(node => node.type === 'form', tree).props.onSubmit({ preventDefault() {} }) }
}
const passwordPage = 'app/(auth)/update-password/page.tsx', mfaPage = 'app/(auth)/auth/mfa/page.tsx'

test('recovery session with existing MFA routes to challenge before password update', async () => {
  const h = fixture(), p = page(passwordPage, h)
  await p.mount()
  assert.deepEqual(p.routes, ['/auth/mfa?next=/update-password'])
  assert.equal(h.state.updates, 0); assert.equal(h.state.enrollments, 0)
})

test('password submit rechecks factor/session changes after an initially ready page', async () => {
  const h = fixture('aal2'), p = page(passwordPage, h)
  await p.mount(); p.state[0] = p.state[1] = 'synthetic-password-only'; p.render()
  h.state.aal = 'aal1'
  await p.submit()
  assert.equal(h.state.updates, 0); assert.deepEqual(p.routes, ['/auth/mfa?next=/update-password'])
  assert.equal(p.state[0], ''); assert.equal(p.state[1], '')
})

test('verified AAL2 submits to provider; concurrent insufficient_aal clears fields and rechallenges', async () => {
  for (const concurrentError of [false, true]) {
    const h = fixture('aal2'), p = page(passwordPage, h)
    await p.mount(); p.state[0] = p.state[1] = 'synthetic-password-only'; p.render()
    if (concurrentError) h.state.updateError = { code: 'insufficient_aal' }
    await p.submit(); assert.equal(h.state.updates, 1)
    if (concurrentError) { assert.deepEqual(p.routes, ['/auth/mfa?next=/update-password']); assert.equal(p.state[0], ''); assert.equal(p.state[1], '') }
    else assert.equal(p.state[4], true)
  }
})

test('first invitation without verified factor may set password; inconsistent or unavailable evidence fails closed', async () => {
  assert.equal(await policy.passwordUpdateAccess(fixture('aal1', false).client), 'ready')
  for (const change of [s => s.noUser = true, s => s.subject = 'other', s => s.identityError = {},
    s => s.assuranceError = {}, s => s.listError = {}, s => s.listMissing = true, s => s.current = 'aal2',
    s => { s.aal = 'aal2'; s.verified = false; s.next = 'aal1' }, s => s.next = 'aal1']) {
    const h = fixture(); change(h.state)
    assert.notEqual(await policy.passwordUpdateAccess(h.client), 'ready'); assert.equal(h.state.updates, 0)
  }
})

test('already verified MFA returns only to fixed password route or default dashboard', async () => {
  for (const [query, expected] of [['?next=/update-password', '/update-password'], ['', '/dashboard'],
    ['?next=https://attacker.invalid', '/dashboard'], ['?next=//attacker.invalid', '/dashboard'],
    ['?next=/update-password%3Fnext=https://attacker.invalid', '/dashboard']]) {
    const h = fixture('aal2'), p = page(mfaPage, h, query); await p.mount()
    assert.deepEqual(p.routes, [expected]); assert.equal(h.state.enrollments, 0)
  }
})

test('existing TOTP challenge returns to password after verified AAL2 without new QR; failure cannot navigate', async () => {
  for (const fail of [false, true]) {
    const h = fixture(), p = page(mfaPage, h, '?next=/update-password'); await p.mount()
    p.find(node => node.props?.id === 'totp-code').props.onChange({ target: { value: '999999' } }); p.render() // Synthetic mock only, never a live TOTP.
    if (fail) h.state.verificationError = { message: 'rejected' }
    await p.submit(); assert.equal(h.state.enrollments, 0)
    assert.deepEqual(p.routes, fail ? [] : ['/update-password']); assert.equal(h.state.refreshes, fail ? 0 : 1)
  }
})
