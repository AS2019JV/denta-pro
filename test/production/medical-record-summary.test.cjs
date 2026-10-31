'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

function harness({ role = 'doctor', userId = 'doctor-a', clinicId = 'clinic-a' } = {}) {
  const state = { slots: [], effects: [], calls: [], pending: [], writes: 0 }
  const auth = { user: { id: userId, role }, currentClinicId: clinicId, isRevalidating: false }
  let cursor = 0
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in state.slots)) state.slots[index] = typeof initial === 'function' ? initial() : initial
      return [state.slots[index], value => { state.slots[index] = typeof value === 'function' ? value(state.slots[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in state.slots)) state.slots[index] = { current: initial }
      return state.slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++, old = state.slots[index]
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        state.effects.push(() => {
          old?.cleanup?.()
          state.slots[index] = { deps, cleanup: effect() }
        })
      }
    },
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const client = { from(table) {
    const filters = {}, call = { table, filters, orders: [] }
    state.calls.push(call)
    const query = {
      select() { return query },
      eq(key, value) { filters[key] = value; return query },
      is(key, value) { filters[key] = value; return query },
      order(key, options) { call.orders.push([key, options]); return query },
      limit(value) { call.limit = value; return query },
      abortSignal(signal) { call.signal = signal; return query },
      maybeSingle() { const request = deferred(); state.pending.push({ patientId: filters.patient_id, request }); return request.promise },
      insert() { state.writes++; return Promise.resolve({ error: null }) },
    }
    return query
  } }
  const module = { exports: {} }
  const source = fs.readFileSync('components/patient-medical-records.tsx', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  vm.runInNewContext(js, { module, exports: module.exports, AbortController, Promise, Object,
    require(id) {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id === '@/components/auth-context') return { useAuth: () => auth }
      if (id === '@/lib/supabase') return { supabase: client }
      if (id === '@/lib/agenda.mjs') return require('../../lib/agenda.mjs')
      if (id === '@/components/ui/button' || id === '@/components/ui/card' || id === '@/components/odontogram-preview') {
        return new Proxy({}, { get: (_, name) => name === '__esModule' ? true : name === 'default' ? undefined : name })
      }
      return {}
    },
  }, { filename: 'components/patient-medical-records.tsx' })

  function render(patientId, onOpenClinicalForm = () => {}) {
    cursor = 0
    state.effects = []
    const tree = module.exports.PatientMedicalRecords({ patientId, onOpenClinicalForm })
    for (const effect of state.effects) effect()
    return tree
  }
  return { state, auth, render }
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join(' ')
  return textContent(node.props?.children)
}
function findButton(node, label) {
  if (!node || typeof node !== 'object') return null
  if ((node.type === 'button' || node.type === 'Button') && textContent(node).includes(label)) return node
  for (const value of Object.values(node)) {
    const found = findButton(value, label)
    if (found) return found
  }
  return null
}

test('renders persisted HCU content and scopes latest active read to clinic and patient', async () => {
  const h = harness()
  let tree = h.render('patient-a')
  const call = h.state.calls[0]
  assert.equal(call.filters.clinic_id, 'clinic-a')
  assert.equal(call.filters.patient_id, 'patient-a')
  assert.equal(call.filters.deleted_at, null)
  assert.deepEqual(JSON.parse(JSON.stringify(call.orders)), [['created_at', { ascending: false }], ['id', { ascending: false }]])
  assert.equal(call.limit, 1)
  h.state.pending[0].request.resolve({ data: { doctor_id: 'doctor-a', created_at: '2026-10-28T12:00:00Z', form_data: {
    ant_diabetes: true, ant_otros: 'Alergia documentada: látex',
    registro_sesiones: [{ procedimiento: 'Restauración 16', observaciones: 'Evolución persistida' }],
    plan_terapeutico: [{ procedimiento: 'Control', dientes_involucrados: '16' }],
  } }, error: null })
  await settle()
  tree = h.render('patient-a')
  const text = textContent(tree)
  for (const expected of ['Diabetes', 'Alergia documentada: látex', 'Restauración 16', 'Evolución persistida', 'Control']) assert.ok(text.includes(expected), expected)
  assert.ok(!text.includes('Penicilina'))
  assert.ok(!text.includes('Dr. Actual'))
})

test('empty history stays unregistered and the button opens HCU without writing', async () => {
  const h = harness()
  let opened = 0
  h.render('patient-empty', () => { opened++ })
  h.state.pending[0].request.resolve({ data: null, error: null })
  await settle()
  const tree = h.render('patient-empty', () => { opened++ })
  const text = textContent(tree)
  assert.ok(text.includes('Sin historia clínica registrada'))
  assert.ok(text.includes('No hay antecedentes, notas ni tratamientos precargados'))
  assert.ok(!text.includes('Sin diabetes'))
  const button = findButton(tree, 'Registrar primera HCU-033')
  assert.ok(button)
  button.props.onClick()
  assert.equal(opened, 1)
  assert.equal(h.state.writes, 0)
})

test('doctor and clinic owner read the scoped record while receptionist performs no read', async () => {
  for (const role of ['doctor', 'clinic_owner']) {
    const h = harness({ role, userId: `${role}-a` })
    h.render('patient-a')
    assert.equal(h.state.calls.length, 1, `${role} should read`)
    assert.equal(h.state.calls[0].filters.clinic_id, 'clinic-a')
    assert.equal(h.state.calls[0].filters.patient_id, 'patient-a')
    assert.equal(h.state.calls[0].filters.deleted_at, null)
    h.state.pending[0].request.resolve({ data: null, error: null })
    await settle()
  }
  const receptionist = harness({ role: 'receptionist' })
  assert.ok(textContent(receptionist.render('patient-a')).includes('No hay acceso clínico vigente'))
  assert.equal(receptionist.state.calls.length, 0)
})

test('late response for prior patient is ignored after switching patients', async () => {
  const h = harness()
  h.render('patient-a')
  const first = h.state.pending[0]
  h.render('patient-b')
  const second = h.state.pending[1]
  second.request.resolve({ data: { doctor_id: 'doctor-a', form_data: { ant_otros: 'Contenido de B' } }, error: null })
  await settle()
  first.request.resolve({ data: { doctor_id: 'doctor-a', form_data: { ant_otros: 'Contenido tardío de A' } }, error: null })
  await settle()
  const text = textContent(h.render('patient-b'))
  assert.ok(text.includes('Contenido de B'))
  assert.ok(!text.includes('Contenido tardío de A'))
  assert.equal(h.state.calls[0].signal.aborted, true)
})
