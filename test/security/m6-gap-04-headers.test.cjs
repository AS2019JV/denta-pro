/**
 * Test Suite: M6-GAP-02 / M6-GAP-04 Next.js Config Hygiene & Security Response Headers
 *
 * Validates:
 * 1. AST/static check confirming no duplicate object keys in next.config.mjs (M6-GAP-02),
 *    including computed properties and numeric literals.
 * 2. Static check confirming transpilePackages appears exactly once.
 * 3. AST semantic check confirming no duplicate header definitions in next.config.mjs.
 * 4. Dynamic evaluation of nextConfig.headers() returning rules for all routes `/(.*)`.
 * 5. Response header deduplication (no duplicate header keys emitted in headers array).
 * 6. Strict-Transport-Security (HSTS) presence, max-age >= 63072000, includeSubDomains, and preload (M6-GAP-04).
 * 7. Content-Security-Policy (CSP) presence and directive-level verification:
 *    - default-src 'self'
 *    - script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co
 *    - style-src 'self' 'unsafe-inline'
 *    - img-src 'self' data: blob: https://*.supabase.co
 *    - font-src 'self' data:
 *    - connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com
 *    - frame-ancestors 'none'
 *    - form-action 'self'
 *    - base-uri 'self'
 * 8. Standard baseline security headers:
 *    - X-Frame-Options: DENY
 *    - X-Content-Type-Options: nosniff
 *    - X-XSS-Protection: 1; mode=block
 *    - Referrer-Policy: strict-origin-when-cross-origin
 *    - Permissions-Policy: camera=(), microphone=(), geolocation=()
 * 9. Negative invariant harness testing (proving AST duplicate detector, CSP parser, and HSTS validator fail on malicious/broken inputs).
 */

const assert = require('node:assert/strict');
const { test, describe, before } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

const ROOT_DIR = join(__dirname, '../..');
const NEXT_CONFIG_PATH = join(ROOT_DIR, 'next.config.mjs');

/**
 * Extracts property key name from a TypeScript AST ObjectLiteralElement.
 * Supports identifiers, string literals, numeric literals, and computed property names.
 */
function getPropertyKeyName(prop) {
  if (!prop || !prop.name) return null;
  if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)) {
    return prop.name.text;
  }
  if (ts.isComputedPropertyName(prop.name)) {
    const expr = prop.name.expression;
    if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr) || ts.isIdentifier(expr)) {
      return expr.text;
    }
  }
  return null;
}

/**
 * Analyzes source code AST to locate duplicate keys within all object literals.
 */
function findDuplicateObjectKeysInSource(sourceText, fileName = 'file.js') {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const duplicateKeys = [];

  function findDuplicates(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const seenKeys = new Map();
      for (const prop of node.properties) {
        const keyName = getPropertyKeyName(prop);
        if (keyName) {
          if (seenKeys.has(keyName)) {
            duplicateKeys.push({
              key: keyName,
              firstLine: seenKeys.get(keyName),
              duplicateLine: sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile)).line + 1,
            });
          } else {
            seenKeys.set(keyName, sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile)).line + 1);
          }
        }
      }
    }
    ts.forEachChild(node, findDuplicates);
  }

  findDuplicates(sourceFile);
  return duplicateKeys;
}

/**
 * Parses a CSP string into a Map of directive -> array of source tokens.
 * Detects and records any duplicate directives.
 */
function parseCSPDirectives(cspString) {
  assert.equal(typeof cspString, 'string', 'CSP must be a string');
  const directives = new Map();
  const duplicateDirectives = [];
  const rawParts = cspString.split(';').map(p => p.trim()).filter(Boolean);

  for (const part of rawParts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const directiveName = tokens[0].toLowerCase();
    const sources = tokens.slice(1);

    if (directives.has(directiveName)) {
      duplicateDirectives.push(directiveName);
    } else {
      directives.set(directiveName, sources);
    }
  }

  return { directives, duplicateDirectives };
}

