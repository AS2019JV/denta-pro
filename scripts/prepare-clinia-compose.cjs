/* Local-only adaptation of observed official CLI containers. Never reads app .env.local. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const project = 'clinia-acceptance';
const network = 'clinia-acceptance-loopback';
const workdir = path.join(repo, 'tools/local-supabase');
const privateDir = path.join(workdir, 'supabase/.temp');
const dockerDir = path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin');
const docker = path.join(dockerDir, 'docker.exe');
const cli = path.join(repo, 'node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const env = { ...process.env, PATH: dockerDir + ';' + process.env.PATH,
  SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', SUPABASE_NETWORK_ID: network };
const services = ['db', 'kong', 'auth', 'inbucket', 'realtime', 'rest', 'storage'];
const composeFile = path.join(privateDir, 'runtime.compose.json');
function run(file, args, options = {}) {
  const r = spawnSync(file, args, { cwd: repo, env, encoding: 'utf8', windowsHide: true,
    timeout: 30000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (r.error || r.status !== 0) {
    fs.mkdirSync(privateDir, { recursive: true });
    fs.writeFileSync(path.join(privateDir, 'last-runtime-error.private.log'), (r.stderr || '') + (r.stdout || '') + (r.error?.code || ''));
    throw new Error(`${path.basename(file)} ${args[0]} failed (${r.status ?? r.error?.code}); private diagnostics preserved`);
  }
  return r.stdout.trim();
}
function inspect(name) { return JSON.parse(run(docker, ['inspect', name]))[0]; }
function quoteCompose(value) {
  if (typeof value === 'string') return value.replaceAll('$', () => '$$');
  if (Array.isArray(value)) return value.map(quoteCompose);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, quoteCompose(v)]));
  return value;
}
function serviceFrom(container, key, volumes) {
  const name = `supabase_${key}_${project}`;
  if (container.Name !== '/' + name || container.Config.Labels['com.supabase.cli.project'] !== project)
    throw new Error('Container identity mismatch');
  if (container.HostConfig.Privileged || container.HostConfig.NetworkMode !== network)
    throw new Error('Unexpected privileged container/network');
  const config = container.Config;
  const result = { image: container.Image, container_name: name, restart: 'no',
    environment: config.Env, entrypoint: config.Entrypoint, command: config.Cmd,
    networks: { local: { aliases: container.NetworkSettings.Networks[network].Aliases || [] } },
    labels: { 'clinia.environment': 'acceptance', 'clinia.source': 'supabase-cli-2.117.0',
      'com.supabase.cli.project': project }, volumes: [] };
  if (config.User) result.user = config.User;
  if (config.WorkingDir) result.working_dir = config.WorkingDir;
  if (container.HostConfig.ShmSize) result.shm_size = container.HostConfig.ShmSize;
  if (container.HostConfig.SecurityOpt?.length) result.security_opt = container.HostConfig.SecurityOpt;
  if (config.Healthcheck?.Test && config.Healthcheck.Test[0] !== 'NONE') {
    result.healthcheck = { test: config.Healthcheck.Test };
    for (const [field, target] of [['Interval','interval'],['Timeout','timeout'],['StartPeriod','start_period']])
      if (config.Healthcheck[field]) result.healthcheck[target] = `${config.Healthcheck[field]}ns`;
    if (config.Healthcheck.Retries) result.healthcheck.retries = config.Healthcheck.Retries;
  }
  for (const mount of container.Mounts || []) {
    if (mount.Type !== 'volume' || !mount.Name.startsWith(`supabase_${key}_${project}`))
      throw new Error(`Unexpected mount in ${name}; review before importing`);
    volumes[mount.Name] = { external: true, name: mount.Name };
    result.volumes.push({ type: 'volume', source: mount.Name, target: mount.Destination, read_only: !mount.RW });
  }
  result.ports = [];
  for (const [port, bindings] of Object.entries(container.HostConfig.PortBindings || {})) {
    for (const binding of bindings) {
      if (!['56321','56322','56324'].includes(binding.HostPort)) throw new Error('Unreviewed published port');
      const [target, protocol] = port.split('/');
      result.ports.push({ target: Number(target), published: binding.HostPort, host_ip: '127.0.0.1', protocol });
    }
  }
  if (key !== 'db') result.depends_on = { db: { condition: 'service_healthy' } };
  return result;
}
function verifyDestination() {
  if (run(docker, ['context','show']) !== 'desktop-linux' ||
    run(docker, ['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}']) !== 'npipe:////./pipe/dockerDesktopLinuxEngine')
    throw new Error('Local Desktop named pipe required');
  if (fs.existsSync(path.join(privateDir, 'project-ref'))) throw new Error('Remote link refused');
  if (!/^project_id = "clinia-acceptance"$/m.test(fs.readFileSync(path.join(workdir, 'supabase/config.toml'), 'utf8')))
    throw new Error('Unexpected project');
  const net = JSON.parse(run(docker, ['network','inspect',network]))[0];
  if (net.Labels['clinia.environment'] !== 'acceptance') throw new Error('Network ownership mismatch');
}
async function main() {
  verifyDestination();
  fs.mkdirSync(privateDir, { recursive: true });
  const action = process.argv[2];
  if (action === 'bootstrap') {
    // This CLI version ignores bridge defaults when publishing ports. Never
    // recreate a bootstrap silently once synthetic application data exists.
    if (process.argv[3] !== '--acknowledge-empty-bootstrap')
      throw new Error('Bootstrap can briefly publish all interfaces; separate explicit review of an empty template required');
    if (fs.existsSync(composeFile)) throw new Error('Compose capture already exists; do not overwrite');
    const log = fs.openSync(path.join(privateDir, 'compose-bootstrap.log'), 'a');
    const child = spawn(cli, ['--network-id',network,'--workdir',workdir,'start','--exclude',
      'studio,postgres-meta,edge-runtime,logflare,vector,supavisor,imgproxy'],
      { cwd: repo, env, windowsHide: true, stdio: ['ignore', log, log] });
    try {
    const code = await new Promise((resolve, reject) => {
      const timer = setInterval(() => process.stdout.write('Official empty bootstrap running; no application fixtures loaded.\n'), 30000);
      const deadline = setTimeout(() => { child.kill(); }, 300000);
      child.once('error', e => { clearInterval(timer); clearTimeout(deadline); reject(e); });
      child.once('close', c => { clearInterval(timer); clearTimeout(deadline); resolve(c); });
    });
    if (code !== 0) throw new Error(`Official bootstrap exit ${code}; inspect private log, no acceptance claimed`);
    const observed = services.map(key => inspect(`supabase_${key}_${project}`));
    fs.writeFileSync(path.join(privateDir, 'observed-runtime.private.json'), JSON.stringify(observed));
    const counts = run(docker, ['exec','--user','postgres',`supabase_db_${project}`,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',
      "SELECT json_build_object('auth_users',(SELECT count(*) FROM auth.users),'objects',(SELECT count(*) FROM storage.objects),'buckets',(SELECT count(*) FROM storage.buckets),'patients',to_regclass('public.patients'),'version',current_setting('server_version'));" ]);
    const empty = JSON.parse(counts);
    if (empty.auth_users !== 0 || empty.objects !== 0 || empty.buckets !== 0 || empty.patients !== null)
      throw new Error('Source must be genuinely managed and application-empty');
    const compose = { name: 'clinia-acceptance-runtime', services: {}, volumes: {},
      networks: { local: { external: true, name: network } } };
    for (let i = 0; i < services.length; i++) compose.services[services[i]] = serviceFrom(observed[i], services[i], compose.volumes);
    const secretFiles = { db: ['/etc/postgresql-custom/pgsodium_root.key'],
      kong: ['/home/kong/kong.yml','/home/kong/localhost.crt','/home/kong/localhost.key'] };
    for (const [key, files] of Object.entries(secretFiles)) for (const file of files) {
      const target = path.join(privateDir, `${key}-${path.basename(file)}`);
      run(docker, ['cp', `supabase_${key}_${project}:${file}`, target]);
      compose.services[key].volumes.push({ type: 'bind', source: target, target: file, read_only: true });
    }
    fs.writeFileSync(composeFile, JSON.stringify(quoteCompose(compose), null, 2));
    } finally {
    fs.closeSync(log);
    // Stop only this CLI project even after a failed capture or timeout. Keep all
    // volumes. CLI output may contain secrets and must stay private.
    const stop = spawnSync(cli, ['stop','--workdir',workdir], { cwd: repo, env, encoding:'utf8', windowsHide:true, timeout:60000 });
    fs.writeFileSync(path.join(privateDir,'compose-bootstrap-stop.log'), (stop.stdout || '') + (stop.stderr || ''));
    if (stop.status !== 0) throw new Error('Bootstrap stop failed; do not run Compose');
    }
    process.stdout.write('Official runtime captured privately; volumes preserved. Explicit loopback Compose prepared.\n');
  } else if (['start','stop','inspect'].includes(action)) {
    if (!fs.existsSync(composeFile)) throw new Error('Bootstrap capture required');
    if (action !== 'inspect') {
      const args = ['compose','-f',composeFile,action === 'start' ? 'up' : 'stop'];
      if (action === 'start') args.push('-d','--pull','never','--wait','--wait-timeout','180');
      const output = run(docker, args, { timeout: 240000 });
      fs.writeFileSync(path.join(privateDir, `compose-${action}.log`), output);
    }
    const safe = services.map(key => {
      const c = inspect(`supabase_${key}_${project}`);
      if (c.HostConfig.Privileged || Object.keys(c.NetworkSettings.Networks).some(n => n !== network))
        throw new Error('Unexpected runtime privilege/network');
      for (const bindings of Object.values(c.NetworkSettings.Ports || {})) for (const b of bindings || [])
        if (b.HostIp !== '127.0.0.1') throw new Error('Publication is not loopback; stop the acceptance Compose project');
      return { name: c.Name, imageId: c.Image, state: c.State.Status, health: c.State.Health?.Status || null,
        ports: c.NetworkSettings.Ports, privileged: c.HostConfig.Privileged };
    });
    process.stdout.write(JSON.stringify(safe, null, 2) + '\n');
  } else throw new Error('Action required: bootstrap | start | stop | inspect');
}
module.exports = { quoteCompose, serviceFrom };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
