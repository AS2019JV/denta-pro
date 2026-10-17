# CLINIA+ DENTAL SAAS — AGENT LEARNINGS & COLLABORATION PLAYBOOK

> **Document Version**: 1.0  
> **Author**: Antigravity AI Engineering Team  
> **Target Audience**: AI Agents, Senior Software Engineers, and SaaS Maintainers  
> **Scope**: Best practices, hard-earned debugging lessons, clinical domain invariants, and agent-to-agent collaboration protocols.

---

## 1. Executive Summary: What We Learned Building Clinia+

Building a production-grade Dental Practice Management & Electronic Health Record (EHR) SaaS is fundamentally different from building a generic B2B web app. Clinical software sits at the intersection of **human health**, **strict legal regulations (LOPDP & MSP)**, and **high-pressure chairside workflows**.

Every second a dentist spends fighting a clunky UI or waiting for a slow query is a second taken away from patient care.

---

## 2. Hard-Earned Technical Lessons & Edge Cases

### 2.1 The Windows Node.js DNS IPv6 Timeout Trap
- **The Symptom**: Standalone Node.js scripts (migrations, seeders, test harnesses) running on Windows stall for 10,000ms and fail with `UND_ERR_CONNECT_TIMEOUT` when connecting to `*.supabase.co`.
- **The Root Cause**: Node.js 20+ undici fetch tries IPv6 DNS addresses first on Windows networks that lack native IPv6 routing, waiting for a 10s connection timeout before falling back to IPv4.
- **The Invariant Solution**:
  ```javascript
  // In any Node CLI script or background task:
  const dns = require('node:dns');
  dns.setDefaultResultOrder('ipv4first');
  // OR launch with: node --dns-result-order=ipv4first script.js
  ```

### 2.2 Excel in Spanish: UTF-8 BOM & Semicolon Delimiters
- **The Symptom**: When exporting patients to CSV, clinic staff opening the file in Microsoft Excel on Windows reported corrupted accents (`CÃ©dula`, `MarÃ­a`) and all data dumped into a single column.
- **The Root Cause**: Excel on Windows in Spanish/Latin American locales defaults to ANSI/Windows-1252 encoding and uses `;` (semicolon) as the list separator because `,` (comma) is reserved for decimal numbers.
- **The Invariant Solution**:
  ```typescript
  // Always prepend the UTF-8 Byte Order Mark (\uFEFF) and use ';' as delimiter
  const csvContent = "\uFEFF" + rows.map(r => r.join(";")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  ```

### 2.3 Schema Drift & Real Column Inspection
- **The Trap**: Assuming common column names without checking the live PostgreSQL schema.
  - Assuming `patients.document_id` when the actual column is `patients.cedula`.
  - Assuming `profiles.specialty` when the actual column is `profiles.specialization`.
  - Assuming `prescriptions` only needs `patient_id` and `doctor_id` when multi-tenancy requires `clinic_id` on every INSERT.
- **The Agent Protocol**: Never guess schema structures. Run a 1-line query to inspect live column names before writing queries or interfaces:
  ```javascript
  const { data } = await supabase.from('target_table').select('*').limit(1);
  console.log(Object.keys(data[0]));
  ```

### 2.4 Legal Data Retention vs. "Delete Account"
- **The Legal Reality**: Under the Ecuadorian **Ley Orgánica de Salud (Art. 7)** and MSP norms, medical records and clinical histories are subject to mandatory legal custody periods (typically 5 to 10 years).
- **The Invariant Solution**: You cannot offer a naive "Delete All My Data Instantly" button in healthcare software. Portability is governed by **Art. 17 LOPDP** and supported via 1-click structured JSON backup, while Deletion / Suppression is governed by **Art. 15 LOPDP** and must be routed through administrative legal archiving and clinical retention safeguards (persisting traceable requests in `public.data_rights_requests`). Clinical records (HCU-033) must be retained under mandatory medical custody for 5 to 10 years per Ley Orgánica de Salud (Art. 7) and MSP technical norms. Note that statutory Articles 20 and 21 of the LOPDP govern automated individual decisions and profiling (*Decisiones y valoraciones automatizadas*).

---

## 3. Clinical UI/UX Design Principles

### 3.1 The Master-Detail Split Viewport
- **Anti-Pattern**: A long, single-scroll page where the patient's identity, chronic alerts, and contact details disappear as the doctor scrolls through the dental chart.
- **Best Practice**:
  - Pinned left sidebar (`md:h-full md:overflow-y-auto`) holding identity, cédula, allergies, and quick actions.
  - Independently scrollable right pane (`md:h-full md:overflow-y-auto custom-scrollbar`) for HCU-033, Odontogram, Prescriptions, and Appointments.
  - Desktop container fixed to `h-[calc(100vh-49px)] overflow-hidden`.

### 3.2 Chairside Odontogram Invariants
- **Non-Overlapping Sticky Toolbar**: Must have `sticky top-0 z-30` with solid background (`bg-card/95 backdrop-blur`) so tools and color toggles stay visible while scrolling down the 32 permanent and 20 deciduous teeth.
- **Dual-Mode Color Standard**:
  - **Red (`#ef4444`)**: Existing pathology / diagnostic finding.
  - **Blue (`#2563eb`)**: Completed treatment / performed restoration.
- **Undo History**: Always provide a `RotateCcw` undo stack so an accidental click on a tooth surface doesn't require clearing the whole chart.

### 3.3 Medical Prescription Engine (Recetas)
- A medical recipe is a legal document. In Ecuador, it must include:
  1. Clinic branding logo (from Supabase Storage `clinic-branding`).
  2. Patient full name and Cédula.
  3. Professional signature block with **Registro SENESCYT / MSP** (`profiles.license_number`) and medical specialty.
  4. Standard A5 dimensions with clear Rp. table layout.

---

## 4. Key Tips for Future AI Agents & Developers

1. **Always Scope by `clinic_id`**: In a multi-tenant SaaS, omitting `clinic_id` in a query or mutation is a critical security vulnerability. Every RLS policy and client query must enforce tenant isolation.
2. **Deterministic Verification over Claims**: Always run `npx tsc --noEmit` before claiming a task is done. A single missing import (`Stethoscope`) or wrong prop name (`subtitle` instead of `description`) breaks production builds.
3. **Token & Context Economy**: Never dump thousands of lines of logs or entire repositories into the prompt. Use compact test summaries (`harness.py check --compact`) and precise line references.
4. **Spanish Language Consistency**: Ensure all user-facing strings, buttons, toasts, confirmation modals, and error messages are written in clear, professional medical Spanish (`es-EC`).
5. **Separation of Concerns for MVPs**: When an MVP requires focusing on clinical workflows, cleanly de-emphasize or hide complex accounting/billing modules rather than leaving half-broken payment mockups that confuse users.
