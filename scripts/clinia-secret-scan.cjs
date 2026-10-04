'use strict';
// Deliberately bounded credential rules. Reports locations, never matched values.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function inspectText(text) {
  const results = [];
  const rules = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
    ['supabase-personal-token', /\bsbp_[a-f0-9]{32,}\b/g],
    ['supabase-secret-key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
    ['resend-key', /\bre_[A-Za-z0-9]{24,}\b/g],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
    ['database-password-uri', /\bpostgres(?:ql)?:\/\/[^\s/@:]+:[^\s/@]+@[^\s'"<>]+/g],
  ];
  const add = (rule, offset) => results.push({ rule, line: text.slice(0, offset).split('\n').length });
  for (const [rule, pattern] of rules) for (const match of text.matchAll(pattern)) add(rule, match.index);
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
      if (claims.role === 'service_role') add('supabase-service-jwt', match.index);
      if (claims.role === 'clinia_document_delivery') add('supabase-document-delivery-jwt', match.index);
    } catch { /* A non-JWT string is not evidence of a privileged credential. */ }
  }
  return results;
}

function scan(root) {
  const manifestPath = path.join(root, '.clinia-release-snapshot.json');
  const files = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files.map(file => file.path)
    : execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  const findings = [];
  let scanned = 0;
  for (const relative of new Set(files)) {
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('Scan path escaped workspace');
    if (!fs.existsSync(absolute)) continue;
    if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error('Secret scan refuses symlinks');
    const bytes = fs.readFileSync(absolute);
    if (bytes.includes(0)) continue; // No binary/media credential claim.
    scanned++;
    for (const finding of inspectText(bytes.toString('utf8'))) findings.push({ path: relative, ...finding });
  }
  return { state: findings.length ? 'FAIL' : 'PASS', scanned, scope: 'Current Git-visible text files or release snapshot; no history, ignored files or deployed-secret claim', findings };
}

if (require.main === module) {
  try {
    const result = scan(path.resolve(__dirname, '..'));
    console.log(JSON.stringify(result, null, 2));
    if (result.findings.length) process.exitCode = 1;
  } catch { console.error('Credential scan failed; no credential contents emitted'); process.exitCode = 1; }
}
module.exports = { inspectText, scan };
