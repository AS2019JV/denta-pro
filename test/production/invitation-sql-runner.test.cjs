'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {plan,guard,setupSql,cases}=require('../../scripts/verify-clinia-invitation-sql.cjs');
test('invitation SQL planner binds exact new targets and rejects arbitrary/occupied database names',()=>{
  assert.equal(plan('1').database,'clinia_invitation_sql_20261002_1');
  for(const attempt of ['0','10','../1','1;DROP DATABASE postgres','postgres'])assert.throws(()=>plan(attempt));
  for(const database of ['postgres','clinia_stage_clean','clinia_invitation_sql_20261002_1;COMMIT'])assert.throws(()=>guard(database));
  assert.match(setupSql(plan('2').database),/current_database\(\)<>'clinia_invitation_sql_20261002_2'/);
  assert.match(setupSql(plan('2').database),/UNIQUE \(clinic_id,email,status\)/);
});
test('negative preflights run actual migration inside disposable transaction and distinguish expected errors',()=>{
  const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261001120000_invitation_pending_reservation.sql'),'utf8');
  const checks=cases(plan('3').database,migration);
  assert.equal(checks.length,3);
  assert.match(checks[0].sql,/EXCEPTION WHEN unique_violation/);
  assert.match(checks[0].sql,/<>6/);
  assert.match(checks[0].sql,/ROLLBACK;$/);
  for(const check of checks.slice(1)){
    assert.ok(check.sql.startsWith('BEGIN;'));
    assert.ok(check.sql.endsWith(migration));
    assert.ok(migration.includes(check.error));
    assert.match(check.sql,/DROP INDEX public.clinic_invitations_one_pending_email_idx/);
    assert.ok(!check.sql.includes('DROP DATABASE'));
  }
});
