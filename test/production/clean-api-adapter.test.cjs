'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {config,route}=require('../../scripts/clinia-clean-api.cjs');
test('clean API adapter selects exact fresh project primary and one loopback gateway',()=>{
  const c=config('clean-managed-1');assert.equal(c.project,'clinia-clean-20261002-1');assert.equal(c.database,'postgres');assert.equal(c.port,56411);assert.equal(c.gateway,true);
  for(const variant of ['stage','clean-managed-0','clean-managed-10','clean-managed-1;stop','clinia-acceptance'])assert.throws(()=>config(variant));
});
test('provider routes stay under configured gateway without duplicating signed storage prefix',()=>{
  assert.equal(route('clean-managed-1','auth','/token?grant_type=password'),'/auth/v1/token?grant_type=password');
  assert.equal(route('clean-managed-1','rest','/rpc/get_clinic_member_role'),'/rest/v1/rpc/get_clinic_member_role');
  assert.equal(route('clean-managed-1','storage','/object/sign/patient-files/path'),'/storage/v1/object/sign/patient-files/path');
  assert.equal(route('clean-managed-1','storage','/storage/v1/object/sign/path'),'/storage/v1/object/sign/path');
  for(const value of ['https://external.invalid/token','//external.invalid/token'])assert.throws(()=>route('clean-managed-1','auth',value));
});
