const test = require('node:test'), assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { formatBirthDate, ageFromBirthDate } = require('../../lib/birth-date.mjs')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')

test('actual patient summary formatter displays the saved day and keeps missing dates explicit', () => {
  const name='app/(dashboard)/patients/[id]/page.tsx'
  const source=ts.createSourceFile(name,fs.readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let initializer
  function visit(node){if(ts.isVariableDeclaration(node) && node.name.getText(source)==='formatBirthDateAndAge')initializer=node.initializer.getText(source);ts.forEachChild(node,visit)}
  visit(source);assert.ok(initializer)
  const fixed=new Date(2026,9,23,12).getTime()
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[fixed]))}}
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule('module.exports='+initializer,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
    module,Date:ClockDate,formatBirthDate,
    ageFromBirthDate: value => ageFromBirthDate(value,new ClockDate()),
  })
  assert.equal(module.exports('1990-01-01'),'1/1/1990 (36 años)')
  for(const value of [undefined,'','2026-02-30'])assert.equal(module.exports(value),'Fecha de nacimiento no registrada')
})

test('birth-date presentation preserves saved calendar fields across Ecuador, UTC and eastern time zones', () => {
  for (const TZ of ['America/Guayaquil', 'Pacific/Galapagos', 'UTC', 'Pacific/Kiritimati']) {
    const script = `const b=require('./lib/birth-date.mjs'); console.log(JSON.stringify([
      b.formatBirthDate('1990-01-01'), b.formatBirthDate('2000-02-29')]));`
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), ['1/1/1990', '29/2/2000'], TZ)
  }
})

test('birth-date presentation rejects impossible dates without normalizing them to another day', () => {
  assert.equal(formatBirthDate('2000-02-29'), '29/2/2000')
  for (const value of ['', null, undefined, '1900-02-29', '2026-02-30', '1990-13-01', '1990-00-01', '1990-01-00', '1990-01-01T00:00:00Z']) {
    assert.equal(formatBirthDate(value), '')
  }
})
