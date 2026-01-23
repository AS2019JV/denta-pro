const { spawn } = require('child_process');

console.log('Starting Next.js with IPv4 preference...');

const child = spawn('cmd.exe', ['/c', 'npm', 'run', 'next-dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--dns-result-order=ipv4first'
  }
});

child.on('close', (code) => {
  process.exit(code);
});
