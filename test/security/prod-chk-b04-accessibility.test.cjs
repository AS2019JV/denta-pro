/**
 * PROD-CHK-B04: WCAG 2.1 AA Accessibility Verification Test Suite
 *
 * Verifies accessibility compliance across core clinical workflows:
 * 1. WCAG 2.4.1 (Bypass Blocks): Skip link and main landmark focus management.
 * 2. WCAG 3.3.1 & 3.3.2 (Error Identification): aria-invalid, aria-describedby, and role="alert" error associations.
 * 3. WCAG 2.1.1 (Keyboard Accessible Dental Charts): SVG surfaces tabIndex=0, role="button", onKeyDown (Enter/Space), and focus outlines.
 * 4. WCAG 4.1.2 (Name, Role, Value): Tooth surface ARIA labels, recession/mobility labels, and radiogroups for mode/tool selections.
 * 5. WCAG 1.4.3 (Contrast Minimum): High-contrast color classes (red-600, blue-600) ensuring >= 4.5:1 ratio against white text.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

describe('PROD-CHK-B04: WCAG 2.1 AA Accessibility Review', () => {

  const layoutSource = fs.readFileSync(path.join(ROOT, 'app/(dashboard)/layout.tsx'), 'utf8');
  const addPatientSource = fs.readFileSync(path.join(ROOT, 'components/add-patient-form.tsx'), 'utf8');
  const odontogramaSource = fs.readFileSync(path.join(ROOT, 'components/odontograma-interactive.tsx'), 'utf8');

  test('1. Layout provides skip-to-content link and main landmark focus target (WCAG 2.4.1)', () => {
    assert.match(layoutSource, /href="#main-content"/, 'Must contain link targeting #main-content');
    assert.match(layoutSource, /sr-only focus:not-sr-only/, 'Skip link must be visually hidden until focused');
    assert.match(layoutSource, /id="main-content"/, 'Main landmark must declare id="main-content"');
    assert.match(layoutSource, /tabIndex=\{-1\}/, 'Main landmark must have tabIndex={-1} for focus containment');
  });

  test('2. AddPatientForm associates validation errors with aria-invalid on required inputs (WCAG 3.3.1)', () => {
    const requiredFields = ['cedula', 'name', 'lastName', 'email', 'phone', 'birthDate'];
    for (const field of requiredFields) {
      const regex = new RegExp(`id="${field}"[\\s\\S]*?aria-invalid=\\{errors\\.${field}\\s*\\?\\s*"true"\\s*:\\s*undefined\\}`);
      assert.match(addPatientSource, regex, `Input ${field} must declare aria-invalid based on errors.${field}`);
    }
  });

  test('3. AddPatientForm associates inputs with error descriptions via aria-describedby (WCAG 3.3.2)', () => {
    const requiredFields = ['cedula', 'name', 'lastName', 'email', 'phone', 'birthDate'];
    for (const field of requiredFields) {
      const regex = new RegExp(`id="${field}"[\\s\\S]*?aria-describedby=\\{errors\\.${field}\\s*\\?\\s*"${field}-error"\\s*:\\s*undefined\\}`);
      assert.match(addPatientSource, regex, `Input ${field} must declare aria-describedby referencing ${field}-error`);
    }
  });

  test('4. AddPatientForm error messages declare matching IDs and role="alert" for screen readers', () => {
    const requiredFields = ['cedula', 'name', 'lastName', 'email', 'phone', 'birthDate'];
    for (const field of requiredFields) {
      const regex = new RegExp(`id="${field}-error"\\s+role="alert"`);
      assert.match(addPatientSource, regex, `Error message for ${field} must have id="${field}-error" and role="alert"`);
    }
  });

  test('5. Odontogram tooth SVG surfaces are keyboard-focusable with role="button" (WCAG 2.1.1)', () => {
    assert.match(odontogramaSource, /role="group"\s+aria-label=\{`Pieza dental \$\{id\}`\}/,
      'Tooth SVG container must declare role="group" and tooth ID label');

    const surfaces = ['superior', 'derecha', 'inferior', 'izquierda', 'oclusal o centro'];
    for (const surface of surfaces) {
      const regex = new RegExp(`role="button"[\\s\\S]*?tabIndex=\\{0\\}[\\s\\S]*?aria-label=\\{` + '`' + `Pieza \\$\\{id\\}, superficie ${surface}` + '`' + `\\}`);
      assert.match(odontogramaSource, regex, `Tooth surface "${surface}" must have role="button", tabIndex={0}, and descriptive aria-label`);
    }
  });

  test('6. Odontogram tooth surfaces implement onKeyDown keyboard activation for Enter and Space', () => {
    const keyboardHandlerRegex = /onKeyDown=\{\(e\)\s*=>\s*\{\s*if\s*\(e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*'\s*'\)\s*\{\s*e\.preventDefault\(\);\s*handleApply\(/;
    const matches = odontogramaSource.match(new RegExp(keyboardHandlerRegex, 'g'));
    assert.ok(matches && matches.length >= 5, 'All 5 tooth surfaces must implement Enter and Space keyboard activation');
  });

  test('7. Odontogram tooth surfaces declare visible focus outline rings (WCAG 2.4.7 Focus Visible)', () => {
    const focusRingRegex = /focus:outline-none\s+focus:stroke-blue-500\s+focus:stroke-\[3\]/;
    const matches = odontogramaSource.match(new RegExp(focusRingRegex, 'g'));
    assert.ok(matches && matches.length >= 5, 'All 5 tooth surfaces must declare visible focus stroke rings');
  });

  test('8. Tooth recession and mobility inputs define accessible labels', () => {
    assert.match(odontogramaSource, /aria-label=\{`Recesión gingival pieza \$\{id\}`\}/,
      'Recession input must declare accessible aria-label');
    assert.match(odontogramaSource, /aria-label=\{`Movilidad dental pieza \$\{id\}`\}/,
      'Mobility input must declare accessible aria-label');
  });

  test('9. Diagnostic mode toggles and MSP tools use semantic radiogroups (WCAG 4.1.2)', () => {
    assert.match(odontogramaSource, /role="radiogroup"\s+aria-label="Modo de diagnóstico o tratamiento"/,
      'Mode selector must declare role="radiogroup"');
    assert.match(odontogramaSource, /role="radio"\s+aria-checked=\{activeMode === 'red'\}/,
      'Red mode button must declare role="radio" and aria-checked');
    assert.match(odontogramaSource, /role="radio"\s+aria-checked=\{activeMode === 'blue'\}/,
      'Blue mode button must declare role="radio" and aria-checked');

    assert.match(odontogramaSource, /role="radiogroup"\s+aria-label="Herramientas normadas MSP"/,
      'Tools selector must declare role="radiogroup"');
    assert.match(odontogramaSource, /role="radio"\s+aria-checked=\{activeTool\.id === TOOLS\.SELECT\.id\}/,
      'Select cursor button must declare role="radio" and aria-checked');
    assert.match(odontogramaSource, /role="radio"\s+aria-checked=\{activeTool\.id === 'eraser'\}/,
      'Eraser tool button must declare role="radio" and aria-checked');
  });

  test('10. Clinical status colors satisfy WCAG 2.1 AA contrast ratio (>= 4.5:1 against white)', () => {
    // Red-600 (#dc2626) against #ffffff has 4.54:1 contrast ratio (AA compliant)
    // Red-500 (#ef4444) has only 3.99:1, so red-600 is enforced for button text
    assert.match(odontogramaSource, /bg-red-600 text-white/,
      'Patology and eraser action buttons must use red-600 for >= 4.5:1 contrast');
    // Blue-600 (#2563eb) against #ffffff has 4.56:1 contrast ratio (AA compliant)
    assert.match(odontogramaSource, /bg-blue-600 text-white/,
      'Realized treatment buttons must use blue-600 for >= 4.5:1 contrast');
  });

});
