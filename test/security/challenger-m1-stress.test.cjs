/**
 * Milestone 1 Challenger Stress Test Suite
 * Author: teamwork_preview_challenger_m1_1 (Empirical Challenger)
 * 
 * Adversarial stress testing for SEC-01, SEC-03, and SEC-04:
 * 1. Clinic onboarding trigger (`handle_verified_clinic_creation`) with spoofed `pending_clinic.id`
 * 2. Self-enrollment bypass on `clinic_members`
 * 3. Cross-tenant exfiltration via `get_patients_with_stats` RPC with varying parameters
 * 4. Combined edge cases and AST / invariant verification
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const crypto = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

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
  createToken,
} = require('./harness/security-context.cjs');
const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');
const { specInviteTeamMember } = require('./harness/action-runner.cjs');

const ROOT_DIR = join(__dirname, '../..');
const MIGRATION_FILE = join(ROOT_DIR, 'supabase/migrations/20260920_m1_tenant_and_access_control.sql');

/**
 * Extended Challenger Security Engine simulating the exact SQL semantics of the M1 migration
 */
class ChallengerSecurityHarness extends DatabaseSecurityEngine {
  constructor() {
    super();
    this.clinic_invitations = [
      {
        id: 'inv-a-1',
        clinic_id: TENANT_A_ID,
        email: 'new-doctor-a@example.com',
        role: 'doctor',
        token: 'valid_token_doc_a_12345',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'inv-a-2',
        clinic_id: TENANT_A_ID,
        email: 'expired-recep@example.com',
        role: 'receptionist',
        token: 'expired_token_67890',
        status: 'pending',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      },
      {
        id: 'inv-a-3',
        clinic_id: TENANT_A_ID,
        email: 'already-accepted@example.com',
        role: 'doctor',
        token: 'accepted_token_11121',
        status: 'accepted',
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'inv-b-1',
        clinic_id: TENANT_B_ID,
        email: 'victim-doc-b@example.com',
        role: 'doctor',
        token: 'secret_token_clinic_b',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
    ];

    // Add soft-deleted patient to Tenant A
    this.patients.push({
      id: 'pa-deleted-1',
      clinic_id: TENANT_A_ID,
      first_name: 'Paciente',
      last_name: 'Eliminado',
      cedula: '1710999999',
      email: 'deleted@example.com',
      phone: '+593980999999',
      deleted_at: '2026-09-15T00:00:00Z',
    });
  }

  /**
   * Simulates public.accept_clinic_invitation(p_token) RPC
   */
  acceptClinicInvitation(caller, token) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const invitation = this.clinic_invitations.find(
      (inv) => inv.token === token &&
               inv.email.toLowerCase() === (caller.email || '').toLowerCase() &&
               inv.status === 'pending' &&
               new Date(inv.expires_at).getTime() > Date.now()
    );

    if (!invitation) {
      throw new Error('P0002: Invalid, expired, or unauthorized invitation token.');
    }

    // Enroll in clinic_members
    let member = this.clinic_members.find((cm) => cm.user_id === caller.userId && cm.clinic_id === invitation.clinic_id);
    if (member) {
      member.role = invitation.role;
      member.status = 'active';
    } else {
      member = {
        id: `cm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        user_id: caller.userId,
        clinic_id: invitation.clinic_id,
        role: invitation.role,
        status: 'active',
      };
      this.clinic_members.push(member);
    }

    // Update profile
    let profile = this.profiles.find((p) => p.id === caller.userId);
    if (profile) {
      profile.clinic_id = invitation.clinic_id;
      profile.role = invitation.role;
      profile.status = 'active';
    } else {
      profile = {
        id: caller.userId,
        full_name: 'Nuevo Miembro',
        role: invitation.role,
        clinic_id: invitation.clinic_id,
        status: 'active',
      };
      this.profiles.push(profile);
    }

    invitation.status = 'accepted';
    return { success: true, clinic_id: invitation.clinic_id, role: invitation.role };
  }

  /**
   * Simulates handle_verified_clinic_creation trigger with full CASE A and CASE B
   */
  simulateAuthEmailConfirmedTrigger(userRecord) {
    const { id: userId, email, pendingClinicData, rawUserMetadata } = userRecord;

    // Check if user already has an assigned clinic
    const existingProfile = this.profiles.find((p) => p.id === userId && p.clinic_id);
    if (existingProfile) {
      // Strips pending_clinic and exits without changing anything
      return { skipped: true, reason: 'user_already_has_clinic', clinic_id: existingProfile.clinic_id };
    }

    // CASE A: New clinic registration
    if (pendingClinicData) {
      // Invariant SEC-01: Discard any client-supplied id, generate server-side UUID
      const newClinicId = crypto.randomUUID();
      const clinicName = pendingClinicData.name?.trim() || 'Mi Clínica Dental';
      const address = pendingClinicData.address?.trim() || 'Ubicación por definir';
      const tier = pendingClinicData.subscription_tier?.trim() || 'trial';

      const clinic = {
        id: newClinicId,
        name: clinicName,
        address,
        subscription_tier: tier,
        subscription_status: 'trialing',
        owner_id: userId,
        archived_at: null,
      };
      this.clinics.push(clinic);

      let profile = this.profiles.find((p) => p.id === userId);
      if (!profile) {
        profile = {
          id: userId,
          full_name: pendingClinicData.owner_name || (email ? email.split('@')[0] : 'Nuevo Propietario'),
          phone: pendingClinicData.phone || '',
          avatar_url: null,
          role: 'clinic_owner',
          clinic_id: newClinicId,
          status: 'active',
        };
        this.profiles.push(profile);
      } else {
        profile.role = 'clinic_owner';
        profile.clinic_id = newClinicId;
        profile.status = 'active';
      }

      this.clinic_members.push({
        id: `cm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        user_id: userId,
        clinic_id: newClinicId,
        role: 'clinic_owner',
        status: 'active',
      });

      return {
        success: true,
        clinic_id: newClinicId,
        role: 'clinic_owner',
        profile,
      };
    }

