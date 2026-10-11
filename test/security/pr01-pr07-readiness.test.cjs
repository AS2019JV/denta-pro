/**
 * PR-01 to PR-07 Production Readiness Verification Test Suite
 * 
 * Validates the resolution of all release blockers and hardening items
 * identified in docs/security/PRODUCTION_READINESS_REVIEW_2026-09-22.md.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('PR-01: Security Guards & Profile Privilege Escalation Fix', () => {
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');

  test('prevent_profile_privilege_escalation is NOT SECURITY DEFINER (eliminating function-owner self-bypass)', () => {
    // Must not be declared SECURITY DEFINER
    const fnDefMatch = m5Sql.match(/CREATE OR REPLACE FUNCTION public\.prevent_profile_privilege_escalation\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/);
    assert.ok(fnDefMatch, 'Function prevent_profile_privilege_escalation must be defined');
    
    // Check preceding text before $$ does not have SECURITY DEFINER
    const header = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()'),
      m5Sql.indexOf('AS $$', m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()'))
    );
    assert.ok(!header.includes('SECURITY DEFINER'), 'prevent_profile_privilege_escalation must NOT be SECURITY DEFINER');
  });

  test('prevent_profile_privilege_escalation does NOT check current_user IN (postgres, ...)', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()'),
      m5Sql.indexOf('DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation')
    );
    assert.ok(
      !fnBody.includes("current_user IN ('postgres'"),
      'Must eliminate current_user IN (postgres, ...) check that caused self-bypass'
    );
  });

  test('prevent_profile_privilege_escalation checks service_role and authorized internal action', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()'),
      m5Sql.indexOf('DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation')
    );
    assert.ok(fnBody.includes('service_role'), 'Must check service_role');
    assert.ok(fnBody.includes('app.authorized_internal_action'), 'Must check app.authorized_internal_action');
    assert.ok(fnBody.includes('NEW.role IS DISTINCT FROM OLD.role'), 'Must guard role');
    assert.ok(fnBody.includes('NEW.clinic_id IS DISTINCT FROM OLD.clinic_id'), 'Must guard clinic_id');
    assert.ok(fnBody.includes('NEW.status IS DISTINCT FROM OLD.status'), 'Must guard status');
  });

  test('profiles table has dangerous self-insert policies dropped and column-level UPDATE granted', () => {
    assert.ok(m5Sql.includes('DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;'));
    assert.ok(m5Sql.includes('DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;'));
    assert.ok(m5Sql.includes('REVOKE INSERT ON public.profiles FROM authenticated, anon, public;'));
    assert.ok(m5Sql.includes('GRANT UPDATE (full_name, avatar_url, phone, address, specialization, license_number, bio, updated_at)'));
  });

  test('Lifecycle RPCs (remove_clinic_member, accept_clinic_invitation, handle_verified_clinic_creation) use authorized context', () => {
    assert.ok(m5Sql.includes("PERFORM set_config('app.authorized_internal_action', 'true', true);"));
  });

  test('enforce_patient_clinical_privileges and guard_patient_clinical_insert have no definer bypass', () => {
    const enforceBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.enforce_patient_clinical_privileges()'),
      m5Sql.indexOf('DROP TRIGGER IF EXISTS trg_enforce_patient_clinical_privileges')
    );
    assert.ok(!enforceBody.includes("current_user IN ('postgres'"), 'enforce_patient_clinical_privileges must not bypass on current_user');
    assert.ok(enforceBody.includes("cm.status = 'active'"), 'enforce_patient_clinical_privileges must check cm.status = active');

    const guardBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.guard_patient_clinical_insert()'),
      m5Sql.indexOf('DROP TRIGGER IF EXISTS trg_guard_patient_clinical_insert')
    );
    assert.ok(!guardBody.includes("current_user IN ('postgres'"), 'guard_patient_clinical_insert must not bypass on current_user');
    assert.ok(guardBody.includes("cm.status = 'active'"), 'guard_patient_clinical_insert must check cm.status = active');
  });
});

describe('PR-02: Hardened get_family_unit_with_stats RPC', () => {
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');

  test('get_family_unit_with_stats revokes anon execution and requires authentication', () => {
    assert.ok(m5Sql.includes('REVOKE ALL ON FUNCTION public.get_family_unit_with_stats(uuid) FROM PUBLIC, anon;'));
    assert.ok(m5Sql.includes('GRANT EXECUTE ON FUNCTION public.get_family_unit_with_stats(uuid) TO authenticated, service_role;'));
    assert.ok(m5Sql.includes('auth.uid() IS NULL'));
  });

  test('get_family_unit_with_stats verifies caller active clinic membership and scopes family members to clinic', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.get_family_unit_with_stats'),
      m5Sql.indexOf('REVOKE ALL ON FUNCTION public.get_family_unit_with_stats')
    );
    assert.ok(fnBody.includes('is_clinic_member(v_patient_clinic_id)'), 'Must check caller is active clinic member');
    assert.ok(fnBody.includes('p.clinic_id = v_patient_clinic_id'), 'Must filter family members by patient clinic');
    assert.ok(fnBody.includes('p.deleted_at IS NULL'), 'Must exclude deleted patients');
    assert.ok(fnBody.includes('SET search_path = public'), 'Must set search_path');
  });
});

describe('PR-03: Storage Buckets Privacy & Signed URLs', () => {
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');
  const avatarUploadCode = readFile('components/avatar-upload.tsx');
  const patientsPageCode = readFile('app/(dashboard)/patients/page.tsx');
  const patientDetailPageCode = readFile('app/(dashboard)/patients/[id]/page.tsx');

  test('patient-avatars bucket is updated to public = false with size and MIME limits', () => {
    assert.ok(m5Sql.includes("UPDATE storage.buckets\nSET public = false,\n    file_size_limit = 5242880"));
    assert.ok(m5Sql.includes("'image/jpeg', 'image/png', 'image/webp', 'image/gif'"));
  });

  test('receipts bucket is updated to public = false with size and MIME limits', () => {
    assert.ok(m5Sql.includes("UPDATE storage.buckets\nSET public = false,\n    file_size_limit = 10485760"));
    assert.ok(m5Sql.includes("'image/jpeg', 'image/png', 'image/webp', 'application/pdf'"));
  });

  test('patient-avatars storage policies enforce active clinic membership', () => {
    assert.ok(m5Sql.includes('Tenant isolated select for patient-avatars'));
    assert.ok(m5Sql.includes('Tenant isolated insert for patient-avatars'));
    assert.ok(m5Sql.includes('is_clinic_member'));
  });

  test('avatar-upload.tsx uses createSignedUrl for private patient-avatars bucket', () => {
    assert.ok(avatarUploadCode.includes('createSignedUrl(url, 3600)'), 'Must call createSignedUrl on load');
    assert.ok(avatarUploadCode.includes('createSignedUrl(filePath, 3600)'), 'Must call createSignedUrl on upload');
    assert.ok(avatarUploadCode.includes('clinicId?: string'), 'Must accept optional clinicId prop');
  });

  test('patient detail page passes clinicId to AvatarUpload', () => {
    assert.ok(patientDetailPageCode.includes('clinicId={currentClinicId || undefined}'));
  });

  test('patients list page uses createSignedUrl for patient avatars', () => {
    assert.ok(patientsPageCode.includes("from('patient-avatars')"), 'Must target patient-avatars bucket');
    assert.ok(patientsPageCode.includes("createSignedUrl(p.avatar_url, 3600)"), 'Must call createSignedUrl');
  });
});

describe('PR-04: Patient List/Detail RPC Runtime Fix', () => {
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');

  test('get_patients_with_stats count query does not contain ORDER BY, LIMIT, or OFFSET (eliminating SQLSTATE 42803)', () => {
    const countQuerySection = m5Sql.substring(
      m5Sql.indexOf('Step D: Calculate Total Record Count'),
      m5Sql.indexOf('Step E: Return Patient Rows')
    );
    assert.ok(!countQuerySection.includes('ORDER BY'), 'Count query must NOT have ORDER BY');
    assert.ok(!countQuerySection.includes('LIMIT'), 'Count query must NOT have LIMIT');
    assert.ok(!countQuerySection.includes('OFFSET'), 'Count query must NOT have OFFSET');
  });

  test('get_patients_with_stats does not have definer self-bypass', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.get_patients_with_stats'),
      m5Sql.indexOf('Step C: Bounded Pagination')
    );
    assert.ok(!fnBody.includes("current_user IN ('postgres'"), 'Must not bypass on current_user');
  });
});

describe('PR-05: Offboarding & Active Membership Revocation', () => {
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');

  test('is_clinic_member checks status = active', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.is_clinic_member'),
      m5Sql.indexOf('REVOKE ALL ON FUNCTION public.is_clinic_member')
    );
    assert.ok(fnBody.includes("status = 'active'"), 'is_clinic_member must check status = active');
  });

  test('custom_access_token_hook explicitly clears claims when user is not active in a clinic', () => {
    const fnBody = m5Sql.substring(
      m5Sql.indexOf('CREATE OR REPLACE FUNCTION public.custom_access_token_hook'),
      m5Sql.indexOf('REVOKE ALL ON FUNCTION public.custom_access_token_hook')
    );
    assert.ok(fnBody.includes("claims := jsonb_set(claims, '{app_metadata, clinic_id}', 'null'::jsonb);"));
    assert.ok(fnBody.includes("claims := jsonb_set(claims, '{app_metadata, role}', 'null'::jsonb);"));
    assert.ok(fnBody.includes("claims := jsonb_set(claims, '{app_metadata, subscription_active}', 'false'::jsonb);"));
  });

  test('Superseded permissive patient policies are dropped and canonical policies created', () => {
    assert.ok(m5Sql.includes('DROP POLICY IF EXISTS "Users can view patients in their valid clinics" ON public.patients;'));
    assert.ok(m5Sql.includes('DROP POLICY IF EXISTS "Users can insert patients in their valid clinics" ON public.patients;'));
    assert.ok(m5Sql.includes('Active clinic members can view patients'));
    assert.ok(m5Sql.includes('Active clinic members can insert patients'));
    assert.ok(m5Sql.includes('Active clinic members can update patients'));
  });
});

describe('PR-06: Middleware Identity Verification & RBAC', () => {
  const middlewareCode = readFile('middleware.ts');

  test('middleware fails closed on protected routes without getSession fallback', () => {
    assert.ok(!middlewareCode.includes('supabase.auth.getSession()'), 'Must NOT fall back to unverified getSession()');
    assert.ok(middlewareCode.includes('if (isDashboardRoute && !user)'), 'Must check user on protected routes');
    assert.ok(middlewareCode.includes("url.pathname = '/login'"), 'Must redirect unverified users to login');
  });

  test('middleware uses protected app_metadata.role instead of editable user_metadata.role', () => {
    assert.ok(!middlewareCode.includes('user.user_metadata?.role'), 'Must NOT use user_metadata.role');
    assert.ok(middlewareCode.includes('user.app_metadata?.role'), 'Must use app_metadata.role');
  });
});

describe('PR-07: Privacy Tab Export Completeness & Integrity', () => {
  const privacyTabCode = readFile('components/settings/privacy-tab.tsx');

  test('privacy-tab implements paginated fetch for all tables', () => {
    assert.ok(privacyTabCode.includes('async function fetchAllRows(tableName: string, clinicId: string)'));
    assert.ok(privacyTabCode.includes('.range(from, from + pageSize - 1)'));
  });

  test('privacy-tab strictly propagates query errors instead of silently creating empty arrays', () => {
    assert.ok(privacyTabCode.includes('if (error) {\n            throw new Error('));
  });

  test('privacy-tab export includes prescriptions, patient notes, and patient files', () => {
    assert.ok(privacyTabCode.includes("fetchAllRows('prescriptions', currentClinicId)"));
    assert.ok(privacyTabCode.includes("fetchAllRows('patient_notes', currentClinicId)"));
    assert.ok(privacyTabCode.includes("fetchAllRows('patient_files', currentClinicId)"));
  });

  test('privacy-tab records data_rights_requests under LOPDP portability', () => {
    assert.ok(privacyTabCode.includes("request_type: 'portability'"));
    assert.ok(privacyTabCode.includes("status: 'pending'") || privacyTabCode.includes("status: 'completed'"));
  });
});

describe('Additional Hardening: Email & Maintenance & Invite Actions', () => {
  const sendEmailCode = readFile('app/api/send-email/route.ts');
  const inviteMemberCode = readFile('app/actions/invite-member.ts');
  const m5Sql = readFile('supabase/migrations/20260922_m5_security_and_production_readiness.sql');

  test('send-email requires active clinic membership before recipient lookup', () => {
    assert.ok(sendEmailCode.includes("isCallerActiveMember"), 'Must verify caller active membership');
    assert.ok(sendEmailCode.includes("eq('status', 'active')"), 'Must check active status');
  });

  test('send-email uses exact email equality instead of pattern matching', () => {
    assert.ok(!sendEmailCode.includes(".ilike('email', to)"), 'Must NOT use .ilike() for email recipient matching');
    assert.ok(sendEmailCode.includes(".eq('email', to)"), 'Must use exact .eq() for email recipient matching');
  });

  test('send-email validates HTTPS URLs for links', () => {
    assert.ok(sendEmailCode.includes("parsedUrl.protocol === 'https:'"), 'Must validate https protocol on link variable');
  });

  test('invite-member verifies caller ownership via clinics table and clinic_members', () => {
    assert.ok(inviteMemberCode.includes(".eq('owner_id', caller.id)") || inviteMemberCode.includes('.eq("owner_id", caller.id)'), 'Must check clinics.owner_id');
    assert.ok(inviteMemberCode.includes(".eq('role', 'clinic_owner')") || inviteMemberCode.includes('.eq("role", "clinic_owner")'), 'Must check clinic_members role');
    assert.ok(inviteMemberCode.includes(".eq('status', 'active')") || inviteMemberCode.includes('.eq("status", "active")'), 'Must check clinic_members status');
  });

  test('cleanup_soft_deleted_records is restricted to service_role', () => {
    assert.ok(m5Sql.includes('REVOKE ALL ON FUNCTION public.cleanup_soft_deleted_records() FROM PUBLIC, anon, authenticated;'));
    assert.ok(m5Sql.includes('GRANT EXECUTE ON FUNCTION public.cleanup_soft_deleted_records() TO service_role;'));
  });

  test('data_rights_requests audit log has immutability trigger', () => {
    assert.ok(m5Sql.includes('CREATE OR REPLACE FUNCTION public.protect_data_rights_requests()'));
    assert.ok(m5Sql.includes('trg_protect_data_requests_immutability'));
  });
});
