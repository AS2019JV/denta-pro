// Existing authorization/transport suites exercise the explicitly opted-in QA
// profile. Closed-by-default behavior is covered by clinical-file-closure.test.
// This injects local test configuration only, never hosted authority.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
module.exports = function loadPilotPolicy(mode, verification = true) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../../lib/pilot-policy.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = { exports: {} }
  const env = { NEXT_PUBLIC_CLINIA_PILOT_MODE: mode }
  if (verification && mode !== 'synthetic') Object.assign(env, { NEXT_PUBLIC_CLINIA_FILES_QA: '1', CLINIA_FILES_QA: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'https://fbtlldubzomocuhpvweg.supabase.co', VERCEL_ENV: 'preview' })
  vm.runInNewContext(code, { module: mod, exports: mod.exports, process: { env } })
  // Local future-release injection preserves existing bounds/authority tests only.
  // Actual closed policy is tested without this helper in clinical-file-closure.
  if (verification && mode !== 'synthetic') mod.exports.CLINICAL_DOCUMENTS_RELEASED = true
  return mod.exports
}
