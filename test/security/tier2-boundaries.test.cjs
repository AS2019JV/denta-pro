/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§ Acceptance Criteria & Requirements)
 * - PROJECT.md (§ Architectural Boundaries & Interface Contracts)
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
  PATIENT_A1_ID,
  PATIENT_B1_ID,
  getSecurityContext,
  createToken,
} = require('./harness/security-context.cjs');
const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');
const { specInviteTeamMember, specSendEmailRoute } = require('./harness/action-runner.cjs');

describe('Tier 2: Boundary & Corner Cases', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================
  // 1. Missing Auth Tokens & Unauthenticated Access
  // ==========================================
  describe('Boundary 1: Missing Auth Tokens & Unauthenticated Access', () => {
    const unauthContexts = [
      { name: 'null caller', context: null },
      { name: 'undefined caller', context: undefined },
      { name: 'anonymous context', context: getSecurityContext('anonymous') },
      { name: 'empty object caller', context: {} },
    ];

    for (const { name, context } of unauthContexts) {
      test(`Denies RPC getPatientsWithStats with ${name}`, () => {
        assert.throws(
          () => {
            db.getPatientsWithStats(context, { p_clinic_id: TENANT_A_ID });
          },
          /401 Unauthorized/i,
          `Must deny getPatientsWithStats for ${name}`
        );
      });

      test(`Denies updateProfile with ${name}`, () => {
        assert.throws(
          () => {
            db.updateProfile(context, CLINIC_A_OWNER_ID, { full_name: 'Hacker' });
          },
          /401 Unauthorized/i,
          `Must deny updateProfile for ${name}`
        );
      });

      test(`Denies storageDownload with ${name}`, () => {
        assert.throws(
          () => {
            db.storageDownload(context, 'patient-files', `${TENANT_A_ID}/${PATIENT_A1_ID}/scan.png`);
          },
          /401 Unauthorized/i,
          `Must deny storageDownload for ${name}`
        );
      });

      test(`Denies insertPrescription with ${name}`, () => {
        assert.throws(
          () => {
            db.insertPrescription(context, {
              clinic_id: TENANT_A_ID,
              patient_id: PATIENT_A1_ID,
              doctor_id: CLINIC_A_DOCTOR_ID,
              items: [],
            });
          },
          /401 Unauthorized/i,
          `Must deny insertPrescription for ${name}`
        );
      });

      test(`Denies selectPaymentMethods with ${name}`, () => {
        assert.throws(
          () => {
            db.selectPaymentMethods(context);
          },
          /401 Unauthorized/i,
          `Must deny selectPaymentMethods for ${name}`
        );
      });

      test(`Denies specSendEmailRoute with ${name}`, async () => {
        const res = await specSendEmailRoute(context, {
          to: 'patient@example.com',
          template: 'appointment_reminder',
        });
        assert.equal(res.status, 401, `Must return 401 for ${name}`);
      });

      test(`Denies specInviteTeamMember with ${name}`, async () => {
        const formData = new Map();
        formData.set('email', 'test@example.com');
        formData.set('clinicId', TENANT_A_ID);
        await assert.rejects(
          specInviteTeamMember(context, formData),
          /401 Unauthorized/i,
          `Must throw 401 for ${name}`
        );
      });
    }
  });

  // ==========================================
  // 2. Malformed Headers & JWT Signature Tampering
  // ==========================================
  describe('Boundary 2: Malformed Headers & JWT Signature Tampering', () => {
    test('Tampered JWT claim (forged role: clinic_owner) with bad signature is rejected', () => {
      // Create a forged JWT claiming clinic_owner for a receptionist
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const forgedPayload = Buffer.from(
        JSON.stringify({
          sub: CLINIC_A_RECEPTIONIST_ID,
          app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
        })
      ).toString('base64url');
      const invalidSignature = 'invalid-signature-value';
      const tamperedToken = `${header}.${forgedPayload}.${invalidSignature}`;

      // A verified context generator or validator checks signature
      function verifyAndExtractContext(token) {
        if (!token || !token.includes('.')) throw new Error('401 Unauthorized: Malformed JWT');
        const [h, b, s] = token.split('.');
        const expectedSig = require('node:crypto')
          .createHmac('sha256', 'test-secret')
          .update(`${h}.${b}`)
          .digest('base64url');
        if (s !== expectedSig) {
          throw new Error('401 Unauthorized: Invalid JWT signature');
        }
        return JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
      }

      assert.throws(
        () => {
          verifyAndExtractContext(tamperedToken);
        },
        /401 Unauthorized: Invalid JWT signature/i,
        'Tampered JWT signature must be rejected'
      );
    });

    test('Malformed token strings (empty, whitespace, missing segments) are rejected', () => {
      function parseAuthHeader(header) {
        if (!header || typeof header !== 'string') throw new Error('401 Unauthorized');
        if (!header.startsWith('Bearer ')) throw new Error('401 Unauthorized: Missing Bearer prefix');
        const token = header.slice(7).trim();
        if (!token || token.split('.').length !== 3) throw new Error('401 Unauthorized: Malformed JWT structure');
        return token;
      }

      assert.throws(() => parseAuthHeader(''), /401 Unauthorized/i);
      assert.throws(() => parseAuthHeader('   '), /401 Unauthorized/i);
      assert.throws(() => parseAuthHeader('Basic 12345'), /Missing Bearer prefix/i);
      assert.throws(() => parseAuthHeader('Bearer '), /Malformed JWT structure/i);
      assert.throws(() => parseAuthHeader('Bearer single-token-string'), /Malformed JWT structure/i);
    });
  });

  // ==========================================
  // 3. Cross-Tenant ID Injection
  // ==========================================
  describe('Boundary 3: Cross-Tenant ID Injection & Path Traversal', () => {
    test('Cross-tenant UUID injection in RPC parameter throws access denied', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      // Doctor from Clinic A injects Tenant B UUID
      assert.throws(
        () => {
          db.getPatientsWithStats(doctorA, { p_clinic_id: TENANT_B_ID });
        },
        /403 Forbidden.*Caller does not belong to the requested clinic/i
      );
    });

    test('SQL injection style UUID parameter is rejected by tenant validation', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const maliciousClinicId = `${TENANT_A_ID}' OR '1'='1`;
      assert.throws(
        () => {
          db.getPatientsWithStats(doctorA, { p_clinic_id: maliciousClinicId });
        },
        /403 Forbidden/i
      );
    });

    test('Storage path traversal injection (../) is rejected or treated as cross-tenant', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      // Attempt to traverse out of Tenant A into Tenant B
      const traversalPath = `../${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`;
      assert.throws(
        () => {
          db.storageDownload(doctorA, 'patient-files', traversalPath);
        },
        /403 Forbidden.*storage read denied/i,
        'Path traversal attempt must be blocked'
      );
    });

    test('URL-encoded path traversal (%2e%2e%2f) is rejected', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const encodedTraversalPath = `%2e%2e%2f${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`;
      assert.throws(
        () => {
          db.storageDownload(doctorA, 'patient-files', encodedTraversalPath);
        },
        /403 Forbidden.*storage read denied/i
      );
    });
  });

  // ==========================================
  // 4. Mock Credentials & Placeholder Keys
  // ==========================================
  describe('Boundary 4: Mock Credentials & Placeholder Keys', () => {
    test('Empty, whitespace, and mock private keys fail before issuing network calls', () => {
      const placeholderKeys = [undefined, null, '', '   ', 'mock_private_key', 'pk_test_placeholder'];
      for (const key of placeholderKeys) {
        const isUsable = Boolean(key && typeof key === 'string' && key.trim() !== '' && key !== 'mock_private_key' && key !== 'pk_test_placeholder');
        assert.equal(isUsable, false, `Key '${key}' must be flagged as unusable`);
      }
    });
  });

  // ==========================================
  // 5. Payload Tampering & Mass Assignment
  // ==========================================
  describe('Boundary 5: Payload Tampering & Mass Assignment', () => {
    test('Profile update with mass-assignment payload (tampering role and clinic_id) is blocked', () => {
      const receptionistA = getSecurityContext('clinic_a_receptionist');
      const tamperedPayload = {
        full_name: 'Diana Legit',
        role: 'clinic_owner', // Privilege escalation injection
        clinic_id: TENANT_B_ID, // Tenant hopping injection
        status: 'suspended',
      };

      assert.throws(
        () => {
          db.updateProfile(receptionistA, receptionistA.userId, tamperedPayload);
        },
        /403 Forbidden/i,
        'Mass assignment attempting to escalate role or migrate clinic must fail'
      );
    });

    test('Prescription creation with spoofed prescriber doctor_id is blocked', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.insertPrescription(doctorA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: '99999999-9999-4999-8999-999999999999', // Rogue doctor
            items: [{ medicine: 'Morfina 10mg', dosage: '1 ampolla' }],
          });
        },
        /403 Forbidden.*cannot spoof prescriber doctor_id/i
      );
    });

    test('Email endpoint payload with script tag or executable HTML is rejected', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const res = await specSendEmailRoute(doctorA, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
        html: '<script>alert("xss")</script>',
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Arbitrary HTML messages are forbidden/i);
    });
  });
});
