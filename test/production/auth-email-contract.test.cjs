'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/auth-email-contract.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleValue, exports: moduleValue.exports, URL });
const contract = moduleValue.exports;
test('auth email links have a configured HTTPS origin and never fall back to localhost', () => {
  for (const value of [undefined, '', 'http://localhost:3000', 'https://user:pass@app.invalid',
    'https://app.invalid/path', 'https://app.invalid/?next=evil', 'https://app.invalid/#fragment',
    ' https://app.invalid', 'https://app.invalid:8443']) assert.equal(contract.configuredAuthOrigin(value), null);
  assert.equal(contract.configuredAuthOrigin('https://app.example.invalid/'), 'https://app.example.invalid');
  for (const type of ['signup', 'invite']) {
    const url = new URL(contract.authEmailLink('https://app.example.invalid', 'token+with/equals=', type));
    assert.equal(url.origin, 'https://app.example.invalid'); assert.equal(url.pathname, '/auth/confirm');
    assert.equal(url.searchParams.get('token_hash'), 'token+with/equals=');
    assert.equal(url.searchParams.get('type'), type); assert.equal(url.searchParams.get('next'), '/dashboard');
  }
  for (const token of [null, '', ' ', 'token\r\nheader', '<injection>', 'a'.repeat(2049)])
    assert.throws(() => contract.authEmailLink('https://app.example.invalid', token, 'signup'));
  assert.throws(() => contract.authEmailLink('https://app.example.invalid', 'token', 'recovery'));
});
test('Resend signup rendering and independent Supabase recovery template reach their exact handlers', () => {
  const cases = [
    ['signup', '/auth/confirm', '/dashboard'], ['recovery', '/api/auth/confirm', '/update-password'],
  ];
  for (const [type, handler, destination] of cases) {
    const spec = contract.AUTH_EMAIL_CONTRACT[type];
    let html = fs.readFileSync(path.join(root, spec.template), 'utf8');
    html = html.replace(/\{\{ \.SiteURL \}\}/g, 'https://app.example.invalid')
      .replace(/\{\{ \.TokenHash \}\}/g, 'synthetic-hash').replace(/\{\{ \.Type \}\}/g, type);
    const link = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]).find(link => link.includes('token_hash='));
    const url = new URL(link); assert.equal(url.origin, 'https://app.example.invalid');
    assert.equal(url.pathname, handler); assert.equal(url.searchParams.get('type'), type);
    assert.equal(url.searchParams.get('token_hash'), 'synthetic-hash');
    assert.equal(url.searchParams.get('next') || '/dashboard', destination);
    assert.ok(!link.includes('{{'));
  }
  assert.equal(contract.AUTH_EMAIL_CONTRACT.signup.provider, 'resend');
  assert.equal(contract.AUTH_EMAIL_CONTRACT.invite.provider, 'resend');
  assert.equal(contract.AUTH_EMAIL_CONTRACT.recovery.provider, 'supabase-smtp');
});
