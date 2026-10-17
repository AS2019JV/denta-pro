/**
 * Milestone 2 Challenger Stress & Adversarial Test Suite
 * Author: teamwork_preview_challenger_m2_1 (Empirical Challenger)
 * Role: critic, specialist
 * Targets: SEC-07, SEC-12, SEC-13 (Clinical Privilege Separation, Services Isolation, Payment Partition)
 *
 * Core Objectives:
 * 1. Prescriptions: Attack insertion/update by receptionists, forging of doctor_id, cross-clinic issuance, statutory deletion custody.
 * 2. Dental Charting & Diagnoses: Attack tampering with odontogram_state, periodontogram_state, medical_history, clinical_notes,
 *    and systemic medical flags by receptionists, while ensuring receptionist administrative intake passes.
 * 3. Services Catalog: Attack cross-tenant service catalog injection, unauthorized price mutations, and role elevation.
 * 4. Payment Methods: Attack cross-tenant bank account updates, unauthorized inserts, and checkout payment method leakage.
 * 5. AST & Migration Static Invariants: Verify fail-closed SQL policies, column triggers, RPC security definers, and frontend protections.
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
} = require('./harness/security-context.cjs');

const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');

const ROOT_DIR = join(__dirname, '../..');
const MIGRATION_M2_FILE = join(ROOT_DIR, 'supabase/migrations/20260920_m2_clinical_services_payment_methods.sql');
const PAYMENT_SETTINGS_FILE = join(ROOT_DIR, 'components/billing/payment-methods-settings.tsx');
const PAY_PAGE_FILE = join(ROOT_DIR, 'app/(dashboard)/pay/[id]/page.tsx');
const TYPES_FILE = join(ROOT_DIR, 'types/index.ts');

/**
 * Extended Challenger M2 Security Engine simulating the exact PL/pgSQL triggers,
 * RLS WITH CHECK / USING clauses, and RPCs deployed in Milestone 2.
 */
class ChallengerM2SecurityHarness extends DatabaseSecurityEngine {
  constructor() {
    super();

    // Hydrate patient clinical columns per SEC-07 specifications
    this.patients = this.patients.map((p) => ({
      ...p,
      odontogram_state: null,
      periodontogram_state: null,
      medical_history: null,
      clinical_notes: null,
      allergies: null,
      medications: null,
      medical_conditions: null,
      blood_type: 'O+',
      has_diabetes: false,
      has_hypertension: false,
      has_heart_disease: false,
      is_smoker: false,
      is_pregnant: false,
    }));
  }

  // ==========================================================================
  // SEC-07: Prescriptions Model & RLS Simulation
  // ==========================================================================

  /**
   * Simulates INSERT into public.prescriptions
   * Policy: "Doctors and owners can insert prescriptions"
   * WITH CHECK:
   *   clinic_id = JWT.clinic_id
   *   AND JWT.role IN ('doctor', 'clinic_owner')
   *   AND doctor_id = auth.uid()
   *   AND check_subscription_active(clinic_id)
   */
  insertPrescription(caller, rxData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    // Check clinic subscription
    const clinic = this.clinics.find((c) => c.id === rxData.clinic_id);
    if (!clinic || clinic.subscription_status === 'expired' || clinic.subscription_status === 'cancelled') {
      throw new Error('403 Forbidden: Subscription inactive or expired for this clinic.');
    }

    // Cross-tenant check: caller cannot insert into another clinic
    if (callerRole !== 'service_role' && callerClinicId !== rxData.clinic_id) {
      throw new Error('403 Forbidden: Cross-tenant prescription insertion forbidden');
    }

    // Role check: Only clinical staff (doctor or clinic_owner)
    if (!['doctor', 'clinic_owner'].includes(callerRole)) {
      throw new Error('403 Forbidden: Non-clinical roles (receptionist) cannot write prescriptions');
    }

    // Anti-spoofing check: doctor_id MUST strictly match caller auth.uid()
    if (callerRole !== 'service_role' && rxData.doctor_id !== caller.userId) {
      throw new Error('403 Forbidden: Prescriber doctor_id cannot be spoofed or forged');
    }

    const newRx = {
      id: `rx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...rxData,
      created_at: new Date().toISOString(),
    };
    this.prescriptions.push(newRx);
    return newRx;
  }

  /**
   * Simulates UPDATE on public.prescriptions
   * Policy: "Doctors and owners can update their prescriptions"
   * USING & WITH CHECK:
   *   clinic_id = JWT.clinic_id
   *   AND JWT.role IN ('doctor', 'clinic_owner')
   *   AND (doctor_id = auth.uid() OR JWT.role = 'clinic_owner')
   */
  updatePrescription(caller, rxId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const rx = this.prescriptions.find((r) => r.id === rxId);
    if (!rx) {
      throw new Error('404 Not Found: Prescription not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    // Cross-tenant USING check
    if (callerRole !== 'service_role' && rx.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant prescription modification forbidden');
    }

    // Clinical role USING check
    if (!['doctor', 'clinic_owner'].includes(callerRole)) {
      throw new Error('403 Forbidden: Non-clinical roles cannot update prescriptions');
    }

    // Attribution USING check: only the prescribing doctor or clinic owner can update
    if (callerRole === 'doctor' && rx.doctor_id !== caller.userId) {
      throw new Error('403 Forbidden: Doctors cannot modify prescriptions authored by other doctors');
    }

    // WITH CHECK: partition key mutation check
    if (updates.clinic_id !== undefined && updates.clinic_id !== rx.clinic_id) {
      throw new Error('403 Forbidden: Cross-tenant prescription partition migration blocked');
    }

    // WITH CHECK: doctor_id spoofing check on update
    if (callerRole === 'doctor' && updates.doctor_id !== undefined && updates.doctor_id !== rx.doctor_id) {
      throw new Error('403 Forbidden: Cannot alter prescriber doctor_id attribution on existing prescription');
    }

    // Apply allowed updates
    if (updates.items !== undefined) rx.items = updates.items;
    if (updates.instructions !== undefined) rx.instructions = updates.instructions;
    if (updates.medications !== undefined) rx.medications = updates.medications;
    if (callerRole === 'clinic_owner' && updates.doctor_id !== undefined) rx.doctor_id = updates.doctor_id;

    return rx;
  }

  /**
   * Simulates DELETE on public.prescriptions
   * Policy: "Prescriptions are deletable by clinic owners"
   * USING:
   *   clinic_id = JWT.clinic_id
   *   AND JWT.role = 'clinic_owner'
   */
  deletePrescription(caller, rxId) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const rx = this.prescriptions.find((r) => r.id === rxId);
    if (!rx) {
      throw new Error('404 Not Found: Prescription not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'service_role' && rx.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant prescription deletion forbidden');
    }

    // Statutory retention custody: strictly clinic_owner
    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can delete prescriptions (statutory custody lock)');
    }

    const idx = this.prescriptions.findIndex((r) => r.id === rxId);
    this.prescriptions.splice(idx, 1);
    return { success: true, deleted_id: rxId };
  }

  // ==========================================================================
  // SEC-07: Patients Table Trigger & Column-Level Privilege Separation
  // ==========================================================================

  /**
   * Simulates BEFORE INSERT trigger: public.guard_patient_clinical_insert()
   * and INSERT RLS policy.
   */
  insertPatient(caller, patientData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'service_role' && patientData.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant patient creation forbidden');
    }

    // Trigger: guard_patient_clinical_insert()
    if (callerRole !== 'service_role' && !['doctor', 'clinic_owner'].includes(callerRole)) {
      const hasNonEmptyOdontogram =
        patientData.odontogram_state !== null &&
        patientData.odontogram_state !== undefined &&
        JSON.stringify(patientData.odontogram_state) !== '{}' &&
        JSON.stringify(patientData.odontogram_state) !== 'null';

      const hasNonEmptyPeriodontogram =
        patientData.periodontogram_state !== null &&
        patientData.periodontogram_state !== undefined &&
        JSON.stringify(patientData.periodontogram_state) !== '{}' &&
        JSON.stringify(patientData.periodontogram_state) !== 'null';

      if (hasNonEmptyOdontogram || hasNonEmptyPeriodontogram) {
        throw new Error('42501: Unauthorized clinical intake: Non-clinical staff cannot initialize dental charting state.');
      }
    }

    const newPatient = {
      id: patientData.id || `pa-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      clinic_id: patientData.clinic_id,
      first_name: patientData.first_name || '',
      last_name: patientData.last_name || '',
      cedula: patientData.cedula || '',
      email: patientData.email || '',
      phone: patientData.phone || '',
      address: patientData.address || '',
      emergency_contact: patientData.emergency_contact || null,
      odontogram_state: patientData.odontogram_state || null,
      periodontogram_state: patientData.periodontogram_state || null,
      medical_history: patientData.medical_history || null,
      clinical_notes: patientData.clinical_notes || null,
      allergies: patientData.allergies || null,
      medications: patientData.medications || null,
      medical_conditions: patientData.medical_conditions || null,
      blood_type: patientData.blood_type || 'O+',
      has_diabetes: !!patientData.has_diabetes,
      has_hypertension: !!patientData.has_hypertension,
      has_heart_disease: !!patientData.has_heart_disease,
      is_smoker: !!patientData.is_smoker,
      is_pregnant: !!patientData.is_pregnant,
      deleted_at: null,
    };

    this.patients.push(newPatient);
    return newPatient;
  }

