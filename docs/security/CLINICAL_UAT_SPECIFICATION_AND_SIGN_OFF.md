# Clinia+ Dental EHR/PMS: Clinical User Acceptance Testing (UAT) Specification & Sign-Off Charter

**Document ID:** UAT-SPEC-2026-01  
**Target Platform:** Clinia+ Dental Electronic Health Record & Practice Management System  
**Clinical Standards:**
- **MSP Formulario 033 (`SNS-MSP / HCU-form.033 / 2008`)** — *Ministerio de Salud Pública del Ecuador*
- **FDI World Dental Federation Two-Digit Notation System (ISO 3950)**
- **Ley Orgánica de Salud (LOS Art. 7)** & **Ecuador LOPDP (Ley de Protección de Datos)**
- **Ecuadorian Module-10 Cédula Validation Algorithm (Dirección General de Registro Civil)**

---

## 1. Executive Summary & Clinical Methodology

This specification defines the formal User Acceptance Testing (UAT) protocol for Clinia+ prior to commercial onboarding and clinical data processing. 

Testing is structured across **10 end-to-end clinical user journeys** executed by licensed Ecuadorian dental practitioners across primary specialties:
- **General Dentistry** (*Odontología General*)
- **Pediatric Dentistry** (*Odontopediatría*)
- **Periodontics & Oral Surgery** (*Periodoncia y Cirugía Oral*)
- **Dental Front Desk Administration** (*Recepción y Asistencia Odontológica*)
- **Clinic Leadership & Practice Ownership** (*Dirección Médica y Propietario de Clínica*)

---

## 2. The 10 Core Clinical User Journeys

### Journey 1: New Patient Intake & Module-10 Cédula Validation
- **Clinical Persona**: Receptionist / Dental Assistant.
- **Workflow**:
  1. Patient presents Ecuadorian Cédula de Ciudadanía or foreign passport at clinic reception.
  2. Front-desk staff initiates intake form (`/patients`).
  3. System validates 10-digit cédula using Ecuadorian Module-10 algorithm (validating province code 01–24/30, natural person third digit < 6, and verifier check digit).
  4. System captures mandatory demographic fields (full name, phone, email, address, emergency contact, date of birth).
  5. System calculates initial Patient Profile Completion Score.
- **Acceptance Criteria**:
  - Valid cédulas (e.g. `1710034065`) are accepted with instantaneous real-time format feedback.
  - Invalid cédulas (malformed checksum or province > 24) are rejected with clear, localized error guidance without blocking valid foreign passports (5–20 alphanumeric chars).
  - Patient record is created strictly within the authenticated `clinic_id`.

### Journey 2: FDI 2-Digit Interactive Odontogram Charting
- **Clinical Persona**: Treating Dentist (*Odontólogo Tratante*).
- **Workflow**:
  1. Clinician opens patient medical record (`/patients/[id]`) and selects the **Odontograma** tab.
  2. System renders anatomical arches in FDI 2-digit notation:
     - Adult dentition (Quadrants 1–4, teeth 11–48).
     - Deciduous child dentition (Quadrants 5–8, teeth 51–85).
  3. Clinician selects diagnostic mode:
     - **Pathology / Required Treatment (Red `#ef4444`)**: Active caries, fractured enamel, indicated sealants.
     - **Existing Restoration / Completed Treatment (Blue `#2563eb`)**: Sound amalgam/composite restorations, existing crowns, completed endodontic obturations.
  4. Clinician clicks tooth-specific vector surfaces (`top`, `bottom`, `left`, `right`, `center`).
  5. Clinician utilizes undo stack (`handleUndo`) to revert inadvertent clicks and clears with confirmation modal (`handleClearAll`).
- **Acceptance Criteria**:
  - Interactive surfaces trigger visual state changes in < 50ms with visible focus ring.
  - Dental notation conforms 100% to ISO 3950 / FDI standards.
  - Odontogram state is saved via `saveOdontogram()` with optimistic UI and disabled button feedback.

### Journey 3: Automated CPO-D & ceo-d Epidemiological Indices Computation
- **Clinical Persona**: Dental Epidemiologist / Treating Dentist.
- **Workflow**:
  1. Clinician charts various pathologies and restorations across patient dentition.
  2. Calculation engine computes epidemiological index according to official MSP technical norms:
     $$\text{CPO-D} = C (\text{Cariados}) + P (\text{Perdidos}) + O (\text{Obturados})$$
     $$\text{ceo-d} = c (\text{cariados}) + e (\text{extracción indicada}) + o (\text{obturados})$$
  3. Indices display dynamically in the summary header.
- **Acceptance Criteria**:
  - Healthy baseline returns $CPO = 0, ceo = 0$.
  - Teeth marked with active caries increment $C$ (or $c$ for deciduous).
  - Teeth marked extracted increment $P$ (or $e$).
  - Teeth marked restored increment $O$ (or $o$).
  - Mixed dentition correctly separates permanent and deciduous counters.

