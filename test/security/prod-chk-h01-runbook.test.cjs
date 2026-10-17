/**
 * Gate 6 — PROD-CHK-H01: Operational Runbook & Architecture Documentation Verification Suite
 *
 * Verifies that RUNBOOK.md exists in repository root, provides production-grade operational
 * guidance, and adheres to regulatory standards and engineering invariants:
 *  1. Architecture & Service Map (Next.js 15, Supabase, Storage, Resend, Payments disabled)
 *  2. Staging Deployment & Migration Execution SOP (20260922194927, pre-flight queries)
 *  3. Emergency Rollback Procedure (rollback_20260922194927.sql, trigger conditions)
 *  4. Clinic Onboarding & Administrative Operations SOP (RUC validation, SENESCYT, RBAC, purge guard)
 *  5. Disaster Recovery & Backup/Restore Drill Protocol (RTO < 1h, RPO < 24h, PITR drill)
 *  6. Incident Response & PII/PHI Breach Escalation SOP (LOPDP Art. 48, 72h SPDP notification, SEV matrix)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const RUNBOOK_PATH = path.join(ROOT_DIR, 'RUNBOOK.md');

test('PROD-CHK-H01: Operational Runbook Verification', async (t) => {
  assert.ok(fs.existsSync(RUNBOOK_PATH), 'RUNBOOK.md must exist in the repository root');
  const runbookContent = fs.readFileSync(RUNBOOK_PATH, 'utf8');
  assert.ok(runbookContent.length > 2000, 'RUNBOOK.md must contain detailed operational documentation (> 2000 chars)');

  await t.test('Section 1: Architecture & Component Topology is fully documented', () => {
    assert.match(runbookContent, /Next\.js 15/i, 'Must reference Next.js 15 runtime');
    assert.match(runbookContent, /Supabase/i, 'Must document Supabase infrastructure');
    assert.match(runbookContent, /PostgreSQL 15/i, 'Must document PostgreSQL 15 database');
    assert.match(runbookContent, /patient-files/i, 'Must reference patient-files storage bucket');
    assert.match(runbookContent, /patient-avatars/i, 'Must reference patient-avatars storage bucket');
    assert.match(runbookContent, /clinic-branding/i, 'Must reference clinic-branding storage bucket');
    assert.match(runbookContent, /Resend/i, 'Must document Resend email integration');
    assert.match(runbookContent, /Kushki/i, 'Must document Kushki payment gateway status');
    assert.match(runbookContent, /503/i, 'Must note that payments endpoint fails closed with 503');
  });

  await t.test('Section 2: Staging Deployment & Migration Execution SOP is actionable', () => {
    assert.match(runbookContent, /20260922194927_enforce_clinical_tenant_links_and_rights_audit\.sql/, 'Must reference exact forward migration filename');
    assert.match(runbookContent, /Pre-Flight Integrity Probe/i, 'Must document pre-flight integrity query');
    assert.match(runbookContent, /SELECT 'appointments' AS tbl/i, 'Must include SQL pre-flight query checking mismatched clinic_id');
    assert.match(runbookContent, /composite_patient_clinic_fk|appointments_patient_clinic_fk/, 'Must specify post-migration constraint verification');
    assert.match(runbookContent, /supabase db push/i, 'Must document Supabase CLI migration command');
  });

  await t.test('Section 3: Emergency Rollback Procedure is comprehensive and safe', () => {
    assert.match(runbookContent, /rollback_20260922194927\.sql/, 'Must reference exact backward migration filename');
    assert.match(runbookContent, /Rollback Trigger Conditions/i, 'Must define rollback trigger conditions');
    assert.match(runbookContent, /5xx|error rate/i, 'Must specify error threshold triggers for rollback');
    assert.match(runbookContent, /Verify Restored Constraints/i, 'Must include validation query for restored constraints');
    assert.match(runbookContent, /vercel rollback|Instant Rollback/i, 'Must document application rollback procedure');
  });

  await t.test('Section 4: Clinic Onboarding & Staff Provisioning SOP aligns with clinical standards', () => {
    assert.match(runbookContent, /RUC/i, 'Must document Ecuadorian RUC tax ID validation');
    assert.match(runbookContent, /001/, 'Must specify Ecuadorian RUC 13-digit format ending in 001');
    assert.match(runbookContent, /SENESCYT/i, 'Must document doctor SENESCYT/MSP registration number verification');
    assert.match(runbookContent, /clinic_owner/i, 'Must document clinic_owner role permissions');
    assert.match(runbookContent, /doctor/i, 'Must document doctor role permissions');
    assert.match(runbookContent, /receptionist/i, 'Must document receptionist role and clinical access restrictions');
    assert.match(runbookContent, /purge_clinic_data/i, 'Must document purge_clinic_data safety invariants refusing purge with patient data');
    assert.match(runbookContent, /is_clinic_member/i, 'Must document immediate session cutoff via live membership check');
  });

  await t.test('Section 5: Disaster Recovery & Backup/Restore Drill Protocol meets enterprise SLOs', () => {
    assert.match(runbookContent, /RPO < 24 Hours/i, 'Must document RPO target (< 24 hours)');
    assert.match(runbookContent, /RTO < 1 Hour/i, 'Must document RTO target (< 1 hour)');
    assert.match(runbookContent, /Point-in-Time Recovery|PITR/i, 'Must document Point-in-Time Recovery protocol');
    assert.match(runbookContent, /drill|rehearsal/i, 'Must document periodic restore drill requirements');
    assert.match(runbookContent, /Storage/i, 'Must cover object storage recovery');
  });

  await t.test('Section 6: Incident Response & PII/PHI Breach Escalation conforms to LOPDP Art. 48', () => {
    assert.match(runbookContent, /SEV-0/i, 'Must define severity level SEV-0');
    assert.match(runbookContent, /SEV-1/i, 'Must define severity level SEV-1');
    assert.match(runbookContent, /SEV-2/i, 'Must define severity level SEV-2');
    assert.match(runbookContent, /SEV-3/i, 'Must define severity level SEV-3');
    assert.match(runbookContent, /Article 48|Art\. 48/i, 'Must cite LOPDP Article 48 regarding personal data breaches');
    assert.match(runbookContent, /72 hours|72 Horas/i, 'Must mandate regulatory notification to SPDP within 72 hours');
    assert.match(runbookContent, /Superintendencia de Protección de Datos Personales|SPDP/i, 'Must designate SPDP as the regulatory authority');
  });

  await t.test('Section 7: Emergency Contacts & Escalation Directory is populated', () => {
    assert.match(runbookContent, /Incident Commander/i, 'Must specify Incident Commander role');
    assert.match(runbookContent, /Data Protection Officer|DPD|Security Officer/i, 'Must specify Data Protection Officer role');
    assert.match(runbookContent, /Legal Counsel/i, 'Must specify Legal Counsel role');
  });
});
