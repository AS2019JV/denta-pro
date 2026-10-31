// Existing non-pilot contract suites exercise the real policy in its default mode.
// Synthetic-mode denials are covered separately by pilot-policy/pilot-boundaries.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
module.exports = function loadPilotPolicy(mode) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../../lib/pilot-policy.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(code, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_CLINIA_PILOT_MODE: mode } } })
  return mod.exports
}
