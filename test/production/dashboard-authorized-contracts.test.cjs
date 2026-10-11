'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
async function check(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
function execute(source, context = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, AbortController, ...context });
  return module.exports;
}
function initializer(file, name) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(source) : node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `Missing ${name}`);
  return `module.exports = ${found}`;
}
const noOp = () => {};
async function main() {
  const agenda = await import('../../lib/agenda.mjs');
  const options = [], calls = [];
  let auth = { user: { id: 'actor', role: 'receptionist' }, currentClinicId: 'clinic-a', isLoading: false, authError: null };
  const supabase = {
    rpc(name, args) {
      calls.push({ name, args });
      assert.equal(args.p_clinic_id, 'clinic-a');
      assert.ok(['get_patient_demographics', 'get_clinic_schedule', 'get_clinic_staff_directory'].includes(name));
      const data = name === 'get_clinic_staff_directory' ? [{ id: 'doctor', role: 'doctor' }, { id: 'reception', role: 'receptionist' }] : { items: [{ id: 'record' }], total_count: 26 };
      return { abortSignal(signal) { assert.ok(signal); return Promise.resolve({ data, error: null }); } };
    },
    from(table) {
      assert.equal(table, 'services', 'Unexpected financial or clinical table');
      return { select(fields, config) { assert.equal(fields, 'id, name, duration_minutes'); assert.equal(config.count, 'exact'); return this; }, eq(field, clinic) { assert.equal(field, 'clinic_id'); assert.equal(clinic, 'clinic-a'); return this; }, order() { return this; }, abortSignal(signal) { assert.ok(signal); return Promise.resolve({ data: [{ id: 'service' }], count: 26, error: null }); } };
    },
  };
  const hook = execute(read('hooks/use-dashboard-data.ts'), { require(id) {
    if (id === '@tanstack/react-query') return { useQuery(option) { options.push(option); return { isPending: false, isError: false, refetch: async () => {} }; } };
    if (id === '@/components/auth-context') return { useAuth: () => auth };
    if (id === '@/lib/supabase') return { supabase };
    if (id === '@/lib/agenda.mjs') return agenda;
    throw Error(`Unexpected import ${id}`);
  } });
  await check('dashboard uses two scoped authorized loaders with cancellation signals and Guayaquil boundaries', async () => {
    hook.useDashboardData(); assert.equal(options.length, 2);
    for (const option of options) {
      assert.equal(option.enabled, true);
      assert.equal(JSON.stringify(option.queryKey.slice(2, 5)), JSON.stringify(['clinic-a', 'actor', 'receptionist']));
      await option.queryFn({ signal: new AbortController().signal });
    }
    const range = calls.find(call => call.name === 'get_clinic_schedule').args;
    assert.equal(range.p_start, agenda.clinicDateTimeToInstant(agenda.clinicDayKey(), '00:00'));
    assert.ok(new Date(range.p_end) - new Date(range.p_start) >= 29 * 86400000);
    assert.ok(new Date(range.p_end) - new Date(range.p_start) <= 31 * 86400000);
  });
  await check('JSON total_count remains separate from a limited sample and invalid pages reject', () => {
    assert.equal(hook.parseDashboardPage({ items: [{ id: 'patient' }], total_count: 1500 }).total_count, 1500);
    for (const bad of [null, [], { items: [], total_count: -1 }, { items: [], total_count: '0' }, { items: [null], total_count: 1 }, { items: [{ id: 'x' }], total_count: 0 }]) assert.throws(() => hook.parseDashboardPage(bad));
  });
  await check('no live authority disables every loader and hides previous data', () => {
    options.length = 0; auth = { user: null, currentClinicId: undefined, isLoading: false, authError: 'Revoked' };
    const output = hook.useDashboardData(); assert.equal(output.hasAuthority, false); assert.equal(output.hasError, true); assert.equal(output.patients.length, 0);
    assert.ok(options.every(option => option.enabled === false));
  });
  const fetchPatients = initializer('components/async-patient-select.tsx', 'fetchPatients');
  await check('patient selector late response cannot repopulate the switched scope', async () => {
    let resolve; const requestId = { current: 0 }, results = [];
    const pending = new Promise(done => { resolve = done; });
    const context = { requestId, searchController: { current: null }, currentClinicId: 'clinic', user: { id: 'actor' }, authLoading: false, authError: null, setSearchError: noOp, setLoading: noOp, setPatients: rows => results.push(rows), supabase: { rpc(name, args) { assert.equal(name, 'get_patient_demographics'); assert.equal(args.p_limit, 5); return { abortSignal: () => pending }; } } };
    const operation = execute(fetchPatients, context)('ana');
    requestId.current++; resolve({ data: { items: [{ id: 'old', first_name: 'Ana', last_name: 'Prueba' }], total_count: 1 }, error: null }); await operation;
    assert.ok(results.every(rows => rows.length === 0));
  });
  await check('patient selector reports RPC failure instead of an empty success', async () => {
    const errors = [];
    const context = { requestId: { current: 0 }, searchController: { current: null }, currentClinicId: 'clinic', user: { id: 'actor' }, authLoading: false, authError: null, setSearchError: value => errors.push(value), setLoading: noOp, setPatients: noOp, supabase: { rpc: () => ({ abortSignal: async () => ({ data: null, error: { message: 'denied' } }) }) } };
    await execute(fetchPatients, context)('ana'); assert.equal(errors.at(-1), true);
  });
  const checkAccess = initializer('components/subscription-blocker.tsx', 'checkAccess');
  await check('technical access uses boolean RPC; denied and verification failure differ', async () => {
    for (const data of [true, false, null, { plan: 'trial' }]) {
      const results = [];
      await execute(checkAccess, { controller: new AbortController(), currentClinicId: 'clinic', active: true, scope: 'scope', setResult: value => results.push(value), supabase: { rpc(name, args) { assert.equal(name, 'check_subscription_active'); assert.equal(args.check_clinic_id, 'clinic'); return { abortSignal: async () => ({ data, error: null }) }; } } })();
      assert.equal(results[0].status, data === true ? 'allowed' : data === false ? 'denied' : 'error');
    }
  });
  console.log(`${passed} dashboard contract checks passed. Local code with simulated dependencies; browser and provider/RLS evidence separate.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
