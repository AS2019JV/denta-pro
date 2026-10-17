'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mfa = require('../../scripts/clinia-synthetic-mfa.cjs');

test('built-in Base32 and HMAC-SHA1 TOTP match RFC 6238 SHA1 vectors', () => {
  const secret = mfa.encodeBase32(Buffer.from('12345678901234567890'));
  assert.equal(mfa.decodeBase32(secret).toString(), '12345678901234567890');
  assert.equal(mfa.totp(secret, 59, 8), '94287082');
  assert.equal(mfa.totp(secret, 1111111109, 8), '07081804');
  assert.equal(mfa.totp(secret, 1111111111, 8), '14050471');
  assert.match(mfa.totp(secret, 59), /^\d{6}$/);
});

test('invalid, non-canonical, padded-interior and too-short Base32 secrets are refused', () => {
  for (const secret of ['', '0'.repeat(20), 'A=AAAAAAAAAAAAAAA', 'B'.repeat(17), null])
    assert.throws(() => mfa.decodeBase32(secret));
});

test('scope binds only known synthetic staging users, exact project/origin and public keys', () => {
  const anon = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'), 'signature'].join('.');
  const fixture = { project: mfa.PROJECT, origin: mfa.ORIGIN, publicKey: anon,
    userId: '12345678-1234-4234-8234-123456789abc', email: 'clinia-owner_a-abcdef123456@clinia.invalid' };
  assert.deepEqual(mfa.scope(fixture), { project: mfa.PROJECT, origin: mfa.ORIGIN,
    userId: fixture.userId, email: fixture.email });
  assert.equal(mfa.isPublicKey('sb_publishable_' + 'x'.repeat(24)), true);
  assert.equal(mfa.isPublicKey('sb_secret_' + 'x'.repeat(30)), false);
  assert.equal(mfa.isPublicKey(['a', Buffer.from('{"role":"service_role"}').toString('base64url'), 'b'].join('.')), false);
  for (const change of [
    { project: 'other-project' }, { origin: 'https://other.supabase.co' },
    { userId: 'not-a-uuid' }, { email: 'person@example.com' },
    { email: 'clinia-owner_a-abcdef123456@invalid' }, { publicKey: 'sb_secret_' + 'x'.repeat(30) },
    { publicKey: ['a', Buffer.from('{"role":"service_role"}').toString('base64url'), 'b'].join('.') },
  ]) assert.throws(() => mfa.scope({ ...fixture, ...change }));
});