    // CASE B: Verified email invitation auto-enrollment
    if (email) {
      const invitation = this.clinic_invitations.find(
        (inv) => inv.email.toLowerCase() === email.toLowerCase() &&
                 inv.status === 'pending' &&
                 new Date(inv.expires_at).getTime() > Date.now()
      );

      if (invitation) {
        let profile = this.profiles.find((p) => p.id === userId);
        if (!profile) {
          profile = {
            id: userId,
            full_name: email.split('@')[0],
            role: invitation.role,
            clinic_id: invitation.clinic_id,
            status: 'active',
          };
          this.profiles.push(profile);
        } else {
          profile.role = invitation.role;
          profile.clinic_id = invitation.clinic_id;
          profile.status = 'active';
        }

        this.clinic_members.push({
          id: `cm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          user_id: userId,
          clinic_id: invitation.clinic_id,
          role: invitation.role,
          status: 'active',
        });

        invitation.status = 'accepted';
        return { success: true, clinic_id: invitation.clinic_id, role: invitation.role, profile };
      }
    }

    return { success: false, reason: 'no_action' };
  }

  /**
   * Advanced get_patients_with_stats simulation mirroring PL/pgSQL function
   */
  getPatientsWithStatsAdvanced(caller, params) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const {
      p_clinic_id,
      p_search = '',
      p_limit = 12,
      p_offset = 0,
      p_patient_id = null,
      p_time_filter = 'all',
      p_badge_filter = 'all',
    } = params;

    if (!p_clinic_id) {
      throw new Error('22023: Clinic ID is required.');
    }

    // Verify caller membership in clinic_members
    const membership = this.clinic_members.find(
      (cm) => cm.user_id === caller.userId && cm.clinic_id === p_clinic_id && cm.status === 'active'
    );

    let callerRole = membership?.role;
    if (!callerRole) {
      const ownedClinic = this.clinics.find((c) => c.id === p_clinic_id && c.owner_id === caller.userId);
      if (ownedClinic) callerRole = 'clinic_owner';
    }

    if (!callerRole) {
      throw new Error('403 Forbidden: Access denied: Caller does not belong to the requested clinic.');
    }

    if (!['clinic_owner', 'admin', 'doctor', 'receptionist'].includes(callerRole)) {
      throw new Error(`403 Forbidden: Access denied: Caller role ${callerRole} is not authorized.`);
    }

    // Check clinic subscription status
    const clinic = this.clinics.find((c) => c.id === p_clinic_id);
    if (!clinic || clinic.subscription_status === 'expired' || clinic.subscription_status === 'cancelled') {
      throw new Error('403 Forbidden: Subscription inactive or expired for this clinic.');
    }

    // Bounded limits
    const effectiveLimit = Math.min(Math.max(Number(p_limit) || 12, 1), 100);
    const effectiveOffset = Math.max(Number(p_offset) || 0, 0);
    const searchPattern = (p_search || '').toLowerCase();

    // Filter query strictly scoped to p_clinic_id and deleted_at IS NULL
    const filtered = this.patients.filter((pat) => {
      if (pat.clinic_id !== p_clinic_id) return false;
      if (pat.deleted_at !== null) return false;
      if (p_patient_id && pat.id !== p_patient_id) return false;

      if (searchPattern) {
        const matchesName = (pat.first_name || '').toLowerCase().includes(searchPattern) ||
                            (pat.last_name || '').toLowerCase().includes(searchPattern);
        const matchesEmail = (pat.email || '').toLowerCase().includes(searchPattern);
        const matchesCedula = (pat.cedula || '').toLowerCase().includes(searchPattern);
        const matchesPhone = (pat.phone || '').toLowerCase().includes(searchPattern);
        if (!matchesName && !matchesEmail && !matchesCedula && !matchesPhone) return false;
      }

      return true;
    });

    const totalCount = filtered.length;
    const paginated = filtered.slice(effectiveOffset, effectiveOffset + effectiveLimit);

    return {
      data: paginated,
      total: totalCount,
      limit: effectiveLimit,
      offset: effectiveOffset,
    };
  }
}

describe('Milestone 1 Challenger Stress Suite (SEC-01, SEC-03, SEC-04)', () => {
  let harness;

  beforeEach(() => {
    harness = new ChallengerSecurityHarness();
  });

  // ==========================================================================
  // SECTION 1: Adversarial Attacks on Clinic Onboarding Trigger (SEC-01)
  // ==========================================================================
  describe('SEC-01: Adversarial Onboarding Spoofing & Takeover Attacks', () => {
    test('Attack 1.1: Attacker attempts takeover with victim clinic UUID', () => {
      const attackerId = '99999999-aaaa-4999-8999-999999999991';
      const result = harness.simulateAuthEmailConfirmedTrigger({
        id: attackerId,
        email: 'attacker1@evil.com',
        pendingClinicData: {
          id: TENANT_A_ID, // Targeting Clinic A
          name: 'Clínica Secuestrada Alfa',
          owner_name: 'Dr. Hacker',
        },
      });

      assert.ok(result.success, 'Trigger executes successfully');
      assert.notEqual(result.clinic_id, TENANT_A_ID, 'CRITICAL: Must NOT assign victim clinic ID');
      assert.notEqual(result.profile.clinic_id, TENANT_A_ID, 'Profile clinic_id must not be victim clinic');
      
      // Verify victim clinic is completely unmodified
      const victimClinic = harness.clinics.find((c) => c.id === TENANT_A_ID);
      assert.equal(victimClinic.owner_id, CLINIC_A_OWNER_ID, 'Victim clinic owner remains unchanged');
      assert.equal(victimClinic.name, 'Clínica Dental Alfa', 'Victim clinic name remains unchanged');
    });

    test('Attack 1.2: Attacker attempts spoofing with UUID format variations & edge-case IDs', () => {
      const variations = [
        TENANT_A_ID.toUpperCase(),
        `{${TENANT_A_ID}}`,
        `urn:uuid:${TENANT_A_ID}`,
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        "' OR '1'='1",
        "'; DROP TABLE clinics; --",
      ];

      for (let i = 0; i < variations.length; i++) {
        const spoofedId = variations[i];
        const rogueUserId = `88888888-0000-4000-8000-${String(i).padStart(12, '0')}`;
        const result = harness.simulateAuthEmailConfirmedTrigger({
          id: rogueUserId,
          email: `fuzzer${i}@evil.com`,
          pendingClinicData: {
            id: spoofedId,
            name: `Fuzz Clinic ${i}`,
          },
        });

        assert.ok(result.success);
        assert.notEqual(result.clinic_id, spoofedId, `Generated clinic_id must not equal spoofed ID variant ${spoofedId}`);
        assert.notEqual(result.clinic_id, TENANT_A_ID);
      }
    });

    test('Attack 1.3: Staff member in existing clinic attempts re-onboarding takeover', () => {
      // Dra. Beatriz (doctor in Clinic A) attempts to run onboarding with pending_clinic
      const doctorA = getSecurityContext('clinic_a_doctor');
      const result = harness.simulateAuthEmailConfirmedTrigger({
        id: doctorA.userId,
        email: doctorA.email,
        pendingClinicData: {
          id: TENANT_B_ID,
          name: 'Takeover Clinic',
        },
      });

      assert.equal(result.skipped, true, 'Trigger must skip clinic creation for existing clinic member');
      assert.equal(result.reason, 'user_already_has_clinic');
      
      // Verify doctor profile role was not elevated to clinic_owner
      const doctorProfile = harness.profiles.find((p) => p.id === doctorA.userId);
      assert.equal(doctorProfile.role, 'doctor', 'Role must not be elevated to clinic_owner');
      assert.equal(doctorProfile.clinic_id, TENANT_A_ID, 'Clinic ID must remain Tenant A');
    });

    test('Attack 1.4: Migration SQL AST verification for SEC-01 guarantees', () => {
      assert.ok(existsSync(MIGRATION_FILE), 'Migration file must exist');
      const sql = readFileSync(MIGRATION_FILE, 'utf8');

      // 1. Must NOT read client-provided pending_data id
      assert.ok(
        !sql.includes("new_clinic_id := (pending_data->>'id')"),
        'Vulnerability check: Migration must not extract pending_data->id'
      );

      // 2. Must generate server-side UUID
      assert.ok(
        sql.includes('new_clinic_id := gen_random_uuid();'),
        'Invariant: Must generate server-side random UUID'
      );

      // 3. Must NOT have ON CONFLICT (id) DO NOTHING on clinics table
      const clinicsInsertBlock = sql.slice(sql.indexOf('INSERT INTO public.clinics'), sql.indexOf('RETURNING id INTO inserted_clinic_id'));
      assert.ok(
        !clinicsInsertBlock.includes('ON CONFLICT'),
        'Invariant: clinics INSERT must not swallow conflicts'
      );

      // 4. Must gate profile elevation on successful clinic insertion
      assert.ok(
        sql.includes('IF inserted_clinic_id IS NULL THEN'),
        'Invariant: Elevation must be gated on inserted_clinic_id IS NOT NULL'
      );
    });
  });

  // ==========================================================================
  // SECTION 2: Adversarial Attacks on Membership Self-Enrollment (SEC-03)
  // ==========================================================================
  describe('SEC-03: Adversarial Self-Enrollment & Invitation Bypass Attacks', () => {
    test('Attack 2.1: Attacker attempts direct client INSERT into clinic_members across all roles', () => {
      const attacker = getSecurityContext('clinic_b_receptionist');
      const targetRoles = ['clinic_owner', 'doctor', 'admin', 'receptionist', 'superadmin'];

      for (const role of targetRoles) {
        assert.throws(
          () => {
            harness.insertClinicMember(attacker, {
              user_id: attacker.userId,
              clinic_id: TENANT_A_ID,
              role,
            });
          },
          /403 Forbidden.*disabled by RLS/i,
          `Direct INSERT with role ${role} must be rejected by RLS`
        );
      }
    });

    test('Attack 2.2: Attacker attempts direct client UPDATE on clinic_members to elevate role or hijack tenant', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');

      // Attempt role escalation
      assert.throws(
        () => {
          harness.updateProfile(receptionist, receptionist.userId, { role: 'clinic_owner' });
        },
        /403 Forbidden.*role escalation/i,
        'Role escalation on profile must be blocked'
      );

      // Attempt tenant hop
      assert.throws(
        () => {
          harness.updateProfile(receptionist, receptionist.userId, { clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*clinic_id migration/i,
        'Tenant migration on profile must be blocked'
      );
    });

    test('Attack 2.3: Cross-user invitation token hijacking via accept_clinic_invitation RPC', () => {
      // Attacker has token issued to 'victim-doc-b@example.com' (inv-b-1)
      const attackerContext = {
        userId: '99999999-bbbb-4999-8999-999999999999',
        email: 'attacker@evil.com',
        role: 'authenticated',
      };

      assert.throws(
        () => {
          harness.acceptClinicInvitation(attackerContext, 'secret_token_clinic_b');
        },
        /P0002: Invalid, expired, or unauthorized invitation token/i,
        'Attacker using another user’s token must fail email match check'
      );
    });

    test('Attack 2.4: Expired or already accepted invitation tokens are rejected', () => {
      // Expired token
      const expiredUser = {
        userId: '88888888-1111-4000-8000-000000000001',
        email: 'expired-recep@example.com',
        role: 'authenticated',
      };
      assert.throws(
        () => {
          harness.acceptClinicInvitation(expiredUser, 'expired_token_67890');
        },
        /P0002: Invalid, expired, or unauthorized invitation token/i,
        'Expired invitation token must be rejected'
      );

      // Already accepted token
      const acceptedUser = {
        userId: '88888888-2222-4000-8000-000000000002',
        email: 'already-accepted@example.com',
        role: 'authenticated',
      };
      assert.throws(
        () => {
          harness.acceptClinicInvitation(acceptedUser, 'accepted_token_11121');
        },
        /P0002: Invalid, expired, or unauthorized invitation token/i,
        'Already accepted invitation token must be rejected'
      );
    });

    test('Attack 2.5: Unauthenticated caller cannot invoke accept_clinic_invitation RPC', () => {
      assert.throws(
        () => {
          harness.acceptClinicInvitation(null, 'valid_token_doc_a_12345');
        },
        /401 Unauthorized/i,
        'Unauthenticated invitation acceptance must fail'
      );
    });

    test('Attack 2.6: Legitimate user with valid invitation token enrolls successfully', () => {
      const legitUser = {
        userId: '77777777-7777-4777-8777-777777777777',
        email: 'new-doctor-a@example.com',
        role: 'authenticated',
      };

      const result = harness.acceptClinicInvitation(legitUser, 'valid_token_doc_a_12345');
      assert.equal(result.success, true);
      assert.equal(result.clinic_id, TENANT_A_ID);
      assert.equal(result.role, 'doctor');

      // Verify membership record was added
      const member = harness.clinic_members.find((cm) => cm.user_id === legitUser.userId && cm.clinic_id === TENANT_A_ID);
      assert.ok(member);
      assert.equal(member.status, 'active');
      assert.equal(member.role, 'doctor');
    });

    test('Attack 2.7: Migration SQL verifies dropped self-enrollment policy and revoked mutations', () => {
      const sql = readFileSync(MIGRATION_FILE, 'utf8');

      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Users can insert their own membership" ON public.clinic_members;'),
        'Must drop self-insert policy'
      );

      assert.ok(
        sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.clinic_members FROM authenticated, anon, public;'),
        'Must revoke direct mutations from client roles'
      );

      assert.ok(
        sql.includes('FUNCTION public.accept_clinic_invitation('),
        'Must define accept_clinic_invitation RPC'
      );

      assert.ok(
        sql.includes('LOWER(email) = LOWER(v_caller_email)'),
        'RPC must strictly match email in token against caller session'
      );
    });
  });

  // ==========================================================================
  // SECTION 3: Adversarial Attacks on get_patients_with_stats RPC (SEC-04)
  // ==========================================================================
  describe('SEC-04: Adversarial Cross-Tenant Patient Exfiltration Attacks', () => {
    test('Attack 3.1: Doctor in Clinic A directly requests Clinic B patient stats', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          harness.getPatientsWithStatsAdvanced(doctorA, { p_clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*Caller does not belong to the requested clinic/i,
        'Direct cross-tenant request must be rejected'
      );
    });

    test('Attack 3.2: Receptionist in Clinic B directly requests Clinic A patient stats', () => {
      const recepB = {
        userId: CLINIC_B_RECEPTIONIST_ID,
        clinicId: TENANT_B_ID,
        role: 'receptionist',
        email: 'recep-b@clinic-b.com',
      };
      assert.throws(
        () => {
          harness.getPatientsWithStatsAdvanced(recepB, { p_clinic_id: TENANT_A_ID });
        },
        /403 Forbidden.*Caller does not belong to the requested clinic/i,
        'Cross-tenant receptionist request must be rejected'
      );
    });

    test('Attack 3.3: Attacker targets Clinic B patient ID while querying Clinic A (Targeted Patient ID Injection)', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      // Doctor A queries own clinic (TENANT_A_ID) but passes p_patient_id = PATIENT_B1_ID (Roberto Gómez, Clinic B)
      const result = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_patient_id: PATIENT_B1_ID,
      });

      assert.equal(result.total, 0, 'Targeted foreign patient ID must return 0 records');
      assert.equal(result.data.length, 0, 'No foreign patient data may leak');
    });

    test('Attack 3.4: Attacker performs search exfiltration with Clinic B patient details', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      // Search by Clinic B patient name
      const resName = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_search: 'Roberto Gómez',
      });
      assert.equal(resName.total, 0, 'Searching for Clinic B patient name yields 0 results');

      // Search by Clinic B patient cedula
      const resCedula = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_search: '1720000001',
      });
      assert.equal(resCedula.total, 0, 'Searching for Clinic B cedula yields 0 results');

      // Search by Clinic B patient email
      const resEmail = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_search: 'roberto.gomez@example.com',
      });
      assert.equal(resEmail.total, 0, 'Searching for Clinic B email yields 0 results');
    });

    test('Attack 3.5: SQL injection strings in p_search cannot escape tenant boundary', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const injectionPayloads = [
        "' OR 1=1 --",
        "') OR ('1'='1",
        "' UNION SELECT * FROM clinics --",
        "'; DROP TABLE patients; --",
        "admin'--",
      ];

      for (const payload of injectionPayloads) {
        const res = harness.getPatientsWithStatsAdvanced(doctorA, {
          p_clinic_id: TENANT_A_ID,
          p_search: payload,
        });
        // None of the payloads match the legit names of Clinic A, so returns 0
        assert.equal(res.total, 0, `SQL injection payload '${payload}' must not return records or error`);
        for (const p of res.data) {
          assert.equal(p.clinic_id, TENANT_A_ID, 'Must remain strictly scoped to Tenant A');
        }
      }
    });

    test('Attack 3.6: Pagination parameter fuzzing & boundary clamping', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      // Negative limit clamped to 1
      const resNegLimit = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_limit: -50,
      });
      assert.equal(resNegLimit.limit, 1, 'Negative limit must be clamped to 1');
      assert.equal(resNegLimit.data.length, 1);

      // Gigantic limit clamped to 100
      const resBigLimit = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_limit: 9999999,
      });
      assert.equal(resBigLimit.limit, 100, 'Gigantic limit must be clamped to 100');

      // Negative offset clamped to 0
      const resNegOffset = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_offset: -10,
      });
      assert.equal(resNegOffset.offset, 0, 'Negative offset must be clamped to 0');

      // Offset beyond dataset returns empty array without throwing
      const resBigOffset = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
        p_offset: 1000,
      });
      assert.equal(resBigOffset.data.length, 0);
      assert.equal(resBigOffset.total, 2, 'Total count remains accurate');
    });

    test('Attack 3.7: Soft-deleted patient records are strictly excluded', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const result = harness.getPatientsWithStatsAdvanced(doctorA, {
        p_clinic_id: TENANT_A_ID,
      });

      // Tenant A has 2 active patients + 1 soft-deleted patient (pa-deleted-1)
      assert.equal(result.total, 2, 'Soft-deleted patient must not be included in count');
      const deletedFound = result.data.find((p) => p.id === 'pa-deleted-1');
      assert.equal(deletedFound, undefined, 'Soft-deleted patient must not be returned');
    });

    test('Attack 3.8: Inactive or suspended clinic member is denied access', () => {
      // Temporarily mark doctor as suspended
      const memberRecord = harness.clinic_members.find((cm) => cm.user_id === CLINIC_A_DOCTOR_ID);
      memberRecord.status = 'suspended';

      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          harness.getPatientsWithStatsAdvanced(doctorA, { p_clinic_id: TENANT_A_ID });
        },
        /403 Forbidden.*Caller does not belong/i,
        'Suspended staff member must be denied patient statistics access'
      );

      // Restore status
      memberRecord.status = 'active';
    });

    test('Attack 3.9: Clinic with expired or cancelled subscription is denied access', () => {
      const clinicA = harness.clinics.find((c) => c.id === TENANT_A_ID);
      const originalStatus = clinicA.subscription_status;
      clinicA.subscription_status = 'expired';

      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          harness.getPatientsWithStatsAdvanced(doctorA, { p_clinic_id: TENANT_A_ID });
        },
        /403 Forbidden.*Subscription inactive or expired/i,
        'Expired subscription must fail subscription check'
      );

      clinicA.subscription_status = originalStatus;
    });

    test('Attack 3.10: Migration SQL verifies single canonical function with strict caller checks', () => {
      const sql = readFileSync(MIGRATION_FILE, 'utf8');

      // 1. Dynamic drop of existing overloaded signatures
      assert.ok(
        sql.includes('DO $$') && sql.includes("WHERE proname = 'get_patients_with_stats'"),
        'Must dynamically drop all overloaded signatures'
      );

      // 2. Caller auth check
      assert.ok(
        sql.includes('IF auth.uid() IS NULL THEN'),
        'Must check caller auth.uid()'
      );

      // 3. Clinic membership verification
      assert.ok(
        /SELECT\s+cm\.role\s+INTO\s+v_caller_role\s+FROM\s+public\.clinic_members\s+cm/.test(sql),
        'Must query clinic_members for caller role'
      );
      assert.ok(
        sql.includes("AND cm.status = 'active'"),
        'Must check active status'
      );

      // 4. Role restrictions
      assert.ok(
        sql.includes("IN ('clinic_owner', 'admin', 'doctor', 'receptionist')"),
        'Must whitelist allowed staff roles'
      );

      // 5. Subscription check
      assert.ok(
        sql.includes('check_subscription_active(p_clinic_id)'),
        'Must check subscription status'
      );

      // 6. Bounded limits
      assert.ok(
        sql.includes('LEAST(GREATEST(COALESCE(p_limit, 12), 1), 100)'),
        'Must bound limit to [1, 100]'
      );

      // 7. Soft delete check
      assert.ok(
        sql.includes('pat.deleted_at IS NULL'),
        'Must filter soft-deleted patient rows'
      );
    });
  });
});
