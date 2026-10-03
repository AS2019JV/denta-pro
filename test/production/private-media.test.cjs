const { test } = require('node:test')
const assert = require('node:assert/strict')
const modulePath = '../../lib/private-media.mjs'
const origin = 'http://127.0.0.1:56321'
const clinic = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const patient = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('private media accepts canonical bucket paths and same-origin legacy URLs', async () => {
  const { privateMediaPath, privateMediaUploadPath } = await import(modulePath)
  assert.equal(privateMediaUploadPath('doctor-avatars', patient, clinic, 'face.png'), `${patient}/face.png`)
  assert.equal(privateMediaUploadPath('patient-avatars', patient, clinic, 'face.png'), `${clinic}/${patient}/face.png`)
  assert.equal(privateMediaUploadPath('clinic-branding', clinic, undefined, 'logo.png'), `${clinic}/logo.png`)
  assert.throws(() => privateMediaUploadPath('patient-avatars', patient, undefined, 'face.png'))
  for (const kind of ['public', 'sign', 'authenticated']) {
    assert.equal(privateMediaPath(`${origin}/storage/v1/object/${kind}/clinic-branding/${clinic}/logo.png?token=old`, 'clinic-branding', origin), `${clinic}/logo.png`)
  }
  assert.equal(privateMediaPath(`${clinic}/${patient}/report.pdf`, 'patient-files', origin), `${clinic}/${patient}/report.pdf`)
})

test('origin, bucket, traversal, malformed and old flat avatar paths fail closed before signing', async () => {
  const { resolvePrivateMedia } = await import(modulePath)
  let calls = 0
  const client = { storage: { from() { calls++; throw Error('must not reach signer') } } }
  for (const raw of [
    'https://external.invalid/face.png',
    `${origin}/storage/v1/object/public/patient-avatars/${clinic}/${patient}/face.png`,
    `${origin}.evil.invalid/storage/v1/object/sign/doctor-avatars/${patient}/face.png`,
    `${origin}/storage/v1/object/public/doctor-avatars/${patient}/%2e%2e/face.png`,
    `${patient}-legacy.png`, `${patient}/../face.png`, `${patient}/face.png?token=old`, `${patient}/face.png#x`,
    `${patient}/a%2fb.png`, '//external.invalid/path', `${patient}\\face.png`, null,
  ]) assert.equal(await resolvePrivateMedia(client, 'doctor-avatars', raw, origin), null)
  assert.equal(calls, 0)
})

test('signing is authenticated, short-lived, validates provider URL and discards late authority results', async () => {
  const { resolvePrivateMedia, PRIVATE_MEDIA_TTL } = await import(modulePath)
  const path = `${clinic}/logo.png`, signedUrl = `${origin}/storage/v1/object/sign/clinic-branding/${path}?token=synthetic`
  let finish, valid = true, calls = []
  const client = { storage: { from(bucket) { return { createSignedUrl(path, ttl) {
    calls.push({ bucket, path, ttl }); return new Promise(resolve => { finish = resolve })
  } } } } }
  const pending = resolvePrivateMedia(client, 'clinic-branding', path, origin, () => valid)
  valid = false; finish({ data: { signedUrl }, error: null })
  assert.equal(await pending, null)
  assert.deepEqual(calls, [{ bucket: 'clinic-branding', path, ttl: PRIVATE_MEDIA_TTL }])
  assert.equal(PRIVATE_MEDIA_TTL, 300)
  assert.equal(await resolvePrivateMedia(client, 'clinic-branding', path, origin, () => false), null)
  assert.equal(calls.length, 1)
  const fake = value => ({ storage: { from() { return { createSignedUrl: async () => value } } } })
  assert.equal(await resolvePrivateMedia(fake({ data: { signedUrl }, error: null }), 'clinic-branding', path, origin), signedUrl)
  assert.equal(await resolvePrivateMedia(fake({ data: { signedUrl }, error: Error('denied') }), 'clinic-branding', path, origin), null)
  assert.equal(await resolvePrivateMedia(fake({ data: { signedUrl: signedUrl.replace(origin, 'https://external.invalid') }, error: null }), 'clinic-branding', path, origin), null)
})

test('a delayed export signs again instead of reusing an expired saved URL', async () => {
  const { resolvePrivateMedia, PRIVATE_MEDIA_TTL } = await import(modulePath)
  let clock = 0, calls = 0
  const path = `${clinic}/logo.png`
  const client = { storage: { from() { return { createSignedUrl: async () => {
    calls++
    return { data: { signedUrl: `${origin}/storage/v1/object/sign/clinic-branding/${path}?token=issued-${clock}` }, error: null }
  } } } } }
  const first = await resolvePrivateMedia(client, 'clinic-branding', path, origin)
  clock = PRIVATE_MEDIA_TTL + 1
  const exported = await resolvePrivateMedia(client, 'clinic-branding', first, origin)
  assert.notEqual(exported, first)
  assert.ok(exported.endsWith('issued-301'))
  assert.equal(calls, 2)
})

test('media hook drops an old same-scope response after revalidation and refreshes a live URL', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
  const media = await import(modulePath)
  const slots = [], effects = [], timers = new Map(), pending = []
  let cursor = 0, timerId = 0
  let auth = { user: { id: patient, role: 'doctor' }, currentClinicId: clinic, isLoading: false, isRevalidating: false, authError: null }
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value }] },
    useEffect(setup, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: setup() } })
      }
    },
  }
  const client = { storage: { from() { return { createSignedUrl(path, ttl) {
    return new Promise(resolve => { pending.push({ path, ttl, resolve }) })
  } } } } }
  const module = { exports: {} }
  const compiled = ts.transpileModule(fs.readFileSync('hooks/use-private-media.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin } },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout(id) { timers.delete(id) },
    require(id) {
      if (id === 'react') return react
      if (id === '@/components/auth-context') return { useAuth: () => auth }
      if (id === '@/lib/supabase') return { supabase: client }
      if (id === '@/lib/private-media.mjs') return media
      throw Error(id)
    },
  })
  const render = () => { cursor = 0; const url = module.exports.usePrivateMediaUrl('clinic-branding', `${clinic}/logo.png`); effects.splice(0).forEach(run => run()); return url }
  const finish = async (index, token) => {
    pending[index].resolve({ data: { signedUrl: `${origin}/storage/v1/object/sign/clinic-branding/${pending[index].path}?token=${token}` }, error: null })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  }
  assert.equal(render(), null)
  auth = { ...auth, isRevalidating: true }; assert.equal(render(), null)
  auth = { ...auth, isRevalidating: false }; assert.equal(render(), null)
  await finish(0, 'obsolete'); assert.equal(render(), null)
  await finish(1, 'current'); assert.ok(render().endsWith('token=current'))
  const timer = [...timers.values()][0]
  assert.equal(timer.delay, 240000)
  timer.fn(); await finish(2, 'refreshed'); assert.ok(render().endsWith('token=refreshed'))
  auth = { ...auth, currentClinicId: patient }; assert.equal(render(), null)
})
