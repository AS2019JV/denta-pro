/**
 * Action & API Route Sandboxed Runner
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (SEC-06, SEC-10, SEC-11)
 * - PROJECT.md (§ Interface Contracts)
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

/**
 * Spec-compliant mock implementation of inviteTeamMember based on PROJECT.md interface contract
 */
async function specInviteTeamMember(caller, formData) {
  // Invariant 1: Caller must be authenticated
  if (!caller || !caller.userId) {
    throw new Error('401 Unauthorized: Session required');
  }

  const clinicId = formData.get('clinicId');
  const email = formData.get('email');
  const role = formData.get('role') || 'receptionist';

  if (!email || !clinicId) {
    throw new Error('400 Bad Request: Missing email or clinicId');
  }

  // Invariant 2: Caller must be clinic_owner of the specified clinic
  if (caller.role !== 'clinic_owner' || caller.clinicId !== clinicId) {
    throw new Error('403 Forbidden: Caller is not an authorized owner of the clinic');
  }

  // Invariant 3: Disallow inviting rogue clinic_owner
  if (role === 'clinic_owner' || !['doctor', 'receptionist'].includes(role)) {
    throw new Error('400 Bad Request: Cannot invite role clinic_owner');
  }

  // Invariant 4: Return { success: true }. NEVER leak inviteLink or token_hash!
  return {
    success: true,
  };
}

/**
 * Spec-compliant mock implementation of /api/send-email based on PROJECT.md interface contract
 */
async function specSendEmailRoute(caller, requestBody) {
  // Invariant 1: Session authentication required
  if (!caller || !caller.userId) {
    return {
      status: 401,
      body: { error: 'Unauthorized: Authentication required' },
    };
  }

  const { to, template, variables, html } = requestBody;

  // Invariant 2: Reject arbitrary caller-supplied HTML
  if (html) {
    return {
      status: 400,
      body: { error: 'Bad Request: Arbitrary HTML messages are forbidden. Enforce pre-approved templates.' },
    };
  }

  if (!to || !template) {
    return {
      status: 400,
      body: { error: 'Bad Request: Missing required fields (to, template)' },
    };
  }

  // Invariant 3: Pre-approved template enum
  const allowedTemplates = ['appointment_reminder', 'welcome', 'prescription_ready'];
  if (!allowedTemplates.includes(template)) {
    return {
      status: 400,
      body: { error: `Bad Request: Invalid template '${template}'` },
    };
  }

  // Invariant 4: Recipient validation (must belong to clinic patients or staff)
  const allowedRecipients = [
    'juan.perez@example.com',
    'maria.lopez@example.com',
    'doctor-a@clinic-a.com',
    'recep-a@clinic-a.com',
  ];

  if (!allowedRecipients.includes(to)) {
    return {
      status: 403,
      body: { error: 'Forbidden: Recipient email is not associated with this clinic' },
    };
  }

  return {
    status: 200,
    body: { success: true, messageId: `msg_${Date.now()}` },
  };
}

/**
 * Loads and transpiles a TypeScript source file into an isolated VM context
 */
function loadSourceModule(relPath, customEnv = {}, customGlobals = {}) {
  const fullPath = join(__dirname, '../../..', relPath);
  const source = readFileSync(fullPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const exports = {};
  const module = { exports };

  const sandbox = {
    exports,
    module,
    require: (mod) => {
      if (mod === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => ({
              status: init?.status || 200,
              json: async () => body,
              body,
            }),
          },
        };
      }
      if (mod === '@/lib/env') {
        return {
          env: {
            RESEND_API_KEY: customEnv.RESEND_API_KEY || 'test_resend_key',
            RESEND_FROM_EMAIL: 'Clinia + <soporte@cliniaplus.com>',
          },
        };
      }
      return require(mod);
    },
    process: { env: { ...process.env, ...customEnv } },
    console: { log() {}, error() {}, warn() {} },
    ...customGlobals,
  };

  vm.runInNewContext(compiled, sandbox, { filename: relPath });
  return sandbox.module.exports;
}

module.exports = {
  specInviteTeamMember,
  specSendEmailRoute,
  loadSourceModule,
};
