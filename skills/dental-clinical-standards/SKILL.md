---
name: dental-clinical-standards
description: >
  Comprehensive guide and operational standard for engineering production-grade
  Dental Practice Management & Electronic Health Record (EHR/PMS) SaaS platforms.
  Use when designing, auditing, or modifying dental charting (Odontograma HCU-033),
  FDI 2-digit notation, CPO-ceo indices, LOPDP/HIPAA health data compliance,
  role-based security (RBAC), and master-detail clinical UI/UX.
---

# Dental Clinical SaaS Engineering Standards

## Overview
This skill provides comprehensive clinical and architectural patterns for developing, auditing, and maintaining high-performance Dental Practice Management & Electronic Health Record (EHR) systems. It embeds official Ministry of Public Health (MSP) regulations, statutory health data privacy (LOPDP Ecuador / HIPAA), FDI vector odontogram modeling, and multi-tenant SaaS security.

## Dependencies
- `clinia-brand-guidelines`: For clinical design system tokens, contrast rules, and Apple Human Interface guidelines.
- `agy-customizations`: For Antigravity environment customization and agent execution rules.

## Quick Start
When auditing or implementing any clinical module in a Dental SaaS:
1. **Scope Tenant Context**: Enforce `clinic_id` on every query, mutation, and storage bucket operation.
2. **Verify Role Permission (RBAC)**:
   - Receptionist = Intake, booking, billing check-in (strictly restricted from editing doctor licenses/diagnoses).
   - Doctor = Full clinical charting, HCU-033, Odontograma, Prescriptions.
   - Admin/Owner = Full clinical and practice configuration access.
3. **Ensure Statutory Data Consent (LOPDP)**: Verify informed consent capture on patient creation and clinical evolution notes.
4. **Validate Dental Notation**: Always adhere to the 2-digit FDI system (Adult 11–48, Deciduous 51–85) and standard 5-surface anatomy.

---

## Clinical Architecture & Core Workflows

### 1. Ecuadorian MSP Formulario 033 (`SNS-MSP / HCU-form.033 / 2008`)
Any official dental health record must adhere to the standard 12-section architecture:
- **Section 1: Demographics & Identity**: Mandatory fields include `nacionalidad` (default: "Ecuatoriana"), cédula/ID, gender, age, address, and occupation.
- **Section 2 & 3: Motivo de Consulta & Enfermedad Actual**: Free-text clinical narrative.
- **Section 4: Antecedentes Personales y Familiares**: 8 standardized systemic checks (Alergias, Hemorragias, Diabetes, Hipertensión, Cardiopatías, etc.).
- **Section 5: Signos Vitales**: Presión arterial, pulso, temperatura, frecuencia respiratoria.
- **Section 6: Odontograma**: FDI dual-arch charting (Adult 32 teeth, Deciduous 20 teeth).
- **Section 7: Indicadores de Salud Bucal**: Placa, cálculo, gingivitis, enfermedad periodontal, maloclusión, fluorosis.
- **Section 8: Índices CPO-ceo**: Automated index calculation:
  $$\text{CPO} = C (\text{Cariados}) + P (\text{Perdidos}) + O (\text{Obturados})$$
  $$\text{ceo} = c (\text{cariados}) + e (\text{extracción indicada}) + o (\text{obturados})$$
- **Section 9: Simbología Normativa**: Exact 10 MSP symbols.
- **Section 10: Diagnósticos**: CIE-10 code, description, type (Presuntivo / Definitivo).
- **Section 11: Plan de Tratamiento**: Preventive, restorative, surgical, endodontic, prosthetic phases.
- **Section 12: Evolución y Tratamiento Realizado**: Date, tooth, procedure, prescriptions, doctor signature.
- **Section K: Consentimiento Informado**: Statutory consent capture under Art. 7 Ley Orgánica de Salud / LOPDP.

---

### 2. Interactive FDI Odontogram Engine

