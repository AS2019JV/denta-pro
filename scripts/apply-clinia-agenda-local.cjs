'use strict';
// Exact reviewed, guarded delta on the owned synthetic clean project only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const api = require('./clinia-clean-api.cjs');
const local = require('./clinia-local-runtime.cjs');
const file = 'supabase/migrations/20261003140122_serialize_appointment_rpc_writes.sql';
const expected = '21e299752fb9db44859911ccd568e21b9e715237225323620e52c34f985518b9';
const sql = fs.readFileSync(path.join(local.repo, file));
assert.equal(crypto.createHash('sha256').update(sql).digest('hex'), expected);
assert.equal(process.argv.length, 2, 'No arbitrary target accepted');
const out = path.join(local.repo, 'docs/production/evidence/2026-10-03-agenda-serialization', 'local-apply-' + Date.now() + '.json');
assert.ok(!fs.existsSync(out), 'Existing evidence is immutable');
const report = { status: 'NOT VERIFIED', project: 'clinia-clean-20261002-1', migration: file,
  migrationSha256: expected, startedAt: new Date().toISOString() };
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  report.sqlResult = api.sql('clean-managed-1', sql.toString('utf8'), 'postgres');
  report.status = 'VERIFIED';
} catch (error) { report.error = error.message; process.exitCode = 1; }
report.completedAt = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
