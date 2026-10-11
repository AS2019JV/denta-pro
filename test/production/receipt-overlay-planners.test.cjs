'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const receipt=require('../../scripts/verify-clinia-prescription-receipts.cjs'),overlay=require('../../scripts/append-clinia-captured-overlays.cjs');
test('Receipt acceptance planner refuses occupied/remote variants and replacement attempts',()=>{
  assert.equal(receipt.plan('clean-managed-1','1').c.database,'postgres');
  for(const variant of ['prod','captured-linked-v2','https://remote','clean-managed-10'])assert.throws(()=>receipt.plan(variant,'1'));
  for(const attempt of ['0','10','../1'])assert.throws(()=>receipt.plan('clean-managed-1',attempt));
});
test('Captured overlay planner has only two reviewed synthetic destinations',()=>{
  assert.deepEqual(overlay.plan('1').targets.map(t=>t[1]),['clinia_upgrade_stage_20261002_3','clinia_upgrade_linked_20261002_2']);
  for(const attempt of ['0','10','../1'])assert.throws(()=>overlay.plan(attempt));
  assert.match(overlay.functions(['public.clinia_session_active()']),/pg_get_userbyid/);
});
