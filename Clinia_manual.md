# CLINIA+ DENTAL SAAS — DEVELOPER & AGENT MANUAL (AGENTS.MD)

> **Version**: 2.5 (Production Standard — MSP HCU-033 & LOPDP Compliant)  
> **Target Audience**: AI Agents, Senior Full-Stack Developers, and Clinical Software Architects.

---

## 1. Project Overview & Mission

**Clinia+** is a multi-tenant Dental Practice Management & Electronic Health Record (EHR / PMS) SaaS designed for dental clinics and multi-specialty dental centers in Ecuador and Latin America.

The platform unifies:
1. **Clinical Health Records**: Full compliance with the official Ecuadorian Ministry of Public Health Normative (**SNS-MSP / HCU-form.033 / 2008**).
2. **Interactive FDI Odontogram**: Vector-based 5-surface dental charting with automated CPO-ceo index calculation, dual-mode pathology (red) vs. treatment (blue), and undo state history.
3. **Smart Agenda & Bookings**: Integrated doctor schedules, live patient combobox cards, treatment duration auto-calculation, and multi-status tracking (`scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`).
4. **Prescription Engine (Recetas)**: Dynamic A5 medical recipe generator incorporating clinic storage branding (`clinic-branding`), doctor credentials, patient cédula, and dosage instructions.
5. **Data Protection & Legal Compliance**: Strict alignment with the **Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador)**, role-based access control (RBAC), and multi-tenant clinic isolation.

---

## 2. Core Architecture & Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions, Dynamic Layouts).
- **Language**: TypeScript 5.x (`strict: true`, clean compile).
- **UI & Styling**: Tailwind CSS, shadcn/ui (Radix primitives), Lucide React icons.
- **State & Data Fetching**: TanStack React Query (`@tanstack/react-query`) with caching & optimistic invalidation.
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) and multi-tenant `clinic_id` foreign keys.
- **Document Generation**: jsPDF + jspdf-autotable (Client-side lightweight exports without server bottlenecks).

---

## 3. Database Schema & Data Models

### 3.1 `clinics`
Central tenant record for each dental practice.
- `id` (uuid, PK): Clinic unique identifier.
- `name` (text): Commercial name of the dental practice.
- `slug` (text, unique): URL identifier.
- `address` (text), `phone` (text), `email` (text).
- `logo_url` (text): Public URL in Supabase Storage (`clinic-branding`).
- `subscription_tier` (text): `'trial' | 'start' | 'pro' | 'enterprise'`.
- `settings` (jsonb): Practice size, operating hours, notification preferences.

### 3.2 `profiles` (Users & Staff)
Stores authentication links, professional roles, and medical credentials.
- `id` (uuid, PK): References `auth.users.id`.
- `clinic_id` (uuid, FK): Active tenant clinic reference.
- `full_name` (text), `email` (text), `phone` (text).
- `role` (text): `'clinic_owner' | 'admin' | 'doctor' | 'receptionist'`.
- `specialization` (text): e.g., "Ortodoncia", "Endodoncia", "Odontopediatría".
- `license_number` (text): Professional registration (SENESCYT / MSP).
- `avatar_url` (text): Path in `doctor-avatars`.
- `bio` (text): Professional biography.

### 3.3 `patients`
Demographics, emergency contacts, chronic alerts, and LOPDP consent.
- `id` (uuid, PK): Patient UUID.
- `clinic_id` (uuid, FK): Multi-tenant scoping.
- `first_name` (text), `last_name` (text).
- `cedula` / `identification` (text): Ecuadorian 10-digit ID or passport.
- `birth_date` (date), `gender` (text: `'M' | 'F' | 'O'`).
- `nationality` (text, default: `'Ecuatoriana'`).
- `address` (text), `phone` (text), `email` (text), `occupation` (text).
- `medical_record_number` (text, unique per clinic).
- `allergies` (text), `has_diabetes` (bool), `has_hypertension` (bool), `has_cardiac` (bool).
- `data_consent` (bool): Statutory LOPDP informed consent confirmation.
- `representative_id` (uuid, nullable): Reference to family billing head.

### 3.4 `hcu033_forms` (Ecuadorian MSP Formulario 033)
Official dental clinical history according to SNS-MSP / HCU-form.033 / 2008.
- `id` (uuid, PK).
- `patient_id` (uuid, FK), `doctor_id` (uuid, FK), `clinic_id` (uuid, FK).
- `form_data` (jsonb):
  - Section 1: Demographics (`nacionalidad`, edad, sexo, etc.).
  - Section 2: Motivo de consulta.
  - Section 3: Enfermedad o problema actual.
  - Section 4: Antecedentes personales y familiares (1-8).
  - Section 5: Signos vitales (Presión, pulso, temperatura, respiración).
  - Section 6: Odontograma state (FDI adult & deciduous teeth).
  - Section 7: Indicadores de salud bucal (Placa, cálculo, gingivitis, periodontal).
  - Section 8: Índices CPO-ceo (Automated `C, P, O, c, e, o`).
  - Section 9: Simbología normada aplicada.
  - Section 10: Diagnósticos (CIE-10 / PRE / DEF).
  - Section 11: Plan de tratamiento y procedimientos.
  - Section 12: Sesiones clínicas y evolución.
  - Section K: Consentimiento informado del paciente y firma digital.

