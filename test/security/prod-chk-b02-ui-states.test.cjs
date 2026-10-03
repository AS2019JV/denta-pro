/**
 * Gate 4 — PROD-CHK-B02: UI Error, Loading & Empty States Verification Suite
 *
 * Deterministically audits clinical UI components for resilience against empty, loading,
 * and error states during asynchronous operations:
 *  1. Patient Directory (app/(dashboard)/patients/page.tsx: Skeleton loading, Empty card, Disabled load-more)
 *  2. Patient Intake Form (components/add-patient-form.tsx: Disabled submit, Loader2 spinner, Tenant validation)
 *  3. Quick Appointment Booking (components/quick-appointment-dialog.tsx: Disabled button, Loader2 spinner, Payload check)
 *  4. Prescriptions & Clinical Records (components/patient-prescriptions.tsx & patient-medical-records.tsx:
 *     Save button spinners, History empty states, Notes empty states, Treatments empty states)
 *  5. Patient Files & Attachments (components/patient-files.tsx: Upload overlay, Files empty state, Loader2 spinners)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');

test('PROD-CHK-B02: UI Error, Loading & Empty States Verification', async (t) => {

  // --- SUITE 1: PATIENT DIRECTORY SKELETONS & EMPTY STATES ---
  await t.test('1. Patient Directory Skeletons & Empty States', async (t1) => {
    const patientsPageSrc = fs.readFileSync(path.join(ROOT_DIR, 'app/(dashboard)/patients/page.tsx'), 'utf8');

    await t1.test('1.1 Renders animated skeleton placeholder grid during initial data fetch', () => {
      assert.match(patientsPageSrc, /isLoading\s*&&\s*patients\.length\s*===\s*0/);
      assert.match(patientsPageSrc, /animate-pulse/);
    });

    await t1.test('1.2 Renders dedicated empty state card when zero patient records exist', () => {
      assert.match(patientsPageSrc, /patients\.length\s*===\s*0\s*&&\s*!isLoading/);
      assert.match(patientsPageSrc, /Comienza a construir tu base de datos/);
      assert.match(patientsPageSrc, /FileText/);
    });

    await t1.test('1.3 Disables "Cargar más pacientes" button while paginating', () => {
      assert.match(patientsPageSrc, /disabled=\{isLoading\}/);
      assert.match(patientsPageSrc, /isLoading\s*\?\s*['"]Cargando\.\.\.['"]\s*:\s*['"]Cargar más pacientes['"]/);
    });
  });

  // --- SUITE 2: PATIENT INTAKE FORM FEEDBACK & SPINNERS ---
  await t.test('2. Patient Intake Form Asynchronous Feedback', async (t2) => {
    const intakeSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/add-patient-form.tsx'), 'utf8');

    await t2.test('2.1 Submit button disables during form submission', () => {
      assert.match(intakeSrc, /<Button[^>]*type=['"]submit['"][^>]*disabled=\{isLoading\}/);
    });

    await t2.test('2.2 Renders animated Loader2 spinner while saving patient', () => {
      assert.match(intakeSrc, /isLoading\s*\?\s*<Loader2[^>]*animate-spin[^>]*\/>/);
      assert.match(intakeSrc, /isLoading\s*\?\s*['"]Guardando\.\.\.['"]\s*:\s*['"]Guardar['"]/);
    });

    await t2.test('2.3 Validates active clinic tenant before submission and surfaces error toast', () => {
      assert.match(intakeSrc, /if\s*\(!currentClinicId\)\s*\{/);
      assert.match(intakeSrc, /toast\.error\(['"]Error: No has seleccionado una clínica activa\.['"]\)/);
    });
  });

  // --- SUITE 3: QUICK APPOINTMENT DIALOG ASYNCHRONOUS FEEDBACK ---
  await t.test('3. Quick Appointment Dialog Feedback & Safety', async (t3) => {
    const aptSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/quick-appointment-dialog.tsx'), 'utf8');

    await t3.test('3.1 Submit button disables while appointment is being booked', () => {
      assert.match(aptSrc, /<Button[^>]*type=['"]submit['"][^>]*disabled=\{isSubmitting\}/);
    });

    await t3.test('3.2 Renders animated Loader2 spinner during appointment creation', () => {
      assert.match(aptSrc, /isSubmitting\s*\?\s*<Loader2[^>]*animate-spin/);
    });

    await t3.test('3.3 Validates patient and clinic prerequisites, failing closed on missing data', () => {
      assert.match(aptSrc, /if\s*\(!patientId\s*\|\|\s*!currentClinicId\)/);
      assert.match(aptSrc, /toast\.error\(['"]Datos incompletos para agendar la cita['"]\)/);
    });
  });

  // --- SUITE 4: PRESCRIPTIONS & CLINICAL RECORDS STATES ---
  await t.test('4. Prescriptions & Clinical Records UI States', async (t4) => {
    const rxSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/patient-prescriptions.tsx'), 'utf8');
    const recordsSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/patient-medical-records.tsx'), 'utf8');

    await t4.test('4.1 Prescription PDF compilation button disables and displays Loader2 spinner', () => {
      assert.match(rxSrc, /disabled=\{isSaving\}/);
      assert.match(rxSrc, /isSaving\s*\?\s*<Loader2[^>]*animate-spin[^>]*\/>/);
    });

    await t4.test('4.2 Prescription history renders Loader2 while loading and empty state when 0 records', () => {
      assert.match(rxSrc, /isLoading\s*\?\s*\(\s*<div[^>]*>\s*<Loader2/);
      assert.match(rxSrc, /history\.length\s*===\s*0\s*\?\s*\(\s*<div/);
      assert.match(rxSrc, /No hay historial de recetas/);
    });

    await t4.test('4.3 Odontogram save button disables and renders Loader2 spinner when saving', () => {
      assert.match(recordsSrc, /disabled=\{isSavingOdontogram\}/);
      assert.match(recordsSrc, /isSavingOdontogram\s*\?\s*<Loader2[^>]*animate-spin/);
    });

    await t4.test('4.4 Clinical notes tab renders informative empty state when notes array is empty', () => {
      assert.match(recordsSrc, /data\.notes\.length\s*===\s*0\s*\?\s*\(/);
      assert.match(recordsSrc, /No hay notas clínicas registradas/);
    });

    await t4.test('4.5 Clinical treatments tab renders informative empty state when treatments array is empty', () => {
      assert.match(recordsSrc, /data\.treatments\.length\s*===\s*0\s*\?\s*\(/);
      assert.match(recordsSrc, /No hay tratamientos registrados/);
    });
  });

  // --- SUITE 5: PATIENT FILES & ATTACHMENTS STATES ---
  await t.test('5. Patient Files & Attachments Loading/Empty Feedback', async (t5) => {
    const filesSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/patient-files.tsx'), 'utf8');

    await t5.test('5.1 File upload renders animated Loader2 backdrop overlay during transfer', () => {
      assert.match(filesSrc, /uploading\s*&&/);
      assert.match(filesSrc, /<Loader2[^>]*animate-spin[^>]*\/>/);
      assert.match(filesSrc, /Procesando archivos\.\.\./);
    });

    await t5.test('5.2 File list renders Loader2 spinner while loading and empty card when 0 files', () => {
      assert.match(filesSrc, /isLoadingFiles\s*\?\s*\(\s*<div[^>]*><Loader2[^>]*animate-spin/);
      assert.match(filesSrc, /files\.length\s*===\s*0\s*\?\s*\(/);
      assert.match(filesSrc, /Ningún archivo subido para este paciente todavía/);
    });
  });
});
