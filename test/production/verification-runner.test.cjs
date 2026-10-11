'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const { verificationEnv, run, verifyClientBundle, SERVER_SECRET_SENTINEL } = require('../../scripts/clinia-verify.cjs');
const { classification } = require('../../scripts/clinia-release-snapshot.cjs');
require('../../scripts/clinia-ci-network-guard.cjs');
function cleanup(directory) {
  const target = path.resolve(directory);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith('clinia-'));
  assert.equal(fs.lstatSync(target).isSymbolicLink(), false);
  fs.rmSync(target, { recursive: true, force: true });
}

test('Verification removes dotenv/inherited provider configuration and replaces NODE_OPTIONS', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clinia-env-'));
  try {
    fs.writeFileSync(path.join(directory, '.env.local'), 'export CLINIA_TEST_TOKEN=not-a-real-secret\nOTHER_PROVIDER_URL=https://example.invalid');
    const inherited = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'not-real', RESEND_API_KEY: 'not-real', NODE_OPTIONS: '--require unsafe.cjs', CLINIA_LOCAL_ACCEPTANCE: '1', GH_TOKEN: 'synthetic-gh-token', OTHER_SECRET: 'synthetic-other', LD_PRELOAD: '/not-real' };
    const env = verificationEnv(directory, inherited);
    assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:59999');
    assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, SERVER_SECRET_SENTINEL);
    assert.notEqual(env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    for (const key of ['RESEND_API_KEY', 'CLINIA_LOCAL_ACCEPTANCE', 'CLINIA_TEST_TOKEN', 'OTHER_PROVIDER_URL']) assert.equal(env[key], '');
    assert.equal(env.NODE_OPTIONS, '--require ./scripts/clinia-ci-network-guard.cjs');
    for (const key of ['GH_TOKEN', 'OTHER_SECRET', 'LD_PRELOAD']) assert.equal(env[key], undefined);
    assert.equal(inherited.SUPABASE_SERVICE_ROLE_KEY, 'not-real');
  } finally { cleanup(directory); }
});

test('Compiled client bundle refuses a server credential leak and cannot pass empty output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clinia-bundle-'));
  try {
    assert.throws(() => verifyClientBundle(directory), /ENOENT/);
    fs.mkdirSync(path.join(directory, '.next/static/chunks'), { recursive: true });
    assert.throws(() => verifyClientBundle(directory), /bundle absent/);
    const chunk = path.join(directory, '.next/static/chunks/page.js');
    fs.writeFileSync(chunk, 'const publicKey="synthetic-offline-ci-key";');
    assert.equal(verifyClientBundle(directory).scanned, 1);
    fs.writeFileSync(chunk, 'const unexpected="' + SERVER_SECRET_SENTINEL + '";');
    assert.throws(() => verifyClientBundle(directory), /credential sentinel exposed/);
  } finally { cleanup(directory); }
});

test('Actual fetch and TCP refuse external destinations; a loopback HTTP control works', async () => {
  await assert.rejects(fetch('https://example.invalid'), { code: 'CLINIA_CI_NETWORK_REFUSED' });
  assert.throws(() => net.connect({ host: 'example.invalid', port: 443 }), { code: 'CLINIA_CI_NETWORK_REFUSED' });
  const server = http.createServer((_req, res) => res.end('synthetic-control'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { assert.equal(await (await fetch(`http://127.0.0.1:${server.address().port}`)).text(), 'synthetic-control'); }
  finally { await new Promise(resolve => server.close(resolve)); }
});

test('Snapshot classification excludes private paths and local output', () => {
  for (const file of ['.env.local', 'supabase/.temp/project-ref', 'tools/actors.private.json', '.release-snapshots/prior/app/page.tsx']) assert.notEqual(classification(file), 'source-or-public-evidence');
  assert.equal(classification('app/(dashboard)/patients/page.tsx'), 'source-or-public-evidence');
  assert.equal(classification('docs/production/evidence/metadata.json'), 'source-or-public-evidence');
});

test('All-mode refuses active checkout and propagates a failing typecheck before later steps', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clinia-failure-'));
  try {
    assert.throws(() => run('all', directory, {}), /isolated release snapshot/);
    fs.mkdirSync(path.join(directory, 'scripts'), { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '../../scripts/clinia-ci-network-guard.cjs'), path.join(directory, 'scripts/clinia-ci-network-guard.cjs'));
    fs.mkdirSync(path.join(directory, 'node_modules/typescript/bin'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'node_modules/typescript/bin/tsc'), 'process.exit(17)');
    fs.writeFileSync(path.join(directory, '.clinia-release-snapshot.json'), '{}');
    assert.equal(run('all', directory, process.env), 17);
  } finally { cleanup(directory); }
});