  /**
   * Simulates BEFORE UPDATE trigger: public.enforce_patient_clinical_privileges()
   * and UPDATE RLS policy.
   */
  updatePatient(caller, patientId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const patient = this.patients.find((p) => p.id === patientId && !p.deleted_at);
    if (!patient) {
      throw new Error('404 Not Found: Patient not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    let callerRole = caller.jwt?.app_metadata?.role || caller.role;

    // RLS check: Patients in caller clinic
    if (callerRole !== 'service_role' && patient.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant patient update forbidden');
    }

    // A. Service role bypass
    if (callerRole === 'service_role') {
      Object.assign(patient, updates);
      return { ...patient };
    }

    // B. Prevent mutation of tenant partition key
    if (updates.clinic_id !== undefined && updates.clinic_id !== patient.clinic_id) {
      throw new Error('42501: Unauthorized patient mutation: clinic_id cannot be modified.');
    }

    // C. Resolve role fallback from clinic_members if omitted
    if (!callerRole) {
      const membership = this.clinic_members.find(
        (cm) => cm.user_id === caller.userId && cm.clinic_id === patient.clinic_id && cm.status === 'active'
      );
      if (membership) callerRole = membership.role;
    }

    // D. Clinical staff (doctor or clinic_owner) can modify all fields
    if (['doctor', 'clinic_owner'].includes(callerRole)) {
      Object.assign(patient, updates);
      return { ...patient };
    }

    // E. Non-clinical staff (receptionist): Check all 13 protected clinical columns
    const protectedColumns = [
      'odontogram_state',
      'periodontogram_state',
      'medical_history',
      'clinical_notes',
      'allergies',
      'medications',
      'medical_conditions',
      'blood_type',
      'has_diabetes',
      'has_hypertension',
      'has_heart_disease',
      'is_smoker',
      'is_pregnant',
    ];

    for (const col of protectedColumns) {
      if (updates[col] !== undefined) {
        const oldVal = patient[col];
        const newVal = updates[col];
        const isDifferent =
          typeof oldVal === 'object' || typeof newVal === 'object'
            ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
            : oldVal !== newVal;

        if (isDifferent) {
          throw new Error(
            `42501: Unauthorized clinical mutation: Non-clinical staff (${callerRole}) cannot modify clinical diagnoses, dental charting, or medical history.`
          );
        }
      }
    }

    // Apply allowed administrative and demographic updates
    if (updates.first_name !== undefined) patient.first_name = updates.first_name;
    if (updates.last_name !== undefined) patient.last_name = updates.last_name;
    if (updates.cedula !== undefined) patient.cedula = updates.cedula;
    if (updates.phone !== undefined) patient.phone = updates.phone;
    if (updates.email !== undefined) patient.email = updates.email;
    if (updates.address !== undefined) patient.address = updates.address;
    if (updates.emergency_contact !== undefined) patient.emergency_contact = updates.emergency_contact;

    return { ...patient };
  }

  // ==========================================================================
  // SEC-07: HCU-033 Forms Model & Trigger Simulation
  // ==========================================================================

  /**
   * Simulates INSERT on public.hcu033_forms
   * Trigger: sync_hcu033_form_clinic_id()
   * RLS: "Clinical staff can insert hcu033_forms"
   */
  insertHcu033Form(caller, formData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (!['doctor', 'clinic_owner', 'service_role'].includes(callerRole)) {
      throw new Error('403 Forbidden: Non-clinical staff cannot create HCU-033 medical records');
    }

    // Trigger: Auto-populate clinic_id from patient if omitted
    let effectiveClinicId = formData.clinic_id;
    if (!effectiveClinicId) {
      const patient = this.patients.find((p) => p.id === formData.patient_id);
      if (patient) effectiveClinicId = patient.clinic_id;
    }

    // Trigger: Cross-tenant violation check
    const patientExistsInClinic = this.patients.some(
      (p) => p.id === formData.patient_id && p.clinic_id === effectiveClinicId
    );
    if (!patientExistsInClinic) {
      throw new Error('42501: Cross-tenant violation: Patient does not belong to the specified clinic.');
    }

    // RLS: Caller must belong to the clinic
    if (callerRole !== 'service_role' && effectiveClinicId !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant HCU record creation forbidden');
    }

    const newForm = {
      id: `hcu-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      clinic_id: effectiveClinicId,
      patient_id: formData.patient_id,
      doctor_id: formData.doctor_id || caller.userId,
      diagnosis: formData.diagnosis || [],
      odontogram_data: formData.odontogram_data || {},
      created_at: new Date().toISOString(),
    };

    this.hcu033_forms.push(newForm);
    return newForm;
  }

  /**
   * Simulates DELETE on public.hcu033_forms
   * Policy: "Clinic owners can delete hcu033_forms"
   */
  deleteHcu033Form(caller, formId) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const form = this.hcu033_forms.find((f) => f.id === formId);
    if (!form) {
      throw new Error('404 Not Found: HCU-033 form not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'service_role' && form.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant HCU deletion forbidden');
    }

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can delete HCU-033 forms (statutory retention custody)');
    }

    const idx = this.hcu033_forms.findIndex((f) => f.id === formId);
    this.hcu033_forms.splice(idx, 1);
    return { success: true, deleted_id: formId };
  }

  // ==========================================================================
  // SEC-12: Services Table Multi-Tenant Isolation
  // ==========================================================================

  /**
   * Simulates SELECT from public.services
   * Policy: "Clinic members can view services"
   * USING: clinic_id = JWT.clinic_id
   */
  selectServices(caller, filterClinicId = null) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    // RLS filters strictly by caller's clinic_id regardless of client filter parameter
    return this.services.filter((s) => s.clinic_id === callerClinicId && (!filterClinicId || s.clinic_id === filterClinicId));
  }

  /**
   * Simulates INSERT into public.services
   * Policy: "Clinic owners can insert services"
   * WITH CHECK: clinic_id = JWT.clinic_id AND JWT.role = 'clinic_owner'
   */
  insertService(caller, serviceData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can insert services');
    }

    const targetClinicId = serviceData.clinic_id || callerClinicId;
    if (callerRole !== 'service_role' && targetClinicId !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant service catalog insertion forbidden');
    }

    const newService = {
      id: `srv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      clinic_id: targetClinicId,
      name: serviceData.name,
      price: serviceData.price,
      is_active: serviceData.is_active !== undefined ? serviceData.is_active : true,
    };
    this.services.push(newService);
    return newService;
  }

  /**
   * Simulates UPDATE on public.services
   * Policy: "Clinic owners can update services"
   * USING & WITH CHECK: clinic_id = JWT.clinic_id AND JWT.role = 'clinic_owner'
   */
  updateService(caller, serviceId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const service = this.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error('404 Not Found: Service not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can update services');
    }

    if (callerRole !== 'service_role' && service.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant service catalog modification forbidden');
    }

    if (updates.clinic_id !== undefined && updates.clinic_id !== service.clinic_id) {
      throw new Error('403 Forbidden: Service tenant migration blocked');
    }

    if (updates.name !== undefined) service.name = updates.name;
    if (updates.price !== undefined) service.price = updates.price;
    if (updates.is_active !== undefined) service.is_active = updates.is_active;

    return service;
  }

  /**
   * Simulates DELETE on public.services
   * Policy: "Clinic owners can delete services"
   * USING: clinic_id = JWT.clinic_id AND JWT.role = 'clinic_owner'
   */
  deleteService(caller, serviceId) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const service = this.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error('404 Not Found: Service not found');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can delete services');
    }

