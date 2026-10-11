/**
 * Gate 7 Verification Suite: Canary Rollout Specification & Release Gate Sign-Off Protocol
 * 
 * Verifies:
 * 1. Document existence and complete structure of CANARY_ROLLOUT_AND_RELEASE_GATE.md.
 * 2. 4-Stage canary traffic progression (5% -> 25% -> 50% -> 100%) with required soak windows.
 * 3. Mathematical SLOs and telemetry thresholds (availability, 5xx rate, latency, DB pool).
 * 4. Emergency rollback triggers and rapid sub-90s execution runbook with verified rollback migrations.
 * 5. Complete 8-gate release sign-off matrix (Gate 0 through Gate 7) referencing verified artifacts.
 * 6. Multi-disciplinary sign-off charter credentials.
 * 7. Physical existence and verification of cited rollback and migration files.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CANARY_DOC_PATH = path.join(ROOT, 'docs/security/CANARY_ROLLOUT_AND_RELEASE_GATE.md');

describe('Gate 7: Canary Rollout & Final Release Gate Protocol', () => {
  const canaryContent = fs.readFileSync(CANARY_DOC_PATH, 'utf8');

  test('Sub-Suite 1: Document Existence and Required Section Headers', () => {
    assert.ok(fs.existsSync(CANARY_DOC_PATH), 'CANARY_ROLLOUT_AND_RELEASE_GATE.md must exist');
    assert.ok(canaryContent.length > 5000, 'Document must be comprehensive (>5000 chars)');

    const requiredHeaders = [
      '# Clinia+ Dental EHR/PMS: Canary Rollout Specification & Final Release Gate Sign-Off Protocol',
      '## 1. Executive Summary & Purpose',
      '## 2. The 4-Stage Canary Rollout Progression',
      '### Stage 0: Staging Verification & Pre-Flight Gate',
      '### Stage 1: Internal Dogfooding & Alpha Pilot (5% Traffic, 24-Hour Soak)',
      '### Stage 2: Expanded Regional Beta Pilot (25% Traffic, 24-Hour Soak)',
      '### Stage 3: Broad Production Staging (50% Traffic, 48-Hour Soak)',
      '### Stage 4: General Availability (100% Full Production Traffic)',
      '## 3. Quantitative Service Level Objectives (SLOs) & Health Gates',
      '## 4. Automated Emergency Rollback Triggers & Execution Runbook',
      '### 4.1 Rollback Activation Triggers (P0 Severity)',
      '### 4.2 Emergency Rollback Step-by-Step Runbook',
      '## 5. Consolidated Release Gate Sign-Off Matrix (Gates 0 to 7)',
      '## 6. Formal Sign-Off Charter'
    ];

    for (const header of requiredHeaders) {
      assert.ok(canaryContent.includes(header), `Document must contain header: "${header}"`);
    }
  });

  test('Sub-Suite 2: 4-Stage Canary Rollout Staging and Soak Constraints', () => {
    // Stage 1
    assert.match(canaryContent, /5%\s+Traffic/i, 'Must define 5% traffic for Stage 1');
    assert.match(canaryContent, /24-Hour\s+Soak|24\s+continuous\s+hours/i, 'Must enforce 24h soak for Stage 1');
    assert.match(canaryContent, /clinic_id\s*%\s*100\s*<\s*5/i, 'Must specify sticky tenant routing for Stage 1');

    // Stage 2
    assert.match(canaryContent, /25%\s+Traffic/i, 'Must define 25% traffic for Stage 2');
    assert.match(canaryContent, /clinic_id\s*%\s*100\s*<\s*25/i, 'Must specify sticky tenant routing for Stage 2');

    // Stage 3
    assert.match(canaryContent, /50%\s+Traffic/i, 'Must define 50% traffic for Stage 3');
    assert.match(canaryContent, /48-Hour\s+Soak|48\s+continuous\s+hours/i, 'Must enforce 48h soak for Stage 3');
    assert.match(canaryContent, /clinic_id\s*%\s*100\s*<\s*50/i, 'Must specify sticky tenant routing for Stage 3');

    // Stage 4
    assert.match(canaryContent, /100%\s+Full\s+Production\s+Traffic|100%\s+Traffic/i, 'Must define 100% traffic for Stage 4 (GA)');
  });

  test('Sub-Suite 3: Quantitative Telemetry Health Gates and SLO Thresholds', () => {
    // Availability
    assert.match(canaryContent, /99\.90\\?%/i, 'Target platform availability must be >= 99.90%');
    assert.match(canaryContent, /99\.50\\?%/i, 'Availability rollback threshold must be < 99.50%');

    // 5xx Error Rate
    assert.match(canaryContent, /<\s*0\.10\\?%/i, 'Target 5xx error rate must be < 0.10%');
    assert.match(canaryContent, />\s*0\.50\\?%/i, 'Critical rollback 5xx rate must be > 0.50%');

    // Latency
    assert.match(canaryContent, /p50.*150(\\text\{)?ms/i, 'Target p50 latency must be < 150ms');
    assert.match(canaryContent, /p95.*500(\\text\{)?ms/i, 'Target p95 latency must be < 500ms');

    // Database Resource Utilization
    assert.match(canaryContent, /80\\?%.*sustained|Connection\s+pool.*80/i, 'Critical connection pool threshold must be 80%');
    assert.match(canaryContent, /85\\?%.*sustained|CPU.*85/i, 'Critical CPU threshold must be 85%');

    // Negative Boundary Tolerances
    assert.match(canaryContent, /23503/i, 'Must strictly forbid foreign key violations (SQLSTATE 23503)');
    assert.match(canaryContent, /23514/i, 'Must strictly forbid check constraint violations (SQLSTATE 23514)');
  });

  test('Sub-Suite 4: Automated Rollback Triggers & Rapid Sub-90s Runbook', () => {
    // Sub-90s execution mandate
    assert.match(canaryContent, /<\s*90\s*(\\text\{)?s|<\s*90\s*Seconds/i, 'Runbook must target complete rollback in < 90 seconds');

    // Step 1: Vercel Rollback
    assert.match(canaryContent, /vercel\s+rollback/i, 'Step 1 must trigger instant Vercel traffic rollback');

    // Step 2: Migration Rollbacks in reverse order
    assert.ok(canaryContent.includes('rollback_20260925000000.sql'), 'Step 2 must execute compound index rollback script');
    assert.ok(canaryContent.includes('rollback_20260922194927.sql'), 'Step 2 must execute composite FK and audit rollback script');
    
    // Step 3: Evacuation
    assert.match(canaryContent, /Edge\s+Cache|Realtime\s+channel/i, 'Step 3 must invalidate edge cache and realtime channels');

    // Step 4: LOPDP Escalation
    assert.match(canaryContent, /dpo@clinia\.ec/i, 'Step 4 must notify DPD');
    assert.match(canaryContent, /72-hour|SPDP/i, 'Step 4 must enforce 72-hour SPDP escalation protocol');
  });

  test('Sub-Suite 5: Complete 8-Gate Release Sign-Off Matrix Alignment', () => {
    for (let gate = 0; gate <= 7; gate++) {
      assert.ok(canaryContent.includes(`Gate ${gate}`), `Release matrix must include Gate ${gate}`);
    }

    // Critical artifact references
    const criticalArtifacts = [
      'gate_0_and_1_release_scope_and_evidence_register.md',
      '20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql',
      '20260925000000_compound_multi_tenant_indexes.sql',
      'rollback_20260922194927.sql',
      'rollback_20260925000000.sql',
      'dr-drill-runner.cjs',
      'DR_DRILL_EVIDENCE_LATEST.json',
      'middleware.ts',
      'invite-member.ts',
      'patient-utils.ts',
      'calendar-conflict.ts',
      'CLINICAL_UAT_SPECIFICATION_AND_SIGN_OFF.md',
      'avatar-upload.tsx',
      'LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md',
      'RUNBOOK.md',
      'PRODUCTION_READINESS.md'
    ];

    for (const artifact of criticalArtifacts) {
      assert.ok(canaryContent.includes(artifact), `Canary release document must cite artifact: ${artifact}`);
    }
  });

  test('Sub-Suite 6: Multi-Disciplinary Governance Signatures & Credentials', () => {
    assert.match(canaryContent, /Alejandro\s+V\.\s+S\./i, 'Must include Principal Software Architect signature');
    assert.match(canaryContent, /Elena\s+M\.\s+Viteri/i, 'Must include Lead Dental Specialist signature');
    assert.match(canaryContent, /1005-2018-1984210/i, 'Must include Dr. Viteri SENESCYT credential');
    assert.match(canaryContent, /Marcelo\s+F\.\s+Cordero/i, 'Must include Certified DPO signature');
    assert.match(canaryContent, /Carlos\s+R\.\s+Navarrete/i, 'Must include Senior Staff SRE signature');
    assert.match(canaryContent, /CISSP/i, 'Must cite CISSP security certification');
  });

  test('Sub-Suite 7: Physical Existence and Verification of Cited Rollback & Migration Files', () => {
    const forward1 = path.join(ROOT, 'supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql');
    const forward2 = path.join(ROOT, 'supabase/migrations/20260925000000_compound_multi_tenant_indexes.sql');
    const rollback1 = path.join(ROOT, 'supabase/migrations/rollback_20260922194927.sql');
    const rollback2 = path.join(ROOT, 'supabase/migrations/rollback_20260925000000.sql');
    const drRunner = path.join(ROOT, 'scripts/dr-drill-runner.cjs');
    const drEvidence = path.join(ROOT, 'docs/security/DR_DRILL_EVIDENCE_LATEST.json');
    const lopdpDoc = path.join(ROOT, 'docs/security/LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md');
    const uatDoc = path.join(ROOT, 'docs/security/CLINICAL_UAT_SPECIFICATION_AND_SIGN_OFF.md');

    assert.ok(fs.existsSync(forward1), 'Forward migration 1 must exist');
    assert.ok(fs.existsSync(forward2), 'Forward migration 2 must exist');
    assert.ok(fs.existsSync(rollback1), 'Rollback migration 1 must exist');
    assert.ok(fs.existsSync(rollback2), 'Rollback migration 2 must exist');
    assert.ok(fs.existsSync(drRunner), 'DR drill runner must exist');
    assert.ok(fs.existsSync(drEvidence), 'DR drill evidence report must exist');
    assert.ok(fs.existsSync(lopdpDoc), 'LOPDP compliance document must exist');
    assert.ok(fs.existsSync(uatDoc), 'Clinical UAT document must exist');
  });
});
