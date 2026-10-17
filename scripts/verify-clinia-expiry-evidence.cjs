'use strict';
// Independent artifact verifier: witnesses must bind the actual query/result,
// exact synthetic clinic/session and the frozen real response qualification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const d=require('./verify-clinia-document-runtime.cjs'),q=require('./verify-clinia-document-requalification.cjs');
const directory=path.resolve(__dirname,'../docs/production/evidence/2026-10-05-document-requalification');
const ACTOR='ae54f779-8e99-414a-87ee-b554107e7f8a',CLINIC='d9a47157-1d36-43df-af1d-436d561ee551',SESSION='41069974-b77e-4d29-9fd0-383db5b3fdea';
function authoritySql(phase){
 assert.ok(['before','after'].includes(phase));
 return `SELECT now() observed_at, '${phase}' phase, '${ACTOR}' actor_id, '${CLINIC}' clinic_id, '${SESSION}' session_id,
 p.status='active' profile_active, p.deleted_at IS NULL profile_not_deleted,
 EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.user_id=p.id AND m.clinic_id='${CLINIC}' AND m.role='doctor' AND m.status='active') doctor_membership_active,
 u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) auth_user_active,
 EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id='${SESSION}' AND s.user_id=p.id) session_present
 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id='${ACTOR}' AND p.role='doctor' AND p.clinic_id='${CLINIC}'
 AND p.email ~ '^clinia-document-expiry_a-[a-f0-9]{12}@clinia\\.invalid$';`;
}
function providerRow(result){
 assert.equal(result.isError,false);const raw=JSON.parse(result.content[0].text).result;
 const begin=raw.indexOf('\n[{'),end=raw.indexOf('\n</untrusted-data-',begin);assert.ok(begin>=0&&end>begin);
 const rows=JSON.parse(raw.slice(begin,end).trim());assert.equal(rows.length,1);return rows[0];
}
function witness(phase,sql,result,sqlHash,resultHash){
 assert.equal(sql,authoritySql(phase));const r=providerRow(result);
 assert.equal(r.phase,phase);assert.equal(r.actor_id,ACTOR);assert.equal(r.clinic_id,CLINIC);assert.equal(r.session_id,SESSION);
 const out={status:'VERIFIED',project:d.PROJECT,candidateHead:q.CANDIDATE,phase,actorId:ACTOR,clinicId:CLINIC,sessionId:SESSION,
  observedAt:new Date(r.observed_at).toISOString(),sqlFile:'expiry-authority-'+phase+'.sql',providerReceiptFile:'expiry-authority-'+phase+'.provider.json',
  sqlSha256:sqlHash,providerReceiptSha256:resultHash};
 for(const [key,column] of [['profileActive','profile_active'],['profileNotDeleted','profile_not_deleted'],['doctorMembershipActive','doctor_membership_active'],
  ['authUserActive','auth_user_active'],['sessionPresent','session_present']]){assert.equal(r[column],true);out[key]=true;}
 return out;
}
function read(name){assert.match(name,/^[a-z0-9.-]+$/);const file=path.join(directory,name);assert.ok(!fs.lstatSync(file).isSymbolicLink());const bytes=fs.readFileSync(file);return {bytes,sha256:d.sha(bytes),value:JSON.parse(bytes)};}
function verifyWitness(phase){
 const w=read('expiry-authority-'+phase+'.json');
 const sqlFile=path.join(directory,'expiry-authority-'+phase+'.sql');assert.ok(!fs.lstatSync(sqlFile).isSymbolicLink());const sql=fs.readFileSync(sqlFile);
 const result=read('expiry-authority-'+phase+'.provider.json');
 assert.deepEqual(w.value,witness(phase,sql.toString(),result.value,d.sha(sql),result.sha256));return w;
}
function main(args){
 assert.deepEqual(args,[d.PROJECT]);const before=verifyWitness('before'),after=verifyWitness('after');
 const sources=fs.readdirSync(directory).filter(n=>/^qualify-expiry-\d+\.json$/.test(n)).sort().reverse();assert.ok(sources.length);
 const source=read(sources[0]);assert.equal(source.value.status,'VERIFIED');assert.equal(source.value.candidate.candidateHead,q.CANDIDATE);
 assert.equal(source.value.authorityEvidence.beforeSha256,before.sha256);assert.equal(source.value.authorityEvidence.afterSha256,after.sha256);
 const responses=read(source.value.expiredResponseEvidence.filename);assert.equal(responses.sha256,source.value.expiredResponseEvidence.sha256);
 q.verifyExpiryAuthority(before.value,after.value,responses.value,ACTOR,SESSION);
 const report={status:'VERIFIED',project:d.PROJECT,candidateHead:q.CANDIDATE,verifiedAt:new Date().toISOString(),
  command:'node scripts/verify-clinia-expiry-evidence.cjs '+d.PROJECT,verifierSha256:d.sha(fs.readFileSync(__filename)),
  actorId:ACTOR,clinicId:CLINIC,sessionId:SESSION,qualification:{filename:sources[0],sha256:source.sha256},
  before:{filename:'expiry-authority-before.json',sha256:before.sha256,sqlFile:before.value.sqlFile,sqlSha256:before.value.sqlSha256,
    providerReceiptFile:before.value.providerReceiptFile,providerReceiptSha256:before.value.providerReceiptSha256},
  after:{filename:'expiry-authority-after.json',sha256:after.sha256,sqlFile:after.value.sqlFile,sqlSha256:after.value.sqlSha256,
    providerReceiptFile:after.value.providerReceiptFile,providerReceiptSha256:after.value.providerReceiptSha256},
  limits:['Observed connector execution and immutable local artifact binding; not a cryptographic provider signature']};
 const file=path.join(directory,'expiry-independent-verification-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:report.status,evidence:file}));
}
if(require.main===module){try{main(process.argv.slice(2));}catch{console.error('Actual expiry SQL/provider witness verification failed');process.exitCode=1;}}
module.exports={authoritySql,providerRow,witness,ACTOR,CLINIC,SESSION};