#### A. FDI Tooth Mapping & Quadrants
- **Adult Arches**:
  - Quadrant 1 (Superior Derecho): 18, 17, 16, 15, 14, 13, 12, 11
  - Quadrant 2 (Superior Izquierdo): 21, 22, 23, 24, 25, 26, 27, 28
  - Quadrant 3 (Inferior Izquierdo): 38, 37, 36, 35, 34, 33, 32, 31 (reordered anatomically)
  - Quadrant 4 (Inferior Derecho): 41, 42, 43, 44, 45, 46, 47, 48
- **Deciduous (Child) Arches**:
  - Quadrant 5: 55, 54, 53, 52, 51
  - Quadrant 6: 61, 62, 63, 64, 65
  - Quadrant 7: 75, 74, 73, 72, 71
  - Quadrant 8: 81, 82, 83, 84, 85

#### B. 5-Surface Vector Geometry
Each tooth is modeled with 5 interactive polygon zones:
- `top` (Vestibular/Palatino depending on arch)
- `bottom` (Lingual/Vestibular)
- `left` (Mesial/Distal)
- `right` (Distal/Mesial)
- `center` (Oclusal / Incisal)

#### C. Normative Color & Mode Coding
- **Red (`#ef4444`)**: Patología actual / Tratamiento requerido (e.g. Caries activa, sellante necesario).
- **Blue (`#2563eb`)**: Tratamiento realizado / Restauración existente (e.g. Obturación en buen estado, sellante realizado).
- **Violet/Purple (`#8b5cf6`)**: Aparatología removible y prótesis de soporte mucoso.

#### D. State Management & Undo Stack
- Keep an immutable history state stack: `setHistory(prev => [...prev.slice(-15), teethState])`.
- On `handleUndo`, pop the last state: `setTeethState(history[history.length - 1])`.
- Provide a confirmation modal before clearing the entire chart (`handleClearAll`).
- Always keep the toolbar sticky (`sticky top-0 z-30`) to avoid overlapping tooth inputs during scrolling.

---

### 3. Master-Detail Clinical Layout Architecture

When building or refactoring patient detail views:
- **Pinned Identity Sidebar (`md:h-full md:overflow-y-auto`)**:
  - Contains patient photo, cédula, age, emergency contact, chronic alert badges (Diabetes, Hypertension, Allergies), outstanding balance, and the primary `"Editar Información Principal"` trigger.
- **Independent Tabbed Work Area (`md:h-full md:overflow-y-auto custom-scrollbar`)**:
  - Houses the clinical tabs (Formulario 033, Odontograma, Recetas, Citas, Facturación, Familia).
  - Scrolling down MUST move ONLY the right pane while the left summary remains permanently in view.

---

### 4. Statutory Health Data Privacy (LOPDP Ecuador / HIPAA)

1. **Datos Sensibles**: Patient clinical antecedents, odontograms, and diagnoses cannot be shared without explicit consent.
2. **Informed Consent Clause**:
   > "El paciente (o su representante legal) autoriza de forma libre, expresa e informada el tratamiento de sus datos personales y sensibles de salud para fines de atención clínica, diagnóstico odontológico y conformación de la Historia Clínica Digital (HCU-033), en estricto cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP) del Ecuador."
3. **Audit Logging**: Store timestamp, `doctor_id`, and `clinic_id` on every mutation of `hcu033_forms` or `patients`.

---

## Common Pitfalls & Anti-Patterns

1. ❌ **Full Page Scrolling in Patient Charts**: Scrolling the whole page loses context of patient identity and medical alerts. Always use independent split-pane scrolling.
2. ❌ **Generic SOAP Notes Instead of Odontogram**: Dental EHRs require interactive FDI polygon charting with automated CPO-ceo indices, not plain text areas.
3. ❌ **Unchecked Receptionist Privileges**: Allowing front-desk staff to edit doctor SENESCYT licensing or alter clinical diagnoses violates health compliance.
4. ❌ **Missing `clinic_id` in Query Filters**: Never query tables without `.eq('clinic_id', currentClinicId)`, which risks multi-tenant data leaks.
5. ❌ **Overlapping Sticky Toolbars**: In responsive odontograms, ensure `sticky top-0 z-30` has explicit top offsets and padding to avoid covering upper teeth.
