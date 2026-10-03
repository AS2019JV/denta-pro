/**
 * Challenger 2 Adversarial Stress Test Suite: Milestone 1 (SEC-02, SEC-05, SEC-06)
 * Author: teamwork_preview_challenger_m1_2
 * Role: EMPIRICAL CHALLENGER (critic, specialist)
 *
 * Targets Under Adversarial Challenge:
 * - SEC-02: Profile self-mutation of role, clinic_id, or status & privilege escalation
 * - SEC-05: Direct storage downloads/deletions across tenant boundaries in patient-files
 * - SEC-06: Unauthenticated or non-owner invocation of inviteTeamMember and response payload token leakage
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {loadCurrentSource,TEST_ORIGIN,gateEnv,ALLOW_BUDGET,durableBudgetFixture}=require('./harness/current-source-loader.cjs');

const {
  TENANT_A_ID,
  TENANT_B_ID,
  CLINIC_A_OWNER_ID,
  CLINIC_A_DOCTOR_ID,
  CLINIC_A_DOCTOR_2_ID,
  CLINIC_A_RECEPTIONIST_ID,
  CLINIC_B_OWNER_ID,
  CLINIC_B_DOCTOR_ID,
  CLINIC_B_RECEPTIONIST_ID,
  PATIENT_A1_ID,
  PATIENT_A2_ID,
  PATIENT_B1_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');

const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');

const ROOT_DIR = join(__dirname, '../..');
const MIGRATION_PATH = join(ROOT_DIR, 'supabase/migrations/20260920_m1_tenant_and_access_control.sql');
const INVITE_ACTION_PATH = join(ROOT_DIR, 'app/actions/invite-member.ts');
const PATIENT_FILES_PATH = join(ROOT_DIR, 'components/patient-files.tsx');

/**
 * Sandboxed Execution Environment for app/actions/invite-member.ts
 * Transpiles and loads the real TypeScript server action with isolated mock dependencies.
 */
