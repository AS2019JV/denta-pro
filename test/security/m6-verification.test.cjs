/**
 * Milestone 6 Security Hardening & Contract Fix Verification Suite
 * Target: Validates fixes for M5-01, M5-02, M5-03, and Workflow Gaps 1-5
 * Reference: docs/security/M5_VERIFICATION_AND_NEXT_STEPS_2026-09-22.md
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT_DIR = join(__dirname, '../..');
const M6_MIGRATION_PATH = join(ROOT_DIR, 'supabase/migrations/20260922_m6_security_hardening_and_contract_fix.sql');
const AVATAR_UPLOAD_PATH = join(ROOT_DIR, 'components/avatar-upload.tsx');
const PRIVACY_TAB_PATH = join(ROOT_DIR, 'components/settings/privacy-tab.tsx');
const NEXT_CONFIG_PATH = join(ROOT_DIR, 'next.config.mjs');
const SEND_EMAIL_PATH = join(ROOT_DIR, 'app/api/send-email/route.ts');
const INVITE_MEMBER_PATH = join(ROOT_DIR, 'app/actions/invite-member.ts');
const PAY_PAGE_PATH = join(ROOT_DIR, 'app/(dashboard)/pay/[id]/page.tsx');

function readFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

describe('M5-01: Legacy Storage Policy Purge & Storage Objects Consolidation', () => {
  const m6Sql = readFile(M6_MIGRATION_PATH);

  test('Migration file exists and executes in a single transaction', () => {
    assert.ok(existsSync(M6_MIGRATION_PATH), 'M6 migration file must exist');
    assert.ok(m6Sql.includes('BEGIN;'), 'Migration must include transaction BEGIN');
    assert.ok(m6Sql.trimEnd().endsWith('COMMIT;'), 'Migration must end with transaction COMMIT');
  });

  test('Explicitly drops all 5 surviving legacy permissive storage policies', () => {
    const requiredDrops = [
      'DROP POLICY IF EXISTS "Public Access to Patient Avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users upload patient avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users update patient avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Public Access to Receipts" ON storage.objects;',
      'DROP POLICY IF EXISTS "Public Upload to Receipts" ON storage.objects;',
    ];

    for (const dropStmt of requiredDrops) {
      assert.ok(m6Sql.includes(dropStmt), `Must include: ${dropStmt}`);
    }
  });

  test('Drops historical naming variants to prevent permissive OR accumulation', () => {
    const historicalDrops = [
      'DROP POLICY IF EXISTS "Public patient avatar access" ON storage.objects;',
      'DROP POLICY IF EXISTS "Public patient avatar select" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users can upload patient avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users can update patient avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users can delete patient avatars" ON storage.objects;',
      'DROP POLICY IF EXISTS "Public receipts access" ON storage.objects;',
      'DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;',
    ];

    for (const dropStmt of historicalDrops) {
      assert.ok(m6Sql.includes(dropStmt), `Must include historical drop: ${dropStmt}`);
    }
  });

  test('Buckets patient-avatars, receipts, and patient-files are updated to private', () => {
    assert.ok(m6Sql.includes("UPDATE storage.buckets\nSET public = false,\n    file_size_limit = 5242880"), 'patient-avatars must be private');
    assert.ok(m6Sql.includes("UPDATE storage.buckets\nSET public = false,\n    file_size_limit = 10485760"), 'receipts must be private');
    assert.ok(m6Sql.includes("UPDATE storage.buckets\nSET public = false,\n    file_size_limit = 20971520"), 'patient-files must be private');
  });

  test('Creates canonical tenant-isolated storage policies for patient-avatars with patient binding', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated select for patient-avatars"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated insert for patient-avatars"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated update for patient-avatars"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated delete for patient-avatars"'));
    assert.ok(m6Sql.includes('WHERE p.id = ((storage.foldername(name))[2])::uuid'), 'Must bind patient component in patient-avatars');
  });

  test('Creates canonical tenant-isolated storage policies for receipts supporting clinic and billing paths', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated select for receipts"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated insert for receipts"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated update for receipts"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated delete for receipts"'));
    assert.ok(m6Sql.includes('Case A: Path is <clinic_id>/...'), 'Must support clinic-scoped path');
    assert.ok(m6Sql.includes('Case B: Legacy / direct path <billing_id>/...'), 'Must support billing-scoped path');
  });
});

describe('M5-02: Patient RPC Contract Restoration & SQL Types', () => {
  const m6Sql = readFile(M6_MIGRATION_PATH);

  test('get_patients_with_stats uses birth_date and NEVER date_of_birth', () => {
    assert.ok(m6Sql.includes('birth_date date'), 'Return signature must declare birth_date date');
    assert.ok(!m6Sql.includes('date_of_birth date'), 'Return signature must NOT declare date_of_birth');
    assert.ok(m6Sql.includes('pat.birth_date,'), 'Query must select pat.birth_date');
    assert.ok(!m6Sql.includes('pat.date_of_birth'), 'Query must NOT select pat.date_of_birth');
  });

  test('get_patients_with_stats declares allergies, medications, and medical_conditions as text', () => {
    assert.ok(m6Sql.includes('allergies text,'), 'allergies must be text');
    assert.ok(m6Sql.includes('medications text,'), 'medications must be text');
    assert.ok(m6Sql.includes('medical_conditions text,'), 'medical_conditions must be text');
  });

  test('get_patients_with_stats provides dual status aliases (patient_status and status)', () => {
    assert.ok(m6Sql.includes('patient_status text,'), 'Must return patient_status');
    assert.ok(m6Sql.includes('status text,'), 'Must return status');
    assert.ok(m6Sql.includes('AS patient_status,'), 'Must map column AS patient_status');
    assert.ok(m6Sql.includes('AS status,'), 'Must map column AS status');
  });

  test('get_patients_with_stats preserves all demographic, contact, and insurance fields', () => {
    const requiredFields = [
      'occupation text',
      'guardian_name text',
      'referral_source text',
      'referred_by text',
      'emergency_contact text',
      'emergency_phone text',
      'insurance_provider text',
      'policy_number text',
      'marital_status text',
      'state text',
      'pat.occupation,',
      'pat.guardian_name,',
      'pat.referral_source,',
      'pat.referred_by,',
      'pat.emergency_contact,',
      'pat.emergency_phone,',
      'pat.insurance_provider,',
      'pat.policy_number,',
      'pat.marital_status,',
      'pat.state,',
    ];

    for (const field of requiredFields) {
      assert.ok(m6Sql.includes(field), `get_patients_with_stats must include: ${field}`);
    }
  });

  test('get_patients_with_stats count query does not contain ORDER BY, LIMIT, or OFFSET', () => {
    const startIdx = m6Sql.indexOf('Step D: Calculate Total Record Count');
    const endIdx = m6Sql.indexOf('Step E: Return Patient Rows with Aggregates');
    assert.ok(startIdx !== -1, 'Step D marker must exist');
    assert.ok(endIdx !== -1, 'Step E marker must exist');
    assert.ok(startIdx < endIdx, 'Step D must precede Step E');
    const countSection = m6Sql.substring(startIdx, endIdx);
    assert.ok(!countSection.includes('ORDER BY'), 'Count section must not contain ORDER BY');
    assert.ok(!countSection.includes('LIMIT'), 'Count section must not contain LIMIT');
    assert.ok(!countSection.includes('OFFSET'), 'Count section must not contain OFFSET');
  });
});

describe('M5-03: Live Membership & Role Hardening on Sibling Boundaries', () => {
  const m6Sql = readFile(M6_MIGRATION_PATH);

  test('Defines public.is_clinic_member and public.get_clinic_member_role with explicit suspension handling', () => {
    assert.ok(m6Sql.includes('CREATE OR REPLACE FUNCTION public.is_clinic_member('));
    assert.ok(m6Sql.includes('CREATE OR REPLACE FUNCTION public.get_clinic_member_role('));
    assert.ok(m6Sql.includes("status <> 'active'"), 'Must explicitly check non-active status before ownership fallback');
    assert.ok(m6Sql.includes("cm.status = 'active'"));
    assert.ok(m6Sql.includes("v_role := 'clinic_owner'"));
  });

  test('Prescriptions policies check live membership and clinical roles', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Prescriptions are viewable by clinic members"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Doctors and owners can insert prescriptions"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Doctors and owners can update their prescriptions"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Prescriptions are deletable by clinic owners"'));
    assert.ok(m6Sql.includes("public.get_clinic_member_role(clinic_id) IN ('doctor', 'clinic_owner')"));
  });

  test('HCU-033 policies check live membership and clinical roles', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Clinic members can view hcu033_forms"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Clinical staff can insert hcu033_forms"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Clinical staff can update hcu033_forms"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Clinic owners can delete hcu033_forms"'));
  });

  test('Patient files table and storage policies enforce live membership, role, and patient binding', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Users can view files in their clinic"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Users can insert files in their clinic"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated read for patient-files"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated upload for patient-files"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Tenant isolated delete for patient-files"'));
    assert.ok(m6Sql.includes('WHERE p.id = ((storage.foldername(name))[2])::uuid'), 'Must bind patient component in patient-files');
  });

  test('Clinical records, prescription templates, and appointments enforce live membership and role checks', () => {
    assert.ok(m6Sql.includes('CREATE POLICY "Medical staff can view clinical records"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Clinical staff can insert clinical records"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Templates are viewable by clinic members"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Templates are insertable by clinical staff"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Users can view appointments in their clinic"'));
    assert.ok(m6Sql.includes('CREATE POLICY "Users can insert appointments in their clinic"'));
  });

  test('enforce_patient_clinical_privileges protects periodontogram_state in M6 migration', () => {
    assert.ok(m6Sql.includes('CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()'));
    assert.ok(m6Sql.includes('OR NEW.periodontogram_state IS DISTINCT FROM OLD.periodontogram_state'));
    assert.ok(m6Sql.includes('CREATE TRIGGER trg_enforce_patient_clinical_privileges'));
  });
});

describe('Workflow Gap 1: Photo Compatibility (components/avatar-upload.tsx)', () => {
  const code = readFile(AVATAR_UPLOAD_PATH);

  test('Defines extractStoragePath to parse legacy Supabase storage URLs', () => {
    assert.ok(code.includes('function extractStoragePath'), 'Must define extractStoragePath helper');
    assert.ok(code.includes('/storage/v1/object/public/'), 'Must match object/public URL pattern');
    assert.ok(code.includes('/storage/v1/object/sign/'), 'Must match object/sign URL pattern');
    assert.ok(code.includes('/storage/v1/render/image/public/'), 'Must match render/image/public URL pattern');
  });

  test('Calls createSignedUrl on load and upload for private patient-avatars', () => {
    assert.ok(code.includes('createSignedUrl(url, 3600)'), 'Must call createSignedUrl(url, 3600)');
    assert.ok(code.includes('createSignedUrl(filePath, 3600)'), 'Must call createSignedUrl(filePath, 3600)');
  });

  test('Fails closed without fallback to public URL for patient-avatars', () => {
    assert.ok(code.includes('if (bucket === "patient-avatars") {'), 'Must handle patient-avatars separately');
    assert.ok(code.includes('if (isMounted) setAvatarUrl(null)'), 'Must set null on signing failure');
  });

  test('Handles signed URL expiry via refresh timer and onError recovery', () => {
    assert.ok(code.includes('refreshTimer'), 'Must maintain refresh timer for open sessions');
    assert.ok(code.includes('onError='), 'Must handle image onError to refresh expired signatures');
  });
});

describe('Workflow Gap 2: Export Integrity (components/settings/privacy-tab.tsx)', () => {
  const code = readFile(PRIVACY_TAB_PATH);

  test('Enforces deterministic pagination order on primary key', () => {
    assert.ok(code.includes(".order('id', { ascending: true })"), 'Must order by id ascending');
  });

  test('Increments offset by actual returned row count and is resilient to API row caps', () => {
    assert.ok(code.includes('from += data.length'), 'Must increment offset by data.length');
    assert.ok(!code.includes('if (data.length < pageSize)'), 'Must not truncate on server API row cap');
  });

  test('Includes clinical_records and prescription_templates in export manifest', () => {
    assert.ok(code.includes("'clinical_records'"), 'Must include clinical_records in export');
    assert.ok(code.includes("'prescription_templates'"), 'Must include prescription_templates in export');
  });

  test('Strictly fails export if any table query errors', () => {
    assert.ok(code.includes('if (error) {') && code.includes('throw new Error'), 'Must throw error on table fetch failure');
  });
});

describe('Workflow Gap 3: Rights Audit History (protect_data_rights_requests)', () => {
  const m6Sql = readFile(M6_MIGRATION_PATH);

  test('Immutability trigger protects details column from mutation', () => {
    assert.ok(m6Sql.includes('IF (NEW.details IS DISTINCT FROM OLD.details) THEN'));
    assert.ok(m6Sql.includes("RAISE EXCEPTION 'Immutable field: details cannot be modified.'"));
  });

  test('Terminal states (completed, rejected) cannot be modified or reopened', () => {
    assert.ok(m6Sql.includes("IF (OLD.status IN ('completed', 'rejected')) THEN"));
    assert.ok(m6Sql.includes("RAISE EXCEPTION 'Terminal state violation: Cannot modify status of a resolved data rights request.'"));
    assert.ok(m6Sql.includes("RAISE EXCEPTION 'Terminal state violation: Cannot modify resolution notes of a resolved data rights request.'"));
  });

  test('Captures resolved_by and resolved_at on transition to terminal state', () => {
    assert.ok(m6Sql.includes("IF (NEW.status IN ('completed', 'rejected') AND OLD.status NOT IN ('completed', 'rejected')) THEN"));
    assert.ok(m6Sql.includes('NEW.resolved_by := auth.uid();'));
    assert.ok(m6Sql.includes('NEW.resolved_at := now();'));
  });

  test('Records append-only transition history in logs.access_audit and attaches trigger', () => {
    assert.ok(m6Sql.includes('INSERT INTO logs.access_audit'), 'Must log status transitions');
    assert.ok(m6Sql.includes('CREATE TRIGGER trg_protect_data_rights_requests'), 'Must attach trigger');
  });
});

describe('Workflow Gap 4: Build Gates (next.config.mjs)', () => {
  const code = readFile(NEXT_CONFIG_PATH);

  test('Enforces strict build gates with zero ignored errors', () => {
    assert.ok(code.includes('ignoreBuildErrors: false'), 'Must not ignore TypeScript errors');
    assert.ok(code.includes('ignoreDuringBuilds: false'), 'Must not ignore ESLint errors');
  });

  test('Allows signed Supabase storage paths in remotePatterns', () => {
    assert.ok(code.includes("pathname: '/storage/v1/object/**'"));
    assert.ok(code.includes("pathname: '/storage/v1/render/image/**'"));
  });
});

describe('Workflow Gap 5: Email Operations (app/api/send-email/route.ts)', () => {
  const code = readFile(SEND_EMAIL_PATH);

  test('Validates link host against strict allowlist without wildcard subdomains', () => {
    assert.ok(code.includes('function isAllowedLinkHost'), 'Must define host allowlist validator');
    assert.ok(code.includes('cliniaplus.com'), 'Allowlist must include production domain');
    assert.ok(code.includes('localhost'), 'Allowlist must include localhost');
    assert.ok(!code.includes("host.endsWith('.vercel.app')"), 'Must NOT allow arbitrary vercel.app subdomains');
    assert.ok(!code.includes("host.endsWith('.supabase.co')"), 'Must NOT allow arbitrary supabase.co subdomains');
  });

  test('Requires caller to be an active member of the clinic', () => {
    assert.ok(code.includes("status: 'active'") || code.includes("status === 'active'"), 'Must verify active status');
    assert.ok(code.includes('isCallerActiveMember'), 'Must verify clinic membership');
  });
});

describe('Staff Invitation Action Hardening (app/actions/invite-member.ts)', () => {
  const code = readFile(INVITE_MEMBER_PATH);

  test('Rejects non-owner callers with 403 authorization error', () => {
    assert.ok(code.includes('Solo el propietario de la clínica puede invitar miembros'), 'Must return standard 403 message');
    assert.ok(code.includes('owner_id === caller.id'), 'Must check clinic owner_id');
  });

  test('Ensures caller profile is active and verified', () => {
    assert.ok(code.includes('callerProfile.status !== "active"'), 'Must check caller profile status');
  });
});

describe('Payment Receipt Upload Hardening (app/(dashboard)/pay/[id]/page.tsx)', () => {
  const code = readFile(PAY_PAGE_PATH);

  test('Uses tenant-scoped filePath and signed URL for private receipts bucket', () => {
    assert.ok(code.includes('${clinicId}/${id}/${fileName}'), 'Must scope receipt to clinicId/id/filename');
    assert.ok(code.includes("storage.from('receipts').createSignedUrl"), 'Must generate signed URL for private receipt');
  });
});
