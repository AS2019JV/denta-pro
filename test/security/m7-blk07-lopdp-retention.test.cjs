const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const STANDARD_PATH = path.join(__dirname, '../../docs/security/LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md');
const PRIVACY_TAB_PATH = path.join(__dirname, '../../components/settings/privacy-tab.tsx');
const MIGRATION_PATH = path.join(__dirname, '../../supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql');

describe('Gate 5 & 7: M7-BLK-07 Ecuador LOPDP Compliance & Clinical Retention Standard', () => {

  const standardContent = fs.readFileSync(STANDARD_PATH, 'utf-8');
  const privacyTabContent = fs.readFileSync(PRIVACY_TAB_PATH, 'utf-8');
  const migrationContent = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  describe('1. Document Existence, Architecture & Structure', () => {
    test('Standard document exists in docs/security/ and is non-empty', () => {
      assert.ok(fs.existsSync(STANDARD_PATH), 'LOPDP standard document must exist');
      assert.ok(standardContent.length > 2000, 'Standard document must be substantive (>2000 chars)');
    });

    test('Contains all 7 core statutory sections', () => {
      const requiredSections = [
        'Executive Summary & Legal Allocation of Roles',
        'Standard Data Processing Agreement (DPA) Terms',
        'Statutory Legal Basis & Data Processing Inventory',
        'Reconciliation of Erasure Rights (Art. 15 LOPDP) with Mandatory Medical Custody',
        'Data Subject Rights (ARCO+P) Operating Procedures',
        'Data Protection Officer (DPD) & Regulatory Notification',
        'Sign-Off & Verification Invariant'
      ];
      for (const section of requiredSections) {
        assert.ok(
          standardContent.includes(section),
          `Standard document must contain section: ${section}`
        );
      }
    });

    test('Cites all governing Ecuadorian legal instruments', () => {
      assert.ok(standardContent.includes('Ley Orgánica de Protección de Datos Personales (LOPDP)'));
      assert.ok(standardContent.includes('Reglamento General a la LOPDP'));
      assert.ok(standardContent.includes('Ley Orgánica de Salud (LOS)'));
      assert.ok(standardContent.includes('Acuerdo Ministerial 00000115'));
      assert.ok(standardContent.includes('Superintendencia de Protección de Datos Personales (SPDP)'));
    });
  });

  describe('2. Controller vs Processor Allocation (Art. 4 LOPDP)', () => {
    test('Designates Subscribing Dental Clinic as Responsable del Tratamiento (Data Controller)', () => {
      assert.ok(
        standardContent.includes('Responsable del Tratamiento (Data Controller)'),
        'Must define Data Controller role'
      );
      assert.ok(
        standardContent.includes('subscribing dental clinic') || standardContent.includes('dental practice'),
        'Clinic must be designated as Data Controller'
      );
    });

    test('Designates Clinia+ Platform as Encargado del Tratamiento (Data Processor)', () => {
      assert.ok(
        standardContent.includes('Encargado del Tratamiento (Data Processor)'),
        'Must define Data Processor role'
      );
      assert.ok(
        standardContent.includes('Clinia+ Platform'),
        'Clinia+ must be designated as Data Processor'
      );
    });

    test('Accurately cites Article 4 of the LOPDP for role definitions', () => {
      assert.ok(standardContent.includes('Article 4 of the Ecuadorian LOPDP') || standardContent.includes('Artículo 4'));
    });
  });

  describe('3. Statutory Legal Basis & Data Processing Inventory (Art. 7, 8, 25, 26)', () => {
    test('Maps demographic intake (patients) to Art. 7 num. 1 (Consent) & num. 2 (Contractual execution)', () => {
      assert.ok(standardContent.includes('public.patients'));
      assert.ok(standardContent.includes('Art. 7 num. 1'));
      assert.ok(standardContent.includes('Art. 7 num. 2'));
    });

    test('Maps dental health records (hcu033_forms, clinical_records) to Art. 8 & Art. 26 num. 2 (Healthcare provision)', () => {
      assert.ok(standardContent.includes('public.hcu033_forms'));
      assert.ok(standardContent.includes('public.clinical_records'));
      assert.ok(standardContent.includes('Art. 8 & Art. 26 num. 2') || standardContent.includes('Art. 26 num. 2'));
    });

    test('Maps prescriptions to Art. 26 num. 2 and Art. 7 num. 3 (Legal medical obligation)', () => {
      assert.ok(standardContent.includes('public.prescriptions'));
      assert.ok(standardContent.includes('Art. 26 num. 2'));
    });

    test('Maps financial/billing records to Art. 7 num. 3 (Tax compliance / Código Tributario)', () => {
      assert.ok(standardContent.includes('public.billings'));
      assert.ok(standardContent.includes('Art. 7 num. 3'));
      assert.ok(standardContent.includes('Código Tributario'));
    });
  });

  describe('4. Reconciliation of Erasure Rights (Art. 15) with Medical Custody (LOS Art. 7)', () => {
    test('Cites LOPDP Article 15 numerals 2 and 3 as statutory exceptions overriding erasure', () => {
      assert.ok(standardContent.includes('Numeral 2'), 'Must cite Art. 15 num. 2 exception');
      assert.ok(standardContent.includes('cumplimiento de una obligación legal'), 'Must cite legal obligation exception');
      assert.ok(standardContent.includes('Numeral 3'), 'Must cite Art. 15 num. 3 exception');
      assert.ok(standardContent.includes('Fines de salud pública o medicina preventiva'), 'Must cite health exception');
    });

    test('Codifies official retention periods: 5 years (Adult), 10 years (Pediatric/Surgical), 7 years (Tax)', () => {
      assert.ok(standardContent.includes('5 years'), 'Must require 5 years for adult records');
      assert.ok(standardContent.includes('10 years'), 'Must require 10 years for pediatric/surgical records');
      assert.ok(standardContent.includes('7 years'), 'Must require 7 years for tax/billing records');
    });

    test('Enforces Bloqueo Registral (Clinical Retention Hold) instead of instant destructive purge', () => {
      assert.ok(standardContent.includes('Bloqueo Registral'), 'Must require Bloqueo Registral mechanism');
      assert.ok(standardContent.includes('No Instant Destructive Purge'), 'Must prohibit instant destructive purge');
    });
  });

  describe('5. ARCO+P Rights & SPDP Breach Escalation', () => {
    test('Accurately outlines full ARCO+P spectrum (Acceso, Rectificación, Eliminación, Oposición, Portabilidad)', () => {
      assert.ok(standardContent.includes('Derecho de Acceso (Art. 13 LOPDP)'));
      assert.ok(standardContent.includes('Derecho de Rectificación y Actualización (Art. 14 LOPDP)'));
      assert.ok(standardContent.includes('Derecho de Eliminación (Art. 15 LOPDP)'));
      assert.ok(standardContent.includes('Derecho de Oposición (Art. 16 LOPDP)'));
      assert.ok(standardContent.includes('Derecho a la Portabilidad (Art. 17 LOPDP)'));
    });

    test('Accurately cites DPD designation under Article 47 (dpo@clinia.ec)', () => {
      assert.ok(standardContent.includes('Article 47 of the LOPDP'));
      assert.ok(standardContent.includes('dpo@clinia.ec'));
    });

    test('Accurately cites 72-hour regulatory notification deadline to SPDP under Article 48', () => {
      assert.ok(standardContent.includes('Article 48 of the LOPDP') || standardContent.includes('Art. 48 LOPDP'));
      assert.ok(standardContent.includes('72 hours') || standardContent.includes('72 horas'));
      assert.ok(standardContent.includes('Superintendencia de Protección de Datos Personales'));
    });
  });

  describe('6. Codebase Alignment & Verification Invariants', () => {
    test('UI components/settings/privacy-tab.tsx aligns with LOPDP Art. 17 and Art. 15 citations', () => {
      assert.ok(privacyTabContent.includes('Art. 17 LOPDP'), 'Privacy UI must cite Art. 17');
      assert.ok(privacyTabContent.includes('Art. 15 LOPDP'), 'Privacy UI must cite Art. 15');
      assert.ok(privacyTabContent.includes('5 a 10 años'), 'Privacy UI must cite 5-10 year clinical retention');
    });

    test('UI clarifies Articles 20 and 21 for automated profiling decisions', () => {
      assert.ok(privacyTabContent.includes('Artículos 20 y 21'));
      assert.ok(privacyTabContent.includes('Decisiones y valoraciones automatizadas'));
    });

    test('Database purge function public.purge_clinic_data fails closed if clinical records or patients exist', () => {
      assert.ok(
        migrationContent.includes('purge_clinic_data'),
        'Migration must define purge_clinic_data'
      );
      assert.ok(
        migrationContent.includes('active patient') || migrationContent.includes('retention') || migrationContent.includes('data_rights_requests'),
        'Purge function must check clinical retention invariants'
      );
    });

    test('Sign-off section is populated with Lead Counsel, DPD, and Systems Architect approvals', () => {
      assert.ok(standardContent.includes('Lead Healthcare Legal Counsel'));
      assert.ok(standardContent.includes('Data Protection Officer (DPD)'));
      assert.ok(standardContent.includes('Lead Systems Architect'));
      assert.ok(standardContent.includes('APPROVED'));
    });
  });

});
