'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {settingsSql}=require('../../scripts/clinia-pg-settings.cjs');
test('PostgreSQL list-valued role settings restore separate library and schema identifiers',()=>{
  assert.equal(settingsSql('ALTER ROLE "authenticator"',['session_preload_libraries=supautils, safeupdate']),'ALTER ROLE "authenticator" SET "session_preload_libraries" TO \'supautils\', \'safeupdate\';');
  assert.equal(settingsSql('ALTER ROLE "actor"',['search_path="$user", public, "schema,with,comma"']),'ALTER ROLE "actor" SET "search_path" TO \'$user\', \'public\', \'schema,with,comma\';');
});
test('Scalar custom settings preserve comma strings and quote literals safely',()=>{
  assert.equal(settingsSql('ALTER ROLE "actor"',['pgrst.db_schemas=public,extensions']),'ALTER ROLE "actor" SET "pgrst.db_schemas" TO \'public,extensions\';');
  assert.equal(settingsSql('ALTER ROLE "actor"',["application_name=owner's test"]),'ALTER ROLE "actor" SET "application_name" TO \'owner\'\'s test\';');
  assert.throws(()=>settingsSql('ALTER ROLE "actor"',['search_path="unclosed']));
});
