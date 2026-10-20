'use strict';
// Pure recovery supplement for NEW local restored DBs: exact owner-default ACL representation only.
const assert=require('node:assert/strict'),{compare}=require('./clinia-migration-package.cjs');
const ident=s=>{assert.match(s,/^[a-z_][a-z0-9_]*$/);return '"'+s+'"';};
function build(target,expected,actual){
 assert.equal(target.kind,'local-disposable');assert.match(target.project,/^clinia-clean-20261002-[789]$/);assert.match(target.database,/^clinia_recovered_(baseline|postcommit)$/);assert.match(target.systemIdentifier,/^[0-9]{10,25}$/);
 const diffs=compare(expected,actual),parts=[];
 for(const d of diffs){assert.ok(['tables','schemas'].includes(d.section),'Recovery drift is not owner-default ACL representation');assert.ok(d.before&&d.after&&d.before.owner==='postgres'&&d.after.owner==='postgres');assert.equal(d.after.acl,null);assert.deepEqual({...d.before,acl:null},d.after,'Non-ACL recovery drift');
  if(d.section==='tables'){assert.equal(d.before.acl,'{postgres=arwdDxtm/postgres}');assert.ok(['r','p'].includes(d.before.kind));parts.push(`DO $acl$ BEGIN IF (SELECT relacl IS NOT NULL OR relowner<>'postgres'::regrole FROM pg_catalog.pg_class WHERE oid='${d.before.schema}.${d.before.name}'::regclass) THEN RAISE EXCEPTION 'RECOVERY_ACL_PRECONDITION_REFUSED'; END IF; END $acl$; GRANT ALL PRIVILEGES ON TABLE ${ident(d.before.schema)}.${ident(d.before.name)} TO postgres;`);}
  else {assert.equal(d.before.acl,'{postgres=UC/postgres}');parts.push(`DO $acl$ BEGIN IF (SELECT nspacl IS NOT NULL OR nspowner<>'postgres'::regrole FROM pg_catalog.pg_namespace WHERE nspname='${d.before.name}') THEN RAISE EXCEPTION 'RECOVERY_ACL_PRECONDITION_REFUSED'; END IF; END $acl$; GRANT ALL PRIVILEGES ON SCHEMA ${ident(d.before.name)} TO postgres;`);}
 }
 return {differences:diffs.map(d=>({section:d.section,identity:d.identity,beforeAcl:d.before.acl,afterAcl:d.after.acl})),sql:`BEGIN; DO $target$ BEGIN IF current_database()<>'${target.database}' OR current_user<>'supabase_admin' OR session_user<>'supabase_admin' OR (SELECT system_identifier::text FROM pg_catalog.pg_control_system())<>'${target.systemIdentifier}' THEN RAISE EXCEPTION 'RECOVERY_TARGET_REFUSED'; END IF; END $target$;\n`+parts.join('\n')+'\nCOMMIT;',scope:'Exact backup metadata representation; owner already has default rights. No grant to any client/managed role, no comparator omission.'};
}
module.exports={build};
