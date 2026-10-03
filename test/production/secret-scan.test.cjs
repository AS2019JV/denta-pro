'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectText } = require('../../scripts/clinia-secret-scan.cjs');
const jwt = role => ['eyJ' + Buffer.from('{"alg":"HS256"}').toString('base64url').slice(3), Buffer.from(JSON.stringify({ role })).toString('base64url'), 'syntheticSignature'].join('.');

test('Privileged credentials are detected without disclosing values', () => {
  const samples = [
    ['supabase-secret-key', 'sb_' + 'secret_' + 'a'.repeat(30)],
    ['supabase-personal-token', 'sb' + 'p_' + 'a'.repeat(40)],
    ['resend-key', 'r' + 'e_' + 'a'.repeat(30)],
    ['github-token', 'gh' + 'p_' + 'a'.repeat(40)],
    ['private-key', '-----BEGIN ' + 'PRIVATE KEY-----'],
    ['supabase-service-jwt', jwt('service_role')],
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
