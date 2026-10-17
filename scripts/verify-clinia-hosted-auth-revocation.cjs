'use strict';
// Fixed staging, fixed owned fixture and original matrix binding. Never log JWTs,
// login bodies, provider credentials, patient bodies or signed URLs.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const runtime = require('./clinia-staging-runtime.cjs'), driver = require('./verify-clinia-hosted-api.cjs');
async function main() {
  assert.deepEqual(process.argv.slice(2), ['1', driver.PROJECT], 'Explicit authorized staging attempt required');
  const config = runtime.readConfig(), plan = driver.plan('matrix', '1', driver.PROJECT, '3');
  const state = driver.ownedState(JSON.parse(fs.readFileSync(plan.privateFile)), '1');
  driver.verifiedMatrix(state, plan.directory, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'verify-clinia-hosted-api.cjs'))).digest('hex'));
  const matrix = {filename:'matrix-run-3.json',fileSha256:crypto.createHash('sha256').update(fs.readFileSync(plan.report)).digest('hex')};
  const actor = state.actors.auth_revoked_A;
  driver.jwtUnexpired(actor.token, actor.id);
  const media = driver.mediaSpecs(state, '3')[0];
  const report = {status:'PARTIALLY VERIFIED', startedAt:new Date().toISOString(), project:driver.PROJECT, actor:'auth_revoked_A', verifiedMatrix:matrix, requests:[], checks:[], limits:['Synthetic owned staging actor only; no browser/deployment proof', 'Cached downloads are checked separately from fresh RLS/sign authorization']};
  let banAttempted = false;
  async function q(route, options = {}) {
    driver.providerUrl(config.origin + route, options.privileged || false);
    const result = await runtime.request(config, route, options);
    report.requests.push({method:options.method || 'GET', path:route.split('?')[0], status:result.status, code:result.data?.code || result.data?.error_code || null, bytes:result.bytes.length, bodySha256:crypto.createHash('sha256').update(result.bytes).digest('hex')});
    return result;
  }
  const role = token => q('/rest/v1/rpc/get_clinic_member_role',{method:'POST',token,body:{check_clinic_id:state.fixtures.clinicA}});
  const clinical = token => q('/rest/v1/rpc/get_patients_with_stats',{method:'POST',token,body:{p_clinic_id:state.fixtures.clinicA,p_patient_id:state.fixtures.patientA}});
  const download = token => q('/storage/v1/object/'+media.bucket+'/'+media.object,{token,raw:true});
  const sign = token => q('/storage/v1/object/sign/'+media.bucket+'/'+media.object,{method:'POST',token,body:{expiresIn:5}});
  async function before(token) {
    assert.equal((await role(token)).data,'doctor');
    const rows = await clinical(token); assert.equal(rows.status,200); assert.ok(JSON.stringify(rows.data).includes(state.fixtures.patientA),'Positive clinical RPC must contain the owned fixture patient');
    assert.equal((await download(token)).status,200); assert.equal((await sign(token)).status,200);
  }
  async function after(name, token) {
    const r = await role(token), rows = await clinical(token), signed = await sign(token), bytes = await download(token);
    const authorityDenied = r.status===200 && r.data===null && rows.status===403 && rows.data?.code==='42501' && signed.status===400 && signed.data?.code==='NoSuchKey';
    report.checks.push({name:name+' fresh database and sign authorization',status:authorityDenied?'VERIFIED':'PARTIALLY VERIFIED',expected:'role null, clinical RPC 42501, sign NoSuchKey'});
    report.checks.push({name:name+' same previously warmed private object',status:[400,401,403,404].includes(bytes.status)?'VERIFIED':'PARTIALLY VERIFIED',expected:'download denied without new JWT',actualHttpStatus:bytes.status});
  }
  try {
    await before(actor.token);
    const logout = await q('/auth/v1/logout?scope=global',{method:'POST',token:actor.token,privileged:true}); assert.ok([200,204].includes(logout.status));
    await after('Global logout with retained original JWT',actor.token);
    const login = await q('/auth/v1/token?grant_type=password',{method:'POST',body:{email:actor.email,password:actor.password}});
    assert.equal(login.status,200); assert.equal(login.data?.user?.id,actor.id);
    const fresh = login.data?.access_token; driver.jwtUnexpired(fresh,actor.id);
    await before(fresh);
    banAttempted = true;
    const ban = await q('/auth/v1/admin/users/'+actor.id,{method:'PUT',token:config.service,privileged:true,body:{ban_duration:'1h'}}); assert.equal(ban.status,200);
    await after('Auth ban with retained fresh JWT',fresh);
    report.status=report.checks.every(c=>c.status==='VERIFIED')?'VERIFIED':'PARTIALLY VERIFIED';
  } catch { report.failure='Guarded proof failed; inspect safe statuses and named checks'; process.exitCode=1; }
  finally {
    if(banAttempted)try{assert.equal((await q('/auth/v1/admin/users/'+actor.id,{method:'PUT',token:config.service,privileged:true,body:{ban_duration:'none'}})).status,200);report.testBanLifted=true;}catch{report.testBanLifted=false;report.status='PARTIALLY VERIFIED';process.exitCode=1;}
    report.completedAt=new Date().toISOString();
    const file=path.join(plan.directory,'auth-revocation-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});
    if(report.status!=='VERIFIED')process.exitCode=1;
    console.log(JSON.stringify({status:report.status,checks:report.checks,evidence:file,testBanLifted:report.testBanLifted}));
  }
}
if(require.main===module)main().catch(()=>{console.error('Staging fixture or binding refused');process.exitCode=1;});
