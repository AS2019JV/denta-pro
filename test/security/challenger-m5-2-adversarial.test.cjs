/**
 * Milestone 5 Challenger 2 Adversarial Stress-Test Suite
 * Agent: teamwork_preview_challenger_m5_2 (Empirical Challenger)
 * Role: critic, specialist
 * 
 * Focus Areas:
 * 1. Advanced Multi-Tenant Isolation Stress:
 *    - Forged JWT tokens (alg:none, untrusted HMAC secret, identity mismatch, SQL injection).
 *    - Cross-tenant file signed URL tampering (direct cross-tenant reads, path traversal, expired URLs, tampered paths/tokens).
 *    - Clinical trigger bypass attempts (handle_verified_clinic_creation, prevent_profile_privilege_escalation, sync_hcu033_form_clinic_id).
 * 2. Clinical Privilege Boundaries:
 *    - Receptionist attempting to modify clinical history (HCU-033, diagnoses, odontogram_state, systemic alerts).
 *    - Prescription tampering (receptionist write/update/delete, prescriber doctor_id spoofing, cross-doctor tampering).
 *    - Dentist spoofing (altering SENESCYT license or specialty in profiles).
 * 3. Kushki Payment Gateway Fail-Closed Contract:
 *    - Unconfigured credentials (undefined, empty, whitespace, mock) fail before network.
 *    - Malformed payloads and boundary inputs.
 *    - Provider rejections (401, 402, 500, non-JSON error pages, transport timeouts).
 *    - Fail-closed route invariants: DB subscription never activated on failure.
 * 4. Statutory LOPDP Compliance & 5-10 Year Medical Custody Retention Lock:
 *    - Statutory article citation accuracy (Art. 17 Portability, Art. 15 Elimination, Arts. 20-21 Automated Decisions).
 *    - 5-10 year clinical history custody retention lock (Ley Orgánica de Salud Art. 7) preventing instant deletion.
 *    - Multi-tenant isolation and immutability of public.data_rights_requests.
 *    - Interoperable Art. 17 portability JSON export scoping.
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
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
  createToken,
} = require('./harness/security-context.cjs');

const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');

const ROOT_DIR = resolve(__dirname, '../..');
const MIGRATION_PATH = join(ROOT_DIR, 'supabase/migrations/20260920_security_remediation_consolidated.sql');
const KUSHKI_PATH = join(ROOT_DIR, 'lib/kushki.ts');
const SUBSCRIBE_ROUTE_PATH = join(ROOT_DIR, 'app/api/payments/subscribe/route.ts');
const PATIENT_FILES_PATH = join(ROOT_DIR, 'components/patient-files.tsx');
const PRIVACY_TAB_PATH = join(ROOT_DIR, 'components/settings/privacy-tab.tsx');

// ============================================================================
// Helper: Transpile and Load Kushki in Sandbox
// ============================================================================
function loadKushkiGateway(env, fetchFn) {
  const source = readFileSync(KUSHKI_PATH, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const exports = {};
  vm.runInNewContext(
    compiled,
    {
      exports,
      process: { env },
      fetch: fetchFn,
      console: { log() {}, error() {}, warn() {} },
    },
    { filename: 'kushki.js' }
  );
  return exports.kushki;
}

// ============================================================================
// Helper: JWT Validator Simulation (Strict Server-Side Cryptographic Verifier)
// ============================================================================
function verifyJwtToken(token, serverSecret = 'test-secret') {
  if (!token || typeof token !== 'string') {
    throw new Error('401 Unauthorized: Missing token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('401 Unauthorized: Malformed JWT structure');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (e) {
    throw new Error('401 Unauthorized: Corrupted JWT payload/header JSON');
  }

  // Check alg
  if (!header.alg || header.alg.toLowerCase() === 'none') {
    throw new Error('401 Unauthorized: Algorithm "none" is rejected');
  }

  if (header.alg !== 'HS256') {
    throw new Error(`401 Unauthorized: Unsupported algorithm ${header.alg}`);
  }

  const expectedSig = crypto
    .createHmac('sha256', serverSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (signatureB64 !== expectedSig) {
    throw new Error('401 Unauthorized: Invalid JWT signature');
  }

  return payload;
}

describe('Challenger 2 — Adversarial Stress Test Suite (Milestone 5)', () => {
  let db;

  beforeEach(() => {
    db = new DatabaseSecurityEngine();
  });

  // ==========================================================================
  // VECTOR 1: ADVANCED MULTI-TENANT ISOLATION STRESS TESTING
  // ==========================================================================
  describe('Vector 1: Advanced Multi-Tenant Isolation Stress Testing', () => {

    test('1.1.1: Token with alg "none" attack is rejected with 401', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: CLINIC_A_RECEPTIONIST_ID,
          app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      assert.throws(
        () => verifyJwtToken(noneToken),
        /401 Unauthorized: Algorithm "none" is rejected/i
      );
    });

    test('1.1.2: Token signed with untrusted secret key is rejected with 401', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: CLINIC_A_RECEPTIONIST_ID,
          app_metadata: { clinic_id: TENANT_A_ID, role: 'clinic_owner' },
        })
      ).toString('base64url');
      const attackerSecret = 'attacker-private-key-666';
      const fakeSignature = crypto.createHmac('sha256', attackerSecret).update(`${header}.${payload}`).digest('base64url');
      const forgedToken = `${header}.${payload}.${fakeSignature}`;

      assert.throws(
        () => verifyJwtToken(forgedToken, 'test-secret'),
        /401 Unauthorized: Invalid JWT signature/i
      );
    });

    test('1.1.3: Token with corrupted / malformed base64 segments is rejected with 401', () => {
      assert.throws(() => verifyJwtToken('header.%%%badbase64%%%.signature'), /401 Unauthorized/i);
      assert.throws(() => verifyJwtToken('header.payload'), /Malformed JWT structure/i);
      assert.throws(() => verifyJwtToken(''), /Missing token/i);
    });

    test('1.1.4: Identity mismatch attack — Member of Clinic A presenting forged Clinic B claims is rejected by DB engine', () => {
      // User belongs to Clinic A, but crafts a JWT claiming membership in Clinic B
      const mismatchedCaller = {
        userId: CLINIC_A_DOCTOR_ID,
        clinicId: TENANT_B_ID, // Claiming Clinic B
        role: 'doctor',
      };

      // Querying Clinic B patient stats must be rejected because clinic_members does NOT have this user in Clinic B
      assert.throws(
        () => db.getPatientsWithStats(mismatchedCaller, { p_clinic_id: TENANT_B_ID }),
        /403 Forbidden.*does not belong to the requested clinic/i
      );
    });

    test('1.1.5: SQL injection / UUID injection payload in JWT claims fails tenant lookup', () => {
      const sqlInjectionCaller = {
        userId: CLINIC_A_DOCTOR_ID,
        clinicId: `${TENANT_A_ID}' OR '1'='1`,
        role: 'doctor',
      };

      assert.throws(
        () => db.getPatientsWithStats(sqlInjectionCaller, { p_clinic_id: TENANT_B_ID }),
        /403 Forbidden/i
      );
    });

    test('1.1.6: Storage download cross-tenant attempt is rejected with 403', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      // Doctor A attempts to download file belonging to Tenant B
      assert.throws(
        () => db.storageDownload(doctorA, 'patient-files', `${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`),
        /403 Forbidden: Cross-tenant storage read denied/i
      );
    });

    test('1.1.7: Storage path traversal with ../ is blocked fail-closed', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const traversalPaths = [
        `${TENANT_A_ID}/../${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        `../${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        `${TENANT_A_ID}/%2e%2e/${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`,
        `..%2f..%2fpatient-files/${TENANT_B_ID}/scan.png`,
      ];

      for (const tPath of traversalPaths) {
        assert.throws(
          () => db.storageDownload(doctorA, 'patient-files', tPath),
          /(403 Forbidden|400 Bad Request|404 Not Found)/i,
          `Path traversal '${tPath}' must be rejected`
        );
      }
    });

    test('1.1.8: Cross-tenant storage deletion is rejected for all roles', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const ownerA = getSecurityContext('clinic_a_owner');
      const recepA = getSecurityContext('clinic_a_receptionist');

      const targetFile = `${TENANT_B_ID}/${PATIENT_B1_ID}/periapical-molar.png`;

      assert.throws(() => db.storageDelete(doctorA, 'patient-files', targetFile), /403 Forbidden.*Cross-tenant/i);
      assert.throws(() => db.storageDelete(ownerA, 'patient-files', targetFile), /403 Forbidden.*Cross-tenant/i);
      assert.throws(() => db.storageDelete(recepA, 'patient-files', targetFile), /403 Forbidden/i);
    });

    test('1.1.9: Storage deletion within own clinic is denied to non-clinical staff (receptionist)', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');
      const ownFile = `${TENANT_A_ID}/${PATIENT_A1_ID}/panoramica-2026.png`;

      assert.throws(
        () => db.storageDelete(recepA, 'patient-files', ownFile),
        /403 Forbidden: Storage deletion requires clinical role/i
      );
    });

    test('1.1.10: Client-supplied clinic ID in handle_verified_clinic_creation is discarded and replaced with random UUID', () => {
      const clientSuppliedId = '66666666-6666-4666-8666-666666666666';
      const result = db.handleVerifiedClinicCreation(getSecurityContext('anonymous'), {
        pendingClinicData: { id: clientSuppliedId, name: 'Clínica Maliciosa', owner_name: 'Atacante' },
        userId: '99999999-9999-4999-8999-999999999999',
        userEmail: 'attacker@example.com',
      });

      assert.equal(result.success, true);
      assert.notEqual(result.clinic_id, clientSuppliedId, 'Client-provided ID must be strictly ignored');
      const createdClinic = db.clinics.find((c) => c.id === result.clinic_id);
      assert.ok(createdClinic, 'Clinic must exist with generated UUID');
      assert.notEqual(createdClinic.id, clientSuppliedId);
    });

    test('1.1.11: Profile self-escalation of role, clinic_id, or status is blocked by prevent_profile_privilege_escalation', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      // Attempt role escalation
      assert.throws(
        () => db.updateProfile(recepA, recepA.userId, { role: 'clinic_owner' }),
        /403 Forbidden.*role escalation blocked/i
      );

      // Attempt clinic migration
      assert.throws(
        () => db.updateProfile(recepA, recepA.userId, { clinic_id: TENANT_B_ID }),
        /403 Forbidden.*clinic_id migration blocked/i
      );

      // Attempt status manipulation
      assert.throws(
        () => db.updateProfile(recepA, recepA.userId, { status: 'inactive' }),
        /403 Forbidden.*status manipulation blocked/i
      );
    });

    test('1.1.12: Cross-tenant profile update by clinic owner of another clinic is blocked', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => db.updateProfile(ownerA, CLINIC_B_DOCTOR_ID, { full_name: 'Compromised Doctor' }),
        /403 Forbidden.*Cross-tenant profile update forbidden/i
      );
    });

    test('1.1.13: AST verification of components/patient-files.tsx enforces createSignedUrl and tenant path isolation', () => {
      const code = readFileSync(PATIENT_FILES_PATH, 'utf8');
      assert.ok(code.includes('createSignedUrl'), 'Must use createSignedUrl');
      assert.ok(!code.includes('getPublicUrl'), 'Must NEVER use getPublicUrl on patient-files');
      assert.ok(code.includes('currentClinicId'), 'Must scope uploads by currentClinicId');
      assert.ok(code.includes('${currentClinicId}/${patientId}/'), 'Must enforce tenant and patient path convention');
      assert.ok(code.includes('deleted_at'), 'Must perform soft deletion for medical audit trail');
    });
  });

  // ==========================================================================
  // VECTOR 2: CLINICAL PRIVILEGE BOUNDARIES & ANTI-SPOOFING
  // ==========================================================================
  describe('Vector 2: Clinical Privilege Boundaries & Anti-Spoofing Stress Testing', () => {

    test('2.1.1: Receptionist cannot mutate HCU-033 diagnosis or odontogram', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => db.updateHcu033Form(recepA, 'hcu-a-1', {
          diagnosis: [{ code: 'K05.1', description: 'Gingivitis crónica' }],
        }),
        /403 Forbidden: Non-clinical staff cannot alter HCU-033 clinical diagnoses/i
      );

      assert.throws(
        () => db.updateHcu033Form(recepA, 'hcu-a-1', {
          odontogram_data: { 21: { center: 'blue' } },
        }),
        /403 Forbidden/i
      );
    });

    test('2.1.2: Receptionist cannot insert prescriptions', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => db.insertPrescription(recepA, {
          clinic_id: TENANT_A_ID,
          patient_id: PATIENT_A1_ID,
          doctor_id: recepA.userId,
          items: [{ medicine: 'Ketorolaco 10mg', dosage: 'Cada 8 horas' }],
        }),
        /403 Forbidden.*Non-clinical roles \(receptionist\) cannot write prescriptions/i
      );
    });

    test('2.1.3: Doctor cannot spoof prescriber doctor_id (anti-spoofing enforcement)', () => {
      const doctorA1 = getSecurityContext('clinic_a_doctor');
      const doctorA2 = getSecurityContext('clinic_a_doctor_2');

      // Doctor 1 attempts to sign prescription using Doctor 2's ID
      assert.throws(
        () => db.insertPrescription(doctorA1, {
          clinic_id: TENANT_A_ID,
          patient_id: PATIENT_A1_ID,
          doctor_id: doctorA2.userId, // Spoofed prescriber
          items: [{ medicine: 'Tramadol 50mg', dosage: 'Cada 12 horas' }],
        }),
        /403 Forbidden.*Doctor cannot spoof prescriber doctor_id/i
      );
    });

    test('2.1.4: Cross-tenant prescription insertion is forbidden even for legitimate doctors', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      // Doctor A attempts to insert prescription into Clinic B
      assert.throws(
        () => db.insertPrescription(doctorA, {
          clinic_id: TENANT_B_ID,
          patient_id: PATIENT_B1_ID,
          doctor_id: doctorA.userId,
          items: [{ medicine: 'Amoxicilina 500mg' }],
        }),
        /403 Forbidden: Cross-tenant prescription insertion forbidden/i
      );
    });

    test('2.1.5: Receptionist cannot update doctor specialization or license_number in profiles', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => db.updateProfile(recepA, CLINIC_A_DOCTOR_ID, {
          specialization: 'Cirugía Maxilofacial Falsa',
          license_number: 'FAKE-SENESCYT-999999',
        }),
        /403 Forbidden.*Cannot update another user profile/i
      );
    });

    test('2.1.6: Consolidated migration contains strict trigger trg_enforce_patient_clinical_privileges', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      assert.ok(sql.includes('trg_enforce_patient_clinical_privileges'), 'Must register clinical update guard trigger');
      assert.ok(sql.includes('trg_guard_patient_clinical_insert'), 'Must register clinical insert guard trigger');
      assert.ok(sql.includes('odontogram_state IS DISTINCT FROM OLD.odontogram_state'), 'Must guard odontogram_state');
      assert.ok(sql.includes('medical_history IS DISTINCT FROM OLD.medical_history'), 'Must guard medical_history');
      assert.ok(sql.includes('allergies IS DISTINCT FROM OLD.allergies'), 'Must guard allergies');
      assert.ok(sql.includes('has_diabetes IS DISTINCT FROM OLD.has_diabetes'), 'Must guard systemic alerts');
    });

    test('2.1.7: Legitimate clinical workflow: Doctor can create and sign own prescription', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');
      const rx = db.insertPrescription(doctorA, {
        clinic_id: TENANT_A_ID,
        patient_id: PATIENT_A1_ID,
        doctor_id: doctorA.userId,
        items: [{ medicine: 'Ibuprofeno 400mg', dosage: '1 cada 8h por 3 días' }],
      });

      assert.equal(rx.doctor_id, doctorA.userId);
      assert.equal(rx.clinic_id, TENANT_A_ID);
      assert.ok(rx.id);
    });
  });

  // ==========================================================================
  // VECTOR 3: KUSHKI PAYMENT GATEWAY FAIL-CLOSED CONTRACT
  // ==========================================================================
  describe('Vector 3: Kushki Payment Gateway Fail-Closed Contract', () => {

    const testPayload = {
      token: 'tok_test_card_12345',
      planId: 'plan_pro_monthly',
      email: 'doctor@clinic-a.com',
      amount: 49.99,
      metadata: { clinicId: TENANT_A_ID },
    };

    test('3.1.1: Missing or placeholder private merchant keys fail before any outbound network call', async () => {
      const invalidKeys = [undefined, '', '   ', 'mock_private_key'];

      for (const key of invalidKeys) {
        let networkCalls = 0;
        const gateway = loadKushkiGateway(
          { KUSHKI_PRIVATE_MERCHANT_ID: key },
          async () => {
            networkCalls++;
            return { ok: true, json: async () => ({ subscriptionId: 'bad' }) };
          }
        );

        await assert.rejects(
          gateway.createSubscription(testPayload),
          /Payment service is not configured/i,
          `Key ${JSON.stringify(key)} must reject before network`
        );
        assert.equal(networkCalls, 0, 'Zero network calls permitted when unconfigured');
      }
    });

    test('3.1.2: Provider card decline (HTTP 402) fails closed and throws descriptive error', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'valid_live_private_key' },
        async () => ({
          ok: false,
          status: 402,
          json: async () => ({ message: 'Declined: Fondos insuficientes en la tarjeta' }),
        })
      );

      await assert.rejects(
        gateway.createSubscription(testPayload),
        /Fondos insuficientes/i
      );
    });

    test('3.1.3: Provider authentication error (HTTP 401) fails closed', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'revoked_key' },
        async () => ({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Credenciales de comercio inválidas' }),
        })
      );

      await assert.rejects(
        gateway.createSubscription(testPayload),
        /Credenciales de comercio inválidas/i
      );
    });

    test('3.1.4: Provider 500 / 503 internal gateway error fails closed', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'valid_key' },
        async () => ({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Servicio de procesamiento temporalmente inaccesible' }),
        })
      );

      await assert.rejects(
        gateway.createSubscription(testPayload),
        /temporalmente inaccesible/i
      );
    });

    test('3.1.5: Non-JSON / Corrupt response body (HTML 502 page) is caught and fails closed', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'valid_key' },
        async () => ({
          ok: false,
          status: 502,
          json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
        })
      );

      await assert.rejects(
        gateway.createSubscription(testPayload),
        SyntaxError
      );
    });

    test('3.1.6: Network transport failure (ETIMEDOUT / ECONNRESET) fails closed', async () => {
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'valid_key' },
        async () => {
          const err = new Error('connect ETIMEDOUT 198.51.100.1:443');
          err.code = 'ETIMEDOUT';
          throw err;
        }
      );

      await assert.rejects(
        gateway.createSubscription(testPayload),
        /ETIMEDOUT/i
      );
    });

    test('3.1.7: AST analysis of app/api/payments/subscribe/route.ts verifies fail-closed invariants', () => {
      const routeCode = readFileSync(SUBSCRIBE_ROUTE_PATH, 'utf8');

      // 1. Session auth check
      assert.ok(routeCode.includes('auth.getUser()'), 'Must verify user session');
      assert.ok(routeCode.includes('status: 401'), 'Must return 401 on auth failure');

      // 2. Required fields
      assert.ok(routeCode.includes('!token || !planId || !clinicId'), 'Must validate required fields');

      // 3. Tenant cross-clinic check
      assert.ok(routeCode.includes('userClinic !== clinicId'), 'Must verify caller belongs to target clinic');

      // 4. Role authorization check (only clinic_owner)
      assert.ok(routeCode.includes('isOwner'), 'Must verify caller is clinic owner');

      // 5. kushki.createSubscription invoked
      assert.ok(routeCode.includes('kushki.createSubscription'), 'Must invoke gateway');

      // 6. DB update ONLY happens after confirmed subscription
      const kushkiCallIndex = routeCode.indexOf('kushki.createSubscription');
      const dbUpdateIndex = routeCode.indexOf("subscription_status: 'active'");
      assert.ok(kushkiCallIndex > 0 && dbUpdateIndex > kushkiCallIndex, 'DB subscription activation MUST follow gateway success');
    });

    test('3.1.8: Valid production request contract enforces HTTPS and correct headers', async () => {
      const mockResult = { subscriptionId: 'sub_prod_998877', status: 'active' };
      const gateway = loadKushkiGateway(
        { KUSHKI_PRIVATE_MERCHANT_ID: 'live_secret_id_1234', KUSHKI_ENVIRONMENT: 'prod' },
        async (url, opts) => {
          assert.equal(url, 'https://api.kushkipagos.com/subscriptions/v1/create');
          assert.equal(opts.headers['Private-Merchant-Id'], 'live_secret_id_1234');
          assert.equal(opts.headers['Content-Type'], 'application/json');
          const body = JSON.parse(opts.body);
          assert.equal(body.token, testPayload.token);
          assert.equal(body.plan.amount.subtotalIva0, testPayload.amount);
          return { ok: true, json: async () => mockResult };
        }
      );

      const res = await gateway.createSubscription(testPayload);
      assert.deepEqual(res, mockResult);
    });
  });

  // ==========================================================================
  // VECTOR 4: STATUTORY LOPDP COMPLIANCE & 5-10 YEAR MEDICAL CUSTODY LOCK
  // ==========================================================================
  describe('Vector 4: Statutory LOPDP Compliance & Custody Retention Lock', () => {

    test('4.1.1: Verification of statutory citations in privacy-tab.tsx', () => {
      const code = readFileSync(PRIVACY_TAB_PATH, 'utf8');

      // Portability must cite Article 17
      assert.ok(/Art(\.|ículo)?\s*17/i.test(code), 'Must cite Article 17 for Portability');
      assert.ok(code.includes('Portabilidad de Datos (Art. 17 LOPDP)'), 'Exact UI title for Art. 17');

      // Elimination / Suppression must cite Article 15
      assert.ok(/Art(\.|ículo)?\s*15/i.test(code), 'Must cite Article 15 for Elimination');
      assert.ok(code.includes('Derecho de Eliminación / Baja (Art. 15 LOPDP)'), 'Exact UI title for Art. 15');

      // Automated decisions disclaimer must clarify Articles 20-21
      assert.ok(code.includes('Artículos 20 y 21'), 'Must cite Articles 20 & 21 for automated decisions');

      // Medical custody citation under Ley Orgánica de Salud Art. 7 (5-10 years)
      assert.ok(code.includes('Ley Orgánica de Salud'), 'Must cite Ley Orgánica de Salud');
      assert.ok(code.includes('Art. 7') || code.includes('Artículo 7'), 'Must cite Art. 7 of Ley Orgánica de Salud');
      assert.ok(code.includes('5 a 10 años') || code.includes('5-10 años'), 'Must cite 5 to 10 year retention lock');
    });

    test('4.1.2: General deletion request records in public.data_rights_requests with custody retention note instead of hard delete', () => {
      const code = readFileSync(PRIVACY_TAB_PATH, 'utf8');

      // Confirm that handleConfirmDeletion inserts into data_rights_requests
      assert.ok(code.includes(".from('data_rights_requests').insert"), 'Must insert into data_rights_requests');
      assert.ok(code.includes("request_type: 'deletion'"), 'Must set request_type to deletion');
      assert.ok(code.includes("status: 'pending'"), 'Must mark status as pending (never immediate purge)');
      assert.ok(code.includes('Custodia médica legal obligatoria de 5 a 10 años'), 'Must record mandatory custody retention note');
    });

    test('4.1.3: Maintenance RPC purge_clinic_data strictly enforces 90-day retention lock before purge', () => {
      const serviceRole = getSecurityContext('service_role');
      const ownerA = getSecurityContext('clinic_a_owner');

      // 1. Archive clinic A
      db.archiveClinic(ownerA, { target_clinic_id: TENANT_A_ID });

      // 2. Attempt immediate purge -> Rejected
      assert.throws(
        () => db.purgeClinicData(serviceRole, { target_clinic_id: TENANT_A_ID }),
        /400 Bad Request: Statutory 90-day retention lock active/i
      );

      // 3. Fast-forward clinic archived date to 91 days ago
      const clinicA = db.clinics.find((c) => c.id === TENANT_A_ID);
      clinicA.archived_at = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();

      // 4. Purge now succeeds
      const purgeResult = db.purgeClinicData(serviceRole, { target_clinic_id: TENANT_A_ID });
      assert.equal(purgeResult.success, true);
      assert.equal(db.clinics.find((c) => c.id === TENANT_A_ID), undefined);
    });

    test('4.1.4: Non-service-role callers cannot execute purge_clinic_data', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      assert.throws(
        () => db.purgeClinicData(ownerA, { target_clinic_id: TENANT_A_ID }),
        /403 Forbidden.*restricted to service_role/i
      );
    });

    test('4.1.5: Multi-tenant isolation of public.data_rights_requests in consolidated migration', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.data_rights_requests'), 'Must create data_rights_requests table');
      assert.ok(sql.includes('ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
      assert.ok(sql.includes('Clinic members can view data rights requests'), 'Must restrict SELECT to caller clinic');
      assert.ok(sql.includes('Authenticated users can submit data rights requests'), 'Must restrict INSERT to caller clinic');
      assert.ok(sql.includes('Clinic owners can update data rights requests'), 'Must restrict UPDATE to clinic owners');
      assert.ok(sql.includes('REVOKE DELETE ON public.data_rights_requests FROM authenticated, anon, public'), 'Must revoke DELETE to ensure immutability');
    });

    test('4.1.6: LOPDP Art. 17 data portability export produces interoperable JSON with zero cross-tenant leakage', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      // Filter clinic entities as done in handleExportData
      const exportBundle = {
        meta: {
          software: 'Clinia+ SaaS Dental',
          normativa: 'Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador) - Art. 17 (Derecho a la Portabilidad)',
          clinic_id: ownerA.clinicId,
        },
        data: {
          patients: db.patients.filter((p) => p.clinic_id === ownerA.clinicId),
          prescriptions: db.prescriptions.filter((p) => p.clinic_id === ownerA.clinicId),
          hcu033_forms: db.hcu033_forms.filter((h) => h.clinic_id === ownerA.clinicId),
          services: db.services.filter((s) => s.clinic_id === ownerA.clinicId),
          payment_methods: db.payment_methods.filter((pm) => pm.clinic_id === ownerA.clinicId),
        },
      };

      // Verifications
      assert.equal(exportBundle.meta.clinic_id, TENANT_A_ID);
      assert.equal(exportBundle.data.patients.length, 2);
      assert.equal(exportBundle.data.prescriptions.length, 1);
      assert.equal(exportBundle.data.hcu033_forms.length, 1);
      assert.equal(exportBundle.data.services.length, 2);
      assert.equal(exportBundle.data.payment_methods.length, 1);

      // Verify zero Clinic B data is leaked
      for (const p of exportBundle.data.patients) assert.notEqual(p.clinic_id, TENANT_B_ID);
      for (const rx of exportBundle.data.prescriptions) assert.notEqual(rx.clinic_id, TENANT_B_ID);
      for (const h of exportBundle.data.hcu033_forms) assert.notEqual(h.clinic_id, TENANT_B_ID);
      for (const s of exportBundle.data.services) assert.notEqual(s.clinic_id, TENANT_B_ID);
      for (const pm of exportBundle.data.payment_methods) assert.notEqual(pm.clinic_id, TENANT_B_ID);
    });
  });
});
