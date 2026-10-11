/**
 * Milestone 4 Remediation Adversarial AST Stress-Test Suite
 * Agent: teamwork_preview_challenger_m4_rem_1 (Empirical Challenger)
 * Scope:
 *  - Deep AST & SQL Grammar verification of `supabase/migrations/20260920_security_remediation_consolidated.sql`
 *  - Complete historical policy migration sweep across all 55 migrations
 *  - Permissive OR bypass prevention & RLS policy non-interference
 *  - Statutory LOPDP compliance (Art. 17 Portability, Art. 15 Elimination, Arts. 20-21 Automated Decisions)
 *  - Medical custody retention enforcement (Ley Orgánica de Salud Art. 7)
 *  - public.data_rights_requests schema, RLS, and RPC security
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase/migrations');
const CONSOLIDATED_SQL_PATH = path.join(MIGRATIONS_DIR, '20260920_security_remediation_consolidated.sql');

describe('Challenger M4 Remediation: Adversarial AST & Policy Purge Stress Test', () => {
  const consolidatedSql = fs.readFileSync(CONSOLIDATED_SQL_PATH, 'utf8');

  // Target tables managed by the consolidated migration remediation
  const targetTables = [
    'profiles',
    'clinic_members',
    'patients',
    'prescriptions',
    'services',
    'payment_methods',
    'hcu033_forms',
    'storage.objects',
    'data_rights_requests'
  ];

  // ==========================================================================
  // Suite 1: AST Legacy Policy Drop Verification across all 55 Historical Migrations
  // ==========================================================================
  describe('Suite 1: AST Legacy Policy Drop Verification', () => {
    const historicalFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && f < '20260920');

    // Extract all policies created in historical migrations for target tables
    const historicalCreated = new Map();
    const createRegex = /CREATE\s+POLICY\s+(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))\s+ON\s+([a-zA-Z0-9_\.]+)/gi;

    for (const file of historicalFiles) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      let m;
      while ((m = createRegex.exec(content)) !== null) {
        const policyName = (m[1] || m[2] || m[3]).trim();
        let tbl = m[4].toLowerCase().trim().replace(/^public\./, '');
        if (tbl === 'objects') tbl = 'storage.objects';

        if (targetTables.includes(tbl)) {
          const key = `${tbl}:::${policyName}`;
          if (!historicalCreated.has(key)) {
            historicalCreated.set(key, { table: tbl, policy: policyName, files: [] });
          }
          historicalCreated.get(key).files.push(file);
        }
      }
    }

    // Extract all policy drops in the consolidated migration
    const droppedPolicies = new Set();
    const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))\s+ON\s+([a-zA-Z0-9_\.]+)/gi;
    let dm;
    while ((dm = dropRegex.exec(consolidatedSql)) !== null) {
      const policyName = (dm[1] || dm[2] || dm[3]).trim();
      let tbl = dm[4].toLowerCase().trim().replace(/^public\./, '');
      if (tbl === 'objects') tbl = 'storage.objects';
      droppedPolicies.add(`${tbl}:::${policyName}`);
    }

    test('All historical policies on target tables are dropped before re-creation', () => {
      const undropped = [];
      for (const [key, info] of historicalCreated.entries()) {
        // Storage policies for public clinic logos are outside patient-files scope
        if (info.table === 'storage.objects' && !info.policy.toLowerCase().includes('patient')) {
          continue;
        }

        if (!droppedPolicies.has(key)) {
          undropped.push(`${info.table} -> "${info.policy}" (created in ${info.files.join(', ')})`);
        }
      }

      assert.deepEqual(
        undropped,
        [],
        `CRITICAL AST FAILURE: Unpurged historical policies detected:\n${undropped.join('\n')}`
      );
    });

    test('Consolidated migration Section 0 contains explicit drops for all 3 previously failing policies', () => {
      assert.ok(
        droppedPolicies.has('profiles:::Users can view profiles in their clinic'),
        'profiles: "Users can view profiles in their clinic" must be explicitly dropped'
      );
      assert.ok(
        droppedPolicies.has('patients:::Users can view patients in their valid clinics'),
        'patients: "Users can view patients in their valid clinics" must be explicitly dropped'
      );
      assert.ok(
        droppedPolicies.has('patients:::Users can insert patients in their valid clinics'),
        'patients: "Users can insert patients in their valid clinics" must be explicitly dropped'
      );
    });

    test('Every DROP POLICY statement in consolidated migration utilizes IF EXISTS for idempotency', () => {
      const dropStatements = consolidatedSql.match(/DROP\s+POLICY[\s\S]*?;/gi) || [];
      assert.ok(dropStatements.length >= 50, `Expected at least 50 drop statements, got ${dropStatements.length}`);

      for (const stmt of dropStatements) {
        assert.ok(
          /DROP\s+POLICY\s+IF\s+EXISTS/i.test(stmt),
          `Found DROP POLICY without IF EXISTS: ${stmt.trim()}`
        );
      }
    });
  });

  // ==========================================================================
  // Suite 2: RLS Permissive Policy Accumulation & Authorization Hardening
  // ==========================================================================
  describe('Suite 2: RLS Permissive Policy Accumulation & Authorization Hardening', () => {
    // Parse all newly created policies in consolidated migration
    const consolidatedPolicies = [];
    const createPolRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_\.]+)([\s\S]*?);/gi;
    let cm;
    while ((cm = createPolRegex.exec(consolidatedSql)) !== null) {
      const name = cm[1];
      const table = cm[2].toLowerCase().trim().replace(/^public\./, '');
      const body = cm[3];
      consolidatedPolicies.push({ name, table, body });
    }

    test('All consolidated target tables enable ROW LEVEL SECURITY explicitly', () => {
      for (const tbl of ['profiles', 'clinic_members', 'patients', 'prescriptions', 'services', 'payment_methods', 'hcu033_forms', 'data_rights_requests']) {
        const rlsPattern = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tbl}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        assert.ok(rlsPattern.test(consolidatedSql), `Table public.${tbl} must explicitly ENABLE ROW LEVEL SECURITY`);
      }
    });

    test('No newly created policy has unconditional permissive bypasses (USING true / WITH CHECK true)', () => {
      for (const pol of consolidatedPolicies) {
        // Only service_role policies may have true
        const hasUnconditionalUsing = /USING\s*\(\s*true\s*\)/i.test(pol.body);
        const hasUnconditionalCheck = /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(pol.body);

        if (hasUnconditionalUsing || hasUnconditionalCheck) {
          assert.ok(
            /service_role/i.test(pol.body) || /service_role/i.test(pol.name),
            `Policy "${pol.name}" on ${pol.table} contains unconditional true without service_role guard!`
          );
        }
      }
    });

    test('public.patients: Enforces tenant matching via JWT app_metadata, active subscription, and doctor/owner triggers', () => {
      const patientSelect = consolidatedPolicies.find(p => p.table === 'patients' && /FOR\s+SELECT/i.test(p.body));
      assert.ok(patientSelect, 'patients table must have SELECT policy');
      assert.ok(patientSelect.body.includes("clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid"), 'Patient SELECT must enforce tenant JWT match');

      const patientInsert = consolidatedPolicies.find(p => p.table === 'patients' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(patientInsert, 'patients table must have INSERT policy');
      assert.ok(patientInsert.body.includes('check_subscription_active'), 'Patient INSERT must check subscription');

      const patientUpdate = consolidatedPolicies.find(p => p.table === 'patients' && /FOR\s+UPDATE/i.test(p.body));
      assert.ok(patientUpdate, 'patients table must have UPDATE policy');
      assert.ok(patientUpdate.body.includes('check_subscription_active'), 'Patient UPDATE must check subscription');

      const patientDelete = consolidatedPolicies.find(p => p.table === 'patients' && /FOR\s+DELETE/i.test(p.body));
      assert.ok(patientDelete, 'patients table must have DELETE policy');
      assert.ok(patientDelete.body.includes("'clinic_owner'"), 'Patient DELETE must require clinic_owner role');
    });

    test('public.prescriptions & public.hcu033_forms: Clinical roles strictly enforced', () => {
      const rxPolicies = consolidatedPolicies.filter(p => p.table === 'prescriptions');
      assert.ok(rxPolicies.length >= 3, 'Must define at least 3 policies for prescriptions');

      const rxInsert = rxPolicies.find(p => /FOR\s+INSERT/i.test(p.body));
      assert.ok(rxInsert, 'Must define INSERT policy on prescriptions');
      assert.ok(rxInsert.body.includes("'doctor'") && rxInsert.body.includes("'clinic_owner'"), 'Prescription INSERT requires doctor or clinic_owner');
      assert.ok(rxInsert.body.includes('doctor_id = auth.uid()'), 'Prescription INSERT binds doctor_id to auth.uid()');

      const hcuPolicies = consolidatedPolicies.filter(p => p.table === 'hcu033_forms');
      assert.ok(hcuPolicies.length >= 3, 'Must define at least 3 policies for hcu033_forms');

      const hcuInsert = hcuPolicies.find(p => /FOR\s+INSERT/i.test(p.body));
      assert.ok(hcuInsert, 'Must define INSERT policy on hcu033_forms');
      assert.ok(hcuInsert.body.includes("'doctor'") && hcuInsert.body.includes("'clinic_owner'"), 'HCU033 INSERT requires doctor or clinic_owner');
    });

    test('public.services & public.payment_methods: Tenant isolation and owner mutation locked', () => {
      const svcInsert = consolidatedPolicies.find(p => p.table === 'services' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(svcInsert, 'services table must have INSERT policy');
      assert.ok(svcInsert.body.includes("'clinic_owner'"), 'services INSERT requires clinic_owner');

      const pmInsert = consolidatedPolicies.find(p => p.table === 'payment_methods' && /FOR\s+INSERT/i.test(p.body));
      assert.ok(pmInsert, 'payment_methods table must have INSERT policy');
      assert.ok(pmInsert.body.includes("'clinic_owner'"), 'payment_methods INSERT requires clinic_owner');
    });

    test('storage.objects: Patient-files bucket enforces tenant folder isolation', () => {
      const storagePolicies = consolidatedPolicies.filter(p => p.table === 'objects' || p.table === 'storage.objects');
      assert.ok(storagePolicies.length >= 3, 'Must define at least 3 storage policies');

      for (const sp of storagePolicies) {
        if (/patient-files/i.test(sp.body)) {
          assert.ok(
            sp.body.includes('(storage.foldername(name))[1]::uuid'),
            `Storage policy "${sp.name}" must verify first folder component matches tenant UUID`
          );
        }
      }
    });
  });

  // ==========================================================================
  // Suite 3: SQL Grammar, Transaction Bounds, and AST Invariants
  // ==========================================================================
  describe('Suite 3: SQL Grammar, Transaction Bounds, and AST Invariants', () => {
    test('Consolidated migration is strictly encapsulated within BEGIN; and COMMIT;', () => {
      const trimmed = consolidatedSql.trim();
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('--'));

      assert.equal(lines[0], 'BEGIN;', 'First non-comment line must be BEGIN;');
      assert.equal(lines[lines.length - 1], 'COMMIT;', 'Last non-comment line must be COMMIT;');

      const middleBegins = lines.slice(1, -1).filter(l => /^BEGIN\s*;/i.test(l));
      const middleCommits = lines.slice(1, -1).filter(l => /^COMMIT\s*;/i.test(l));
      const middleRollbacks = lines.slice(1, -1).filter(l => /^ROLLBACK\s*;/i.test(l));

      assert.equal(middleBegins.length, 0, 'No nested BEGIN; statements allowed');
      assert.equal(middleCommits.length, 0, 'No intermediate COMMIT; statements allowed');
      assert.equal(middleRollbacks.length, 0, 'No unhandled ROLLBACK; statements allowed');
    });

    test('Dollar quoted strings and PL/pgSQL function blocks are completely balanced', () => {
      const matches = consolidatedSql.match(/\$[a-zA-Z0-9_]*\$/g) || [];
      assert.ok(matches.length >= 10, 'Expected multiple PL/pgSQL dollar-quoted blocks');

      const counts = {};
      for (const tag of matches) {
        counts[tag] = (counts[tag] || 0) + 1;
      }

      for (const [tag, count] of Object.entries(counts)) {
        assert.equal(count % 2, 0, `Unbalanced dollar quote delimiter: ${tag} occurred ${count} times`);
      }
    });

    test('Parentheses nesting depth returns to zero at end of file', () => {
      // Strip comments, dollar quotes, and single quotes
      let clean = consolidatedSql.replace(/--.*$/gm, '');
      clean = clean.replace(/\$[a-zA-Z0-9_]*\$[\s\S]*?\$[a-zA-Z0-9_]*\$/g, "''");
      clean = clean.replace(/'(?:''|[^'])*'/g, "''");

      let depth = 0;
      for (let i = 0; i < clean.length; i++) {
        if (clean[i] === '(') depth++;
        else if (clean[i] === ')') depth--;
        assert.ok(depth >= 0, `Closing parenthesis without matching opening at offset ${i}`);
      }
      assert.equal(depth, 0, 'All opened parentheses must be closed');
    });
  });

  // ==========================================================================
  // Suite 4: Statutory LOPDP Citations & Medical Custody Verification (R4-B)
  // ==========================================================================
  describe('Suite 4: Statutory LOPDP Citations & Medical Custody Safeguards', () => {
    const textExts = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.md', '.sql', '.html', '.json'];

    function getAllFiles(dir, files = []) {
      for (const item of fs.readdirSync(dir)) {
        if (['node_modules', '.git', '.next', '.agents'].includes(item)) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          getAllFiles(full, files);
        } else if (textExts.includes(path.extname(full))) {
          files.push(full);
        }
      }
      return files;
    }

    const allProjectFiles = getAllFiles(ROOT_DIR);

    test('Statutory Portability is universally cited as Article 17 across code and documentation', () => {
      const erroneousArt20 = [];
      const art20Regex = /(?:Portabilidad|Portability|Exportar)[^.\n\r]*Art(?:[íi]culo|\.)?\s*20\s*LOPDP/i;
      const reverseArt20 = /Art(?:[íi]culo|\.)?\s*20\s*LOPDP[^.\n\r]*(?:Portabilidad|Portability)/i;

      for (const fp of allProjectFiles) {
        if (fp.includes('test') || fp.includes('challenger')) continue;
        const content = fs.readFileSync(fp, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (art20Regex.test(line) || reverseArt20.test(line)) {
            erroneousArt20.push({ file: path.relative(ROOT_DIR, fp), line: i + 1, text: line.trim() });
          }
        });
      }

      assert.deepEqual(
        erroneousArt20,
        [],
        `Found incorrect LOPDP Portability citations as Art. 20 (must be Art. 17):\n` +
        erroneousArt20.map(e => `  ${e.file}:${e.line} -> ${e.text}`).join('\n')
      );
    });

    test('Statutory Elimination/Suppression is universally cited as Article 15 across code and documentation', () => {
      const erroneousArt21 = [];
      const art21Regex = /(?:Eliminaci[óo]n|Supresi[óo]n|Baja|Deletion|Suppression)[^.\n\r]*Art(?:[íi]culo|\.)?\s*21\s*LOPDP/i;
      const reverseArt21 = /Art(?:[íi]culo|\.)?\s*21\s*LOPDP[^.\n\r]*(?:Eliminaci[óo]n|Supresi[óo]n|Baja|Deletion|Suppression)/i;

      for (const fp of allProjectFiles) {
        if (fp.includes('test') || fp.includes('challenger')) continue;
        const content = fs.readFileSync(fp, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (art21Regex.test(line) || reverseArt21.test(line)) {
            erroneousArt21.push({ file: path.relative(ROOT_DIR, fp), line: i + 1, text: line.trim() });
          }
        });
      }

      assert.deepEqual(
        erroneousArt21,
        [],
        `Found incorrect LOPDP Elimination citations as Art. 21 (must be Art. 15):\n` +
        erroneousArt21.map(e => `  ${e.file}:${e.line} -> ${e.text}`).join('\n')
      );
    });

    test('Articles 20 and 21 are explicitly documented as governing automated decision-making and profiling', () => {
      const privacyTabPath = path.join(ROOT_DIR, 'components/settings/privacy-tab.tsx');
      assert.ok(fs.existsSync(privacyTabPath), 'privacy-tab.tsx must exist');
      const content = fs.readFileSync(privacyTabPath, 'utf8');

      assert.ok(
        content.includes('valoraciones automatizadas') || content.includes('decisiones automatizadas'),
        'Privacy UI must correctly reference automated valuations / decisions'
      );
      assert.ok(
        content.includes('elaboración de perfiles'),
        'Privacy UI must correctly reference profiling (elaboración de perfiles)'
      );
    });

    test('Medical custody retention under Ley Orgánica de Salud Art. 7 (5-10 years) blocks naive hard deletion', () => {
      const privacyTab = fs.readFileSync(path.join(ROOT_DIR, 'components/settings/privacy-tab.tsx'), 'utf8');

      // Ensure client UI never deletes patients or clinic directly
      assert.ok(!privacyTab.includes(".from('patients').delete()"), 'Privacy tab must never issue client DELETE to patients');
      assert.ok(!privacyTab.includes(".from('clinics').delete()"), 'Privacy tab must never issue client DELETE to clinics');

      // Ensure 5-10 year clinical history retention is explained to practitioner
      assert.ok(privacyTab.includes('5 a 10 años') || privacyTab.includes('5-10 años'), 'Must notify user of 5-10 year statutory retention');
      assert.ok(privacyTab.includes('Ley Orgánica de Salud') && privacyTab.includes('Art. 7'), 'Must cite Ley Orgánica de Salud Art. 7');

      // Ensure purge_clinic_data in consolidated migration checks 90-day cooldown
      assert.ok(consolidatedSql.includes("archived_at >= NOW() - INTERVAL '90 days'"), 'purge_clinic_data must enforce 90-day cooldown');
    });
  });

  // ==========================================================================
  // Suite 5: public.data_rights_requests Schema, RLS, and RPC Security
  // ==========================================================================
  describe('Suite 5: public.data_rights_requests Schema, RLS, and RPC Security', () => {
    test('public.data_rights_requests table has complete schema and RLS enabled', () => {
      assert.ok(consolidatedSql.includes('CREATE TABLE IF NOT EXISTS public.data_rights_requests'), 'Table must be created');
      assert.ok(consolidatedSql.includes('ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;'), 'RLS must be enabled');
      assert.ok(consolidatedSql.includes('clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL'), 'clinic_id FK required');
      assert.ok(consolidatedSql.includes('request_type TEXT NOT NULL'), 'request_type required');
      assert.ok(consolidatedSql.includes('status TEXT NOT NULL DEFAULT \'pending\''), 'status required with pending default');
      assert.ok(
        consolidatedSql.includes('idx_data_rights_requests_tenant') && consolidatedSql.includes('idx_data_rights_requests_type'),
        'Must have indices for tenant and request_type'
      );
    });

    test('public.data_rights_requests RLS strictly prevents cross-tenant access', () => {
      const selectPol = consolidatedSql.match(/CREATE\s+POLICY\s+"Clinic members can view data rights requests"[\s\S]*?ON\s+public\.data_rights_requests[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(([\s\S]*?)\);/i);
      assert.ok(selectPol, 'Must have SELECT policy for data_rights_requests');
      assert.ok(selectPol[1].includes("(auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid") || selectPol[1].includes('clinic_members'), 'SELECT policy enforces tenant match');

      const insertPol = consolidatedSql.match(/CREATE\s+POLICY\s+"Authenticated users can submit data rights requests"[\s\S]*?ON\s+public\.data_rights_requests[\s\S]*?FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(([\s\S]*?)\);/i);
      assert.ok(insertPol, 'Must have INSERT policy for data_rights_requests');
      assert.ok(insertPol[1].includes('user_id IS NULL OR user_id = auth.uid()') || insertPol[1].includes('auth.uid() = user_id'), 'INSERT policy verifies user_id');

      const updatePol = consolidatedSql.match(/CREATE\s+POLICY\s+"Clinic owners can update data rights requests"[\s\S]*?ON\s+public\.data_rights_requests[\s\S]*?FOR\s+UPDATE[\s\S]*?USING\s*\(([\s\S]*?)\);/i);
      assert.ok(updatePol, 'Must have UPDATE policy for data_rights_requests');
      assert.ok(updatePol[1].includes("'clinic_owner'"), 'UPDATE policy restricted to clinic_owner');
    });

    test('Helper RPC log_data_rights_request enforces authentication and security permissions', () => {
      assert.ok(consolidatedSql.includes('CREATE OR REPLACE FUNCTION public.log_data_rights_request'), 'RPC function must exist');
      assert.ok(consolidatedSql.includes('IF auth.uid() IS NULL THEN'), 'RPC checks authenticated session');
      assert.ok(consolidatedSql.includes('REVOKE ALL ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;'), 'Revoked from public & anon');
      assert.ok(consolidatedSql.includes('GRANT EXECUTE ON FUNCTION public.log_data_rights_request(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;'), 'Granted to authenticated & service_role');
    });
  });
});
