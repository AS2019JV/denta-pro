'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compiled}=require('../../scripts/verify-clinia-mfa-sql.cjs');const root=path.resolve(__dirname,'../..');
test('the five-migration verification chain refuses premature commit and nested transactions',()=>{
 const result=compiled();assert.equal(result.migrations.length,5);
 for(const boundary of ['COMMIT;','ROLLBACK;','BEGIN;','START TRANSACTION;']){
  assert.throws(()=>compiled(relative=>{const bytes=fs.readFileSync(path.join(root,relative));if(!relative.endsWith('mandatory_clinical_mfa.sql'))return bytes;return Buffer.from(bytes.toString().replace("SET LOCAL lock_timeout='5s';",boundary+"\nSET LOCAL lock_timeout='5s';"));}));
 }
});
