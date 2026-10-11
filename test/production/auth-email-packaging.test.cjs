'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { verifyAuthEmailTraces } = require('../../scripts/clinia-verify.cjs');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clinia-email-trace-'));
  fs.mkdirSync(path.join(directory, 'emails'));
  fs.writeFileSync(path.join(directory, 'emails/signup-confirmation.html'), 'synthetic template');
  for (const route of ['login', 'signup']) {
    const manifest = path.join(directory, '.next/server/app/(auth)', route, 'page.js.nft.json');
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, JSON.stringify({ files: ['../../../../../emails/signup-confirmation.html'] }));
  }
  return directory;
}
function cleanup(directory) {
  const target = path.resolve(directory);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith('clinia-email-trace-'));
  fs.rmSync(target, { recursive: true, force: true });
}
test('build acceptance rejects either Auth route omitting its runtime email template', () => {
  for (const route of ['login', 'signup']) {
    const directory = fixture();
    try {
      fs.writeFileSync(path.join(directory, '.next/server/app/(auth)', route, 'page.js.nft.json'), '{"files":[]}');
      assert.throws(() => verifyAuthEmailTraces(directory), new RegExp(`absent from /${route}`));
    } finally { cleanup(directory); }
  }
});
test('build acceptance requires both traces and the packaged template', () => {
  const directory = fixture();
  try {
    assert.equal(verifyAuthEmailTraces(directory).status, 'VERIFIED');
    fs.unlinkSync(path.join(directory, 'emails/signup-confirmation.html'));
    assert.throws(() => verifyAuthEmailTraces(directory));
  } finally { cleanup(directory); }
});
