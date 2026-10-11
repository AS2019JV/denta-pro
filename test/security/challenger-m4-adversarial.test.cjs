/**
 * Milestone 4 Adversarial Stress-Test Suite
 * Agent: teamwork_preview_challenger_m3_m4_2 (Empirical Challenger)
 * Scope:
 *  - R4-A: Migration Consolidation Atomicity, SQL Validity, Exhaustive Legacy Policy Drops,
 *          and Permissive OR Policy Accumulation Verification.
 *  - R4-B: Statutory LOPDP Citations (Art. 17 Portability, Art. 15 Elimination, Arts. 20-21 Automated Decisions),
 *          Medical Custody Retention Lock (Ley Orgánica de Salud Art. 7),
 *          and public.data_rights_requests Persistence and Tenant RLS Isolation.
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase/migrations');
const CONSOLIDATED_MIGRATION_PATH = path.join(MIGRATIONS_DIR, '20260920_security_remediation_consolidated.sql');

describe('Challenger 2 — Adversarial Stress Test: Milestone 4 (R4-A & R4-B)', () => {
  const consolidatedSql = fs.readFileSync(CONSOLIDATED_MIGRATION_PATH, 'utf8');

  // ==========================================================================
  // 1. Transaction Atomicity & SQL Structure (R4-A)
  // ==========================================================================
  describe('1. Transaction Atomicity & SQL Structure', () => {
    test('Consolidated migration is strictly encapsulated in a single transactional BEGIN ... COMMIT block', () => {
      assert.ok(fs.existsSync(CONSOLIDATED_MIGRATION_PATH), 'Consolidated migration file must exist');

      const lines = consolidatedSql.split('\n').map(l => l.trim());
      const nonCommentLines = lines.filter(l => !l.startsWith('--') && l.length > 0);

      const beginMatches = nonCommentLines.filter(l => /^BEGIN\s*;/i.test(l));
      const commitMatches = nonCommentLines.filter(l => /^COMMIT\s*;/i.test(l));
      const rollbackMatches = nonCommentLines.filter(l => /^ROLLBACK\s*;/i.test(l));

      assert.equal(beginMatches.length, 1, 'Consolidated migration must have exactly ONE top-level BEGIN; command');
      assert.equal(commitMatches.length, 1, 'Consolidated migration must have exactly ONE top-level COMMIT; command');
      assert.equal(rollbackMatches.length, 0, 'Consolidated migration must contain NO unhandled ROLLBACK; commands');

      const firstDdlIndex = nonCommentLines.findIndex(l => /^(CREATE|DROP|ALTER|INSERT|UPDATE|GRANT|REVOKE)/i.test(l));
      const beginIndex = nonCommentLines.findIndex(l => /^BEGIN\s*;/i.test(l));
      assert.ok(beginIndex >= 0 && beginIndex < firstDdlIndex, 'BEGIN; must precede all DDL statements');

      const lastStatement = nonCommentLines[nonCommentLines.length - 1];
      assert.ok(/^COMMIT\s*;/i.test(lastStatement), 'COMMIT; must be the final statement of the migration');
    });

    test('Consolidated migration has balanced dollar quotes ($$) and valid function delimiters', () => {
      const dollarMatches = consolidatedSql.match(/\$[a-zA-Z0-9_]*\$/g) || [];
      const tagCounts = {};
      for (const tag of dollarMatches) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }

      for (const [tag, count] of Object.entries(tagCounts)) {
        assert.equal(
          count % 2,
          0,
          `Dollar quote tag '${tag}' is unbalanced: found ${count} occurrences in consolidated migration`
        );
      }
      assert.ok(dollarMatches.length >= 10, 'Must have multiple PL/pgSQL function dollar-quote blocks');
    });

    test('Consolidated migration has balanced parentheses across statements', () => {
      let stripped = consolidatedSql.replace(/--.*$/gm, '');
      stripped = stripped.replace(/\$[a-zA-Z0-9_]*\$[\s\S]*?\$[a-zA-Z0-9_]*\$/g, "''");
      stripped = stripped.replace(/'(?:''|[^'])*'/g, "''");

      let openParens = 0;
      for (let i = 0; i < stripped.length; i++) {
        if (stripped[i] === '(') openParens++;
        else if (stripped[i] === ')') {
          openParens--;
          assert.ok(openParens >= 0, `Unmatched closing parenthesis at position ${i}`);
        }
      }
      assert.equal(openParens, 0, 'Parentheses must be completely balanced in SQL DDL statements');
    });
  });

  // ==========================================================================
  // 2. Exhaustive Legacy Policy Drop Audit across 8 Tables (R4-A)
  // ==========================================================================
  describe('2. Exhaustive Audit: Legacy Policy Purge vs All Historical Migrations', () => {
    const targetClinicalTables = [
      'profiles',
      'clinic_members',
      'patients',
      'prescriptions',
      'services',
      'payment_methods',
      'hcu033_forms'
    ];

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && f < '20260920');

    const legacyPolicies = new Map();

    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const regex = /CREATE\s+POLICY\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ON\s+([a-zA-Z0-9_\.]+)/gi;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const policyName = match[1] || match[2];
        let rawTable = match[3].toLowerCase();
        let tableName = rawTable.replace(/^public\./, '');

        if (targetClinicalTables.includes(tableName)) {
          const key = `${tableName}:${policyName}`;
          if (!legacyPolicies.has(key)) {
            legacyPolicies.set(key, { tableName, policyName, file });
          }
        }
      }
    }

    const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ON\s+([a-zA-Z0-9_\.]+)/gi;
    const droppedPolicies = new Set();
    let dropMatch;
    while ((dropMatch = dropRegex.exec(consolidatedSql)) !== null) {
      const policyName = dropMatch[1] || dropMatch[2];
      const rawTable = dropMatch[3].toLowerCase();
      const tableName = rawTable.replace(/^public\./, '');
      droppedPolicies.add(`${tableName}:${policyName}`);
    }

    test('Audit legacy policies: detect any missing drops on clinical & tenant tables', () => {
      const unDropped = [];

      for (const [key, info] of legacyPolicies.entries()) {
        if (!droppedPolicies.has(key)) {
          unDropped.push(`${info.tableName} -> "${info.policyName}" (created in ${info.file})`);
        }
      }

      // We assert that unDropped must be empty. If not, it exposes a permissive OR vulnerability!
      assert.deepEqual(
        unDropped,
        [],
        `CRITICAL FINDING: Found ${unDropped.length} legacy policies on target tables never dropped in consolidated migration:\n` +
        unDropped.join('\n')
      );
    });

    test('Consolidated migration Section 0.8 explicitly drops all legacy patient-files storage policies', () => {
      const requiredStorageDrops = [
        'storage.objects:Users can upload patient files',
        'storage.objects:Users can read patient files',
        'storage.objects:Users can delete patient files',
        'storage.objects:Tenant isolated read for patient-files',
        'storage.objects:Tenant isolated upload for patient-files',
        'storage.objects:Tenant isolated update for patient-files',
        'storage.objects:Tenant isolated delete for patient-files'
      ];

      for (const drop of requiredStorageDrops) {
        assert.ok(
          droppedPolicies.has(drop),
          `Missing drop of storage legacy policy: ${drop}`
        );
      }
    });

    test('Consolidated migration Section 0 drops all critical vulnerable policies specifically identified in SEC findings', () => {
      assert.ok(droppedPolicies.has('profiles:Admins can update all profiles.'));
      assert.ok(droppedPolicies.has('profiles:Admins can delete profiles.'));
      assert.ok(droppedPolicies.has('profiles:Users can update own profile.'));
      assert.ok(droppedPolicies.has('clinic_members:Users can insert their own membership'));
      assert.ok(droppedPolicies.has('clinic_members:Users can view their memberships'));
      assert.ok(droppedPolicies.has('services:Admins can insert services.'));
      assert.ok(droppedPolicies.has('services:Admins can update services.'));
      assert.ok(droppedPolicies.has('services:Admins can delete services.'));
      assert.ok(droppedPolicies.has('payment_methods:Authenticated users can manage payment methods'));
      assert.ok(droppedPolicies.has('prescriptions:Prescriptions are insertable by clinic members'));
      assert.ok(droppedPolicies.has('prescriptions:Prescriptions are updatable by clinic members'));
    });
  });

  // ==========================================================================
  // 3. Permissive OR Policy Accumulation Vulnerability Analysis (R4-A)
  // ==========================================================================
  describe('3. Permissive OR Accumulation & Cross-Tenant / Role Elevation Resistance', () => {
    // Parse all CREATE POLICY statements terminated by semicolon
    const newPolicies = [];
    const newPolicyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_\.]+)([\s\S]*?);/gi;
    let match;
    while ((match = newPolicyRegex.exec(consolidatedSql)) !== null) {
      const name = match[1];
      const table = match[2].toLowerCase().replace(/^public\./, '');
      const body = match[3];
      newPolicies.push({ name, table, body });
    }

    test('Consolidated migration defines strict policies for target tables without global permissive bypasses', () => {
      assert.ok(newPolicies.length >= 15, `Expected at least 15 newly consolidated policies, found ${newPolicies.length}`);

      for (const pol of newPolicies) {
        assert.ok(
          !/USING\s*\(\s*true\s*\)/i.test(pol.body) || /service_role/i.test(pol.body),
          `Policy "${pol.name}" on table ${pol.table} has dangerous unconditional USING (true)`
        );
        assert.ok(
          !/WITH\s+CHECK\s*\(\s*true\s*\)/i.test(pol.body) || /service_role/i.test(pol.body),
          `Policy "${pol.name}" on table ${pol.table} has dangerous unconditional WITH CHECK (true)`
        );
      }
    });

    test('public.clinic_members: Direct client INSERT is completely revoked to prevent self-enrollment (SEC-03)', () => {
      assert.ok(
        /REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+public\.clinic_members\s+FROM\s+authenticated/i.test(consolidatedSql),
        'clinic_members must revoke direct client mutation'
      );
      const insertMembersPolicy = newPolicies.find(p => p.table === 'clinic_members' && /FOR\s+INSERT/i.test(p.body));
      assert.equal(insertMembersPolicy, undefined, 'No client INSERT policy should exist on clinic_members');
    });

    test('public.profiles: Update is locked down and privilege escalation trigger is attached (SEC-02)', () => {
      assert.ok(consolidatedSql.includes('prevent_profile_privilege_escalation'), 'Must attach privilege escalation trigger');
      assert.ok(
        consolidatedSql.includes("RAISE EXCEPTION 'Unauthorized profile mutation: role cannot be modified"),
        'Trigger must block role changes'
      );
      assert.ok(
        consolidatedSql.includes("RAISE EXCEPTION 'Unauthorized profile mutation: clinic_id cannot be modified"),
        'Trigger must block clinic_id changes'
      );

      const profileUpdatePolicies = newPolicies.filter(p => p.table === 'profiles' && /FOR\s+UPDATE/i.test(p.body));
      assert.ok(profileUpdatePolicies.length > 0, 'Must have scoped UPDATE policy on profiles');
      for (const pol of profileUpdatePolicies) {
        assert.ok(
          pol.body.includes('auth.uid() = id') || pol.body.includes("'clinic_owner'"),
          `Profile update policy "${pol.name}" must be bound to self or clinic owner`
        );
      }
    });

    test('public.services: Only clinic owners can insert/update/delete within their own clinic (SEC-12)', () => {
      const servicesInsertPolicy = newPolicies.find(p => p.table === 'services' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(servicesInsertPolicy, 'Must have INSERT policy on services');
      assert.ok(
        servicesInsertPolicy.body.includes("role') = 'clinic_owner'"),
        'Services insert must require clinic_owner role'
      );
      assert.ok(
        servicesInsertPolicy.body.includes("clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid"),
        'Services insert must verify clinic_id match'
      );
    });

    test('public.payment_methods: Partitioned by clinic_id and only editable by clinic owners (SEC-13)', () => {
      assert.ok(consolidatedSql.includes('ALTER TABLE public.payment_methods'), 'Must alter payment_methods');
      assert.ok(consolidatedSql.includes('clinic_id UUID'), 'Must add clinic_id column');
      const pmInsert = newPolicies.find(p => p.table === 'payment_methods' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(pmInsert, 'Must have INSERT policy on payment_methods');
      assert.ok(
        pmInsert.body.includes("role') = 'clinic_owner'"),
        'Payment methods insert must require clinic_owner'
      );
    });

    test('storage.objects: Isolated by clinic_id prefix for patient-files (SEC-05)', () => {
      const storageRead = newPolicies.find(p => p.table === 'storage.objects' && /FOR\s+SELECT/i.test(p.body));
      assert.ok(storageRead, 'Must have storage read policy');
      assert.ok(
        storageRead.body.includes("bucket_id = 'patient-files'"),
        'Storage policy must isolate patient-files bucket'
      );
      assert.ok(
        storageRead.body.includes("(storage.foldername(name))[1]::uuid"),
        'Storage policy must enforce clinic_id path prefix'
      );
    });

    test('public.prescriptions & public.hcu033_forms: Clinical roles strictly enforced (SEC-07)', () => {
      const rxInsert = newPolicies.find(p => p.table === 'prescriptions' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(rxInsert, 'Must have prescription insert policy');
      assert.ok(
        rxInsert.body.includes("'doctor'") && rxInsert.body.includes("'clinic_owner'"),
        'Prescription insert must require doctor or clinic_owner'
      );
      assert.ok(
        rxInsert.body.includes('doctor_id = auth.uid()'),
        'Prescription insert must lock doctor_id to authenticated caller'
      );
    });
  });

  // ==========================================================================
  // 4. LOPDP Statutory Citations & Repository-Wide Sweep (R4-B)
  // ==========================================================================
  describe('4. Statutory LOPDP Citations Sweep & Document Verification', () => {
    const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.md', '.sql', '.html', '.json'];
    
    function walkDir(dir, results = []) {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === 'node_modules' || file === '.git' || file === '.next' || file === '.agents') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath, results);
        } else if (textExtensions.includes(path.extname(fullPath))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allProjectFiles = walkDir(ROOT_DIR);

    test('Zero references across entire repository where Portability is cited as Art. 20 (R4-B requirement)', () => {
      const invalidMatches = [];
      const regex = /(?:Portabilidad|Portability|Export(?:ar)?)[^.\n\r]*Art(?:[íi]culo|\.)?\s*20\s*LOPDP/i;
      const reverseRegex = /Art(?:[íi]culo|\.)?\s*20\s*LOPDP[^.\n\r]*(?:Portabilidad|Portability)/i;

      for (const filePath of allProjectFiles) {
        if (filePath.includes('test') || filePath.includes('challenger')) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (regex.test(line) || reverseRegex.test(line)) {
            invalidMatches.push({ file: path.relative(ROOT_DIR, filePath), line: idx + 1, content: line.trim() });
          }
        });
      }

      assert.deepEqual(
        invalidMatches,
        [],
        `Found outdated LOPDP Portability citations (Art. 20 instead of Art. 17):\n` +
        invalidMatches.map(m => `  ${m.file}:${m.line} -> ${m.content}`).join('\n')
      );
    });

    test('Zero references across entire repository where Deletion/Elimination is cited as Art. 21 (R4-B requirement)', () => {
      const invalidMatches = [];
      const regex = /(?:Eliminaci[óo]n|Supresi[óo]n|Baja|Deletion|Suppression)[^.\n\r]*Art(?:[íi]culo|\.)?\s*21\s*LOPDP/i;
      const reverseRegex = /Art(?:[íi]culo|\.)?\s*21\s*LOPDP[^.\n\r]*(?:Eliminaci[óo]n|Supresi[óo]n|Baja|Deletion|Suppression)/i;

      for (const filePath of allProjectFiles) {
        if (filePath.includes('test') || filePath.includes('challenger')) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (regex.test(line) || reverseRegex.test(line)) {
            invalidMatches.push({ file: path.relative(ROOT_DIR, filePath), line: idx + 1, content: line.trim() });
          }
        });
      }

      assert.deepEqual(
        invalidMatches,
        [],
        `Found outdated LOPDP Elimination citations (Art. 21 instead of Art. 15):\n` +
        invalidMatches.map(m => `  ${m.file}:${m.line} -> ${m.content}`).join('\n')
      );
    });

    test('Statutory Articles 20 and 21 are properly explained as governing automated decisions / profiling', () => {
      const privacyTab = fs.readFileSync(path.join(ROOT_DIR, 'components/settings/privacy-tab.tsx'), 'utf8');
      assert.ok(
        privacyTab.includes('valoraciones automatizadas') || privacyTab.includes('elaboración de perfiles'),
        'Privacy tab must clarify Arts 20-21 govern automated decisions and profiling'
      );
      assert.ok(
        privacyTab.includes('Art. 17 LOPDP'),
        'Privacy tab must cite Art. 17 for Portability'
      );
      assert.ok(
        privacyTab.includes('Art. 15 LOPDP'),
        'Privacy tab must cite Art. 15 for Elimination'
      );
    });
  });

  // ==========================================================================
  // 5. Medical History Custody Retention Lock (R4-B & Ley Orgánica de Salud)
  // ==========================================================================
  describe('5. Medical History Custody Retention Lock & Deletion Safeguards', () => {
    test('PrivacyTab deletion action enforces retention lock and prohibits immediate hard deletion', () => {
      const privacyTab = fs.readFileSync(path.join(ROOT_DIR, 'components/settings/privacy-tab.tsx'), 'utf8');

      assert.ok(
        !privacyTab.includes(".from('patients').delete()"),
        'Privacy tab must NOT perform hard DELETE on patients'
      );
      assert.ok(
        !privacyTab.includes(".from('clinics').delete()"),
        'Privacy tab must NOT perform hard DELETE on clinics'
      );
      assert.ok(
        !privacyTab.includes(".from('hcu033_forms').delete()"),
        'Privacy tab must NOT perform hard DELETE on hcu033_forms'
      );

      assert.ok(
        privacyTab.includes("request_type: 'deletion'"),
        'Deletion request must insert request_type: deletion into data_rights_requests'
      );
      assert.ok(
        privacyTab.includes("status: 'pending'"),
        'Deletion request must start with status: pending for medical audit'
      );
      assert.ok(
        privacyTab.includes('5 a 10 años') || privacyTab.includes('5-10 años'),
        'Deletion modal must inform user of mandatory 5-10 year clinical history retention'
      );
      assert.ok(
        privacyTab.includes('Ley Orgánica de Salud') && privacyTab.includes('Art. 7'),
        'Deletion modal must cite Ley Orgánica de Salud Art. 7'
      );
    });

    test('purge_clinic_data RPC in consolidated migration strictly enforces 90-day minimum retention window', () => {
      assert.ok(
        consolidatedSql.includes("archived_at >= NOW() - INTERVAL '90 days'"),
        'purge_clinic_data must enforce 90-day retention before purge'
      );
      assert.ok(
        consolidatedSql.includes("Retention lock active: Clinic cannot be purged before 90-day retention period elapsed"),
        'purge_clinic_data must raise exception if retention period is active'
      );
    });
  });

  // ==========================================================================
  // 6. public.data_rights_requests Persistence & Multi-Tenant RLS Isolation
  // ==========================================================================
  describe('6. public.data_rights_requests Persistence & Tenant RLS Isolation', () => {
    test('Table public.data_rights_requests schema is complete, indexed, and has RLS enabled', () => {
      assert.ok(
        consolidatedSql.includes('CREATE TABLE IF NOT EXISTS public.data_rights_requests'),
        'data_rights_requests table must be created'
      );
      assert.ok(
        consolidatedSql.includes('clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL'),
        'data_rights_requests must have NOT NULL foreign key to clinics'
      );
      assert.ok(
        consolidatedSql.includes('ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;'),
        'data_rights_requests must have RLS enabled'
      );
      assert.ok(
        consolidatedSql.includes('CREATE INDEX IF NOT EXISTS idx_data_rights_requests_type \n  ON public.data_rights_requests(clinic_id, request_type);') ||
        consolidatedSql.includes('ON public.data_rights_requests(clinic_id, request_type);'),
        'data_rights_requests must be indexed by clinic_id'
      );
    });

    test('public.data_rights_requests enforces multi-tenant RLS boundaries (cannot leak cross-tenant)', () => {
      const selectMatch = consolidatedSql.match(/CREATE\s+POLICY\s+"Clinic\s+members\s+can\s+view\s+data\s+rights\s+requests"[\s\S]*?ON\s+public\.data_rights_requests[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(([\s\S]*?)\);/i);
      assert.ok(selectMatch, 'Must define SELECT policy for data_rights_requests');
      const selectUsing = selectMatch[1];

      assert.ok(
        selectUsing.includes("(auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid") ||
        selectUsing.includes('clinic_members'),
        'SELECT policy on data_rights_requests must strictly enforce tenant match'
      );

      const insertMatch = consolidatedSql.match(/CREATE\s+POLICY\s+"Authenticated\s+users\s+can\s+submit\s+data\s+rights\s+requests"[\s\S]*?ON\s+public\.data_rights_requests[\s\S]*?FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(([\s\S]*?)\);/i);
      assert.ok(insertMatch, 'Must define INSERT policy for data_rights_requests');
      const insertCheck = insertMatch[1];

      assert.ok(
        insertCheck.includes('user_id IS NULL OR user_id = auth.uid()') ||
        insertCheck.includes('auth.uid() = user_id'),
        'INSERT policy must lock user_id to auth.uid()'
      );
      assert.ok(
        insertCheck.includes("(auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid") ||
        insertCheck.includes('clinic_members'),
        'INSERT policy must restrict clinic_id to caller clinic'
      );
    });

    test('Helper RPC log_data_rights_request validates caller auth, tenant context, and is restricted from anon', () => {
      assert.ok(
        consolidatedSql.includes('CREATE OR REPLACE FUNCTION public.log_data_rights_request'),
        'Must define log_data_rights_request RPC'
      );
      assert.ok(
        consolidatedSql.includes("IF auth.uid() IS NULL THEN"),
        'RPC must reject unauthenticated callers'
      );
      assert.ok(
        consolidatedSql.includes("REVOKE ALL ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;"),
        'RPC execution must be revoked from public and anon'
      );
      assert.ok(
        consolidatedSql.includes("GRANT EXECUTE ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;"),
        'RPC execution must be granted strictly to authenticated and service_role'
      );
    });
  });
});
