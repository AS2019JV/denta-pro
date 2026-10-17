'use strict';
// Offline, metadata-derived proposal. Never connects to a database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const directory = path.join(repo, 'docs/production/reconciliation/operational-convergence');
const read = name => JSON.parse(fs.readFileSync(path.join(repo, 'docs/production/evidence/2026-09-27', name), 'utf8'));
const prod = read('catalog-prod-scoped.metadata.json');
const stage = read('catalog-stage-scoped.metadata.json');
const tables = ['clinics','profiles','clinic_members','patients','appointments','clinical_records','hcu033_forms','prescriptions','prescription_templates','patient_notes','patient_files','data_rights_requests','profile_audit_log','services','service_categories','clinic_invitations','notifications'];
const identity = item => `${item.schema}.${item.table}.${item.name}`;
const ident = value => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Unsupported identifier');
  return '"' + value + '"';
};
const literal = value => "'" + value.replace(/'/g, "''") + "'";
const plain = value => value.replace(/\bpublic\./g, '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function generate() {
  const changes = [];
  const lines = [
    '-- Generated OFFLINE from reviewed captures; LOCAL SYNTHETIC ONLY. Not a remote migration.',
    '-- Read operational-convergence/README.md. Apply after M7, before encargo02.',
    'BEGIN;', "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='60s';", 'SET LOCAL search_path=public,pg_catalog;',
    'DO $local$ BEGIN',
    "IF current_setting('app.scoped_fixture_authorized',true) IS DISTINCT FROM 'local-synthetic' OR current_setting('app.operational_convergence_authorized',true) IS DISTINCT FROM 'reviewed-local-contract' OR session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed local postgres executor required'; END IF;",
    "IF to_regprocedure('security_internal.audit_data_rights_status()') IS NULL OR to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Genuine managed M7 prerequisites required'; END IF;",
    "IF EXISTS(SELECT 1 FROM public.clinics WHERE length(size)>50) THEN RAISE EXCEPTION 'Clinic size exceeds reviewed typmod; reconcile without truncation'; END IF;",
    'END $local$;',
  ];
  for (const constraint of prod.constraints.filter(c => c.schema === 'public' && tables.includes(c.table))) {
    const other = stage.constraints.find(c => identity(c) === identity(constraint));
    // M7 replaced simple patient FKs. Do not reintroduce them or weaken composites.
    if (/^(appointments|prescriptions|hcu033_forms)_patient_id_fkey$/.test(constraint.name) || /^(billings|invoices|data_rights_requests|patient_notes|patient_files|clinical_records)_patient_id_fkey$/.test(constraint.name)) continue;
    if (!other && !['c','u'].includes(constraint.type)) continue;
    if (other && plain(other.definition) === plain(constraint.definition)) continue;
    let desired = constraint.definition;
    if (constraint.type === 'f') {
      // Reviewed conservative custody choice: do not cascade clinic/user deletion.
      desired = desired.replace(/ ON DELETE (?:CASCADE|SET NULL|SET DEFAULT|RESTRICT)(?:\s*\([^)]*\))?/g, '');
      if (plain(desired) !== plain(other.definition)) throw new Error('FK drift beyond reviewed DELETE action: ' + identity(constraint));
    }
    if (/[;]|--|\/\*|\b(?:COPY|EXECUTE|INSERT|UPDATE|DELETE|DROP|ALTER)\b(?!\s+(?:CASCADE|SET|NO|RESTRICT))/i.test(desired.replace(/ON DELETE/g, 'ON_REMOVE'))) throw new Error('Unexpected metadata statement');
    const table = 'public.' + ident(constraint.table), name = ident(constraint.name);
    const allowed = [...new Set([constraint.definition, other?.definition, desired].filter(Boolean).map(plain))];
    const ddl = `ALTER TABLE ${table} ADD CONSTRAINT ${name} ${desired}`;
    lines.push('DO $constraint$ DECLARE actual text; BEGIN',
      `SELECT replace(pg_get_constraintdef(oid,true),'public.','') INTO actual FROM pg_constraint WHERE conrelid=${literal('public.'+constraint.table)}::regclass AND conname=${literal(constraint.name)};`,
      `IF actual IS NOT NULL AND actual NOT IN (${allowed.map(literal).join(',')}) THEN RAISE EXCEPTION 'Unreviewed constraint drift: ${identity(constraint)}'; END IF;`);
    if (constraint.type === 'u') {
      const keys = desired.match(/^UNIQUE \(([^)]+)\)$/)?.[1];
      if (!keys || !/^[a-z_, ]+$/.test(keys)) throw new Error('Unsupported unique');
      const nonNull = keys.split(',').map(k => `${ident(k.trim())} IS NOT NULL`).join(' AND ');
      lines.push(`IF EXISTS(SELECT 1 FROM ${table} WHERE ${nonNull} GROUP BY ${keys} HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicates require review: ${identity(constraint)}'; END IF;`);
    } else if (constraint.type === 'c') {
      const expression = desired.match(/^CHECK \((.*)\)$/s)?.[1];
      if (!expression) throw new Error('Unsupported check');
      lines.push(`IF EXISTS(SELECT 1 FROM ${table} WHERE NOT (${expression})) THEN RAISE EXCEPTION 'Invalid values require review: ${identity(constraint)}'; END IF;`);
    }
    if (constraint.type === 'f') lines.push(`IF actual IS NOT NULL AND actual<>${literal(plain(desired))} THEN EXECUTE ${literal(`ALTER TABLE ${table} DROP CONSTRAINT ${name}`)}; actual:=NULL; END IF;`);
    lines.push(`IF actual IS NULL THEN EXECUTE ${literal(ddl)}; END IF;`, 'END $constraint$;');
    changes.push({identity: identity(constraint), sourceDefinitions: allowed, desiredDefinition: desired, decision: constraint.type === 'f' ? 'restrict historical deletion; preserve M7 composites' : 'validate before adding operational check/unique'});
  }
  lines.push('ALTER TABLE public.clinics ALTER COLUMN size TYPE varchar(50);',
    'ALTER SEQUENCE public.profile_audit_log_id_seq OWNED BY public.profile_audit_log.id;');
  const indexes = new Map();
  for (const item of [...prod.indexes, ...stage.indexes].filter(i => !i.constraintOwned && (i.schema === 'logs' || i.schema === 'public' && tables.includes(i.table)))) {
    const key = identity(item), previous = indexes.get(key);
    if (previous && previous.definition !== item.definition) throw new Error('Index definition needs explicit decision: '+key);
    indexes.set(key,item);
  }
  for (const index of indexes.values()) {
    if (!/^CREATE (?:UNIQUE )?INDEX [a-z_][a-z0-9_]* ON (?:public|logs)\.[a-z_][a-z0-9_]* USING btree \([\s\S]+\)(?: WHERE \([\s\S]+\))?$/.test(index.definition) || /;|--|\/\*/.test(index.definition)) throw new Error('Unsupported index: '+identity(index));
    lines.push(index.definition.replace('INDEX ', 'INDEX IF NOT EXISTS ')+';');
  }
  lines.push('COMMIT;', '');
  return {sql:lines.join('\n'), changes, indexes:[...indexes.values()].map(i=>({identity:identity(i),definition:i.definition}))};
}
if (require.main === module) {
  const {sql, changes, indexes} = generate();
  fs.mkdirSync(directory,{recursive:true});
  // Refuse changing a reviewed proposal silently.
  const target=path.join(directory,'before-authority.sql');
  if (fs.existsSync(target) && fs.readFileSync(target,'utf8') !== sql) throw new Error('Existing proposal differs; review explicit change');
  fs.writeFileSync(target,sql);
  fs.writeFileSync(path.join(directory,'proposal-manifest.json'),JSON.stringify({kind:'metadata-derived-local-proposal',tables,sqlSha256:hash(sql),changes,indexes,preservedDifferences:['Closed payments.amount and services.price typmods; historical values never rounded','Closed legacy views/functions retain individually captured definitions; not full remote parity'],sourceHashes:{prod:hash(fs.readFileSync(path.join(repo,'docs/production/evidence/2026-09-27/catalog-prod-scoped.metadata.json'))),stage:hash(fs.readFileSync(path.join(repo,'docs/production/evidence/2026-09-27/catalog-stage-scoped.metadata.json')))}},null,2));
  console.log(JSON.stringify({changes:changes.length,indexes:indexes.length,sqlSha256:hash(sql)}));
}
module.exports={generate,tables};
