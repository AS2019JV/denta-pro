'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
let passed = 0;
async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
const noop = () => {};
const flush = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  const helper = await import(pathToFileURL(path.join(root, 'lib/patient-demographics.mjs')));
  const row = { id: 'p', clinic_id: 'c', first_name: 'Ana', last_name: 'Test', status: 'active' };
  const form = { ...helper.demographicForm(), first_name: ' Ana ', last_name: ' Test ' };
  await check('payload allows exact edited demographic fields, no extra clinical/financial/family keys', () => {
    const payload = helper.demographicPayload({ ...form, clinical_notes: 'secret', account_balance: 9, data_consent: true, family_representative_id: 'x', avatar_url: 'url' });
    assert.deepEqual(Object.keys(payload), [...helper.DEMOGRAPHIC_FIELDS]);
    assert.equal(payload.first_name, 'Ana'); assert.equal(payload.phone, null);
  });
  await check('name, field length, enum and date validation agree with server constraints', () => {
    for (const patch of [{ first_name: ' ' }, { last_name: 'x'.repeat(121) }, { address: 'x'.repeat(501) }, { status: '' }, { preferred_contact_method: 'sms' }, { birth_date: '1849-12-31' }, { birth_date: '2030-01-01' }, { birth_date: '2026-02-30' }]) {
      assert.throws(() => helper.demographicPayload({ ...form, ...patch }, new Date(2026, 8, 27)));
    }
    assert.equal(helper.demographicPayload({ ...form, birth_date: '2000-02-29' }).birth_date, '2000-02-29');
  });
  await check('page uses exact count even outside range, projects whitelist and rejects clinic mismatch', () => {
    const record = { ...row };
    for (const key of ['clinical_notes', 'total_billed', 'family_relationship', 'avatar_url']) Object.defineProperty(record, key, { get() { throw Error('Forbidden projection'); } });
    const page = helper.parseDemographicPage({ items: [record], total_count: 27 }, 'c', 12);
    assert.equal(page.total_count, 27); assert.equal(page.items.length, 1);
    assert.equal(helper.parseDemographicPage({ items: [], total_count: 27 }, 'c', 12).total_count, 27);
    assert.throws(() => helper.parseDemographicPage({ items: [{ ...row, clinic_id: 'other' }], total_count: 1 }, 'c', 12));
    assert.throws(() => helper.parseDemographicPage({ items: [], total_count: '0' }, 'c', 12));
  });
  await check('real list loader passes server search/pagination and cancellation', async () => {
    const controller = new AbortController();
    const client = { rpc(name, args) {
      assert.equal(name, 'get_patient_demographics');
      assert.deepEqual(args, { p_clinic_id: 'c', p_search: 'ana', p_limit: 12, p_offset: 24 });
      return { abortSignal: async signal => { assert.equal(signal, controller.signal); return { data: { items: [row], total_count: 27 }, error: null }; } };
    } };
    assert.equal((await helper.loadDemographicPage(client, 'c', 'ana', 2, 12, controller.signal)).total_count, 27);
    controller.abort();
    assert.equal(await helper.loadDemographicPage(client, 'c', 'ana', 2, 12, controller.signal), undefined);
  });
  await check('create/update use demographic RPC, safe projection and preserve server rejection', async () => {
    for (const id of [null, 'p']) {
      const client = { rpc(name, args) {
        assert.equal(name, 'save_patient_demographics'); assert.equal(args.p_patient_id, id);
        assert.equal(args.p_clinic_id, 'c'); assert.equal(args.p_data.first_name, 'Ana');
        assert.deepEqual(Object.keys(args.p_data), [...helper.DEMOGRAPHIC_FIELDS]);
        return { abortSignal: async () => ({ data: row, error: null }) };
      } };
      assert.equal((await helper.saveDemographic(client, 'c', form, id, new AbortController().signal)).id, 'p');
    }
    const error = { code: '42501', message: 'Access denied' };
    await assert.rejects(helper.saveDemographic({ rpc: () => ({ abortSignal: async () => ({ data: null, error }) }) }, 'c', form, null, new AbortController().signal), value => value === error);
    assert.match(helper.demographicSaveError(error), /autorización/);
  });
  const file = 'app/(dashboard)/patients/page.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let save, loadEffect;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleSave') save = node.initializer.getText(source);
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') {
      const text = node.arguments[0].getText(source);
      // AST locates the callback by its load declaration; assertions below execute its behavior.
      let containsLoad = false;
      function find(child) { if (ts.isVariableDeclaration(child) && child.name.getText(source) === 'load') containsLoad = true; ts.forEachChild(child, find); }
      find(node.arguments[0]); if (containsLoad) loadEffect = text;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  function execute(text, context) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule('module.exports = ' + text, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module, AbortController, Error, ...context });
    return module.exports;
  }
  function saveContext() {
    const state = { form }, ctx = {
      scope: 'scope', scopeRef: { current: 'scope' }, currentClinicId: 'c', saving: false, dialogScope: 'scope',
      form, editingId: 'p', saveController: { current: null }, demographicPayload: helper.demographicPayload,
      demographicSaveError: helper.demographicSaveError, supabase: {}, flagOpened: { current: true }, clearNewFlag: noop,
      setSaving: value => { state.saving = value; }, setSaveError: value => { state.error = value; },
      setDialogScope: value => { state.dialog = value; }, setNotice: value => { state.notice = value; }, setReload: noop
    }; return { ctx, state };
  }
  await check('save handler server failure leaves form/dialog intact and displays failure', async () => {
    const { ctx, state } = saveContext();
    ctx.saveDemographic = async () => { throw { code: '22023' }; };
    await execute(save, ctx)({ preventDefault: noop });
    assert.match(state.error, /servidor/); assert.equal(state.dialog, undefined);
    assert.equal(state.form, form); assert.equal(state.saving, false);
  });
  await check('save handler discards switched scope success; missing authority cannot submit', async () => {
    const { ctx, state } = saveContext();
    let resolve;
    ctx.saveDemographic = () => new Promise(done => { resolve = done; });
    const pending = execute(save, ctx)({ preventDefault: noop }); ctx.scopeRef.current = 'other';
    resolve(row); await pending; assert.equal(state.notice, undefined); assert.equal(state.dialog, undefined);
    ctx.scope = ''; ctx.saveDemographic = () => { throw Error('Unauthorized save'); };
    await execute(save, ctx)({ preventDefault: noop });
  });
  await check('successful save invalidates only the current dashboard patient scope and refetches list', async () => {
    const { ctx, state } = saveContext();
    const keys = []; let refreshed = false;
    ctx.user = { id: 'actor', role: 'receptionist' };
    ctx.queryClient = { invalidateQueries: options => { keys.push(options); return Promise.resolve(); } };
    ctx.setReload = () => { refreshed = true; };
    ctx.saveDemographic = async () => row;
    await execute(save, ctx)({ preventDefault: noop });
    assert.equal(JSON.stringify(keys[0].queryKey), JSON.stringify(['dashboard', 'patients', 'c', 'actor', 'receptionist']));
    assert.equal(keys[0].exact, true); assert.equal(refreshed, true);
    assert.equal(state.dialog, ''); assert.equal(state.saving, false);
  });
  function listContext() {
    const state = {};
    const ctx = { scope: 'scope', scopeRef: { current: 'scope' }, queryKey: 'query', queryRef: { current: 'query' },
      currentClinicId: 'c', debouncedSearch: '', page: 0, PAGE_SIZE: 12, supabase: {},
      setLoadError: value => { state.error = value; }, setLoading: value => { state.loading = value; },
      setPage: value => { state.page = value; }, setResult: value => { state.result = value; } };
    return { ctx, state };
  }
  await check('load effect binds exact server totals and clamps vanished page', async () => {
    const { ctx, state } = listContext(); ctx.page = 2;
    ctx.loadDemographicPage = async () => ({ items: [], total_count: 13 });
    const cleanup = execute(loadEffect, ctx)(); await flush();
    assert.equal(state.page, 1); assert.equal(state.result, undefined); cleanup();
  });
  await check('load effect rejects late responses after search or scope change/unmount', async () => {
    for (const change of ['search', 'scope', 'unmount']) {
      const { ctx, state } = listContext(); let resolve;
      ctx.loadDemographicPage = () => new Promise(done => { resolve = done; });
      const cleanup = execute(loadEffect, ctx)();
      if (change === 'search') ctx.queryRef.current = 'new'; else if (change === 'scope') ctx.scopeRef.current = 'other'; else cleanup();
      resolve({ items: [row], total_count: 1 }); await flush();
      assert.equal(state.result, undefined); cleanup();
    }
  });
  await check('load effect errors stay separate from empty and no authority performs no reads', async () => {
    const { ctx, state } = listContext();
    ctx.loadDemographicPage = async () => { throw Error('denied'); };
    execute(loadEffect, ctx)(); await flush(); assert.equal(state.error, true); assert.equal(state.result, null);
    ctx.scope = ''; ctx.loadDemographicPage = () => { throw Error('Unauthorized read'); };
    execute(loadEffect, ctx)()(); await flush();
  });
  console.log(passed + '/' + passed + ' demographic contract checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

