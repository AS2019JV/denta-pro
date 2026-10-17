const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isPrescriptionRole,
  normalizePrescriptionInput,
  patientRecipesPath,
  readPatientTab,
  savePrescriptionWithAuthorization,
} = require('../../lib/prescription-policy.mjs')

const patientId = '880e8400-e29b-41d4-a716-446655440000'
const clinicId = '880e8400-e29b-41d4-a716-446655440001'

test('recipe navigation accepts only a UUID and uses a fixed destination', () => {
  assert.equal(patientRecipesPath(patientId), `/patients/${patientId}?tab=recipes`)
  assert.equal(patientRecipesPath('../dashboard'), null)
  assert.equal(readPatientTab('recipes'), 'recipes')
  assert.equal(readPatientTab('redirect=https://example.com'), 'info')
})

test('prescription role policy rejects receptionist and unknown roles', () => {
  assert.equal(isPrescriptionRole('doctor'), true)
  assert.equal(isPrescriptionRole('clinic_owner'), true)
  assert.equal(isPrescriptionRole('receptionist'), false)
  assert.equal(isPrescriptionRole('admin'), false)
  assert.equal(isPrescriptionRole(null), false)
})

test('prescription save authorization fails closed before insert for every denied identity or scope', async (t) => {
  const validInput = { patientId, clinicId, medications: [{ name: 'A', dosage: 'B', duration: 'C' }], indications: '' }
  const cases = [
    ['no session', { getUser: async () => null }],
    ['receptionist', { getRole: async () => ({ role: 'receptionist' }) }],
    ['role RPC failure', { getRole: async () => ({ role: 'doctor', error: new Error('rpc') }) }],
    ['inactive profile', { getProfile: async () => ({ status: 'suspended' }) }],
    ['missing profile', { getProfile: async () => ({ status: null }) }],
    ['patient outside clinic or deleted', { getPatient: async () => ({ exists: false }) }],
  ]

  for (const [name, override] of cases) {
    await t.test(name, async () => {
      let inserts = 0
      const dependencies = {
        getUser: async () => ({ id: 'user-1' }),
        getRole: async () => ({ role: 'doctor' }),
        getProfile: async () => ({ status: 'active' }),
        getPatient: async () => ({ exists: true }),
        insert: async () => { inserts += 1; return null },
        ...override,
      }
      const result = await savePrescriptionWithAuthorization(validInput, dependencies)
      assert.equal(result.success, false)
      assert.equal(inserts, 0)
      if (!result.success) assert.doesNotMatch(result.error, /rpc|patient|user-1|clinic/i)
    })
  }
})

test('prescription save inserts only after a live doctor role, active profile, and clinic patient check', async () => {
  const calls = []
  const result = await savePrescriptionWithAuthorization({
    patientId,
    clinicId,
    medications: [{ name: 'A', dosage: 'B', duration: 'C' }],
    indications: 'D',
  }, {
    getUser: async () => ({ id: 'user-1' }),
    getRole: async (id) => { calls.push(['role', id]); return { role: 'clinic_owner' } },
    getProfile: async (id) => { calls.push(['profile', id]); return { status: 'active' } },
    getPatient: async (id, clinic) => { calls.push(['patient', id, clinic]); return { exists: true } },
    insert: async (record) => { calls.push(['insert', record]); return null },
  })
  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls.map(([name]) => name), ['role', 'profile', 'patient', 'insert'])
  assert.equal(calls[3][1].doctor_id, 'user-1')
  assert.equal(calls[3][1].clinic_id, clinicId)
})

test('prescription input trims values and rejects missing, oversized, or malformed data', () => {
  const normalized = normalizePrescriptionInput({
    patientId,
    clinicId,
    medications: [{ name: '  Amoxicilina  ', dosage: '500 mg cada 8 h', duration: '7 días' }],
    indications: '  Tomar con agua  ',
  })
  assert.deepEqual(normalized, {
    patientId,
    clinicId,
    medications: [{ name: 'Amoxicilina', dosage: '500 mg cada 8 h', duration: '7 días' }],
    indications: 'Tomar con agua',
  })
  assert.equal(normalizePrescriptionInput({ patientId: '../bad', clinicId, medications: [], indications: '' }), null)
  assert.equal(normalizePrescriptionInput({ patientId, clinicId, medications: Array(21).fill({ name: 'A', dosage: 'B', duration: 'C' }), indications: '' }), null)
  assert.equal(normalizePrescriptionInput({ patientId, clinicId, medications: [{ name: '', dosage: 'B', duration: 'C' }], indications: '' }), null)
  assert.equal(normalizePrescriptionInput({ patientId, clinicId, medications: [{ name: 'A', dosage: 'B', duration: 'C' }], indications: 'x'.repeat(2001) }), null)
})
