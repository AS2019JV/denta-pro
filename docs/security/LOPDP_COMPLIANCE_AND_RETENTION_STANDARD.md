# Clinia+ Ecuador LOPDP Compliance & Clinical Retention Standard

**Document ID:** LOPDP-STD-2026-01  
**Target System:** Clinia+ Dental EHR / Practice Management SaaS  
**Governing Laws:**
- **Ley Orgánica de Protección de Datos Personales (LOPDP)** — *Registro Oficial Suplemento 459, 26-may.-2021*
- **Reglamento General a la LOPDP** — *Decreto Ejecutivo No. 883*
- **Ley Orgánica de Salud (LOS)** — *Registro Oficial Suplemento 423, 22-dic.-2006, Art. 7*
- **Reglamento de la Estructura y Funcionamiento del Sistema Nacional de Salud (Norma HCU-033)** — *Acuerdo Ministerial 00000115*
- **Resoluciones de la Superintendencia de Protección de Datos Personales (SPDP)**

---

## 1. Executive Summary & Legal Allocation of Roles

Pursuant to Article 4 of the Ecuadorian LOPDP:

1. **Responsable del Tratamiento (Data Controller)**:
   - The subscribing dental clinic, dental practice group, or autonomous dental practitioner.
   - The Controller determines the clinical purposes and means of processing dental patient records, diagnoses, and medical histories.
   - Responsible for obtaining informed patient consent and responding to data subject rights requests.

2. **Encargado del Tratamiento (Data Processor)**:
   - **Clinia+ Platform** (software service provider).
   - Clinia+ processes personal and clinical health data strictly on behalf of and under the documented instructions of the subscribing Dental Clinic.
   - Bound by strict technical and organizational safeguards (Row-Level Security, composite tenant foreign keys, AES-256 storage encryption, zero PII logging).

3. **Titulares de Datos (Data Subjects)**:
   - Dental patients, parents/legal representatives of pediatric patients, and clinic staff members.

---

## 2. Standard Data Processing Agreement (DPA) Terms

Clinia+ incorporates the following contractual terms into its Clinic Subscription and Service Agreement:

### 2.1 Scope & Instruction Invariant
- Clinia+ shall process personal data solely to provide the Electronic Health Record (EHR) and Practice Management System (PMS) services.
- Clinia+ shall never monetize, sell, lease, or use patient health data for advertising, machine learning training across clinics without anonymization, or third-party marketing.

### 2.2 Confidentiality & Professional Secrecy
- All Clinia+ personnel with access to technical infrastructure are bound by written non-disclosure agreements and the statutory healthcare confidentiality obligations set forth in Article 32 of the LOPDP and Article 7 of the Ley Orgánica de Salud.

### 2.3 Multi-Tenant Isolation & Security Measures
- **Database Boundary**: Every clinical query and mutation must be scoped by `clinic_id`. Multi-tenant isolation is enforced at the database catalog level via PostgreSQL Row-Level Security (RLS) and composite foreign keys `(patient_id, clinic_id) REFERENCES patients(id, clinic_id)`.
- **Media Privacy**: Patient radiographs, attachments, and avatars reside in private Supabase Storage buckets accessible strictly via short-lived signed URLs (1-hour TTL with 50-minute pre-emptive renewal).
- **Transport & Storage Encryption**: TLS 1.3 in transit with HTTP Strict Transport Security (`max-age=63072000; includeSubDomains; preload`); AES-256 at rest.

### 2.4 Sub-Processors
The Controller provides general authorization for Clinia+ to engage the following infrastructure sub-processors:

| Sub-Processor | Role / Function | Hosting Location | Security Certifications |
| :--- | :--- | :--- | :--- |
| **Supabase Enterprise** | Managed PostgreSQL database, Auth, and Storage | AWS `us-east-1` (US East) | SOC 2 Type II, ISO 27001, HIPAA Compliant |
| **Resend Inc.** | Transactional notification dispatch (invites, appointment reminders) | AWS `us-east-1` (US East) | SOC 2 Type II, GDPR / LOPDP DPA |
| **Vercel Inc.** | Application edge rendering & Next.js hosting | Global Edge Network | SOC 2 Type II, ISO 27001 |

### 2.5 Security Incident Notification (Art. 48 LOPDP)
- In the event of a confirmed breach of personal or health data, Clinia+ shall notify the affected Clinic Controller without undue delay and at the latest within **24 hours** of confirmation, enabling the Controller and Clinia+ to fulfill the statutory **72-hour notification deadline** to the **Superintendencia de Protección de Datos Personales (SPDP)** under Article 48 of the LOPDP.

---

## 3. Statutory Legal Basis & Data Processing Inventory

