const {test} = require('node:test')
const assert = require('node:assert/strict')
const source = import('../../lib/clinic-authority.mjs')
const A = '33333333-3333-4333-8333-333333333333'
const B = '44444444-4444-4444-8444-444444444444'
const active = {status:'active', deleted_at:null, clinic_id:B}
const members = [{clinic_id:A, role:'doctor', status:'active'}, {clinic_id:B, role:'receptionist', status:'active'}]
test('clinic switch selects the matching role and ignores profile role', async () => {
  const {selectClinicMembership: choose} = await source
  assert.equal(choose({...active, role:'clinic_owner'}, members, A).role, 'doctor')
  assert.equal(choose(active, members, B).role, 'receptionist')
})
test('inactive/deleted profiles and inactive or unrecognized memberships have no authority', async () => {
  const {selectClinicMembership: choose} = await source
  for (const profile of [null, {...active,status:'invited'}, {...active,status:'suspended'}, {...active,deleted_at:'2026-09-27'}]) assert.equal(choose(profile,members,A),null)
  assert.equal(choose(active,[{...members[0],status:'removed'}, {...members[1],role:'admin'}],A),null)
})
test('forged preference or primary clinic never grants membership', async () => {
  const {selectClinicMembership: choose} = await source
  assert.equal(choose({...active,clinic_id:B},[members[0]],B).clinic_id,A)
  assert.equal(choose(active,[],B),null)
  assert.equal(choose(active,[{...members[0],clinic_id:'invalid'}]),null)
})
test('default selection is deterministic without a valid preference', async () => {
  const {selectClinicMembership: choose} = await source
  assert.equal(choose({...active,clinic_id:null},[members[1],members[0]]).clinic_id,A)
  assert.equal(choose(active,members).clinic_id,B)
})
