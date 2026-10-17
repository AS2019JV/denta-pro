'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const email=require('../../scripts/verify-clinia-email-budget-sql.cjs');
const upgrade=require('../../scripts/upgrade-clinia-captured-schema.cjs');
test('SQL verification never accepts occupied or remote database identifiers',()=>{
  for(const value of ['postgres','production','../1','0','10','1;DROP DATABASE postgres']){
    assert.throws(()=>email.plan(value));assert.throws(()=>upgrade.plan('stage',value));
  }
  for(const variant of ['prod','postgres','https://remote.invalid','../stage'])assert.throws(()=>upgrade.plan(variant,1));
  assert.equal(email.plan(1).database,'clinia_email_budget_20261002_1');
  assert.equal(upgrade.plan('linked',1).source,'clinia_restore_linked_20261001_2');
});
