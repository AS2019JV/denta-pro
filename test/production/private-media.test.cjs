const { test } = require('node:test')
const assert = require('node:assert/strict')
const modulePath = '../../lib/private-media.mjs'
const origin = 'http://127.0.0.1:56321'
const clinic = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const patient = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('private media preserves canonical bucket upload paths and same-origin historical references', async () => {
  const { privateMediaPath, privateMediaUploadPath } = await import(modulePath)
  assert.equal(privateMediaUploadPath('doctor-avatars', patient, clinic, 'face.png'), `${patient}/face.png`)
  assert.equal(privateMediaUploadPath('patient-avatars', patient, clinic, 'face.png'), `${clinic}/${patient}/face.png`)
  assert.equal(privateMediaUploadPath('clinic-branding', clinic, undefined, 'logo.png'), `${clinic}/logo.png`)
  assert.throws(() => privateMediaUploadPath('patient-avatars', patient, undefined, 'face.png'))
  for (const access of ['public', 'sign', 'authenticated']) {
    assert.equal(privateMediaPath(`${origin}/storage/v1/object/${access}/clinic-branding/${clinic}/logo.png?token=old`, 'clinic-branding', origin), `${clinic}/logo.png`)
  }
  assert.equal(privateMediaPath(`${clinic}/${patient}/report.pdf`, 'patient-files', origin), `${clinic}/${patient}/report.pdf`)
})

test('origin, bucket, traversal, malformed and old flat avatar paths fail closed', async () => {
  const { privateMediaPath } = await import(modulePath)
  for (const raw of ['https://external.invalid/face.png', `${origin}/storage/v1/object/public/patient-avatars/${clinic}/${patient}/face.png`,
    `${origin}.evil.invalid/storage/v1/object/sign/doctor-avatars/${patient}/face.png`, `${origin}/storage/v1/object/public/doctor-avatars/${patient}/%2e%2e/face.png`,
    `${patient}-legacy.png`,`${patient}/../face.png`,`${patient}/face.png?token=old`,`${patient}/face.png#x`,`${patient}/a%2fb.png`,
    '//external.invalid/path', `${patient}\\face.png`, null]) assert.equal(privateMediaPath(raw, 'doctor-avatars', origin), null)
})

function hookHarness() {
  const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
  const slots = [], effects = [], timers = new Map(), pending = [], revoked = [], created = []
  let cursor = 0, timerId = 0, urlId = 0
  let auth = { user: { id: patient, role: 'doctor' }, currentClinicId: clinic, isLoading: false, isRevalidating: false, authError: null }
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value }] },
    useEffect(setup, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, setup, cleanup: setup() } })
      }
    },
  }
  const module = { exports: {} }
  const compiled = ts.transpileModule(fs.readFileSync('hooks/use-private-media.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, AbortController,
    URL: { createObjectURL(blob) { const url = `blob:synthetic-${++urlId}`; created.push({ blob, url }); return url }, revokeObjectURL(url) { revoked.push(url) } },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout(id) { timers.delete(id) },
    require(id) {
      if (id === 'react') return react
      if (id === '@/components/auth-context') return { useAuth: () => auth }
      if (id === '@/lib/private-media-client.mjs') return { fetchPrivateMedia(scope, signal, current) {
        return new Promise((resolve,reject) => { pending.push({ scope, signal, current, resolve, reject }) })
      } }
      throw Error(id)
    },
  })
  return {
    pending, timers, created, revoked, setAuth(value) { auth = { ...auth, ...value } },
    render(reference = `${clinic}/logo.png`) { cursor = 0; const url = module.exports.usePrivateMediaUrl('clinic-logo', clinic, reference); effects.splice(0).forEach(run => run()); return url },
    async finish(index, blob = new Blob(['synthetic-raster'], { type: 'image/png' })) { pending[index].resolve(blob); await new Promise(setImmediate) },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    strictRemount() { for (const slot of slots) { if (slot?.setup) { slot.cleanup?.(); slot.cleanup = slot.setup() } } },
  }
}

test('hook discards same-scope late responses, revokes replaced URLs and denies publication after authority changes', async () => {
  const h = hookHarness(); assert.equal(h.render(), null)
  assert.deepEqual(JSON.parse(JSON.stringify(h.pending[0].scope)), { kind: 'clinic-logo', clinicId: clinic, entityId: clinic })
  h.setAuth({ isRevalidating: true }); assert.equal(h.render(), null); assert.equal(h.pending[0].signal.aborted, true)
  h.setAuth({ isRevalidating: false }); assert.equal(h.render(), null)
  await h.finish(0); assert.equal(h.render(), null); assert.equal(h.created.length, 0)
  await h.finish(1); assert.equal(h.render(), 'blob:synthetic-1')
  const timer = [...h.timers.values()][0]; assert.equal(timer.delay, 60000); timer.fn()
  await h.finish(2); assert.equal(h.render(), 'blob:synthetic-2'); assert.deepEqual(h.revoked, ['blob:synthetic-1'])
  h.setAuth({ currentClinicId: patient }); assert.equal(h.render(), null); assert.ok(h.revoked.includes('blob:synthetic-2'))
  await h.finish(3); assert.equal(h.created.length, 3)
  h.setAuth({ user: null }); assert.equal(h.render(), null); assert.ok(h.revoked.includes('blob:synthetic-3'))
})

test('Strict Mode cleanup and unmount abort old fetches even when the publication token is reused', async () => {
  const h = hookHarness(); h.render(); h.strictRemount()
  assert.equal(h.pending[0].signal.aborted, true); assert.equal(h.pending[1].signal.aborted, false)
  await h.finish(0); assert.equal(h.created.length, 0)
  await h.finish(1); assert.equal(h.render(), 'blob:synthetic-1')
  h.unmount(); assert.equal(h.pending[1].signal.aborted, true); assert.deepEqual(h.revoked, ['blob:synthetic-1'])
})

test('reference replacement invalidates immediately and rejected refresh removes the previous Blob URL', async () => {
  const h = hookHarness(); h.render(); await h.finish(0); assert.equal(h.render(), 'blob:synthetic-1')
  assert.equal(h.render(`${clinic}/new-logo.png`), null); assert.deepEqual(h.revoked, ['blob:synthetic-1'])
  await h.finish(1); assert.equal(h.render(`${clinic}/new-logo.png`), 'blob:synthetic-2')
  const timer = [...h.timers.values()].at(-1); timer.fn(); h.pending[2].reject(Error('Denied'))
  await new Promise(setImmediate); assert.equal(h.render(`${clinic}/new-logo.png`), null)
  assert.ok(h.revoked.includes('blob:synthetic-2'))
})
