'use strict';
// No production env values or external providers in local acceptance/build.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const rt = require('./clinia-local-runtime.cjs');
const mode = process.argv[2];
if (process.env.VERCEL === '1') throw new Error('Local acceptance is forbidden on Vercel deployments');
if (!['dev','build','start'].includes(mode) || process.argv.length !== 3) throw new Error('Expected dev, build or start');
rt.inspectLocal();
const localKeys = rt.keys();
const env = {...process.env};
for (const name of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']) {
  const file = path.join(rt.repo,name);
  if (fs.existsSync(file)) for (const match of fs.readFileSync(file,'utf8').matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) env[match[1]] = '';
}
Object.assign(env,{NODE_ENV:mode==='dev'?'development':'production',CLINIA_LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_SUPABASE_URL:rt.url,
  NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY:'',VERCEL:'',CLINIA_EMAIL_ENABLED:'',EMAIL_ABUSE_HASH_SECRET:'',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:localKeys.anon,SUPABASE_SERVICE_ROLE_KEY:localKeys.service,
  NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3400',RESEND_API_KEY:'',RESEND_FROM_EMAIL:'',
  KUSHKI_PRIVATE_MERCHANT_ID:'',KUSHKI_PUBLIC_MERCHANT_ID:'',NEXT_PUBLIC_INVOICE_PROVIDER:''});
const args = [path.join(rt.repo,'node_modules/next/dist/bin/next'),mode];
if (mode!=='build') args.push('--hostname','127.0.0.1','--port','3400');
console.log(`Clinia acceptance ${mode}: local synthetic Supabase; external providers disabled.`);
const child = spawn(process.execPath,args,{cwd:rt.repo,env,stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill('SIGINT'));
child.on('error',()=>{console.error('Local application launch failed');process.exitCode=1});
child.on('exit',code=>process.exit(code ?? 1));
