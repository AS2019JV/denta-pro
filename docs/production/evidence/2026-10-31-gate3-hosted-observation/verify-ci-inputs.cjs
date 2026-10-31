'use strict';
// Verify supplied public files only; no dependency registry or database access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'ci-input-manifest.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) {
  throw new Error('INPUT_MANIFEST_REFUSED');
}
const seen = new Set();
for (const entry of manifest.files) {
  if (typeof entry.path !== 'string' || seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error('INPUT_ENTRY_REFUSED');
  }
  seen.add(entry.path);
  const file = path.resolve(root, entry.path);
  if (!file.startsWith(root + path.sep) || fs.lstatSync(file).isSymbolicLink()) {
    throw new Error('INPUT_PATH_REFUSED');
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length !== entry.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error('INPUT_HASH_REFUSED');
  }
}
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (config.git?.deploymentEnabled?.['codex/clinia-hosted-observation-01'] !== false) {
  throw new Error('DEPLOYMENT_EXCLUSION_REFUSED');
}
if (manifest.nativeExecutionAuthorized !== false || manifest.applicationAcceptance !== false) {
  throw new Error('SCOPE_REFUSED');
}
console.log(JSON.stringify({ verifiedInputs: seen.size, networkCalls: 0, nativeCalls: 0, applicationAcceptance: false }));
