'use strict';
// Test-only TOTP enrollment for owned synthetic staging accounts. Factor IDs
// and secrets remain in one ignored private file; no factor is ever unenrolled.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const runtime = require('./clinia-staging-runtime.cjs');

const PROJECT = 'phihonofwyerpfgqfekt';
const ORIGIN = `https://${PROJECT}.supabase.co`;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL = /^clinia-[a-z0-9_-]+-[a-f0-9]{12}@clinia\.invalid$/i;
const SECRET_FILE = path.join(runtime.repo, 'tools/local-supabase/supabase/.temp/synthetic-mfa.private.json');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(input) {
  assert.equal(typeof input, 'string', 'Base32 secret required');
  const normalized = input.replace(/=+$/, '').toUpperCase();
  assert.ok(normalized.length >= 16 && /^[A-Z2-7]+$/.test(normalized), 'Invalid Base32 secret');
  let bits = 0, value = 0; const bytes = [];
  for (const char of normalized) {
    const digit = ALPHABET.indexOf(char); assert.ok(digit >= 0, 'Invalid Base32 secret');
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >> bits) & 0xff); }
  }
  assert.equal(value & ((1 << bits) - 1), 0, 'Non-canonical Base32 secret');
  assert.ok(bytes.length >= 10, 'Base32 secret is too short');
  return Buffer.from(bytes);
}
function encodeBase32(input) {
  const bytes = Buffer.from(input); let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; out += ALPHABET[(value >> bits) & 31]; }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function totp(secret, timestampSeconds = Date.now() / 1000, digits = 6, period = 30) {
  assert.ok(Number.isSafeInteger(Math.floor(timestampSeconds)) && timestampSeconds >= 0, 'Valid TOTP time required');
  assert.ok(Number.isInteger(digits) && digits >= 6 && digits <= 8, 'TOTP digits must be 6..8');
  assert.ok(Number.isInteger(period) && period >= 1 && period <= 120, 'TOTP period is invalid');
  const counter = BigInt(Math.floor(timestampSeconds / period));
  const message = Buffer.alloc(8); message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % (10 ** digits)).padStart(digits, '0');
}
function isPublicKey(key) {
  if (typeof key !== 'string' || key.startsWith('sb_secret_') || key.startsWith('sb_service_role_')) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; }
  catch { return false; }
}
function scope({ project, origin, publicKey, userId, email }) {
  assert.equal(project, PROJECT, 'Only the authorized synthetic staging project is allowed');
  assert.equal(origin, ORIGIN, 'Only the exact synthetic staging Auth origin is allowed');
  assert.ok(isPublicKey(publicKey), 'Public anon/publishable Supabase key required');
  assert.match(userId || '', UUID, 'Auth user ID must be bound');
  assert.match(email || '', EMAIL, 'Only synthetic .invalid fixture accounts are allowed');
  return { project, origin, userId, email };
}
function ensureIgnoredPrivateFile() {
  const directory = path.dirname(SECRET_FILE);
  fs.mkdirSync(directory, { recursive: true });
  assert.equal(fs.realpathSync(directory), path.resolve(directory), 'Private directory symlink refused');
  if (fs.existsSync(SECRET_FILE)) assert.ok(!fs.lstatSync(SECRET_FILE).isSymbolicLink(), 'Private MFA symlink refused');
  const relative = path.relative(runtime.repo, SECRET_FILE);
  assert.equal(require('node:child_process').spawnSync('git', ['check-ignore', '--quiet', '--no-index', relative],
    { cwd: runtime.repo, windowsHide: true }).status, 0, 'MFA secret file must be Git-ignored');
}
function readStore() {
  ensureIgnoredPrivateFile();
  if (!fs.existsSync(SECRET_FILE)) return { version: 1, project: PROJECT, factors: [] };
  const value = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
  assert.equal(value.version, 1); assert.equal(value.project, PROJECT); assert.ok(Array.isArray(value.factors));
  for (const item of value.factors) {
    assert.match(item.userId || '', UUID); assert.match(item.email || '', EMAIL);
    assert.match(item.factorId || '', UUID); decodeBase32(item.secret);
  }
  return value;
}
function writeStore(store) {
  ensureIgnoredPrivateFile();
  const temporary = SECRET_FILE + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (fs.existsSync(SECRET_FILE) && fs.lstatSync(SECRET_FILE).isSymbolicLink()) throw Error('MFA file symlink refused');
    fs.renameSync(temporary, SECRET_FILE);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
async function authenticateAal2({ project, origin, publicKey, userId, email, password }) {
  scope({ project, origin, publicKey, userId, email });
  assert.equal(typeof password, 'string'); assert.ok(password.length >= 12, 'Synthetic fixture password required');
  const store = readStore();
  let client, stage = 'client-setup';
  const result = (value, nextStage) => {
    stage = nextStage;
    if (value.error) {
      const error = new Error('Synthetic MFA provider operation failed');
      const code = value.error.code;
      if (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code)) error.providerCode = code;
      const status = Number(value.error.status || value.error.statusCode);
      if (Number.isInteger(status) && status >= 100 && status <= 599) error.httpStatus = status;
      throw error;
    }
    return value.data;
  };
  try {
    client = createClient(ORIGIN, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store', redirect: 'error',
        signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) } });
    const login = result(await client.auth.signInWithPassword({ email, password }), 'password-login');
    assert.equal(login.user?.id, userId); assert.equal(login.user?.email?.toLowerCase(), email.toLowerCase());
    const initialAal = result(await client.auth.mfa.getAuthenticatorAssuranceLevel(), 'initial-assurance');
    assert.equal(initialAal.currentLevel, 'aal1', 'Fresh password authentication must start at AAL1');
    const identity = await client.auth.getUser();
    stage = 'initial-get-user';
    assert.equal(identity.error, null); assert.equal(identity.data.user?.id, userId);
    assert.equal(identity.data.user?.email?.toLowerCase(), email.toLowerCase());
    const factorsData = result(await client.auth.mfa.listFactors(), 'factor-list');
    const allFactors = factorsData.all || [];
    const verifiedForeign = allFactors.filter(item => item.status === 'verified'
      && !store.factors.some(saved => saved.userId === userId && saved.email.toLowerCase() === email.toLowerCase() && saved.factorId === item.id));
    assert.equal(verifiedForeign.length, 0, 'Unowned verified factor exists; refusing enrollment or removal');
    const userTotp = allFactors.filter(item => item.factor_type === 'totp');
    let saved = store.factors.find(item => item.userId === userId && item.email.toLowerCase() === email.toLowerCase());
    if (userTotp.length) {
      assert.ok(saved, 'Existing TOTP has no owned private secret; refusing to alter or replace it');
      assert.equal(userTotp.length, 1, 'Unexpected additional TOTP factor; refusing to alter factors');
      assert.equal(userTotp[0].id, saved.factorId, 'Owned factor ID differs from Auth');
    } else {
      assert.ok(!saved, 'Private secret exists but its Auth factor is absent; refusing duplicate enrollment');
      const enrollment = result(await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Synthetic staging test' }), 'factor-enroll');
      const factorId = enrollment.id, secret = enrollment.totp?.secret;
      assert.match(factorId || '', UUID); decodeBase32(secret);
      saved = { userId, email, factorId, secret, createdAt: new Date().toISOString() };
      store.factors.push(saved); writeStore(store);
    }
    assert.equal(saved.userId, userId); assert.equal(saved.email.toLowerCase(), email.toLowerCase());
    decodeBase32(saved.secret);
    const readyAal = result(await client.auth.mfa.getAuthenticatorAssuranceLevel(), 'factor-ready-assurance');
    // An enrolled but not-yet-verified factor may still advertise AAL1 as its
    // next level; successful verification below is the authoritative AAL2 proof.
    assert.equal(readyAal.currentLevel, 'aal1');
    const challenge = result(await client.auth.mfa.challenge({ factorId: saved.factorId }), 'factor-challenge');
    assert.match(challenge.id || '', UUID);
    const verified = result(await client.auth.mfa.verify({ factorId: saved.factorId, challengeId: challenge.id,
      code: totp(saved.secret) }), 'factor-verify');
    void verified;
    const current = await client.auth.getSession();
    stage = 'post-verify-session';
    assert.equal(current.error, null); assert.equal(current.data.session?.user?.id, userId);
    const claimsData = result(await client.auth.getClaims(current.data.session.access_token), 'signed-claims');
    assert.equal(claimsData.claims.sub, userId); assert.equal(claimsData.claims.aal, 'aal2');
    assert.match(claimsData.claims.session_id || '', UUID); assert.ok(Number.isSafeInteger(claimsData.claims.exp));
    const assurance = result(await client.auth.mfa.getAuthenticatorAssuranceLevel(current.data.session.access_token), 'final-assurance');
    assert.equal(assurance.currentLevel, 'aal2');
    const finalUser = await client.auth.getUser(current.data.session.access_token);
    stage = 'final-get-user';
    assert.equal(finalUser.error, null); assert.equal(finalUser.data.user?.id, userId);
    assert.equal(finalUser.data.user?.email?.toLowerCase(), email.toLowerCase());
    const finalFactors = result(await client.auth.mfa.listFactors(), 'final-factor-list');
    const verifiedFactor = (finalFactors.all || []).find(item => item.id === saved.factorId && item.factor_type === 'totp' && item.status === 'verified');
    assert.ok(verifiedFactor, 'Owned TOTP factor is not verified');
    return { accessToken: current.data.session.access_token, sessionId: claimsData.claims.session_id,
      expiresAt: claimsData.claims.exp, userId, email, aal: claimsData.claims.aal,
      initialLevel: initialAal.currentLevel, factorReadyLevel: readyAal.nextLevel,
      currentLevel: assurance.currentLevel, factorType: verifiedFactor.factor_type, factorStatus: verifiedFactor.status };
  } catch (cause) {
    const error = new Error('Synthetic MFA authentication failed; private factor data was not emitted');
    error.stage = stage;
    if (cause?.providerCode) error.providerCode = cause.providerCode;
    else if (typeof cause?.code === 'string' && cause.code !== 'ERR_ASSERTION' && /^[A-Za-z0-9_.-]{1,64}$/.test(cause.code)) error.providerCode = cause.code;
    if (Number.isInteger(cause?.httpStatus)) error.httpStatus = cause.httpStatus;
    else if (Number.isInteger(cause?.status) && cause.status >= 100 && cause.status <= 599) error.httpStatus = cause.status;
    throw error;
  }
}

module.exports = { PROJECT, ORIGIN, SECRET_FILE, decodeBase32, encodeBase32, totp, isPublicKey, scope, authenticateAal2 };
