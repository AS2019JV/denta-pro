const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
const pilot = require('./helpers/pilot-policy.cjs')('synthetic')

function load(file, extra = {}, input = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const unexpected = () => { throw new Error('Unexpected provider effect') }
  vm.runInNewContext(code, { module: mod, exports: mod.exports, Response, URL, console: { error() {} },
    process: { env: input }, require(name) {
      if (name === '@/lib/pilot-policy') return pilot
      if (name === '@/lib/clinical-document-principal.mjs') return require('../../lib/clinical-document-principal.mjs')
      if (name === '@/lib/operational-observability') return { observeResponse: (_name, run) => run() }
      if (name === 'next/server') return { NextResponse: {
        json: Response.json, next: () => ({ kind: 'next' }), redirect: url => ({ kind: 'redirect', url: String(url) }),
      } }
      if (Object.hasOwn(extra, name)) return extra[name]
      // Imports are inert; any attempted provider/DB operation fails this test.
      return new Proxy({}, { get: () => unexpected })
    },
  })
  return mod.exports
}

test('pilot actions deny excluded operations before cookie, validation, DB or email effects', async () => {
  for (const [file, method, args] of [
    ['save-prescription', 'savePrescription', [null]],
    ['invite-member', 'inviteTeamMember', [null]], ['settings', 'seedClinicServices', ['clinic']],
    ['manage-invitations', 'listPendingClinicInvitations', ['clinic']],
    ['manage-invitations', 'revokeClinicInvitation', ['clinic', 'invitation']],
  ]) {
    const result = await load(`app/actions/${file}.ts`)[method](...args)
    assert.equal(result.error, pilot.PILOT_UNAVAILABLE, method)
  }
})

test('synthetic enrollment uses verified identity and canonical registration, invite and recovery flows', async () => {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'ordinary-evaluator', email: 'synthetic@example.invalid', email_confirmed_at: 'confirmed' } }, error: null }) },
    rpc: async name => { calls.push(name); return { data: 'clinic', error: null } },
  }
  const { finishVerifiedEnrollment } = load('lib/verified-enrollment.ts')
  for (const type of [undefined, 'signup', 'email']) assert.equal((await finishVerifiedEnrollment(client, type)).success, true)
  assert.equal((await finishVerifiedEnrollment(client, 'invite', 'synthetic-invitation')).success, true)
  assert.equal((await finishVerifiedEnrollment(client, 'recovery')).success, true)
  assert.deepEqual(calls, ['complete_verified_clinic_registration', 'complete_verified_clinic_registration',
    'complete_verified_clinic_registration', 'redeem_verified_clinic_invitation'])
  calls.length = 0
  client.auth.getUser = async () => ({ data: { user: { email: 'unconfirmed@example.invalid' } }, error: null })
  assert.equal((await finishVerifiedEnrollment(client, 'signup')).success, false)
  assert.equal(calls.length, 0)
})

test('pilot document, image and operational-email routes deny before resolving any credentials', async () => {
  for (const file of ['clinical-documents', 'private-media', 'send-email']) {
    const route = load(`app/api/${file}/route.ts`)
    const response = await route.POST(new Request('https://pilot.example.invalid/api/' + file, { method: 'POST' }))
    assert.equal(response.status, 403, file)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await response.json()).error, pilot.PILOT_UNAVAILABLE)
  }
})

test('pilot middleware excludes direct routes without any configured provider and redirects home', async () => {
  const { middleware } = load('middleware.ts')
  const request = pathname => ({ headers: {}, url: 'https://pilot.example.invalid' + pathname, nextUrl: { pathname } })
  for (const pathname of ['/billing', '/recipes', '/api/private-media', '/api/send-email']) {
    assert.equal((await middleware(request(pathname))).status, 403)
  }
  assert.equal((await middleware(request('/api/health'))).kind, 'next')
  assert.equal((await middleware(request('/signup'))).kind, 'next')
  assert.equal((await middleware(request('/'))).url, 'https://pilot.example.invalid/login')
})

test('all PDF publication entry points fail before engine import or clinical reads in the pilot', async () => {
  const pdf = load('lib/pdf-client.ts')
  for (const method of ['generatePrescription', 'exportPersistedPrescription', 'generateHCU033', 'exportPersistedHCU033']) {
    await assert.rejects(pdf[method](), new RegExp(pilot.PILOT_UNAVAILABLE))
  }
})

test('pilot configuration rejects Production, wrong project and unknown modes without exposing values', () => {
  const valid = { NEXT_PUBLIC_SUPABASE_URL: 'https://fbtlldubzomocuhpvweg.supabase.co',
    NEXT_PUBLIC_APP_URL: 'https://pilot.example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_' + 'x'.repeat(24),
    NEXT_PUBLIC_CLINIA_PILOT_MODE: 'synthetic', VERCEL: '1', VERCEL_ENV: 'preview' }
  const { readPublicEnv } = load('lib/env.ts', {}, valid)
  assert.equal(readPublicEnv(valid).NEXT_PUBLIC_SUPABASE_URL, valid.NEXT_PUBLIC_SUPABASE_URL)
  for (const input of [{ ...valid, VERCEL_ENV: 'production' },
    { ...valid, NEXT_PUBLIC_SUPABASE_URL: 'https://other.example.invalid' },
    { ...valid, NEXT_PUBLIC_CLINIA_PILOT_MODE: 'unknown' },
    { ...valid, NEXT_PUBLIC_CLINIA_PILOT_MODE: undefined, VERCEL_GIT_COMMIT_REF: 'codex/clinia-mvp-synthetic' }]) {
    assert.throws(() => readPublicEnv(input), /Invalid public configuration/)
  }
})
