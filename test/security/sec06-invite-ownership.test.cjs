/**
 * Test Suite: SEC-06 Invite Team Member Ownership Authority Invariants
 * Location: test/security/sec06-invite-ownership.test.cjs
 *
 * Verifies Gate 3, Item SEC-06:
 * - NEGATIVE INVARIANT: A caller who has profiles.role = 'clinic_owner' but is NOT the owner in
 *   clinics.owner_id and NOT an active owner in clinic_members is REJECTED with 403 Forbidden.
 * - POSITIVE PATH: Canonical live membership RPC returns clinic_owner.
 * - In accordance with PR-01 / SEC-01 / SEC-06 invariants, clinic ownership authority MUST strictly
 *   be derived from active membership and a live profile, never historical owner_id.
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT_DIR = join(__dirname, '../..');
const INVITE_ACTION_PATH = join(ROOT_DIR, 'app/actions/invite-member.ts');

const TARGET_CLINIC_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_CLINIC_ID = '44444444-4444-4444-4444-444444444444';

const CLINIC_OWNER_ID = '11111111-1111-1111-1111-111111111111';
const DELEGATED_OWNER_ID = '22222222-2222-2222-2222-222222222222';
const ATTACKER_ID = '99999999-9999-9999-9999-999999999999';

/**
 * Sandboxed Execution Environment for app/actions/invite-member.ts
 */
