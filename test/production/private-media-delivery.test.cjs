const { test } = require('node:test')
const assert = require('node:assert/strict')
const origin = 'https://app.example.invalid', provider = 'https://synthetic.supabase.co'
const clinic = '11111111-1111-4111-8111-111111111111', entity = '22222222-2222-4222-8222-222222222222'
const user = '33333333-3333-4333-8333-333333333333', session = '44444444-4444-4444-8444-444444444444'
const foreign = '55555555-5555-4555-8555-555555555555'
const scope = { kind: 'patient-avatar', clinicId: clinic, entityId: entity }
const path = `${clinic}/${entity}/face.png`
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUQAAAABJRU5ErkJggg==', 'base64')
const image = (bytes = png, headers = {}) => new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length), ...headers } })
function request(body = scope, headers = {}, options = {}) {
  return new Request(`${origin}/api/private-media`, { method: 'POST', body: JSON.stringify(body), headers: { origin, 'content-type': 'application/json', ...headers }, ...options })
}
async function harness(options = {}) {
  const { privateMediaDeliveryHandler } = await import('../../lib/private-media-delivery.mjs')
  const state = { checks: 0, downloads: [], authority: { userId: user, sessionId: session, path }, active: true, ...options }
  const handler = privateMediaDeliveryHandler({ appOrigin: origin, providerOrigin: provider,
    authority: async (_request, bearer, signal) => {
      state.bearer = bearer; state.signal = signal
      return { authorize: async input => { state.checks++; state.onAuthorize?.(state, input); return state.active ? { ...state.authority } : null } }
    },
    download: async (bucket, object, signal) => { state.downloads.push({ bucket, path: object }); await state.onDownload?.(state, signal); return state.response ? state.response() : image() },
  })
  return { state, handler }
}
async function deny(response, status) {
  assert.equal(response.status, status)
  assert.equal(await response.text(), 'No se pudo entregar la imagen.')
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
}

test('server delivers exact raster bytes after two live checks, with no cache capability', async () => {
  const h = await harness(), response = await h.handler(request())
  assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
  assert.equal(h.state.checks, 2); assert.deepEqual(h.state.downloads, [{ bucket: 'patient-avatars', path }])
  assert.equal(response.headers.get('content-type'), 'image/png')
  for (const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control']) assert.match(response.headers.get(header), /no-store/)
  for (const header of ['etag','last-modified','location']) assert.equal(response.headers.get(header), null)
})

test('warm request is denied on replay after live revocation before transport', async () => {
  const h = await harness(); assert.equal((await h.handler(request())).status, 200)
  h.state.active = false; await deny(await h.handler(request()), 404); assert.equal(h.state.downloads.length, 1)
})

test('revocation, changed object or changed identity while buffering cannot publish bytes', async () => {
  for (const mutate of [s => { s.active = false }, s => { s.authority.path = `${clinic}/${entity}/new.png` }, s => { s.authority.userId = foreign }, s => { s.authority.sessionId = foreign }]) {
    const h = await harness({ onDownload: mutate }); await deny(await h.handler(request()), 404)
  }
})

test('body accepts exact entity scopes and rejects raw paths, unknown kinds, malformed IDs and surplus input', async () => {
  for (const body of [null, [], { ...scope, path }, { ...scope, kind: 'patient-files' }, { ...scope, kind: ['patient-avatar'] }, { ...scope, entityId: '../foreign' }, { ...scope, clinicId: 42 }]) {
    const h = await harness(); await deny(await h.handler(request(body)), 400); assert.equal(h.state.checks, 0)
  }
  const h = await harness()
  await deny(await h.handler(new Request(`${origin}/api/private-media`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: ' '.repeat(513) })), 400)
  assert.equal(h.state.checks, 0)
})

test('malformed Bearer never falls back to cookies and foreign origins never authorize', async () => {
  for (const [headers, status] of [[{ authorization: 'bad' },401], [{ origin: 'https://foreign.invalid' },403], [{ origin: 'https://foreign.invalid', authorization: 'Bearer human.token.jwt' },403]]) {
    const h = await harness(); await deny(await h.handler(request(scope, headers)), status); assert.equal(h.state.checks, 0)
  }
  const h = await harness(); const response = await h.handler(new Request(`${origin}/api/private-media`, {
    method: 'POST', headers: { authorization: 'Bearer human.token.jwt', 'content-type': 'application/json' }, body: JSON.stringify(scope),
  }))
  assert.equal(response.status, 200); assert.equal(h.state.bearer, 'human.token.jwt')
})

