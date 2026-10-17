/**
 * Database Security Engine & RLS Simulator
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Specifications:
 * - ORIGINAL_REQUEST.md
 * - PROJECT.md (Interface Contracts § SEC-01 to SEC-13, R4)
 */

const crypto = require('node:crypto');
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
} = require('./security-context.cjs');

class DatabaseSecurityEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.clinics = [
      {
        id: TENANT_A_ID,
        name: 'Clínica Dental Alfa',
        subscription_tier: 'pro',
        subscription_status: 'active',
        owner_id: CLINIC_A_OWNER_ID,
        archived_at: null,
      },
      {
        id: TENANT_B_ID,
        name: 'Clínica Dental Beta',
        subscription_tier: 'free',
        subscription_status: 'active',
        owner_id: CLINIC_B_OWNER_ID,
        archived_at: null,
      },
    ];

    this.profiles = [
      {
        id: CLINIC_A_OWNER_ID,
        full_name: 'Dr. Alejandro Propietario A',
        phone: '+593991111111',
        avatar_url: 'https://example.com/avatar1.png',
        role: 'clinic_owner',
        clinic_id: TENANT_A_ID,
        status: 'active',
        specialization: 'Implantología',
      },
      {
        id: CLINIC_A_DOCTOR_ID,
        full_name: 'Dra. Beatriz Doctora A',
        phone: '+593992222222',
        avatar_url: null,
        role: 'doctor',
        clinic_id: TENANT_A_ID,
        status: 'active',
        specialization: 'Odontología General',
        license_number: 'SENESCYT-100234',
      },
      {
        id: CLINIC_A_DOCTOR_2_ID,
        full_name: 'Dr. Carlos Doctor A2',
        phone: '+593993333333',
        avatar_url: null,
        role: 'doctor',
        clinic_id: TENANT_A_ID,
        status: 'active',
        specialization: 'Ortodoncia',
        license_number: 'SENESCYT-100567',
      },
      {
        id: CLINIC_A_RECEPTIONIST_ID,
        full_name: 'Diana Recepcionista A',
        phone: '+593994444444',
        avatar_url: null,
        role: 'receptionist',
        clinic_id: TENANT_A_ID,
        status: 'active',
      },
      {
        id: CLINIC_B_OWNER_ID,
        full_name: 'Dr. Bruno Propietario B',
        phone: '+593995555555',
        avatar_url: null,
        role: 'clinic_owner',
        clinic_id: TENANT_B_ID,
        status: 'active',
      },
      {
        id: CLINIC_B_DOCTOR_ID,
        full_name: 'Dr. Bernardo Doctor B',
        phone: '+593996666666',
        avatar_url: null,
        role: 'doctor',
        clinic_id: TENANT_B_ID,
        status: 'active',
        specialization: 'Periodoncia',
      },
      {
        id: CLINIC_B_RECEPTIONIST_ID,
        full_name: 'Doris Recepcionista B',
        phone: '+593997777777',
        avatar_url: null,
        role: 'receptionist',
        clinic_id: TENANT_B_ID,
        status: 'active',
      },
    ];

    this.clinic_members = [
      { id: 'cm-a-1', user_id: CLINIC_A_OWNER_ID, clinic_id: TENANT_A_ID, role: 'clinic_owner', status: 'active' },
      { id: 'cm-a-2', user_id: CLINIC_A_DOCTOR_ID, clinic_id: TENANT_A_ID, role: 'doctor', status: 'active' },
      { id: 'cm-a-3', user_id: CLINIC_A_DOCTOR_2_ID, clinic_id: TENANT_A_ID, role: 'doctor', status: 'active' },
      { id: 'cm-a-4', user_id: CLINIC_A_RECEPTIONIST_ID, clinic_id: TENANT_A_ID, role: 'receptionist', status: 'active' },
      { id: 'cm-b-1', user_id: CLINIC_B_OWNER_ID, clinic_id: TENANT_B_ID, role: 'clinic_owner', status: 'active' },
      { id: 'cm-b-2', user_id: CLINIC_B_DOCTOR_ID, clinic_id: TENANT_B_ID, role: 'doctor', status: 'active' },
      { id: 'cm-b-3', user_id: CLINIC_B_RECEPTIONIST_ID, clinic_id: TENANT_B_ID, role: 'receptionist', status: 'active' },
    ];

    this.patients = [
      {
        id: PATIENT_A1_ID,
        clinic_id: TENANT_A_ID,
        first_name: 'Juan',
        last_name: 'Pérez',
        cedula: '1710000001',
        email: 'juan.perez@example.com',
        phone: '+593980000001',
        deleted_at: null,
      },
      {
        id: PATIENT_A2_ID,
        clinic_id: TENANT_A_ID,
        first_name: 'María',
        last_name: 'López',
        cedula: '1710000002',
        email: 'maria.lopez@example.com',
        phone: '+593980000002',
        deleted_at: null,
      },
      {
        id: PATIENT_B1_ID,
        clinic_id: TENANT_B_ID,
        first_name: 'Roberto',
        last_name: 'Gómez',
        cedula: '1720000001',
        email: 'roberto.gomez@example.com',
        phone: '+593980000003',
        deleted_at: null,
      },
    ];

    this.prescriptions = [
      {
        id: 'rx-a-1',
        clinic_id: TENANT_A_ID,
        patient_id: PATIENT_A1_ID,
        doctor_id: CLINIC_A_DOCTOR_ID,
        items: [{ medicine: 'Amoxicilina 500mg', dosage: 'Cada 8 horas por 7 días' }],
        created_at: '2026-09-01T10:00:00Z',
      },
    ];

    this.hcu033_forms = [
      {
        id: 'hcu-a-1',
        clinic_id: TENANT_A_ID,
        patient_id: PATIENT_A1_ID,
        doctor_id: CLINIC_A_DOCTOR_ID,
        diagnosis: [{ code: 'K02.1', description: 'Caries de la dentina', type: 'Definitivo' }],
        odontogram_data: { 18: { top: 'red' } },
        created_at: '2026-09-01T10:00:00Z',
      },
    ];

    this.services = [
      { id: 'srv-a-1', clinic_id: TENANT_A_ID, name: 'Limpieza Dental Ultrasonido', price: 45.0, is_active: true },
      { id: 'srv-a-2', clinic_id: TENANT_A_ID, name: 'Restauración Resina Simple', price: 60.0, is_active: true },
      { id: 'srv-b-1', clinic_id: TENANT_B_ID, name: 'Extracción Simple', price: 50.0, is_active: true },
    ];

    this.payment_methods = [
      {
        id: 'pm-a-1',
        clinic_id: TENANT_A_ID,
        type: 'BANK_TRANSFER',
        title: 'Banco Pichincha - Ahorros',
        config: { account_number: '2200112233', holder_name: 'Clínica Alfa Cía Ltda', holder_id: '1790000000001' },
        is_active: true,
      },
      {
        id: 'pm-b-1',
        clinic_id: TENANT_B_ID,
        type: 'BANK_TRANSFER',
        title: 'Banco Guayaquil - Corriente',
        config: { account_number: '1100998877', holder_name: 'Clínica Beta S.A.', holder_id: '1791111111001' },
        is_active: true,
      },
    ];

    this.billings = [
      { id: 'bill-a-1', clinic_id: TENANT_A_ID, amount: 120.0, created_at: '2026-09-10T15:00:00Z' },
      { id: 'bill-a-2', clinic_id: TENANT_A_ID, amount: 250.0, created_at: '2026-09-12T16:00:00Z' },
      { id: 'bill-b-1', clinic_id: TENANT_B_ID, amount: 500.0, created_at: '2026-09-11T12:00:00Z' },
    ];

    this.storage_objects = [
      {
        bucket_id: 'patient-files',
        name: `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`,
        size: 1048576,
        owner: CLINIC_A_DOCTOR_ID,
      },
      {
        bucket_id: 'patient-files',
        name: `${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        size: 524288,
        owner: CLINIC_B_DOCTOR_ID,
      },
    ];
  }

  // ==========================================
  // SEC-01: handle_verified_clinic_creation
  // ==========================================
  handleVerifiedClinicCreation(caller, { pendingClinicData, userId, userEmail }) {
    // Invariant SEC-01: Disallow client-provided pending_clinic.id.
    // Always generate new_clinic_id := gen_random_uuid() in trusted server code.
    const newClinicId = crypto.randomUUID();
    const clinicName = pendingClinicData?.name || 'Mi Clínica Dental';

    const newClinic = {
      id: newClinicId,
      name: clinicName,
      subscription_tier: 'trial',
      subscription_status: 'trialing',
      owner_id: userId,
      archived_at: null,
    };
    this.clinics.push(newClinic);

    const profile = {
      id: userId,
      full_name: pendingClinicData?.owner_name || 'Nuevo Propietario',
      phone: pendingClinicData?.phone || '',
      avatar_url: null,
      role: 'clinic_owner',
      clinic_id: newClinicId,
      status: 'active',
    };
    this.profiles.push(profile);

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
      profile,
    };
  }

  // ==========================================
  // SEC-02: Profiles Management
  // ==========================================
  updateProfile(caller, targetUserId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const existing = this.profiles.find((p) => p.id === targetUserId);
    if (!existing) {
      throw new Error('404 Not Found: Profile does not exist');
    }

    // Invariant: Non-service_role users cannot update profiles of other users in another clinic
    if (caller.role !== 'service_role') {
      if (existing.id !== caller.userId && caller.role !== 'clinic_owner') {
        throw new Error('403 Forbidden: Cannot update another user profile');
      }
      if (existing.id !== caller.userId && caller.role === 'clinic_owner' && existing.clinic_id !== caller.clinicId) {
        throw new Error('403 Forbidden: Cross-tenant profile update forbidden');
      }
    }

    // Trigger Invariant SEC-02: prevent_profile_privilege_escalation
    // If caller != 'service_role' and (NEW.role != OLD.role OR NEW.clinic_id != OLD.clinic_id OR NEW.status != OLD.status)
    if (caller.role !== 'service_role') {
      if (updates.role !== undefined && updates.role !== existing.role) {
        throw new Error('403 Forbidden: Unauthorized profile mutation (role escalation blocked)');
      }
      if (updates.clinic_id !== undefined && updates.clinic_id !== existing.clinic_id) {
        throw new Error('403 Forbidden: Unauthorized profile mutation (clinic_id migration blocked)');
      }
      if (updates.status !== undefined && updates.status !== existing.status && caller.role !== 'clinic_owner') {
        throw new Error('403 Forbidden: Unauthorized profile mutation (status manipulation blocked)');
      }
    }

    // Apply allowed updates
    if (updates.full_name !== undefined) existing.full_name = updates.full_name;
    if (updates.phone !== undefined) existing.phone = updates.phone;
    if (updates.avatar_url !== undefined) existing.avatar_url = updates.avatar_url;
    if (updates.specialization !== undefined) existing.specialization = updates.specialization;
    if (caller.role === 'service_role') {
      if (updates.role !== undefined) existing.role = updates.role;
      if (updates.clinic_id !== undefined) existing.clinic_id = updates.clinic_id;
      if (updates.status !== undefined) existing.status = updates.status;
    }

    return { ...existing };
  }

  // ==========================================
  // SEC-03: Clinic Members Enrollment
  // ==========================================
  insertClinicMember(caller, memberData) {
    // Invariant SEC-03: Direct client-side INSERT on clinic_members is FORBIDDEN.
    // "Users can insert their own membership" is dropped.
    if (caller.role !== 'service_role') {
      throw new Error('403 Forbidden: Direct client-side insertion into clinic_members is disabled by RLS. Memberships must be created via verified server-side invitation acceptance.');
    }

    const newMember = {
      id: `cm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      user_id: memberData.user_id,
      clinic_id: memberData.clinic_id,
      role: memberData.role || 'receptionist',
      status: memberData.status || 'active',
    };
    this.clinic_members.push(newMember);
    return newMember;
  }

  // ==========================================
  // SEC-04: get_patients_with_stats RPC
  // ==========================================
  getPatientsWithStats(caller, { p_clinic_id, p_search, p_limit = 50, p_offset = 0 }) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    // Invariant SEC-04: Caller must be an active member of p_clinic_id
    const isMember = this.clinic_members.some(
      (cm) => cm.user_id === caller.userId && cm.clinic_id === p_clinic_id && cm.status === 'active'
    );

    if (!isMember) {
      throw new Error('403 Forbidden: Access denied: Caller does not belong to the requested clinic.');
    }

    const clinicPatients = this.patients.filter((p) => p.clinic_id === p_clinic_id && !p.deleted_at);
    return {
      data: clinicPatients.slice(p_offset, p_offset + p_limit),
      total: clinicPatients.length,
    };
  }

  // ==========================================
  // SEC-05: Storage patient-files Isolation
  // ==========================================
  storageDownload(caller, bucketId, filePath) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    if (bucketId !== 'patient-files') {
      throw new Error('404 Not Found: Bucket not found');
    }

    // Invariant SEC-05: Path convention <clinic_id>/<patient_id>/<filename>
    const parts = filePath.split('/');
    if (parts.length < 2) {
      throw new Error('400 Bad Request: Malformed storage object path');
    }

    const objectClinicId = parts[0];
    if (caller.role !== 'service_role' && caller.clinicId !== objectClinicId) {
      throw new Error('403 Forbidden: Cross-tenant storage read denied');
    }

    const object = this.storage_objects.find((o) => o.bucket_id === bucketId && o.name === filePath);
    if (!object) {
      throw new Error('404 Not Found: Object does not exist');
    }

    // Simulate authenticated signed URL creation with 1-hour expiration
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 3600 * 1000;
    return {
      signedUrl: `https://storage.cliniaplus.com/object/sign/${bucketId}/${filePath}?token=${token}&expires=${expiresAt}`,
      expiresAt,
    };
  }

  storageDelete(caller, bucketId, filePath) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Authentication required');
    }

    const parts = filePath.split('/');
    const objectClinicId = parts[0];

    if (caller.role !== 'service_role' && caller.clinicId !== objectClinicId) {
      throw new Error('403 Forbidden: Cross-tenant storage deletion denied');
    }

    if (caller.role !== 'service_role' && !['clinic_owner', 'doctor'].includes(caller.role)) {
      throw new Error('403 Forbidden: Storage deletion requires clinical role (doctor or clinic_owner)');
    }

    const idx = this.storage_objects.findIndex((o) => o.bucket_id === bucketId && o.name === filePath);
    if (idx === -1) {
      throw new Error('404 Not Found: Object does not exist');
    }

    this.storage_objects.splice(idx, 1);
    return { success: true };
  }

  // ==========================================
  // SEC-07: Clinical Role Separation (Prescriptions & HCU-033)
  // ==========================================
  insertPrescription(caller, prescriptionData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    if (caller.role !== 'service_role' && caller.clinicId !== prescriptionData.clinic_id) {
      throw new Error('403 Forbidden: Cross-tenant prescription insertion forbidden');
    }

    // Invariant SEC-07: Must be doctor or clinic_owner
    if (!['doctor', 'clinic_owner'].includes(caller.role)) {
      throw new Error('403 Forbidden: Non-clinical roles (receptionist) cannot write prescriptions');
    }

    // Invariant SEC-07: doctor_id must equal caller.userId (prevent spoofing)
    if (caller.role === 'doctor' && prescriptionData.doctor_id !== caller.userId) {
      throw new Error('403 Forbidden: Doctor cannot spoof prescriber doctor_id');
    }

    const newRx = {
      id: `rx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...prescriptionData,
      created_at: new Date().toISOString(),
    };
    this.prescriptions.push(newRx);
    return newRx;
  }

  updateHcu033Form(caller, formId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    const form = this.hcu033_forms.find((f) => f.id === formId);
    if (!form) {
      throw new Error('404 Not Found');
    }

    if (caller.role !== 'service_role' && caller.clinicId !== form.clinic_id) {
      throw new Error('403 Forbidden: Cross-tenant HCU record update forbidden');
    }

    // Invariant SEC-07: Only doctor and clinic_owner can modify diagnosis/clinical findings
    if (!['doctor', 'clinic_owner'].includes(caller.role)) {
      throw new Error('403 Forbidden: Non-clinical staff cannot alter HCU-033 clinical diagnoses');
    }

    if (updates.diagnosis !== undefined) form.diagnosis = updates.diagnosis;
    if (updates.odontogram_data !== undefined) form.odontogram_data = updates.odontogram_data;
    return form;
  }

  // ==========================================
  // SEC-08: Dashboard Stats View
  // ==========================================
  queryDashboardStatsView(caller) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    // Invariant SEC-08: security_invoker = true with WHERE clinic_id = caller.clinicId
    const callerClinicBillings = this.billings.filter((b) => b.clinic_id === caller.clinicId);
    const totalRevenue = callerClinicBillings.reduce((acc, b) => acc + b.amount, 0);

    return [
      {
        clinic_id: caller.clinicId,
        total_billings: callerClinicBillings.length,
        total_revenue: totalRevenue,
      },
    ];
  }

  // ==========================================
  // SEC-09: Maintenance RPCs Execution
  // ==========================================
  archiveClinic(caller, { target_clinic_id }) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    // Invariant SEC-09: Revoke from PUBLIC, authenticated, anon.
    // Allowed only for service_role OR verified owner of target_clinic_id.
    const isServiceRole = caller.role === 'service_role';
    const isVerifiedOwner = caller.role === 'clinic_owner' && caller.clinicId === target_clinic_id;

    if (!isServiceRole && !isVerifiedOwner) {
      throw new Error('403 Forbidden: EXECUTE privilege denied on archive_clinic');
    }

    const clinic = this.clinics.find((c) => c.id === target_clinic_id);
    if (!clinic) throw new Error('404 Not Found');

    clinic.archived_at = new Date().toISOString();
    clinic.subscription_status = 'archived';
    return { success: true, archived_at: clinic.archived_at };
  }

  purgeClinicData(caller, { target_clinic_id }) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    // Invariant SEC-09: Allowed ONLY for service_role
    if (caller.role !== 'service_role') {
      throw new Error('403 Forbidden: EXECUTE privilege denied on purge_clinic_data (restricted to service_role)');
    }

    const clinic = this.clinics.find((c) => c.id === target_clinic_id);
    if (!clinic) throw new Error('404 Not Found');

    // Invariant SEC-09: 90-day statutory retention requirement
    if (!clinic.archived_at) {
      throw new Error('400 Bad Request: Cannot purge unarchived clinic');
    }

    const archivedDate = new Date(clinic.archived_at).getTime();
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    if (archivedDate > ninetyDaysAgo) {
      throw new Error('400 Bad Request: Statutory 90-day retention lock active. Purge rejected.');
    }

    this.clinics = this.clinics.filter((c) => c.id !== target_clinic_id);
    return { success: true, purged: target_clinic_id };
  }

  // ==========================================
  // SEC-12: Services Table Isolation
  // ==========================================
  insertService(caller, serviceData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    // Invariant SEC-12: Must be clinic_owner
    if (caller.role !== 'clinic_owner' && caller.role !== 'service_role') {
      throw new Error('403 Forbidden: Only clinic_owner can insert services');
    }

    // Invariant SEC-12: Must match caller's clinic_id
    if (caller.role !== 'service_role' && serviceData.clinic_id !== caller.clinicId) {
      throw new Error('403 Forbidden: Cross-tenant service catalog insertion forbidden');
    }

    const newService = {
      id: `srv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...serviceData,
    };
    this.services.push(newService);
    return newService;
  }

  // ==========================================
  // SEC-13: Bank Payment Methods Isolation
  // ==========================================
  selectPaymentMethods(caller) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    // Invariant SEC-13: RLS filters by clinic_id = caller.clinicId
    return this.payment_methods.filter((pm) => pm.clinic_id === caller.clinicId);
  }

  updatePaymentMethod(caller, methodId, updates) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized');
    }

    const method = this.payment_methods.find((pm) => pm.id === methodId);
    if (!method) {
      throw new Error('404 Not Found: Payment method does not exist');
    }

    // Invariant SEC-13: Caller must belong to same clinic AND be clinic_owner
    if (caller.role !== 'service_role') {
      if (method.clinic_id !== caller.clinicId) {
        throw new Error('403 Forbidden: Cross-tenant payment method update forbidden');
      }
      if (caller.role !== 'clinic_owner') {
        throw new Error('403 Forbidden: Only clinic_owner can update payment methods');
      }
    }

    if (updates.title !== undefined) method.title = updates.title;
    if (updates.config !== undefined) method.config = { ...method.config, ...updates.config };
    if (updates.is_active !== undefined) method.is_active = updates.is_active;

    return method;
  }
}

module.exports = { DatabaseSecurityEngine };