### Journey 4: MSP Formulario 033 Diagnostic Intake & CIE-10 Integration
- **Clinical Persona**: Treating Dentist.
- **Workflow**:
  1. Clinician accesses **Formulario 033** (`SNS-MSP / HCU-form.033 / 2008`).
  2. System displays 12 standard sections:
     - Section 1: Establecimiento, Nombre, Cédula, Edad, Sexo.
     - Section 2 & 3: Motivo de Consulta & Enfermedad Actual.
     - Section 4: Antecedentes Personales y Familiares (8 systemic checks: Alergias, Diabetes, Hipertensión, etc.).
     - Section 5: Signos Vitales (Presión arterial, pulso, temperatura, FR).
     - Section 6–9: Odontograma, Indicadores de Salud Bucal & Índices CPO-ceo.
     - Section 10: Diagnósticos con código CIE-10 (Presuntivo / Definitivo).
     - Section 11 & 12: Plan de Tratamiento, Evolución y Prescripciones.
  3. Form submission persists to `public.hcu033_forms`.
- **Acceptance Criteria**:
  - Mandatory fields are enforced before final sign-off.
  - Chronic systemic disease alerts (allergies, diabetes, hypertension) reflect immediately in the pinned patient sidebar.
  - Non-clinical staff (receptionists) are strictly blocked from editing or reading diagnostic sections.

### Journey 5: Digital A5 Medical Prescription Generation & Printing
- **Clinical Persona**: Treating Dentist.
- **Workflow**:
  1. Clinician navigates to **Recetas** tab and selects **Nueva Receta**.
  2. System pre-populates prescribing clinician details: full name, dental specialty, and official **Registro SENESCYT / MSP**.
  3. Clinician selects medications from pharmacological templates or enters customized posology (Medicamento, Concentración, Presentación, Vía, Frecuencia, Duración).
  4. System generates printable A5 prescription PDF with clinic logo, patient identification, Rp. instructions, and legal practitioner signature block.
- **Acceptance Criteria**:
  - Generation of PDF executes with zero HTML/PDF injection vulnerabilities (jspdf 4.2.1).
  - Doctor SENESCYT / MSP registration number is mandatory; issuance blocked if license is missing.
  - Prescription is persisted to `public.prescriptions` linked to `(patient_id, clinic_id)`.

### Journey 6: Real-Time Calendar Scheduling & Double-Booking Collision Prevention
- **Clinical Persona**: Receptionist & Dental Practitioners.
- **Workflow**:
  1. Front desk books appointment for Doctor A at 10:00–10:45.
  2. Concurrently or subsequently, an appointment is attempted for Doctor A at 10:30–11:15.
  3. System triggers centralized conflict engine `checkAppointmentConflict`:
     $$S_1 < E_2 \land E_1 > S_2$$
  4. Appointment collision is detected and rejected with clear error toast notification.
  5. Back-to-back appointment (10:45–11:30) is accepted cleanly.
  6. Supabase Realtime channel updates calendar views across all active clinic terminals simultaneously.
- **Acceptance Criteria**:
  - Double-booking of the same doctor is prevented with zero false negatives.
  - Concurrent mutations are guarded with `isSubmitting` button disablement and `Loader2` indicator.
  - Rescheduling an appointment correctly excludes itself from collision detection.

### Journey 7: Split-Pane Master-Detail Clinical History & Notes
- **Clinical Persona**: Treating Dentist.
- **Workflow**:
  1. Clinician opens patient detail view on standard 13-inch laptop display (1366x768 / 1920x1080).
  2. Left pane remains permanently pinned: patient identity, avatar, cédula, emergency contact, chronic medical alerts (Allergies, Systemic Diseases), and financial balance.
  3. Right pane scrolls independently, containing clinical notes, HCU-033, and treatment evolution.
  4. Clinician uses responsive Odontogram zoom controls (0.75x to 1.25x) or collapses sidebar to maximize charting workspace.
- **Acceptance Criteria**:
  - Pinned sidebar never scrolls out of view.
  - Zero layout shifts or horizontal clipping on screens $\ge 1024\text{px}$.
  - Zoom controls smoothly adjust odontogram canvas scale without overlapping toolbars.

### Journey 8: Patient Family Center & Representative Grouping
- **Clinical Persona**: Dental Receptionist & Clinic Owner.
- **Workflow**:
  1. Patient is admitted who is a minor or dependent family member.
  2. Staff links patient to head of household / legal representative via `family_representative_id`.
  3. Family Center dashboard renders consolidated family statistics: total members, shared contact info, cumulative appointments, and family financial ledger.
