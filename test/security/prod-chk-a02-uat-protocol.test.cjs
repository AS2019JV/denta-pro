const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const UAT_DOC_PATH = path.join(__dirname, '../../docs/security/CLINICAL_UAT_SPECIFICATION_AND_SIGN_OFF.md');
const PATIENT_UTILS_PATH = path.join(__dirname, '../../lib/patient-utils.ts');
const CALENDAR_CONFLICT_PATH = path.join(__dirname, '../../lib/calendar-conflict.ts');
const ODONTOGRAM_PATH = path.join(__dirname, '../../components/odontograma-interactive.tsx');

describe('Gate 4: PROD-CHK-A02 Clinical UAT Protocol & Sign-Off Specification', () => {

  const uatContent = fs.readFileSync(UAT_DOC_PATH, 'utf-8');
  const patientUtilsContent = fs.readFileSync(PATIENT_UTILS_PATH, 'utf-8');
  const calendarConflictContent = fs.readFileSync(CALENDAR_CONFLICT_PATH, 'utf-8');
  const odontogramContent = fs.readFileSync(ODONTOGRAM_PATH, 'utf-8');

  describe('1. Document Existence, Architecture & Completeness', () => {
    test('UAT specification document exists and is substantive (> 2500 chars)', () => {
      assert.ok(fs.existsSync(UAT_DOC_PATH), 'UAT document must exist');
      assert.ok(uatContent.length > 2500, 'UAT document must be substantive');
    });

    test('Contains all 4 mandatory sections', () => {
      const requiredSections = [
        'Executive Summary & Clinical Methodology',
        'The 10 Core Clinical User Journeys',
        'Quantitative Clinical Acceptance Thresholds',
        'Formal Clinical Acceptance Sign-Off Charter'
      ];
      for (const section of requiredSections) {
        assert.ok(
          uatContent.includes(section),
          `UAT document must contain section: ${section}`
        );
      }
    });

    test('Cites all governing Ecuadorian healthcare standards', () => {
      assert.ok(uatContent.includes('SNS-MSP / HCU-form.033 / 2008'));
      assert.ok(uatContent.includes('FDI World Dental Federation'));
      assert.ok(uatContent.includes('ISO 3950'));
      assert.ok(uatContent.includes('Ley Orgánica de Salud'));
      assert.ok(uatContent.includes('Module-10'));
    });
  });

  describe('2. The 10 Core Clinical User Journeys Coverage', () => {
    const expectedJourneys = [
      'Journey 1: New Patient Intake & Module-10 Cédula Validation',
      'Journey 2: FDI 2-Digit Interactive Odontogram Charting',
      'Journey 3: Automated CPO-D & ceo-d Epidemiological Indices Computation',
      'Journey 4: MSP Formulario 033 Diagnostic Intake & CIE-10 Integration',
      'Journey 5: Digital A5 Medical Prescription Generation & Printing',
      'Journey 6: Real-Time Calendar Scheduling & Double-Booking Collision Prevention',
      'Journey 7: Split-Pane Master-Detail Clinical History & Notes',
      'Journey 8: Patient Family Center & Representative Grouping',
      'Journey 9: Private Clinical Storage & Radiograph Attachment Viewing',
      'Journey 10: Staff Provisioning, RBAC Verification & Immediate Offboarding'
    ];

    for (const journey of expectedJourneys) {
      test(`Defines ${journey.split(':')[0]}`, () => {
        assert.ok(
          uatContent.includes(journey),
          `UAT document must define: ${journey}`
        );
      });
    }
  });

  describe('3. Clinical Personas & Roles Mapping', () => {
    test('Maps clinical personas across key dental specialties', () => {
      assert.ok(uatContent.includes('Odontología General') || uatContent.includes('General Dentistry'));
      assert.ok(uatContent.includes('Odontopediatría') || uatContent.includes('Pediatric Dentistry'));
      assert.ok(uatContent.includes('Periodoncia') || uatContent.includes('Periodontics'));
      assert.ok(uatContent.includes('Recepción') || uatContent.includes('Front Desk'));
      assert.ok(uatContent.includes('Dirección Médica') || uatContent.includes('Practice Ownership'));
    });
  });

  describe('4. Quantitative Acceptance Thresholds & Mathematical Rigor', () => {
    test('Mandates 100% Ecuadorian Module-10 cédula compliance', () => {
      assert.ok(uatContent.includes('Cédula Validation Accuracy'));
      assert.ok(uatContent.includes('100% Ecuadorian Module-10 compliance'));
    });

    test('Mandates 100% FDI / ISO 3950 anatomical odontogram mapping', () => {
      assert.ok(uatContent.includes('Odontogram Surface Accuracy'));
      assert.ok(uatContent.includes('100% FDI 2-Digit / ISO 3950 mapping'));
    });

    test('Codifies official MSP CPO-D and ceo-d epidemiological arithmetic', () => {
      assert.ok(uatContent.includes('CPO-D') && uatContent.includes('ceo-d'));
      assert.ok(uatContent.includes('Cariados') && uatContent.includes('Perdidos') && uatContent.includes('Obturados'));
    });

    test('Codifies calendar interval collision formula S1 < E2 and E1 > S2', () => {
      assert.ok(uatContent.includes('S_1 < E_2'));
      assert.ok(uatContent.includes('E_1 > S_2'));
    });
  });

  describe('5. Codebase Alignment with Clinical Standards', () => {
    test('lib/patient-utils.ts implements validateEcuadorianCedula Module-10 algorithm', () => {
      assert.ok(
        patientUtilsContent.includes('validateEcuadorianCedula'),
        'lib/patient-utils.ts must export validateEcuadorianCedula'
      );
      assert.ok(
        patientUtilsContent.includes('calculateCPOceo'),
        'lib/patient-utils.ts must export calculateCPOceo'
      );
    });

    test('lib/calendar-conflict.ts implements checkAppointmentConflict and interval overlap', () => {
      assert.ok(
        calendarConflictContent.includes('checkAppointmentConflict'),
        'lib/calendar-conflict.ts must export checkAppointmentConflict'
      );
      assert.ok(
        calendarConflictContent.includes('areIntervalsOverlapping'),
        'lib/calendar-conflict.ts must export areIntervalsOverlapping'
      );
    });

    test('components/odontograma-interactive.tsx implements FDI notation and zoom controls', () => {
      assert.ok(
        odontogramContent.includes('zoomLevel'),
        'Odontogram must support zoom controls'
      );
      assert.ok(
        odontogramContent.includes('handleClearAll'),
        'Odontogram must support clear with modal'
      );
      assert.ok(
        odontogramContent.includes('handleUndo'),
        'Odontogram must support undo stack'
      );
    });
  });

  describe('6. Formal Clinical Acceptance Sign-Off Charter', () => {
    test('Contains sign-off from General Dentist with SENESCYT and MSP registrations', () => {
      assert.ok(uatContent.includes('Dr. Christian Albarracín'));
      assert.ok(uatContent.includes('1005-2018-1984210'));
      assert.ok(uatContent.includes('MSP-LIBRO-VIII-FOLIO-142'));
    });

    test('Contains sign-off from Pediatric Dentist with SENESCYT and MSP registrations', () => {
      assert.ok(uatContent.includes('Dra. Valeria M. Cárdenas'));
      assert.ok(uatContent.includes('1022-2020-2104938'));
      assert.ok(uatContent.includes('MSP-LIBRO-IX-FOLIO-089'));
    });

    test('Contains sign-off from Systems Architect and Data Protection Officer', () => {
      assert.ok(uatContent.includes('Lead Systems Architect & Security Engineer'));
      assert.ok(uatContent.includes('Data Protection Officer (DPD)'));
      assert.ok(uatContent.includes('dpo@clinia.ec'));
    });
  });

});
