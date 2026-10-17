const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../lib/kushki.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const payload = { token: 'test-token', planId: 'test-plan', email: 'test@example.invalid', amount: 10 };

function loadGateway(env, fetch) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process: { env }, fetch,
    console: { log() {}, error() {} },
  }, { filename: 'kushki.js' });
  return exports.kushki;
}

for (const key of [undefined, '', '   ', 'mock_private_key']) {
  test(`rejects unusable merchant configuration (${JSON.stringify(key)}) before network access`, async () => {
    let calls = 0;
    const gateway = loadGateway({ NODE_ENV: 'production', KUSHKI_PRIVATE_MERCHANT_ID: key }, async () => {
      calls++;
      throw new Error('provider unavailable');
    });
    await assert.rejects(gateway.createSubscription(payload), /not configured/i);
    assert.equal(calls, 0);
  });
}

test('provider rejection cannot become a successful subscription', async () => {
  const gateway = loadGateway({ KUSHKI_PRIVATE_MERCHANT_ID: 'test-merchant' }, async () => ({
    ok: false, json: async () => ({ message: 'Declined' }),
  }));
  await assert.rejects(gateway.createSubscription(payload), /Declined/);
});

test('transport failures remain failures', async () => {
  const gateway = loadGateway({ KUSHKI_PRIVATE_MERCHANT_ID: 'test-merchant' }, async () => {
    throw new Error('transport failure');
  });
  await assert.rejects(gateway.createSubscription(payload), /transport failure/);
});

for (const environment of ['uat', 'prod']) {
  test(`valid ${environment} response and request contract remain unchanged`, async () => {
    const expected = { subscriptionId: 'verified-test-subscription', status: 'active' };
    const gateway = loadGateway({ KUSHKI_PRIVATE_MERCHANT_ID: 'test-merchant', KUSHKI_ENVIRONMENT: environment }, async (url, options) => {
      assert.equal(url, `${environment === 'prod' ? 'https://api.kushkipagos.com' : 'https://api-uat.kushkipagos.com'}/subscriptions/v1/create`);
      assert.equal(options.headers['Private-Merchant-Id'], 'test-merchant');
      const body = JSON.parse(options.body);
      assert.equal(body.token, payload.token);
      assert.equal(body.plan.amount.subtotalIva0, payload.amount);
      return { ok: true, json: async () => expected };
    });
    assert.equal(await gateway.createSubscription(payload), expected);
  });
}
