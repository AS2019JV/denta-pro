'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validate, specs, isDenial } = require('../../scripts/verify-clinia-legacy-retirement.cjs');

const project = 'phihonofwyerpfgqfekt';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expectedSpecs = [
  ['patient-files', 'd9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-2.pdf', 70, '1f3c816b91e3f7f6737d99f5be95be1b82a7e7cffc73a7a40c4c275dbcca1552'],
  ['patient-files', 'd9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.pdf', 70, '1f3c816b91e3f7f6737d99f5be95be1b82a7e7cffc73a7a40c4c275dbcca1552'],
  ['patient-files', 'd9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/nostore-e3e326f1-f046-4703-b3eb-0cad025f159e.pdf', 56, '8d3969f893e84b278b2e6d7f1a9f4f44f1d587a7d93aefa0e990dd7de28b21e4'],
  ['clinic-branding', 'd9a47157-1d36-43df-af1d-436d561ee551/hosted-1-run-3.png', 68, 'd8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
  ['doctor-avatars', '272d63b1-38e3-4a60-89a2-dd07f031b2d2/hosted-1-run-3.png', 68, 'd8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
  ['patient-avatars', 'd9a47157-1d36-43df-af1d-436d561ee551/b1a0ba6f-9d9a-4057-b76f-5d31ec7f9b14/hosted-1-run-3.png', 68, 'd8e791f9cab8d87b566e7f49acea5149afb7f692dc79621a8555b0e954de3d06'],
];
function stateFixture() {
  const allowlist = [];
  return {
    project,
    objects: specs.map(([bucket, oldPath, size]) => {
      const bytes = Buffer.alloc(size, 0x61);
      const ext = bucket === 'patient-files' ? '.pdf' : '.png';
      const parent = oldPath.slice(0, oldPath.lastIndexOf('/') + 1);
      allowlist.push([bucket, oldPath, size, digest(bytes)]);
      return {
        bucket, oldPath, size, backupBase64: bytes.toString('base64'), sha256: digest(bytes),
        newPath: `${parent}origin-00000000-0000-4000-8000-000000000000${ext}`,
        request: {
          url: `https://${project}.supabase.co/storage/v1/object/sign/${bucket}/${oldPath}?token=synthetic-signed-token`,
          method: 'GET', headers: { 'cache-control': 'no-cache' },
        },
      };
    }),
    allowlist,
  };
}

test('retirement validation binds exactly the six project objects and their bytes/replay requests', () => {
  assert.deepEqual(specs, expectedSpecs);
  const valid = stateFixture();
  assert.equal(validate(valid, valid.allowlist), undefined);
  for (const mutate of [
    state => { state.project = 'other-project'; },
    state => { state.objects.pop(); },
    state => { state.objects[0].oldPath = 'other/path.pdf'; },
    state => { state.objects[0].size++; },
    state => { state.objects[0].sha256 = '0'.repeat(64); },
    state => { state.objects[0].backupBase64 = Buffer.alloc(71, 0x61).toString('base64'); },
    state => { state.objects[0].request.url = state.objects[0].request.url.replace(`${project}.supabase.co`, 'attacker.example'); },
    state => { state.objects[0].request.method = 'POST'; },
    state => { state.objects[0].request.url = state.objects[0].request.url.replace('/storage/v1/object/sign/', '/storage/v1/object/'); },
  ]) {
    const state = stateFixture(); mutate(state); assert.throws(() => validate(state, state.allowlist));
  }
  const pinnedHash = stateFixture(); pinnedHash.objects[0].sha256 = expectedSpecs[0][3];
  assert.throws(() => validate(pinnedHash));
});

test('400 is denial evidence only for the expired InvalidJWT exp-claim response', () => {
  assert.equal(isDenial(400, { statusCode: 400, error: 'InvalidJWT', message: 'Invalid JWT: "exp" claim timestamp check failed' }), true);
  assert.equal(isDenial(401, {}), true);
  assert.equal(isDenial(403, {}), true);
  assert.equal(isDenial(404, {}), true);
  for (const body of [
    { error: 'InvalidJWT', message: 'Invalid JWT signature' },
    { error: 'InvalidJWT', message: 'Invalid JWT: "sub" claim is required' },
    { statusCode: 401, error: 'InvalidJWT', message: 'Invalid JWT: "exp" claim timestamp check failed' },
    { statusCode: 400, error: 'InvalidJWT', message: 'Invalid JWT: "exp" claim timestamp check failed with context' },
    { error: 'InvalidRequest', message: 'Object not found' },
    { error: 'InvalidRequest', message: 'Request expired' },
    { message: 'NoSuchKey' },
    null,
  ]) assert.equal(isDenial(400, body), false);
  assert.equal(isDenial(200, { error: 'InvalidJWT', message: 'Invalid JWT: "exp" claim timestamp check failed' }), false);
});