    if (callerRole !== 'service_role' && service.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant service catalog deletion forbidden');
    }

    const idx = this.services.findIndex((s) => s.id === serviceId);
    this.services.splice(idx, 1);
    return { success: true, deleted_id: serviceId };
  }

  // ==========================================================================
  // SEC-13: Payment Methods & Public Checkout RPC
  // ==========================================================================

  /**
   * Simulates INSERT into public.payment_methods
   */
  insertPaymentMethod(caller, methodData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can insert payment methods');
    }

    const targetClinicId = methodData.clinic_id || callerClinicId;
    if (callerRole !== 'service_role' && targetClinicId !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant payment method insertion forbidden');
    }

    const newPm = {
      id: `pm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      clinic_id: targetClinicId,
      type: methodData.type || 'BANK_TRANSFER',
      title: methodData.title || '',
      config: methodData.config || {},
      is_active: methodData.is_active !== undefined ? methodData.is_active : true,
    };
    this.payment_methods.push(newPm);
    return newPm;
  }

  /**
   * Simulates DELETE on public.payment_methods
   */
  deletePaymentMethod(caller, methodId) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const method = this.payment_methods.find((pm) => pm.id === methodId);
    if (!method) {
      throw new Error('404 Not Found: Payment method does not exist');
    }

    const callerClinicId = caller.jwt?.app_metadata?.clinic_id || caller.clinicId;
    const callerRole = caller.jwt?.app_metadata?.role || caller.role;

    if (callerRole !== 'clinic_owner' && callerRole !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can delete payment methods');
    }

    if (callerRole !== 'service_role' && method.clinic_id !== callerClinicId) {
      throw new Error('403 Forbidden: Cross-tenant payment method deletion forbidden');
    }

    const idx = this.payment_methods.findIndex((pm) => pm.id === methodId);
    this.payment_methods.splice(idx, 1);
    return { success: true, deleted_id: methodId };
  }

  /**
   * Simulates RPC: public.get_checkout_payment_methods(p_billing_id UUID)
   * SECURITY DEFINER: Scoped strictly to billing.clinic_id
   */
  getCheckoutPaymentMethods(billingId) {
    const bill = this.billings.find((b) => b.id === billingId);
    if (!bill) {
      return []; // Returns empty set when billing record does not exist
    }

    return this.payment_methods.filter(
      (pm) => pm.clinic_id === bill.clinic_id && pm.is_active === true
    );
  }
}

describe('Milestone 2 Challenger Empirical Stress Suite (SEC-07, SEC-12, SEC-13)', () => {
  let harness;

  beforeEach(() => {
    harness = new ChallengerM2SecurityHarness();
  });

  // ==========================================================================
  // SECTION 1: Adversarial Challenge on Prescriptions RLS (SEC-07)
  // ==========================================================================
  describe('SEC-07: Adversarial Attacks on Prescriptions Privilege Separation', () => {
    test('Attack 1.1: Receptionist in Clinic A attempts to insert a prescription', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.insertPrescription(receptionistA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: receptionistA.userId,
            items: [{ medicine: 'Tramadol 50mg', dosage: '1 cada 8h' }],
          });
        },
        /403 Forbidden.*Non-clinical roles \(receptionist\) cannot write prescriptions/i,
        'Receptionist must be rejected from inserting prescriptions'
      );
    });

    test('Attack 1.2: Receptionist in Clinic A attempts to update existing prescription', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updatePrescription(receptionistA, 'rx-a-1', {
            items: [{ medicine: 'Clonazepam 2mg', dosage: '1 diaria' }],
          });
        },
        /403 Forbidden.*Non-clinical roles cannot update prescriptions/i,
        'Receptionist must be rejected from mutating existing prescriptions'
      );
    });

    test('Attack 1.3: Doctor 1 attempts to forge doctor_id of Doctor 2 in same clinic', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertPrescription(doctorA1, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: CLINIC_A_DOCTOR_2_ID, // Spoofing Dr. Carlos Doctor A2
            items: [{ medicine: 'Ibuprofeno 800mg', dosage: 'Cada 8 horas' }],
          });
        },
        /403 Forbidden.*Prescriber doctor_id cannot be spoofed or forged/i,
        'Doctor must be blocked from forging another doctor identity as prescriber'
      );
    });

    test('Attack 1.4: Doctor 1 attempts to forge doctor_id of Clinic Owner', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertPrescription(doctorA1, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: CLINIC_A_OWNER_ID, // Spoofing Clinic Owner
            items: [{ medicine: 'Ketorolaco 10mg', dosage: 'Cada 6 horas' }],
          });
        },
        /403 Forbidden.*Prescriber doctor_id cannot be spoofed or forged/i,
        'Doctor must be blocked from signing prescriptions as Clinic Owner'
      );
    });

    test('Attack 1.5: Doctor 1 attempts to forge doctor_id of Doctor in competitor Clinic B', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertPrescription(doctorA1, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: CLINIC_B_DOCTOR_ID, // Doctor from Clinic B
            items: [{ medicine: 'Amoxicilina + Ácido Clavulánico', dosage: 'Cada 12 horas' }],
          });
        },
        /403 Forbidden.*Prescriber doctor_id cannot be spoofed or forged/i,
        'Doctor must not forge competitor doctor credentials'
      );
    });

    test('Attack 1.6: Doctor 1 attempts cross-clinic prescription creation for Clinic B patient', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertPrescription(doctorA1, {
            clinic_id: TENANT_B_ID, // Target Clinic B
            patient_id: PATIENT_B1_ID,
            doctor_id: doctorA1.userId,
            items: [{ medicine: 'Paracetamol 500mg', dosage: 'Cada 8 horas' }],
          });
        },
        /403 Forbidden.*Cross-tenant prescription insertion forbidden/i,
        'Doctor must be blocked from creating prescriptions in other clinics'
      );
    });

    test('Attack 1.7: Doctor 2 attempts to update prescription authored by Doctor 1', () => {
      const doctorA2 = getSecurityContext('clinic_a_doctor_2');

      // 'rx-a-1' was authored by CLINIC_A_DOCTOR_ID
      assert.throws(
        () => {
          harness.updatePrescription(doctorA2, 'rx-a-1', {
            instructions: 'Modificación no autorizada por otro médico',
          });
        },
        /403 Forbidden.*Doctors cannot modify prescriptions authored by other doctors/i,
        'Doctor 2 must not be allowed to modify Doctor 1 prescriptions'
      );
    });

    test('Attack 1.8: Prescribing Doctor legitimately updates own prescription', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      const updated = harness.updatePrescription(doctorA1, 'rx-a-1', {
        instructions: 'Tomar con abundante agua después de las comidas',
      });

      assert.equal(updated.instructions, 'Tomar con abundante agua después de las comidas');
      assert.equal(updated.doctor_id, CLINIC_A_DOCTOR_ID);
    });

    test('Attack 1.9: Clinic Owner legitimately updates prescription in own clinic', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      const updated = harness.updatePrescription(ownerA, 'rx-a-1', {
        instructions: 'Revisión por dirección clínica de la clínica',
      });

      assert.equal(updated.instructions, 'Revisión por dirección clínica de la clínica');
    });

    test('Attack 1.10: Prescribing Doctor attempts to change doctor_id on existing prescription', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.updatePrescription(doctorA1, 'rx-a-1', {
            doctor_id: CLINIC_A_DOCTOR_2_ID,
          });
        },
        /403 Forbidden.*Cannot alter prescriber doctor_id attribution/i,
        'Doctor must not be able to reassign prescription authorship'
      );
    });

    test('Attack 1.11: Prescribing Doctor attempts cross-tenant partition migration on prescription', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.updatePrescription(doctorA1, 'rx-a-1', {
            clinic_id: TENANT_B_ID,
          });
        },
        /403 Forbidden.*Cross-tenant prescription partition migration blocked/i,
        'Prescription clinic_id must be immutable against tenant hopping'
      );
    });

    test('Attack 1.12: Doctor 1 attempts to DELETE prescription (statutory retention lock)', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.deletePrescription(doctorA1, 'rx-a-1');
        },
        /403 Forbidden.*Only clinic_owner can delete prescriptions/i,
        'Statutory retention custody: non-owner doctors cannot delete prescriptions'
      );
    });

    test('Attack 1.13: Receptionist attempts to DELETE prescription', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.deletePrescription(receptionistA, 'rx-a-1');
        },
        /403 Forbidden.*Only clinic_owner can delete prescriptions/i,
        'Receptionist must be rejected from deleting medical prescriptions'
      );
    });

    test('Attack 1.14: Owner of Clinic A attempts to modify or delete prescription in Clinic B', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // Create dummy prescription in Clinic B
      const doctorB = getSecurityContext('clinic_b_doctor');
      const rxB = harness.insertPrescription(doctorB, {
        clinic_id: TENANT_B_ID,
        patient_id: PATIENT_B1_ID,
        doctor_id: doctorB.userId,
        items: [{ medicine: 'Azitromicina 500mg', dosage: '1 diaria' }],
      });

      // Owner A attempts update on Clinic B prescription
      assert.throws(
        () => {
          harness.updatePrescription(ownerA, rxB.id, { instructions: 'Tampered by Owner A' });
        },
        /403 Forbidden.*Cross-tenant prescription modification forbidden/i,
        'Owner A must not be allowed to modify Clinic B prescriptions'
      );

      // Owner A attempts delete on Clinic B prescription
      assert.throws(
        () => {
          harness.deletePrescription(ownerA, rxB.id);
        },
        /403 Forbidden.*Cross-tenant prescription deletion forbidden/i,
        'Owner A must not be allowed to delete Clinic B prescriptions'
      );
    });

    test('Attack 1.15: Unauthenticated caller cannot execute prescription operations', () => {
      assert.throws(() => harness.insertPrescription(null, {}), /401 Unauthorized/i);
      assert.throws(() => harness.updatePrescription(null, 'rx-a-1', {}), /401 Unauthorized/i);
      assert.throws(() => harness.deletePrescription(null, 'rx-a-1'), /401 Unauthorized/i);
    });
  });

  // ==========================================================================
  // SECTION 2: Adversarial Attacks on Patient Clinical Diagnoses & Odontogram (SEC-07)
  // ==========================================================================
  describe('SEC-07: Adversarial Attacks on Odontogram & Clinical Columns (Column-Level RBAC)', () => {
    test('Attack 2.1: Receptionist administrative intake update succeeds (positive control)', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      const updated = harness.updatePatient(receptionistA, PATIENT_A1_ID, {
        first_name: 'Juan Carlos',
        phone: '+593987654321',
        email: 'juancarlos@example.com',
        address: 'Av. Amazonas y Naciones Unidas, Quito',
        emergency_contact: { name: 'Rosa Pérez', phone: '+593981112222', relation: 'Madre' },
      });

      assert.equal(updated.first_name, 'Juan Carlos');
      assert.equal(updated.phone, '+593987654321');
      assert.equal(updated.email, 'juancarlos@example.com');
      assert.equal(updated.address, 'Av. Amazonas y Naciones Unidas, Quito');
    });

    test('Attack 2.2: Receptionist attempts to tamper with odontogram_state', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updatePatient(receptionistA, PATIENT_A1_ID, {
            odontogram_state: { 18: { top: 'red', description: 'Caries oclusal' } },
          });
        },
        /42501.*Unauthorized clinical mutation.*cannot modify clinical diagnoses, dental charting, or medical history/i,
        'Receptionist must be blocked from altering odontogram dental charting'
      );
    });

    test('Attack 2.3: Receptionist attempts to tamper with periodontogram_state', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updatePatient(receptionistA, PATIENT_A1_ID, {
            periodontogram_state: { 11: { probing_depth: [4, 5, 4], bleeding: true } },
          });
        },
        /42501.*Unauthorized clinical mutation/i,
        'Receptionist must be blocked from modifying periodontogram depth readings'
      );
    });

    test('Attack 2.4: Receptionist attempts to tamper with medical_history', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updatePatient(receptionistA, PATIENT_A1_ID, {
            medical_history: 'Paciente presenta antecedentes de endocarditis bacteriana.',
          });
        },
        /42501.*Unauthorized clinical mutation/i,
        'Receptionist must be blocked from altering medical history records'
      );
    });

    test('Attack 2.5: Receptionist attempts to tamper with clinical_notes', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updatePatient(receptionistA, PATIENT_A1_ID, {
            clinical_notes: 'Falsificación de evolución clínica.',
          });
        },
        /42501.*Unauthorized clinical mutation/i,
        'Receptionist must be blocked from modifying clinical progress notes'
      );
    });

    test('Attack 2.6: Receptionist attempts to alter allergies and systemic health flags', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      const systemicAttacks = [
        { allergies: ['Penicilina', 'Látex'] },
        { medications: ['Metformina 850mg'] },
        { medical_conditions: ['Hipertensión arterial estadio 2'] },
        { blood_type: 'AB-' },
        { has_diabetes: true },
        { has_hypertension: true },
        { has_heart_disease: true },
        { is_smoker: true },
        { is_pregnant: true },
      ];

      for (const attackPayload of systemicAttacks) {
        const fieldName = Object.keys(attackPayload)[0];
        assert.throws(
          () => {
            harness.updatePatient(receptionistA, PATIENT_A1_ID, attackPayload);
          },
          /42501.*Unauthorized clinical mutation/i,
          `Receptionist must be blocked from altering systemic clinical field: ${fieldName}`
        );
      }
    });

    test('Attack 2.7: Receptionist attempts synthetic charting injection during patient registration (guard_patient_clinical_insert)', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      // Attempt non-empty odontogram_state on patient creation
      assert.throws(
        () => {
          harness.insertPatient(receptionistA, {
            clinic_id: TENANT_A_ID,
            first_name: 'Paciente',
            last_name: 'Falso',
            odontogram_state: { 21: { center: 'blue' } },
          });
        },
        /42501.*Unauthorized clinical intake: Non-clinical staff cannot initialize dental charting state/i,
        'Receptionist must not inject pre-filled dental charting during intake'
      );

      // Attempt non-empty periodontogram_state on patient creation
      assert.throws(
        () => {
          harness.insertPatient(receptionistA, {
            clinic_id: TENANT_A_ID,
            first_name: 'Paciente',
            last_name: 'Falso 2',
            periodontogram_state: { 31: { furcation: 2 } },
          });
        },
        /42501.*Unauthorized clinical intake: Non-clinical staff cannot initialize dental charting state/i,
        'Receptionist must not inject pre-filled periodontogram data during intake'
      );
    });

    test('Attack 2.8: Receptionist legitimate patient intake with empty charting succeeds', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      const created = harness.insertPatient(receptionistA, {
        clinic_id: TENANT_A_ID,
        first_name: 'Pedro',
        last_name: 'García',
        cedula: '1710998877',
        phone: '+593981234567',
        email: 'pedro.garcia@example.com',
        odontogram_state: null,
        periodontogram_state: null,
      });

      assert.ok(created.id, 'Patient intake created successfully');
      assert.equal(created.first_name, 'Pedro');
      assert.equal(created.clinic_id, TENANT_A_ID);
    });

    test('Attack 2.9: Attacker attempts to mutate patient clinic_id (tenant hijacking)', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      const doctorA = getSecurityContext('clinic_a_doctor');

      // Receptionist attempt
      assert.throws(
        () => {
          harness.updatePatient(receptionistA, PATIENT_A1_ID, { clinic_id: TENANT_B_ID });
        },
        /42501.*clinic_id cannot be modified/i,
        'Receptionist cannot mutate patient clinic_id'
      );

      // Doctor attempt
      assert.throws(
        () => {
          harness.updatePatient(doctorA, PATIENT_A1_ID, { clinic_id: TENANT_B_ID });
        },
        /42501.*clinic_id cannot be modified/i,
        'Doctor cannot mutate patient clinic_id to hijack patient to another tenant'
      );
    });

    test('Attack 2.10: Doctor legitimately updates clinical charting and systemic flags', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      const updated = harness.updatePatient(doctorA, PATIENT_A1_ID, {
        odontogram_state: {
          11: { center: { status: 'caries', color: '#ef4444' } },
          21: { center: { status: 'restored', color: '#2563eb' } },
        },
        medical_history: 'Alergia confirmada a la Penicilina en prueba intradérmica.',
        allergies: ['Penicilina G'],
        blood_type: 'A+',
        has_hypertension: true,
      });

      assert.ok(updated.odontogram_state['11']);
      assert.equal(updated.odontogram_state['11'].center.status, 'caries');
      assert.equal(updated.allergies[0], 'Penicilina G');
      assert.equal(updated.has_hypertension, true);
    });

    test('Attack 2.11: Doctor in Clinic A attempts cross-tenant update on Clinic B patient', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.updatePatient(doctorA, PATIENT_B1_ID, {
            clinical_notes: 'Modificación ilegítima de paciente de otra clínica',
          });
        },
        /403 Forbidden.*Cross-tenant patient update forbidden/i,
        'Cross-tenant patient modification must be rejected by RLS'
      );
    });
  });

  // ==========================================================================
  // SECTION 3: Adversarial Attacks on HCU-033 Forms & Statutory Custody (SEC-07)
  // ==========================================================================
  describe('SEC-07: Adversarial Attacks on HCU-033 Forms (MSP Statutory Records)', () => {
    test('Attack 3.1: Receptionist attempts to insert HCU-033 medical form', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.insertHcu033Form(receptionistA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            diagnosis: [{ code: 'K02.0', description: 'Caries limitada al esmalte' }],
          });
        },
        /403 Forbidden.*Non-clinical staff cannot create HCU-033/i,
        'Receptionist must not create official MSP Formulario 033 records'
      );
    });

    test('Attack 3.2: Receptionist attempts to update HCU-033 medical form', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          harness.updateHcu033Form(receptionistA, 'hcu-a-1', {
            diagnosis: [{ code: 'K05.0', description: 'Gingivitis aguda' }],
          });
        },
        /403 Forbidden.*Non-clinical staff cannot alter HCU-033/i,
        'Receptionist must not alter HCU-033 clinical diagnoses'
      );
    });

    test('Attack 3.3: Doctor in Clinic A attempts to insert HCU-033 for Clinic B patient (cross-tenant violation trigger)', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertHcu033Form(doctorA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_B1_ID, // Patient belongs to Clinic B
            diagnosis: [{ code: 'K04.0', description: 'Pulpitis reversible' }],
          });
        },
        /42501.*Cross-tenant violation: Patient does not belong to the specified clinic/i,
        'Trigger must block inserting HCU record referencing a foreign clinic patient'
      );
    });

    test('Attack 3.4: Doctor in Clinic A attempts to create HCU form targeting Clinic B', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertHcu033Form(doctorA, {
            clinic_id: TENANT_B_ID,
            patient_id: PATIENT_A1_ID,
            diagnosis: [{ code: 'K04.1', description: 'Necrosis pulpar' }],
          });
        },
        /42501.*Cross-tenant violation: Patient does not belong to the specified clinic/i,
        'Mismatched clinic_id and patient_id must trigger cross-tenant violation'
      );
    });

    test('Attack 3.5: Doctor 1 attempts to DELETE HCU-033 form (statutory retention custody)', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.deleteHcu033Form(doctorA, 'hcu-a-1');
        },
        /403 Forbidden.*Only clinic_owner can delete HCU-033 forms/i,
        'Doctors must not delete official MSP Formulario 033 records (custody lock)'
      );
    });

    test('Attack 3.6: Clinic Owner legitimately deletes HCU-033 form in own clinic', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      const result = harness.deleteHcu033Form(ownerA, 'hcu-a-1');
      assert.equal(result.success, true);
      assert.equal(result.deleted_id, 'hcu-a-1');
    });

    test('Attack 3.7: Clinic Owner in Clinic A attempts to delete HCU-033 form in Clinic B', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const doctorB = getSecurityContext('clinic_b_doctor');

      // Create HCU record in Clinic B
      const hcuB = harness.insertHcu033Form(doctorB, {
        clinic_id: TENANT_B_ID,
        patient_id: PATIENT_B1_ID,
        diagnosis: [{ code: 'K05.1', description: 'Gingivitis crónica' }],
      });

      assert.throws(
        () => {
          harness.deleteHcu033Form(ownerA, hcuB.id);
        },
        /403 Forbidden.*Cross-tenant HCU deletion forbidden/i,
        'Owner A must not delete Clinic B HCU forms'
      );
    });
  });

  // ==========================================================================
  // SECTION 4: Adversarial Attacks on Services Catalog Isolation (SEC-12)
  // ==========================================================================
  describe('SEC-12: Adversarial Attacks on Services Catalog Multi-Tenant Isolation', () => {
    test('Attack 4.1: Owner of Clinic A attempts cross-tenant INSERT into Clinic B catalog', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          harness.insertService(ownerA, {
            clinic_id: TENANT_B_ID, // Target competitor Clinic B
            name: 'Servicio Inyectado Malicioso',
            price: 1.0,
          });
        },
        /403 Forbidden.*Cross-tenant service catalog insertion forbidden/i,
        'Owner A must be blocked from injecting services into Clinic B'
      );
    });

    test('Attack 4.2: Owner of Clinic A attempts cross-tenant UPDATE on Clinic B service', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // 'srv-b-1' belongs to Clinic B
      assert.throws(
        () => {
          harness.updateService(ownerA, 'srv-b-1', {
            price: 9999.0, // Sabotage competitor pricing
            is_active: false,
          });
        },
        /403 Forbidden.*Cross-tenant service catalog modification forbidden/i,
        'Owner A must be blocked from mutating Clinic B service prices'
      );
    });

    test('Attack 4.3: Owner of Clinic A attempts cross-tenant DELETE on Clinic B service', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          harness.deleteService(ownerA, 'srv-b-1');
        },
        /403 Forbidden.*Cross-tenant service catalog deletion forbidden/i,
        'Owner A must be blocked from deleting Clinic B catalog offerings'
      );
    });

    test('Attack 4.4: Owner of Clinic A queries services (zero cross-tenant leakage)', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // Even if attacker requests services for Clinic B, RLS returns only Clinic A
      const services = harness.selectServices(ownerA, TENANT_B_ID);
      assert.equal(services.length, 0, 'Must return 0 rows for foreign clinic ID query');

      const ownServices = harness.selectServices(ownerA);
      assert.ok(ownServices.length > 0, 'Can view own clinic services');
      assert.ok(ownServices.every((s) => s.clinic_id === TENANT_A_ID), 'All returned services belong to Tenant A');
    });

    test('Attack 4.5: Doctor attempts to INSERT service (role authorization check)', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.insertService(doctorA, {
            clinic_id: TENANT_A_ID,
            name: 'Cirugía de Terceros Molares',
            price: 150.0,
          });
        },
        /403 Forbidden.*Only clinic_owner can insert services/i,
        'Doctor must not be allowed to insert services (restricted to clinic_owner)'
      );
    });

    test('Attack 4.6: Doctor attempts to UPDATE service price', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          harness.updateService(doctorA, 'srv-a-1', { price: 10.0 });
        },
        /403 Forbidden.*Only clinic_owner can update services/i,
        'Doctor must not be allowed to alter treatment prices'
      );
    });

    test('Attack 4.7: Receptionist attempts to INSERT, UPDATE, or DELETE services', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(() => harness.insertService(receptionistA, { name: 'X', price: 20 }), /403 Forbidden/i);
      assert.throws(() => harness.updateService(receptionistA, 'srv-a-1', { price: 20 }), /403 Forbidden/i);
      assert.throws(() => harness.deleteService(receptionistA, 'srv-a-1'), /403 Forbidden/i);
    });

    test('Attack 4.8: Owner of Clinic A legitimately manages own service catalog', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // 1. Insert
      const newSrv = harness.insertService(ownerA, {
        name: 'Endodoncia Unirradicular',
        price: 90.0,
      });
      assert.equal(newSrv.clinic_id, TENANT_A_ID);
      assert.equal(newSrv.price, 90.0);

      // 2. Update
      const updatedSrv = harness.updateService(ownerA, newSrv.id, { price: 95.0 });
      assert.equal(updatedSrv.price, 95.0);

      // 3. Delete
      const delResult = harness.deleteService(ownerA, newSrv.id);
      assert.equal(delResult.success, true);
    });

    test('Attack 4.9: Owner of Clinic A inserts service with omitted clinic_id (defaults safely)', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      const srv = harness.insertService(ownerA, {
        name: 'Profilaxis Básica',
        price: 30.0,
      });

      assert.equal(srv.clinic_id, TENANT_A_ID, 'Omitted clinic_id must default to caller clinic_id');
    });

    test('Attack 4.10: Owner of Clinic A attempts service tenant migration on update', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          harness.updateService(ownerA, 'srv-a-1', {
            clinic_id: TENANT_B_ID,
          });
        },
        /403 Forbidden.*Service tenant migration blocked/i,
        'Cannot reassign service record to another clinic'
      );
    });
  });

  // ==========================================================================
  // SECTION 5: Adversarial Attacks on Payment Methods & Checkout (SEC-13)
  // ==========================================================================
  describe('SEC-13: Adversarial Attacks on Bank Payment Methods & Checkout Partition', () => {
    test('Attack 5.1: Owner of Clinic A attempts to INSERT payment method in Clinic B (account hijacking)', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          harness.insertPaymentMethod(ownerA, {
            clinic_id: TENANT_B_ID,
            type: 'BANK_TRANSFER',
            title: 'Cuenta Hijacked en Beta',
            config: { account_number: '9999999999', holder_name: 'Dr. Hacker' },
          });
        },
        /403 Forbidden.*Cross-tenant payment method insertion forbidden/i,
        'Owner A must not insert payment destination accounts into Clinic B'
      );
    });

    test('Attack 5.2: Owner of Clinic A attempts to UPDATE Clinic B payment method', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // 'pm-b-1' belongs to Clinic B
      assert.throws(
        () => {
          harness.updatePaymentMethod(ownerA, 'pm-b-1', {
            config: { account_number: '9999999999', holder_name: 'Cuenta Maliciosa' },
          });
        },
        /403 Forbidden.*Cross-tenant payment method update forbidden/i,
        'Owner A must not modify Clinic B bank account destination details'
      );
    });

    test('Attack 5.3: Owner of Clinic A attempts to DELETE Clinic B payment method', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          harness.deletePaymentMethod(ownerA, 'pm-b-1');
        },
        /403 Forbidden.*Cross-tenant payment method deletion forbidden/i,
        'Owner A must not delete Clinic B payment methods'
      );
    });

    test('Attack 5.4: Non-owner (Doctor or Receptionist) attempts to manage payment methods', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const receptionistA = getSecurityContext('clinic_a_receptionist');

      assert.throws(() => harness.insertPaymentMethod(doctorA, { title: 'Banco Doc' }), /403 Forbidden/i);
      assert.throws(() => harness.updatePaymentMethod(doctorA, 'pm-a-1', { is_active: false }), /403 Forbidden/i);
      assert.throws(() => harness.deletePaymentMethod(doctorA, 'pm-a-1'), /403 Forbidden/i);

      assert.throws(() => harness.insertPaymentMethod(receptionistA, { title: 'Banco Recep' }), /403 Forbidden/i);
      assert.throws(() => harness.updatePaymentMethod(receptionistA, 'pm-a-1', { is_active: false }), /403 Forbidden/i);
      assert.throws(() => harness.deletePaymentMethod(receptionistA, 'pm-a-1'), /403 Forbidden/i);
    });

    test('Attack 5.5: Public Checkout RPC get_checkout_payment_methods scopes strictly to invoice clinic', () => {
      // bill-a-1 belongs to Clinic A
      const methodsA = harness.getCheckoutPaymentMethods('bill-a-1');
      assert.ok(methodsA.length > 0, 'Returns payment methods for Clinic A invoice');
      assert.ok(methodsA.every((m) => m.clinic_id === TENANT_A_ID), 'All methods belong strictly to Clinic A');
      assert.ok(methodsA.every((m) => m.is_active === true), 'Only active methods are returned');

      // bill-b-1 belongs to Clinic B
      const methodsB = harness.getCheckoutPaymentMethods('bill-b-1');
      assert.ok(methodsB.length > 0, 'Returns payment methods for Clinic B invoice');
      assert.ok(methodsB.every((m) => m.clinic_id === TENANT_B_ID), 'All methods belong strictly to Clinic B');
      assert.ok(methodsB.every((m) => m.is_active === true), 'Only active methods are returned');
      assert.ok(!methodsB.some((m) => m.clinic_id === TENANT_A_ID), 'Zero leakage of Clinic A bank accounts to Clinic B checkout');
    });

    test('Attack 5.6: Public Checkout RPC fails closed on invalid or non-existent billing ID', () => {
      const invalidMethods = harness.getCheckoutPaymentMethods('00000000-0000-0000-0000-000000000000');
      assert.equal(invalidMethods.length, 0, 'Non-existent invoice returns 0 payment methods');
    });
  });

  // ==========================================================================
  // SECTION 6: Static Invariant & AST Verification (SQL Migration & Frontend)
  // ==========================================================================
  describe('Static AST & Invariant Verification: M2 Migration & Application Code', () => {
    test('AST 6.1: Migration file exists and executes in single transaction', () => {
      assert.ok(existsSync(MIGRATION_M2_FILE), 'Migration file must exist');
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      assert.ok(sql.includes('BEGIN;'), 'Migration must contain transaction BEGIN;');
      assert.ok(sql.trim().endsWith('COMMIT;'), 'Migration must end with COMMIT;');
    });

    test('AST 6.2: SEC-07 Prescriptions RLS policies and anti-spoofing constraints', () => {
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      // Must drop legacy policies
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Prescriptions are insertable by clinic members"'),
        'Must drop legacy permissive insert policy'
      );
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Prescriptions are updatable by clinic members"'),
        'Must drop legacy permissive update policy'
      );

      // INSERT check: doctor_id = auth.uid()
      assert.ok(
        sql.includes('doctor_id = auth.uid()'),
        'Prescriptions INSERT policy must enforce doctor_id = auth.uid()'
      );

      // INSERT check: clinical roles
      assert.ok(
        sql.includes("(auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'clinic_owner')"),
        'Prescriptions INSERT policy must restrict to doctor and clinic_owner'
      );

      // DELETE check: clinic_owner only
      assert.ok(
        sql.includes("(auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'"),
        'Prescriptions DELETE policy must require clinic_owner'
      );
    });

    test('AST 6.3: SEC-07 Column-level trigger enforce_patient_clinical_privileges invariants', () => {
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      assert.ok(
        sql.includes('FUNCTION public.enforce_patient_clinical_privileges()'),
        'Must define enforce_patient_clinical_privileges trigger function'
      );

      // Partition key protection
      assert.ok(
        sql.includes('NEW.clinic_id IS DISTINCT FROM OLD.clinic_id'),
        'Trigger must block clinic_id modification'
      );

      // Error code 42501
      assert.ok(
        sql.includes("USING ERRCODE = '42501'"),
        'Trigger must raise 42501 authorization exception'
      );

      // All 13 protected clinical columns checked
      const requiredColumns = [
        'NEW.odontogram_state IS DISTINCT FROM OLD.odontogram_state',
        'NEW.periodontogram_state IS DISTINCT FROM OLD.periodontogram_state',
        'NEW.medical_history IS DISTINCT FROM OLD.medical_history',
        'NEW.clinical_notes IS DISTINCT FROM OLD.clinical_notes',
        'NEW.allergies IS DISTINCT FROM OLD.allergies',
        'NEW.medications IS DISTINCT FROM OLD.medications',
        'NEW.medical_conditions IS DISTINCT FROM OLD.medical_conditions',
        'NEW.blood_type IS DISTINCT FROM OLD.blood_type',
        'NEW.has_diabetes IS DISTINCT FROM OLD.has_diabetes',
        'NEW.has_hypertension IS DISTINCT FROM OLD.has_hypertension',
        'NEW.has_heart_disease IS DISTINCT FROM OLD.has_heart_disease',
        'NEW.is_smoker IS DISTINCT FROM OLD.is_smoker',
        'NEW.is_pregnant IS DISTINCT FROM OLD.is_pregnant',
      ];

      for (const colCheck of requiredColumns) {
        assert.ok(sql.includes(colCheck), `Trigger must check column: ${colCheck}`);
      }

      // Initial intake guard trigger
      assert.ok(
        sql.includes('FUNCTION public.guard_patient_clinical_insert()'),
        'Must define guard_patient_clinical_insert trigger function'
      );
    });

    test('AST 6.4: SEC-07 HCU-033 schema hardening and cross-tenant trigger', () => {
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      assert.ok(
        sql.includes('ALTER TABLE public.hcu033_forms'),
        'Must alter hcu033_forms table'
      );
      assert.ok(
        sql.includes('ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id)'),
        'Must add clinic_id column to hcu033_forms'
      );
      assert.ok(
        sql.includes('FUNCTION public.sync_hcu033_form_clinic_id()'),
        'Must define sync_hcu033_form_clinic_id trigger function'
      );
      assert.ok(
        sql.includes('Cross-tenant violation: Patient does not belong to the specified clinic.'),
        'Trigger must verify patient belongs to specified clinic'
      );
    });

    test('AST 6.5: SEC-12 Services catalog strict isolation and dropped admin policies', () => {
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      // Dropped vulnerable admin policies
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Admins can insert services." ON public.services;'),
        'Must drop vulnerable global admin insert policy'
      );
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Admins can update services." ON public.services;'),
        'Must drop vulnerable global admin update policy'
      );
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Admins can delete services." ON public.services;'),
        'Must drop vulnerable global admin delete policy'
      );

      // Scoped owner policies
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can insert services"'),
        'Must create scoped insert policy'
      );
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can update services"'),
        'Must create scoped update policy'
      );
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can delete services"'),
        'Must create scoped delete policy'
      );
    });

    test('AST 6.6: SEC-13 Payment methods partition and checkout RPC', () => {
      const sql = readFileSync(MIGRATION_M2_FILE, 'utf8');

      assert.ok(
        sql.includes('ALTER TABLE public.payment_methods'),
        'Must alter payment_methods'
      );
      assert.ok(
        sql.includes('ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id)'),
        'Must add clinic_id column to payment_methods'
      );
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Authenticated users can manage payment methods"'),
        'Must drop permissive global policy'
      );
      assert.ok(
        sql.includes('FUNCTION public.get_checkout_payment_methods(p_billing_id UUID)'),
        'Must define get_checkout_payment_methods RPC'
      );
      assert.ok(
        sql.includes('REVOKE ALL ON FUNCTION public.get_checkout_payment_methods(UUID) FROM PUBLIC;'),
        'Must revoke RPC execution from PUBLIC'
      );
      assert.ok(
        sql.includes('GRANT EXECUTE ON FUNCTION public.get_checkout_payment_methods(UUID) TO authenticated, anon;'),
        'Must grant checkout RPC to authenticated and anon'
      );
    });

    test('AST 6.7: Frontend components verify clinic_id scoping and RBAC controls', () => {
      // 1. PaymentMethodsSettings
      assert.ok(existsSync(PAYMENT_SETTINGS_FILE));
      const pmSource = readFileSync(PAYMENT_SETTINGS_FILE, 'utf8');
      assert.ok(pmSource.includes('hasRole("clinic_owner")'), 'Component must check clinic_owner role');
      assert.ok(pmSource.includes(".eq('clinic_id', currentClinicId)"), 'Queries must be filtered by currentClinicId');
      assert.ok(pmSource.includes('clinic_id: currentClinicId'), 'Insertions must pass currentClinicId');

      // 2. Checkout page
      assert.ok(existsSync(PAY_PAGE_FILE));
      const paySource = readFileSync(PAY_PAGE_FILE, 'utf8');
      assert.ok(
        paySource.includes("supabase.rpc('get_checkout_payment_methods', { p_billing_id: id })"),
        'Checkout page must call get_checkout_payment_methods RPC'
      );
      assert.ok(
        paySource.includes(".eq('clinic_id', bill.clinic_id)"),
        'Fallback query must filter strictly by bill.clinic_id'
      );

      // 3. Types
      assert.ok(existsSync(TYPES_FILE));
      const typesSource = readFileSync(TYPES_FILE, 'utf8');
      assert.ok(
        typesSource.includes('clinic_id: string'),
        'PaymentMethod interface must contain clinic_id: string'
      );
    });
  });
});
