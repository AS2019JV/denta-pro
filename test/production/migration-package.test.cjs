'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {verify,compile,compare,expected,DIR}=require('../../scripts/clinia-migration-package.cjs');
const {statements}=require('../../scripts/prepare-clinia-hosted-staging.cjs');
test('canonical package pins actual sources and excludes historical rollback path',()=>{
 const m=verify();assert.equal(m.forward.length,19);assert.ok(!m.forward.some(x=>x.includes('rollback_')));
 const a=JSON.parse(fs.readFileSync(path.join(__dirname,'../..',DIR,'adjudication.json')));
 assert.equal(a.decisions.length,58);assert.equal(a.decisions.filter(x=>x.classification==='PHYSICAL_LEGACY_RETENTION').length,45);
 assert.equal(a.decisions.filter(x=>x.classification==='CONSERVATIVE_DELETE_DEFECT').length,1);
 for(const d of a.decisions){assert.ok(d.sqlSources.length>0,d.identity);assert.ok(d.consumers.length&&d.requiredTests.length);assert.equal(d.approvedForRemoteDDL,false);}
});
test('compiler refuses old/shared/remote targets before producing SQL',()=>{
 for(const p of ['clinia-clean-20261002-1','clinia-clean-20261002-2','clinia-clean-20261002-3','leqsrfyjvuxxdsubjjin','phihonofwyerpfgqfekt','postgres','clinia-clean-20261002-4;COMMIT'])assert.throws(()=>compile('upgrade',p));
 assert.throws(()=>compile('unknown','clinia-clean-20261002-4'));
 assert.throws(()=>compile('clean','clinia-clean-20261002-4','skip'));
});
test('each canonical mode has one transaction and original guarded identity transition',()=>{
 for(const v of ['clean','upgrade'])for(const ending of ['commit','rollback','fail']){
  const c=compile(v,'clinia-clean-20261002-'+(v==='clean'?'4':'5'),ending),parts=statements(c.sql);
  assert.equal(parts.filter(x=>x.clean==='BEGIN;').length,1);
  assert.equal(parts.filter(x=>/^(COMMIT|ROLLBACK);$/.test(x.clean)).length,1);
  assert.equal(parts.at(-1).clean,ending==='rollback'?'ROLLBACK;':'COMMIT;');
  assert.equal((c.sql.match(/SET LOCAL SESSION AUTHORIZATION postgres;/g)||[]).length,1);
  assert.ok(c.sql.indexOf('SET LOCAL SESSION AUTHORIZATION postgres;')>c.sql.indexOf('Reviewed local callback executor required'));
  assert.ok(c.sql.includes('GATE3_CANONICAL_EXPECTED_AFTER_ALL_DDL')===(ending==='fail'));
 }
});
test('full contract detects unexpected grants/function/column changes and unknown sections',()=>{
 for(const v of ['clean','upgrade']){
  const a=expected(v);assert.deepEqual(compare(a,structuredClone(a)),[]);
  for(const section of ['tables','columns','functions','constraints','triggers','policies','schemas','defaults','types','sequences','indexes']){
   const b=structuredClone(a);assert.ok(b[section].length);b[section][0].unexpected='drift';assert.equal(compare(a,b).length,1,section);
  }
  const b=structuredClone(a);b.functions.push(b.functions[0]);assert.throws(()=>compare(a,b),/Duplicate/);
  const c=structuredClone(a);delete c.policies;assert.throws(()=>compare(a,c),/Missing/);
  const d=structuredClone(a);d.unreviewed=[];assert.throws(()=>compare(d,d),/Unknown/);
  for(const key of ['database','currentUser','sessionUser','serverVersion']){const e=structuredClone(a);e[key]='unreviewed';assert.equal(compare(a,e).length,1,key);}
 }
});
test('variants preserve precision and views while both demand noncascading payment FK',()=>{
 const a=expected('clean'),b=expected('upgrade');assert.equal(compare(a,b).length,57);
 for(const c of [a,b])assert.equal(c.constraints.find(x=>x.name==='payment_methods_clinic_id_fkey').definition,'FOREIGN KEY (clinic_id) REFERENCES clinics(id)');
 assert.equal(a.columns.find(x=>x.table==='public.services'&&x.name==='price').type,'numeric');
 assert.equal(b.columns.find(x=>x.table==='public.services'&&x.name==='price').type,'numeric(10,2)');
 for(const c of [a,b])for(const v of c.tables.filter(x=>x.kind==='v'))assert.ok(!/(?:anon|authenticated)=/.test(v.acl));
});
