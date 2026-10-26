const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Readable } = require('node:stream')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')

// Real AWS SDK serialization/signing, captured before any network. This checks
// the client wire contract, not hosted JWT verification, RLS or rollout.
const project = 'abcdefghijklmnopqrst'
const provider = `https://${project}.supabase.co`
const payload = Buffer.from('synthetic')
const jwt = role => `header.${Buffer.from(JSON.stringify({ role, sub: 'synthetic' })).toString('base64url')}.signature`
const hash = text => crypto.createHash('sha256').update(text).digest('hex')
const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest()
const encode = text => encodeURIComponent(text).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())

// Independent SigV4 calculation over the request emitted by the real SDK.
function signatureMatches(request, secret, headers = request.headers) {
  const match = /^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([a-f0-9]{64})$/.exec(request.headers.authorization)
  assert.ok(match)
  const [accessKey, date, region, service, terminal] = match[1].split('/')
  assert.equal(accessKey, project); assert.equal(service, 's3'); assert.equal(terminal, 'aws4_request')
  const signedHeaders = match[2]
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')]))
  const canonicalHeaders = signedHeaders.split(';').map(key => `${key}:${normalized[key]}`).join('\n') + '\n'
  const query = Object.entries(request.query || {}).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(item => [encode(key), encode(String(item ?? ''))]))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv)).map(([key, value]) => `${key}=${value}`).join('&')
  const canonical = [request.method, request.path, query, canonicalHeaders, signedHeaders, normalized['x-amz-content-sha256']].join('\n')
  const scope = `${date}/${region}/${service}/${terminal}`
  const toSign = ['AWS4-HMAC-SHA256', normalized['x-amz-date'], scope, hash(canonical)].join('\n')
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), terminal)
  return hmac(signingKey, toSign).toString('hex') === match[3]
}

for (const role of ['authenticated', 'clinia_document_delivery']) {
  test(`real SDK signs ${role} session with project ref; no legacy or generated key needed`, async () => {
    const { storageOriginConfig } = await import('../../lib/storage-origin-config.mjs')
    const token = jwt(role)
    let captured
    const client = new S3Client({ ...storageOriginConfig(provider, 'us-east-1', token),
      requestHandler: { async handle(request) {
        assert.equal(captured, undefined, 'one request only, no transport fallback')
        captured = request
        return { response: { statusCode: 200, headers: { 'content-length': String(payload.length) }, body: Readable.from([payload]) } }
      } },
    })
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: 'patient-files', Key: 'clinic/patient/synthetic.pdf' }))
      assert.deepEqual(Buffer.from(await object.Body.transformToByteArray()), payload)
      assert.equal(captured.hostname, `${project}.storage.supabase.co`)
      assert.equal(captured.path, '/storage/v1/s3/patient-files/clinic/patient/synthetic.pdf')
      assert.equal(captured.headers['x-amz-security-token'], token)
      assert.match(captured.headers.authorization, /SignedHeaders=[^,]*x-amz-security-token/)
      assert.equal(captured.headers.apikey, undefined)
      assert.equal(Object.keys(captured.query || {}).some(key => /signature|token|credential/i.test(key)), false)
      assert.ok(signatureMatches(captured, project))
      assert.equal(signatureMatches(captured, 'retired-anon-key'), false)
      assert.equal(signatureMatches(captured, 'sb_publishable_synthetic'), false)
      assert.equal(signatureMatches(captured, project, { ...captured.headers, 'x-amz-security-token': jwt('other') }), false)
    } finally { client.destroy() }
  })
}
