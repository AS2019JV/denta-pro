/**
 * Migration & Code Invariant Static Verifier
 * Author: teamwork_preview_test_writer_e2e
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (R1, R2, R3, R4)
 * - PROJECT.md (Interface Contracts, Milestones)
 */

const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT_DIR = join(__dirname, '../../..');
const MIGRATIONS_DIR = join(ROOT_DIR, 'supabase/migrations');

function getAllMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  return files.map((file) => ({
    filename: file,
    content: readFileSync(join(MIGRATIONS_DIR, file), 'utf8'),
  }));
}

function getPrivacyTabSource() {
  const filePath = join(ROOT_DIR, 'components/settings/privacy-tab.tsx');
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

function getPatientFilesSource() {
  const filePath = join(ROOT_DIR, 'components/patient-files.tsx');
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

function getPaymentMethodsSettingsSource() {
  const filePath = join(ROOT_DIR, 'components/billing/payment-methods-settings.tsx');
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

/**
 * Checks if a specific pattern exists across migrations
 */
function searchMigrations(pattern) {
  const migrations = getAllMigrations();
  return migrations.filter((m) => {
    if (typeof pattern === 'string') return m.content.includes(pattern);
    return pattern.test(m.content);
  });
}

module.exports = {
  getAllMigrations,
  getPrivacyTabSource,
  getPatientFilesSource,
  getPaymentMethodsSettingsSource,
  searchMigrations,
};
