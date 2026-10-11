#!/usr/bin/env node
'use strict';

// Offline catalog comparison. No network, database connection, or SQL execution.
const fs = require('node:fs');
const crypto = require('node:crypto');

const key = (...fields) => row => fields.map(field => row[field] ?? '').join('|');
const sections = {
  columns: key('table_schema', 'table_name', 'column_name'),
  relations: key('name'),
  policies: key('schemaname', 'tablename', 'policyname'),
  functions: key('name', 'identity_args'),
  constraints: key('table_name', 'name'),
  triggers: key('schema_name', 'table_name', 'name'),
  indexes: key('tablename', 'indexname'),
  grants: key('table_schema', 'table_name', 'grantee', 'privilege_type'),
  enums: key('name'),
  extensions: key('name'),
  buckets: key('id'),
  publications: key('pubname', 'schemaname', 'tablename'),
  privateFunctions: key('schema_name', 'name', 'identity_args'),
  schemas: key('nspname'),
  'customSchema.grants': key('table_schema', 'table_name', 'grantee', 'privilege_type'),
  'customSchema.columns': key('table_schema', 'table_name', 'column_name'),
  'customSchema.indexes': key('schemaname', 'tablename', 'indexname'),
  'customSchema.policies': key('schemaname', 'tablename', 'policyname'),
  'customSchema.relations': key('schema_name', 'name'),
  'customSchema.constraints': key('table_name', 'name'),
};

function canonical(value, field = '') {
  if (typeof value === 'string') {
    const normalized = value.replace(/\r\n/g, '\n');
    // PostgreSQL ACL/role arrays are sets. Enum labels are ordered contracts.
    if (['acl', 'roles'].includes(field) && /^\{[^{}]*\}$/.test(normalized)) {
      return `{${normalized.slice(1, -1).split(',').filter(Boolean).sort().join(',')}}`;
    }
    return normalized;
  }
  if (Array.isArray(value)) {
    const values = value.map(item => canonical(item));
    return ['config', 'options', 'allowed_mime_types'].includes(field)
      ? values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : values;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k], k)]));
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value ?? null))).digest('hex');
}

function rows(catalog, section) {
  let value = catalog;
  for (const part of section.split('.')) value = value?.[part];
  // SQL json_agg returns NULL for an empty set; absent fields still fail closed.
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Missing catalog section: ${section}`);
  return value;
}

function index(list, identify, section) {
  const result = new Map();
  for (const row of list) {
    const id = identify(row);
    if (!id || result.has(id)) throw new Error(`Duplicate or empty identity in ${section}: ${id}`);
    result.set(id, row);
  }
  return result;
}

function compareCatalogs(production, staging, expected = []) {
  const expectations = new Map();
  for (const entry of expected) {
    const id = `${entry.section}:${entry.identity}`;
    if (!entry.reason || !entry.productionHash || !entry.stagingHash || expectations.has(id)) {
      throw new Error(`Invalid or duplicate expectation: ${id}`);
    }
    expectations.set(id, entry);
  }
  const differences = [];
  const counts = {};
  const used = new Set();
  for (const [section, identify] of Object.entries(sections)) {
    const source = index(rows(production, section), identify, section);
    const target = index(rows(staging, section), identify, section);
    counts[section] = { production: source.size, staging: target.size, identical: 0 };
    for (const identity of [...new Set([...source.keys(), ...target.keys()])].sort()) {
      const before = source.get(identity) ?? null;
      const after = target.get(identity) ?? null;
      const productionHash = fingerprint(before);
      const stagingHash = fingerprint(after);
      if (productionHash === stagingHash) { counts[section].identical++; continue; }
      const id = `${section}:${identity}`;
      const expectation = expectations.get(id);
      const accepted = expectation?.productionHash === productionHash && expectation?.stagingHash === stagingHash;
      if (accepted) used.add(id);
      differences.push({
        section, identity,
        kind: before === null ? 'staging_only' : after === null ? 'missing_in_staging' : 'changed',
        classification: accepted ? 'expected' : 'unexplained',
        reason: accepted ? expectation.reason : null,
        productionHash, stagingHash, production: before, staging: after,
      });
    }
  }
  const baseNames = new Set(production.relations.filter(r => ['r', 'p'].includes(r.kind)).map(r => r.name));
  return {
    formatVersion: 1,
    source: { projectRef: production.projectRef, capturedAtEstimate: production.capturedAt },
    target: { projectRef: staging.projectRef, capturedAtEstimate: staging.capturedAt },
    limits: ['Catalog metadata only; not a backup or database restore.', 'No authorization, Auth configuration, API, or browser behavior is proved.', 'Public metadata is also captured in customSchema; section totals are not unique object totals.'],
    summary: {
      totalDifferences: differences.length,
      expected: differences.filter(d => d.classification === 'expected').length,
      unexplained: differences.filter(d => d.classification === 'unexplained').length,
      baseColumnDifferences: differences.filter(d => d.section === 'columns' && baseNames.has((d.production ?? d.staging).table_name)).length,
      viewColumnDifferences: differences.filter(d => d.section === 'columns' && !baseNames.has((d.production ?? d.staging).table_name)).length,
      staleExpectations: [...expectations.keys()].filter(id => !used.has(id)),
    },
    counts, differences,
  };
}

function main(args) {
  if (args.length < 2 || args.length > 4) {
    throw new Error('Usage: node scripts/compare-supabase-catalogs.cjs production.json staging.json [expected.json] [report.json]');
  }
  const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const report = compareCatalogs(read(args[0]), read(args[1]), args[2] ? read(args[2]) : []);
  if (args[3]) fs.writeFileSync(args[3], `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ source: report.source, target: report.target, summary: report.summary, counts: report.counts }, null, 2)}\n`);
  // Exit 2 means differences remain. Exit 3 means an expected drift changed or disappeared.
  return report.summary.staleExpectations.length ? 3 : report.summary.unexplained ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { canonical, fingerprint, compareCatalogs, sections };
