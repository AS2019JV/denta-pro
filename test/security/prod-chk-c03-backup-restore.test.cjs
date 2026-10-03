const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  RTO_LIMIT_SECONDS,
  RPO_LIMIT_SECONDS,
  REQUIRED_CLINICAL_TABLES,
  REQUIRED_STORAGE_BUCKETS,
  FORBIDDEN_PRODUCTION_TARGETS,
  assertSafeTargetEnvironment,
  calculateRTO,
  calculateRPO,
  verifyDatabaseManifest,
  verifyStorageManifest,
  verifyOperationalSecurityControls,
  executeDrill,
  computeSha256
} = require('../../scripts/dr-drill-runner.cjs');

// Mock fixtures
function createValidDatabaseManifest() {
  const tables = {};
  for (const table of REQUIRED_CLINICAL_TABLES) {
    tables[table] = {
      rowCount: 100,
      sha256: crypto.createHash('sha256').update(table + '_dump_data').digest('hex')
    };
  }
  return { tables };
}

function createValidStorageManifest() {
  const buckets = {};
  for (const bucket of REQUIRED_STORAGE_BUCKETS) {
    buckets[bucket] = {
      objectCount: 45,
      totalBytes: 1024 * 1024 * 15, // 15MB
      manifestSha256: crypto.createHash('sha256').update(bucket + '_manifest_data').digest('hex')
    };
  }
  return { buckets };
}

function createValidSecurityControls() {
  return {
    mfa_enforced_for_owners: true,
    leaked_password_protection: true,
    custom_access_token_hook: true,
    service_key_isolated: true
  };
}