describe('M6-GAP-02: Next.js Configuration AST & Key Deduplication', () => {
  const sourceCode = readFileSync(NEXT_CONFIG_PATH, 'utf8');

  test('next.config.mjs contains NO duplicate object keys across all object literals (AST analysis)', () => {
    const duplicateKeys = findDuplicateObjectKeysInSource(sourceCode, 'next.config.mjs');
    assert.deepEqual(
      duplicateKeys,
      [],
      `Duplicate keys detected in next.config.mjs: ${JSON.stringify(duplicateKeys)}`
    );
  });

  test('next.config.mjs defines transpilePackages exactly once', () => {
    const occurrences = (sourceCode.match(/transpilePackages\s*:/g) || []).length;
    assert.equal(
      occurrences,
      1,
      `Expected transpilePackages to appear exactly once, but found ${occurrences} occurrences`
    );
  });

  test('next.config.mjs AST does not define duplicate HTTP response header keys in headers array', () => {
    const sourceFile = ts.createSourceFile('next.config.mjs', sourceCode, ts.ScriptTarget.Latest, true);
    const duplicateHeaderKeys = [];

    function checkHeaderArray(node) {
      if (ts.isPropertyAssignment(node) && getPropertyKeyName(node) === 'headers') {
        if (ts.isArrayLiteralExpression(node.initializer)) {
          const seenHeaders = new Map();
          for (const elem of node.initializer.elements) {
            if (ts.isObjectLiteralExpression(elem)) {
              for (const p of elem.properties) {
                if (ts.isPropertyAssignment(p) && getPropertyKeyName(p) === 'key') {
                  if (ts.isStringLiteral(p.initializer)) {
                    const headerName = p.initializer.text.toLowerCase();
                    const line = sourceFile.getLineAndCharacterOfPosition(p.getStart(sourceFile)).line + 1;
                    if (seenHeaders.has(headerName)) {
                      duplicateHeaderKeys.push({
                        header: p.initializer.text,
                        firstLine: seenHeaders.get(headerName),
                        duplicateLine: line,
                      });
                    } else {
                      seenHeaders.set(headerName, line);
                    }
                  }
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, checkHeaderArray);
    }

    checkHeaderArray(sourceFile);
    assert.deepEqual(
      duplicateHeaderKeys,
      [],
      `Duplicate header keys detected in AST headers array: ${JSON.stringify(duplicateHeaderKeys)}`
    );
  });
});

describe('M6-GAP-04: Security Response Headers Dynamic Evaluation', () => {
  let headersMap;
  let rawHeaders;
  let parsedCSP;

  before(async () => {
    const fileUrl = pathToFileURL(NEXT_CONFIG_PATH).href;
    const configModule = await import(fileUrl);
    const nextConfig = configModule.default || configModule;

    assert.equal(typeof nextConfig.headers, 'function', 'nextConfig must export an async headers() function');

    const headerRules = await nextConfig.headers();
    assert.ok(Array.isArray(headerRules), 'nextConfig.headers() must return an array');

    const globalRule = headerRules.find(rule => rule.source === '/(.*)');
    assert.ok(globalRule, 'Must define a global header rule matching `/(.*)`');
    assert.ok(Array.isArray(globalRule.headers), 'Global rule must define an array of headers');

    rawHeaders = globalRule.headers;

    // Verify no duplicate header keys in the returned headers array
    const seenHeaderNames = new Set();
    const duplicates = [];
    headersMap = new Map();

    for (const h of globalRule.headers) {
      assert.ok(h.key, 'Each header entry must have a key');
      assert.ok(h.value !== undefined, `Header ${h.key} must have a defined value`);
      const lower = h.key.toLowerCase();
      if (seenHeaderNames.has(lower)) {
        duplicates.push(h.key);
      }
      seenHeaderNames.add(lower);
      headersMap.set(lower, h.value);
    }

    assert.deepEqual(
      duplicates,
      [],
      `Duplicate headers found in global rule: ${duplicates.join(', ')}`
    );

    const cspValue = headersMap.get('content-security-policy');
    assert.ok(cspValue, 'Content-Security-Policy header must exist');
    parsedCSP = parseCSPDirectives(cspValue);
    assert.deepEqual(
      parsedCSP.duplicateDirectives,
      [],
      `Duplicate CSP directives detected: ${parsedCSP.duplicateDirectives.join(', ')}`
    );
  });

  describe('Standard Baseline Security Headers', () => {
    test('X-Frame-Options is set to DENY', () => {
      assert.equal(headersMap.get('x-frame-options'), 'DENY');
    });

    test('X-Content-Type-Options is set to nosniff', () => {
      assert.equal(headersMap.get('x-content-type-options'), 'nosniff');
    });

    test('X-XSS-Protection is set to 1; mode=block', () => {
      assert.equal(headersMap.get('x-xss-protection'), '1; mode=block');
    });

    test('Referrer-Policy is set to strict-origin-when-cross-origin', () => {
      assert.equal(headersMap.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    test('Permissions-Policy restricts camera, microphone, and geolocation', () => {
      const value = headersMap.get('permissions-policy');
      assert.ok(value, 'Permissions-Policy must be present');
      assert.ok(value.includes('camera=()'), 'Must restrict camera');
      assert.ok(value.includes('microphone=()'), 'Must restrict microphone');
      assert.ok(value.includes('geolocation=()'), 'Must restrict geolocation');
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    test('Strict-Transport-Security header is present', () => {
      assert.ok(
        headersMap.has('strict-transport-security'),
        'Strict-Transport-Security header must be present'
      );
    });

    test('Strict-Transport-Security enforces at least 2-year duration (max-age=63072000)', () => {
      const hsts = headersMap.get('strict-transport-security');
      const maxAgeMatch = hsts.match(/max-age=(\d+)/);
      assert.ok(maxAgeMatch, 'HSTS must include max-age directive');
      const maxAgeSeconds = parseInt(maxAgeMatch[1], 10);
      assert.ok(
        maxAgeSeconds >= 63072000,
        `HSTS max-age must be at least 63072000 (2 years), got ${maxAgeSeconds}`
      );
    });

    test('Strict-Transport-Security includes includeSubDomains flag', () => {
      const hsts = headersMap.get('strict-transport-security');
      assert.ok(
        hsts.includes('includeSubDomains'),
        'HSTS must include `includeSubDomains` directive'
      );
    });

    test('Strict-Transport-Security includes preload flag', () => {
      const hsts = headersMap.get('strict-transport-security');
      assert.ok(
        hsts.includes('preload'),
        'HSTS must include `preload` directive'
      );
    });

    test('Strict-Transport-Security exact value matches specification', () => {
      assert.equal(
        headersMap.get('strict-transport-security'),
        'max-age=63072000; includeSubDomains; preload'
      );
    });
  });

  describe('Content-Security-Policy (CSP) Directive Analysis', () => {
    test('Content-Security-Policy header is present', () => {
      assert.ok(
        headersMap.has('content-security-policy'),
        'Content-Security-Policy header must be present'
      );
    });

    test('CSP defines strict default-src fallback to \'self\' only', () => {
      const defaultSrc = parsedCSP.directives.get('default-src');
      assert.ok(defaultSrc, 'CSP must declare default-src');
      assert.deepEqual(
        defaultSrc,
        ["'self'"],
        `default-src must strictly be ['\'self\''], got: ${JSON.stringify(defaultSrc)}`
      );
    });

    test('CSP permits necessary script sources with Supabase host specifically inside script-src', () => {
      const scriptSrc = parsedCSP.directives.get('script-src');
      assert.ok(scriptSrc, 'CSP must declare script-src');
      assert.ok(scriptSrc.includes("'self'"), 'script-src must include \'self\'');
      assert.ok(scriptSrc.includes("'unsafe-inline'"), 'script-src must include \'unsafe-inline\'');
      assert.ok(scriptSrc.includes("'unsafe-eval'"), 'script-src must include \'unsafe-eval\'');
      assert.ok(scriptSrc.includes('https://*.supabase.co'), 'script-src must permit https://*.supabase.co');
    });

    test('CSP permits style-src \'self\' and \'unsafe-inline\' specifically inside style-src', () => {
      const styleSrc = parsedCSP.directives.get('style-src');
      assert.ok(styleSrc, 'CSP must declare style-src');
      assert.deepEqual(
        styleSrc,
        ["'self'", "'unsafe-inline'"],
        `style-src must match ['\'self\'', '\'unsafe-inline\''], got: ${JSON.stringify(styleSrc)}`
      );
    });

    test('CSP permits img-src from \'self\', data:, blob:, and Supabase storage specifically inside img-src', () => {
      const imgSrc = parsedCSP.directives.get('img-src');
      assert.ok(imgSrc, 'CSP must declare img-src');
      assert.ok(imgSrc.includes("'self'"), 'img-src must permit \'self\'');
      assert.ok(imgSrc.includes('data:'), 'img-src must permit data: URLs');
      assert.ok(imgSrc.includes('blob:'), 'img-src must permit blob: URLs');
      assert.ok(imgSrc.includes('https://*.supabase.co'), 'img-src must permit https://*.supabase.co');
    });

    test('CSP permits font-src \'self\' and data: specifically inside font-src', () => {
      const fontSrc = parsedCSP.directives.get('font-src');
      assert.ok(fontSrc, 'CSP must declare font-src');
      assert.deepEqual(
        fontSrc,
        ["'self'", 'data:'],
        `font-src must match ['\'self\'', 'data:'], got: ${JSON.stringify(fontSrc)}`
      );
    });

    test('CSP permits connect-src for Supabase HTTP, Supabase WebSockets, and Resend API specifically inside connect-src', () => {
      const connectSrc = parsedCSP.directives.get('connect-src');
      assert.ok(connectSrc, 'CSP must declare connect-src');
      assert.ok(connectSrc.includes("'self'"), 'connect-src must permit \'self\'');
      assert.ok(connectSrc.includes('https://*.supabase.co'), 'connect-src must permit https://*.supabase.co');
      assert.ok(connectSrc.includes('wss://*.supabase.co'), 'connect-src must permit wss://*.supabase.co');
      assert.ok(connectSrc.includes('https://api.resend.com'), 'connect-src must permit https://api.resend.com');
    });

    test('CSP forbids frame embedding with frame-ancestors \'none\' strictly', () => {
      const frameAncestors = parsedCSP.directives.get('frame-ancestors');
      assert.ok(frameAncestors, 'CSP must declare frame-ancestors');
      assert.deepEqual(
        frameAncestors,
        ["'none'"],
        `frame-ancestors must strictly be ['\'none\''], got: ${JSON.stringify(frameAncestors)}`
      );
    });

    test('CSP restricts form-action and base-uri strictly to \'self\'', () => {
      const formAction = parsedCSP.directives.get('form-action');
      const baseUri = parsedCSP.directives.get('base-uri');
      assert.ok(formAction, 'CSP must declare form-action');
      assert.ok(baseUri, 'CSP must declare base-uri');
      assert.deepEqual(
        formAction,
        ["'self'"],
        `form-action must strictly be ['\'self\''], got: ${JSON.stringify(formAction)}`
      );
      assert.deepEqual(
        baseUri,
        ["'self'"],
        `base-uri must strictly be ['\'self\''], got: ${JSON.stringify(baseUri)}`
      );
    });

    test('CSP exact calibrated string matches specification verbatim', () => {
      const expectedCSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self';";
      assert.equal(headersMap.get('content-security-policy'), expectedCSP);
    });
  });
});

describe('Negative Invariant Verification (Harness Self-Test)', () => {
  test('Negative: AST duplicate key detector catches duplicate property keys', () => {
    const badCode = `
      const config = {
        transpilePackages: ['a'],
        compiler: {},
        transpilePackages: ['b']
      };
    `;
    const dups = findDuplicateObjectKeysInSource(badCode);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].key, 'transpilePackages');
  });

  test('Negative: AST duplicate key detector catches computed property duplicates', () => {
    const badCode = `
      const config = {
        ['transpilePackages']: ['a'],
        transpilePackages: ['b']
      };
    `;
    const dups = findDuplicateObjectKeysInSource(badCode);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].key, 'transpilePackages');
  });

  test('Negative: CSP parser detects duplicate directives', () => {
    const duplicateCSP = "default-src 'self'; script-src 'self'; script-src https://evil.com;";
    const { duplicateDirectives } = parseCSPDirectives(duplicateCSP);
    assert.deepEqual(duplicateDirectives, ['script-src']);
  });

  test('Negative: Directive-level CSP verification catches host omission in img-src when present in connect-src', () => {
    const leakyCSP = "default-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co;";
    const { directives } = parseCSPDirectives(leakyCSP);
    const imgSrc = directives.get('img-src');
    // img-src does not have Supabase, even though connect-src does
    assert.equal(imgSrc.includes('https://*.supabase.co'), false);
  });

  test('Negative: frame-ancestors rejects non-none external origins', () => {
    const permissiveCSP = "frame-ancestors 'none' https://phishing.com;";
    const { directives } = parseCSPDirectives(permissiveCSP);
    const frameAncestors = directives.get('frame-ancestors');
    assert.notDeepEqual(frameAncestors, ["'none'"]);
  });
});
