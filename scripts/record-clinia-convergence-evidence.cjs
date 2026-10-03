'use strict';
// Filesystem evidence only. Does not load env, private actors or database keys.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/production/evidence/2026-09-28-convergence');
const json=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
const cli=file=>{
  const match=fs.readFileSync(path.join(dir,file),'utf8').match(/### Result\r?\n([^\r\n]+)/);
  if(!match)throw Error('Successful browser result absent: '+file);
  return JSON.parse(match[1]);
};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources=[
  'app/(dashboard)/reports/page.tsx','app/(dashboard)/dashboard/services/page.tsx',
  'components/dashboard/services/services-manager.tsx','lib/operational-reports.mjs','lib/operational-reports.d.mts','lib/reports-pdf.ts',
  'app/(dashboard)/marketing/page.tsx','app/(dashboard)/settings/page.tsx','components/settings/subscription-tab.tsx',
  'components/sidebar.tsx','app/api/send-email/route.ts','components/landing/layout/site-footer.tsx',
  'components/auth-context.tsx','components/dashboard-wrapper.tsx','middleware.ts','components/patient-prescriptions.tsx','lib/pdf-client.ts',
  'scripts/generate-clinia-operational-convergence.cjs','scripts/verify-clinia-operational-convergence.cjs',
  'scripts/verify-clinia-operational-report.cjs','scripts/clinia-catalog-fixture.cjs',
  'docs/production/reconciliation/operational-convergence/before-authority.sql',
  'docs/production/reconciliation/operational-convergence/after-authority.sql',
  'docs/production/reconciliation/operational-convergence/verify-boundaries.sql',
  'docs/production/reconciliation/operational-convergence/invariants.sql',
  'tools/local-supabase/supabase/migrations/20260928190221_operational_reports.sql',
  'test/production/operational-reports.test.cjs','test/production/auth-context-race.test.cjs',
  'test/production/middleware-authority.test.cjs','test/production/pdf-publication.test.cjs',
  'tools/local-supabase/browser-operational-review.js','tools/local-supabase/browser-operational-visual.js',
  'tools/local-supabase/browser-operational-timings.js','tools/local-supabase/browser-authority-draft.js',
  'tools/local-supabase/browser-doctor-reports.js',
];
for(const name of ['source-manifest.json','verification-summary.json'])assert.equal(fs.existsSync(path.join(dir,name)),false,'Evidence exists; refuse overwrite');
const contract=json('attempt-2/execution.json'),compare=json('attempt-2/contract-comparison.json'),report=json('reports-1/execution.json');
assert.equal(contract.state,'SCOPED_SQL_CONVERGENCE_VERIFIED_API_PENDING');assert.equal(compare.differences.length,0);assert.equal(report.state,'LOCAL_REPORT_JWT_VERIFIED');
const operational=cli('browser-verified.log'),draft=cli('browser-authority-draft.log'),doctor=cli('browser-doctor-reports.log'),visual=cli('browser-visual.log'),timings=cli('browser-timings.log');
assert.equal(operational.errors.length,0);assert.equal(draft.state,'LOCAL_AUTH_DRAFT_VERIFIED');assert.equal(doctor.state,'LOCAL_DOCTOR_ROUTE_VERIFIED');
const unit=fs.readFileSync(path.join(dir,'unit-release-final.log'),'utf8');assert.match(unit,/^# tests 33\r?$/m);assert.match(unit,/^# fail 0\r?$/m);
const build=fs.readFileSync(path.join(dir,'build-release-final.log'),'utf8');assert.match(build,/Compiled successfully/);assert.match(build,/Generating static pages \(13\/13\)/);
const createdAt=new Date().toISOString();
const manifest={createdAt,baseCommit:'f96fbb898ec2a0615dec293ee3e5ce0a9b41b170',kind:'selected working-tree sources; not a complete immutable release',files:sources.map(relative=>({path:relative,sha256:sha(path.join(root,relative))}))};
const artifactFiles=['informe-operativo.pdf','informe-render-1.png','reports-360-light-stable.png','reports-360-dark-stable.png','reports-360-light-bottom.png','reports-360-dark-bottom.png','treatments-360-light.png'];
const summary={createdAt,state:'PARCIAL_NO_GO_CLINICO',environment:'clinia-acceptance / 127.0.0.1:3400',buildId:fs.readFileSync(path.join(root,'.next-clinia-acceptance/BUILD_ID'),'utf8').trim(),
  build:{command:'node scripts/clinia-local-app.cjs build',exitCode:0,evidence:'build-release-final.log',typesAndLint:true,existingWarningsRemain:true},
  unit:{exitCode:0,tests:33,failures:0,evidence:'unit-release-final.log'},
  sql:{state:contract.state,checks:contract.checks.length,contractSha256:compare.stageSha256,databases:contract.databases,apiParity:false},
  reports:{state:report.state,checks:report.checks.length,evidence:'reports-1/execution.json'},
  browser:{operational,draft,doctor,visual,verifiedBuildNote:'operational/PDF first build; authority drafts and doctor routes final build'},
  catalog:json('catalog-fixture-verify.json'),timings,
  inspectedArtifacts:artifactFiles.map(relative=>({path:relative,sha256:sha(path.join(dir,relative))})),
  scopeLimits:['No production mutations or deployment','Captured schema only; full remote schema/Auth/Storage parity pending','Final chain/allowlist lacks integrated report overlay replay','SQL clones lack independent API/Auth/Storage','No 5000/10 load or field metrics','No clinical approval, legal approval or DB+Storage byte recovery'],
  sourceManifest:'source-manifest.json'};
fs.writeFileSync(path.join(dir,'source-manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(dir,'verification-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({state:summary.state,sources:sources.length,buildId:summary.buildId,unitTests:summary.unit.tests}));