function createInviteMemberSandbox({
  mockUser = null,
  mockProfile = null,
  mockClinic = undefined,
  mockMembership = null,
  existingInvite = null,
  budgetReply = ALLOW_BUDGET,
  generateLinkResult = {
    data: {
      properties: { hashed_token: 'secret_token_hash_alpha_998877' },
      user: { id: 'invited-user-id-555' },
    },
    error: null,
  },
} = {}) {
  const resolvedClinic =
    mockClinic !== undefined
      ? mockClinic
      : (mockProfile?.role === 'clinic_owner' && mockUser
          ? { id: mockProfile.clinic_id, owner_id: mockUser.id }
          : null);

  const source = readFileSync(INVITE_ACTION_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mockCookies = async () => ({
    getAll: () => [],
    set: () => {},
  });

  const mockSupabaseAuth = {
    rpc: async (name,{check_clinic_id}) => {
      assert.equal(name,'get_clinic_member_role');
      const active=mockUser&&mockProfile?.status==='active'&&mockProfile.deleted_at==null&&mockMembership?.status==='active'
        &&mockMembership.user_id===mockUser.id&&mockMembership.clinic_id===check_clinic_id;
      return {data:active?mockMembership.role:null,error:null};
    },
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error('No session active'),
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            eq: (col3, val3) => ({
              eq: (col4, val4) => ({
                maybeSingle: async () => {
                  if (table === 'clinic_members') {
                    if (
                      mockMembership &&
                      (!mockMembership.clinic_id || mockMembership.clinic_id === val1) &&
                      (!mockMembership.user_id || mockMembership.user_id === val2) &&
                      mockMembership.role === val3 &&
                      mockMembership.status === val4
                    ) {
                      return { data: mockMembership };
                    }
                  }
                  return { data: null };
                },
              }),
              maybeSingle: async () => ({ data: null }),
            }),
            maybeSingle: async () => {
              if (table === 'clinics' && col1 === 'id' && col2 === 'owner_id') {
                if (
                  resolvedClinic &&
                  (!resolvedClinic.id || resolvedClinic.id === val1) &&
                  resolvedClinic.owner_id === val2
                ) {
                  return { data: resolvedClinic };
                }
              }
              if (table === 'clinic_members' && col1 === 'clinic_id' && col2 === 'user_id') {
                if (
                  mockMembership &&
                  (!mockMembership.clinic_id || mockMembership.clinic_id === val1) &&
                  (!mockMembership.user_id || mockMembership.user_id === val2)
                ) {
                  return { data: mockMembership };
                }
              }
              return { data: null };
            },
          }),
          maybeSingle: async () => {
            if (table === 'profiles' && col1 === 'id' && mockUser && val1 === mockUser.id) {
              return { data: mockProfile };
            }
            if (table === 'clinics' && col1 === 'id') {
              if (resolvedClinic && (!resolvedClinic.id || resolvedClinic.id === val1)) {
                return { data: resolvedClinic };
              }
              return { data: null };
            }
            if (table === 'clinic_members' && col1 === 'clinic_id') {
              if (mockMembership && (!mockMembership.clinic_id || mockMembership.clinic_id === val1)) {
                return { data: mockMembership };
              }
              return { data: null };
            }
            return { data: null };
          },
        }),
      }),
    }),
  };

  const insertedInvites = [];
  const upsertedProfiles = [];
  const sentEmails = [];
  const generatedLinks=[];
  const budget=durableBudgetFixture(budgetReply);

  const mockSupabaseAdmin = {
    rpc: budget.rpc,
    auth: {
      admin: {
        generateLink: async (opts) => {generatedLinks.push(opts);return generateLinkResult;},
      },
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingInvite }),
            }),
          }),
        }),
      }),
      insert: async (row) => {
        insertedInvites.push(row);
        return { error: null };
      },
      upsert: async (row) => {
        upsertedProfiles.push(row);
        return { error: null };
      },
      update: fields => {
        let rows=insertedInvites.slice();
        const q={eq(key,value){rows=rows.filter(row=>row[key]===value);return q;},select(){return q;},
          async maybeSingle(){for(const row of rows)Object.assign(row,fields);return {data:rows[0]?{id:rows[0].id}:null,error:null};}};
        return q;
      },
    }),
  };

  const mockResend = function () {
    return {
      emails: {
        send: async (payload) => {
          sentEmails.push(payload);
          return { id: 'mock-resend-id-001' };
        },
      },
    };
  };

  const exportsObj = {};
  const sandbox = {
    exports: exportsObj,
    module: { exports: exportsObj },
    process: {
      env: {
        ...gateEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        RESEND_API_KEY: 'test-resend-api-key',
        RESEND_FROM_EMAIL: 'Clinia+ <test@alertas.cliniaplus.com>',
        NEXT_PUBLIC_APP_URL: 'https://app.cliniaplus.com',
      },
    },
    console: { log() {}, error() {}, warn() {}, info() {} },
    require: (mod) => {
      if (mod === 'next/headers') return { cookies: mockCookies,headers:async()=>new Headers({origin:TEST_ORIGIN,'x-vercel-forwarded-for':'203.0.113.10'}) };
      if (mod === '@supabase/ssr') return { createServerClient: () => mockSupabaseAuth };
      if (mod === '@supabase/supabase-js') return { createClient: () => mockSupabaseAdmin };
      if (mod === 'resend') return { Resend: mockResend };
      return require(mod);
    },
  };

  const loaded=loadCurrentSource(INVITE_ACTION_PATH,sandbox);

  return {
    inviteTeamMember: loaded.inviteTeamMember,
    insertedInvites,
    upsertedProfiles,
    sentEmails,
    generatedLinks,
    budgetCalls:budget.calls,
  };
}

