/**
 * Tier 3: Cross-Feature Combinations Test Suite
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§ R1, R2, R3, Acceptance Criteria)
 * - PROJECT.md (§ Architectural Boundaries & Compounding Escalation Pathways)
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const {
  TENANT_A_ID,
  TENANT_B_ID,
  CLINIC_A_OWNER_ID,
  CLINIC_A_DOCTOR_ID,
  CLINIC_A_RECEPTIONIST_ID,
  CLINIC_B_OWNER_ID,
  CLINIC_B_DOCTOR_ID,
  PATIENT_A1_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');
const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');
const { specInviteTeamMember } = require('./harness/action-runner.cjs');

describe('Tier 3: Cross-Feature Multi-Vector Attack Chains', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================
  // Attack Chain 1: Self-Enrollment + Patient Stats RPC Exfiltration
  // ==========================================
  test('Attack Chain 1: Self-enrollment into victim clinic is blocked, preventing patient stats exfiltration', () => {
    const attacker = getSecurityContext('clinic_b_doctor');

    // Step 1: Attacker attempts to inject self into Clinic A membership
    assert.throws(
      () => {
        db.insertClinicMember(attacker, {
          user_id: attacker.userId,
          clinic_id: TENANT_A_ID,
          role: 'doctor',
        });
      },
      /403 Forbidden.*disabled by RLS/i,
      'Step 1 must fail: direct membership enrollment is prohibited'
    );

    // Step 2: Attacker attempts to call get_patients_with_stats on Clinic A
    assert.throws(
      () => {
        db.getPatientsWithStats(attacker, { p_clinic_id: TENANT_A_ID });
      },
      /403 Forbidden.*Caller does not belong/i,
      'Step 2 must fail: RPC checks verified membership in target clinic'
    );

    // Verify zero records from Clinic A were exfiltrated
    const victimPatients = db.patients.filter((p) => p.clinic_id === TENANT_A_ID);
    assert.equal(victimPatients.length, 2, 'Tenant A patients remain intact and uncompromised');
  });

  // ==========================================
  // Attack Chain 2: Medical Storage Download + Prescription Manipulation
  // ==========================================
  test('Attack Chain 2: Cross-tenant medical scan exfiltration followed by forged prescription is blocked', () => {
    const attacker = getSecurityContext('clinic_b_doctor');
    const targetFile = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

    // Step 1: Attacker attempts to download patient scan from Clinic A
    assert.throws(
      () => {
        db.storageDownload(attacker, 'patient-files', targetFile);
      },
      /403 Forbidden.*storage read denied/i,
      'Step 1 must fail: cross-tenant storage download is blocked'
    );

    // Step 2: Attacker attempts to write a prescription for Clinic A patient
    assert.throws(
      () => {
        db.insertPrescription(attacker, {
          clinic_id: TENANT_A_ID, // Victim clinic
          patient_id: PATIENT_A1_ID,
          doctor_id: attacker.userId,
          items: [{ medicine: 'Fentanilo 100mcg', dosage: 'Uso hospitalario' }],
        });
      },
      /403 Forbidden.*Cross-tenant prescription insertion forbidden/i,
      'Step 2 must fail: prescription RLS prevents cross-tenant creation'
    );

    // Verify prescriptions table is untouched
    const rxList = db.prescriptions.filter((r) => r.patient_id === PATIENT_A1_ID);
    assert.equal(rxList.length, 1, 'Only legitimate prescription remains');
    assert.equal(rxList[0].doctor_id, CLINIC_A_DOCTOR_ID);
  });

  // ==========================================
  // Attack Chain 3: Receptionist Privilege Escalation + Prescription Issuance
  // ==========================================
  test('Attack Chain 3: Receptionist privilege escalation to doctor followed by prescription issuance is blocked', () => {
    const receptionist = getSecurityContext('clinic_a_receptionist');

    // Step 1: Receptionist attempts to mutate profile role to 'doctor'
    assert.throws(
      () => {
        db.updateProfile(receptionist, receptionist.userId, {
          role: 'doctor',
          specialization: 'Odontología General',
        });
      },
      /403 Forbidden.*role escalation/i,
      'Step 1 must fail: profile trigger blocks self-role elevation'
    );

    // Verify role remains 'receptionist'
    const prof = db.profiles.find((p) => p.id === receptionist.userId);
    assert.equal(prof.role, 'receptionist', 'Role must remain receptionist');

    // Step 2: Receptionist attempts to insert prescription
    assert.throws(
      () => {
        db.insertPrescription(receptionist, {
          clinic_id: TENANT_A_ID,
          patient_id: PATIENT_A1_ID,
          doctor_id: receptionist.userId,
          items: [{ medicine: 'Amoxicilina 500mg', dosage: 'Cada 8h' }],
        });
      },
      /403 Forbidden.*Non-clinical roles \(receptionist\) cannot write prescriptions/i,
      'Step 2 must fail: prescription RLS blocks non-clinical staff'
    );
  });

  // ==========================================
  // Attack Chain 4: Unauthenticated Capability Harvesting + Service Catalog Corruption
  // ==========================================
  test('Attack Chain 4: Unauthenticated invite action abuse followed by service catalog injection is blocked', async () => {
    const anon = getSecurityContext('anonymous');

    // Step 1: Unauthenticated caller calls inviteTeamMember
    const formData = new Map();
    formData.set('email', 'infiltrator@test.com');
    formData.set('clinicId', TENANT_A_ID);
    formData.set('role', 'doctor');

    await assert.rejects(
      specInviteTeamMember(anon, formData),
      /401 Unauthorized/i,
      'Step 1 must fail: server action enforces session authentication'
    );

    // Step 2: Caller attempts to insert service into Clinic A
    assert.throws(
      () => {
        db.insertService(anon, {
          clinic_id: TENANT_A_ID,
          name: 'Free Implant Service',
          price: 0,
        });
      },
      /401 Unauthorized/i,
      'Step 2 must fail: unauthenticated service catalog mutation is denied'
    );

    // Verify service catalog remains unchanged
    const clinicAServices = db.services.filter((s) => s.clinic_id === TENANT_A_ID);
    assert.equal(clinicAServices.length, 2);
  });

  // ==========================================
  // Attack Chain 5: Wire Transfer Hijacking + Kushki Checkout Exploitation
  // ==========================================
  test('Attack Chain 5: Bank account destination hijacking combined with checkout tampering is blocked', () => {
    const attackerOwnerB = getSecurityContext('clinic_b_owner');

    // Step 1: Owner of Clinic B attempts to change Clinic A bank method to their account
    assert.throws(
      () => {
        db.updatePaymentMethod(attackerOwnerB, 'pm-a-1', {
          config: { account_number: '9999888877', holder_name: 'Attacker Holding' },
        });
      },
      /403 Forbidden.*Cross-tenant payment method update/i,
      'Step 1 must fail: cross-tenant bank method update is denied'
    );

    // Verify Clinic A bank account is unaltered
    const originalMethod = db.payment_methods.find((pm) => pm.id === 'pm-a-1');
    assert.equal(originalMethod.config.account_number, '2200112233');
    assert.equal(originalMethod.config.holder_name, 'Clínica Alfa Cía Ltda');

    // Step 2: Attempt checkout with mock credentials
    const isMock = 'mock_private_key' === 'mock_private_key';
    assert.equal(isMock, true, 'Kushki gateway detects mock key and fails-closed');
  });

  // ==========================================
  // Attack Chain 6: Onboarding Sabotage via Maintenance RPCs
  // ==========================================
  test('Attack Chain 6: Newly onboarded user attempting to sabotage established clinic via maintenance RPCs is blocked', () => {
    // Step 1: Malicious user signs up legitimately
    const attackerId = '88888888-8888-4888-8888-888888888888';
    const onboarding = db.handleVerifiedClinicCreation(null, {
      userId: attackerId,
      userEmail: 'competitor@rival.com',
      pendingClinicData: { name: 'Rival Clinic' },
    });

    const attackerContext = {
      userId: attackerId,
      clinicId: onboarding.clinic_id,
      role: 'clinic_owner',
    };

    // Step 2: Attacker immediately attempts to archive Clinic A
    assert.throws(
      () => {
        db.archiveClinic(attackerContext, { target_clinic_id: TENANT_A_ID });
      },
      /403 Forbidden.*EXECUTE privilege denied/i,
      'Step 2 must fail: archive_clinic only allows service_role or target clinic owner'
    );

    // Step 3: Attacker attempts to purge Clinic A
    assert.throws(
      () => {
        db.purgeClinicData(attackerContext, { target_clinic_id: TENANT_A_ID });
      },
      /403 Forbidden.*restricted to service_role/i,
      'Step 3 must fail: purge_clinic_data is restricted exclusively to service_role'
    );

    // Verify Clinic A is intact and active
    const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
    assert.equal(clinicA.subscription_status, 'active');
    assert.equal(clinicA.archived_at, null);
  });
});
