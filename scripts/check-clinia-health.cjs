'use strict';
// Automation-ready one-shot check. No messaging client, credentials or retries.
const assert = require('node:assert/strict');
const { isIP } = require('node:net');
function target(origin) {
  const url = new URL(origin);
  assert.ok(url.protocol === 'https:' && !url.username && !url.password && !url.port
    && url.pathname === '/' && !url.search && !url.hash && url.hostname.includes('.')
    && !isIP(url.hostname.replace(/^\[|\]$/g, '')) && !url.hostname.endsWith('.localhost') && !url.hostname.endsWith('.local'));
  return url.origin + '/api/health';
}
async function check(origin, send = fetch) {
  const report = { status: 'NOT VERIFIED', scope: 'application-auth', passed: false, alertsSent: 0,
    startedAt: new Date().toISOString(), httpStatus: null };
  try {
    const response = await send(target(origin), { method: 'GET', headers: { Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
    report.httpStatus = response.status;
    if (response.status !== 200 || !/^application\/json\b/i.test(response.headers.get('content-type') || '')
      || !/\bno-store\b/i.test(response.headers.get('cache-control') || '')) {
      await response.body?.cancel(); throw Error('Unavailable');
    }
    const reader = response.body?.getReader(); assert.ok(reader);
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 1024) { await reader.cancel(); throw Error('Response too large'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { status: 'ok', scope: 'application-auth' });
    report.passed = true; report.status = 'VERIFIED';
  } catch { report.error = 'Application readiness could not be verified'; }
  report.completedAt = new Date().toISOString();
  return report;
}
async function main(args) {
  assert.equal(args.length, 2); assert.equal(args[0], 'check'); target(args[1]);
  const report = await check(args[1]); console.log(JSON.stringify(report)); if (!report.passed) process.exitCode = 1;
}
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  console.error('Use check with one exact HTTPS application origin; no paths, credentials or query parameters'); process.exitCode = 1;
});
module.exports = { target, check };
