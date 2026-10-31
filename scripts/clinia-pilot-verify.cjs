'use strict';
// Extends the frozen RC verifier without changing its recovery-package pins.
// No live credentials, provider requests, Auth/session bypass, or hosted claim.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const checks = require('./clinia-verify.cjs');

try {
  if (!fs.existsSync('.clinia-release-snapshot.json') && process.env.GITHUB_ACTIONS !== 'true') throw new Error('Pilot verification requires a real isolated release snapshot or GitHub runner');
  for (const mode of ['typecheck', 'lint', 'test']) {
    const status = checks.run(mode);
    if (status) process.exit(status);
  }
  const env = { ...checks.verificationEnv(process.cwd()), NEXT_PUBLIC_CLINIA_PILOT_MODE: 'synthetic' };
  console.log('Clinia pilot compilation: synthetic capability policy, offline provider only.');
  const build = spawnSync(process.execPath, checks.command('build', process.cwd()), {
    cwd: process.cwd(), env, stdio: 'inherit', windowsHide: true,
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status || 1);
  console.log('Client credential sentinel: ' + JSON.stringify(checks.verifyClientBundle(process.cwd())));
  console.log('Auth template packaging: ' + JSON.stringify(checks.verifyAuthEmailTraces(process.cwd())));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
