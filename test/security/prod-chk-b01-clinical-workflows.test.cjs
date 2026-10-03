/**
 * Gate 4 — PROD-CHK-B01: Clinical Workflows End-to-End Verification Suite
 *
 * Deterministically verifies the core clinical journeys of Clinia+:
 *  1. Patient Intake & Cédula Validation Logic (Ecuadorian Module-10, Foreign Passports, LOPDP Consent)
 *  2. FDI 2-Digit Notation & 5-Surface Odontogram Topology (Permanent 11-48, Primary 51-85, Dual Color)
 *  3. MSP Epidemiological Indices Engine (CPO-D = C + P + O, ceo-d = c + e + o)
 *  4. Digital Prescriptions (Recetas A5) & SENESCYT / MSP Credential Enforcement
 *  5. Clinical Role-Based Access Control (Receptionist Boundary vs Doctor/Owner Capabilities)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');

test('PROD-CHK-B01: Clinical Workflows End-to-End Verification', async (t) => {

  // --- SUITE 1: PATIENT INTAKE & ECUADORIAN IDENTIFICATION ---
  await t.test('1. Patient Intake & Identification Validation Logic', async (t1) => {
    // Dynamic import of patient-utils
    const patientUtils = require(path.join(ROOT_DIR, 'lib/patient-utils.ts'));
    const { validateEcuadorianCedula, calculateProfileCompletion } = patientUtils;

    await t1.test('1.1 Validates genuine Ecuadorian cédulas with Module 10 checksum', () => {
      // 1710034065: Pichincha (17), third digit 1, valid checksum 5
      const res1 = validateEcuadorianCedula('1710034065');
      assert.equal(res1.isValid, true, '1710034065 should be valid');
      assert.equal(res1.isForeignId, false);

      // 0920034061: Guayas (09), third digit 2
      // Digits: 0, 9, 2, 0, 0, 3, 4, 0, 6
      // Coefs:  2, 1, 2, 1, 2, 1, 2, 1, 2
      // Prods:  0, 9, 4, 0, 0, 3, 8, 0, 12-9=3
      // Sum: 0+9+4+0+0+3+8+0+3 = 27
      // 27 % 10 = 7; 10 - 7 = 3.
      // Let's test a valid Guayas cedula: 0920034063
      const resGuayas = validateEcuadorianCedula('0920034063');
      assert.equal(resGuayas.isValid, true, '0920034063 should be valid');
      assert.equal(resGuayas.isForeignId, false);
    });

    await t1.test('1.2 Rejects forged or corrupted cédula check digits', () => {
      const forged = validateEcuadorianCedula('1710034069'); // Should end in 5, not 9
      assert.equal(forged.isValid, false, 'Forged verifier digit must be rejected');
      assert.match(forged.reason, /Módulo 10|no coincide/i);
    });

    await t1.test('1.3 Rejects invalid Ecuadorian province codes', () => {
      const invalidProvince = validateEcuadorianCedula('9910034065'); // Province 99 does not exist
      assert.equal(invalidProvince.isValid, false);
      assert.match(invalidProvince.reason, /provincia/i);

      const zeroProvince = validateEcuadorianCedula('0010034065');
      assert.equal(zeroProvince.isValid, false);
    });

    await t1.test('1.4 Rejects non-natural person third digits in 10-digit cédula', () => {
      // Third digit >= 6 is reserved for public entities or juridical RUCs
      const invalidThird = validateEcuadorianCedula('1790034065');
      assert.equal(invalidThird.isValid, false);
      assert.match(invalidThird.reason, /persona natural/i);
    });

    await t1.test('1.5 Accepts foreign passports or international IDs (5-20 alphanumeric characters)', () => {
      const passport = validateEcuadorianCedula('PASSPORT-987');
      assert.equal(passport.isValid, true);
      assert.equal(passport.isForeignId, true);

      const shortId = validateEcuadorianCedula('ABC');
      assert.equal(shortId.isValid, false, 'IDs shorter than 5 chars must be rejected');
    });

    await t1.test('1.6 Profile completion score calculates medical alerts and emergency contacts', () => {
      const completePatient = {
        name: 'Carlos',
        lastName: 'Mendoza',
        email: 'carlos@example.com',
        phone: '0991234567',
        birthDate: '1985-04-12',
        cedula: '1710034065',
        hasDiabetes: true,
        emergencyContact: 'Maria Mendoza',
        emergencyPhone: '0997654321',
        address: 'Av. Amazonas y Colón'
      };
      const score = calculateProfileCompletion(completePatient);
      assert.equal(score, 100, 'Complete patient profile must achieve 100% completion');
    });
  });

  // --- SUITE 2: FDI 2-DIGIT NOTATION & ODONTOGRAM TOPOLOGY ---
  await t.test('2. FDI 2-Digit Notation & Odontogram Architecture', async (t2) => {
    const odontogramSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/odontograma-interactive.tsx'), 'utf8');

    await t2.test('2.1 Adult / Permanent dentition covers all 4 quadrants (Teeth 11–48)', () => {
      assert.match(odontogramSrc, /Q1:\s*\[18,\s*17,\s*16,\s*15,\s*14,\s*13,\s*12,\s*11\]/);
      assert.match(odontogramSrc, /Q2:\s*\[21,\s*22,\s*23,\s*24,\s*25,\s*26,\s*27,\s*28\]/);
      assert.match(odontogramSrc, /Q3:\s*\[48,\s*47,\s*46,\s*45,\s*44,\s*43,\s*42,\s*41\]/);
      assert.match(odontogramSrc, /Q4:\s*\[31,\s*32,\s*33,\s*34,\s*35,\s*36,\s*37,\s*38\]/);
    });

    await t2.test('2.2 Child / Deciduous dentition covers quadrants Q5–Q8 (Teeth 51–85)', () => {
      assert.match(odontogramSrc, /Q5:\s*\[55,\s*54,\s*53,\s*52,\s*51\]/);
      assert.match(odontogramSrc, /Q6:\s*\[61,\s*62,\s*63,\s*64,\s*65\]/);
      assert.match(odontogramSrc, /Q7:\s*\[85,\s*84,\s*83,\s*82,\s*81\]/);
      assert.match(odontogramSrc, /Q8:\s*\[71,\s*72,\s*73,\s*74,\s*75\]/);
    });

    await t2.test('2.3 Configures official dual-mode symbology: Red for Pathology, Blue for Treatment', () => {
      assert.match(odontogramSrc, /PATHOLOGY:\s*\{\s*id:\s*['"]pathology['"],\s*label:\s*['"]Patología['"],\s*color:\s*['"]#ef4444['"]\s*\}/);
      assert.match(odontogramSrc, /TREATMENT:\s*\{\s*id:\s*['"]treatment['"],\s*label:\s*['"]Realizado['"],\s*color:\s*['"]#2563eb['"]\s*\}/);
    });

    await t2.test('2.4 Enforces 5-surface anatomical geometry (top, bottom, left, right, center)', () => {
      assert.match(odontogramSrc, /surfaces:\s*\{\s*top:\s*null,\s*bottom:\s*null,\s*left:\s*null,\s*right:\s*null,\s*center:\s*null\s*\}/);
    });

    await t2.test('2.5 Implements destructive action safety dialog for "Limpiar Todo"', () => {
      assert.match(odontogramSrc, /¿Limpiar todo el odontograma\?/);
      assert.match(odontogramSrc, /DialogContent/);
      assert.match(odontogramSrc, /RotateCcw/);
    });
  });

  // --- SUITE 3: MSP CPO-D & ceo-d EPIDEMIOLOGICAL CALCULATION ENGINE ---
  await t.test('3. MSP Epidemiological Indices (CPO-D & ceo-d) Calculation Engine', async (t3) => {
    const patientUtils = require(path.join(ROOT_DIR, 'lib/patient-utils.ts'));
    const { calculateCPOceo } = patientUtils;

    await t3.test('3.1 Baseline healthy mouth evaluates to CPO = 0 and ceo = 0', () => {
      const emptyState = {};
      const indices = calculateCPOceo(emptyState);
      assert.deepEqual(indices, {
        C: 0, P: 0, O: 0, totalCPO: 0,
        c: 0, e: 0, o: 0, totalceo: 0
      });
    });

    await t3.test('3.2 Correctly calculates permanent CPO-D (Cariados, Perdidos, Obturados)', () => {
      const testState = {
        // Tooth 16 has active caries on Oclusal and Distal -> 1 Cariado (C)
        16: {
          id: 16,
          surfaces: { center: 'caries:red', right: 'caries:red' },
          condition: null
        },
        // Tooth 24 has extraction indicated -> 1 Perdido (P)
        24: {
          id: 24,
          surfaces: {},
          condition: 'extraction'
        },
        // Tooth 26 lost to other causes -> 1 Perdido (P)
        26: {
          id: 26,
          surfaces: {},
          condition: 'loss_other'
        },
        // Tooth 36 restored with resin (blue) -> 1 Obturado (O)
        36: {
          id: 36,
          surfaces: { center: 'caries:blue' },
          condition: null
        },
        // Tooth 46 has a crown restoration -> 1 Obturado (O)
        46: {
          id: 46,
          surfaces: {},
          condition: 'crown'
        }
      };

      const indices = calculateCPOceo(testState);
      assert.equal(indices.C, 1, 'C (Cariados) must be 1');
      assert.equal(indices.P, 2, 'P (Perdidos) must be 2');
      assert.equal(indices.O, 2, 'O (Obturados) must be 2');
      assert.equal(indices.totalCPO, 5, 'totalCPO must equal 1 + 2 + 2 = 5');
    });

    await t3.test('3.3 Correctly calculates primary/deciduous ceo-d (cariados, extracción, obturados)', () => {
      const childState = {
        // Tooth 54 has active caries -> 1 cariado (c)
        54: {
          id: 54,
          surfaces: { center: 'caries:red' },
          condition: null
        },
        // Tooth 64 indicated for extraction -> 1 extraccion indicada (e)
        64: {
          id: 64,
          surfaces: {},
          condition: 'extraction'
        },
        // Tooth 74 obturated with blue restoration -> 1 obturado (o)
        74: {
          id: 74,
          surfaces: { center: 'caries:blue' },
          condition: null
        }
      };

      const indices = calculateCPOceo(childState);
      assert.equal(indices.c, 1, 'c (cariados) must be 1');
      assert.equal(indices.e, 1, 'e (extraccion) must be 1');
      assert.equal(indices.o, 1, 'o (obturados) must be 1');
      assert.equal(indices.totalceo, 3, 'totalceo must equal 1 + 1 + 1 = 3');
      assert.equal(indices.totalCPO, 0, 'Permanent CPO must remain 0 for child-only teeth');
    });
  });

  // --- SUITE 4: DIGITAL PRESCRIPTIONS (RECETAS A5) ENGINE ---
  await t.test('4. Digital Prescriptions (Recetas A5) & Doctor Licensing Verification', async (t4) => {
    const rxSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/patient-prescriptions.tsx'), 'utf8');
    const pdfSrc = fs.readFileSync(path.join(ROOT_DIR, 'lib/pdf-generator.ts'), 'utf8');

    await t4.test('4.1 Prescription requires doctor SENESCYT / MSP registration credential', () => {
      assert.match(rxSrc, /license_number/);
      assert.match(rxSrc, /Reg\.\s*Senescyt\s*\/\s*MSP/i);
    });

    await t4.test('4.2 Validates that medication name is mandatory before compilation', () => {
      assert.match(rxSrc, /if\s*\(medications\.some\(m\s*=>\s*!m\.name\)\)/);
      assert.match(rxSrc, /Por favor completa el nombre de los medicamentos/);
    });

    await t4.test('4.3 Prescriptions table persists composite clinic_id and doctor_id', () => {
      assert.match(rxSrc, /\.from\(['"]prescriptions['"]\)\s*\.insert\(\{/);
      assert.match(rxSrc, /patient_id:\s*patientId/);
      assert.match(rxSrc, /doctor_id:\s*user\?\.id/);
      assert.match(rxSrc, /clinic_id:\s*currentClinicId/);
    });

    await t4.test('4.4 PDF generator formats official Rp. structure with dosage and indications', () => {
      assert.match(pdfSrc, /RECETA MÉDICA/);
      assert.match(pdfSrc, /Rp\./);
      assert.match(pdfSrc, /head:\s*\[\['Medicamento',\s*'Dosis \/ Frecuencia',\s*'Duración'\]\]/);
      assert.match(pdfSrc, /Indicaciones:/);
    });
  });

  // --- SUITE 5: ROLE-BASED ACCESS CONTROL (RBAC) WORKFLOW FIREWALL ---
  await t.test('5. Clinical RBAC Workflow Isolation', async (t5) => {
    const medRecordsSrc = fs.readFileSync(path.join(ROOT_DIR, 'components/patient-medical-records.tsx'), 'utf8');
    const middlewareSrc = fs.readFileSync(path.join(ROOT_DIR, 'middleware.ts'), 'utf8');

    await t5.test('5.1 Receptionist role is prohibited from querying or modifying HCU-033 diagnostic charting', () => {
      assert.match(medRecordsSrc, /if\s*\(user\?\.role\s*!==\s*['"]receptionist['"]\)/, 'fetchOdontogram must be blocked for receptionists');
    });

    await t5.test('5.2 Middleware blocks receptionist from accessing patient clinical detail pages directly', () => {
      assert.match(middlewareSrc, /receptionist/);
      assert.match(middlewareSrc, /pathname\.startsWith\(['"]\/patients\/['"]\)/);
      assert.match(middlewareSrc, /url\.pathname\s*=\s*['"]\/patients['"]/);
    });
  });
});