describe('Gate 2 & 6: PROD-CHK-C03 / M7-BLK-06 Disaster Recovery & Backup/Restore Verification Drill', () => {

  describe('1. File Existence, Architecture & SLO Constants', () => {
    test('Runner script exists in scripts/ directory', () => {
      const scriptPath = path.join(__dirname, '../../scripts/dr-drill-runner.cjs');
      assert.ok(fs.existsSync(scriptPath), 'scripts/dr-drill-runner.cjs must exist');
    });

    test('SLO constants match production engineering requirements (RTO <= 1h, RPO <= 24h)', () => {
      assert.equal(RTO_LIMIT_SECONDS, 3600, 'RTO must be capped at 3600 seconds (1 hour)');
      assert.equal(RPO_LIMIT_SECONDS, 86400, 'RPO must be capped at 86400 seconds (24 hours)');
    });

    test('Required clinical tables list covers all 10 core healthcare entities', () => {
      const expected = [
        'patients',
        'appointments',
        'prescriptions',
        'clinical_records',
        'hcu033_forms',
        'patient_notes',
        'patient_files',
        'billings',
        'invoices',
        'data_rights_requests'
      ];
      assert.equal(REQUIRED_CLINICAL_TABLES.length, 10);
      for (const t of expected) {
        assert.ok(REQUIRED_CLINICAL_TABLES.includes(t), `Must include table: ${t}`);
      }
    });

    test('Required storage buckets cover all 3 clinical media stores', () => {
      const expected = ['patient-avatars', 'patient-files', 'receipts'];
      assert.equal(REQUIRED_STORAGE_BUCKETS.length, 3);
      for (const b of expected) {
        assert.ok(REQUIRED_STORAGE_BUCKETS.includes(b), `Must include bucket: ${b}`);
      }
    });
  });

  describe('2. Fail-Closed Production Target Environment Protection', () => {
    test('Rejects environment named "production" with TARGET_IS_PRODUCTION', () => {
      assert.throws(
        () => assertSafeTargetEnvironment('production', 'https://scratch.supabase.co'),
        /TARGET_IS_PRODUCTION/
      );
    });

    test('Rejects environment named "prod" with TARGET_IS_PRODUCTION', () => {
      assert.throws(
        () => assertSafeTargetEnvironment('prod', 'https://scratch.supabase.co'),
        /TARGET_IS_PRODUCTION/
      );
    });

    test('Rejects any target URL containing live production project id "leqsrfyjvuxxdsubjjin"', () => {
      assert.throws(
        () => assertSafeTargetEnvironment('scratch_staging', 'https://leqsrfyjvuxxdsubjjin.supabase.co'),
        /TARGET_URL_IS_PRODUCTION/
      );
    });

    test('Rejects empty or missing environment name', () => {
      assert.throws(
        () => assertSafeTargetEnvironment(null),
        /TARGET_ENV_MISSING/
      );
    });

    test('Permits safe scratch staging and local testing environments', () => {
      assert.equal(assertSafeTargetEnvironment('scratch_staging', 'https://staging-scratch.supabase.co'), true);
      assert.equal(assertSafeTargetEnvironment('local_sandbox', 'http://127.0.0.1:54321'), true);
    });
  });

  describe('3. Recovery Time Objective (RTO) Calculation & Compliance', () => {
    test('Calculates compliant elapsed time within 1 hour SLO (e.g. 25 minutes)', () => {
      const start = '2026-09-25T10:00:00.000Z';
      const end = '2026-09-25T10:25:00.000Z';
      const res = calculateRTO(start, end);
      assert.equal(res.elapsedSeconds, 1500);
      assert.equal(res.compliant, true);
      assert.equal(res.marginSeconds, 2100);
    });

    test('Accepts boundary case of exactly 3600 seconds (60 minutes)', () => {
      const start = '2026-09-25T10:00:00.000Z';
      const end = '2026-09-25T11:00:00.000Z';
      const res = calculateRTO(start, end);
      assert.equal(res.elapsedSeconds, 3600);
      assert.equal(res.compliant, true);
      assert.equal(res.marginSeconds, 0);
    });

    test('Detects RTO breach when restore exceeds 3600 seconds (e.g. 65 minutes)', () => {
      const start = '2026-09-25T10:00:00.000Z';
      const end = '2026-09-25T11:05:00.000Z';
      const res = calculateRTO(start, end);
      assert.equal(res.elapsedSeconds, 3900);
      assert.equal(res.compliant, false);
      assert.equal(res.marginSeconds, -300);
    });

    test('Throws on malformed timestamp string', () => {
      assert.throws(
        () => calculateRTO('invalid-date', '2026-09-25T11:00:00.000Z'),
        /INVALID_TIMESTAMP/
      );
    });

    test('Throws on negative duration where end is before start', () => {
      assert.throws(
        () => calculateRTO('2026-09-25T11:00:00.000Z', '2026-09-25T10:00:00.000Z'),
        /NEGATIVE_DURATION/
      );
    });
  });

  describe('4. Recovery Point Objective (RPO) Calculation & Compliance', () => {
    test('Calculates compliant data lag within 24 hours SLO (e.g. 4 hours)', () => {
      const incident = '2026-09-25T14:00:00.000Z';
      const backup = '2026-09-25T10:00:00.000Z';
      const res = calculateRPO(incident, backup);
      assert.equal(res.lagSeconds, 14400);
      assert.equal(res.compliant, true);
      assert.equal(res.marginSeconds, 72000);
    });

    test('Accepts boundary case of exactly 86400 seconds (24 hours)', () => {
      const backup = '2026-09-24T10:00:00.000Z';
      const incident = '2026-09-25T10:00:00.000Z';
      const res = calculateRPO(incident, backup);
      assert.equal(res.lagSeconds, 86400);
      assert.equal(res.compliant, true);
      assert.equal(res.marginSeconds, 0);
    });

    test('Detects RPO breach when data lag exceeds 24 hours (e.g. 26 hours)', () => {
      const backup = '2026-09-24T08:00:00.000Z';
      const incident = '2026-09-25T10:00:00.000Z';
      const res = calculateRPO(incident, backup);
      assert.equal(res.lagSeconds, 93600);
      assert.equal(res.compliant, false);
      assert.equal(res.marginSeconds, -7200);
    });

    test('Throws on future backup timestamp after incident timestamp', () => {
      assert.throws(
        () => calculateRPO('2026-09-25T10:00:00.000Z', '2026-09-25T12:00:00.000Z'),
        /FUTURE_BACKUP/
      );
    });
  });

  describe('5. Database & Storage Manifest Integrity & Cryptographic Checksums', () => {
    test('Valid database manifest passes with all 10 clinical tables verified', () => {
      const manifest = createValidDatabaseManifest();
      const res = verifyDatabaseManifest(manifest);
      assert.equal(res.status, 'VERIFIED');
      assert.equal(res.totalTables, 10);
    });

    test('Fails if any clinical table is missing from database backup manifest', () => {
      const manifest = createValidDatabaseManifest();
      delete manifest.tables['hcu033_forms'];
      assert.throws(
        () => verifyDatabaseManifest(manifest),
        /MISSING_CLINICAL_TABLES.*hcu033_forms/
      );
    });

    test('Fails if table checksum is invalid or not 64-char hex', () => {
      const manifest = createValidDatabaseManifest();
      manifest.tables['patients'].sha256 = 'invalid_short_hash';
      assert.throws(
        () => verifyDatabaseManifest(manifest),
        /INVALID_TABLE_CHECKSUM.*patients/
      );
    });

    test('Valid storage manifest passes with all 3 buckets verified', () => {
      const manifest = createValidStorageManifest();
      const res = verifyStorageManifest(manifest);
      assert.equal(res.status, 'VERIFIED');
      assert.equal(res.bucketsVerified.length, 3);
      assert.equal(res.totalObjects, 135);
    });

    test('Fails if any storage bucket is missing from manifest', () => {
      const manifest = createValidStorageManifest();
      delete manifest.buckets['patient-files'];
      assert.throws(
        () => verifyStorageManifest(manifest),
        /MISSING_STORAGE_BUCKETS.*patient-files/
      );
    });
  });

  describe('6. Operational Security Controls (M7-BLK-06 Compliance)', () => {
    test('Passes when all four required security controls are active', () => {
      const controls = createValidSecurityControls();
      const res = verifyOperationalSecurityControls(controls);
      assert.equal(res.status, 'VERIFIED');
      assert.equal(res.mfa_enforced_for_owners, true);
      assert.equal(res.leaked_password_protection, true);
    });

    test('Fails if MFA is not enforced for clinic owners', () => {
      const controls = createValidSecurityControls();
      controls.mfa_enforced_for_owners = false;
      assert.throws(
        () => verifyOperationalSecurityControls(controls),
        /SECURITY_CONTROLS_FAILED.*MFA is not enforced/
      );
    });

    test('Fails if leaked password protection (HIBP) is disabled', () => {
      const controls = createValidSecurityControls();
      controls.leaked_password_protection = false;
      assert.throws(
        () => verifyOperationalSecurityControls(controls),
        /SECURITY_CONTROLS_FAILED.*Leaked password protection/
      );
    });

    test('Fails if custom access token hook is inactive', () => {
      const controls = createValidSecurityControls();
      controls.custom_access_token_hook = false;
      assert.throws(
        () => verifyOperationalSecurityControls(controls),
        /SECURITY_CONTROLS_FAILED.*token hook is not active/
      );
    });

    test('Fails if service key is not isolated server-side', () => {
      const controls = createValidSecurityControls();
      controls.service_key_isolated = false;
      assert.throws(
        () => verifyOperationalSecurityControls(controls),
        /SECURITY_CONTROLS_FAILED.*Service role key is not isolated/
      );
    });
  });

  describe('7. End-to-End Drill Assessment & Cryptographic Evidence Signing', () => {
    test('Executes end-to-end drill successfully and generates signed audit report', () => {
      const drillParams = {
        targetEnvironment: 'scratch_staging',
        targetUrl: 'https://scratch-20260925.supabase.co',
        incidentTime: '2026-09-25T12:00:00.000Z',
        backupTime: '2026-09-25T08:00:00.000Z', // 4h lag (RPO compliant)
        restoreStartTime: '2026-09-25T12:05:00.000Z',
        restoreEndTime: '2026-09-25T12:35:00.000Z', // 30m restore (RTO compliant)
        databaseManifest: createValidDatabaseManifest(),
        storageManifest: createValidStorageManifest(),
        securityControls: createValidSecurityControls()
      };

      const report = executeDrill(drillParams);

      assert.equal(report.verdict, 'PASS');
      assert.equal(report.metrics.rto.compliant, true);
      assert.equal(report.metrics.rto.elapsed_seconds, 1800);
      assert.equal(report.metrics.rpo.compliant, true);
      assert.equal(report.metrics.rpo.lag_seconds, 14400);
      assert.equal(report.database.status, 'VERIFIED');
      assert.equal(report.storage.status, 'VERIFIED');
      assert.equal(report.security_controls.status, 'VERIFIED');
      assert.ok(report.signature && report.signature.length === 64, 'Must include 64-char SHA-256 signature');
    });

    test('Fails-closed in full drill if target is production', () => {
      const drillParams = {
        targetEnvironment: 'production',
        targetUrl: 'https://scratch.supabase.co',
        incidentTime: '2026-09-25T12:00:00.000Z',
        backupTime: '2026-09-25T08:00:00.000Z',
        restoreStartTime: '2026-09-25T12:05:00.000Z',
        restoreEndTime: '2026-09-25T12:35:00.000Z',
        databaseManifest: createValidDatabaseManifest(),
        storageManifest: createValidStorageManifest(),
        securityControls: createValidSecurityControls()
      };

      assert.throws(
        () => executeDrill(drillParams),
        /TARGET_IS_PRODUCTION/
      );
    });

    test('Fails-closed in full drill if RTO limit is exceeded', () => {
      const drillParams = {
        targetEnvironment: 'scratch_staging',
        targetUrl: 'https://scratch.supabase.co',
        incidentTime: '2026-09-25T12:00:00.000Z',
        backupTime: '2026-09-25T08:00:00.000Z',
        restoreStartTime: '2026-09-25T12:00:00.000Z',
        restoreEndTime: '2026-09-25T13:10:00.000Z', // 70 min > 60 min limit
        databaseManifest: createValidDatabaseManifest(),
        storageManifest: createValidStorageManifest(),
        securityControls: createValidSecurityControls()
      };

      assert.throws(
        () => executeDrill(drillParams),
        /RTO_BREACHED/
      );
    });

    test('Fails-closed in full drill if RPO limit is exceeded', () => {
      const drillParams = {
        targetEnvironment: 'scratch_staging',
        targetUrl: 'https://scratch.supabase.co',
        incidentTime: '2026-09-25T12:00:00.000Z',
        backupTime: '2026-09-24T10:00:00.000Z', // 26 hours > 24 hours limit
        restoreStartTime: '2026-09-25T12:00:00.000Z',
        restoreEndTime: '2026-09-25T12:30:00.000Z',
        databaseManifest: createValidDatabaseManifest(),
        storageManifest: createValidStorageManifest(),
        securityControls: createValidSecurityControls()
      };

      assert.throws(
        () => executeDrill(drillParams),
        /RPO_BREACHED/
      );
    });
  });

});
