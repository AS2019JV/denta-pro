'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const file = 'app/(dashboard)/patients/[id]/page.tsx';
const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function effectFor(name) {
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  let effect;
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(source) === 'useEffect') effect = n.arguments[0].getText(source);
    ts.forEachChild(n, visit);
  }
  visit(fn);
  const js = ts.transpileModule('module.exports = ' + effect, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return context => {
    const module = { exports: {} };
    vm.runInNewContext(js, { module, AbortController, Error, ...context });
    return module.exports();
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const noop = () => {};
let passed = 0;
async function check(name, work) { await work(); passed++; console.log('PASS ' + name); }
async function main() {
  const { parsePatientDetail, loadPatientDetail } = await import(pathToFileURL(path.join(root, 'lib/patient-detail.mjs')));
  const record = { id: 'patient', clinic_id: 'clinic', first_name: 'Ana', last_name: 'Prueba', status: 'active', allergies: 'Test' };
  await check('authorized JSON projects clinical fields and ignores financial getters', () => {
    const patient = { ...record };
    for (const field of ['total_billed', 'account_balance', 'insurance_provider', 'policy_number']) {
      Object.defineProperty(patient, field, { get() { throw Error('Financial field was accessed'); } });
    }
    const result = parsePatientDetail({ items: [patient], total_count: 1 }, 'patient', 'clinic');
    assert.equal(result.name, 'Ana'); assert.equal(result.allergies, 'Test');
    for (const field of ['accountBalance', 'total_billed', 'insuranceProvider', 'policyNumber']) assert.equal(Object.hasOwn(result, field), false);
  });
  await check('empty is distinct from malformed or cross-clinic response', () => {
    assert.equal(parsePatientDetail({ items: [], total_count: 0 }, 'patient', 'clinic'), null);
    for (const data of [[], null, { items: [], total_count: 1 }, { items: [record], total_count: '1' }, { items: [{ ...record, clinic_id: 'other' }], total_count: 1 }]) {
      assert.throws(() => parsePatientDetail(data, 'patient', 'clinic'));
    }
  });
  await check('patient loader binds the authorized RPC and propagates failure', async () => {
    let calls = 0;
    const client = { rpc(name, args) {
      calls++;
      assert.equal(name, 'get_patients_with_stats');
      assert.deepEqual(args, { p_clinic_id: 'clinic', p_patient_id: 'patient', p_limit: 1 });
      return { abortSignal: async signal => {
        assert.ok(signal instanceof AbortSignal); return { data: null, error: Error('denied') };
      } };
    } };
    await assert.rejects(loadPatientDetail(client, 'clinic', 'patient', new AbortController().signal), /denied/);
    assert.equal(calls, 1);
  });
  await check('patient loader ignores an aborted response', async () => {
    const controller = new AbortController(); controller.abort();
    assert.equal(await loadPatientDetail({ rpc: () => ({ abortSignal: async () => ({ data: null, error: Error('late') }) }) }, 'clinic', 'patient', controller.signal), undefined);
  });
  const runDetail = effectFor('PatientDetailsPage');
  function detailContext(loader) {
    const state = {};
    const filters = [];
    let signal;
    return {
      state, filters, get signal() { return signal; },
      scope: 'clinic:actor:doctor:patient', scopeRef: { current: 'clinic:actor:doctor:patient' },
      currentClinicId: 'clinic', patientId: 'patient', loadPatientDetail: loader,
      setPatient: v => { state.patient = v; }, setFilesCount: v => { state.files = v; },
      setFilesError: v => { state.filesError = v; }, setLoadError: v => { state.error = v; },
      setLoadedScope: v => { state.loadedScope = v; }, setIsLoading: v => { state.loading = v; },
      setIsHCUOpen: noop, setHcuData: noop, setIsScheduleOpen: noop,
      supabase: { from(table) {
        assert.equal(table, 'patient_files');
        return { select(fields, options) { assert.equal(fields, 'id'); assert.equal(options.head, true); return this; },
          eq(field, value) { filters.push([field, value]); return this; }, is() { return this; },
          abortSignal(value) { signal = value; return Promise.resolve({ count: 3, error: null }); } };
      } },
    };
  }
  await check('detail effect populates clinical patient and counts files within clinic', async () => {
    const ctx = detailContext(async () => ({ id: 'patient', name: 'Ana' }));
    const cleanup = runDetail(ctx); await flush();
    assert.equal(ctx.state.patient.name, 'Ana'); assert.equal(ctx.state.files, 3); assert.equal(ctx.state.error, false);
    assert.deepEqual(ctx.filters, [['clinic_id', 'clinic'], ['patient_id', 'patient']]);
    cleanup(); assert.equal(ctx.signal.aborted, true);
  });
  await check('detail RPC error is explicit and successful empty remains not-found', async () => {
    for (const fails of [false, true]) {
      const ctx = detailContext(async () => { if (fails) throw Error('denied'); return null; });
      const cleanup = runDetail(ctx); await flush();
      assert.equal(ctx.state.patient, null); assert.equal(ctx.state.error, fails); assert.equal(ctx.state.loading, false);
      cleanup();
    }
  });
  await check('scope switch and unmount reject late patient data', async () => {
    for (const unmount of [false, true]) {
      let resolve;
      const ctx = detailContext(() => new Promise(done => { resolve = done; }));
      const cleanup = runDetail(ctx); await flush();
      if (unmount) cleanup(); else ctx.scopeRef.current = 'other-clinic:actor:doctor:patient';
      resolve({ id: 'patient', name: 'stale' }); await flush();
      assert.equal(ctx.state.patient, null);
      cleanup();
    }
  });
  await check('missing authority performs no patient or file reads', async () => {
    const ctx = detailContext(() => { throw Error('Unauthorized read'); }); ctx.scope = '';
    ctx.supabase.from = () => { throw Error('Unauthorized files read'); };
    runDetail(ctx)(); await flush(); assert.equal(ctx.state.patient, null); assert.equal(ctx.state.loading, false);
  });
  const runHistory = effectFor('AppointmentsList');
  await check('history reads only explicit operational fields scoped to clinic and aborts on unmount', async () => {
    const state = {}, filters = [];
    let signal, selected;
    const ctx = {
      scope: 'scope', scopeRef: { current: 'scope' }, currentClinicId: 'clinic', patientId: 'patient',
      setAppointments: v => { state.appointments = v; }, setError: v => { state.error = v; },
      setLoading: v => { state.loading = v; }, setLoadedScope: v => { state.scope = v; },
      supabase: { from(table) {
        assert.equal(table, 'appointments');
        return { select(fields) { selected = fields; return this; }, eq(field, value) { filters.push([field, value]); return this; },
          is() { return this; }, order() { return this; }, limit(value) { assert.equal(value, 100); return this; },
          abortSignal(value) { signal = value; return Promise.resolve({ data: [{ id: 'appointment', status: 'cancelled' }], error: null }); } };
      } },
    };
    const cleanup = runHistory(ctx); await flush();
    assert.equal(selected, 'id,patient_id,doctor_id,start_time,end_time,type,status');
    assert.deepEqual(filters, [['clinic_id', 'clinic'], ['patient_id', 'patient']]);
    assert.equal(state.appointments.length, 1); assert.equal(state.error, false);
    cleanup(); assert.equal(signal.aborted, true);
  });
  await check('history failure does not become a successful empty list', async () => {
    const state = {};
    const builder = { select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; }, limit() { return this; }, abortSignal: async () => ({ data: null, error: Error('denied') }) };
    runHistory({ scope: 'scope', scopeRef: { current: 'scope' }, currentClinicId: 'clinic', patientId: 'patient',
      setAppointments: noop, setError: v => { state.error = v; }, setLoading: v => { state.loading = v; }, setLoadedScope: noop,
      supabase: { from: () => builder } });
    await flush(); assert.equal(state.error, true); assert.equal(state.loading, false);
  });
  console.log(passed + '/'+passed+' patient detail contract checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