function createInviteMemberSandbox({
  mockUser = null,
  mockProfile = null,
  mockClinic = null,
  mockMembership = null,
  allowClinicById = true,
  allowMembershipByPair = true,
  existingInvite = null,
  generateLinkResult = {
    data: {
      properties: { hashed_token: 'secret_token_hash_alpha_sec06' },
      user: { id: 'invited-user-id-555' },
    },
    error: null,
  },
} = {}) {
  const source = readFileSync(INVITE_ACTION_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mockCookies = async () => ({
    getAll: () => [],
    set: () => {},
  });

  const insertedInvites = [];
  const upsertedProfiles = [];
  const sentEmails = [];

  const mockSupabaseAuth = {
    rpc: async (name, {check_clinic_id}) => {
      assert.equal(name, 'get_clinic_member_role');
      const permitted = mockUser && mockProfile?.status === 'active' && mockProfile.deleted_at == null
        && mockMembership?.status === 'active'
        && mockMembership.clinic_id === check_clinic_id && mockMembership.user_id === mockUser.id;
      return {data: permitted ? mockMembership.role : null, error: null};
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
                  mockClinic &&
                  (!mockClinic.id || mockClinic.id === val1) &&
                  mockClinic.owner_id === val2
                ) {
                  return { data: mockClinic };
                }
              }
              if (table === 'clinic_members' && col1 === 'clinic_id' && col2 === 'user_id') {
                if (
                  allowMembershipByPair &&
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
              if (allowClinicById && mockClinic && (!mockClinic.id || mockClinic.id === val1)) {
                return { data: mockClinic };
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

  const mockSupabaseAdmin = {
    auth: {
      admin: {
        generateLink: async () => generateLinkResult,
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
      update: (values) => {
        let selected = insertedInvites;
        return {
          eq(key,value) { selected = selected.filter(row => row[key] === value); return this; },
          select() { return this; },
          async maybeSingle() { selected.forEach(row => Object.assign(row,values)); return { data: selected[0] || null, error: null }; },
          then(resolve,reject) { return Promise.resolve({error:null}).then(resolve,reject); },
        };
      },
    }),
  };

  const mockResend = function () {
    return {
      emails: {
        send: async (payload) => {
          sentEmails.push(payload);
          return { id: 'mock-resend-sec06-id' };
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
      if (mod === 'next/headers') return { cookies: mockCookies, headers:async()=>new Headers() };
      if (mod === '@/lib/server-email-gate') return {consumeEmailBudget:async()=>({allowed:true})};
      if (mod === '@supabase/ssr') return { createServerClient: () => mockSupabaseAuth };
      if (mod === '@supabase/supabase-js') return { createClient: () => mockSupabaseAdmin };
      if (mod === 'resend') return { Resend: mockResend };
      if (mod === '@/lib/html-escape') {
        const code = ts.transpileModule(readFileSync(join(ROOT_DIR,'lib/html-escape.ts'),'utf8'), {
          compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
        }).outputText;
        const module = {exports:{}};
        vm.runInNewContext(code,{module,exports:module.exports});
        return module.exports;
      }
      return require(mod);
    },
  };

  vm.runInNewContext(transpiled, sandbox);

  return {
    inviteTeamMember: sandbox.exports.inviteTeamMember,
    insertedInvites,
    upsertedProfiles,
    sentEmails,
  };
}

describe('SEC-06: Strict Clinic Ownership Invariants in inviteTeamMember', () => {
  // =========================================================================
  // 1. Static Source Code Invariants
  // =========================================================================
  describe('1. Static Source Invariants', () => {
    test('invite-member.ts exists and is populated', () => {
      assert.ok(existsSync(INVITE_ACTION_PATH), 'invite-member.ts must exist');
      const code = readFileSync(INVITE_ACTION_PATH, 'utf8');
      assert.ok(code.length > 500, 'Must have substantive content');
    });

    test('Check C fallback querying profiles directly for role === clinic_owner is completely removed', () => {
      const code = readFileSync(INVITE_ACTION_PATH, 'utf8');
      assert.ok(
        !code.includes('profileCheck'),
        'Must NOT contain profileCheck fallback variable'
      );
      assert.ok(
        !code.includes("profileCheck.role === 'clinic_owner'"),
        'Must NOT check profileCheck.role === "clinic_owner"'
      );
      assert.ok(
        !code.includes('profileCheck.role === "clinic_owner"'),
        'Must NOT check profileCheck.role === "clinic_owner"'
      );
    });

    test('Authority is strictly determined by the canonical live membership RPC', () => {
      const code = readFileSync(INVITE_ACTION_PATH, 'utf8');
      assert.ok(code.includes('"get_clinic_member_role"'), 'Must call canonical role RPC');
      assert.ok(code.includes('authorityError || liveRole !== "clinic_owner"'), 'Must fail closed');
      assert.ok(!code.includes('.from("clinics")'), 'Historical ownership must not grant authority');
    });

    test('Raw profile and membership fallbacks cannot override canonical live authority', () => {
      const code = readFileSync(INVITE_ACTION_PATH, 'utf8');
      assert.ok(!code.includes('callerProfile'), 'No permissive raw profile fallback');
      assert.ok(!code.includes('status === undefined'), 'Missing status never grants authority');
    });
  });

  // =========================================================================
  // 2. Negative Boundary Invariants (Hostile & Spoofing Attempts)
  // =========================================================================
  describe('2. Negative Invariant: profiles.role alone NEVER confers ownership', () => {
    test('Negative: Caller with profiles.role = "clinic_owner" but NOT in clinics.owner_id and NOT in clinic_members is REJECTED (403 Forbidden)', async () => {
      const mockUser = { id: ATTACKER_ID };
      const mockProfile = {
        id: ATTACKER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner', // Spoofed or stale profile role
        status: 'active',
      };
      // Legitimate clinic is owned by CLINIC_OWNER_ID, NOT the attacker
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null, // Attacker is not a member
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Caller with spoofed profiles.role must be rejected with 403 Forbidden'
      );
    });

    test('Negative: Caller with profiles.role = "clinic_owner" when clinic record does not exist or has no owner', async () => {
      const mockUser = { id: ATTACKER_ID };
      const mockProfile = {
        id: ATTACKER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic: null, // Clinic query returns null
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Must reject caller when clinic has no matching owner'
      );
    });

    test('Negative: Demoted Owner - profiles.role = "clinic_owner" but clinic_members has role = "doctor"', async () => {
      const mockUser = { id: ATTACKER_ID };
      const mockProfile = {
        id: ATTACKER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID, // Different owner
      };
      const mockMembership = {
        clinic_id: TARGET_CLINIC_ID,
        user_id: ATTACKER_ID,
        role: 'doctor', // Demoted in clinic_members
        status: 'active',
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Demoted user must be rejected even if profiles.role is still clinic_owner'
      );
    });

    test('Negative: Suspended Member - clinic_members has role = "clinic_owner" but status = "suspended"', async () => {
      const mockUser = { id: ATTACKER_ID };
      const mockProfile = {
        id: ATTACKER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };
      const mockMembership = {
        clinic_id: TARGET_CLINIC_ID,
        user_id: ATTACKER_ID,
        role: 'clinic_owner',
        status: 'suspended', // Suspended membership
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Suspended clinic member must be rejected with 403 Forbidden'
      );
    });

    test('Negative: Suspended Profile - Caller is in clinics.owner_id but profiles.status = "suspended"', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'suspended', // Profile is suspended
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Suspended owner profile must be rejected with 403 Forbidden'
      );
    });

    test('Negative: Cross-Tenant Attack - Owner of Clinic A attempts to invite into Clinic B', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      // Targeting OTHER_CLINIC_ID
      const formData = {
        get: (key) => ({
          clinicId: OTHER_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Cross-tenant invitation must be rejected with 403 Forbidden'
      );
    });

    test('Negative: Inactive Profile - Caller is in clinics.owner_id but profiles.status = "inactive"', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'inactive', // Profile is inactive
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'dr.victim@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(
        inviteTeamMember(formData),
        /403 Forbidden.*Solo el propietario de la clínica puede invitar miembros/i,
        'Inactive owner profile must be rejected with 403 Forbidden'
      );
    });

    test('Negative: Prohibited Role Injection - Clinic Owner cannot invite another clinic_owner or admin', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      for (const forbiddenRole of ['clinic_owner', 'admin', 'superadmin', 'root']) {
        const formData = {
          get: (key) => ({
            clinicId: TARGET_CLINIC_ID,
            email: 'forbidden@clinic.com',
            role: forbiddenRole,
          }[key]),
        };

        await assert.rejects(
          inviteTeamMember(formData),
          /400 Bad Request.*Rol no permitido/i,
          `Role '${forbiddenRole}' must be rejected with 400 Bad Request`
        );
      }
    });

    test('Negative: Missing or invalid email address is rejected with 400 Bad Request', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const { inviteTeamMember } = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
      });

      for (const invalidEmail of ['', '   ', 'not-an-email', 'missing@domain', '@nodomain.com']) {
        const formData = {
          get: (key) => ({
            clinicId: TARGET_CLINIC_ID,
            email: invalidEmail,
            role: 'doctor',
          }[key]),
        };

        await assert.rejects(
          inviteTeamMember(formData),
          /400 Bad Request/i,
          `Invalid email '${invalidEmail}' must be rejected with 400 Bad Request`
        );
      }
    });
  });

  // =========================================================================
  // 3. Positive Path Invariants (Authorized Owners)
  // =========================================================================
  describe('3. Positive Paths: Verified Ownership Authority', () => {
    test('Positive: Owner with a canonical active membership dispatches invite', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: {clinic_id: TARGET_CLINIC_ID, user_id: CLINIC_OWNER_ID, role: 'clinic_owner', status: 'active'},
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'legit.doctor@clinic.com',
          role: 'doctor',
          name: 'Dr. Sofia Morales',
          specialization: 'Periodoncia',
        }[key]),
      };

      const result = await sandbox.inviteTeamMember(formData);

      assert.equal(result.success, true, 'Must return success: true');
      assert.deepEqual(Object.keys(result), ['success'], 'Must return strictly keys [success]');
      assert.equal(sandbox.insertedInvites.length, 1, 'Must insert invitation record');
      assert.equal(sandbox.insertedInvites[0].clinic_id, TARGET_CLINIC_ID);
      assert.equal(sandbox.insertedInvites[0].email, 'legit.doctor@clinic.com');
      assert.equal(sandbox.insertedInvites[0].role, 'doctor');
      assert.equal(sandbox.sentEmails.length, 1, 'Must dispatch email via Resend');
      assert.equal(sandbox.sentEmails[0].to, 'legit.doctor@clinic.com');
    });

    test('Positive Check B: Active clinic_members co-owner record succeeds', async () => {
      const mockUser = { id: DELEGATED_OWNER_ID };
      const mockProfile = {
        id: DELEGATED_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      // Primary owner is different in clinics table
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };
      // But caller is an active co-owner in clinic_members
      const mockMembership = {
        clinic_id: TARGET_CLINIC_ID,
        user_id: DELEGATED_OWNER_ID,
        role: 'clinic_owner',
        status: 'active',
      };

      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'legit.receptionist@clinic.com',
          role: 'receptionist',
          name: 'Carla Gomez',
        }[key]),
      };

      const result = await sandbox.inviteTeamMember(formData);

      assert.equal(result.success, true, 'Must return success: true');
      assert.deepEqual(Object.keys(result), ['success'], 'Must return strictly keys [success]');
      assert.equal(sandbox.insertedInvites.length, 1, 'Must insert invitation record');
      assert.equal(sandbox.insertedInvites[0].role, 'receptionist');
      assert.equal(sandbox.sentEmails.length, 1, 'Must dispatch email via Resend');
    });

    test('Missing membership status is denied even with owner profile', async () => {
      const mockUser = { id: DELEGATED_OWNER_ID };
      const mockProfile = {
        id: DELEGATED_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };
      const mockMembership = {
        clinic_id: TARGET_CLINIC_ID,
        user_id: DELEGATED_OWNER_ID,
        role: 'clinic_owner',
        // status is omitted / undefined
      };

      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'newdoc@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(sandbox.inviteTeamMember(formData), /403 Forbidden/);
      assert.equal(sandbox.insertedInvites.length, 0);
    });

    test('Historical owner_id without live membership is denied', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      // Disallow 1-eq select, forcing Check A fallback to id + owner_id
      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: null,
        allowClinicById: false,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'fallback.doc@clinic.com',
          role: 'doctor',
        }[key]),
      };

      await assert.rejects(sandbox.inviteTeamMember(formData), /403 Forbidden/);
      assert.equal(sandbox.insertedInvites.length, 0);
    });

    test('Canonical owner RPC is authoritative without raw membership table fallbacks', async () => {
      const mockUser = { id: DELEGATED_OWNER_ID };
      const mockProfile = {
        id: DELEGATED_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID, // Different primary owner
      };
      const mockMembership = {
        clinic_id: TARGET_CLINIC_ID,
        user_id: DELEGATED_OWNER_ID,
        role: 'clinic_owner',
        status: 'active',
      };

      // Disallow 2-eq select on clinic_members, forcing Check B fallback to 4-eq query
      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership,
        allowMembershipByPair: false,
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'fallback.member@clinic.com',
          role: 'receptionist',
        }[key]),
      };

      const result = await sandbox.inviteTeamMember(formData);
      assert.equal(result.success, true);
      assert.equal(sandbox.insertedInvites.length, 1);
    });
  });

  // =========================================================================
  // 4. Invariant: Token Leak Defense and Payload Hygiene
  // =========================================================================
  describe('4. Token Leak Defense & Payload Hygiene', () => {
    test('Response payload NEVER exposes sensitive auth tokens or URLs', async () => {
      const mockUser = { id: CLINIC_OWNER_ID };
      const mockProfile = {
        id: CLINIC_OWNER_ID,
        clinic_id: TARGET_CLINIC_ID,
        role: 'clinic_owner',
        status: 'active',
      };
      const mockClinic = {
        id: TARGET_CLINIC_ID,
        owner_id: CLINIC_OWNER_ID,
      };

      const sandbox = createInviteMemberSandbox({
        mockUser,
        mockProfile,
        mockClinic,
        mockMembership: {clinic_id: TARGET_CLINIC_ID, user_id: CLINIC_OWNER_ID, role: 'clinic_owner', status: 'active'},
        generateLinkResult: {
          data: {
            properties: { hashed_token: 'HIGHLY_CONFIDENTIAL_TOKEN_HASH_SEC06' },
            user: { id: 'new-user-sec06' },
          },
          error: null,
        },
      });

      const formData = {
        get: (key) => ({
          clinicId: TARGET_CLINIC_ID,
          email: 'secure.doctor@clinic.com',
          role: 'doctor',
        }[key]),
      };

      const result = await sandbox.inviteTeamMember(formData);

      assert.equal(result.success, true);
      assert.deepEqual(Object.keys(result), ['success']);
      assert.equal(result.inviteLink, undefined);
      assert.equal(result.token, undefined);
      assert.equal(result.token_hash, undefined);
      assert.equal(result.hashed_token, undefined);
      assert.equal(result.url, undefined);

      // Verify token hash is exclusively inside the out-of-band email HTML
      assert.equal(sandbox.sentEmails.length, 1);
      assert.ok(
        sandbox.sentEmails[0].html.includes('HIGHLY_CONFIDENTIAL_TOKEN_HASH_SEC06'),
        'Token hash must be inside the out-of-band email HTML only'
      );
    });
  });
});
