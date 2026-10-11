/**
 * Milestone 1 Implementation Verification Test Suite (SEC-01 to SEC-06)
 * Verifies real source code and migration implementation invariants.
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT_DIR = join(__dirname, '../..');

describe('Milestone 1 Implementation Invariants (SEC-01 to SEC-06)', () => {
  const migrationPath = join(ROOT_DIR, 'supabase/migrations/20260920_m1_tenant_and_access_control.sql');
  const inviteActionPath = join(ROOT_DIR, 'app/actions/invite-member.ts');
  const patientFilesPath = join(ROOT_DIR, 'components/patient-files.tsx');
  const dentistsPagePath = join(ROOT_DIR, 'app/(dashboard)/dentists/page.tsx');

  test('M1-01: Migration file exists and is populated', () => {
    assert.ok(existsSync(migrationPath), 'Migration 20260920_m1_tenant_and_access_control.sql must exist');
    const content = readFileSync(migrationPath, 'utf8');
    assert.ok(content.length > 500, 'Migration must contain genuine content');
  });

  test('SEC-01: handle_verified_clinic_creation generates server-side UUID without client injection', () => {
    const content = readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('new_clinic_id := gen_random_uuid();'), 'Must generate server-side random UUID');
    assert.ok(!content.includes("new_clinic_id := (pending_data->>'id')::uuid;"), 'Must NOT accept client-supplied pending_data id');
    assert.ok(content.includes('RETURNING id INTO inserted_clinic_id;'), 'Must capture returned clinic ID');
    assert.ok(content.includes('IF inserted_clinic_id IS NULL THEN'), 'Must gate profile elevation on successful insertion');
  });

  test('SEC-02: Profile privilege escalation trigger blocks non-service-role changes', () => {
    const content = readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('DROP POLICY IF EXISTS "Admins can update all profiles."'), 'Must drop global admin update policy');
    assert.ok(content.includes('DROP POLICY IF EXISTS "Admins can delete profiles."'), 'Must drop global admin delete policy');
    assert.ok(content.includes('FUNCTION public.prevent_profile_privilege_escalation()'), 'Must create prevention trigger function');
    assert.ok(content.includes('NEW.role IS DISTINCT FROM OLD.role'), 'Must guard role modification');
    assert.ok(content.includes('NEW.clinic_id IS DISTINCT FROM OLD.clinic_id'), 'Must guard clinic_id modification');
    assert.ok(content.includes('NEW.status IS DISTINCT FROM OLD.status'), 'Must guard status modification');
    assert.ok(content.includes('remove_clinic_member'), 'Must provide secure remove_clinic_member RPC');
  });

  test('SEC-03: clinic_members RLS prevents client self-enrollment and provides accept RPC', () => {
    const content = readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('DROP POLICY IF EXISTS "Users can insert their own membership"'), 'Must drop self-insert policy');
    assert.ok(content.includes('REVOKE INSERT, UPDATE, DELETE ON public.clinic_members FROM authenticated, anon, public;'), 'Must revoke client mutations');
    assert.ok(content.includes('FUNCTION public.accept_clinic_invitation('), 'Must define accept_clinic_invitation RPC');
    assert.ok(content.includes('LOWER(email) = LOWER(v_caller_email)'), 'Must enforce caller email match against invitation');
  });

  test('SEC-04: get_patients_with_stats verifies caller clinic membership and role', () => {
    const content = readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('FUNCTION public.get_patients_with_stats('), 'Must define canonical get_patients_with_stats');
    assert.ok(content.includes('cm.user_id = auth.uid()'), 'Must verify caller auth.uid in clinic_members');
    assert.ok(content.includes("cm.status = 'active'"), 'Must verify active membership status');
    assert.ok(content.includes('v_caller_role NOT IN (\'clinic_owner\', \'admin\', \'doctor\', \'receptionist\')'), 'Must verify allowed staff role');
    assert.ok(content.includes('check_subscription_active'), 'Must verify active subscription');
  });

  test('SEC-05: Storage RLS partitions by tenant and patient-files component uses signed URLs', () => {
    const sqlContent = readFileSync(migrationPath, 'utf8');
    assert.ok(sqlContent.includes("bucket_id = 'patient-files'"), 'Must configure patient-files bucket');
    assert.ok(sqlContent.includes("(storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid"), 'Must enforce tenant prefix path');
    assert.ok(sqlContent.includes("IN ('clinic_owner', 'doctor')"), 'Must restrict deletion to clinical roles');

    const componentContent = readFileSync(patientFilesPath, 'utf8');
    assert.ok(componentContent.includes("usePrivateMediaUrl('patient-files', path)"), 'Download control must resolve private media under live authority');
    const mediaContent = readFileSync('lib/private-media.mjs', 'utf8');
    assert.ok(mediaContent.includes('createSignedUrl(path, PRIVATE_MEDIA_TTL)'), 'Shared resolver must sign private object paths');
    assert.ok(!componentContent.includes('getPublicUrl'), 'Component must NOT use getPublicUrl on private bucket');
    assert.ok(componentContent.includes('${currentClinicId}/${patientId}/'), 'Upload path must be partitioned with clinicId');
  });

  test('SEC-06: inviteTeamMember requires session, validates owner and role, and leaks no tokens', () => {
    const content = readFileSync(inviteActionPath, 'utf8');
    assert.ok(content.includes('createServerClient'), 'Must use createServerClient for server session');
    assert.ok(content.includes('auth.getUser()'), 'Must authenticate caller via auth.getUser()');
    assert.ok(content.includes('ALLOWED_STAFF_ROLES'), 'Must define allowed staff roles');
    assert.ok(!content.includes("role === 'clinic_owner'"), 'Must reject clinic_owner invitation');
    assert.ok(content.includes('get_clinic_member_role'), 'Must verify live clinic ownership via RPC');
    assert.ok(content.includes('return { success: true }'), 'Must return strictly { success: true }');
    assert.ok(!content.includes('return { success: true, inviteLink'), 'Must never return inviteLink in response payload');
  });

  test('Dentists page: Uses secure remove_clinic_member RPC', () => {
    const content = readFileSync(dentistsPagePath, 'utf8');
    assert.ok(content.includes("supabase.rpc('remove_clinic_member'"), 'Must call remove_clinic_member RPC');
    assert.ok(!content.includes(".from('profiles').update({ clinic_id: null })"), 'Must not directly update profiles.clinic_id');
  });
});
