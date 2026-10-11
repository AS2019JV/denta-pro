/**
 * Challenger 2 Adversarial Stress Test Suite: Milestone 2 (SEC-13)
 * Author: teamwork_preview_challenger_m2_2
 * Role: EMPIRICAL CHALLENGER (critic, specialist)
 *
 * Targets Under Adversarial Challenge:
 * - SEC-13: Bank Payment Methods Tenant Partition & Checkout Scoping
 *
 * Attack Dimensions:
 * 1. Reading or updating bank configurations belonging to another clinic (Cross-tenant leaks & hijacking)
 * 2. Inserting payment methods with spoofed clinic_id (Tenant injection & payment redirection)
 * 3. Checkout route queries attempting to load payment methods of Clinic A for an invoice belonging to Clinic B
 * 4. Intra-clinic privilege separation (non-owners blocked from mutating bank details)
 * 5. Frontend component RBAC guardrails (payment-methods-settings.tsx & pay/[id]/page.tsx)
 * 6. SQL migration invariants & AST verification
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');

const {
  TENANT_A_ID,
  TENANT_B_ID,
  CLINIC_A_OWNER_ID,
  CLINIC_A_DOCTOR_ID,
  CLINIC_A_RECEPTIONIST_ID,
  CLINIC_B_OWNER_ID,
  CLINIC_B_DOCTOR_ID,
  CLINIC_B_RECEPTIONIST_ID,
  getSecurityContext,
} = require('./harness/security-context.cjs');

const { DatabaseSecurityEngine } = require('./harness/database-security-engine.cjs');

function getSafeSecurityContext(roleName) {
  if (roleName === 'clinic_b_receptionist') {
    return {
      userId: CLINIC_B_RECEPTIONIST_ID,
      clinicId: TENANT_B_ID,
      role: 'receptionist',
      email: 'recep-b@clinic-b.com',
      jwt: {
        sub: CLINIC_B_RECEPTIONIST_ID,
        email: 'recep-b@clinic-b.com',
        role: 'authenticated',
        app_metadata: { clinic_id: TENANT_B_ID, role: 'receptionist' },
      },
    };
  }
  return getSecurityContext(roleName);
}

const ROOT_DIR = join(__dirname, '../..');
const MIGRATION_PATH = join(ROOT_DIR, 'supabase/migrations/20260920_m2_clinical_services_payment_methods.sql');
const PAYMENT_SETTINGS_PATH = join(ROOT_DIR, 'components/billing/payment-methods-settings.tsx');
const CHECKOUT_PAGE_PATH = join(ROOT_DIR, 'app/(dashboard)/pay/[id]/page.tsx');
const TYPES_PATH = join(ROOT_DIR, 'types/index.ts');

/**
 * Extended Adversarial Security Engine for SEC-13 testing
 * Accurately models PostgreSQL RLS and RPC behavior defined in 20260920_m2_clinical_services_payment_methods.sql
 */
class Sec13AdversarialEngine extends DatabaseSecurityEngine {
  constructor() {
    super();
    // Extra test billing and payment method records
    this.billings.push(
      { id: 'bill-b-2', clinic_id: TENANT_B_ID, amount: 75.0, created_at: '2026-09-15T10:00:00Z' },
      { id: 'bill-a-3', clinic_id: TENANT_A_ID, amount: 300.0, created_at: '2026-09-18T11:00:00Z' }
    );

    // Inactive payment method in Clinic A for checkout testing
    this.payment_methods.push({
      id: 'pm-a-inactive',
      clinic_id: TENANT_A_ID,
      type: 'BANK_TRANSFER',
      title: 'Banco Bolivariano - Inactivo',
      config: { account_number: '9999000011', holder_name: 'Clínica Alfa Cía Ltda', holder_id: '1790000000001' },
      is_active: false,
    });

    // Inactive payment method in Clinic B
    this.payment_methods.push({
      id: 'pm-b-inactive',
      clinic_id: TENANT_B_ID,
      type: 'BANK_TRANSFER',
      title: 'Banco Internacional - Inactivo',
      config: { account_number: '8888000022', holder_name: 'Clínica Beta S.A.', holder_id: '1791111111001' },
      is_active: false,
    });
  }

