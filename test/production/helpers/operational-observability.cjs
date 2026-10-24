'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
function loadObservability(records = [], sinkFails = false) {
  const modules = {};
  function load(file) {
    if (modules[file]) return modules[file];
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const sink = value => { if (sinkFails) throw Error('sink unavailable'); records.push(JSON.parse(value)); };
    vm.runInNewContext(code, { module, exports: module.exports, performance,
      console: { info: sink, warn: sink, error: sink },
      require(name) {
        if (name === 'server-only') return {};
        if (name === 'node:crypto') return require(name);
        if (name === '@/lib/logger') return load('lib/logger.ts');
        throw Error('Unexpected operational helper import');
      },
    });
    modules[file] = module.exports;
    return module.exports;
  }
  return { ...load('lib/operational-observability.ts'), ...load('lib/logger.ts'), records };
}
module.exports = { loadObservability };
