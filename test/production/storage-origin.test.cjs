const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { Readable } = require('node:stream')
const { getEventListeners } = require('node:events')
const ts = require('typescript')

// Actual adapter/configuration, simulated S3 SDK and real Node streams. These
// tests deliberately make no claim about deployed S3/RLS authorization.
const project = 'abcdefghijklmnopqrst'
const provider = `https://${project}.supabase.co`
const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
const anon = jwt({ role: 'anon', ref: project })
const token = jwt({ role: 'clinia_document_delivery', sub: 'synthetic-principal' })
const objectPath = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/synthetic.pdf'
const payload = Buffer.from('synthetic clinical bytes')
const tick = () => new Promise(resolve => setImmediate(resolve))
async function harness(options = {}) {
  const config = await import('../../lib/storage-origin-config.mjs')
  const media = await import('../../lib/private-media.mjs')
  const limits = await import('../../lib/clinical-media-limits.mjs')
  const body = options.body || Readable.from([payload])
  const state = { configs: [], sends: [], destroys: 0, body }
  class S3Client {
    constructor(input) { state.configs.push(input) }
    async send(command, input) {
      state.sends.push({ command, input })
      if (options.send) return options.send(command, input)
      if (options.error) throw options.error
      return { $metadata: { httpStatusCode: 200 }, Body: body, ContentLength: payload.length,
        ContentType: 'application/pdf', ...options.object }
    }
    destroy() { state.destroys++ }
  }
  class GetObjectCommand { constructor(input) { this.input = input } }
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/storage-origin.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, Response, ReadableStream, Uint8Array, Buffer,
    process: { env: { CLINIA_STORAGE_REGION: 'us-east-1', ...options.env } },
    require(name) {
      if (name === 'server-only') return {}
      if (name === '@aws-sdk/client-s3') return { S3Client, GetObjectCommand }
      if (name === 'node:stream') return { Readable }
      if (name === './storage-origin-config.mjs') return config
      if (name === './private-media.mjs') return media
      if (name === './clinical-media-limits.mjs') return limits
      if (name === './env') return { env: { NEXT_PUBLIC_SUPABASE_URL: provider, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, ...options.providerEnv } }
      throw new Error(`Unexpected adapter dependency: ${name}`)
    },
  })
  return { state, download: (signal = new AbortController().signal, bucket = 'patient-files', key = objectPath) =>
    module.exports.downloadStorageOrigin(bucket, key, token, signal) }
}
function safeError(error) {
  assert.match(error.message, /^Storage (transport|bytes|request) (denied|canceled)$/)
  for (const secret of [provider, anon, token, objectPath, 'raw-provider-detail']) assert.equal(error.message.includes(secret), false)
  return true
}

test('origin config uses exact project anon JWT and session token with one attempt and no URL credentials', async () => {
  const { storageOriginConfig } = await import('../../lib/storage-origin-config.mjs')
  assert.deepEqual(storageOriginConfig(provider, anon, 'us-east-1', token), {
    endpoint: `https://${project}.storage.supabase.co/storage/v1/s3`, region: 'us-east-1',
    forcePathStyle: true, maxAttempts: 1,
    credentials: { accessKeyId: project, secretAccessKey: anon, sessionToken: token },
  })
})

test('origin config rejects missing region, publishable/secret/service keys and wrong project', async () => {
  const { storageOriginConfig: config } = await import('../../lib/storage-origin-config.mjs')
  for (const region of [undefined, '', 'auto', 'us-east-1/evil']) assert.throws(() => config(provider, anon, region, token), /region configuration invalid/)
  for (const key of ['sb_publishable_synthetic', 'sb_secret_synthetic', jwt({ role: 'service_role', ref: project }), jwt({ role: 'anon', ref: 'zyxwvutsrqponmlkjihg' }), 'invalid']) {
    assert.throws(() => config(provider, key, 'us-east-1', token), /(?:project anon JWT key|anon configuration invalid)/)
  }
  for (const origin of ['https://example.com', `http://${project}.supabase.co`, `${provider}/path`, `${provider}?key=secret`, `${provider}#secret`, `https://user:secret@${project}.supabase.co`, `${provider}:444`]) {
    assert.throws(() => config(origin, anon, 'us-east-1', token), /origin configuration invalid/)
  }
  for (const badToken of ['', 'not-a-jwt', 'Bearer header.payload.sig']) assert.throws(() => config(provider, anon, 'us-east-1', badToken), /session absent/)
})

test('actual origin adapter preserves bucket/path/session and publishes only safe response metadata', async () => {
  const h = await harness({ object: { ETag: token, Metadata: { location: provider, authorization: token } } })
  const signal = new AbortController().signal
  const response = await h.download(signal)
  assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload)
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.sends[0].command.input)), { Bucket: 'patient-files', Key: objectPath })
  assert.equal(h.state.sends[0].input.abortSignal, signal)
  assert.equal(h.state.configs[0].credentials.sessionToken, token)
  assert.deepEqual([...response.headers], [['content-length', String(payload.length)], ['content-type', 'application/pdf']])
  assert.equal(response.url, '')
  await tick()
  assert.equal(h.state.destroys, 1); assert.equal(h.state.body.destroyed, true)
  assert.equal(getEventListeners(signal, 'abort').length, 0)
})

