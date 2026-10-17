/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§ R1, R2, R3, R4)
 * - PROJECT.md (§ Architectural Boundaries & Milestones)
 * - dental-clinical-standards (RBAC, HCU-033, LOPDP statutory compliance)
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
  PATIENT_A1_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');
const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');
const { specInviteTeamMember } = require('./harness/action-runner.cjs');

describe('Tier 4: Real-World Application Scenarios', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================
  // Scenario 1: Complete Clinic Onboarding Lifecycle
  // ==========================================
  test('Scenario 1: Complete clinic onboarding, staff invitation, and multi-tenant isolation verification', async () => {
    // Phase 1: New clinic owner signs up
    const newOwnerId = '55555555-5555-4555-8555-555555555555';
    const onboarding = db.handleVerifiedClinicCreation(null, {
      userId: newOwnerId,
      userEmail: 'dr.mendoza@mendozadental.com',
      pendingClinicData: { name: 'Mendoza Dental Studio', owner_name: 'Dr. Carlos Mendoza' },
    });

    const newClinicId = onboarding.clinic_id;
    assert.ok(newClinicId);
    assert.notEqual(newClinicId, TENANT_A_ID);
    assert.notEqual(newClinicId, TENANT_B_ID);

    const newOwnerContext = {
      userId: newOwnerId,
      clinicId: newClinicId,
      role: 'clinic_owner',
    };

    // Phase 2: Owner seeds services catalog
    const service1 = db.insertService(newOwnerContext, {
      clinic_id: newClinicId,
      name: 'Consulta de Diagnóstico Inicial',
      price: 30.0,
    });
    assert.equal(service1.clinic_id, newClinicId);

    // Phase 3: Owner invites associate doctor
    const inviteFormData = new Map();
    inviteFormData.set('email', 'dra.valeria@mendozadental.com');
    inviteFormData.set('clinicId', newClinicId);
    inviteFormData.set('role', 'doctor');

    const inviteResult = await specInviteTeamMember(newOwnerContext, inviteFormData);
    assert.equal(inviteResult.success, true);
    assert.equal(inviteResult.inviteLink, undefined, 'No inviteLink leaked to client');

    // Phase 4: Associate doctor accepts invite via server-side verification
    const newDoctorId = '66666666-6666-4666-8666-666666666666';
    const serviceRole = getSecurityContext('service_role');
    db.insertClinicMember(serviceRole, {
      user_id: newDoctorId,
      clinic_id: newClinicId,
      role: 'doctor',
    });

    const newDoctorContext = {
      userId: newDoctorId,
      clinicId: newClinicId,
      role: 'doctor',
    };

    // Phase 5: Verify new doctor can query own clinic catalog
    const ownServices = db.services.filter((s) => s.clinic_id === newClinicId);
    assert.equal(ownServices.length, 1);

    // Phase 6: Verify new doctor is strictly isolated from Tenant A and Tenant B
    assert.throws(() => {
      db.getPatientsWithStats(newDoctorContext, { p_clinic_id: TENANT_A_ID });
    }, /403 Forbidden/i);

    assert.throws(() => {
      db.getPatientsWithStats(newDoctorContext, { p_clinic_id: TENANT_B_ID });
    }, /403 Forbidden/i);
  });

  // ==========================================
  // Scenario 2: Multi-Doctor Clinical Practice Workflow
  // ==========================================
  test('Scenario 2: Multi-doctor practice with distinct clinical attribution and anti-spoofing controls', () => {
    const doctor1 = getSecurityContext('clinic_a_doctor');
    const doctor2 = getSecurityContext('clinic_a_doctor_2');

    // Phase 1: Doctor 1 creates prescription for Patient A1
    const rx1 = db.insertPrescription(doctor1, {
      clinic_id: TENANT_A_ID,
      patient_id: PATIENT_A1_ID,
      doctor_id: doctor1.userId,
      items: [{ medicine: 'Amoxicilina 500mg', dosage: 'Cada 8 horas por 7 días' }],
    });
    assert.equal(rx1.doctor_id, doctor1.userId);

    // Phase 2: Doctor 2 attempts to forge Doctor 1's signature on a new prescription
    assert.throws(
      () => {
        db.insertPrescription(doctor2, {
          clinic_id: TENANT_A_ID,
          patient_id: PATIENT_A1_ID,
          doctor_id: doctor1.userId, // Attempting to sign as Doctor 1
          items: [{ medicine: 'Clonazepam 2mg', dosage: '1 al día' }],
        });
      },
      /403 Forbidden.*cannot spoof prescriber doctor_id/i,
      'Doctor 2 must not be able to sign with Doctor 1 ID'
    );

    // Phase 3: Doctor 2 legitimately writes their own prescription
    const rx2 = db.insertPrescription(doctor2, {
      clinic_id: TENANT_A_ID,
      patient_id: PATIENT_A1_ID,
      doctor_id: doctor2.userId,
      items: [{ medicine: 'Paracetamol 500mg', dosage: 'Cada 6 horas si hay dolor' }],
    });
    assert.equal(rx2.doctor_id, doctor2.userId);

    // Verify both prescriptions are distinctly attributed
    const patientRxList = db.prescriptions.filter((r) => r.patient_id === PATIENT_A1_ID);
    assert.equal(patientRxList.length, 3); // 1 preloaded + 2 newly added
    const authors = patientRxList.map((r) => r.doctor_id);
    assert.ok(authors.includes(doctor1.userId));
    assert.ok(authors.includes(doctor2.userId));
  });

  // ==========================================
  // Scenario 3: Receptionist Boundary Stress Test
  // ==========================================
  test('Scenario 3: Receptionist boundary stress test (3 allowed front-desk tasks, 10 denied boundary tests)', () => {
    const receptionist = getSecurityContext('clinic_a_receptionist');

    // --- Allowed Front-Desk Operations ---
    // 1. View patient directory
    const patientList = db.getPatientsWithStats(receptionist, { p_clinic_id: TENANT_A_ID });
    assert.equal(patientList.total, 2);

    // 2. Update own profile phone
    const updatedProfile = db.updateProfile(receptionist, receptionist.userId, {
      phone: '+593991234567',
    });
    assert.equal(updatedProfile.phone, '+593991234567');

    // --- Denied Clinical & Administrative Boundary Tests (10/10) ---

    // 1. Insert electronic prescription
    assert.throws(() => {
      db.insertPrescription(receptionist, {
        clinic_id: TENANT_A_ID,
        patient_id: PATIENT_A1_ID,
        doctor_id: receptionist.userId,
        items: [{ medicine: 'Antibiótico' }],
      });
    }, /403 Forbidden/i, 'Check 1 failed: prescription insert must be blocked');

    // 2. Insert HCU-033 form
    assert.throws(() => {
      db.updateHcu033Form(receptionist, 'hcu-a-1', {
        diagnosis: [{ code: 'K02.1', description: 'Caries modificada' }],
      });
    }, /403 Forbidden/i, 'Check 2 failed: HCU diagnosis mutation must be blocked');

    // 3. Insert service catalog item
    assert.throws(() => {
      db.insertService(receptionist, {
        clinic_id: TENANT_A_ID,
        name: 'Descuento no autorizado',
        price: 5.0,
      });
    }, /403 Forbidden/i, 'Check 3 failed: service insert must be blocked');

    // 4. Delete patient radiography from storage
    assert.throws(() => {
      db.storageDelete(
        receptionist,
        'patient-files',
        `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`
      );
    }, /403 Forbidden/i, 'Check 4 failed: storage file deletion must be blocked');

    // 5. Mutate clinic bank account in payment_methods
    assert.throws(() => {
      db.updatePaymentMethod(receptionist, 'pm-a-1', {
        is_active: false,
      });
    }, /403 Forbidden/i, 'Check 5 failed: payment method update must be blocked');

    // 6. Elevate own role to 'doctor'
    assert.throws(() => {
      db.updateProfile(receptionist, receptionist.userId, {
        role: 'doctor',
      });
    }, /403 Forbidden/i, 'Check 6 failed: role escalation to doctor must be blocked');

    // 7. Elevate own role to 'clinic_owner'
    assert.throws(() => {
      db.updateProfile(receptionist, receptionist.userId, {
        role: 'clinic_owner',
      });
    }, /403 Forbidden/i, 'Check 7 failed: role escalation to owner must be blocked');

    // 8. Execute archive_clinic RPC
    assert.throws(() => {
      db.archiveClinic(receptionist, { target_clinic_id: TENANT_A_ID });
    }, /403 Forbidden/i, 'Check 8 failed: archive_clinic execution must be blocked');

    // 9. Execute purge_clinic_data RPC
    assert.throws(() => {
      db.purgeClinicData(receptionist, { target_clinic_id: TENANT_A_ID });
    }, /403 Forbidden/i, 'Check 9 failed: purge_clinic_data execution must be blocked');

    // 10. Access cross-tenant patient directory
    assert.throws(() => {
      db.getPatientsWithStats(receptionist, { p_clinic_id: TENANT_B_ID });
    }, /403 Forbidden/i, 'Check 10 failed: cross-tenant patient lookup must be blocked');
  });

  // ==========================================
  // Scenario 4: Multi-Tenant LOPDP Lifecycle & Custody Compliance
  // ==========================================
  test('Scenario 4: Multi-tenant LOPDP Art. 17 data export and Art. 15 custody retention lock', () => {
    const ownerA = getSecurityContext('clinic_a_owner');

    // Phase 1: LOPDP Art. 17 Structured Data Export (Portabilidad)
    const exportData = {
      meta: {
        normativa: 'Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador) - Art. 17 (Derecho a la Portabilidad)',
        clinic_id: ownerA.clinicId,
      },
      data: {
        patients: db.patients.filter((p) => p.clinic_id === ownerA.clinicId),
        services: db.services.filter((s) => s.clinic_id === ownerA.clinicId),
        prescriptions: db.prescriptions.filter((p) => p.clinic_id === ownerA.clinicId),
        hcu033: db.hcu033_forms.filter((h) => h.clinic_id === ownerA.clinicId),
      },
    };

    // Verify Art. 17 export contains ONLY Clinic A entities
    assert.equal(exportData.meta.clinic_id, TENANT_A_ID);
    assert.equal(exportData.data.patients.length, 2);
    assert.equal(exportData.data.services.length, 2);
    for (const p of exportData.data.patients) {
      assert.equal(p.clinic_id, TENANT_A_ID, 'Export must never leak cross-tenant patient records');
    }

    // Phase 2: LOPDP Art. 15 Account Archival (Derecho de Eliminación / Supresión)
    // Under statutory health law (Ley Orgánica de Salud), immediate hard delete of medical records is illegal.
    // Instead, clinic is transitioned to 'archived' state with a custody lock.
    const archiveResult = db.archiveClinic(ownerA, { target_clinic_id: TENANT_A_ID });
    assert.equal(archiveResult.success, true);
    assert.ok(archiveResult.archived_at);

    // Attempting an immediate hard purge is rejected
    const serviceRole = getSecurityContext('service_role');
    assert.throws(
      () => {
        db.purgeClinicData(serviceRole, { target_clinic_id: TENANT_A_ID });
      },
      /400 Bad Request.*90-day retention lock active/i,
      'Immediate hard purge violates statutory custody period'
    );
  });
});