test('conditional/range requests and foreign registered paths cannot reach image transport', async () => {
  for (const header of ['range','if-range','if-none-match','if-modified-since']) {
    const h = await harness(); await deny(await h.handler(request(scope, { [header]: 'synthetic' })), 400); assert.equal(h.state.downloads.length, 0)
  }
  for (const value of [`${clinic}/${foreign}/face.png`, 'https://foreign.invalid/face.png', `${entity}/flat.png`]) {
    const h = await harness({ authority: { userId: user, sessionId: session, path: value } }); await deny(await h.handler(request()), 404)
    assert.equal(h.state.downloads.length, 0)
  }
})

test('SVG, wrong MIME, fake raster bytes, truncated streams and oversize payloads fail closed', async () => {
  const { CLINICAL_MEDIA_LIMIT } = await import('../../lib/clinical-media-limits.mjs')
  for (const response of [() => image(Buffer.from('<svg/>'), { 'Content-Type': 'image/svg+xml' }), () => image(png, { 'Content-Type': 'application/octet-stream' }),
    () => image(Buffer.from('<html>bad</html>')), () => image(png, { 'Content-Length': String(png.length+1) }),
    () => image(png, { 'Content-Length': String(CLINICAL_MEDIA_LIMIT+1) }),
    () => image(new Uint8Array(CLINICAL_MEDIA_LIMIT+1), { 'Content-Length': '8' })]) {
    const h = await harness({ response }); await deny(await h.handler(request()), 503); assert.equal(h.state.checks, 1)
  }
})

test('aborting an in-flight stream cancels the reader and releases its concurrency slot', async () => {
  let cancel = false, started
  const ready = new Promise(resolve => { started = resolve })
  const h = await harness({ response: () => new Response(new ReadableStream({ start() { started() }, cancel() { cancel = true } }), { headers: { 'Content-Type': 'image/png' } }) })
  const abort = new AbortController(), pending = h.handler(request(scope, {}, { signal: abort.signal }))
  await ready; abort.abort(); await deny(await pending, 504); assert.equal(cancel, true)
  h.state.response = () => image(); assert.equal((await h.handler(request())).status, 200)
})

function callerState(options = {}) {
  const state = { user, session, live: true, role: 'receptionist', activeProfile: true, subscription: true, storageAllowed: true,
    target: { id: entity, role: 'doctor', avatar_url: `${entity}/face.png` }, patient: { id: entity, clinic_id: clinic, avatar_url: path },
    logo: { id: clinic, logo_url: `${clinic}/logo.png` }, queries: [], rpcs: [], tokens: [], ...options }
  const client = {
    auth: {
      async getUser(token) { state.tokens.push(['user',token]); return { data: { user: state.user ? { id: state.user } : null }, error: null } },
      async getClaims(token) { state.tokens.push(['claims',token]); if (state.claimsThrow) throw Error('Unverifiable JWT'); return { data: { claims: {
        sub: state.claimSubject || state.user, session_id: state.session, role: state.jwtRole || 'authenticated', exp: state.exp || Date.now()/1000+60,
      } }, error: null } },
    },
    async rpc(name, args) {
      state.rpcs.push({ name, args })
      const result = name === 'clinia_session_active' ? state.live
        : name === 'get_clinic_member_role' ? (args.check_clinic_id === clinic ? state.role : null)
        : name === 'check_subscription_active' ? state.subscription
        : name === 'get_clinic_staff_directory' ? (state.target ? [{ ...state.target }] : [])
        : name === 'get_patient_demographics' ? { items: state.patient && args.p_patient_id === state.patient.id ? [{ ...state.patient }] : [] }
        : name === 'encargo02_storage_access' ? state.storageAllowed : undefined
      assert.notEqual(result, undefined, name); return { data: result, error: state.rpcError || null }
    },
    from(table) {
      const query = { table, filters: [] }; state.queries.push(query)
      return { select(columns) { query.columns = columns; return this }, eq(column,value) { query.filters.push([column,value]); return this },
        is(column,value) { query.filters.push([column,value]); return this },
        async maybeSingle() {
          assert.ok(['profiles','clinics'].includes(table), 'No direct clinical table query')
          if (table === 'profiles') { assert.ok(query.filters.some(([key,value]) => key === 'id' && value === state.user)); return { data: state.activeProfile ? { id: state.user } : null, error: null } }
          return { data: state.logo && query.filters.every(([key,value]) => state.logo[key] === value) ? { ...state.logo } : null, error: null }
        },
      }
    },
  }
  return { state, client }
}

