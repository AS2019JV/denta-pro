/**
 * Gate 6: PROD-CHK-F02 Structured Logging & Clinical PII Leakage Prevention
 *
 * Scope:
 *  - Unit verification of lib/logger.ts PII redaction and masking routines
 *  - Free-text PII scrubbing (Ecuadorian 10-digit cédulas, emails)
 *  - Deep object/array sanitization (clinical conditions, allergies, passwords, tokens)
 *  - Circular reference and error object resilience
 *  - Static code audit of sensitive authentication and action routes (confirm, resend)
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('Gate 6: PROD-CHK-F02 Structured Logging & PII Sanitization', () => {

  // Dynamically load lib/logger.ts transpiled via TypeScript
  let loggerModule;
  try {
    const loggerCode = fs.readFileSync(path.join(ROOT_DIR, 'lib/logger.ts'), 'utf8');
    const vm = require('node:vm');
    const exports = {};
    const module = { exports };
    const transpiledJs = ts.transpileModule(loggerCode, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;

    const context = vm.createContext({
      exports,
      module,
      console,
      process: { env: { NODE_ENV: 'test' } },
      Set,
      WeakSet,
      Object,
      Array,
      Date,
      Error,
      String,
      Boolean,
      RegExp
    });
    vm.runInContext(transpiledJs, context);
    loggerModule = module.exports;
  } catch (err) {
    throw new Error(`Failed to load lib/logger.ts: ${err.message}`);
  }

  const { maskEmail, maskCedula, maskPhone, sanitizePII, logger } = loggerModule;

  // ==========================================================================
  // Suite 1: Masking Primitives (Emails, Cédulas, Phone Numbers)
  // ==========================================================================
  describe('1. Masking Primitives', () => {
    test('maskEmail obfuscates local-part while preserving domain', () => {
      assert.equal(maskEmail('carlos.perez@clinia.ec'), 'c***@clinia.ec');
      assert.equal(maskEmail('doctor@gmail.com'), 'd***@gmail.com');
      assert.equal(maskEmail('a@b.com'), 'a***@b.com');
      assert.equal(maskEmail(''), '');
      assert.equal(maskEmail(null), '');
      assert.equal(maskEmail(undefined), '');
      assert.equal(maskEmail('invalid-email'), '[MASKED_EMAIL]');
    });

    test('maskCedula masks leading digits preserving only last 4', () => {
      assert.equal(maskCedula('1712345678'), '******5678');
      assert.equal(maskCedula('0987654321'), '******4321');
      assert.equal(maskCedula('1234'), '****');
      assert.equal(maskCedula(''), '');
      assert.equal(maskCedula(null), '');
    });

    test('maskPhone masks leading digits preserving last 4', () => {
      assert.equal(maskPhone('+593991234567'), '*********4567');
      assert.equal(maskPhone('0991234567'), '******4567');
      assert.equal(maskPhone(null), '');
    });
  });

  // ==========================================================================
  // Suite 2: Deep PII & PHI Sanitization
  // ==========================================================================
  describe('2. Deep Object & Free-Text PII Sanitization', () => {
    test('Sanitizes confidential credentials and tokens', () => {
      const payload = {
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
        token_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        service_role_key: 'secret-service-role-key',
        nested: {
          access_token: 'sensitive-bearer-token',
          api_key: 're_secret_123'
        }
      };

      const sanitized = sanitizePII(payload);
      assert.equal(sanitized.password, '[REDACTED]');
      assert.equal(sanitized.token, '[REDACTED]');
      assert.equal(sanitized.token_hash, '[REDACTED]');
      assert.equal(sanitized.service_role_key, '[REDACTED]');
      assert.equal(sanitized.nested.access_token, '[REDACTED]');
      assert.equal(sanitized.nested.api_key, '[REDACTED]');
    });

    test('Sanitizes patient personal identifiers and contacts', () => {
      const patient = {
        name: 'Maria Elena Delgado',
        cedula: '1723456789',
        email: 'maria.delgado@example.com',
        phone: '0998765432'
      };

      const sanitized = sanitizePII(patient);
      assert.equal(sanitized.name, 'Maria Elena Delgado');
      assert.equal(sanitized.cedula, '******6789');
      assert.equal(sanitized.email, 'm***@example.com');
      assert.equal(sanitized.phone, '******5432');
    });

    test('Omits sensitive clinical health fields (PHI)', () => {
      const clinicalRecord = {
        patient_id: 'c8a2b5e0-1234-5678-9abc-def012345678',
        medical_conditions: ['Diabetes Tipo 2', 'Hipertensión Arterial'],
        allergies: ['Penicilina', 'Lidocaína'],
        diagnosis: 'Periodontitis apical crónica pieza 14',
        odontogram_data: { arches: { upper: {}, lower: {} } },
        periodontogram_state: { pockets: [3, 4, 5] },
        prescriptions: [{ drug: 'Amoxicilina 500mg', dosage: 'Cada 8 horas por 7 días' }]
      };

      const sanitized = sanitizePII(clinicalRecord);
      assert.equal(sanitized.patient_id, 'c8a2b5e0-1234-5678-9abc-def012345678');
      assert.equal(sanitized.medical_conditions, '[CLINICAL_DATA_OMITTED]');
      assert.equal(sanitized.allergies, '[CLINICAL_DATA_OMITTED]');
      assert.equal(sanitized.diagnosis, '[CLINICAL_DATA_OMITTED]');
      assert.equal(sanitized.odontogram_data, '[CLINICAL_DATA_OMITTED]');
      assert.equal(sanitized.periodontogram_state, '[CLINICAL_DATA_OMITTED]');
      assert.equal(sanitized.prescriptions, '[CLINICAL_DATA_OMITTED]');
    });

    test('Redacts PII embedded in free-text messages', () => {
      const message = 'El paciente con cédula 1798765432 y correo juan.perez@clinia.ec ha sido registrado';
      const sanitized = sanitizePII(message);
      assert.equal(
        sanitized,
        'El paciente con cédula ******5432 y correo j***@clinia.ec ha sido registrado'
      );
    });

    test('Handles circular references gracefully without crashing', () => {
      const circularObj = { name: 'Test Object' };
      circularObj.self = circularObj;

      assert.doesNotThrow(() => {
        const sanitized = sanitizePII(circularObj);
        assert.equal(sanitized.name, 'Test Object');
        assert.equal(sanitized.self, '[CIRCULAR]');
      });
    });

    test('Handles native Error instances safely', () => {
      const error = new Error('Falló conexión para usuario con cédula 1712345678');
      const sanitized = sanitizePII(error);
      assert.equal(sanitized.name, 'Error');
      assert.ok(sanitized.message.includes('******5678'));
    });
  });

  // ==========================================================================
  // Suite 3: Static AST Security Audit on Authentication and Action Routes
  // ==========================================================================
  describe('3. Static AST Security Audit on Logging Ingress Points', () => {
    test('app/api/auth/confirm/route.ts does NOT leak token_hash or raw searchParams into console', () => {
      const routePath = path.join(ROOT_DIR, 'app/api/auth/confirm/route.ts');
      assert.ok(fs.existsSync(routePath), 'Confirm route must exist');
      const content = fs.readFileSync(routePath, 'utf8');

      // Verify no direct console.log dumping searchParams or token_hash
      assert.ok(
        !content.includes("console.log('[Auth Confirm] Full Search Params'"),
        'Must NOT log full searchParams'
      );
      assert.ok(
        !content.includes("console.log('[Auth Confirm] Attempting to verify OTP with type:', type, 'and token_hash:', token_hash)"),
        'Must NOT log raw token_hash'
      );
      // Verify logger usage
      assert.ok(content.includes('logger.info'), 'Must use structured logger.info');
    });

    test('app/actions/resend-confirmation.ts masks email before logging', () => {
      const actionPath = path.join(ROOT_DIR, 'app/actions/resend-confirmation.ts');
      assert.ok(fs.existsSync(actionPath), 'Resend confirmation action must exist');
      const content = fs.readFileSync(actionPath, 'utf8');

      assert.ok(
        !content.includes('console.log(`Resending confirmation to ${email}...`)'),
        'Must NOT log raw unmasked email'
      );
      assert.ok(content.includes('maskEmail'), 'Must import or use maskEmail');
    });
  });
});