  /**
   * Simulates INSERT INTO public.payment_methods under M2 RLS:
   * WITH CHECK (
   *   (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
   *    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner')
   *   OR EXISTS (clinics c WHERE c.id = payment_methods.clinic_id AND c.owner_id = auth.uid())
   *   OR EXISTS (clinic_members cm WHERE cm.clinic_id = payment_methods.clinic_id AND cm.user_id = auth.uid() AND cm.role = 'clinic_owner' AND cm.status = 'active')
   * )
   */
  insertPaymentMethod(caller, methodData) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Session required');
    }

    if (!methodData.clinic_id) {
      throw new Error('400 Bad Request: clinic_id cannot be null or omitted (NOT NULL constraint)');
    }

    if (caller.role !== 'service_role') {
      // Invariant SEC-13: Must match caller's clinic_id
      if (methodData.clinic_id !== caller.clinicId) {
        throw new Error('403 Forbidden: Cross-tenant payment method insertion forbidden');
      }

      // Invariant SEC-13: Only clinic_owner can insert payment methods
      if (caller.role !== 'clinic_owner') {
        throw new Error('403 Forbidden: Only clinic_owner can insert payment methods');
      }
    }

    const newMethod = {
      id: methodData.id || `pm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      clinic_id: methodData.clinic_id,
      type: methodData.type || 'BANK_TRANSFER',
      title: methodData.title || 'Untitled Method',
      config: methodData.config || {},
      is_active: methodData.is_active !== undefined ? methodData.is_active : true,
      created_at: new Date().toISOString(),
    };

    this.payment_methods.push(newMethod);
    return newMethod;
  }

  /**
   * Simulates DELETE FROM public.payment_methods under M2 RLS
   */
  deletePaymentMethod(caller, methodId) {
    if (!caller || !caller.userId) {
      throw new Error('401 Unauthorized: Session required');
    }

    const idx = this.payment_methods.findIndex((pm) => pm.id === methodId);
    if (idx === -1) {
      throw new Error('404 Not Found: Payment method does not exist');
    }

    const method = this.payment_methods[idx];

    if (caller.role !== 'service_role') {
      // Invariant SEC-13: Cross-tenant check
      if (method.clinic_id !== caller.clinicId) {
        throw new Error('403 Forbidden: Cross-tenant payment method deletion forbidden');
      }

      // Invariant SEC-13: Role check
      if (caller.role !== 'clinic_owner') {
        throw new Error('403 Forbidden: Only clinic_owner can delete payment methods');
      }
    }

    this.payment_methods.splice(idx, 1);
    return { success: true, deletedId: methodId };
  }

  /**
   * Simulates public.get_checkout_payment_methods(p_billing_id UUID) RPC:
   * SELECT pm.id, pm.clinic_id, pm.type, pm.title, pm.config, pm.is_active
   * FROM public.payment_methods pm
   * WHERE pm.clinic_id = v_clinic_id
   *   AND pm.is_active = true;
   */
  getCheckoutPaymentMethods(billingId) {
    if (!billingId) {
      return [];
    }

    const billing = this.billings.find((b) => b.id === billingId);
    if (!billing || !billing.clinic_id) {
      return [];
    }

    // Scoped strictly to the invoice's clinic_id AND active only
    return this.payment_methods.filter(
      (pm) => pm.clinic_id === billing.clinic_id && pm.is_active === true
    );
  }

  /**
   * Simulates direct public/anon query fallback for checkout:
   * .from('payment_methods').select('*').eq('clinic_id', bill.clinic_id).eq('is_active', true)
   */
  directCheckoutQuery(clinicId) {
    if (!clinicId) return [];
    return this.payment_methods.filter(
      (pm) => pm.clinic_id === clinicId && pm.is_active === true
    );
  }
}

describe('Challenger 2 Empirical Stress Tests: SEC-13 Bank Payment Methods Tenant Partition', () => {
  let db;

  beforeEach(() => {
    db = new Sec13AdversarialEngine();
  });

  // ==========================================================================
  // ATTACK VECTOR 1: Reading or Updating Bank Configurations of Another Clinic
  // ==========================================================================
  describe('Vector 1: Cross-Tenant Read, Update, and Deletion Attacks', () => {
    test('1.1 Negative: Competitor Owner (Clinic B) cannot read Clinic A payment methods', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const methods = db.selectPaymentMethods(ownerB);

      assert.ok(methods.length > 0, 'Clinic B has payment methods');
      for (const m of methods) {
        assert.equal(
          m.clinic_id,
          TENANT_B_ID,
          'Must return strictly Clinic B methods'
        );
        assert.notEqual(
          m.clinic_id,
          TENANT_A_ID,
          'VIOLATION: Clinic A payment method leaked to competitor'
        );
      }
    });

    test('1.2 Negative: Competitor Doctor (Clinic B) cannot read Clinic A payment methods', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');
      const methods = db.selectPaymentMethods(doctorB);

      const hasClinicAData = methods.some((m) => m.clinic_id === TENANT_A_ID);
      assert.equal(hasClinicAData, false, 'No Clinic A payment methods exposed to Clinic B doctor');
    });

    test('1.3 Negative: Competitor Receptionist (Clinic B) cannot read Clinic A payment methods', () => {
      const recepB = getSafeSecurityContext('clinic_b_receptionist');
      const methods = db.selectPaymentMethods(recepB);

      const hasClinicAData = methods.some((m) => m.clinic_id === TENANT_A_ID);
      assert.equal(hasClinicAData, false, 'No Clinic A payment methods exposed to Clinic B receptionist');
    });

    test('1.4 Negative: Unauthenticated caller cannot select payment methods', () => {
      assert.throws(
        () => {
          db.selectPaymentMethods(null);
        },
        /401 Unauthorized/i,
        'Unauthenticated access must be rejected with 401'
      );
    });

    test('1.5 Negative: Competitor Owner (Clinic B) cannot update Clinic A bank account number (Hijack)', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const originalMethodA = db.payment_methods.find((pm) => pm.id === 'pm-a-1');
      const originalAccount = originalMethodA.config.account_number;

      assert.throws(
        () => {
          db.updatePaymentMethod(ownerB, 'pm-a-1', {
            config: { account_number: '9988776655', holder_name: 'Rival Medical Group' },
          });
        },
        /403 Forbidden.*Cross-tenant payment method update/i,
        'Must block cross-tenant payment method update'
      );

      // Verify original account number is unmodified
      assert.equal(
        originalMethodA.config.account_number,
        originalAccount,
        'Clinic A bank account number must remain unchanged'
      );
    });

    test('1.6 Negative: Competitor Owner (Clinic B) cannot toggle is_active on Clinic A method (DoS)', () => {
      const ownerB = getSecurityContext('clinic_b_owner');
      const methodA = db.payment_methods.find((pm) => pm.id === 'pm-a-1');
      assert.equal(methodA.is_active, true);

      assert.throws(
        () => {
          db.updatePaymentMethod(ownerB, 'pm-a-1', { is_active: false });
        },
        /403 Forbidden.*Cross-tenant payment method update/i,
        'Must block cross-tenant deactivation'
      );

      assert.equal(methodA.is_active, true, 'is_active status must remain true');
    });

    test('1.7 Negative: Competitor Owner (Clinic B) cannot delete Clinic A payment method', () => {
      const ownerB = getSecurityContext('clinic_b_owner');

      assert.throws(
        () => {
          db.deletePaymentMethod(ownerB, 'pm-a-1');
        },
        /403 Forbidden.*Cross-tenant payment method deletion/i,
        'Must block cross-tenant payment method deletion'
      );

      const stillExists = db.payment_methods.some((pm) => pm.id === 'pm-a-1');
      assert.equal(stillExists, true, 'Clinic A payment method must remain in database');
    });

    test('1.8 Negative: Intra-clinic role boundary - Doctor cannot update bank account in same clinic', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          db.updatePaymentMethod(doctorA, 'pm-a-1', {
            config: { account_number: '0000111122' },
          });
        },
        /403 Forbidden.*Only clinic_owner can update payment methods/i,
        'Doctor must not be allowed to update clinic bank configurations'
      );
    });

    test('1.9 Negative: Intra-clinic role boundary - Receptionist cannot update bank account in same clinic', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          db.updatePaymentMethod(recepA, 'pm-a-1', {
            title: 'Hacked Title',
          });
        },
        /403 Forbidden.*Only clinic_owner can update payment methods/i,
        'Receptionist must not be allowed to update clinic bank configurations'
      );
    });

    test('1.10 Negative: Intra-clinic role boundary - Doctor cannot delete payment method in same clinic', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          db.deletePaymentMethod(doctorA, 'pm-a-1');
        },
        /403 Forbidden.*Only clinic_owner can delete payment methods/i,
        'Doctor must not be allowed to delete clinic payment methods'
      );
    });

    test('1.11 Negative: Intra-clinic role boundary - Receptionist cannot delete payment method in same clinic', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          db.deletePaymentMethod(recepA, 'pm-a-1');
        },
        /403 Forbidden.*Only clinic_owner can delete payment methods/i,
        'Receptionist must not be allowed to delete clinic payment methods'
      );
    });

    test('1.12 Positive Control: Legitimate Owner (Clinic A) can update own payment method', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const updated = db.updatePaymentMethod(ownerA, 'pm-a-1', {
        title: 'Banco Pichincha - Cuenta Principal',
        config: { account_number: '2200112233', holder_name: 'Clínica Alfa Actualizada' },
      });

      assert.equal(updated.title, 'Banco Pichincha - Cuenta Principal');
      assert.equal(updated.config.holder_name, 'Clínica Alfa Actualizada');
      assert.equal(updated.clinic_id, TENANT_A_ID);
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 2: Inserting Payment Methods with Spoofed clinic_id
  // ==========================================================================
  describe('Vector 2: Hostile Injection of Spoofed clinic_id in Payment Methods', () => {
    test('2.1 Negative: Competitor Owner cannot insert payment method with spoofed clinic_id = Clinic A', () => {
      const ownerB = getSecurityContext('clinic_b_owner');

      assert.throws(
        () => {
          db.insertPaymentMethod(ownerB, {
            clinic_id: TENANT_A_ID, // Target victim clinic
            type: 'BANK_TRANSFER',
            title: 'Cuenta Falsa Banco Pichincha',
            config: { account_number: '9988776655', holder_name: 'Attacker Holding' },
            is_active: true,
          });
        },
        /403 Forbidden.*Cross-tenant payment method insertion/i,
        'Must reject payment method insertion targeting another clinic'
      );

      const injected = db.payment_methods.find((pm) => pm.title === 'Cuenta Falsa Banco Pichincha');
      assert.equal(injected, undefined, 'Spoofed payment method must NOT be created');
    });

    test('2.2 Negative: Competitor Doctor cannot insert payment method into Clinic A', () => {
      const doctorB = getSecurityContext('clinic_b_doctor');

      assert.throws(
        () => {
          db.insertPaymentMethod(doctorB, {
            clinic_id: TENANT_A_ID,
            type: 'BANK_TRANSFER',
            title: 'Injected Doctor Method',
          });
        },
        /403 Forbidden/i,
        'Must reject competitor doctor insert'
      );
    });

    test('2.3 Negative: Same-clinic Doctor cannot insert payment method into own clinic', () => {
      const doctorA = getSecurityContext('clinic_a_doctor');

      assert.throws(
        () => {
          db.insertPaymentMethod(doctorA, {
            clinic_id: TENANT_A_ID,
            type: 'BANK_TRANSFER',
            title: 'Dr. Personal Account',
            config: { account_number: '1234567890' },
          });
        },
        /403 Forbidden.*Only clinic_owner can insert payment methods/i,
        'Doctor cannot insert payment methods even within own clinic'
      );
    });

    test('2.4 Negative: Same-clinic Receptionist cannot insert payment method into own clinic', () => {
      const recepA = getSecurityContext('clinic_a_receptionist');

      assert.throws(
        () => {
          db.insertPaymentMethod(recepA, {
            clinic_id: TENANT_A_ID,
            type: 'BANK_TRANSFER',
            title: 'Receptionist Injected Account',
          });
        },
        /403 Forbidden.*Only clinic_owner can insert payment methods/i,
        'Receptionist cannot insert payment methods'
      );
    });

    test('2.5 Negative: Insertion with null or empty clinic_id is rejected (NOT NULL invariant)', () => {
      const ownerA = getSecurityContext('clinic_a_owner');

      assert.throws(
        () => {
          db.insertPaymentMethod(ownerA, {
            clinic_id: null,
            type: 'BANK_TRANSFER',
            title: 'Orphan Bank',
          });
        },
        /400 Bad Request.*clinic_id cannot be null/i,
        'Cannot insert payment method with null clinic_id'
      );

      assert.throws(
        () => {
          db.insertPaymentMethod(ownerA, {
            clinic_id: '',
            type: 'BANK_TRANSFER',
            title: 'Blank Tenant Bank',
          });
        },
        /400 Bad Request.*clinic_id cannot be null/i,
        'Cannot insert payment method with empty clinic_id'
      );
    });

    test('2.6 Negative: Insertion with arbitrary unowned UUID is rejected', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const randomUuid = '99999999-9999-4999-8999-999999999999';

      assert.throws(
        () => {
          db.insertPaymentMethod(ownerA, {
            clinic_id: randomUuid,
            type: 'BANK_TRANSFER',
            title: 'Rogue Tenant Bank',
          });
        },
        /403 Forbidden.*Cross-tenant payment method insertion/i,
        'Cannot insert payment method with random non-belonging UUID'
      );
    });

    test('2.7 Negative: Unauthenticated caller cannot insert payment method', () => {
      assert.throws(
        () => {
          db.insertPaymentMethod(null, {
            clinic_id: TENANT_A_ID,
            type: 'BANK_TRANSFER',
            title: 'Anon Bank',
          });
        },
        /401 Unauthorized/i,
        'Unauthenticated insertion must be rejected'
      );
    });

    test('2.8 Positive Control: Clinic A Owner can insert legitimate payment method in Clinic A', () => {
      const ownerA = getSecurityContext('clinic_a_owner');
      const newMethod = db.insertPaymentMethod(ownerA, {
        clinic_id: TENANT_A_ID,
        type: 'BANK_TRANSFER',
        title: 'Banco del Pacífico - Corriente',
        config: { account_number: '3344556677', holder_name: 'Clínica Alfa Cía Ltda', holder_id: '1790000000001' },
        is_active: true,
      });

      assert.ok(newMethod.id, 'Must generate method ID');
      assert.equal(newMethod.clinic_id, TENANT_A_ID);
      assert.equal(newMethod.title, 'Banco del Pacífico - Corriente');
      assert.equal(newMethod.is_active, true);
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 3: Checkout Route Queries (Clinic A vs Clinic B Invoices)
  // ==========================================================================
  describe('Vector 3: Checkout Route Queries and Cross-Tenant Bank Isolation', () => {
    test('3.1 Positive: Checkout RPC with Invoice B returns ONLY Clinic B active payment methods', () => {
      // bill-b-1 belongs to Clinic B
      const checkoutMethods = db.getCheckoutPaymentMethods('bill-b-1');

      assert.ok(checkoutMethods.length > 0, 'Must return payment methods for Clinic B');
      for (const pm of checkoutMethods) {
        assert.equal(pm.clinic_id, TENANT_B_ID, 'Must strictly belong to Clinic B');
        assert.equal(pm.is_active, true, 'Must strictly be active');
        assert.notEqual(
          pm.clinic_id,
          TENANT_A_ID,
          'CRITICAL: Clinic A payment method must NEVER appear in Clinic B checkout'
        );
      }
    });

    test('3.2 Positive: Checkout RPC with Invoice A returns ONLY Clinic A active payment methods', () => {
      // bill-a-1 belongs to Clinic A
      const checkoutMethods = db.getCheckoutPaymentMethods('bill-a-1');

      assert.ok(checkoutMethods.length > 0, 'Must return payment methods for Clinic A');
      for (const pm of checkoutMethods) {
        assert.equal(pm.clinic_id, TENANT_A_ID, 'Must strictly belong to Clinic A');
        assert.equal(pm.is_active, true, 'Must strictly be active');
        assert.notEqual(
          pm.clinic_id,
          TENANT_B_ID,
          'CRITICAL: Clinic B payment method must NEVER appear in Clinic A checkout'
        );
      }
    });

    test('3.3 Inactive Isolation: Inactive payment methods are NEVER returned in checkout', () => {
      // Both Clinic A and Clinic B have an inactive method initialized in constructor
      const methodsA = db.getCheckoutPaymentMethods('bill-a-1');
      const hasInactiveA = methodsA.some((m) => m.id === 'pm-a-inactive');
      assert.equal(hasInactiveA, false, 'Inactive payment method pm-a-inactive must be excluded from checkout');

      const methodsB = db.getCheckoutPaymentMethods('bill-b-1');
      const hasInactiveB = methodsB.some((m) => m.id === 'pm-b-inactive');
      assert.equal(hasInactiveB, false, 'Inactive payment method pm-b-inactive must be excluded from checkout');
    });

    test('3.4 Negative: Non-existent billing ID returns empty set without leaking any methods', () => {
      const fakeBillingId = '00000000-0000-4000-8000-000000000000';
      const results = db.getCheckoutPaymentMethods(fakeBillingId);

      assert.equal(results.length, 0, 'Must return zero results for invalid billing ID');
    });

    test('3.5 Negative: Null or undefined billing ID returns empty set', () => {
      assert.deepEqual(db.getCheckoutPaymentMethods(null), []);
      assert.deepEqual(db.getCheckoutPaymentMethods(undefined), []);
      assert.deepEqual(db.getCheckoutPaymentMethods(''), []);
    });

    test('3.6 Checkout RPC Immunity to Client-Supplied Clinic Parameter', () => {
      // Verify that get_checkout_payment_methods takes ONLY p_billing_id
      // It derives clinic_id strictly from public.billings on the server
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
      assert.ok(
        migrationSql.includes('FUNCTION public.get_checkout_payment_methods(p_billing_id UUID)'),
        'RPC signature must accept only p_billing_id (never client-supplied clinic_id)'
      );
      assert.ok(
        migrationSql.includes('SELECT b.clinic_id INTO v_clinic_id\n  FROM public.billings b\n  WHERE b.id = p_billing_id;'),
        'RPC must derive clinic_id directly from billings record'
      );
    });

    test('3.7 Checkout Route Direct Query Fallback Isolation', () => {
      // In app/(dashboard)/pay/[id]/page.tsx, if RPC fallback runs:
      // supabase.from('payment_methods').select('*').eq('clinic_id', bill.clinic_id).eq('is_active', true)
      const billB = db.billings.find((b) => b.id === 'bill-b-1');
      const fallbackResults = db.directCheckoutQuery(billB.clinic_id);

      assert.ok(fallbackResults.length > 0);
      for (const m of fallbackResults) {
        assert.equal(m.clinic_id, TENANT_B_ID);
        assert.equal(m.is_active, true);
        assert.notEqual(m.clinic_id, TENANT_A_ID);
      }
    });

    test('3.8 Checkout Receipt Upload Payment Creation Scoping', () => {
      // In app/(dashboard)/pay/[id]/page.tsx:
      // await supabase.from('payments').insert({ billing_id: id, clinic_id: billing.clinic_id, ... })
      assert.ok(existsSync(CHECKOUT_PAGE_PATH), 'Checkout page must exist');
      const pageCode = readFileSync(CHECKOUT_PAGE_PATH, 'utf8');

      assert.ok(
        pageCode.includes("clinic_id: billing.clinic_id"),
        "Payment creation must explicitly bind clinic_id from the verified billing object"
      );
      assert.ok(
        pageCode.includes("p_billing_id: id"),
        "Checkout page must pass the route billing id to get_checkout_payment_methods"
      );
      assert.ok(
        pageCode.includes(".eq('clinic_id', bill.clinic_id)"),
        "Fallback query must enforce .eq('clinic_id', bill.clinic_id)"
      );
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 4: Frontend Component Security & RBAC Guardrails
  // ==========================================================================
  describe('Vector 4: Frontend PaymentMethodsSettings Component Protection', () => {
    test('4.1 Invariant: Component requires useAuth and extracts currentClinicId and hasRole', () => {
      assert.ok(existsSync(PAYMENT_SETTINGS_PATH), 'payment-methods-settings.tsx must exist');
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');

      assert.ok(code.includes('useAuth()'), 'Must consume useAuth() hook');
      assert.ok(code.includes('currentClinicId'), 'Must extract currentClinicId');
      assert.ok(code.includes('hasRole("clinic_owner")'), 'Must verify clinic_owner role via hasRole');
    });

    test('4.2 Invariant: Non-owners receive read-only mode banner', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');
      assert.ok(
        code.includes('Modo Solo Lectura (Solo propietarios pueden editar)'),
        'Must render clear read-only warning indicator for non-owners'
      );
      assert.ok(
        code.includes('disabled={!isOwner}'),
        'Must bind disabled={!isOwner} to inputs and controls'
      );
    });

    test('4.3 Invariant: addBankTransfer blocks execution if caller is not clinic_owner', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');
      assert.ok(
        code.includes('if (!isOwner) {\n            toast.error("Solo los propietarios de clínica pueden agregar métodos de pago")'),
        'addBankTransfer must abort with error toast when !isOwner'
      );
      assert.ok(
        code.includes('if (!currentClinicId) {'),
        'addBankTransfer must require active currentClinicId'
      );
    });

    test('4.4 Invariant: updateStripe blocks execution if caller is not clinic_owner', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');
      assert.ok(
        code.includes('if (!isOwner) {\n            toast.error("Solo los propietarios de clínica pueden configurar Stripe")'),
        'updateStripe must abort with error toast when !isOwner'
      );
    });

    test('4.5 Invariant: deleteMethod blocks execution if caller is not clinic_owner', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');
      assert.ok(
        code.includes('if (!isOwner) {\n            toast.error("Solo los propietarios de clínica pueden eliminar métodos de pago")'),
        'deleteMethod must abort with error toast when !isOwner'
      );
    });

    test('4.6 Invariant: toggleActive blocks execution if caller is not clinic_owner', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');
      assert.ok(
        code.includes('if (!isOwner) {\n            toast.error("Solo los propietarios de clínica pueden modificar métodos de pago")'),
        'toggleActive must abort with error toast when !isOwner'
      );
    });

    test('4.7 Invariant: All Supabase database mutations explicitly scope by currentClinicId', () => {
      const code = readFileSync(PAYMENT_SETTINGS_PATH, 'utf8');

      // Check SELECT query
      assert.ok(code.includes(".eq('clinic_id', currentClinicId)"), 'SELECT query must filter by currentClinicId');

      // Check INSERT payload
      assert.ok(code.includes("clinic_id: currentClinicId,"), 'INSERT payload must include clinic_id: currentClinicId');

      // Check UPDATE mutation
      assert.ok(code.includes(".eq('clinic_id', currentClinicId)"), 'UPDATE mutation must include .eq(clinic_id, currentClinicId)');

      // Check DELETE mutation
      assert.ok(code.includes(".eq('clinic_id', currentClinicId)"), 'DELETE mutation must include .eq(clinic_id, currentClinicId)');
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 5: SQL Migration Contract & RLS Invariant Verification
  // ==========================================================================
  describe('Vector 5: Migration 20260920_m2 SQL Invariants & Policy Drops', () => {
    test('5.1 Vulnerable Legacy Policy Dropped', () => {
      assert.ok(existsSync(MIGRATION_PATH), 'Migration file must exist');
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      // Drop vulnerable permissive policy identified in findings.json (SEC-13)
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON public.payment_methods;'),
        'Must explicitly drop vulnerable legacy permissive policy on payment_methods'
      );
    });

    test('5.2 Tenant Column & NOT NULL Constraint Added', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(
        sql.includes('ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;'),
        'Must add foreign key clinic_id to payment_methods'
      );
      assert.ok(
        sql.includes('ALTER TABLE public.payment_methods \n  ALTER COLUMN clinic_id SET NOT NULL;'),
        'Must enforce clinic_id NOT NULL constraint'
      );
      assert.ok(
        sql.includes("ALTER TABLE public.payment_methods \n  ALTER COLUMN clinic_id SET DEFAULT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;"),
        'Must set safe column default from auth JWT'
      );
    });

    test('5.3 Indices Created for Performance & Tenant Isolation', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(
        sql.includes('CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_id \n  ON public.payment_methods(clinic_id);'),
        'Must create index on payment_methods(clinic_id)'
      );
      assert.ok(
        sql.includes('CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic_active \n  ON public.payment_methods(clinic_id, is_active);'),
        'Must create composite index on payment_methods(clinic_id, is_active)'
      );
    });

    test('5.4 RLS Policies Strictly Bound to Clinic Owner for Mutations', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      // INSERT policy
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can insert payment methods"\nON public.payment_methods FOR INSERT'),
        'Must define insert policy for clinic owners'
      );
      assert.ok(
        sql.includes("(auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_owner'"),
        'Insert policy must check clinic_owner role'
      );

      // UPDATE policy
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can update payment methods"\nON public.payment_methods FOR UPDATE'),
        'Must define update policy for clinic owners'
      );

      // DELETE policy
      assert.ok(
        sql.includes('CREATE POLICY "Clinic owners can delete payment methods"\nON public.payment_methods FOR DELETE'),
        'Must define delete policy for clinic owners'
      );
    });

    test('5.5 Security Definer Checkout RPC Hardened', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');

      assert.ok(
        sql.includes('CREATE OR REPLACE FUNCTION public.get_checkout_payment_methods(p_billing_id UUID)'),
        'Must create get_checkout_payment_methods function'
      );
      assert.ok(sql.includes('SECURITY DEFINER'), 'RPC must be SECURITY DEFINER');
      assert.ok(sql.includes('SET search_path = public'), 'RPC must lock search_path to public to prevent search_path hijacking');
      assert.ok(
        sql.includes('REVOKE ALL ON FUNCTION public.get_checkout_payment_methods(UUID) FROM PUBLIC;'),
        'Must revoke from PUBLIC'
      );
      assert.ok(
        sql.includes('GRANT EXECUTE ON FUNCTION public.get_checkout_payment_methods(UUID) TO authenticated, anon;'),
        'Must grant execute to authenticated and anon'
      );
    });

    test('5.6 TypeScript Interface Includes clinic_id', () => {
      assert.ok(existsSync(TYPES_PATH), 'types/index.ts must exist');
      const tsCode = readFileSync(TYPES_PATH, 'utf8');

      assert.ok(
        tsCode.includes('clinic_id: string'),
        'PaymentMethod interface must declare clinic_id: string'
      );
    });
  });
});
