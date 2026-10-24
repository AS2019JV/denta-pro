'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const ops=require('../../scripts/clinia-gate4-recovery-ops.cjs');
const codec=require('../../scripts/clinia-recovery-envelope.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/production/gate4-recovery-ops/policy.proposed.json')));
const now='2026-10-24T18:00:00.000Z', hash='1'.repeat(64), sha='a'.repeat(40);
function approved() {
  const q=structuredClone(p); q.state='APPROVED';
  q.approval={responsible:'Synthetic owner',decisionReceipt:'synthetic-local-test'};
  Object.assign(q.custody,{
    backupLocation:'synthetic-copy-site',backupCustodian:'synthetic-operator-a',
    keyLocation:'synthetic-key-site',keyCustodian:'synthetic-operator-b',
    independentRecoveryOperator:'synthetic-operator-c',offsiteAuthorization:'synthetic-only',
    offsiteReceipt:'synthetic-only'
  }); return q;
}
function complete() {
  return {
    scope:'FINAL_CANDIDATE_OPERATIONAL',finalCandidateReceived:true,candidateSHA:sha,approvedCandidateSHA:sha,
    ci:{sha,conclusion:'success'},environmentReceipt:'synthetic-only',backupCapturedAt:'2026-10-24T17:00:00.000Z',
    drillCompletedAt:'2026-10-24T17:30:00.000Z',checks:Object.fromEntries(ops.requiredChecks.map(k=>[k,true])),
    ordinaryAuthority:true,serviceRoleUsedForOrdinary:false,representativeVolume:true,independentRecovery:true,alertAcknowledged:true,
    recoveryStartedAt:'2026-10-24T17:00:00.000Z',allChecksCompletedAt:'2026-10-24T17:30:00.000Z',
    incidentAt:'2026-10-24T17:10:00.000Z',sourceIdentity:'synthetic-source',
    sourceProof:{fresh:true,sameSnapshot:true,writerBoundaryProven:true,allCommittedWritesCompared:true,
      receiptSha256:hash,lostCommittedWrites:0,sourceIdentity:'synthetic-source',verifiedAt:'2026-10-24T17:40:00.000Z'}
  };
}
test('proposed targets and local snapshot do not imply operational GO',()=>{
  const r=ops.evaluate(p,{backupCapturedAt:'2026-10-21T18:00:28.836Z'},now);
  assert.equal(r.status,'BLOCKED'); assert.equal(r.rpoUpperBoundSeconds,null); assert.equal(r.operationalGo,false);
  assert.ok(r.reasons.includes('OWNER_OBJECTIVES_NOT_APPROVED'));assert.ok(r.reasons.includes('BACKUP_STALE_OR_FUTURE'));
});
test('synthetically complete input requests owner review and never grants GO',()=>{
  const r=ops.evaluate(approved(),complete(),now);
  assert.equal(r.status,'EVIDENCE_COMPLETE_REQUIRES_OWNER_REVIEW');assert.equal(r.measuredRtoSeconds,1800);
  assert.equal(r.operationalGo,false);assert.equal(r.uploads,0);assert.equal(r.deletes,0);
});
test('missing immutable candidate cannot pass through undefined identities',()=>{
  const e=complete();delete e.candidateSHA;delete e.approvedCandidateSHA;delete e.ci.sha;
  assert.ok(ops.evaluate(approved(),e,now).reasons.includes('FINAL_SHA_CI_ENVIRONMENT_NOT_VERIFIED'));
});
test('green CI for a different candidate is rejected',()=>{
  const e=complete();e.ci.sha='b'.repeat(40);
  assert.ok(ops.evaluate(approved(),e,now).reasons.includes('FINAL_SHA_CI_ENVIRONMENT_NOT_VERIFIED'));
});
test('historical zero-loss snapshot and stale proof cannot supply current RPO',()=>{
  for(const change of [{fresh:false},{verifiedAt:'2026-10-21T18:00:00.000Z'},{sourceIdentity:'other-source'}]){
    const e=complete();Object.assign(e.sourceProof,change);
    assert.equal(ops.evaluate(approved(),e,now).rpoUpperBoundSeconds,null);
  }
});
test('full RTO includes last byte and later checks',()=>{
  const e=complete();e.allChecksCompletedAt='2026-10-24T18:00:00.000Z';
  const q=approved();q.objectives.rtoSeconds=1800;
  const r=ops.evaluate(q,e,now);assert.equal(r.measuredRtoSeconds,3600);assert.ok(r.reasons.includes('PROPOSED_RTO_EXCEEDED'));
});
test('future and invalid calendar dates cannot silently become evidence',()=>{
  const e=complete();e.backupCapturedAt='2026-10-25T00:00:00.000Z';delete e.sourceProof;
  assert.ok(ops.evaluate(approved(),e,now).reasons.includes('BACKUP_STALE_OR_FUTURE'));
  assert.throws(()=>ops.timestamp('2026-02-30T00:00:00Z'));assert.throws(()=>ops.timestamp('invalid'));
});
function entries() {
  return Array.from({length:12},(_,i)=>({
    id:'copy-'+i,capturedAt:new Date(Date.parse(now)-i*86400000).toISOString(),archiveSha256:hash,
    verified:true,independentCopyVerified:true,keyRecoveryVerified:true,hold:false
  }));
}
test('retention never expires held, unverified, or key-unrecoverable copies',()=>{
  const q=approved();q.retention.daily=1;q.retention.weekly=1;q.retention.monthly=1;
  const rows=entries();rows[5].hold=true;rows[6].verified=false;rows[7].keyRecoveryVerified=false;
  const r=ops.retentionPlan(q,rows,now);
  for(const i of [5,6,7])assert.equal(r.entries.find(x=>x.id==='copy-'+i).action,'KEEP');
  assert.ok(r.entries.some(x=>x.action==='REVIEW_EXPIRY_ONLY'));assert.equal(r.deletes,0);
});
test('insufficient independent copies blocks every expiry proposal',()=>{
  const rows=entries();rows.forEach(r=>r.independentCopyVerified=false);
  assert.ok(ops.retentionPlan(approved(),rows,now).entries.every(r=>r.action==='KEEP'));
});
test('retention rejects duplicate and future backup identities',()=>{
  const rows=entries();assert.throws(()=>ops.retentionPlan(p,[rows[0],rows[0]],now));
  rows[0].capturedAt='2026-10-25T00:00:00.000Z';assert.throws(()=>ops.retentionPlan(p,rows,now));
});
function selective() {
  return {authority:'ordinary-aal2',serviceRole:false,own:{status:200,matchesExpectedIdentity:true,rows:1},
    foreign:{status:200,rows:0},anonymous:{status:401,bytes:0},
    delivery:{status:200,bytes:53,sha256:hash,private:true,throughApplicationBoundary:true,cacheControl:"private, no-store"},
    foreignDelivery:{status:403,bytes:0},expected:{bytes:53,sha256:hash,prefixSha256:hash},
    range:{status:206,start:0,end:7,total:53,bytes:8,sha256:hash,cacheControl:'private, no-store'}};
}
test('closed baseline or privileged delivery cannot be a selective PASS',()=>{
  const closed=selective();closed.own={status:403,rows:0};
  assert.equal(ops.selectiveEvidence(closed).status,'NOT_VERIFIED');
  const privileged=selective();privileged.serviceRole=true;
  assert.equal(ops.selectiveEvidence(privileged).status,'NOT_VERIFIED');
});
test('delivery requires exact bytes through app boundary, with other clinic denied',()=>{
  assert.equal(ops.selectiveEvidence(selective()).status,'PASS_LOCAL_SELECTIVE_CONTRACT');
  for(const delta of [{bytes:52},{sha256:'2'.repeat(64)},{throughApplicationBoundary:false},{private:false}]){
    const r=selective();Object.assign(r.delivery,delta);assert.equal(ops.selectiveEvidence(r).status,'NOT_VERIFIED');
  }
  const r=selective();r.foreignDelivery={status:200,bytes:53};assert.equal(ops.selectiveEvidence(r).status,'NOT_VERIFIED');
});
test('existing authenticated codec preserves payload and rejects wrong key, tamper and truncation',()=>{
  const key=crypto.randomBytes(32),wrong=crypto.randomBytes(32),payload=Buffer.from('Gate4 synthetic test only');
  try {
    const encrypted=codec.encrypt(payload,key);assert.deepEqual(codec.decrypt(encrypted,key),payload);
    assert.throws(()=>codec.decrypt(encrypted,wrong));
    const bad=Buffer.from(encrypted);bad[bad.length-1]^=1;
    assert.throws(()=>codec.decrypt(bad,key));assert.throws(()=>codec.decrypt(encrypted.subarray(0,-1),key));
  }finally{key.fill(0);wrong.fill(0);}
});
test('selective delivery requires actual no-store directive',()=>{
  for(const cacheControl of ['', 'private', 'public, max-age=3600']) {
    const r=selective();r.delivery.cacheControl=cacheControl;
    assert.equal(ops.selectiveEvidence(r).status,'NOT_VERIFIED');
  }
});
test('selective Range must prove exact prefix bytes, total and private caching',()=>{
  for(const delta of [{status:200},{bytes:7},{total:54},{end:8},{sha256:'2'.repeat(64)},{cacheControl:'private'}]) {
    const r=selective();Object.assign(r.range,delta);
    assert.equal(ops.selectiveEvidence(r).status,'NOT_VERIFIED');
  }
});
