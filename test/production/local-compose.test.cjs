'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { quoteCompose, serviceFrom } = require('../../scripts/prepare-clinia-compose.cjs');
function fixture() {
  return { Name: '/supabase_db_clinia-acceptance', Image: 'sha256:local',
    Config: { Env: [], Cmd: ['postgres'], Entrypoint: null, Labels: { 'com.supabase.cli.project': 'clinia-acceptance' } },
    HostConfig: { Privileged: false, NetworkMode: 'clinia-acceptance-loopback', PortBindings: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '56322' }] } },
    NetworkSettings: { Networks: { 'clinia-acceptance-loopback': { Aliases: ['db'] } } }, Mounts: [] };
}
test('Compose interpolation preserves literal credentials and commands', () => {
  assert.deepEqual(quoteCompose({ env: ['PASSWORD=a$b${x}'], cmd: ['$1', '$(not-host-executed)'] }),
    { env: ['PASSWORD=a$$b$${x}'], cmd: ['$$1', '$$(not-host-executed)'] });
});
test('all imported published ports are explicitly loopback', () => {
  assert.deepEqual(serviceFrom(fixture(), 'db', {}).ports,
    [{ target: 5432, published: '56322', host_ip: '127.0.0.1', protocol: 'tcp' }]);
});
test('foreign identity is refused', () => {
  assert.throws(() => serviceFrom({ ...fixture(), Name: '/production' }, 'db', {}));
});
test('privileged runtime is refused', () => {
  const c = fixture(); c.HostConfig.Privileged = true;
  assert.throws(() => serviceFrom(c, 'db', {}));
});
test('host bind or Docker socket import is refused', () => {
  assert.throws(() => serviceFrom({ ...fixture(), Mounts: [{ Type: 'bind', Source: '/var/run/docker.sock' }] }, 'db', {}));
});
test('unknown published port is refused', () => {
  const c = fixture(); c.HostConfig.PortBindings['5432/tcp'][0].HostPort = '5432';
  assert.throws(() => serviceFrom(c, 'db', {}));
});
