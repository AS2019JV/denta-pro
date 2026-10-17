'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'docs/production/evidence/2026-09-28-performance');
const read=name=>fs.readFileSync(path.join(output,name),'utf8');
function browser(name) {
  const match=read(name).match(/### Result\s*\r?\n([^\r\n]+)/);
  assert.ok(match,'Missing browser result '+name);
  return JSON.parse(match[1]);
}
const agenda=JSON.parse(read('agenda-runtime-02/execution.json'));
assert.equal(agenda.state,'VERIFIED_LOCAL_BOUNDED');assert.equal(agenda.checks.length,10);assert.ok(agenda.checks.every(c=>c.passed));
const flow=browser('browser-agenda.log'),visual=browser('browser-visuals-pdf-final.log'),landing=browser('browser-landing.log');
for(const result of [flow,visual,landing])assert.equal(result.state,'VERIFIED_LOCAL_BOUNDED');
const before=browser('browser-optimized-before.log'),after=browser('browser-optimized-final.log'),publicMetrics=browser('browser-landing-performance-final.log');
assert.equal(after.mode,'authenticated');assert.equal(publicMetrics.mode,'anonymous');
const pdf=fs.readFileSync(path.join(output,'receta-sintetica-lazy.pdf'));
assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.subarray(-32).toString().includes('%%EOF'));
assert.ok(pdf.toString('latin1').includes('PRUEBA TECNICA'));
const pdfEvidence={bytes:pdf.length,sha256:crypto.createHash('sha256').update(pdf).digest('hex'),header:pdf.subarray(0,8).toString(),eof:true,syntheticMarker:true,clinicalLayoutApproval:false};
const sources=['.gitignore','next.config.mjs','tsconfig.json','middleware.ts','components/auth-context.tsx','hooks/use-dashboard-data.ts','hooks/use-realtime-notifications.ts','components/appointment-editor.tsx','components/quick-appointment-dialog.tsx','components/calendar/modern-calendar.tsx','components/sidebar.tsx','app/(dashboard)/dashboard/page.tsx','app/(dashboard)/layout.tsx','app/(landing)/page.tsx','app/(landing)/layout.tsx','components/landing/layout/site-header.tsx','components/patient-prescriptions.tsx','components/hcu033-form.tsx','components/issued-prescriptions-list.tsx','lib/agenda.mjs','lib/agenda.d.mts','lib/pdf-client.ts','lib/pdf-generator.ts','tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql','scripts/clinia-local-app.cjs','scripts/verify-clinia-agenda.cjs','scripts/measure-clinia-local-queries.cjs','tools/local-supabase/browser-performance.js','tools/local-supabase/browser-agenda.js','tools/local-supabase/browser-visuals-pdf.js','tools/local-supabase/browser-landing.js','test/production/agenda-contract.test.cjs','test/production/auth-context-race.test.cjs','test/production/middleware-authority.test.cjs','test/production/dashboard-authorized-contracts.test.cjs','test/production/financial-retirement.test.cjs','test/production/local-csp.test.cjs'];
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const manifest={capturedAt:new Date().toISOString(),baseGit:head,dirtyWorkingTree:true,buildDirectory:'.next-clinia-acceptance',buildId:fs.readFileSync(path.join(root,'.next-clinia-acceptance/BUILD_ID'),'utf8').trim(),notAReleaseCommit:true,files:sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(manifest,null,2));
const result={state:'PARTIAL_NO_GO_CLINICAL',verifiedAt:new Date().toISOString(),environment:'local-synthetic-3400',baseGit:head,buildId:manifest.buildId,buildExitCodeObserved:0,unitRunner:{exitCodeObserved:0,reportedTests:30,failed:0},agendaCases:agenda.checks,uiFlow:flow,visualsAndPdf:visual,landing,pdfEvidence,browserMetrics:{before:before.pages,after:after.pages,anonymous:publicMetrics.pages},api:JSON.parse(read('api-latency.json')),limitations:[
  'Build source selection is fingerprinted, not a complete immutable release snapshot.',
  'Final browser build includes a mobile layout delta after the earlier appointment mutation test; final read/layout/PDF and performance checks use the final build.',
  'Hardware resources changed; small warm samples do not establish causal speedup or production SLOs.',
  'Focus request snapshots can miss in-flight requests; use unit coalescing evidence, not an exact request-reduction claim.',
  '33 synthetic patients; no 5000-patient/10-user load, INP, remote performance or field Core Web Vitals.',
  'Schema/config parity01, full roles02/finance retirement04, clinical PDF09, privacy/security13 and DR/UAT15 remain pending.',
  'No production mutation, external message/email or clinical/legal approval.'
]};
fs.writeFileSync(path.join(output,'verification-summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({state:result.state,sourceFiles:manifest.files.length,buildId:manifest.buildId,pdfBytes:pdf.length,agendaChecks:agenda.checks.length,layouts:visual.layouts.map(x=>x.width)}));
