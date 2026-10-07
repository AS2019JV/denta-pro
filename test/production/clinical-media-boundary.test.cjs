'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const limit = 4_000_000
const scope = {
  clinicId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  fileId: '33333333-3333-4333-8333-333333333333',
}
const origin = 'https://candidate.example'
const objectPath = `${scope.clinicId}/${scope.patientId}/document.pdf`
const request = () => new Request(origin + '/api/clinical-documents', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(scope),
})

async function deliveryHarness(download) {
  const { documentDeliveryHandler } = await import('../../lib/clinical-document-delivery.mjs')
  let auditCalls = 0
  const run = documentDeliveryHandler({
    appOrigin: origin, providerOrigin: 'https://isolated.supabase.co',
    authority: async () => ({ authorize: async () => ({ path: objectPath, userId: 'doctor', sessionId: 'live', name: 'document.pdf' }) }),
    download, deliveryActive: async () => true,
    recordAccess: async () => { auditCalls++; return true },
  })
  return { run, auditCalls: () => auditCalls }
}

test('delivery publishes a four-million-byte document but withholds one additional byte', async () => {
  const payload = new Uint8Array(limit).fill(0x5a)
  const accepted = await deliveryHarness(async () => new Response(payload, { headers: { 'Content-Length': String(limit) } }))
  const response = await accepted.run(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-length'), String(limit))
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), payload)
  assert.equal(accepted.auditCalls(), 1)
  for (const declared of [String(limit + 1), '1']) {
    const oversized = await deliveryHarness(async () => new Response(new Uint8Array(limit + 1), { headers: { 'Content-Length': declared } }))
    const denied = await oversized.run(request())
    assert.equal(denied.status, 503)
    assert.equal(await denied.text(), 'No se pudo entregar el documento.')
    assert.equal(oversized.auditCalls(), 0)
  }
})

test('document client accepts the exact bound and rejects oversized headers or a lying stream', async () => {
  const { fetchClinicalDocument } = await import('../../lib/clinical-document-client.mjs')
  const fetchDocument = fetcher => fetchClinicalDocument(scope, new AbortController().signal, () => true, fetcher)
  const blob = await fetchDocument(async () => new Response(new Uint8Array(limit), { headers: { 'Content-Length': String(limit) } }))
  assert.equal(blob.size, limit)
  let canceled = false
  const stream = new ReadableStream({ cancel() { canceled = true } })
  await assert.rejects(fetchDocument(async () => new Response(stream, { headers: { 'Content-Length': String(limit + 1) } })), /bound/)
  assert.equal(canceled, true)
  await assert.rejects(fetchDocument(async () => new Response(new Uint8Array(limit + 1), { headers: { 'Content-Length': String(limit) } })), /bound/)
})

function load(file, mocks) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URL, Buffer, crypto: require('node:crypto'),
    console: { log() {}, error() {}, warn() {} },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only' }, cwd: () => root },
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (id.startsWith('@/lib/')) return load(id.slice(2) + '.ts', mocks)
      return require(id)
    },
  }, { filename: file })
  return module.exports
}

function findNode(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) { const found = findNode(child, predicate); if (found) return found }
  } else if (node && typeof node === 'object') {
    if (predicate(node)) return node
    return findNode(node.props?.children, predicate)
  }
  return null
}

async function componentHarness(file, exportedName, props) {
  const state = { uploads: [], registrations: [], errors: [] }
  const query = {
    select() { return this }, eq() { return this }, is() { return this }, order() { return this },
    insert: async record => { state.registrations.push(record); return { error: null } },
    then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject) },
  }
  const ui = new Proxy({}, { get: (_, name) => name })
  const mocks = {
    react: { useState: initial => [initial, () => {}], useRef: current => ({ current }), useEffect() {}, useCallback: callback => callback },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'lucide-react': ui,
    sonner: { toast: { error: message => state.errors.push(message), success() {}, info() {} } },
    '@/lib/supabase': { supabase: { from: () => query, storage: { from: bucket => ({ upload: async (path, file) => {
      state.uploads.push({ bucket, path, file }); return { error: null }
    } }) } } },
    '@/components/auth-context': { useAuth: () => ({ user: { id: scope.patientId, role: 'doctor' }, currentClinicId: scope.clinicId, isLoading: false, isRevalidating: false, authError: null }) },
    '@/hooks/use-private-media': { usePrivateMediaUrl: () => null },
    '@/lib/private-media.mjs': await import('../../lib/private-media.mjs'),
    '@/lib/clinical-media-limits.mjs': await import('../../lib/clinical-media-limits.mjs'),
    '@/lib/clinical-document-client.mjs': await import('../../lib/clinical-document-client.mjs'),
  }
  for (const name of ['avatar', 'card', 'button', 'input', 'badge', 'scroll-area']) mocks['@/components/ui/' + name] = ui
  const component = load(file, mocks)[exportedName]
  return { state, tree: component(props) }
}

