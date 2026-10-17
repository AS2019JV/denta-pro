'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareCatalogs, fingerprint, sections } = require('../../scripts/compare-supabase-catalogs.cjs');
const empty = () => {
  const result = { projectRef: 'fixture', capturedAt: '2026-09-26T00:00:00Z', customSchema: {} };
  for (const section of Object.keys(sections)) {
    if (section.startsWith('customSchema.')) result.customSchema[section.split('.')[1]] = [];
    else result[section] = [];
  }
  return result;
};
test('row order, ACL role order and object property order do not imply drift', () => {
  const a = empty(); const b = empty();
  a.functions = [{ name: 'f', identity_args: '', acl: '{anon=X/postgres,authenticated=X/postgres}', config: ['search_path=public', 'statement_timeout=10'] }, { name: 'g', identity_args: '' }];
  b.functions = [{ identity_args: '', name: 'g' }, { config: ['statement_timeout=10', 'search_path=public'], acl: '{authenticated=X/postgres,anon=X/postgres}', identity_args: '', name: 'f' }];
  assert.equal(compareCatalogs(a, b).summary.totalDifferences, 0);
});
test('overloaded function removal cannot hide behind another overload', () => {
  const a = empty(); const b = empty();
  a.functions = [{ name: 'lookup', identity_args: 'id uuid' }, { name: 'lookup', identity_args: 'id text' }];
  b.functions = [a.functions[0]];
  const result = compareCatalogs(a, b);
  assert.equal(result.differences[0].identity, 'lookup|id text');
  assert.equal(result.differences[0].kind, 'missing_in_staging');
});
test('base columns and view columns are reported separately', () => {
  const a = empty(); const b = empty();
  a.relations = b.relations = [{ name: 'patients', kind: 'r' }, { name: 'stats', kind: 'v' }];
  a.columns = [{ table_schema: 'public', table_name: 'stats', column_name: 'count' }];
  b.columns = [{ table_schema: 'public', table_name: 'patients', column_name: 'resolution_notes' }];
  const result = compareCatalogs(a, b);
  assert.equal(result.summary.baseColumnDifferences, 1);
  assert.equal(result.summary.viewColumnDifferences, 1);
});
test('an exact reasoned expectation accepts intentional drift', () => {
  const a = empty(); const b = empty();
  const row = { table_schema: 'public', table_name: 'rights', column_name: 'resolution_notes' };
  b.columns = [row];
  const expected = [{ section: 'columns', identity: 'public|rights|resolution_notes', productionHash: fingerprint(null), stagingHash: fingerprint(row), reason: 'M7 immutable resolution evidence' }];
  assert.equal(compareCatalogs(a, b, expected).summary.expected, 1);
  b.columns[0] = { ...row, is_nullable: 'NO' };
  const drift = compareCatalogs(a, b, expected);
  assert.equal(drift.summary.unexplained, 1);
  assert.equal(drift.summary.staleExpectations.length, 1);
});
test('SQL string literal whitespace is significant', () => {
  assert.notEqual(fingerprint({ definition: "SELECT 'a b'" }), fingerprint({ definition: "SELECT 'a  b'" }));
  assert.equal(fingerprint({ definition: 'SELECT 1\r\n' }), fingerprint({ definition: 'SELECT 1\n' }));
});
test('enum order remains significant', () => {
  assert.notEqual(fingerprint({ labels: '{owner,doctor}' }), fingerprint({ labels: '{doctor,owner}' }));
});
test('duplicate identities and missing sections fail instead of masking evidence', () => {
  const a = empty(); const b = empty();
  a.functions = [{ name: 'f', identity_args: '' }, { name: 'f', identity_args: '' }];
  assert.throws(() => compareCatalogs(a, b), /Duplicate/);
  a.functions = [];
  delete b.policies;
  assert.throws(() => compareCatalogs(a, b), /Missing catalog section/);
});
test('security invoker and WITH CHECK changes are observable', () => {
  const a = empty(); const b = empty();
  a.relations = [{ name: 'demographics', kind: 'v', options: ['security_invoker=true'] }];
  b.relations = [{ name: 'demographics', kind: 'v', options: null }];
  a.policies = [{ schemaname: 'public', tablename: 'patients', policyname: 'update', with_check: 'clinic_id = current_clinic()' }];
  b.policies = [{ ...a.policies[0], with_check: null }];
  assert.equal(compareCatalogs(a, b).summary.unexplained, 2);
});