test('adapter rejects URL/encoded/traversal/wrong bucket paths before creating the SDK', async () => {
  for (const [bucket, key] of [['patient-files', `${provider}/storage/v1/object/authenticated/patient-files/${objectPath}`], ['patient-files', '../secret'], ['patient-files', objectPath.replace('synthetic', '%73ynthetic')], ['unknown', objectPath], ['doctor-avatars', objectPath]]) {
    const h = await harness()
    await assert.rejects(h.download(undefined, bucket, key), /Storage reference denied/)
    assert.equal(h.state.configs.length, 0); assert.equal(h.state.sends.length, 0)
  }
})

test('invalid status, body and declared length fail closed and release the client', async () => {
  for (const object of [{ $metadata: { httpStatusCode: 206 } }, { Body: null }, ...[undefined, -1, 0, 1.5, 4_000_001, Number.MAX_SAFE_INTEGER + 1].map(ContentLength => ({ ContentLength }))]) {
    const h = await harness({ object })
    await assert.rejects(h.download(), safeError)
    assert.equal(h.state.destroys, 1)
    if (!Object.hasOwn(object, 'Body')) assert.equal(h.state.body.destroyed, true)
  }
})

test('actual bytes must match ContentLength, including empty/truncated/extra/oversized bodies', async () => {
  for (const [chunks, declared] of [[[], 1], [[Buffer.from('ab')], 3], [[Buffer.from('abc')], 2], [[Buffer.alloc(4_000_001)], 4_000_000]]) {
    const h = await harness({ body: Readable.from(chunks), object: { ContentLength: declared } })
    const response = await h.download()
    await assert.rejects(response.arrayBuffer(), safeError)
    await tick(); assert.equal(h.state.destroys, 1); assert.equal(h.state.body.destroyed, true)
  }
})

test('exact maximum bytes succeed and cleanup does not depend on a close event', async () => {
  const body = Readable.from([Buffer.alloc(4_000_000)], { emitClose: false, autoDestroy: false })
  const h = await harness({ body, object: { ContentLength: 4_000_000 } }), signal = new AbortController().signal
  const response = await h.download(signal)
  assert.equal((await response.arrayBuffer()).byteLength, 4_000_000)
  await tick(); assert.equal(h.state.destroys, 1); assert.equal(body.destroyed, true)
  assert.equal(getEventListeners(signal, 'abort').length, 0)
})

test('SDK and stream errors are generic and release transport resources', async () => {
  const message = `raw-provider-detail ${provider} ${token} ${objectPath}`
  const failed = await harness({ error: new Error(message) })
  await assert.rejects(failed.download(), safeError); assert.equal(failed.state.destroys, 1)
  const body = new Readable({ read() { this.destroy(new Error(message)) } })
  const streaming = await harness({ body }), response = await streaming.download()
  await assert.rejects(response.arrayBuffer(), safeError)
  await tick(); assert.equal(streaming.state.destroys, 1); assert.equal(body.destroyed, true)
})

test('caller cancellation destroys source even without close, and detaches its abort listener', async () => {
  const body = new Readable({ emitClose: false, read() {} })
  const h = await harness({ body }), signal = new AbortController().signal
  const response = await h.download(signal)
  await response.body.cancel('consumer left'); await tick()
  assert.equal(body.destroyed, true); assert.equal(h.state.destroys, 1)
  assert.equal(getEventListeners(signal, 'abort').length, 0)
})

test('request abort before SDK, during send and during reading cannot leak bytes or retain resources', async () => {
  const early = new AbortController(); early.abort()
  const h = await harness(); await assert.rejects(h.download(early.signal)); assert.equal(h.state.configs.length, 0)
  const sending = new AbortController(), lateBody = Readable.from([payload])
  const late = await harness({ send: async () => { sending.abort(); return { Body: lateBody, ContentLength: payload.length, $metadata: { httpStatusCode: 200 } } } })
  await assert.rejects(async () => { const response = await late.download(sending.signal); await response.arrayBuffer() })
  await tick(); assert.equal(lateBody.destroyed, true); assert.equal(late.state.destroys, 1)
  const controller = new AbortController(), body = new Readable({ emitClose: false, read() {} })
  const reading = await harness({ body }), response = await reading.download(controller.signal)
  const rejected = assert.rejects(response.arrayBuffer(), safeError)
  controller.abort(); await rejected; await tick()
  assert.equal(body.destroyed, true); assert.equal(reading.state.destroys, 1)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
})
