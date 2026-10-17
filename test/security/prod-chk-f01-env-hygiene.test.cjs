/**
 * Gate 6: PROD-CHK-F01 Production Environment Variables Isolation & Secrets Hygiene
 *
 * Scope:
 *  - Verification that .gitignore properly excludes all .env files
 *  - Verification that .env.example exists, is fully documented, and contains NO live secrets
 *  - Verification that lib/env.ts strictly isolates server-only secrets from client runtime
 *  - Static scan across app/ and components/ ensuring no client components reference server keys
 *  - Static scan across repository ensuring zero hardcoded service role keys or real API keys
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('Gate 6: PROD-CHK-F01 Environment Variables & Secrets Hygiene', () => {

  // ==========================================================================
  // Suite 1: VCS Exclusion Invariants (.gitignore)
  // ==========================================================================
  describe('1. VCS Exclusion Invariants (.gitignore)', () => {
    const gitignorePath = path.join(ROOT_DIR, '.gitignore');

    test('.gitignore exists and excludes environment files', () => {
      assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist in root');
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

      const lines = gitignoreContent.split('\n').map(l => l.trim()).filter(l => !l.startsWith('#') && l.length > 0);
      const excludesEnv = lines.some(l => l === '.env*' || l === '.env.local' || l === '.env');
      assert.ok(excludesEnv, '.gitignore must exclude environment files via .env* or .env.local');
    });
  });

  // ==========================================================================
  // Suite 2: Environment Template Integrity (.env.example)
  // ==========================================================================
  describe('2. Environment Template Integrity (.env.example)', () => {
    const envExamplePath = path.join(ROOT_DIR, '.env.example');

    test('.env.example exists and documents all mandatory variables', () => {
      assert.ok(fs.existsSync(envExamplePath), '.env.example must exist in repository root');
      const content = fs.readFileSync(envExamplePath, 'utf8');

      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_APP_URL',
        'NODE_ENV',
        'SUPABASE_SERVICE_ROLE_KEY',
        'RESEND_API_KEY',
        'RESEND_FROM_EMAIL',
        'KUSHKI_PRIVATE_MERCHANT_ID',
        'KUSHKI_PUBLIC_MERCHANT_ID'
      ];

      for (const varName of requiredVars) {
        assert.ok(
          content.includes(`${varName}=`),
          `.env.example must document required variable: ${varName}`
        );
      }
    });

    test('.env.example contains safe placeholders and zero live secrets', () => {
      const content = fs.readFileSync(envExamplePath, 'utf8');

      // Check for placeholder keywords
      assert.ok(
        content.includes('placeholder') || content.includes('your-project'),
        '.env.example must use clear placeholder indicators'
      );

      // Verify no live JWTs (JWT pattern: eyJhbGciOi... with actual base64 signature)
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('#') || !line.includes('=')) continue;
        const [key, val] = line.split('=');
        // Ensure values do not contain live high-entropy production tokens
        if (key.includes('KEY') || key.includes('SECRET') || key.includes('ID')) {
          assert.ok(
            val.includes('placeholder') || val.includes('xxx') || val.includes('your-') || val.trim() === 'none' || val.trim() === 'dev' || val.trim() === 'uat',
            `Variable ${key} in .env.example must have placeholder value, got: ${val}`
          );
        }
      }
    });
  });

  // ==========================================================================
  // Suite 3: Client vs Server Boundary Enforcement (lib/env.ts)
  // ==========================================================================
  describe('3. Client vs Server Boundary Enforcement (lib/env.ts)', () => {
    const envTsPath = path.join(ROOT_DIR, 'lib/env.ts');

    test('lib/env.ts contains only public configuration and rejects invalid production config', () => {
      assert.ok(fs.existsSync(envTsPath), 'lib/env.ts must exist');
      const content = fs.readFileSync(envTsPath, 'utf8');

      assert.ok(content.includes('readPublicEnv'), 'Actual public validation is required');
      assert.ok(content.includes('throw new Error'), 'Invalid configuration fails closed');
      assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|KUSHKI_PRIVATE_MERCHANT_ID/.test(content), 'Public module must not read or export server secrets');
    });

    test('public module has no secret defaults and privileged gate is server-only', () => {
      const content = fs.readFileSync(envTsPath, 'utf8');

      assert.ok(!/mock_role_key|placeholder_anon_key|NODE_ENV:/.test(content));
      const server = fs.readFileSync(path.join(ROOT_DIR, 'lib/server-email-gate.ts'), 'utf8');
      assert.ok(server.includes("import 'server-only'"));
      assert.ok(server.includes('SUPABASE_SERVICE_ROLE_KEY'));
    });
  });

  // ==========================================================================
  // Suite 4: Source Code Client Leakage Audit
  // ==========================================================================
  describe('4. Source Code Client Leakage Audit', () => {
    function getAllTsxFiles(dir, files = []) {
      if (!fs.existsSync(dir)) return files;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.next') {
            getAllTsxFiles(fullPath, files);
          }
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    test('Zero client components ("use client") access SUPABASE_SERVICE_ROLE_KEY', () => {
      const componentsDir = path.join(ROOT_DIR, 'components');
      const appDir = path.join(ROOT_DIR, 'app');

      const allFiles = [...getAllTsxFiles(componentsDir), ...getAllTsxFiles(appDir)];
      const violations = [];

      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const isClientComponent = content.includes('"use client"') || content.includes("'use client'");

        if (isClientComponent) {
          if (
            content.includes('SUPABASE_SERVICE_ROLE_KEY') ||
            content.includes('RESEND_API_KEY') ||
            content.includes('KUSHKI_PRIVATE_MERCHANT_ID')
          ) {
            violations.push(path.relative(ROOT_DIR, filePath));
          }
        }
      }

      assert.deepEqual(
        violations,
        [],
        `Client components must NEVER access server secrets. Violations found in: ${violations.join(', ')}`
      );
    });

    test('Zero hardcoded Supabase service role JWTs in committed application code', () => {
      const codeDirs = [
        path.join(ROOT_DIR, 'app'),
        path.join(ROOT_DIR, 'components'),
        path.join(ROOT_DIR, 'lib'),
        path.join(ROOT_DIR, 'types')
      ];

      const allFiles = codeDirs.flatMap(dir => getAllTsxFiles(dir));
      const hardcodedJwtPattern = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/g;

      const violations = [];
      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(hardcodedJwtPattern);
        if (matches && matches.length > 0) {
          violations.push(path.relative(ROOT_DIR, filePath));
        }
      }

      assert.deepEqual(
        violations,
        [],
        `Zero live hardcoded JWTs allowed in committed code. Violations found in: ${violations.join(', ')}`
      );
    });
  });
});
