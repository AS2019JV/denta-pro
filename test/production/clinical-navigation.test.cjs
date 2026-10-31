const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
function load(browser) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('lib/clinical-navigation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, window: browser, Event })
  return module.exports
}
function browserAt(index) {
  const state = { listener: null, removed: false, moves: [], stopped: false }
  const browser = { navigation: { currentEntry: { index } }, history: { go: delta => state.moves.push(delta) },
    addEventListener: (name, listener, capture) => { assert.equal(name, 'popstate'); assert.equal(capture, true); state.listener = listener },
    removeEventListener: (name, listener, capture) => { assert.equal(name, 'popstate'); assert.equal(listener, state.listener); assert.equal(capture, true); state.removed = true },
  }
  return { browser, state, traverse(to) { browser.navigation.currentEntry.index = to; state.stopped = false; state.listener({ stopImmediatePropagation: () => { state.stopped = true } }) } }
}
test('programmatic navigation is cancelled by an active clinical draft listener', () => {
  const browser = new EventTarget(), helpers = load(browser)
  assert.equal(helpers.requestClinicalNavigation(), true)
  const deny = event => event.preventDefault()
  browser.addEventListener('clinia:before-navigation', deny)
  assert.equal(helpers.requestClinicalNavigation(), false)
  browser.removeEventListener('clinia:before-navigation', deny)
  assert.equal(helpers.requestClinicalNavigation(), true)
})
test('cancelled Back and Forward restore the exact existing history position without adding entries', () => {
  for (const destination of [2, 4]) {
    const h = browserAt(3), helpers = load(h.browser); let prompts = 0
    const cleanup = helpers.protectClinicalHistory(h.browser, () => { prompts++; return false })
    h.traverse(destination)
    assert.equal(h.state.stopped, true)
    assert.deepEqual(h.state.moves, [3 - destination])
    h.traverse(3)
    assert.equal(h.state.stopped, false)
    assert.equal(prompts, 1)
    cleanup(); assert.equal(h.state.removed, true)
  }
})
test('accepted traversal proceeds without history mutation or stopping the router', () => {
  const h = browserAt(3), helpers = load(h.browser)
  helpers.protectClinicalHistory(h.browser, () => true)
  h.traverse(2)
  assert.equal(h.state.stopped, false)
  assert.equal(h.state.moves.length, 0)
})
test('browsers without indexed history are detected before enabling pilot editing', () => {
  const helpers = load({})
  assert.equal(helpers.supportsClinicalHistoryGuard({}), false)
  assert.equal(helpers.supportsClinicalHistoryGuard({ navigation: { currentEntry: { index: -1 } } }), false)
  assert.equal(helpers.supportsClinicalHistoryGuard({ navigation: { currentEntry: { index: 0 } } }), true)
})
