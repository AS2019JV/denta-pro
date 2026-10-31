'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.resolve(__dirname, '../../lib/pilot-policy.ts')

function loadPolicy(mode = 'synthetic') {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    process: { env: { NEXT_PUBLIC_CLINIA_PILOT_MODE: mode } },
  }, { filename: sourcePath })
  return module.exports
}

test('synthetic pilot blocks every excluded route at its exact path and below it', () => {
  const { pilotPathBlocked } = loadPolicy()
  const excluded = [
    '/billing', '/pay', '/reports', '/recipes', '/marketing', '/messages',
    '/settings', '/clinic', '/dentists', '/dashboard/services',
    '/free-trial', '/schedule-demo', '/api/clinical-documents', '/api/private-media',
    '/api/payments', '/api/webhooks', '/api/send-email',
  ]

  for (const route of excluded) {
    assert.equal(pilotPathBlocked(route), true, `${route} should be blocked`)
    assert.equal(pilotPathBlocked(`${route}/child`), true, `${route}/child should be blocked`)
  }
})

test('route exclusions use path boundaries and do not block similarly named routes', () => {
  const { pilotPathBlocked } = loadPolicy()
  for (const route of ['/billing-help', '/recipes-other', '/dashboard/services-old', '/api/payments-v2']) {
    assert.equal(pilotPathBlocked(route), false, `${route} should remain outside the exclusion`)
  }
})

test('ordinary pilot routes for patients, calendar, login, auth, MFA, and health stay available', () => {
  const { pilotPathBlocked } = loadPolicy()
  for (const route of ['/patients', '/calendar', '/login', '/signup', '/auth/callback', '/mfa', '/api/health']) {
    assert.equal(pilotPathBlocked(route), false, `${route} should remain available`)
  }
})

test('synthetic pilot redirects restricted patient tabs to info', () => {
  const { SYNTHETIC_PILOT, pilotPatientTab } = loadPolicy('synthetic')
  assert.equal(SYNTHETIC_PILOT, true)
  for (const tab of ['files', 'recipes', 'payments']) assert.equal(pilotPatientTab(tab), 'info')
  assert.equal(pilotPatientTab('info'), 'info')
  assert.equal(pilotPatientTab('visits'), 'visits')
})

test('outside synthetic mode, patient tab requests pass through unchanged', () => {
  const { SYNTHETIC_PILOT, pilotPatientTab } = loadPolicy('production')
  assert.equal(SYNTHETIC_PILOT, false)
  for (const tab of ['files', 'recipes', 'payments', 'info']) assert.equal(pilotPatientTab(tab), tab)
})
