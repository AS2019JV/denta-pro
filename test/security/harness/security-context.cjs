/**
 * Security Context & Identity Factory for DentaPro / Clinia+ E2E Security Tests
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Source: ORIGINAL_REQUEST.md & PROJECT.md
 */

const crypto = require('node:crypto');

// Predefined Fixed UUIDs for Deterministic Testing
const TENANT_A_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_B_ID = '22222222-2222-4222-8222-222222222222';

const CLINIC_A_OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const CLINIC_A_DOCTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const CLINIC_A_DOCTOR_2_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const CLINIC_A_RECEPTIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

const CLINIC_B_OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const CLINIC_B_DOCTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const CLINIC_B_RECEPTIONIST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';

const PATIENT_A1_ID = 'pa111111-1111-4111-8111-111111111111';
const PATIENT_A2_ID = 'pa222222-2222-4222-8222-222222222222';
const PATIENT_B1_ID = 'pb111111-1111-4111-8111-111111111111';

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', 'test-secret').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function getSecurityContext(roleName) {
  switch (roleName) {
    case 'clinic_a_owner':
      return {
        userId: CLINIC_A_OWNER_ID,
        clinicId: TENANT_A_ID,
        role: 'clinic_owner',
        email: 'owner-a@clinic-a.com',
        jwt: {
          sub: CLINIC_A_OWNER_ID,
          email: 'owner-a@clinic-a.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
        },
        token: createToken({ sub: CLINIC_A_OWNER_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' } }),
      };

    case 'clinic_a_doctor':
      return {
        userId: CLINIC_A_DOCTOR_ID,
        clinicId: TENANT_A_ID,
        role: 'doctor',
        email: 'doctor-a@clinic-a.com',
        specialization: 'Odontología General',
        licenseNumber: 'SENESCYT-MSP-100234',
        jwt: {
          sub: CLINIC_A_DOCTOR_ID,
          email: 'doctor-a@clinic-a.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_A_ID, role: 'doctor' },
        },
        token: createToken({ sub: CLINIC_A_DOCTOR_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_A_ID, role: 'doctor' } }),
      };

    case 'clinic_a_doctor_2':
      return {
        userId: CLINIC_A_DOCTOR_2_ID,
        clinicId: TENANT_A_ID,
        role: 'doctor',
        email: 'doctor-a2@clinic-a.com',
        specialization: 'Ortodoncia',
        licenseNumber: 'SENESCYT-MSP-100567',
        jwt: {
          sub: CLINIC_A_DOCTOR_2_ID,
          email: 'doctor-a2@clinic-a.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_A_ID, role: 'doctor' },
        },
        token: createToken({ sub: CLINIC_A_DOCTOR_2_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_A_ID, role: 'doctor' } }),
      };

    case 'clinic_a_receptionist':
      return {
        userId: CLINIC_A_RECEPTIONIST_ID,
        clinicId: TENANT_A_ID,
        role: 'receptionist',
        email: 'recep-a@clinic-a.com',
        jwt: {
          sub: CLINIC_A_RECEPTIONIST_ID,
          email: 'recep-a@clinic-a.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_A_ID, role: 'receptionist' },
        },
        token: createToken({ sub: CLINIC_A_RECEPTIONIST_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_A_ID, role: 'receptionist' } }),
      };

    case 'clinic_b_owner':
      return {
        userId: CLINIC_B_OWNER_ID,
        clinicId: TENANT_B_ID,
        role: 'clinic_owner',
        email: 'owner-b@clinic-b.com',
        jwt: {
          sub: CLINIC_B_OWNER_ID,
          email: 'owner-b@clinic-b.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_B_ID, role: 'clinic_owner' },
        },
        token: createToken({ sub: CLINIC_B_OWNER_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_B_ID, role: 'clinic_owner' } }),
      };

    case 'clinic_b_doctor':
      return {
        userId: CLINIC_B_DOCTOR_ID,
        clinicId: TENANT_B_ID,
        role: 'doctor',
        email: 'doctor-b@clinic-b.com',
        specialization: 'Periodoncia',
        licenseNumber: 'SENESCYT-MSP-200987',
        jwt: {
          sub: CLINIC_B_DOCTOR_ID,
          email: 'doctor-b@clinic-b.com',
          role: 'authenticated',
          app_metadata: { clinic_id: TENANT_B_ID, role: 'doctor' },
        },
        token: createToken({ sub: CLINIC_B_DOCTOR_ID, role: 'authenticated', app_metadata: { clinic_id: TENANT_B_ID, role: 'doctor' } }),
      };

    case 'service_role':
      return {
        userId: '00000000-0000-0000-0000-000000000000',
        role: 'service_role',
        email: 'service-role@supabase.internal',
        jwt: {
          sub: '00000000-0000-0000-0000-000000000000',
          role: 'service_role',
          app_metadata: { role: 'service_role' },
        },
        token: createToken({ role: 'service_role' }),
      };

    case 'anonymous':
    default:
      return {
        userId: null,
        clinicId: null,
        role: 'anon',
        email: null,
        jwt: { role: 'anon' },
        token: null,
      };
  }
}

module.exports = {
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
  createToken,
  getSecurityContext,
};