test('ordinary authority resolves each registered entity with receptionist-safe projections', async () => {
  const { ordinaryPrivateMediaAuthority } = await import('../../lib/private-media-delivery.mjs')
  for (const [kind, id, expected] of [['patient-avatar',entity,path],['doctor-avatar',entity,`${entity}/face.png`],['clinic-logo',clinic,`${clinic}/logo.png`]]) {
    const h = callerState(), authority = ordinaryPrivateMediaAuthority(h.client, 'human.token.jwt', new AbortController().signal, provider)
    assert.deepEqual(await authority.authorize({ kind, clinicId: clinic, entityId: id }), { userId: user, sessionId: session, path: expected })
    assert.deepEqual(h.state.tokens, [['user','human.token.jwt'],['claims','human.token.jwt']])
    assert.equal(h.state.queries.filter(q => q.table === 'profiles').length, 1)
    if (kind === 'patient-avatar') assert.deepEqual(h.state.rpcs.find(r => r.name === 'get_patient_demographics').args,
      { p_clinic_id: clinic, p_patient_id: entity, p_search: '', p_limit: 1, p_offset: 0 })
  }
})

test('every live authority denial prevents access and an otherwise valid new session stays pinned out', async () => {
  const { ordinaryPrivateMediaAuthority } = await import('../../lib/private-media-delivery.mjs')
  for (const options of [{ user: null },{ live: false },{ activeProfile: false },{ subscription: false },{ role: null },{ storageAllowed: false },
    { jwtRole: 'service_role' },{ exp: 1 },{ claimSubject: foreign },{ claimsThrow: true },{ patient: { id: entity, clinic_id: foreign, avatar_url: path } }]) {
    const h = callerState(options), authority = ordinaryPrivateMediaAuthority(h.client, null, new AbortController().signal, provider)
    assert.equal(await authority.authorize(scope), null)
  }
  const h = callerState(), authority = ordinaryPrivateMediaAuthority(h.client, null, new AbortController().signal, provider)
  assert.ok(await authority.authorize(scope)); h.state.session = foreign; assert.equal(await authority.authorize(scope), null)
})

test('doctor-avatar target must be active directory clinician, path-bound and in requested clinic', async () => {
  const { ordinaryPrivateMediaAuthority } = await import('../../lib/private-media-delivery.mjs')
  for (const options of [{ target: null },{ target: { id: entity, role: 'receptionist', avatar_url: `${entity}/face.png` } },
    { target: { id: entity, role: 'doctor', avatar_url: `${foreign}/face.png` } }]) {
    const h = callerState(options), authority = ordinaryPrivateMediaAuthority(h.client, null, new AbortController().signal, provider)
    assert.equal(await authority.authorize({ ...scope, kind: 'doctor-avatar' }), null)
  }
  const h = callerState(), authority = ordinaryPrivateMediaAuthority(h.client, null, new AbortController().signal, provider)
  assert.equal(await authority.authorize({ ...scope, kind: 'doctor-avatar', clinicId: foreign }), null)
})

test('client rejects late bytes, invalid MIME/length and emits only a same-origin entity POST', async () => {
  const { fetchPrivateMedia } = await import('../../lib/private-media-client.mjs')
  let current = true
  const blob = await fetchPrivateMedia(scope, new AbortController().signal, () => current, async (url, init) => {
    assert.equal(url, '/api/private-media'); assert.deepEqual(JSON.parse(init.body), scope)
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error')
    return image()
  })
  assert.equal(blob.type, 'image/png'); assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png)
  assert.equal(await fetchPrivateMedia(scope, new AbortController().signal, () => current, async () => { current = false; return image() }), null)
  for (const response of [() => image(png,{ 'Content-Length': '4' }), () => image(png,{ 'Content-Type': 'image/svg+xml' })]) {
    await assert.rejects(fetchPrivateMedia(scope, new AbortController().signal, () => true, async () => response()))
  }
})
