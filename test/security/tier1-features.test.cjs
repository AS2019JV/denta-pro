/**
 * Tier 1: Feature Security Coverage Test Suite
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§ R1, R2, R3, R4)
 * - PROJECT.md (§ Feature Inventory & Interface Contracts)
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
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
  PATIENT_B1_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');
const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');
const { specInviteTeamMember, specSendEmailRoute } = require('./harness/action-runner.cjs');
const {
  getPrivacyTabSource,
  getPatientFilesSource,
  getPaymentMethodsSettingsSource,
} = require('./harness/migration-verifier.cjs');

describe('Tier 1: Feature Coverage (SEC-01 to SEC-13 & R4)', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================
  // SEC-01: Onboarding Tenant Claim Prevention
  // Authoritative Source: ORIGINAL_REQUEST.md:23, PROJECT.md:30, 63-67
  // ==========================================
  describe('SEC-01: Onboarding Tenant Claim Prevention', () => {
    test('Positive: Normal signup generates fresh clinic and assigns owner role', () => {
      const newUserId = '33333333-3333-4333-8333-333333333333';
      const result = db.handleVerifiedClinicCreation(null, {
        userId: newUserId,
        userEmail: 'newdoc@example.com',
        pendingClinicData: { name: 'DentaCare Sur', owner_name: 'Dr. Diego' },
      });

      assert.ok(result.clinic_id, 'Generated clinic_id must exist');
      assert.notEqual(result.clinic_id, TENANT_A_ID, 'Must not collide with existing Tenant A');
      assert.notEqual(result.clinic_id, TENANT_B_ID, 'Must not collide with existing Tenant B');
      assert.equal(result.profile.role, 'clinic_owner');
      assert.equal(result.profile.clinic_id, result.clinic_id);
    });

    test('Negative: Attacker supplying existing victim clinic UUID is ignored and assigned new clinic', () => {
      const attackerId = '99999999-9999-4999-8999-999999999999';
      // Attacker attempts to claim Tenant A by supplying pending_clinic.id = TENANT_A_ID
      const result = db.handleVerifiedClinicCreation(null, {
        userId: attackerId,
        userEmail: 'attacker@evil.com',
        pendingClinicData: {
          id: TENANT_A_ID, // Victim clinic ID
          name: 'Takeover Dental',
        },
      });

      // Must NOT take over TENANT_A_ID
      assert.notEqual(
        result.clinic_id,
        TENANT_A_ID,
        'CRITICAL: Must not assign victim clinic ID to new user'
      );
      assert.notEqual(result.profile.clinic_id, TENANT_A_ID);
      // Victim clinic owner must remain unchanged
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      assert.equal(clinicA.owner_id, CLINIC_A_OWNER_ID, 'Victim clinic owner remains unchanged');
    });
  });

  // ==========================================
  // SEC-02: Profile Privilege Escalation Guard
  // Authoritative Source: ORIGINAL_REQUEST.md:24, PROJECT.md:31, 68-71
  // ==========================================
  describe('SEC-02: Profile Privilege Escalation Guard', () => {
    test('Positive: Staff member can update non-privileged profile fields', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      const updated = db.updateProfile(receptionist, receptionist.userId, {
        full_name: 'Diana Actualizada',
        phone: '+593998887766',
      });

      assert.equal(updated.full_name, 'Diana Actualizada');
      assert.equal(updated.phone, '+593998887766');
      assert.equal(updated.role, 'receptionist');
    });

    test('Negative: Staff member cannot elevate role to clinic_owner', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateProfile(receptionist, receptionist.userId, { role: 'clinic_owner' });
        },
        /403 Forbidden.*role escalation/i,
        'Expected profile trigger to block role mutation'
      );
    });

    test('Negative: Staff member cannot mutate clinic_id to hop tenants', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.updateProfile(doctor, doctor.userId, { clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*clinic_id migration/i,
        'Expected profile trigger to block clinic_id mutation'
      );
    });

    test('Negative: User from Clinic A cannot update profile of user in Clinic B', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          db.updateProfile(ownerA, CLINIC_B_RECEPTIONIST_ID, { full_name: 'Hacked User' });
        },
        /403 Forbidden/i,
        'Cross-tenant profile update must be denied'
      );
    });
  });

  // ==========================================
  // SEC-03: Membership Enrollment Enforcement
  // Authoritative Source: ORIGINAL_REQUEST.md:23, PROJECT.md:32, 72-79
  // ==========================================
  describe('SEC-03: Membership Enrollment Enforcement', () => {
    test('Negative: Direct client-side INSERT on clinic_members is rejected by RLS', () => {
      const attacker = getSecurityContext('clinic_b_receptionist');
      assert.throws(
        () => {
          db.insertClinicMember(attacker, {
            user_id: attacker.userId,
            clinic_id: TENANT_A_ID,
            role: 'clinic_owner',
          });
        },
        /403 Forbidden.*disabled by RLS/i,
        'Direct INSERT into clinic_members must fail'
      );
    });

    test('Positive: Server-side workflow (service_role) can enroll member upon verified invitation', () => {
      const serviceRole = getSecurityContext('service_role');
      const newMember = db.insertClinicMember(serviceRole, {
        user_id: '44444444-4444-4444-8444-444444444444',
        clinic_id: TENANT_A_ID,
        role: 'doctor',
      });

      assert.equal(newMember.clinic_id, TENANT_A_ID);
      assert.equal(newMember.role, 'doctor');
    });
  });

  // ==========================================
  // SEC-04: Patient Statistics RPC Tenant Scoping
  // Authoritative Source: ORIGINAL_REQUEST.md:25, PROJECT.md:33, 80-84
  // ==========================================
  describe('SEC-04: Patient Statistics RPC Tenant Scoping', () => {
    test('Positive: Clinic member querying own clinic receives patient statistics', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const stats = db.getPatientsWithStats(doctorA, { p_clinic_id: TENANT_A_ID });

      assert.ok(Array.isArray(stats.data), 'Returns array of patients');
      assert.equal(stats.total, 2, 'Tenant A has exactly 2 registered patients');
      for (const p of stats.data) {
        assert.equal(p.clinic_id, TENANT_A_ID, 'Every record must belong to Tenant A');
      }
    });

    test('Negative: Caller from Clinic A cannot query patient statistics of Clinic B', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.getPatientsWithStats(doctorA, { p_clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*Caller does not belong/i,
        'Cross-tenant patient stats RPC query must be denied'
      );
    });

    test('Negative: Unauthenticated caller is denied access to patient statistics', () => {
      const anon = getSecurityContext('anonymous');
      assert.throws(
        () => {
          db.getPatientsWithStats(anon, { p_clinic_id: TENANT_A_ID });
        },
        /401 Unauthorized/i,
        'Unauthenticated RPC query must be rejected'
      );
    });
  });

  // ==========================================
  // SEC-05: Storage Tenant & Patient Isolation
  // Authoritative Source: ORIGINAL_REQUEST.md:26, PROJECT.md:34, 85-92
  // ==========================================
  describe('SEC-05: Storage Tenant & Patient Isolation', () => {
    test('Positive: Doctor can generate signed download URL for own clinic patient file', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const filePath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;
      const result = db.storageDownload(doctorA, 'patient-files', filePath);

      assert.ok(result.signedUrl, 'Must return signed URL');
      assert.ok(result.signedUrl.includes('token='), 'Signed URL must include security token');
      assert.ok(result.expiresAt > Date.now(), 'Expiration must be in future');
    });

    test('Negative: Doctor from Clinic B cannot read patient attachment from Clinic A', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      const filePath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;
      assert.throws(
        () => {
          db.storageDownload(doctorB, 'patient-files', filePath);
        },
        /403 Forbidden.*storage read denied/i,
        'Cross-tenant storage download must be blocked'
      );
    });

    test('Negative: Receptionist cannot delete medical scan attachment', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      const filePath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;
      assert.throws(
        () => {
          db.storageDelete(receptionistA, 'patient-files', filePath);
        },
        /403 Forbidden.*requires clinical role/i,
        'Receptionist file deletion must be denied'
      );
    });

    test('Positive: Clinic owner can delete patient attachment in own clinic', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const filePath = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;
      const result = db.storageDelete(ownerA, 'patient-files', filePath);
      assert.equal(result.success, true);
    });
  });

  // ==========================================
  // SEC-06: Server Invitation Action Auth
  // Authoritative Source: ORIGINAL_REQUEST.md:27, PROJECT.md:35, 72-79
  // ==========================================
  describe('SEC-06: Server Invitation Action Auth', () => {
    test('Positive: Clinic owner can invite team member; no magic token returned in response', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map();
      formData.set('email', 'newdoctor@clinic-a.com');
      formData.set('clinicId', TENANT_A_ID);
      formData.set('role', 'doctor');

      const response = await specInviteTeamMember(ownerA, formData);
      assert.equal(response.success, true);
      assert.equal(response.inviteLink, undefined, 'CRITICAL: Must never leak inviteLink in response payload');
      assert.equal(response.token_hash, undefined, 'CRITICAL: Must never leak token_hash in response payload');
    });

    test('Negative: Unauthenticated caller cannot execute inviteTeamMember', async () => {
      const anon = getSecurityContext('anonymous');
      const formData = new Map();
      formData.set('email', 'rogue@example.com');
      formData.set('clinicId', TENANT_A_ID);

      await assert.rejects(
        specInviteTeamMember(anon, formData),
        /401 Unauthorized/i,
        'Unauthenticated invitation must fail'
      );
    });

    test('Negative: Doctor cannot invite members (restricted to clinic_owner)', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const formData = new Map();
      formData.set('email', 'doctor-friend@clinic-a.com');
      formData.set('clinicId', TENANT_A_ID);
      formData.set('role', 'doctor');

      await assert.rejects(
        specInviteTeamMember(doctorA, formData),
        /403 Forbidden/i,
        'Doctor cannot invite team members'
      );
    });

    test('Negative: Owner cannot invite a rogue clinic_owner', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map();
      formData.set('email', 'co-owner@example.com');
      formData.set('clinicId', TENANT_A_ID);
      formData.set('role', 'clinic_owner');

      await assert.rejects(
        specInviteTeamMember(ownerA, formData),
        /400 Bad Request.*Cannot invite role clinic_owner/i,
        'Inviting clinic_owner must be rejected'
      );
    });

    test('Negative: Owner of Clinic A cannot invite members for Clinic B', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map();
      formData.set('email', 'spy@clinic-b.com');
      formData.set('clinicId', TENANT_B_ID); // Cross-tenant target
      formData.set('role', 'receptionist');

      await assert.rejects(
        specInviteTeamMember(ownerA, formData),
        /403 Forbidden/i,
        'Cross-tenant invitation must be denied'
      );
    });
  });

  // ==========================================
  // SEC-07: Clinical Role Privilege Separation
  // Authoritative Source: ORIGINAL_REQUEST.md:30, PROJECT.md:36, 93-98
  // ==========================================
  describe('SEC-07: Clinical Role Privilege Separation', () => {
    test('Positive: Doctor can write prescription for patient in own clinic', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const rx = db.insertPrescription(doctorA, {
        clinic_id: TENANT_A_ID,
        patient_id: PATIENT_A1_ID,
        doctor_id: doctorA.userId,
        items: [{ medicine: 'Ibuprofeno 400mg', dosage: 'Cada 8h por 3 días' }],
      });

      assert.ok(rx.id);
      assert.equal(rx.doctor_id, doctorA.userId);
    });

    test('Negative: Receptionist cannot write prescription', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.insertPrescription(receptionistA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: receptionistA.userId,
            items: [{ medicine: 'Antibiótico', dosage: '1 al día' }],
          });
        },
        /403 Forbidden.*cannot write prescriptions/i,
        'Receptionist must be blocked from writing prescriptions'
      );
    });

    test('Negative: Doctor cannot spoof prescriber doctor_id', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.insertPrescription(doctorA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: CLINIC_A_DOCTOR_2_ID, // Spoofed colleague
            items: [{ medicine: 'Tramadol 50mg', dosage: 'Dosis única' }],
          });
        },
        /403 Forbidden.*cannot spoof prescriber doctor_id/i,
        'Doctor cannot sign with another doctor ID'
      );
    });

    test('Negative: Receptionist cannot update HCU-033 clinical diagnosis', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateHcu033Form(receptionistA, 'hcu-a-1', {
            diagnosis: [{ code: 'K05.1', description: 'Gingivitis crónica' }],
          });
        },
        /403 Forbidden.*cannot alter HCU-033/i,
        'Receptionist cannot alter clinical diagnosis'
      );
    });
  });

  // ==========================================
  // SEC-08: Dashboard Analytics View Isolation
  // Authoritative Source: ORIGINAL_REQUEST.md:35, PROJECT.md:39, 107-109
  // ==========================================
  describe('SEC-08: Dashboard Analytics View Isolation', () => {
    test('Positive: Clinic owner views aggregated revenue for own clinic only', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const rows = db.queryDashboardStatsView(ownerA);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].clinic_id, TENANT_A_ID);
      assert.equal(rows[0].total_billings, 2);
      assert.equal(rows[0].total_revenue, 370.0);
    });

    test('Negative: Clinic A owner receives zero billing rows for Clinic B', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const rows = db.queryDashboardStatsView(ownerA);

      const hasClinicBData = rows.some((r) => r.clinic_id === TENANT_B_ID);
      assert.equal(hasClinicBData, false, 'No competitor clinic data exposed');
    });
  });

  // ==========================================
  // SEC-09: Maintenance RPCs Execution Revocation
  // Authoritative Source: ORIGINAL_REQUEST.md:35, PROJECT.md:40, 110-112
  // ==========================================
  describe('SEC-09: Maintenance RPCs Execution Revocation', () => {
    test('Negative: Regular authenticated user cannot execute archive_clinic on victim clinic', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      assert.throws(
        () => {
          db.archiveClinic(doctorB, { target_clinic_id: TENANT_A_ID });
        },
        /403 Forbidden.*EXECUTE privilege denied/i,
        'Unauthorized clinic archival must be denied'
      );
    });

    test('Negative: Authenticated user cannot execute purge_clinic_data', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          db.purgeClinicData(ownerA, { target_clinic_id: TENANT_A_ID });
        },
        /403 Forbidden.*restricted to service_role/i,
        'Direct user execution of purge_clinic_data must be denied'
      );
    });

    test('Negative: Purge RPC rejects purging clinic before 90-day retention elapsed', () => {
      const serviceRole = getSecurityContext('service_role');
      // Archive clinic now (0 days ago)
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.archived_at = new Date().toISOString();

      assert.throws(
        () => {
          db.purgeClinicData(serviceRole, { target_clinic_id: TENANT_A_ID });
        },
        /400 Bad Request.*90-day retention lock active/i,
        'Purging before 90 days must be rejected'
      );
    });

    test('Positive: Service role can execute purge after 90-day retention', () => {
      const serviceRole = getSecurityContext('service_role');
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      // Set archival to 95 days ago
      clinicA.archived_at = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();

      const res = db.purgeClinicData(serviceRole, { target_clinic_id: TENANT_A_ID });
      assert.equal(res.success, true);
    });
  });

  // ==========================================
  // SEC-10: Email Endpoint Authentication & Relay Defense
  // Authoritative Source: ORIGINAL_REQUEST.md:36, PROJECT.md:41, 113-119
  // ==========================================
  describe('SEC-10: Email Endpoint Authentication & Relay Defense', () => {
    test('Positive: Authenticated staff sending pre-approved template to clinic patient succeeds', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const result = await specSendEmailRoute(doctorA, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
        variables: { date: '2026-09-25 10:00' },
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
    });

    test('Negative: Unauthenticated request to /api/send-email returns 401', async () => {
      const anon = getSecurityContext('anonymous');
      const result = await specSendEmailRoute(anon, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
      });

      assert.equal(result.status, 401);
    });

    test('Negative: Arbitrary caller-supplied HTML is rejected with 400', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const result = await specSendEmailRoute(doctorA, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
        html: '<h1>Phishing Scam</h1><a href="https://evil.com">Click Here</a>',
      });

      assert.equal(result.status, 400);
      assert.match(result.body.error, /Arbitrary HTML messages are forbidden/i);
    });

    test('Negative: Sending email to non-patient external address is rejected with 403', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const result = await specSendEmailRoute(doctorA, {
        to: 'random-victim@external.com',
        template: 'appointment_reminder',
      });

      assert.equal(result.status, 403);
      assert.match(result.body.error, /Recipient email is not associated/i);
    });
  });

  // ==========================================
  // SEC-12: Services Table Tenant Isolation
  // Authoritative Source: ORIGINAL_REQUEST.md:31, PROJECT.md:37, 99-102
  // ==========================================
  describe('SEC-12: Services Table Tenant Isolation', () => {
    test('Positive: Clinic owner can insert services into own clinic catalog', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const service = db.insertService(ownerA, {
        clinic_id: TENANT_A_ID,
        name: 'Profilaxis Avanzada',
        price: 75.0,
      });

      assert.ok(service.id);
      assert.equal(service.clinic_id, TENANT_A_ID);
    });

    test('Negative: Owner of Clinic A cannot insert services into Clinic B', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          db.insertService(ownerA, {
            clinic_id: TENANT_B_ID, // Victim clinic
            name: 'Injected Fake Service',
            price: 1.0,
          });
        },
        /403 Forbidden.*Cross-tenant service catalog insertion/i,
        'Cross-tenant service insert must be denied'
      );
    });

    test('Negative: Receptionist cannot insert services', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.insertService(receptionistA, {
            clinic_id: TENANT_A_ID,
            name: 'Unauthorized Discount',
            price: 10.0,
          });
        },
        /403 Forbidden.*Only clinic_owner can insert services/i,
        'Receptionist service insert must be denied'
      );
    });
  });

  // ==========================================
  // SEC-13: Bank Payment Methods Tenant Partition
  // Authoritative Source: ORIGINAL_REQUEST.md:32, PROJECT.md:38, 102-106
  // ==========================================
  describe('SEC-13: Bank Payment Methods Tenant Partition', () => {
    test('Positive: Clinic owner views bank payment methods for own clinic', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const methods = db.selectPaymentMethods(ownerA);

      assert.equal(methods.length, 1);
      assert.equal(methods[0].id, 'pm-a-1');
      assert.equal(methods[0].clinic_id, TENANT_A_ID);
    });

    test('Negative: Clinic A member cannot see Clinic B payment methods', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const methods = db.selectPaymentMethods(ownerA);

      const hasClinicBMethod = methods.some((m) => m.clinic_id === TENANT_B_ID);
      assert.equal(hasClinicBMethod, false, 'Tenant B payment methods must be hidden');
    });

    test('Negative: Owner of Clinic A cannot update Clinic B payment method', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          db.updatePaymentMethod(ownerA, 'pm-b-1', {
            config: { account_number: '9999999999', holder_name: 'Attacker Account' },
          });
        },
        /403 Forbidden.*Cross-tenant payment method update/i,
        'Cross-tenant bank account mutation must be blocked'
      );
    });

    test('Negative: Receptionist cannot update clinic payment methods', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updatePaymentMethod(receptionistA, 'pm-a-1', { is_active: false });
        },
        /403 Forbidden.*Only clinic_owner can update payment methods/i,
        'Receptionist cannot update bank payment methods'
      );
    });
  });

  // ==========================================
  // R4: Statutory LOPDP Alignment & Migration Consolidation
  // Authoritative Source: ORIGINAL_REQUEST.md:39-42, PROJECT.md:43-44, 140-146
  // ==========================================
  describe('R4: Statutory LOPDP Alignment & Invariants', () => {
    test('Specification Invariant: Statutory Articles match Ecuadorian LOPDP', () => {
      const statutoryMap = {
        portability: 17, // Right to Data Portability (Art. 17 LOPDP)
        elimination: 15, // Right to Elimination / Suppression (Art. 15 LOPDP)
        automated_decisions: [20, 21], // Automated individual decisions & profiling (Arts. 20-21 LOPDP)
      };

      assert.equal(statutoryMap.portability, 17, 'LOPDP Portability must be Article 17');
      assert.equal(statutoryMap.elimination, 15, 'LOPDP Elimination must be Article 15');
      assert.deepEqual(statutoryMap.automated_decisions, [20, 21]);
    });
  });
});
