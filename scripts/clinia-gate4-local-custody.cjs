'use strict';
// Authenticate a NEW local ciphertext/key copy. Never restore DB or write plaintext.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const codec=require('./clinia-recovery-envelope.cjs');
const ROOT=path.resolve(__dirname,'..'), PRIVATE=path.join(ROOT,'.gate4-private');
const EXPECTED={
  archive:'2626ec45be9b4e7c38471fa0ab7eaf55e9952b846c928a5279bd8ff006ca7256',
  dump:'e78df7646b06eb479c0d0645cc27cca647dd88f41b0c2ef959701b68d66de7e0',
  candidate:'bdba2368c657a926ee849bc75f62dfda957b1801'
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function noLinks(file) {
  let p=path.resolve(file);
  for (;;) {
    assert.ok(!fs.lstatSync(p).isSymbolicLink(), 'Link refused');
    const parent=path.dirname(p); if(parent===p) break; p=parent;
  }
  return fs.realpathSync(file);
}
function paths(attempt) {
  assert.match(attempt,/^custody-[0-9]{2}$/);
  return {
    archive:path.join(PRIVATE,'archives',attempt,'baseline.aesgcm'),
    key:path.join(PRIVATE,'keys',attempt,'baseline.key')
  };
}
function authenticate(envelope,key) {
  assert.equal(sha(envelope),EXPECTED.archive,'Unexpected archive');
  let plaintext,dump;
  try {
    plaintext=codec.decrypt(envelope,key); // GCM final before JSON parsing.
    const bundle=JSON.parse(plaintext);
    assert.equal(bundle.candidate,EXPECTED.candidate);
    assert.equal(bundle.project,'fbtlldubzomocuhpvweg');
    dump=Buffer.from(bundle.databaseCustom,'base64');
    assert.equal(sha(dump),EXPECTED.dump);
    assert.equal(dump.subarray(0,5).toString(),'PGDMP');
    assert.equal(bundle.actors.length,2);
    assert.ok(bundle.actors.every(a=>a.originalFactorVerified===true && a.password.length>0 &&
      /^[A-Z2-7]+=*$/.test(a.totp) && /^[a-f0-9-]{36}$/.test(a.factor)));
    assert.equal(new Set(bundle.actors.map(a=>a.factor)).size,2);
    assert.equal(Object.keys(bundle.dataProof).length,35);
    for(const value of Object.values(bundle.dataProof)) {
      assert.ok(Number.isSafeInteger(value.count) && value.count>=0);
      assert.match(value.sha256,/^[a-f0-9]{64}$/);
    }
    assert.ok(bundle.configuration && bundle.managedMetadata && bundle.applicationBaselineContract);
    assert.equal(bundle.storage.length,1);
    const objectChecks=bundle.storage.map(o=>{
      const bytes=Buffer.from(o.base64,'base64');
      try {
        assert.equal(bytes.length,o.length); assert.equal(sha(bytes),o.sha256);
        return {bytes:bytes.length,sha256:o.sha256};
      } finally { bytes.fill(0); }
    });
    assert.equal(objectChecks.reduce((n,o)=>n+o.bytes,0),53);
    return {
      authenticatedBeforeParse:true,capturedAt:bundle.capturedAt,databaseBytes:dump.length,
      databaseSha256:EXPECTED.dump,originalFactorPayloads:2,cohorts:35,objects:objectChecks,
      configurationPayloadPreserved:true,managedAndApplicationContractsPreserved:true,
      // This is archive authentication, not live Auth or a DB restore.
      databaseRestoreExecuted:false,ordinaryMfaLoginExecuted:false,applicationRecovery:false
    };
  } finally { if(plaintext) plaintext.fill(0); if(dump) dump.fill(0); }
}
function negativeChecks(envelope,key) {
  const wrong=crypto.randomBytes(32), changed=Buffer.from(envelope);
  changed[changed.length-1]^=1;
  try {
    assert.throws(()=>codec.decrypt(envelope,wrong));
    assert.throws(()=>codec.decrypt(changed,key));
    assert.throws(()=>codec.decrypt(envelope.subarray(0,envelope.length-1),key));
    return {wrongKeyRejected:true,tamperRejected:true,truncationRejected:true};
  } finally { wrong.fill(0); changed.fill(0); }
}
function writeReceipt(file,report) {
  const parent=noLinks(path.dirname(file));
  assert.equal(parent,path.join(ROOT,'docs/production/evidence/2026-10-24-gate4-recovery-ops'));
  const fd=fs.openSync(file,'wx');
  try { fs.writeFileSync(fd,JSON.stringify(report,null,2)+'\n'); fs.fsyncSync(fd); } finally {fs.closeSync(fd);}
}
function main() {
  const [mode,attempt,receipt,sourceArchive,sourceKey]=process.argv.slice(2);
  assert.ok(['copy','verify'].includes(mode));
  const startedAt=new Date().toISOString(), start=performance.now(), dest=paths(attempt);
  const report={mode,attempt,startedAt,sourceModified:false,offsite:false,independentCustody:false,
    plaintextPersisted:false,remoteOperations:0,sourceRestore:false,
    scope:'LOCAL_NEW_COPY_AUTHENTICATION_ONLY_NOT_RECOVERY_RTO_OR_CURRENT_RPO'};
  let key,envelope;
  try {
    if(mode==='copy') {
      assert.notEqual(noLinks(sourceArchive),noLinks(sourceKey));
      assert.ok(!fs.existsSync(dest.archive)&&!fs.existsSync(dest.key),'Never reuse a custody attempt');
      noLinks(path.dirname(dest.archive)); noLinks(path.dirname(dest.key));
      key=fs.readFileSync(sourceKey); envelope=fs.readFileSync(sourceArchive);
      assert.equal(key.length,32); authenticate(envelope,key);
      // Exclusive copy, then fsync; failure preserves any partial destination for review.
      fs.copyFileSync(sourceArchive,dest.archive,fs.constants.COPYFILE_EXCL);
      fs.copyFileSync(sourceKey,dest.key,fs.constants.COPYFILE_EXCL);
      for(const file of [dest.archive,dest.key]) { const fd=fs.openSync(file,'r+'); try {fs.fsyncSync(fd);} finally {fs.closeSync(fd);} }
    }
    noLinks(dest.archive); noLinks(dest.key);
    const copiedKey=fs.readFileSync(dest.key), copiedEnvelope=fs.readFileSync(dest.archive);
    try {
      assert.equal(copiedKey.length,32);
      report.payload=authenticate(copiedEnvelope,copiedKey);
      report.negativeControls=negativeChecks(copiedEnvelope,copiedKey);
      if(mode==='copy') {
        assert.ok(copiedEnvelope.equals(envelope)); assert.ok(copiedKey.equals(key));
        const afterKey=fs.readFileSync(sourceKey);
        try { assert.ok(afterKey.equals(key)); } finally {afterKey.fill(0);}
        assert.equal(sha(fs.readFileSync(sourceArchive)),EXPECTED.archive);
        report.sourceHashesUnchangedAfterCopy=true;
      }
      report.archiveSha256=sha(copiedEnvelope);
      report.completedAt=new Date().toISOString();
      report.localCopyCheckSeconds=Number(((performance.now()-start)/1000).toFixed(3));
      report.status='PASS_LOCAL_CIPHERTEXT_KEY_COPY_AND_PAYLOAD_AUTHENTICATION';
      writeReceipt(receipt,report);
      console.log(JSON.stringify({status:report.status,attempt,elapsedSeconds:report.localCopyCheckSeconds}));
    } finally {copiedKey.fill(0); copiedEnvelope.fill(0);}
  } finally {if(key) key.fill(0); if(envelope) envelope.fill(0);}
}
if(require.main===module) {
  try {main();} catch {console.error('GATE4_CUSTODY_REFUSED_PRESERVE_FILES_NO_RETRY');process.exitCode=1;}
}
module.exports={authenticate,negativeChecks,paths};