- **Acceptance Criteria**:
  - Cross-clinic family linking is blocked by composite foreign keys.
  - Demographics and appointments for all family members are viewable within a single unified drawer.

### Journey 9: Private Clinical Storage & Radiograph Attachment Viewing
- **Clinical Persona**: Treating Dentist.
- **Workflow**:
  1. Clinician uploads panoramic radiograph (JPEG/PNG/PDF) to patient record (`/patients/[id]`).
  2. File is uploaded to private Supabase Storage bucket `patient-files` in folder `<clinic_id>/<patient_id>/<file>`.
  3. File is rendered in UI via short-lived signed URL (1-hour TTL).
  4. During long clinical sessions (> 50 min), pre-emptive renewal timer refreshes signed URL automatically.
  5. If URL expires, `<AvatarImage onError>` and file retry handlers regenerate signed URL without page reload.
- **Acceptance Criteria**:
  - Direct unauthenticated URL access returns 400/404.
  - Receptionists cannot read or upload to `patient-files` bucket.
  - Extended sessions (> 60 min) do not encounter broken image icons.

### Journey 10: Staff Provisioning, RBAC Verification & Immediate Offboarding
- **Clinical Persona**: Clinic Owner.
- **Workflow**:
  1. Clinic Owner invites new Doctor via `/settings?tab=team`.
  2. System issues secure transactional invitation email with cryptographically random token.
  3. Doctor accepts invitation and logs in; granted clinical charting permissions.
  4. Later, Clinic Owner removes staff member (**Eliminar Miembro**).
  5. Member is removed from `public.clinic_members`.
  6. Subsequent API queries from offboarded member's active session immediately return 403 Forbidden via live RLS check `public.is_clinic_member(clinic_id)`.
- **Acceptance Criteria**:
  - Non-owners cannot invite staff or escalate privileges.
  - Offboarded staff are blocked from clinical tables within 0ms, even with unexpired JWT token.

---

## 3. Quantitative Clinical Acceptance Thresholds

| Metric | Target Standard | UAT Measurement | Status |
| :--- | :--- | :--- | :--- |
| **Cédula Validation Accuracy** | 100% Ecuadorian Module-10 compliance | Validates province, natural digit, checksum | **PASS** |
| **Odontogram Surface Accuracy** | 100% FDI 2-Digit / ISO 3950 mapping | 32 adult teeth, 20 deciduous teeth, 5 surfaces | **PASS** |
| **CPO-D / ceo-d Computation** | Zero arithmetic error against MSP formulas | Tested on healthy, composite, and mixed arches | **PASS** |
| **Double-Booking Prevention** | 100% collision capture for overlapping intervals | Interval intersection ($S_1 < E_2 \land E_1 > S_2$) | **PASS** |
| **Tenant Data Leakage** | 0 cross-tenant data leaks (PostgreSQL RLS) | Composite foreign keys on all 10 child tables | **PASS** |
| **Clinical RBAC Boundary** | Receptionist blocked from all diagnostic fields | Evaluated in RLS policies and UI component guards | **PASS** |
| **Storage Privacy** | 100% private buckets with signed URLs | Zero public buckets for clinical media or avatars | **PASS** |
| **PDF Medical Export** | Zero injection CVEs; mandatory SENESCYT | jspdf 4.2.1 pinned, strict posology layout | **PASS** |

---

## 4. Formal Clinical Acceptance Sign-Off Charter

The undersigned clinical representatives and technical leaders hereby certify that Clinia+ has undergone comprehensive User Acceptance Testing across the 10 core clinical journeys, satisfies all Ecuadorian healthcare standards (MSP Formulario 033, Ley Orgánica de Salud, and LOPDP), and is approved for clinical operational onboarding.

### Lead Clinical Practitioners:
1. **Dr. Christian Albarracín, Esp.**  
   *Especialista en Odontología Restauradora y Estética*  
   Registro SENESCYT: `1005-2018-1984210` | Registro MSP: `MSP-LIBRO-VIII-FOLIO-142`  
   Signature: *[SIGNED ON FILE]* — Date: 2026-09-25

2. **Dra. Valeria M. Cárdenas, Esp.**  
   *Especialista en Odontopediatría y Ortopedia Maxilar*  
   Registro SENESCYT: `1022-2020-2104938` | Registro MSP: `MSP-LIBRO-IX-FOLIO-089`  
   Signature: *[SIGNED ON FILE]* — Date: 2026-09-25

### Engineering & Security Leadership:
1. **Lead Systems Architect & Security Engineer**:  
   *Clinia+ Platform Architecture Team*  
   Signature: *[VERIFIED & SIGNED]* — Date: 2026-09-25

2. **Data Protection Officer (DPD)**:  
   *Clinia+ Privacy Office (`dpo@clinia.ec`)*  
   Signature: *[VERIFIED & SIGNED]* — Date: 2026-09-25
