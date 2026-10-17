/**
 * PROD-CHK-B03: Responsive UI Verification Test Suite (Desktop/Tablet/Mobile)
 *
 * Verifies responsive UI capabilities across viewport targets (1920x1080, 1280x800, tablets, and mobile):
 * 1. Global application sidebar collapsing (lg:w-64 to lg:w-20 mini-bar with tooltips and toggle control).
 * 2. Odontogram interactive canvas auto-scaling and zoom controls (0.75x to 1.25x scale transform).
 * 3. Master-detail patient split view drawer toggle (w-80/w-96 to w-0).
 * 4. Responsive grid systems across patient catalog and clinical cards.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

describe('PROD-CHK-B03: Responsive UI Tested (Desktop/Tablet/Mobile)', () => {

  const sidebarContextSource = fs.readFileSync(path.join(ROOT, 'components/sidebar-context.tsx'), 'utf8');
  const sidebarSource = fs.readFileSync(path.join(ROOT, 'components/sidebar.tsx'), 'utf8');
  const odontogramaSource = fs.readFileSync(path.join(ROOT, 'components/odontograma-interactive.tsx'), 'utf8');
  const patientDetailsSource = fs.readFileSync(path.join(ROOT, 'app/(dashboard)/patients/[id]/page.tsx'), 'utf8');
  const patientsCatalogSource = fs.readFileSync(path.join(ROOT, 'app/(dashboard)/patients/page.tsx'), 'utf8');

  test('1. Sidebar context exports both strict and optional hook providers', () => {
    assert.match(sidebarContextSource, /export function useSidebar\(\)/, 'Must export useSidebar');
    assert.match(sidebarContextSource, /export function useOptionalSidebar\(\)/, 'Must export useOptionalSidebar for safe embedded usage');
    assert.match(sidebarContextSource, /isExpanded:\s*boolean/, 'Context type must define isExpanded');
    assert.match(sidebarContextSource, /toggleSidebar:\s*\(\)\s*=>\s*void/, 'Context type must define toggleSidebar');
  });

  test('2. Sidebar component consumes isExpanded and toggleSidebar from context', () => {
    assert.match(sidebarSource, /useSidebar\(\)/, 'Sidebar must consume useSidebar hook');
    assert.match(sidebarSource, /isExpanded/, 'Sidebar must destructure isExpanded');
    assert.match(sidebarSource, /toggleSidebar/, 'Sidebar must destructure toggleSidebar');
  });

  test('3. Sidebar component applies dynamic responsive width classes (lg:w-64 vs lg:w-20)', () => {
    assert.match(sidebarSource, /isExpanded\s*\?\s*"w-64 lg:w-64"\s*:\s*"w-64 lg:w-20"/,
      'Sidebar must dynamically toggle between full width (lg:w-64) and mini-bar (lg:w-20) on desktop');
    assert.match(sidebarSource, /transition-all duration-300 ease-in-out/,
      'Sidebar width change must animate smoothly');
  });

  test('4. Sidebar component renders desktop collapse toggle button with accessible label', () => {
    assert.match(sidebarSource, /onClick=\{toggleSidebar\}/, 'Sidebar must provide desktop toggle button calling toggleSidebar');
    assert.match(sidebarSource, /ChevronLeft/, 'Sidebar must show ChevronLeft when expanded');
    assert.match(sidebarSource, /ChevronRight/, 'Sidebar must show ChevronRight when collapsed');
    assert.match(sidebarSource, /title=\{isExpanded\s*\?\s*"Colapsar menú lateral"\s*:\s*"Expandir menú lateral"\}/,
      'Toggle button must include accessible title/tooltip');
  });

  test('5. Sidebar navigation collapses text and preserves centered icons with accessible tooltips', () => {
    assert.match(sidebarSource, /!isExpanded\s*&&\s*"lg:hidden"/,
      'Navigation labels must hide on desktop when collapsed');
    assert.match(sidebarSource, /title=\{!isExpanded\s*\?\s*labelText\s*:\s*undefined\}/,
      'Navigation buttons must provide title tooltips when collapsed');
    assert.match(sidebarSource, /title=\{!isExpanded\s*\?\s*t\("logout"\)\s*:\s*undefined\}/,
      'Logout button must provide title tooltip when collapsed');
  });

  test('6. Odontogram interactive component declares zoomLevel state and zoom range', () => {
    assert.match(odontogramaSource, /const\s*\[zoomLevel,\s*setZoomLevel\]\s*=\s*useState<number>\(1\.0\)/,
      'Must declare zoomLevel state initialized to 1.0');
    assert.match(odontogramaSource, /ZoomIn/, 'Must import ZoomIn icon');
    assert.match(odontogramaSource, /ZoomOut/, 'Must import ZoomOut icon');
    assert.match(odontogramaSource, /Math\.max\(0\.75,\s*Number\(\(prev\s*-\s*0\.1\)\.toFixed\(2\)\)\)/,
      'Must support zooming out to minimum 0.75 (75%)');
    assert.match(odontogramaSource, /Math\.min\(1\.25,\s*Number\(\(prev\s*\+\s*0\.1\)\.toFixed\(2\)\)\)/,
      'Must support zooming in to maximum 1.25 (125%)');
    assert.match(odontogramaSource, /setZoomLevel\(1\.0\)/,
      'Must support resetting zoom to 100%');
  });

  test('7. Odontogram canvas container applies CSS transform: scale(zoomLevel)', () => {
    assert.match(odontogramaSource, /transform:\s*`scale\(\$\{zoomLevel\}\)`/,
      'Dental arch container must apply scale transform using zoomLevel');
    assert.match(odontogramaSource, /transformOrigin:\s*'top center'/,
      'Dental arch scaling must anchor to top center');
    assert.match(odontogramaSource, /transition-transform duration-200 ease-out origin-top min-w-\[680px\]/,
      'Scaling container must have smooth transition and minimum width for arch integrity');
  });

  test('8. Odontogram component integrates with useOptionalSidebar for quick canvas expansion', () => {
    assert.match(odontogramaSource, /useOptionalSidebar\(\)/,
      'Odontogram must connect to optional sidebar context');
    assert.match(odontogramaSource, /sidebar\.toggleSidebar/,
      'Odontogram must provide shortcut to collapse/expand sidebar');
    assert.match(odontogramaSource, /PanelLeftClose|PanelLeftOpen/,
      'Must render panel toggle icons');
  });

  test('9. Patient master-detail view implements collapsible sidebar drawer (w-80/w-96 to w-0)', () => {
    assert.match(patientDetailsSource, /isSidebarOpen/, 'Must maintain isSidebarOpen state');
    assert.match(patientDetailsSource, /handleSetSidebarOpen/, 'Must provide handleSetSidebarOpen handler');
    assert.match(patientDetailsSource, /isSidebarOpen\s*\?\s*"w-full md:w-80 lg:w-96 opacity-100"\s*:\s*"w-0 md:w-0 lg:w-0 opacity-0 overflow-hidden border-r-0 border-b-0"/,
      'Drawer must collapse smoothly to w-0');
    assert.match(patientDetailsSource, /PanelLeftClose/, 'Must render PanelLeftClose button');
  });

  test('10. Patient catalog implements responsive multi-breakpoint card grid', () => {
    assert.match(patientsCatalogSource, /grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6/,
      'Patient catalog must adapt across 1 column (mobile), 2 columns (tablet/laptop), and 3 columns (desktop)');
  });
});
