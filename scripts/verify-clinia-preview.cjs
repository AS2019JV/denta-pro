'use strict';
// Exact owned preview; no cookie/token extraction, redirects or email dispatch.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime=require('./clinia-staging-runtime.cjs');
const ORIGIN='https://v0-denta-pro-git-codex-cl-3f4a77-alesuav2001-gmailcoms-projects.vercel.app';
async function main(){
 assert.deepEqual(process.argv.slice(2),[ORIGIN]);const config=runtime.readConfig();
 const report={status:'PARTIALLY VERIFIED',candidateCommit:'544a092d24b61f0c36c9b32490e9be0d34dc1438',origin:ORIGIN,startedAt:new Date().toISOString(),requests:[],checks:[],assets:[],limits:['Anonymous HTTP checks and observed HTML-referenced JS only; browser roles and all lazy assets are separate gates','No deployed email/provider dispatch or clinical approval']};
 async function get(route){
  const u=new URL(route,ORIGIN);assert.equal(u.origin,ORIGIN);
  const r=await fetch(u,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await r.arrayBuffer());
  assert.ok(!bytes.includes(Buffer.from(config.service)),'Privileged credential exposed');
  const headers={};for(const name of ['cache-control','content-security-policy','x-content-type-options','strict-transport-security','x-frame-options','location'])if(r.headers.has(name)){const value=r.headers.get(name);headers[name]=name==='location'?new URL(value,ORIGIN).origin+new URL(value,ORIGIN).pathname:value;}
  report.requests.push({path:u.pathname,status:r.status,headers,bytes:bytes.length,bodySha256:crypto.createHash('sha256').update(bytes).digest('hex')});return{r,text:bytes.toString('utf8')};
 }
 try{
  const html=[];
  for(const route of ['/','/login']){const r=await get(route);if([302,303,307,308].includes(r.r.status)&&r.r.headers.get('location')){const redirect=new URL(r.r.headers.get('location'),ORIGIN);if(redirect.origin==='https://vercel.com'&&redirect.pathname==='/sso-api'){report.status='BLOCKED';report.checks.push({name:'Provider Preview protection denies unauthenticated CLI access',status:'VERIFIED',applicationRouteVerification:'BLOCKED'});throw Object.assign(Error('Provider protection requires authorized browser or automation credential'),{code:'PREVIEW_PROVIDER_AUTH_REQUIRED'});}}assert.equal(r.r.status,200);assert.ok(r.text.includes('Clinia'));assert.equal(r.r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.r.headers.get('x-frame-options'),'DENY');assert.ok(r.r.headers.get('strict-transport-security')?.includes('max-age='));html.push(r.text);}
  report.checks.push({name:'Anonymous landing/login and security response headers',status:'VERIFIED'});
  for(const route of ['/dashboard','/patients','/recipes','/settings']){const r=await get(route);assert.ok([302,303,307,308].includes(r.r.status));const redirect=new URL(r.r.headers.get('location'),ORIGIN);assert.equal(redirect.origin,ORIGIN);assert.equal(redirect.pathname,'/login');}
  report.checks.push({name:'Anonymous protected application routes deny via same-origin login redirect',status:'VERIFIED'});
  for(const route of ['/auth/callback?next=https%3A%2F%2Fexample.invalid','/api/auth/confirm?next=%2F%2Fexample.invalid']){const r=await get(route);assert.ok([302,303,307,308].includes(r.r.status));assert.equal(new URL(r.r.headers.get('location'),ORIGIN).origin,ORIGIN);}
  report.checks.push({name:'Invalid confirmation/callback next values cannot redirect externally',status:'VERIFIED'});
  const urls=new Set();for(const text of html)for(const m of text.matchAll(/<script[^>]+src="([^"]+)"/g)){const u=new URL(m[1].replaceAll('&amp;','&'),ORIGIN);if(u.origin===ORIGIN&&u.pathname.startsWith('/_next/static/'))urls.add(u.pathname+u.search);}
  assert.ok(urls.size>0&&urls.size<100,'Bounded observed client assets required');
  for(const url of urls){const r=await get(url);assert.equal(r.r.status,200);report.assets.push({path:new URL(url,ORIGIN).pathname,bytes:report.requests.at(-1).bytes,sha256:report.requests.at(-1).bodySha256});}
  report.checks.push({name:'Server-only staging credential absent from every observed landing/login JS asset',status:'VERIFIED',scanned:report.assets.length});
  report.status='VERIFIED';
 }catch(error){report.failure=error.code==='PREVIEW_PROVIDER_AUTH_REQUIRED'?'Provider SSO blocks CLI app verification; protection retained':'Named preview verification failed; inspect safe statuses/headers';process.exitCode=1;}
 finally{report.completedAt=new Date().toISOString();const dir=path.join(runtime.repo,'docs/production/evidence/2026-10-03-release'),file=path.join(dir,'preview-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({status:report.status,checks:report.checks,evidence:file}));}
}
if(require.main===module)main().catch(()=>{console.error('Exact authorized preview prerequisites refused');process.exitCode=1;});
