'use strict';
// Pure operational decisions. No networking, SQL, scheduler, upload, or deletion.
const assert = require('node:assert/strict');
const requiredChecks = [
  'database', 'originalAuthMfa', 'configuration', 'allStorageBytes',
  'catalogsAndSequences', 'ownClinicAllowed', 'foreignClinicDenied',
  'anonymousDenied', 'privateDelivery'
];
function timestamp(value) {
  assert.equal(typeof value, 'string', 'UTC timestamp required');
  assert.match(value, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/);
  const ms = Date.parse(value);
  assert.ok(Number.isFinite(ms), 'Invalid timestamp');
  assert.equal(new Date(ms).toISOString().slice(0, 19), value.slice(0, 19), 'Invalid calendar date');
  return ms;
}
function sha(value) { assert.match(value, /^[a-f0-9]{64}$/); return value; }
function candidate(value) { assert.match(value, /^[a-f0-9]{40}$/); return value; }
function checkPolicy(p) {
  assert.equal(p.version, 1);
  assert.equal(p.gate, 'Gate4');
  candidate(p.baseSHA);
  for (const key of ['rpoSeconds','rtoSeconds','maxBackupAgeSeconds','maxRestoreDrillAgeSeconds'])
    assert.ok(Number.isSafeInteger(p.objectives[key]) && p.objectives[key] > 0);
  for (const key of ['daily','weekly','monthly','minimumVerifiedIndependentCopies'])
    assert.ok(Number.isSafeInteger(p.retention[key]) && p.retention[key] > 0);
  assert.equal(p.retention.deleteEnabled, false, 'This tool never deletes backups');
  return p;
}
function evaluate(p, e, now) {
  checkPolicy(p);
  const current = timestamp(now), reasons = [];
  const need = (ok, reason) => { if (!ok) reasons.push(reason); };
  need(p.state === 'APPROVED' && typeof p.approval?.responsible === 'string' &&
    p.approval.responsible.trim().length > 0 && typeof p.approval?.decisionReceipt === 'string' &&
    p.approval.decisionReceipt.trim().length > 0, 'OWNER_OBJECTIVES_NOT_APPROVED');
  // An approval claim is input evidence, not authority to run a remote operation.
  for (const key of ['backupLocation','backupCustodian','keyLocation','keyCustodian','independentRecoveryOperator','offsiteAuthorization','offsiteReceipt'])
    need(typeof p.custody[key] === 'string' && p.custody[key].trim().length > 0, 'CUSTODY_' + key + '_PENDING');
  need(p.custody.backupLocation !== p.custody.keyLocation, 'BACKUP_AND_KEY_LOCATIONS_NOT_SEPARATED');
  need(p.custody.backupCustodian !== p.custody.keyCustodian, 'BACKUP_AND_KEY_CUSTODIANS_NOT_SEPARATED');
  need(e.scope === 'FINAL_CANDIDATE_OPERATIONAL', 'LAB_SCOPE_DOES_NOT_PROVE_OPERATIONAL_RECOVERY');
  if (e.candidateSHA !== undefined) candidate(e.candidateSHA);
  need(typeof e.candidateSHA === 'string' && e.finalCandidateReceived === true && e.candidateSHA === e.approvedCandidateSHA &&
    e.ci?.sha === e.candidateSHA && e.ci?.conclusion === 'success' &&
    typeof e.environmentReceipt === 'string' && e.environmentReceipt.length > 0, 'FINAL_SHA_CI_ENVIRONMENT_NOT_VERIFIED');
  if (e.backupCapturedAt) {
    const age = current - timestamp(e.backupCapturedAt);
    need(age >= 0 && age <= p.objectives.maxBackupAgeSeconds * 1000, 'BACKUP_STALE_OR_FUTURE');
  } else reasons.push('BACKUP_TIMESTAMP_MISSING');
  if (e.drillCompletedAt) {
    const age = current - timestamp(e.drillCompletedAt);
    need(age >= 0 && age <= p.objectives.maxRestoreDrillAgeSeconds * 1000, 'DRILL_STALE_OR_FUTURE');
  } else reasons.push('DRILL_TIMESTAMP_MISSING');
  for (const key of requiredChecks) need(e.checks?.[key] === true, 'CHECK_' + key + '_MISSING');
  need(e.ordinaryAuthority === true && e.serviceRoleUsedForOrdinary === false, 'ORDINARY_AUTHORITY_NOT_PROVEN');
  need(e.representativeVolume === true, 'REPRESENTATIVE_VOLUME_NOT_PROVEN');
  need(e.independentRecovery === true, 'INDEPENDENT_RECOVERY_NOT_PROVEN');
  need(e.alertAcknowledged === true, 'ALERT_ACK_NOT_PROVEN');
  let measuredRtoSeconds = null;
  if (e.recoveryStartedAt && e.allChecksCompletedAt) {
    const start = timestamp(e.recoveryStartedAt), end = timestamp(e.allChecksCompletedAt);
    assert.ok(end >= start && end <= current, 'Invalid full-scope timing');
    measuredRtoSeconds = (end - start) / 1000;
    need(measuredRtoSeconds <= p.objectives.rtoSeconds, 'PROPOSED_RTO_EXCEEDED');
  } else reasons.push('FULL_SCOPE_TIMING_MISSING');
  let rpoUpperBoundSeconds = null;
  // A historical snapshot copy never supplies evidence about current committed source writes.
  if (e.sourceProof?.fresh === true && e.sourceProof?.sameSnapshot === true &&
      e.sourceProof?.writerBoundaryProven === true && e.sourceProof?.allCommittedWritesCompared === true &&
      e.sourceProof?.sourceIdentity === e.sourceIdentity && typeof e.sourceIdentity === 'string' &&
      e.sourceProof?.verifiedAt && current - timestamp(e.sourceProof.verifiedAt) >= 0 &&
      current - timestamp(e.sourceProof.verifiedAt) <= p.objectives.maxBackupAgeSeconds * 1000 &&
      e.backupCapturedAt && e.incidentAt) {
    sha(e.sourceProof.receiptSha256);
    const snapshot = timestamp(e.backupCapturedAt), incident = timestamp(e.incidentAt);
    assert.ok(incident >= snapshot && incident <= current, 'Invalid incident interval');
    assert.ok(Number.isSafeInteger(e.sourceProof.lostCommittedWrites) && e.sourceProof.lostCommittedWrites >= 0);
    rpoUpperBoundSeconds = e.sourceProof.lostCommittedWrites === 0 ? 0 : (incident - snapshot) / 1000;
    need(rpoUpperBoundSeconds <= p.objectives.rpoSeconds, 'PROPOSED_RPO_EXCEEDED');
  } else reasons.push('CURRENT_SOURCE_RPO_NOT_MEASURED');
  return {
    status: reasons.length ? 'BLOCKED' : 'EVIDENCE_COMPLETE_REQUIRES_OWNER_REVIEW',
    reasons, measurementScope:e.scope || null, measuredRtoSeconds, rpoUpperBoundSeconds, operationalGo: false,
    action: reasons.length ? 'KEEP_NO_GO_AND_RECORD_PENDING' : 'PRESENT_RECEIPTS_TO_OWNER',
    uploads: 0, deletes: 0, messagesSent: 0
  };
}
function week(ms) {
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function retentionPlan(p, entries, now) {
  checkPolicy(p);
  const current = timestamp(now), ids = new Set();
  const rows = entries.map(e => {
    assert.match(e.id, /^[a-zA-Z0-9_-]{1,80}$/);
    assert.ok(!ids.has(e.id), 'Duplicate backup identity'); ids.add(e.id);
    sha(e.archiveSha256);
    const time = timestamp(e.capturedAt);
    assert.ok(time <= current, 'Future backup cannot authorize retention');
    return { ...e, time };
  }).sort((a,b) => b.time-a.time || a.id.localeCompare(b.id));
  const keep = new Set();
  // Keep newest backup in each of the latest distinct calendar buckets.
  for (const [count, key] of [
    [p.retention.daily, r => r.capturedAt.slice(0,10)],
    [p.retention.weekly, r => week(r.time)],
    [p.retention.monthly, r => r.capturedAt.slice(0,7)]
  ]) {
    const buckets = new Set();
    for (const r of rows) if (!buckets.has(key(r)) && buckets.size < count) {
      buckets.add(key(r)); keep.add(r.id);
    }
  }
  const independent = rows.filter(r => r.verified === true && r.independentCopyVerified === true &&
    r.keyRecoveryVerified === true && r.hold !== true);
  for (const r of independent.slice(0, p.retention.minimumVerifiedIndependentCopies)) keep.add(r.id);
  const result = rows.map(r => {
    const reasons = [];
    if (r.hold === true) reasons.push('EXPLICIT_HOLD');
    if (r.verified !== true) reasons.push('UNVERIFIED_BACKUP');
    if (r.independentCopyVerified !== true || r.keyRecoveryVerified !== true) reasons.push('CUSTODY_OR_KEY_NOT_VERIFIED');
    if (independent.length < p.retention.minimumVerifiedIndependentCopies) reasons.push('TOO_FEW_VERIFIED_INDEPENDENT_COPIES');
    if (keep.has(r.id)) reasons.push('RETENTION_BUCKET_OR_MINIMUM_COPY');
    return { id:r.id, archiveSha256:r.archiveSha256, action:reasons.length ? 'KEEP' : 'REVIEW_EXPIRY_ONLY', reasons };
  });
  return { status:'PLAN_ONLY_NO_DELETION', entries:result, deletes:0, clinicalRetentionApproved:false };
}
function selectiveEvidence(r) {
  // Testable acceptance contract only. Inputs must come from the future isolated runtime.
  const checks = {
    ordinary: r.authority === 'ordinary-aal2' && r.serviceRole === false,
    own: r.own?.status === 200 && r.own?.matchesExpectedIdentity === true && r.own?.rows > 0,
    foreign: [200,403,404].includes(r.foreign?.status) && r.foreign?.rows === 0,
    anonymous: [401,403,404].includes(r.anonymous?.status) && r.anonymous?.bytes === 0,
    privateDelivery: r.delivery?.status === 200 && r.delivery?.bytes === r.expected?.bytes &&
      r.expected?.bytes > 0 && /^[a-f0-9]{64}$/.test(r.expected?.sha256 || '') &&
      r.delivery?.sha256 === r.expected.sha256 && r.delivery?.private === true &&
      r.delivery?.throughApplicationBoundary === true &&
      /(?:^|,)\s*no-store\s*(?:,|$)/i.test(r.delivery?.cacheControl || ''),
    privateRange: r.expected?.bytes > 0 &&
      /^[a-f0-9]{64}$/.test(r.expected?.prefixSha256 || '') &&
      r.range?.status === 206 && r.range?.start === 0 &&
      r.range?.end === Math.min(7,r.expected.bytes-1) && r.range?.total === r.expected.bytes &&
      r.range?.bytes === Math.min(8,r.expected.bytes) &&
      r.range?.sha256 === r.expected.prefixSha256 &&
      /(?:^|,)\s*no-store\s*(?:,|$)/i.test(r.range?.cacheControl || ''),
    foreignDelivery: [401,403,404].includes(r.foreignDelivery?.status) && r.foreignDelivery?.bytes === 0
  };
  return {status:Object.values(checks).every(Boolean) ? 'PASS_LOCAL_SELECTIVE_CONTRACT' : 'NOT_VERIFIED', checks, productionGo:false};
}
if (require.main === module) {
  try {
    const fs=require('node:fs'), [mode,policyFile,inputFile,now]=process.argv.slice(2);
    assert.ok(['evaluate','retention'].includes(mode), 'evaluate|retention policy input UTC-now');
    const p=JSON.parse(fs.readFileSync(policyFile)), input=JSON.parse(fs.readFileSync(inputFile));
    const result=mode==='evaluate' ? evaluate(p,input,now) : retentionPlan(p,input,now);
    console.log(JSON.stringify(result,null,2));
    if (mode==='evaluate' && result.status==='BLOCKED') process.exitCode=2;
  } catch { console.error('GATE4_INVALID_INPUT_NO_ACTION'); process.exitCode=1; }
}
module.exports={timestamp,checkPolicy,evaluate,retentionPlan,selectiveEvidence,requiredChecks};