### 3.5 `appointments`
- `id` (uuid, PK).
- `clinic_id` (uuid, FK), `patient_id` (uuid, FK), `doctor_id` (uuid, FK).
- `start_time` (timestamp with tz), `end_time` (timestamp with tz).
- `status` (text): `'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'`.
- `type` / `service_id` (text / uuid): Treatment reference.
- `notes` (text).

### 3.6 `services` (Treatments Catalog)
- `id` (uuid, PK), `clinic_id` (uuid, FK).
- `name` (text), `description` (text), `category` (text).
- `price` (numeric), `duration_minutes` (integer, default: 30).
- `active` (bool).

---

## 4. Role-Based Access Control (RBAC) & Security Rules

| Feature / Resource | `clinic_owner` / `admin` | `doctor` | `receptionist` |
| :--- | :---: | :---: | :---: |
| **Manage Clinic Profile & Branding** | Read / Write | Read Only | Read Only |
| **Manage Team Members & SENESCYT Licenses** | Read / Write | Read Only | Read Only |
| **View Patients Directory** | Full | Full | Full |
| **Edit Patient Demographics / Primary Info** | Full | Full | Full |
| **Create & Edit HCU-033 / Odontogram** | Full | Full | Restricted |
| **Emit Medical Prescriptions (Recetas)** | Full | Full | Restricted |
| **Agenda & Appointment Booking** | Full | Full | Full |
| **Analytics & Operational Reports** | Full | Doctor Scoped | Front-Desk KPIs |

### Critical Security Directives for Agents:
1. **Always verify `clinic_id`**: Every database query, insert, or update MUST be scoped to the authenticated tenant's `currentClinicId`.
2. **Never expose doctor license editing to receptionists**: The UI must dynamically verify role checks (`isAdmin` vs. `isReceptionist`).
3. **Sensitive Health Data (LOPDP)**: Never log patient health antecedents, cédula, or diagnoses in plaintext client logs or URLs.

---

## 5. UI/UX & Component Architecture Guidelines

### 5.1 Patient Detail Split Viewport Layout (`patients/[id]/page.tsx`)
- **Desktop Architecture**: Must maintain `h-[calc(100vh-49px)] overflow-hidden` container.
- **Left Sidebar**: `md:h-full md:overflow-y-auto` (pinned summary card, contact data, medical alert badges, balance, and the primary `"Editar Información Principal"` button).
- **Right Pane**: `md:h-full md:overflow-y-auto custom-scrollbar` containing tabs for Formulario 033, Odontograma, Prescripciones, Citas, and Familia.

### 5.2 Interactive Odontogram (`components/odontograma-interactive.tsx`)
- **FDI 2-Digit Standard**: Adult (11-18, 21-28, 31-38, 41-48) & Deciduous (51-55, 61-65, 71-75, 81-85).
- **Sticky Non-Overlapping Toolbar**: Always keep `sticky top-0 z-30` so tools remain accessible while scrolling down long arches.
- **Dual Mode**:
  - `red` (Patología actual / Diagnóstico).
  - `blue` (Tratamiento realizado / Procedimiento concluido).
- **Safety**: Undo history stack (`RotateCcw`) and confirmation modal on "Limpiar Todo".

### 5.3 Color Palette & Clinical Aesthetics
- **Primary**: Deep Clinical Slate / Teal (`#0d9488`, `#0f766e`, `#145247`).
- **Pathology Accent**: Crimson Red (`#ef4444`).
- **Completed Treatment Accent**: Royal Blue (`#2563eb`).
- **Removable Prosthetics Accent**: Violet (`#8b5cf6`).
- **Never use distracting icons** (e.g. sparkles) in medical treatment catalogs or health records.

---

## 6. Verification Protocol for Developers & Agents

Whenever making changes or adding features:
1. Run type check: `npx tsc --noEmit` (must exit with 0 errors).
2. Validate multi-tenant scoping: Ensure `currentClinicId` is passed in queries.
3. Validate PDF generators: Ensure `lib/pdf-generator.ts` and `lib/reports-pdf.ts` export with proper metadata and branding.
4. Verify responsive layout on mobile (<768px) and desktop (>1024px).
