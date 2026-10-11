'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectText, scan } = require('../../scripts/clinia-secret-scan.cjs');
const jwt = role => ['eyJ' + Buffer.from('{"alg":"HS256"}').toString('base64url').slice(3), Buffer.from(JSON.stringify({ role })).toString('base64url'), 'syntheticSignature'].join('.');

test('Privileged credentials are detected without disclosing values', () => {
  const samples = [
    ['supabase-secret-key', 'sb_' + 'secret_' + 'a'.repeat(30)],
    ['supabase-personal-token', 'sb' + 'p_' + 'a'.repeat(40)],
    ['resend-key', 'r' + 'e_' + 'a'.repeat(30)],
    ['github-token', 'gh' + 'p_' + 'a'.repeat(40)],
    ['private-key', '-----BEGIN ' + 'PRIVATE KEY-----'],
    ['supabase-service-jwt', jwt('service_role')],
    ['supabase-document-delivery-jwt', jwt('clinia_document_delivery')],
    ['database-password-uri', 'postgresql://' + 'synthetic:syntheticPassword@db.invalid/postgres'],
  ];
  for (const [rule, value] of samples) {
    const findings = inspectText('first line\n' + value);
    assert.deepEqual(findings, [{ rule, line: 2 }]);
    assert.ok(!JSON.stringify(findings).includes(value));
  }
});

test('Public anon JWT and symbolic environment references are not privileged credentials', () => {
  assert.deepEqual(inspectText(jwt('anon') + '\nprocess.env.SUPABASE_SERVICE_ROLE_KEY\nsynthetic-offline-ci-key'), []);
});

test('release manifest is unioned with current Git-visible files without disclosing credentials', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clinia-secret-scan-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    fs.writeFileSync(path.join(root, 'old.cjs'), 'safe');
    execFileSync('git', ['add', 'old.cjs'], { cwd: root });
    fs.writeFileSync(path.join(root, '.clinia-release-snapshot.json'), JSON.stringify({ files: [{ path: 'old.cjs' }] }));
    const token = 'sb_' + 'secret_' + 'q'.repeat(30);
    fs.writeFileSync(path.join(root, 'new-unmanifested.cjs'), `const value = '${token}';`);

    const result = scan(root);
    assert.equal(result.state, 'FAIL');
    assert.ok(result.findings.some(finding => finding.path === 'new-unmanifested.cjs' && finding.rule === 'supabase-secret-key'));
    assert.ok(!JSON.stringify(result).includes(token));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
