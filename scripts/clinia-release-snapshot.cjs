'use strict';
// Local source copy only. Ignored files, env, credentials and build output stay out.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function classification(relative) {
  if (relative.split('/').some(part => ['.git', '.temp', 'node_modules', '.next', '.release-snapshots', '.playwright-cli'].includes(part))) return 'private-or-generated';
  if (/(?:^|\/)\.env(?:\.|$)|(?:private|credential|secret|actors).*\.(?:json|log|js|txt|toml)$/i.test(relative)) return 'private';
  if (/^(?:\.agents|\.agent|\.vscode|output|scratch|extra|skill|skills)\//.test(relative) || /\.(?:log|patch)$/.test(relative) || relative === 'desktop.ini') return 'historical-or-local-artifact';
  return 'source-or-public-evidence';
}
function snapshot(id) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) throw new Error('Use a lowercase snapshot ID');
  const destination = path.join(root, '.release-snapshots', id);
  if (fs.existsSync(destination)) throw new Error('Snapshot exists; use a new ID');
  const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean))].sort();
  const entries = [], exclusions = [];
  for (const relative of files) {
    const source = path.resolve(root, relative);
    if (!source.startsWith(root + path.sep)) throw new Error('Snapshot path escaped workspace');
    if (!fs.existsSync(source)) { exclusions.push({ path: relative, reason: 'deleted-in-working-tree' }); continue; }
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Review symlinks before snapshot');
    const reason = classification(relative);
    if (reason !== 'source-or-public-evidence') { exclusions.push({ path: relative, reason }); continue; }
    const bytes = fs.readFileSync(source);
    if (/\.(?:cjs|mjs|js|json|ts|tsx|md|sql|toml|txt|yml|yaml)$/.test(relative)) {
      const text = bytes.toString('utf8');
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bre_[A-Za-z0-9]{24,}\b|\bsbp_[a-f0-9]{32,}\b/.test(text)) throw new Error('Potential secret in ' + relative + '; review before snapshot');
      for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
        try { if (JSON.parse(Buffer.from(match[1], 'base64url')).role === 'service_role') throw new Error('Privileged JWT in ' + relative); } catch (error) { if (error.message.startsWith('Privileged JWT')) throw error; }
      }
    }
    entries.push({ path: relative, sha256: digest(bytes), size: bytes.length, bytes });
  }
  // Preflight everything before copy; preserve a partial destination on I/O failure.
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    const target = path.join(destination, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.bytes, { flag: 'wx' });
    if (digest(fs.readFileSync(target)) !== entry.sha256) throw new Error('Snapshot verification failed');
  }
  const listed = entries.map(({ bytes, ...entry }) => entry);
  const manifest = {
    createdAt: new Date().toISOString(), id,
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
    kind: 'working-tree source snapshot; not full Git backup or deployable artifact',
    files: listed, exclusions, treeSha256: digest(JSON.stringify(listed)), excludedIgnoredPrivateFiles: true,
  };
  fs.writeFileSync(path.join(destination, '.clinia-release-snapshot.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return { destination, manifest };
}
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Provide a unique snapshot ID');
    const result = snapshot(process.argv[2]);
    console.log(JSON.stringify({ snapshot: result.destination, files: result.manifest.files.length, exclusions: result.manifest.exclusions.length, treeSha256: result.manifest.treeSha256 }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { classification, snapshot };
