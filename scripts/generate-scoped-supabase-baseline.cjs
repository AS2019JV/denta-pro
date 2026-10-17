'use strict';

// Offline generator only. It never connects to PostgreSQL or invokes Supabase.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SCHEMAS = new Set(['public', 'logs', 'security_internal']);
const ROLES = new Set(['PUBLIC', 'pg_database_owner', 'postgres', 'anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin']);
const CATEGORIES = ['schemas', 'roles', 'roleMemberships', 'defaultPrivileges', 'relations', 'columns', 'constraints', 'indexes', 'sequences', 'functions', 'triggers', 'policies', 'types', 'extensions', 'buckets', 'publications', 'migrationHistory', 'dependencies'];
const RIGHTS = {
  TABLE: { a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN' },
  SEQUENCE: { r: 'SELECT', w: 'UPDATE', U: 'USAGE' },
  FUNCTION: { X: 'EXECUTE' },
  TYPE: { U: 'USAGE' },
  SCHEMA: { U: 'USAGE', C: 'CREATE' },
  COLUMN: { a: 'INSERT', r: 'SELECT', w: 'UPDATE', x: 'REFERENCES' },
};
const KNOWN_PG_TYPES = new Set(['uuid', 'text', '_text', 'jsonb', 'bool', 'int2', 'int4', 'int8', 'numeric', 'float4', 'float8', 'date', 'timestamp', 'timestamptz', 'time', 'timetz', 'bytea', 'varchar', 'bpchar']);
const hash = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const canonical = v => JSON.stringify(stable(v));
function fail(message) { throw new Error(message); }
function ident(v) { if (typeof v !== 'string' || !/^[A-Za-z_][A-Za-z0-9_$-]*$/.test(v)) fail('Unsupported identifier: ' + String(v)); return '"' + v.replace(/"/g, '""') + '"'; }
function role(v) { if (!ROLES.has(v)) fail('Unsupported role: ' + v); return v === 'PUBLIC' ? 'PUBLIC' : ident(v); }
function literal(v) { if (typeof v !== 'string' || v.includes('\0')) fail('Invalid string literal'); return "'" + v.replace(/'/g, "''") + "'"; }
const qualify = (schema, name) => ident(schema) + '.' + ident(name);
const relkey = r => r.schema + '.' + (r.table || r.name);
function int64(v) { if (!/^-?\d+$/.test(String(v))) fail('Invalid exact integer: ' + String(v)); return String(v); }
function untrustedSQL(v, context) {
  if (typeof v !== 'string' || v.includes('\0')) fail('Invalid SQL metadata: ' + context);
  if (/\bnet\s*\.\s*http_[A-Za-z0-9_]*\b|\b(?:dblink|postgres_fdw|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export)\b|https?:\/\/|\bCOPY\b[\s\S]*\bPROGRAM\b|vault\s*\.\s*decrypted_secrets|(?:sb_secret_|sbp_)[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{25,}\./i.test(v)) fail('Network, file, credential or secret literal rejected: ' + context);
  return v;
}
function fragment(v, context) {
  untrustedSQL(v, context);
  // Defaults, predicates and type names are expressions, not multi-statement scripts.
  const stripped = v.replace(/'(?:[^']|'')*'/g, '').replace(/"(?:[^"]|"")*"/g, '');
  if (/[;]/.test(stripped) || /--|\/\*/.test(stripped)) fail('Unsupported SQL fragment: ' + context);
  return v;
}
function parseAcl(acl, kind, owner) {
  if (!RIGHTS[kind]) fail('Unknown ACL object kind');
  if (acl == null) {
    if (kind === 'COLUMN') return [];
    const result = [{ grantee: owner, grantor: owner, rights: Object.keys(RIGHTS[kind]), grantOptions: [] }];
    if (kind === 'FUNCTION' || kind === 'TYPE') result.push({ grantee: 'PUBLIC', grantor: owner, rights: Object.keys(RIGHTS[kind]), grantOptions: [] });
    return result;
  }
  if (typeof acl !== 'string' || !acl.startsWith('{') || !acl.endsWith('}')) fail('Malformed ACL');
  if (acl === '{}') return [];
  return acl.slice(1, -1).split(',').map(item => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*|)=([arwdDxtmUXC*]*)\/([A-Za-z_][A-Za-z0-9_]*)$/.exec(item);
    if (!m) fail('Unsupported quoted/ambiguous ACL: ' + item);
    const grantee = m[1] || 'PUBLIC', grantor = m[3], rights = [], grantOptions = [];
    role(grantee); role(grantor);
    if (grantor !== owner) fail('Unsupported grantor differing from owner: ' + item);
    for (let i = 0; i < m[2].length; i++) {
      const right = m[2][i];
      if (!RIGHTS[kind][right] || rights.includes(right)) fail('Invalid ACL right: ' + item);
      rights.push(right);
      if (m[2][i + 1] === '*') { grantOptions.push(right); i++; }
    }
    return { grantee, grantor, rights, grantOptions };
  });
}
function effectiveAcl(acl, kind, owner) {
  return parseAcl(acl, kind, owner).flatMap(a => a.rights.map(r => [a.grantee, a.grantor, r, a.grantOptions.includes(r)]))
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
}
function safeAcl(owner, kind) {
  return '{' + owner + '=' + Object.keys(RIGHTS[kind]).join('') + '/' + owner + '}';
}
function objectIdentity(category, o) {
  if (category === 'buckets') return o.id;
  if (category === 'columns') return o.schema + '.' + o.table + '.' + o.name;
  if (category === 'functions') return o.schema + '.' + o.name + '(' + o.identityArgs + ')';
  if (category === 'triggers' || category === 'constraints' || category === 'indexes') return o.schema + '.' + o.table + '.' + o.name;
  if (category === 'policies') return o.schemaname + '.' + o.tablename + '.' + o.policyname;
  if (category === 'roleMemberships') return o.role + ':' + o.member;
  if (category === 'defaultPrivileges') return o.owner + ':' + o.schema + ':' + o.objectType;
  if (category === 'migrationHistory') return o.version;
  if (category === 'dependencies') return o.dependent + '->' + o.referenced + ':' + o.type;
  return (o.schema ? o.schema + '.' : '') + (o.name || o.id);
}
function splitComposite(text) {
  if (typeof text !== 'string' || text[0] !== '(' || text.at(-1) !== ')') fail('Malformed dependency identity');
  const parts = []; let current = '', quoted = false;
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { current += '"'; i++; } else quoted = !quoted; }
    else if (c === '\\' && quoted) { if (i + 1 >= text.length - 1) fail('Malformed dependency escape'); current += text[++i]; }
    else if (c === ',' && !quoted) { parts.push(current); current = ''; }
    else current += c;
  }
  if (quoted) fail('Unclosed dependency identity');
  parts.push(current);
  if (parts.length !== 4) fail('Unsupported dependency identity shape');
  return { kind: parts[0], schema: parts[1], name: parts[2], identity: parts[3] };
}
function validateDependencies(dependencies) {
  for (const d of dependencies) {
    if (!['n', 'a', 'i'].includes(d.type)) fail('Unsupported dependency type: ' + d.type);
    for (const name of ['dependent', 'referenced']) {
      const o = splitComposite(d[name]);
      if (!['table', 'table column', 'table constraint', 'index', 'function', 'view', 'sequence', 'type', 'schema', 'language', 'rule', 'trigger', 'policy', 'default value'].includes(o.kind)) fail('Unsupported dependency object: ' + o.kind);
      if (o.schema && !SCHEMAS.has(o.schema) && !['pg_catalog', 'auth', 'storage', 'extensions'].includes(o.schema)) fail('Unapproved external dependency schema: ' + o.schema);
      if (o.kind === 'language' && !['plpgsql', 'sql', 'internal'].includes(o.name)) fail('Unsupported dependency language: ' + o.name);
      if (o.kind === 'schema' && !SCHEMAS.has(o.name) && !['pg_catalog', 'auth', 'storage', 'extensions'].includes(o.name)) fail('Unapproved external schema dependency: ' + o.name);
    }
  }
}
function validateSnapshot(s, supplemental) {
  if (!s || !/metadata-only/.test(s.evidenceKind || '')) fail('Input must explicitly be metadata-only evidence');
  for (const c of CATEGORIES) {
    if (!Array.isArray(s[c])) fail('Missing snapshot category: ' + c);
    const ids = s[c].map(x => objectIdentity(c, x));
    if (new Set(ids).size !== ids.length) fail('Duplicate identity in ' + c);
  }
  if (!supplemental || !Array.isArray(supplemental.dependencies) || supplemental.projectRef !== s.projectRef) fail('Matching supplemental dependencies required');
  validateDependencies(supplemental.dependencies);
  const relations = new Map(s.relations.map(x => [relkey(x), x]));
  for (const x of s.schemas) { if (!SCHEMAS.has(x.name)) fail('Unknown schema'); role(x.owner); parseAcl(x.acl, 'SCHEMA', x.owner); }
  for (const x of s.relations) {
    if (!SCHEMAS.has(x.schema) || !['r', 'v', 'S'].includes(x.kind) || x.persistence !== 'p' || !['d', 'n'].includes(x.replicaIdentity) || (x.kind === 'r' && x.replicaIdentity !== 'd') || x.partitionKey || x.partitionBound) fail('Unsupported relation: ' + relkey(x));
    role(x.owner); ident(x.name); parseAcl(x.acl, x.kind === 'S' ? 'SEQUENCE' : 'TABLE', x.owner);
    if (x.options && (x.kind !== 'v' || x.options.some(v => !/^(security_invoker|security_barrier)=(true|false)$/.test(v)))) fail('Unsupported relation options: ' + relkey(x));
    if (x.kind === 'v') untrustedSQL(x.viewDefinition, relkey(x));
  }
  for (const x of s.types) { if (x.kind !== 'e' || !SCHEMAS.has(x.schema) || !Array.isArray(x.enumLabels) || !x.enumLabels.length) fail('Unsupported type'); parseAcl(x.acl, 'TYPE', x.owner); x.enumLabels.forEach(literal); }
  for (const x of s.columns) {
    const r = relations.get(x.schema + '.' + x.table);
    if (!r || r.kind === 'S' || x.generated || !['', 'd', 'a'].includes(x.identity) || x.compression) fail('Unsupported column: ' + objectIdentity('columns', x));
    ident(x.name); fragment(x.type, 'column type');
    if (x.typeSchema === 'pg_catalog') { if (!KNOWN_PG_TYPES.has(x.typeName)) fail('Unsupported builtin type: ' + x.typeName); }
    else if (!s.types.some(t => t.schema === x.typeSchema && t.name === x.typeName)) fail('Uncaptured custom type');
    if (x.default != null) fragment(x.default, 'column default');
    if (x.collation && x.collation !== '"default"') fail('Unsupported collation');
    parseAcl(x.acl, 'COLUMN', r.owner);
  }
  for (const r of s.relations.filter(r => r.kind !== 'S')) {
    const columns = s.columns.filter(c => c.schema === r.schema && c.table === r.name);
    if (!columns.length || new Set(columns.map(c => c.position)).size !== columns.length) fail('Missing/duplicate relation columns');
  }
  for (const x of s.sequences) {
    const r = relations.get(relkey(x));
    if (!r || r.kind !== 'S' || !['smallint', 'integer', 'bigint'].includes(x.type)) fail('Uncaptured/unsupported sequence');
    for (const k of ['start', 'increment', 'min', 'max', 'cache']) int64(x[k]);
    if (x.ownedBy) {
      const c = s.columns.find(c => c.schema === x.ownedBy.schema && c.table === x.ownedBy.table && c.name === x.ownedBy.column);
      if (!c || !['a', 'i'].includes(x.ownedBy.dependencyType) || (x.ownedBy.dependencyType === 'i' && !c.identity)) fail('Invalid sequence ownership');
      if (relations.get(x.ownedBy.schema + '.' + x.ownedBy.table)?.owner !== x.owner) fail('Owned sequence and parent owners differ');
    }
    parseAcl(x.acl, 'SEQUENCE', x.owner);
  }
  if (s.relations.filter(x => x.kind === 'S').length !== s.sequences.length) fail('Sequence coverage incomplete');
  for (const x of s.constraints) {
    if (!relations.has(x.schema + '.' + x.table) || !['p', 'u', 'f', 'c'].includes(x.type) || !x.inherited) fail('Unsupported constraint: ' + x.name);
    fragment(x.definition, 'constraint');
    if (x.initiallyDeferred && !x.deferrable) fail('Invalid deferred constraint');
  }
  for (const x of s.indexes) {
    if (!relations.has(x.schema + '.' + x.table) || !x.valid || !x.ready || x.options) fail('Unsupported/unready index');
    if (!/^CREATE (UNIQUE )?INDEX /.test(x.definition)) fail('Unexpected index definition');
    fragment(x.definition, 'index');
    if (x.constraintOwned && !s.constraints.some(c => c.schema === x.schema && c.table === x.table && ['p', 'u'].includes(c.type) && c.name === x.name)) fail('Constraint-owned index not accounted for');
  }
  for (const x of s.functions) {
    if (!SCHEMAS.has(x.schema) || !x.definition.startsWith('CREATE OR REPLACE FUNCTION ')) fail('Unsupported routine');
    ident(x.name); fragment(x.identityArgs, 'routine signature'); untrustedSQL(x.definition, 'routine ' + x.name); parseAcl(x.acl, 'FUNCTION', x.owner);
    if (!/\bLANGUAGE (sql|plpgsql)\b/.test(x.definition)) fail('Unsupported routine language');
  }
  for (const x of s.triggers) {
    if ((!SCHEMAS.has(x.schema) && !(x.schema === 'auth' && x.table === 'users')) || !['O', 'D', 'R', 'A'].includes(x.enabled) || !x.definition.startsWith('CREATE TRIGGER ')) fail('Unsupported trigger');
    fragment(x.definition, 'trigger');
  }
  for (const x of s.policies) {
    if ((!SCHEMAS.has(x.schemaname) && !(x.schemaname === 'storage' && x.tablename === 'objects')) || !['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(x.cmd) || !['PERMISSIVE', 'RESTRICTIVE'].includes(x.permissive) || !Array.isArray(x.roles) || !x.roles.length) fail('Unsupported policy');
    if (typeof x.policyname !== 'string' || !x.policyname || x.policyname.includes('\0')) fail('Invalid policy identifier');
    x.roles.forEach(r => role(r === 'public' ? 'PUBLIC' : r));
    if (x.qual != null) fragment(x.qual, 'policy qual');
    if (x.with_check != null) fragment(x.with_check, 'policy check');
  }
  for (const x of s.defaultPrivileges) { if (!SCHEMAS.has(x.schema) || !['r', 'S', 'f', 'T'].includes(x.objectType)) fail('Unsupported global/default privilege'); parseAcl(x.acl, ({ r: 'TABLE', S: 'SEQUENCE', f: 'FUNCTION', T: 'TYPE' })[x.objectType], x.owner); }
  for (const x of s.extensions) { if (!['pg_cron', 'pg_stat_statements', 'pgcrypto', 'plpgsql', 'supabase_vault', 'uuid-ossp'].includes(x.name)) fail('Unreviewed extension'); }
  for (const x of s.buckets) { literal(x.id); literal(x.name); if (x.fileSizeLimit != null) int64(x.fileSizeLimit); if (x.allowedMimeTypes != null && !Array.isArray(x.allowedMimeTypes)) fail('Invalid bucket MIME configuration'); }
  for (const x of s.publications) { if (!['supabase_realtime', 'supabase_realtime_messages_publication'].includes(x.name) || (x.members || []).some(m => !SCHEMAS.has(m.schemaname) && m.schemaname !== 'realtime')) fail('Unreviewed publication'); }
  for (const x of s.roles) role(x.name);
  const managedRoles = new Set([...ROLES, 'pg_monitor', 'pg_signal_backend', 'pg_read_all_data', 'pg_create_subscription', 'authenticator', 'supabase_realtime_admin', 'supabase_privileged_role', 'cli_login_postgres']);
  for (const x of s.roleMemberships) for (const key of ['role', 'member', 'grantor']) if (!managedRoles.has(x[key])) fail('Unreviewed managed role membership');
}
function aclSQL(acl, kind, owner, object, mode, column) {
  const emittedAcl = mode === 'deny-client' ? (kind === 'COLUMN' ? '{}' : safeAcl(owner, kind)) : acl;
  const entries = parseAcl(emittedAcl, kind, owner);
  const target = kind === 'COLUMN' ? 'TABLE ' + object : kind + ' ' + object;
  const principals = [...ROLES].map(role).join(', ');
  const revoke = column ? 'REVOKE ALL (' + ident(column) + ') ON ' + object + ' FROM ' + principals + ';' : 'REVOKE ALL ON ' + target + ' FROM ' + principals + ';';
  const sql = [revoke];
  for (const e of entries) for (const withGrant of [false, true]) {
    const rights = e.rights.filter(r => e.grantOptions.includes(r) === withGrant);
    if (!rights.length) continue;
    const privileges = rights.map(r => RIGHTS[kind][r] + (column ? ' (' + ident(column) + ')' : '')).join(', ');
    sql.push('GRANT ' + privileges + ' ON ' + (column ? object : target) + ' TO ' + role(e.grantee) + (withGrant ? ' WITH GRANT OPTION' : '') + ';');
  }
  return { sql, emittedAcl };
}
function sequenceOptions(s) { return 'START WITH ' + int64(s.start) + ' INCREMENT BY ' + int64(s.increment) + ' MINVALUE ' + int64(s.min) + ' MAXVALUE ' + int64(s.max) + ' CACHE ' + int64(s.cache) + (s.cycle ? ' CYCLE' : ' NO CYCLE'); }
function orderedViews(s, dependencies) {
  const views = s.relations.filter(x => x.kind === 'v'), pending = new Map(views.map(v => [relkey(v), v])), output = [];
  const edges = new Map(views.map(v => [relkey(v), new Set()]));
  for (const d of dependencies) {
    const a = splitComposite(d.dependent), b = splitComposite(d.referenced);
    if (a.kind === 'rule' && b.kind === 'view') {
      const parent = views.find(v => a.identity.includes(v.schema + '.' + v.name));
      const target = b.schema + '.' + b.name;
      if (parent && pending.has(target) && target !== relkey(parent)) edges.get(relkey(parent)).add(target);
    }
  }
  while (pending.size) {
    const ready = [...pending.keys()].filter(k => [...edges.get(k)].every(dep => !pending.has(dep))).sort();
    if (!ready.length) fail('Cyclic/unsupported view dependency graph');
    for (const k of ready) { output.push(pending.get(k)); pending.delete(k); }
  }
  return output;
}
function generate(snapshot, supplemental, options = {}) {
  const mode = options.mode || 'deny-client';
  if (!['deny-client', 'observed-fixture'].includes(mode)) fail('Unknown ACL mode');
  if (options.target !== 'local-synthetic') fail('Explicit target local-synthetic required');
  if (mode === 'observed-fixture' && options.acknowledgeObservedFixture !== true) fail('Observed ACL fixture requires explicit acknowledgement');
  validateSnapshot(snapshot, supplemental);
  const s = structuredClone(snapshot), expected = structuredClone(snapshot), changes = [], out = [];
  s.dependencies = structuredClone(supplemental.dependencies);
  expected.dependencies = structuredClone(supplemental.dependencies);
  // Default privilege catalog representation can differ with managed bootstrap.
  // Verify its restrictive effective boundary rather than pretend to replay source broad defaults.
  expected.defaultPrivileges = ['postgres', 'supabase_admin'].flatMap(owner => [
    { owner, schema: null, objectType: 'f', acl: safeAcl(owner, 'FUNCTION') },
    { owner, schema: null, objectType: 'T', acl: safeAcl(owner, 'TYPE') },
  ]);
  const coverage = {};
  for (const category of CATEGORIES) coverage[category] = s[category].map(x => ({ identity: objectIdentity(category, x), sourceHash: hash(x), disposition: 'reconstructed' }));
  function decision(category, identity, reason, disposition = 'observed-only') {
    const entry = coverage[category].find(x => x.identity === identity); if (!entry) fail('Decision missing object identity');
    entry.disposition = disposition; entry.reason = reason; changes.push({ category, identity, reason });
  }
  for (const r of s.relations.filter(r => r.kind !== 'S')) {
    const columns = s.columns.filter(c => c.schema === r.schema && c.table === r.name).sort((a,b) => a.position-b.position);
    columns.forEach((c,i) => {
      if (c.position !== i+1) decision('columns', objectIdentity('columns',c),
        'Historical physical attribute slot '+c.position+' compacts to '+(i+1)+' on clean creation; logical live-column order is preserved. Raw source/hash retained.', 'reconstructed-with-decision');
    });
  }
  const sourceHash = options.sourceHash || hash(snapshot);
  out.push('-- Metadata-derived application schema fixture. NOT pg_dump, NOT backup, NOT deployable migration.',
    '-- Target: fresh local synthetic Supabase 17 only. Mode: ' + mode + '. Source SHA256: ' + sourceHash,
    '-- Definitions are historical evidence, not reviewed canonical authorization. M7 remains NOT READY.',
    'BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';", 'SET LOCAL search_path = public, extensions, pg_catalog;',
    "DO $fixture$ BEGIN IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' THEN RAISE EXCEPTION 'Explicit local synthetic fixture session marker required'; END IF; IF current_setting('server_version_num')::integer < 170000 OR current_setting('server_version_num')::integer >= 180000 THEN RAISE EXCEPTION 'Supabase PostgreSQL 17 required'; END IF; IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed Auth and Storage schemas required'; END IF; END $fixture$;");
  const collisions = s.relations.map(r => "to_regclass(" + literal(r.schema + '.' + r.name) + ") IS NOT NULL");
  out.push('DO $fixture$ BEGIN IF ' + collisions.join(' OR ') + " THEN RAISE EXCEPTION 'Fixture requires an empty application schema; existing data/objects will not be overwritten'; END IF; END $fixture$;");
  const typeCollisions = s.types.map(t => "to_regtype(" + literal(t.schema + '.' + t.name) + ") IS NOT NULL");
  if (typeCollisions.length) out.push('DO $fixture$ BEGIN IF ' + typeCollisions.join(' OR ') + " THEN RAISE EXCEPTION 'Fixture type collision'; END IF; END $fixture$;");
  for (const f of s.functions) out.push("DO $fixture$ BEGIN IF to_regprocedure(" + literal(f.schema + '.' + f.name + '(' + f.identityArgs.replace(/\b[A-Za-z_][A-Za-z0-9_]* (uuid|text|jsonb|integer|boolean)(?=,|$)/g, '$1') + ')') + ") IS NOT NULL THEN RAISE EXCEPTION 'Fixture function collision'; END IF; END $fixture$;");
  for (const t of s.triggers) out.push("DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass(" + literal(t.schema + '.' + t.table) + ") AND tgname=" + literal(t.name) + ") THEN RAISE EXCEPTION 'Fixture trigger collision'; END IF; END $fixture$;");
  for (const p of s.policies.filter(p => p.schemaname === 'storage')) out.push("DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename=" + literal(p.tablename) + ' AND policyname=' + literal(p.policyname) + ") THEN RAISE EXCEPTION 'Fixture Storage policy collision'; END IF; END $fixture$;");
  if (s.buckets.length) out.push("DO $fixture$ BEGIN IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN (" + s.buckets.map(b => literal(b.id)).join(',') + ")) THEN RAISE EXCEPTION 'Fixture bucket collision'; END IF; END $fixture$;");
  out.push('-- Neutralize automatic ACLs before application DDL. Never replay broad remote default privileges.');
  // Schema-local REVOKE cannot cancel PostgreSQL's global PUBLIC EXECUTE/USAGE defaults.
  for (const owner of ['postgres', 'supabase_admin']) for (const kind of ['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES']) {
    out.push('ALTER DEFAULT PRIVILEGES FOR ROLE ' + role(owner) + ' REVOKE ALL ON ' + kind + ' FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;');
  }
  for (const schema of s.schemas) {
    if (schema.name !== 'public') out.push('CREATE SCHEMA ' + ident(schema.name) + ' AUTHORIZATION ' + role(schema.owner) + ';');
    for (const owner of ['postgres', 'supabase_admin']) for (const kind of ['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES']) {
      out.push('ALTER DEFAULT PRIVILEGES FOR ROLE ' + role(owner) + ' IN SCHEMA ' + ident(schema.name) + ' REVOKE ALL ON ' + kind + ' FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;');
    }
  }
  for (const d of s.defaultPrivileges) decision('defaultPrivileges', objectIdentity('defaultPrivileges', d), 'Remote broad defaults deliberately not replayed; local creation defaults deny client grants.');
  for (const e of s.extensions) {
    if (['uuid-ossp', 'pgcrypto'].includes(e.name)) out.push('CREATE EXTENSION IF NOT EXISTS ' + ident(e.name) + ' WITH SCHEMA ' + ident(e.schema) + ';');
    decision('extensions', objectIdentity('extensions', e), 'Managed runtime owns extension availability/version. Only uuid-ossp and pgcrypto are ensured; no scheduler or secret configuration is copied.', 'managed-runtime');
  }
  for (const t of s.types) out.push('CREATE TYPE ' + qualify(t.schema, t.name) + ' AS ENUM (' + t.enumLabels.map(literal).join(', ') + ');');
  for (const seq of s.sequences.filter(q => !q.ownedBy || q.ownedBy.dependencyType !== 'i')) out.push('CREATE SEQUENCE ' + qualify(seq.schema, seq.name) + ' AS ' + seq.type + ' ' + sequenceOptions(seq) + ';');
  for (const r of s.relations.filter(r => r.kind === 'r')) {
    const columns = s.columns.filter(c => c.schema === r.schema && c.table === r.name).sort((a, b) => a.position - b.position);
    out.push('CREATE TABLE ' + qualify(r.schema, r.name) + ' (\n' + columns.map(c => {
      let sql = '  ' + ident(c.name) + ' ' + c.type;
      if (c.collation) sql += ' COLLATE "default"';
      if (c.identity) {
        const seq = s.sequences.find(q => q.ownedBy && q.ownedBy.schema === c.schema && q.ownedBy.table === c.table && q.ownedBy.column === c.name && q.ownedBy.dependencyType === 'i');
        if (!seq) fail('Identity sequence metadata missing');
        sql += ' GENERATED ' + (c.identity === 'd' ? 'BY DEFAULT' : 'ALWAYS') + ' AS IDENTITY (SEQUENCE NAME ' + qualify(seq.schema, seq.name) + ' ' + sequenceOptions(seq) + ')';
      } else if (c.default != null) sql += ' DEFAULT ' + c.default;
      if (c.notNull) sql += ' NOT NULL';
      return sql;
    }).join(',\n') + '\n);');
    if (r.rls) out.push('ALTER TABLE ' + qualify(r.schema, r.name) + ' ENABLE ROW LEVEL SECURITY;');
    if (r.forceRls) out.push('ALTER TABLE ' + qualify(r.schema, r.name) + ' FORCE ROW LEVEL SECURITY;');
  }
  for (const seq of s.sequences.filter(q => q.ownedBy && q.ownedBy.dependencyType === 'a')) out.push('ALTER SEQUENCE ' + qualify(seq.schema, seq.name) + ' OWNED BY ' + qualify(seq.ownedBy.schema, seq.ownedBy.table) + '.' + ident(seq.ownedBy.column) + ';');
  const rank = { p: 0, u: 1, c: 2, f: 3 };
  for (const c of [...s.constraints].sort((a, b) => rank[a.type] - rank[b.type] || objectIdentity('constraints', a).localeCompare(objectIdentity('constraints', b)))) {
    out.push('ALTER TABLE ' + qualify(c.schema, c.table) + ' ADD CONSTRAINT ' + ident(c.name) + ' ' + c.definition + ';');
  }
  for (const i of s.indexes.filter(i => !i.constraintOwned)) out.push(i.definition.replace(/;\s*$/, '') + ';');
  for (const f of s.functions) out.push(f.definition.trimEnd() + ';'); // preserve captured bodies, including historical defects
  for (const v of orderedViews(s, supplemental.dependencies)) {
    const cols = s.columns.filter(c => c.schema === v.schema && c.table === v.name).sort((a, b) => a.position - b.position);
    out.push('CREATE VIEW ' + qualify(v.schema, v.name) + ' (' + cols.map(c => ident(c.name)).join(', ') + ')' + (v.options ? ' WITH (' + v.options.join(', ') + ')' : '') + ' AS\n' + v.viewDefinition.replace(/;\s*$/, '') + ';');
  }
  for (const t of s.triggers) {
    out.push(t.definition.replace(/;\s*$/, '') + ';');
    if (t.enabled !== 'O') out.push('ALTER TABLE ' + qualify(t.schema, t.table) + ' ' + ({ D: 'DISABLE', R: 'ENABLE REPLICA', A: 'ENABLE ALWAYS' })[t.enabled] + ' TRIGGER ' + ident(t.name) + ';');
  }
  for (const p of s.policies) {
    if (mode === 'deny-client' && p.schemaname === 'storage') {
      decision('policies', objectIdentity('policies', p), 'Historical Storage policies not installed in deny-client mode; no Storage client access is introduced.', 'explicitly-omitted');
      expected.policies = expected.policies.filter(x => objectIdentity('policies', x) !== objectIdentity('policies', p));
      continue;
    }
    const pname = '"' + p.policyname.replace(/"/g, '""') + '"';
    out.push('CREATE POLICY ' + pname + ' ON ' + qualify(p.schemaname, p.tablename) + ' AS ' + p.permissive + ' FOR ' + p.cmd + ' TO ' + p.roles.map(r => role(r === 'public' ? 'PUBLIC' : r)).join(', ') + (p.qual != null ? ' USING (' + p.qual + ')' : '') + (p.with_check != null ? ' WITH CHECK (' + p.with_check + ')' : '') + ';');
  }
  for (const b of s.buckets) {
    const publicValue = mode === 'deny-client' ? false : b.public;
    out.push('INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES (' + [literal(b.id), literal(b.name), publicValue ? 'true' : 'false', b.fileSizeLimit == null ? 'NULL' : int64(b.fileSizeLimit), b.allowedMimeTypes == null ? 'NULL' : 'ARRAY[' + b.allowedMimeTypes.map(literal).join(',') + ']::text[]'].join(',') + ');');
    if (b.public !== publicValue) { decision('buckets', b.id, 'Historical public bucket forced private in deny-client synthetic fixture.', 'reconstructed-with-decision'); expected.buckets.find(x => x.id === b.id).public = false; }
  }
  for (const r of s.relations) {
    if (r.kind === 'S' && s.sequences.find(q => q.schema === r.schema && q.name === r.name)?.ownedBy) continue; // PostgreSQL propagates parent ownership; direct identity sequence OWNER is forbidden.
    const kind = r.kind === 'S' ? 'SEQUENCE' : r.kind === 'v' ? 'VIEW' : 'TABLE';
    out.push('ALTER ' + kind + ' ' + qualify(r.schema, r.name) + ' OWNER TO ' + role(r.owner) + ';');
  }
  for (const f of s.functions) out.push('ALTER FUNCTION ' + qualify(f.schema, f.name) + '(' + f.identityArgs + ') OWNER TO ' + role(f.owner) + ';');
  for (const t of s.types) out.push('ALTER TYPE ' + qualify(t.schema, t.name) + ' OWNER TO ' + role(t.owner) + ';');
  for (const schema of s.schemas) out.push('ALTER SCHEMA ' + ident(schema.name) + ' OWNER TO ' + role(schema.owner) + ';');
  for (const [category, kind, object] of [
    ['schemas', 'SCHEMA', x => ident(x.name)], ['types', 'TYPE', x => qualify(x.schema, x.name)],
    ['relations', null, x => qualify(x.schema, x.name)], ['functions', 'FUNCTION', x => qualify(x.schema, x.name) + '(' + x.identityArgs + ')'],
  ]) for (const x of s[category]) {
    const aclKind = kind || (x.kind === 'S' ? 'SEQUENCE' : 'TABLE');
    const a = aclSQL(x.acl, aclKind, x.owner, object(x), mode); out.push(...a.sql);
    expected[category].find(e => objectIdentity(category, e) === objectIdentity(category, x)).acl = a.emittedAcl;
    if (mode === 'deny-client') decision(category, objectIdentity(category, x), 'All client/PUBLIC ACLs withheld; only owner rights retained. Source authorization preserved in metadata.', 'reconstructed-with-decision');
  }
  for (const c of s.columns.filter(c => c.acl != null)) {
    const r = s.relations.find(r => r.schema === c.schema && r.name === c.table);
    const a = aclSQL(c.acl, 'COLUMN', r.owner, qualify(c.schema, c.table), mode, c.name); out.push(...a.sql);
    expected.columns.find(e => objectIdentity('columns', e) === objectIdentity('columns', c)).acl = a.emittedAcl;
    if (mode === 'deny-client') decision('columns', objectIdentity('columns', c), 'Historical column grants withheld in deny-client fixture.', 'reconstructed-with-decision');
  }
  for (const seq of expected.sequences) seq.acl = expected.relations.find(r => r.schema === seq.schema && r.name === seq.name).acl;
  for (const category of ['roles', 'roleMemberships', 'publications', 'migrationHistory', 'dependencies']) for (const x of s[category]) decision(category, objectIdentity(category, x), ({
    roles: 'Managed Supabase role attributes are observed, never recreated or supplied passwords.',
    roleMemberships: 'Managed role memberships are observed, not replayed.',
    publications: 'Managed Realtime publication metadata observed, not recreated or enabled for app tables.',
    migrationHistory: 'Source remote version/name provenance only; never insert/repair remote migration history.',
    dependencies: 'Coverage validation and ordering input; system dependencies are recreated by PostgreSQL DDL.',
  })[category], category === 'dependencies' ? 'dependency-accounted' : 'managed-runtime');
  out.push('COMMIT;', '-- Installation proves only scoped fixture creation after actual runtime verification; it does not approve production.');
  const sql = out.join('\n') + '\n';
  const manifest = {
    formatVersion: 2, columnPositionSemantics: 'logical-live-column-order; raw physical attribute slots retained as evidence', evidenceKind: 'metadata-derived scoped synthetic fixture; NOT pg_dump, backup, full clone or production approval',
    target: 'local-synthetic', mode, deployable: false, sourceProjectRef: s.projectRef, sourceCapturedAt: s.capturedAt,
    sourceHash, supplementalDependencyHash: options.dependencyHash || hash(supplemental), sqlSha256: hash(sql),
    counts: Object.fromEntries(CATEGORIES.map(c => [c, coverage[c].length])), coverage, explicitDifferences: changes,
    prerequisites: ['fresh application schemas on genuine local Supabase PostgreSQL 17', 'privileged local fixture executor', 'app.scoped_fixture_authorized=local-synthetic session marker', 'loopback isolated synthetic runtime; no remote execution', 'no application rows or Storage bytes'],
    verificationBoundary: ['Source routine bodies and policies retain historical defects.', 'PL/pgSQL string/dynamic dependencies are not guaranteed by pg_depend; execution tests required.', 'Managed extension versions, role membership, Auth/Storage service configuration and publications require independent runtime review.', 'No source sequence live values, Auth users, patient rows, Storage bytes, secrets or full transaction-consistent remote archive included.', 'Global and schema default privileges stay restrictive even in observed-fixture; this deliberate divergence is recorded.'],
    expectedScopedState: expected,
  };
  return { sql, manifest };
}
function logicalColumns(columns) {
  const groups = new Map();
  for (const c of columns) {
    if (!Number.isInteger(c.position) || c.position < 1) fail('Invalid physical column position');
    const key = c.schema+'.'+c.table;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()].flatMap(group => {
    if (new Set(group.map(c=>c.position)).size !== group.length || new Set(group.map(c=>c.name)).size !== group.length) fail('Duplicate column position/name');
    return group.sort((a,b)=>a.position-b.position).map((c,i)=>({...c,position:i+1}));
  });
}
function comparable(s, category, logicalOrder = false) {
  let entries = s[category];
  if (category === 'columns' && logicalOrder) entries = logicalColumns(entries);
  if (category === 'relations') entries = entries.map(x => {
    const y = { ...x }; y.acl = effectiveAcl(x.acl, x.kind === 'S' ? 'SEQUENCE' : 'TABLE', x.owner); return y;
  });
  if (category === 'schemas' || category === 'types' || category === 'functions' || category === 'sequences') {
    const kind = ({ schemas: 'SCHEMA', types: 'TYPE', functions: 'FUNCTION', sequences: 'SEQUENCE' })[category];
    entries = entries.map(x => ({ ...x, acl: effectiveAcl(x.acl, kind, x.owner) }));
  }
  if (category === 'columns') entries = entries.map(x => {
    const owner = s.relations.find(r => r.schema === x.schema && r.name === x.table)?.owner || 'postgres';
    return { ...x, acl: effectiveAcl(x.acl, 'COLUMN', owner) };
  });
  return new Map(entries.map(x => [objectIdentity(category, x), stable(x)]));
}
function verify(manifest, actual) {
  if (![1,2].includes(manifest.formatVersion) || !manifest.expectedScopedState) fail('Invalid fixture manifest');
  const logicalOrder = manifest.formatVersion === 2;
  if (logicalOrder && manifest.columnPositionSemantics !== 'logical-live-column-order; raw physical attribute slots retained as evidence') fail('Missing explicit column-order boundary');
  const differences = [];
  if (!Array.isArray(actual.defaultPrivileges)) fail('Missing default privilege verification category');
  for (const d of actual.defaultPrivileges) {
    const kind = ({ r: 'TABLE', S: 'SEQUENCE', f: 'FUNCTION', T: 'TYPE' })[d.objectType];
    if (!kind) fail('Unsupported actual default privilege category');
    const exposed = parseAcl(d.acl, kind, d.owner).filter(a => a.rights.length && ![d.owner, 'postgres'].includes(a.grantee));
    if (exposed.length) differences.push({ category: 'defaultPrivileges', identity: objectIdentity('defaultPrivileges', d), expected: 'only creator/admin grants', actual: d });
  }
  for (const owner of ['postgres', 'supabase_admin']) for (const kind of ['f', 'T']) {
    if (!actual.defaultPrivileges.some(d => d.owner === owner && d.schema == null && d.objectType === kind)) differences.push({ category: 'defaultPrivileges', identity: owner + ':GLOBAL:' + kind, expected: 'explicit global removal of hardwired PUBLIC defaults', actual: null });
  }
  for (const category of ['schemas', 'types', 'relations', 'columns', 'constraints', 'indexes', 'sequences', 'functions', 'triggers', 'policies', 'buckets']) {
    const expected = comparable(manifest.expectedScopedState, category, logicalOrder), observed = comparable(actual, category, logicalOrder);
    for (const [id, e] of expected) { const a = observed.get(id); if (!a || canonical(e) !== canonical(a)) differences.push({ category, identity: id, expected: e, actual: a || null }); observed.delete(id); }
    for (const [id, a] of observed) differences.push({ category, identity: id, expected: null, actual: a });
  }
  const physicalColumnPositionDifferences = logicalOrder ? manifest.expectedScopedState.columns.flatMap(c => {
    const a = actual.columns.find(x=>objectIdentity('columns',x)===objectIdentity('columns',c));
    return a && a.position !== c.position ? [{identity:objectIdentity('columns',c),expectedPhysical:c.position,actualPhysical:a.position}] : [];
  }) : [];
  return { evidenceKind: 'scoped metadata comparison only; not JWT/RLS behavioral or restore evidence', matches: differences.length === 0, differences,
    columnPositionSemantics: logicalOrder ? manifest.columnPositionSemantics : 'physical-attribute-slots', physicalColumnPositionDifferences };
}
function runCLI(args) {
  const command = args.shift(), values = {};
  while (args.length) { const key = args.shift(); if (!key.startsWith('--')) fail('Unexpected argument'); if (key === '--acknowledge-observed-fixture') values.acknowledgeObservedFixture = true; else { if (!args.length || args[0].startsWith('--')) fail('Missing argument value'); values[key.slice(2)] = args.shift(); } }
  const allowed = command === 'generate' ? ['input', 'dependencies', 'output-prefix', 'mode', 'target', 'acknowledgeObservedFixture'] : command === 'verify' ? ['manifest', 'actual', 'output'] : [];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) fail('Unknown option: ' + key);
  if (command === 'generate') {
    for (const key of ['input', 'dependencies', 'output-prefix']) if (!values[key]) fail('Required option --' + key);
    const input = fs.readFileSync(values.input, 'utf8'), deps = fs.readFileSync(values.dependencies, 'utf8');
    const result = generate(JSON.parse(input), JSON.parse(deps), { mode: values.mode, target: values.target, acknowledgeObservedFixture: values.acknowledgeObservedFixture, sourceHash: hash(input), dependencyHash: hash(deps) });
    const prefix = path.resolve(values['output-prefix']); fs.mkdirSync(path.dirname(prefix), { recursive: true });
    for (const file of [prefix + '.sql', prefix + '.manifest.json']) if (fs.existsSync(file)) fail('Refusing to overwrite existing artifact: ' + file);
    fs.writeFileSync(prefix + '.sql', result.sql, { flag: 'wx' });
    fs.writeFileSync(prefix + '.manifest.json', JSON.stringify(result.manifest, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ sql: prefix + '.sql', manifest: prefix + '.manifest.json', sqlSha256: result.manifest.sqlSha256, counts: result.manifest.counts }) + '\n');
  } else if (command === 'verify') {
    for (const key of ['manifest', 'actual']) if (!values[key]) fail('Required option --' + key);
    const result = verify(JSON.parse(fs.readFileSync(values.manifest, 'utf8')), JSON.parse(fs.readFileSync(values.actual, 'utf8')));
    if (values.output) fs.writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ matches: result.matches, differences: result.differences.length }) + '\n'); if (!result.matches) process.exitCode = 2;
  } else fail('Usage: generate --input FILE --dependencies FILE --output-prefix PATH --target local-synthetic [--mode observed-fixture --acknowledge-observed-fixture] | verify --manifest FILE --actual FILE [--output FILE]');
}
module.exports = { generate, verify, validateSnapshot, parseAcl, effectiveAcl, splitComposite, hash };
if (require.main === module) { try { runCLI(process.argv.slice(2)); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; } }