describe('Challenger 2 Empirical Stress Tests: SEC-02, SEC-05, SEC-06', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================================================
  // ADVERSARIAL SUITE 1: SEC-02 Profile Self-Mutation & Escalation Attacks
  // ==========================================================================
  describe('SEC-02: Hostile Stress-Testing of Profile Mutation Boundaries', () => {
    test('1.1 Negative: Receptionist cannot elevate role to clinic_owner', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { role: 'clinic_owner' });
        },
        /403 Forbidden.*role escalation/i,
        'Must block receptionist self-elevation to clinic_owner'
      );
    });

    test('1.2 Negative: Receptionist cannot elevate role to doctor', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { role: 'doctor' });
        },
        /403 Forbidden.*role escalation/i,
        'Must block receptionist self-elevation to doctor'
      );
    });

    test('1.3 Negative: Receptionist cannot inject arbitrary or administrative roles', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      const hostileRoles = ['admin', 'superadmin', 'postgres', 'service_role', 'SYSTEM', '<script>'];

      for (const hostileRole of hostileRoles) {
        assert.throws(
          () => {
            db.updateProfile(receptionist, receptionist.userId, { role: hostileRole });
          },
          /403 Forbidden.*role escalation/i,
          `Must block self-mutation to role '${hostileRole}'`
        );
      }
    });

    test('1.4 Negative: Doctor cannot elevate role to clinic_owner', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.updateProfile(doctor, doctor.userId, { role: 'clinic_owner' });
        },
        /403 Forbidden.*role escalation/i,
        'Must block doctor self-elevation to clinic_owner'
      );
    });

    test('1.5 Negative: Tenant hopping - Staff member cannot change clinic_id to target clinic', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.updateProfile(doctor, doctor.userId, { clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*clinic_id migration/i,
        'Must block clinic_id modification to another tenant'
      );
    });

    test('1.6 Negative: Tenant hopping - Staff member cannot change clinic_id to random UUID', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { clinic_id: '99999999-9999-9999-9999-999999999999' });
        },
        /403 Forbidden.*clinic_id migration/i,
        'Must block clinic_id modification to random UUID'
      );
    });

    test('1.7 Negative: Disassociation attack - Staff member cannot set clinic_id to null', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { clinic_id: null });
        },
        /403 Forbidden.*clinic_id migration/i,
        'Must block clinic_id modification to null'
      );
    });

    test('1.8 Negative: Status manipulation - Suspended/unverified user cannot self-activate status', () => {
      // Set receptionist to suspended first via service_role
      const serviceRole = getSecurityContext('service_role');
      db.updateProfile(serviceRole, CLINIC_A_RECEPTIONIST_ID, { status: 'suspended' });

      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { status: 'active' });
        },
        /403 Forbidden.*status manipulation/i,
        'Must block self-activation of account status'
      );
    });

    test('1.9 Negative: Cross-tenant attack - Clinic A Owner cannot mutate profile of Clinic B user', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          db.updateProfile(ownerA, CLINIC_B_RECEPTIONIST_ID, { full_name: 'Injected Name' });
        },
        /403 Forbidden.*Cross-tenant profile update forbidden/i,
        'Must block cross-tenant profile updates even for non-privileged fields'
      );
    });

    test('1.10 Negative: Mass-assignment attack fails closed without partial update', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      const initialProfile = db.profiles.find((p) => p.id === receptionist.userId);
      const initialName = initialProfile.full_name;

      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, {
            full_name: 'Diana Maliciosa',
            role: 'clinic_owner',
            clinic_id: TENANT_B_ID,
          });
        },
        /403 Forbidden.*role escalation/i,
        'Must reject mass assignment payload'
      );

      // Verify that full_name was NOT partially updated before the rejection
      const profileAfter = db.profiles.find((p) => p.id === receptionist.userId);
      assert.equal(profileAfter.full_name, initialName, 'Atomic fail-closed: full_name must remain unchanged');
      assert.equal(profileAfter.role, 'receptionist');
      assert.equal(profileAfter.clinic_id, TENANT_A_ID);
    });

    test('1.11 Positive: Staff member can legitimately update non-privileged fields', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      const updated = db.updateProfile(receptionist, receptionist.userId, {
        full_name: 'Diana Mendoza',
        phone: '+593988776655',
        avatar_url: 'https://example.com/diana.jpg',
      });

      assert.equal(updated.full_name, 'Diana Mendoza');
      assert.equal(updated.phone, '+593988776655');
      assert.equal(updated.avatar_url, 'https://example.com/diana.jpg');
      assert.equal(updated.role, 'receptionist', 'Role must remain unchanged');
      assert.equal(updated.clinic_id, TENANT_A_ID, 'Clinic ID must remain unchanged');
    });

    test('1.12 SQL Invariants: Migration explicitly drops backdoor policies and binds trigger', () => {
      assert.ok(existsSync(MIGRATION_PATH), 'Migration file must exist');
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can update all profiles."'), 'Must drop global admin update');
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Admins can delete profiles."'), 'Must drop global admin delete');
      assert.ok(sql.includes('FUNCTION public.prevent_profile_privilege_escalation()'), 'Must define escalation prevention trigger');
      assert.ok(sql.includes('NEW.role IS DISTINCT FROM OLD.role'), 'Must check role transition');
      assert.ok(sql.includes('NEW.clinic_id IS DISTINCT FROM OLD.clinic_id'), 'Must check clinic_id transition');
      assert.ok(sql.includes('NEW.status IS DISTINCT FROM OLD.status'), 'Must check status transition');
      assert.ok(sql.includes("ERRCODE = '42501'"), 'Must raise standard PostgreSQL 42501 insufficient_privilege');
      assert.ok(sql.includes('BEFORE UPDATE ON public.profiles'), 'Must bind BEFORE UPDATE ON profiles');
    });

    test('1.13 SQL Invariants: remove_clinic_member RPC is secure and owner-only', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      assert.ok(sql.includes('FUNCTION public.remove_clinic_member('), 'Must declare remove_clinic_member');
      assert.ok(sql.includes('auth.uid() IS NULL'), 'Must require caller session');
      assert.ok(sql.includes('p_target_user_id = auth.uid()'), 'Must prevent owner removing themselves');
      assert.ok(sql.includes('UPDATE public.profiles'), 'Must update profile on removal');
      assert.ok(sql.includes('DELETE FROM public.clinic_members'), 'Must delete membership on removal');
    });
  });

  // ==========================================================================
  // ADVERSARIAL SUITE 2: SEC-05 Storage Isolation & Traversal Attacks
  // ==========================================================================
  describe('SEC-05: Hostile Stress-Testing of Storage Bucket patient-files', () => {
    test('2.1 Negative: Cross-tenant download - Clinic B Owner cannot download Clinic A scan', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDownload(ownerB, 'patient-files', targetPath);
        },
        /403 Forbidden.*storage read denied/i,
        'Must block Clinic B Owner from accessing Clinic A patient file'
      );
    });

    test('2.2 Negative: Cross-tenant download - Clinic B Doctor cannot download Clinic A scan', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', targetPath);
        },
        /403 Forbidden.*storage read denied/i,
        'Must block Clinic B Doctor from accessing Clinic A patient file'
      );
    });

    test('2.3 Negative: Cross-tenant download - Clinic B Receptionist cannot download Clinic A scan', () => {
      const recepB = {
        userId: CLINIC_B_RECEPTIONIST_ID,
        clinicId: TENANT_B_ID,
        role: 'receptionist',
      };
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDownload(recepB, 'patient-files', targetPath);
        },
        /403 Forbidden.*storage read denied/i,
        'Must block Clinic B Receptionist from accessing Clinic A patient file'
      );
    });

    test('2.4 Negative: Cross-tenant deletion - Clinic B Owner cannot delete Clinic A scan', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDelete(ownerB, 'patient-files', targetPath);
        },
        /403 Forbidden.*storage deletion denied/i,
        'Must block Clinic B Owner from deleting Clinic A patient file'
      );
    });

    test('2.5 Negative: Cross-tenant deletion - Clinic B Doctor cannot delete Clinic A scan', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDelete(doctorB, 'patient-files', targetPath);
        },
        /403 Forbidden.*storage deletion denied/i,
        'Must block Clinic B Doctor from deleting Clinic A patient file'
      );
    });

    test('2.6 Negative: Role boundary - Receptionist in Clinic A cannot delete Clinic A scan', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDelete(recepA, 'patient-files', targetPath);
        },
        /403 Forbidden.*requires clinical role/i,
        'Must restrict deletion to doctor or clinic_owner only'
      );
    });

    test('2.7 Positive: Authorized clinical roles in Clinic A can download and delete Clinic A scan', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const ownerA = getSecurityContext('clinic_a_owner');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      // Doctor download
      const downloadRes = db.storageDownload(doctorA, 'patient-files', targetPath);
      assert.ok(downloadRes.signedUrl.startsWith('https://storage.cliniaplus.com/object/sign/patient-files/'));
      assert.ok(downloadRes.signedUrl.includes('token='));

      // Owner delete
      const deleteRes = db.storageDelete(ownerA, 'patient-files', targetPath);
      assert.equal(deleteRes.success, true);
      assert.equal(db.storage_objects.find((o) => o.name === targetPath), undefined);
    });

    test('2.8 Negative: Anonymous callers are rejected with 401 on download and delete', () => {
      const anon = getSecurityContext('anonymous');
      const targetPath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => {
          db.storageDownload(anon, 'patient-files', targetPath);
        },
        /401 Unauthorized/i,
        'Must reject anonymous storage download'
      );

      assert.throws(
        () => {
          db.storageDelete(anon, 'patient-files', targetPath);
        },
        /401 Unauthorized/i,
        'Must reject anonymous storage deletion'
      );
    });

    test('2.9 Negative: Path traversal attacks fail closed', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');

      // Relative path traversal attempt
      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', `../${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`);
        },
        /403 Forbidden/i,
        'Path traversal with leading ../ must be denied'
      );

      // Nested double traversal attempt
      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', `${TENANT_B_ID}/../../${TENANT_A_ID}/${PATIENT_A1_ID}/scan.png`);
        },
        /404 Not Found|403 Forbidden/i,
        'Nested traversal must not match target file'
      );

      // URL-encoded path traversal attempt
      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', `%2e%2e%2f${TENANT_A_ID}/${PATIENT_A1_ID}/scan.png`);
        },
        /403 Forbidden/i,
        'URL-encoded traversal must be denied'
      );

      // Malformed single-segment root path
      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', 'panoramica-2026.png');
        },
        /400 Bad Request.*Malformed/i,
        'Single-segment path without clinic prefix must be rejected as malformed'
      );
    });

    test('2.10 SQL Invariants: Storage bucket is private and policies check app_metadata clinic_id', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(sql.includes("INSERT INTO storage.buckets (id, name, public)\nVALUES ('patient-files', 'patient-files', false)"), 'Bucket must be created with public = false');
      assert.ok(sql.includes("UPDATE storage.buckets\nSET public = false\nWHERE id = 'patient-files';"), 'Bucket must be explicitly set to private');
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can read patient files"'), 'Must drop open read policy');
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can upload patient files"'), 'Must drop open upload policy');
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Users can delete patient files"'), 'Must drop open delete policy');

      // Check tenant path policy syntax
      assert.ok(sql.includes("(storage.foldername(name))[1]::uuid = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid"), 'Must compare foldername with auth JWT clinic_id');
      assert.ok(sql.includes("AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('clinic_owner', 'doctor')"), 'DELETE policy must check clinical role');
    });

    test('2.11 Frontend Component Invariant: patient-files.tsx never calls getPublicUrl and uses createSignedUrl', () => {
      assert.ok(existsSync(PATIENT_FILES_PATH), 'patient-files.tsx component must exist');
      const comp = readFileSync(PATIENT_FILES_PATH, 'utf8');

      assert.ok(!comp.includes('getPublicUrl'), 'Must NOT call getPublicUrl on private bucket');
      assert.ok(comp.includes('createSignedUrl'), 'Must call createSignedUrl');
      assert.ok(comp.includes('${currentClinicId}/${patientId}/'), 'Must prepend currentClinicId to uploaded object path');
    });
  });

  // ==========================================================================
  // ADVERSARIAL SUITE 3: SEC-06 inviteTeamMember Action & Token Leak Defense
  // ==========================================================================
  describe('SEC-06: Hostile Stress-Testing of Server Action inviteTeamMember', () => {
    test('Durable invitation budget denial blocks reservation, Auth token and email side effects',async()=>{
      const actor={id:CLINIC_A_OWNER_ID},sandbox=createInviteMemberSandbox({mockUser:actor,
        mockProfile:{clinic_id:TENANT_A_ID,role:'clinic_owner',status:'active'},
        mockMembership:{clinic_id:TENANT_A_ID,user_id:actor.id,role:'clinic_owner',status:'active'},
        budgetReply:{allowed:false,retry_after_seconds:60}});
      await assert.rejects(sandbox.inviteTeamMember({get:key=>({clinicId:TENANT_A_ID,email:'blocked@clinic-a.com',role:'doctor'}[key])}),/límite/);
      assert.equal(sandbox.budgetCalls.length,1);assert.equal(sandbox.insertedInvites.length,0);
      assert.equal(sandbox.generatedLinks.length,0);assert.equal(sandbox.sentEmails.length,0);
    });
    test('3.1 Negative: Unauthenticated caller cannot invoke inviteTeamMember', async () => {
      const { inviteTeamMember } = createInviteMemberSandbox({ mockUser: null });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'dr.new@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /401 Unauthorized/i,
        'Unauthenticated caller must be rejected with 401'
      );
    });

    test('3.2 Negative: Receptionist in Clinic A cannot invoke inviteTeamMember', async () => {
      const mockUser = { id: CLINIC_A_RECEPTIONIST_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'receptionist', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic: null,
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'dr.new@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica/i,
        'Receptionist must be rejected with 403'
      );
    });

    test('3.3 Negative: Doctor in Clinic A cannot invoke inviteTeamMember', async () => {
      const mockUser = { id: CLINIC_A_DOCTOR_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'doctor', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic: null,
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'dr.new@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica/i,
        'Doctor must be rejected with 403'
      );
    });

    test('3.4 Negative: Cross-tenant Owner attack - Clinic B Owner cannot invite into Clinic A', async () => {
      const mockUser = { id: CLINIC_B_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_B_ID, role: 'clinic_owner', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic: null, // Not owner of Clinic A
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'dr.spy@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica/i,
        'Clinic B Owner must be forbidden from issuing invitations for Clinic A'
      );
    });

    test('3.4b Negative: Spoofed profiles.role = "clinic_owner" without clinics.owner_id or clinic_members is rejected (403 Forbidden)', async () => {
      const mockUser = { id: '99999999-9999-9999-9999-999999999999' };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };
      // Legitimate clinic is owned by CLINIC_A_OWNER_ID, not the caller
      const mockClinic = { id: TENANT_A_ID, owner_id: CLINIC_A_OWNER_ID };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'dr.victim@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica/i,
        'Caller with spoofed profiles.role must be rejected with 403 Forbidden'
      );
    });

    test('3.5 Negative: Rogue role injection - Clinic Owner cannot invite another clinic_owner', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'rogue.owner@clinic-a.com', role: 'clinic_owner' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /400 Bad Request.*Rol no permitido/i,
        'Must forbid inviting clinic_owner role'
      );
    });

    test('3.6 Negative: Arbitrary role injection attacks are rejected', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
      });

      const hostileRoles = ['admin', 'superadmin', 'root', 'service_role', 'SYSTEM', '<script>alert(1)</script>'];

      for (const hostileRole of hostileRoles) {
        const formData = {
          get: (key) => ({ clinicId: TENANT_A_ID, email: 'test@clinic-a.com', role: hostileRole }[key]),
        };

        await assert.rejects(
          inviteTeamMember(formData),
          /400 Bad Request.*Rol no permitido/i,
          `Must reject invitation with hostile role '${hostileRole}'`
        );
      }
    });

    test('3.6b Invariant: Empty or omitted role safely defaults to least-privileged role (receptionist)', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockMembership:{user_id:mockUser.id,clinic_id:TENANT_A_ID,role:'clinic_owner',status:'active'},
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'receptionist.default@clinic-a.com', role: '' }[key]),
      };

      const result = await sandbox.inviteTeamMember(formData);
      assert.equal(result.success, true);
      assert.equal(sandbox.insertedInvites.length, 1);
      assert.equal(sandbox.insertedInvites[0].role, 'receptionist', 'Omitted/empty role must default to least privileged role');
    });

    test('3.7 Negative: Malformed or missing email addresses are rejected', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({ mockUser, mockProfile });

      const invalidEmails = ['', '   ', 'notanemail', 'attacker@', '@domain.com', 'missing_domain@.com'];

      for (const invalidEmail of invalidEmails) {
        const formData = {
          get: (key) => ({ clinicId: TENANT_A_ID, email: invalidEmail, role: 'doctor' }[key]),
        };

        await assert.rejects(
          inviteTeamMember(formData),
          /400 Bad Request/i,
          `Must reject invalid email '${invalidEmail}'`
        );
      }
    });

    test('3.8 Negative: Missing clinicId is rejected', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const { inviteTeamMember } = createInviteMemberSandbox({ mockUser, mockProfile });

      const formData = {
        get: (key) => ({ clinicId: '', email: 'valid@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /400 Bad Request/i,
        'Must reject missing clinicId'
      );
    });

    test('3.9 Negative: Duplicate active invitation is rejected', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };
      const activeExistingInvite = {
        id: 'invite-existing-1',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockMembership:{user_id:mockUser.id,clinic_id:TENANT_A_ID,role:'clinic_owner',status:'active'},
        existingInvite: activeExistingInvite,
      });

      const formData = {
        get: (key) => ({ clinicId: TENANT_A_ID, email: 'duplicate@clinic-a.com', role: 'doctor' }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /Ya existe una invitación pendiente activa/i,
        'Must reject duplicate active invitation'
      );
    });

    test('3.10 CRITICAL AUDIT: Legitimate owner invitation NEVER leaks tokens, urls, or hashes in response', async () => {
      const mockUser = { id: CLINIC_A_OWNER_ID };
      const mockProfile = { clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' };

      const sandboxResult = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockMembership:{user_id:mockUser.id,clinic_id:TENANT_A_ID,role:'clinic_owner',status:'active'},
        generateLinkResult: {
          data: {
            properties: { hashed_token: 'SUPER_SECRET_CAPABILITY_TOKEN_HASH_12345' },
            user: { id: 'new-doctor-user-id-777' },
          },
          error: null,
        },
      });

      const formData = {
        get: (key) =>
          ({
            clinicId: TENANT_A_ID,
            email: 'newdoctor@clinic-a.com',
            role: 'doctor',
            name: 'Dr. Roberto Mendoza',
            specialization: 'Endodoncia',
          }[key]),
      };

      // Execute the real server action
      const result = await sandboxResult.inviteTeamMember(formData);

      // Verify return value structure
      assert.equal(result.success, true, 'Action must succeed');

      // CRITICAL LEAKAGE ASSERTIONS: Check every known capability token leak property
      assert.equal(result.inviteLink, undefined, 'CRITICAL: inviteLink must NOT exist in response payload');
      assert.equal(result.token, undefined, 'CRITICAL: token must NOT exist in response payload');
      assert.equal(result.token_hash, undefined, 'CRITICAL: token_hash must NOT exist in response payload');
      assert.equal(result.hashed_token, undefined, 'CRITICAL: hashed_token must NOT exist in response payload');
      assert.equal(result.url, undefined, 'CRITICAL: url must NOT exist in response payload');
      assert.equal(result.confirmUrl, undefined, 'CRITICAL: confirmUrl must NOT exist in response payload');
      assert.equal(result.action_link, undefined, 'CRITICAL: action_link must NOT exist in response payload');

      // Strict payload key count check: Object MUST contain exactly 'success' and NOTHING ELSE
      const keys = Object.keys(result);
      assert.deepEqual(keys, ['success'], `Payload must strictly have keys ['success'], received: ${JSON.stringify(keys)}`);

      // Verify that the secret token hash was delivered out-of-band via Resend email ONLY
      assert.equal(sandboxResult.sentEmails.length, 1, 'Email must be dispatched via Resend');
      const sentEmail = sandboxResult.sentEmails[0];
      assert.equal(sentEmail.to, 'newdoctor@clinic-a.com');
      assert.ok(sentEmail.html.includes('SUPER_SECRET_CAPABILITY_TOKEN_HASH_12345'), 'Token hash must be inside the out-of-band email HTML body');
    });

    test('3.11 Static Source Invariant: app/actions/invite-member.ts contains no token leak constructs', () => {
      assert.ok(existsSync(INVITE_ACTION_PATH), 'invite-member.ts must exist');
      const code = readFileSync(INVITE_ACTION_PATH, 'utf8');

      // Must never return inviteLink
      assert.ok(!code.includes('inviteLink:'), 'Must NOT return inviteLink property');
      assert.ok(!code.includes('token_hash:'), 'Must NOT return token_hash property');
      assert.ok(!code.includes('hashed_token:'), 'Must NOT return hashed_token property');

      // Must verify caller session and allowed roles
      assert.ok(code.includes('auth.getUser()'), 'Must use auth.getUser()');
      assert.ok(code.includes('ALLOWED_STAFF_ROLES'), 'Must define ALLOWED_STAFF_ROLES');
      assert.ok(code.includes('return { success: true }'), 'Must return strictly { success: true }');
    });
  });
});