test('actual avatar input offers PNG/JPEG/WebP and rejects disallowed types or one extra byte before upload', async () => {
  const h = await componentHarness('components/avatar-upload.tsx', 'AvatarUpload', { uid: scope.patientId, url: null, bucket: 'doctor-avatars', onUpload() {} })
  const input = findNode(h.tree, node => node.type === 'input' && node.props.type === 'file')
  assert.equal(input.props.accept, 'image/png,image/jpeg,image/webp')
  for (const type of ['image/svg+xml', 'image/gif', 'application/pdf', '']) {
    await input.props.onChange({ target: { files: [{ type, size: 1, name: 'image.png' }] } })
  }
  await input.props.onChange({ target: { files: [{ type: 'image/png', size: limit + 1, name: 'image.png' }] } })
  assert.equal(h.state.uploads.length, 0)
  assert.equal(h.state.errors.length, 5)
  assert.match(h.state.errors.at(-1), /4 MB/)
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    await input.props.onChange({ target: { files: [{ type, size: limit, name: 'image.png' }] } })
  }
  assert.equal(h.state.uploads.length, 3)
})

test('actual patient file selection and drag/drop share the same bound and explain rejection', async () => {
  const h = await componentHarness('components/patient-files.tsx', 'PatientFiles', { patientId: scope.patientId })
  const input = findNode(h.tree, node => node.type === 'input' && node.props.type === 'file')
  const drop = findNode(h.tree, node => typeof node.props?.onDrop === 'function')
  const oversized = { type: 'application/pdf', size: limit + 1, name: 'document.pdf' }
  await input.props.onChange({ target: { files: [oversized] } })
  await drop.props.onDrop({ preventDefault() {}, dataTransfer: { files: [oversized] } })
  assert.equal(h.state.uploads.length, 0)
  assert.equal(h.state.registrations.length, 0)
  assert.equal(h.state.errors.length, 2)
  for (const message of h.state.errors) assert.match(message, /4 MB/)
  await input.props.onChange({ target: { files: [{ ...oversized, size: limit }] } })
  assert.equal(h.state.uploads.length, 1)
  assert.equal(h.state.registrations.length, 1)
})

test('registration rejects every supplied logo before budget, Auth, database or Storage effects', async () => {
  let effects = 0
  const action = load('app/actions/register-clinic.ts', {
    '@supabase/supabase-js': { createClient() { effects++; throw Error('No privileged effects expected') } },
    'next/headers': { headers() { effects++; throw Error('No budget expected') } },
    '@/lib/server-email-gate': { consumeEmailBudget() { effects++; throw Error('No budget expected') } },
  })
  for (const logo of ['', 'unexpected', new Blob([]), new Blob(['synthetic'], { type: 'image/png' }), new Blob(['<svg/>'], { type: 'image/svg+xml' })]) {
    const form = new FormData()
    for (const [key, value] of Object.entries({ firstName: 'Synthetic', lastName: 'Person', email: 'synthetic@example.invalid', password: 'synthetic-password', practiceName: 'Synthetic clinic', practiceSize: 'small' })) form.set(key, value)
    form.set('logo', logo)
    const result = await action.registerClinic(form)
    assert.equal(result.success, undefined)
    assert.match(result.error, /Configuración.*confirmar tu cuenta/)
  }
  assert.equal(effects, 0)
})