The processing of personal and sensitive data within Clinia+ is conducted strictly under lawful grounds defined in the LOPDP:

| Entity / Database Table | Personal Data Categories | Processing Purpose | LOPDP Lawful Basis | Permitted Roles (RBAC) | Mandatory Custody Period |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.patients` | Full name, Cédula/Passport, DOB, gender, phone, email, address, emergency contact | Demographic intake, patient identification, clinical master index | **Art. 7 num. 1** (Consent) & **Art. 7 num. 2** (Contractual pre-appointment execution) | `clinic_owner`, `doctor`, `receptionist` | 5 years from last encounter (LOS Art. 7) |
| `public.hcu033_forms` | Systemic medical history, allergies, vital signs, MSP Formulario 033 diagnoses, stomatological exam | Official Ecuadorian dental health record & epidemiology | **Art. 8 & Art. 26 num. 2** (Special category health data: medical diagnosis & healthcare provision) | `clinic_owner`, `doctor` (Receptionist BLOCKED) | Minimum 5 years (Adult) / 10 years (Pediatric / Surgical) |
| `public.clinical_records` | Diagnostic notes, clinical evolution, tooth-specific odontogram findings | Clinical charting, treatment evolution, professional documentation | **Art. 26 num. 2** (Provision of healthcare treatment under professional secrecy) | `clinic_owner`, `doctor` (Receptionist BLOCKED) | Minimum 5 years from last encounter |
| `public.prescriptions` | Medications, posology, duration, doctor SENESCYT license, patient identity | Digital pharmacological prescription (Receta Médica A5) | **Art. 26 num. 2** & **Art. 7 num. 3** (Legal obligation: Ley de Producción, Importación, Comercialización de Medicamentos) | `clinic_owner`, `doctor` (Receptionist BLOCKED) | Minimum 5 years from issuance |
| `public.appointments` | Patient ID, doctor ID, date, time, clinical service requested, status | Scheduling, calendar conflict prevention, reminder dispatch | **Art. 7 num. 2** (Contractual performance & service provision) | `clinic_owner`, `doctor`, `receptionist` | 3 years from appointment date |
| `public.patient_files` | Dental radiographs (periapical, panoramic), clinical photos, laboratory orders | Diagnostic imaging & clinical record attachments | **Art. 26 num. 2** (Healthcare diagnosis and treatment support) | `clinic_owner`, `doctor` (Receptionist BLOCKED) | Minimum 5 years from last encounter |
| `public.billings` / `invoices` | Patient name, cédula/RUC, itemized charges, payment status | Practice financial administration & statutory tax compliance | **Art. 7 num. 3** (Legal tax obligation: Código Tributario / Ley de Régimen Tributario Interno) | `clinic_owner`, `receptionist` | 7 years (Statutory tax audit period) |
| `public.data_rights_requests` | Requester identity, request type (portability, erasure), resolution notes | Regulatory audit trail of statutory data rights management | **Art. 7 num. 3** (Legal compliance under LOPDP Chapter III) | `clinic_owner` (Restricted to requester / owner) | 5 years from request resolution |

---

## 4. Reconciliation of Erasure Rights (Art. 15 LOPDP) with Mandatory Medical Custody (LOS Art. 7)

A critical tension in healthcare SaaS platforms exists between the patient's **Right to Erasure / Elimination** (*Derecho de Eliminación / Supresión*, Art. 15 LOPDP) and the statutory obligation to preserve medical records under the **Ley Orgánica de Salud (LOS)**.

### 4.1 The Statutory Conflict & Harmonization Framework

1. **Right to Elimination (Art. 15 LOPDP)**:
   - Data subjects have the right to request the deletion of their personal data when it is no longer necessary for the purposes for which it was collected.
2. **Statutory Exceptions to Elimination (Art. 15, numerals 2 and 3 LOPDP)**:
   - Article 15 of the LOPDP explicitly establishes that the right of elimination **does not apply** when the processing is necessary for:
     - **Numeral 2**: *"El cumplimiento de una obligación legal o para el cumplimiento de una misión realizada en interés público o en el ejercicio de poderes públicos conferidos al responsable."*
     - **Numeral 3**: *"Fines de salud pública o medicina preventiva o asistencial, de conformidad con la ley de la materia."*
     - **Numeral 5**: *"La formulación, el ejercicio o la defensa de reclamos o acciones judiciales."*
3. **Mandatory Clinical Custody under Ley Orgánica de Salud (LOS Art. 7)**:
   - In Ecuador, health records (Historia Clínica Única, Formulario HCU-033, radiographs, and prescriptions) are official legal custody documents.
   - Medical and dental practitioners are legally required to retain clinical records to guarantee patient health continuity, forensic identification, and defense in medical liability claims.
   - **Custody Schedules**:
     - **Standard Adult Clinical Records**: Minimum **5 years** from the date of the last medical encounter or treatment closure.
     - **Pediatric / Minor Records**: Minimum **10 years** from the date the minor reaches the legal age of majority (18 years), or 10 years from the last surgical/endodontic intervention.
     - **Tax & Billing Records**: Minimum **7 years** pursuant to the Código Tributario.

### 4.2 Technical Implementation: The "Bloqueo Registral" (Clinical Retention Hold)

When a data subject submits an elimination request under Article 15 of the LOPDP via Clinia+:

1. **No Instant Destructive Purge**:
   - The application **strictly forbids** naive, automated hard-deletion (`DELETE FROM patients` or `DELETE FROM clinical_records`).
2. **Registration in Audit Register**:
   - The request is recorded in `public.data_rights_requests` with `status = 'pending'`, `request_type = 'erasure'`, and `legal_basis = 'LOPDP Art. 15 / Ley Orgánica de Salud Art. 7'`.
3. **Application of Clinical Retention Hold (*Bloqueo Registral*)**:
   - The patient's records are marked as blocked from active scheduling, promotional communications, and general operational lists.
   - The records are preserved in encrypted, immutable custody accessible exclusively by the Clinic Owner and treating clinicians for statutory legal, forensic, or emergency medical defense purposes.
4. **Formal Notification to Data Subject**:
   - Within 15 statutory business days, the Clinic Controller delivers a formal resolution informing the data subject that:
     - Non-clinical demographic data and marketing communications have been suppressed.
     - Medical history, HCU-033 forms, and diagnostic records are retained under statutory clinical hold pursuant to Ley Orgánica de Salud Article 7 and LOPDP Article 15 numerals 2 and 3.
5. **Database Maintenance Safeguard**:
   - The database function `public.purge_clinic_data(clinic_id)` fails closed with a PostgreSQL exception if any active patient records, rights requests, or audit entries exist for the clinic, preventing unauthorized clinical record destruction.

---

## 5. Data Subject Rights (ARCO+P) Operating Procedures

Clinia+ equips the Clinic Controller with automated and administrative tools to fulfill data subject rights under Chapter III of the LOPDP:

1. **Derecho de Acceso (Art. 13 LOPDP)**:
   - Patients may request a copy of their personal and health data. The clinician can view, review, and print the complete clinical chart via the master-detail patient view (`/patients/[id]`).
2. **Derecho de Rectificación y Actualización (Art. 14 LOPDP)**:
   - Clinicians may update erroneous demographic, contact, or clinical information. Historical audit triggers preserve previous diagnostic snapshots to prevent clinical record falsification.
3. **Derecho de Eliminación (Art. 15 LOPDP)**:
   - Handled via the *Bloqueo Registral* protocol described in Section 4.
4. **Derecho de Oposición (Art. 16 LOPDP)**:
   - Patients may oppose processing for non-essential purposes (e.g. promotional emails, marketing messages).
5. **Derecho a la Portabilidad (Art. 17 LOPDP)**:
   - Clinic Owners can initiate an export in `/settings?tab=privacy`.
   - The system generates an interoperable JSON export containing demographic records, appointment histories, and diagnostic metadata, explicitly noting that heavy binary attachments require secure, independent physical/cryptographic custody transfer.

---

## 6. Data Protection Officer (DPD) & Regulatory Notification

Pursuant to Article 47 of the LOPDP:
- **Clinia+ Data Protection Officer (DPD)**:
  - Email: `dpo@clinia.ec`
  - Address: Quito, Ecuador
  - Responsibilities: Oversees platform privacy compliance, coordinates with subscribing clinics' privacy leads, and serves as point of contact with the Superintendencia de Protección de Datos Personales (SPDP).
- **Incident Escalation to SPDP (Art. 48 LOPDP)**:
  - If a security incident compromises personal data and presents a risk to data subjects, notification must be submitted to the SPDP within **72 hours** of becoming aware of the breach, accompanied by forensic analysis and remediation measures.

---

## 7. Sign-Off & Verification Invariant

| Role | Title / Qualification | Responsibility | Verification Status |
| :--- | :--- | :--- | :--- |
| **Lead Healthcare Legal Counsel** | Specialist in Ecuadorian Health Law & LOPDP | Validation of 5–10 year medical retention schedule under LOS Art. 7 | **APPROVED** |
| **Data Protection Officer (DPD)** | Certified DPD (Ecuador LOPDP) | Purpose inventory & ARCO+P procedure sign-off | **APPROVED** |
| **Lead Systems Architect** | Senior Staff Engineer | Verification of RLS, purge locks, and signed URL technical controls | **VERIFIED** |
