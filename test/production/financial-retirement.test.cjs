'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
let passed = 0;

function execute(source, context = {}) {
  const module = { exports: {} };
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(javascript, { module, exports: module.exports, ...context });
  return module.exports;
}
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`); }

async function main() {
  for (const file of ['app/api/payments/subscribe/route.ts', 'app/api/webhooks/kushki/route.ts']) {
    await check(`${file}: rejects without body, signature, provider or database access`, async () => {
      const handler = execute(read(file), {
        require(id) {
          assert.equal(id, 'next/server', `Unexpected provider/database import ${id}`);
          return require(id);
        },
      });
      for (const request of [undefined, new Proxy({}, { get() { throw Error('Request was read'); } })]) {
        const response = await handler.POST(request);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Los pagos no están disponibles en esta versión.' });
      }
    });
  }
  for (const file of ['app/(dashboard)/billing/page.tsx', 'app/(dashboard)/pay/[id]/page.tsx']) {
    await check(`${file}: server component rejects before data access`, () => {
      const rejection = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
      const page = execute(read(file), {
        require(id) {
          assert.equal(id, 'next/navigation');
          return { notFound() { throw rejection; } };
        },
      });
      assert.throws(() => page.default(), error => error === rejection);
    });
  }
  console.log(`${passed} behavioral checks passed. Local mocks; no remote DB, provider or browser validation.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
