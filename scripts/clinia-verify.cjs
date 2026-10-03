'use strict';
// Portable, Docker-free checks. Integration/JWT/browser gates run separately.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const SERVER_SECRET_SENTINEL = 'clinia-synthetic-server-only-credential-sentinel';
const modes = ['typecheck', 'lint', 'test', 'build'];
const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'];
function verificationEnv(directory, inherited = process.env) {
  if (inherited.VERCEL === '1') throw new Error('Offline verification is forbidden on Vercel deployments');
  const systemVariables = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']);
  const env = Object.fromEntries(Object.entries(inherited).filter(([name]) => systemVariables.has(name.toUpperCase())));
  for (const name of envFiles) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) env[match[1]] = '';
    }
  }
  Object.assign(env, {
    NODE_ENV: 'production', CI: 'true', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59999',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-ci-key',
    SUPABASE_SERVICE_ROLE_KEY: SERVER_SECRET_SENTINEL,
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:59998',
    NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY: '1', NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE: '',
    RESEND_API_KEY: '', RESEND_FROM_EMAIL: '', CLINIA_LOCAL_ACCEPTANCE: '', VERCEL: '', CLINIA_EMAIL_ENABLED: '', EMAIL_ABUSE_HASH_SECRET: '',
    NODE_OPTIONS: '--require ./scripts/clinia-ci-network-guard.cjs',
  });
  return env;
}
function command(mode, directory) {
  const moduleFile = file => path.join(directory, 'node_modules', file);
  if (mode === 'typecheck') return [moduleFile('typescript/bin/tsc'), '--noEmit', '--incremental', 'false'];
  if (mode === 'lint') return [moduleFile('next/dist/bin/next'), 'lint', '--no-cache'];
  if (mode === 'build') return [moduleFile('next/dist/bin/next'), 'build'];
  if (mode === 'test') {
    const files = fs.readdirSync(path.join(directory, 'test/production')).filter(name => name.endsWith('.test.cjs')).sort();
    if (!files.length) throw new Error('Production contract tests absent');
    return ['--test', ...files.map(name => 'test/production/' + name)];
  }
  throw new Error('Unsupported verification mode');
}
function verifyClientBundle(directory) {
  const staticDirectory = path.join(directory, '.next', 'static');
  let scanned = 0;
  function visit(current) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Client bundle check refuses symlinks');
    if (fs.statSync(current).isDirectory()) {
      for (const name of fs.readdirSync(current)) visit(path.join(current, name));
      return;
    }
    scanned++;
    if (fs.readFileSync(current).includes(Buffer.from(SERVER_SECRET_SENTINEL))) {
      throw new Error('Server credential sentinel exposed in client bundle: ' + path.relative(directory, current));
    }
  }
  visit(staticDirectory);
  if (!scanned) throw new Error('Client bundle absent; secret boundary not verified');
  return { status: 'VERIFIED', scanned, scope: 'Synthetic server credential absent from compiled .next/static; no deployed-secret claim' };
}
function run(mode, directory = root, inherited = process.env) {
  const env = verificationEnv(directory, inherited);
  const steps = mode === 'all' ? modes : [mode];
  // Refuse before running any step; never overwrite the active .next.
  if (steps.includes('build') && !fs.existsSync(path.join(directory, '.clinia-release-snapshot.json')) && !inherited.GITHUB_ACTIONS) {
    throw new Error('Verification build requires an isolated release snapshot or GitHub runner');
  }
  for (const step of steps) {
    console.log(`Clinia verification: ${step}; synthetic offline environment.`);
    const result = spawnSync(process.execPath, command(step, directory), { cwd: directory, env, stdio: 'inherit', windowsHide: true });
    if (result.error) throw new Error(`Verification ${step} could not start: ${result.error.code}`);
    if (result.status !== 0) return result.status || 1;
    if (step === 'build') console.log('Clinia client secret boundary: ' + JSON.stringify(verifyClientBundle(directory)));
  }
  return 0;
}
if (require.main === module) {
  try {
    const mode = process.argv[2];
    if (!['all', ...modes].includes(mode) || process.argv.length !== 3) throw new Error('Use typecheck, lint, test, build or all');
    process.exitCode = run(mode);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verificationEnv, command, run, verifyClientBundle, SERVER_SECRET_SENTINEL };
