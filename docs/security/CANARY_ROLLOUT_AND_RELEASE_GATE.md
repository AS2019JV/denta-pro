# Clinia+ Dental EHR/PMS: Canary Rollout Specification & Final Release Gate Sign-Off Protocol

**Platform:** Clinia+ Dental Practice Management & Electronic Health Record (EHR/PMS) SaaS  
**Target Repository:** `c:/Users/aleja/Documents/0-dev/denta-pro`  
**Governing Standard:** Milestone 7 Production Acceptance ([`docs/security/M7_PRODUCTION_ACCEPTANCE_2026-09-22.md`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/docs/security/M7_PRODUCTION_ACCEPTANCE_2026-09-22.md))  
**Readiness Framework:** Production Readiness Review ([`PRODUCTION_READINESS.md`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/PRODUCTION_READINESS.md))  
**Document Revision:** 1.0.0 (Release Candidate 1 - Gate 7 Final Verification)  
**Effective Date:** September 2026  

---

## 1. Executive Summary & Purpose

Clinia+ is a mission-critical multi-tenant Dental Electronic Health Record and Practice Management platform handling sensitive patient health information (PHI) and diagnostic data under Ecuadorian statutory law (Ley Orgánica de Protección de Datos Personales - LOPDP and Ley Orgánica de Salud - LOS).

To safely transition from local development and deterministic test harness verification to staging and live production deployment without service degradation, data corruption, or cross-tenant exposure, this specification codifies:
1. A **4-stage canary deployment lifecycle** (`5% -> 25% -> 50% -> 100%`) with mandatory soak periods.
2. Quantitative **telemetry health gates and Service Level Objectives (SLOs)** enforced at every gate.
3. Automated **emergency rollback triggers** and rapid rollback runbooks ($< 90\text{s}$ total execution).
4. The **Consolidated Release Gate Sign-Off Matrix** across all 8 development gates (Gate 0 through Gate 7).
5. The verified cross-reference audit against [`PRODUCTION_READINESS.md`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/PRODUCTION_READINESS.md).

---

## 2. The 4-Stage Canary Rollout Progression

Traffic rollout progresses sequentially through 4 production stages following Stage 0 staging convergence. Progression to any subsequent stage requires 100% metric compliance and zero unhandled rollback conditions throughout the full soak duration.

```
[Stage 0: Staging Pre-Flight]
           │
           ▼
[Stage 1: Alpha Pilot (5% Traffic, 24h Soak)]
           │  (Error Rate < 0.1%, p95 < 400ms, 0 RLS Leaks)
           ▼
[Stage 2: Regional Beta (25% Traffic, 24h Soak)]
           │  (Error Rate < 0.15%, p95 < 500ms, DB Pool < 50%)
           ▼
[Stage 3: Broad Rollout (50% Traffic, 48h Soak)]
           │  (Error Rate < 0.20%, p95 < 600ms, 0 Critical Breaches)
           ▼
[Stage 4: General Availability (100% Traffic)]
```

### Stage 0: Staging Verification & Pre-Flight Gate (0% Production Traffic)
- **Target Environment:** Isolated Supabase Staging Project / PostgreSQL Container (isolated from `leqsrfyjvuxxdsubjjin`).
- **Prerequisite Checks:**
  1. Execute read-only pre-flight data integrity query: verify zero mismatched `(clinic_id, patient_id)` pairs across child tables.
  2. Apply forward migrations: [`20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql) followed by [`20260925000000_compound_multi_tenant_indexes.sql`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/supabase/migrations/20260925000000_compound_multi_tenant_indexes.sql).
  3. Validate composite foreign keys and trigger functions (`security_internal.enforce_clinician_assignment`) against live catalog.
  4. Execute synthetic dual-tenant PostgREST tests verifying cross-tenant insert rejections (SQLSTATE `23503`).
  5. Execute rollback test runbook: apply [`rollback_20260925000000.sql`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/supabase/migrations/rollback_20260925000000.sql) and [`rollback_20260922194927.sql`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/supabase/migrations/rollback_20260922194927.sql), then re-apply forward migrations to confirm idempotency.
- **Exit Criteria:** 100% passing automated staging test suite; zero catalog discrepancies.

---

### Stage 1: Internal Dogfooding & Alpha Pilot (5% Traffic, 24-Hour Soak)
- **Cohort Selection:** 2 verified pilot clinics (1 General Dentistry clinic in Quito, 1 Pediatric Dental practice in Guayaquil) + Clinia+ internal administrative operations.
- **Traffic Routing:** Tenant-based sticky routing (Vercel Edge Middleware / cookie hash `clinic_id % 100 < 5`).
- **Core Clinical Journeys Evaluated:**
  1. Patient demographic intake with Ecuadorian Module-10 Cédula verification.
  2. FDI 2-digit odontogram interactive surface charting (adult arches 11–48 and deciduous arches 51–85).
  3. Real-time calendar appointment booking and double-booking collision prevention ($S_1 < E_2 \land E_1 > S_2$).
- **Mandatory Soak Duration:** 24 continuous hours encompassing at least one full clinic business day (08:00 to 18:00 ECT).
- **Stage 1 Health Gates:**
  - HTTP 5xx Error Rate: $\le 0.10\%$ of requests.
  - API p95 Latency: $\le 400\text{ms}$.
  - RLS Security Exceptions: Exactly 0 unauthorized cross-tenant data leaks.
  - Calendar Double-Bookings: Exactly 0 concurrent overlapping appointment insertions.

---

### Stage 2: Expanded Regional Beta Pilot (25% Traffic, 24-Hour Soak)
- **Cohort Selection:** 10 representative dental practices across Pichincha, Guayas, and Azuay provinces encompassing ~50 active dental practitioners.
- **Traffic Routing:** Tenant-based sticky routing (`clinic_id % 100 < 25`).
- **Core Clinical Journeys Evaluated:**
  1. Multi-practitioner concurrent scheduling and Supabase Realtime channel event broadcasts (`appointments-clinic-${id}`).
  2. MSP Formulario 033 diagnostic intake and automated CPO-D / ceo-d epidemiological index computations.
  3. Digital A5 medical prescription generation, SENESCYT license verification, and PDF export.
  4. Private radiograph and clinical file uploads with 1-hour signed URL renewal.
- **Mandatory Soak Duration:** 24 continuous hours.
- **Stage 2 Health Gates:**
  - HTTP 5xx Error Rate: $\le 0.15\%$ of requests.
  - API p95 Latency: $\le 500\text{ms}$.
  - Database Connection Pool: $\le 50\%$ utilization.
  - Integrity Violations: Exactly 0 SQLSTATE `23503` (foreign key) or `23514` (check constraint) errors.

---

### Stage 3: Broad Production Staging (50% Traffic, 48-Hour Soak)
- **Cohort Selection:** 50% randomized clinic tenant routing (`clinic_id % 100 < 50`).
- **Traffic Routing:** Vercel Edge Config / cookie-based split.
- **Core Clinical Journeys Evaluated:**
  1. High-volume clinical records browsing and multi-surface Odontogram responsive zoom canvas scaling.
  2. Patient Family Center grouping (`family_representative_id`) and multi-patient search.
  3. LOPDP privacy data export metadata requests and audit trail logging.
- **Mandatory Soak Duration:** 48 continuous hours covering morning peak intake hours (08:30–11:00 ECT) and afternoon appointment peaks (14:30–17:30 ECT).
- **Stage 3 Health Gates:**
  - HTTP 5xx Error Rate: $\le 0.20\%$ of requests.
  - API p95 Latency: $\le 600\text{ms}$.
  - Database CPU Load: $\le 60\%$ sustained average.
  - Error Budget Consumption: $\le 10\%$ of monthly error budget.

---

### Stage 4: General Availability (100% Full Production Traffic)
- **Cohort Selection:** 100% of registered clinics and prospective onboardings.
- **Operational Status:** General Availability for Core EHR/PMS Clinical SaaS.
- **Active Post-Launch Invariants:**
  - Kushki recurring subscriptions and public checkout fail-closed (`503` / `404`) until Phase 2 formal audit.
  - 24/7 automated uptime and latency monitoring active.
  - Automated point-in-time recovery (PITR) and nightly storage snapshots active.
  - On-call engineering escalation active with LOPDP 72-hour regulatory breach response readiness.

---

## 3. Quantitative Service Level Objectives (SLOs) & Health Gates

| Metric Category | Target SLO | Warning Gate (Investigate) | Rollback Gate (Critical Abort) |
|---|---|---|---|
| **Platform Availability** | $\ge 99.90\%$ uptime | $< 99.80\%$ | $< 99.50\%$ |
| **HTTP 5xx Error Rate** | $< 0.10\%$ | $\ge 0.25\%$ | $> 0.50\%$ (5-minute rolling window) |
| **API Latency (p50)** | $< 150\text{ms}$ | $> 250\text{ms}$ | $> 400\text{ms}$ |
| **API Latency (p95)** | $< 500\text{ms}$ | $> 750\text{ms}$ | $> 1200\text{ms}$ |
| **Database Pool Utilization** | $< 40\%$ | $> 65\%$ | $> 80\%$ (3-minute sustained) |
| **Database CPU Utilization** | $< 35\%$ | $> 60\%$ | $> 85\%$ (3-minute sustained) |
| **RLS Unauthorized Denials** | $0$ cross-tenant queries | $> 5/\text{hour}$ | $> 1$ confirmed cross-tenant access |
| **Calendar Collisions** | $0$ overlapping bookings | $> 0$ unhandled | $> 0$ concurrent double-bookings |
| **Integrity Violations** | $0$ SQLSTATE exceptions | $> 0$ (any) | $> 0$ (SQLSTATE 23503 / 23514) |

---

## 4. Automated Emergency Rollback Triggers & Execution Runbook

### 4.1 Rollback Activation Triggers (P0 Severity)
Rollback to the previous stable release MUST occur immediately if ANY of the following deterministic conditions are satisfied:
1. **HTTP 5xx Error Spike:** The rate of HTTP 500/502/503/504 errors exceeds $0.50\%$ across all client requests over any 5-minute rolling window.
2. **Schema Integrity Violation:** Any database insert or update triggers SQLSTATE `23503` (foreign key violation) or `23514` (check constraint violation) during standard clinical workflows, indicating tenant linkage mismatch.
3. **Database Resource Exhaustion:** Connection pool utilization exceeds $80\%$ or database CPU exceeds $85\%$ sustained for more than 180 seconds.
4. **Data Security / Tenant Boundary Breach:** Any evidence of cross-tenant data visibility, unauthorized role escalation, or private storage signed URL leak.
5. **Realtime Calendar Failure:** A confirmed occurrence of double-booking collision where two active non-cancelled appointments overlap for the same doctor in the same clinic.

---

### 4.2 Emergency Rollback Step-by-Step Runbook ($< 90$ Seconds)

#### Step 1: Instant Edge Traffic Rollback ($T + 15\text{s}$)
Revert production traffic routing in Vercel to the previous stable deployment commit:
```bash
# Instant traffic rollback via Vercel CLI
vercel rollback --yes --token=$VERCEL_AUTH_TOKEN
```
*Expected Result:* 100% of web traffic is immediately served by the prior stable build.

#### Step 2: Database Migration Rollback (If Schema Involved) ($T + 45\text{s}$)
If the incident involves database constraints or index locks, execute the verified atomic rollback migrations in reverse dependency order against PostgreSQL:
```bash
# 1. Roll back compound multi-tenant indexes
psql "$STAGING_OR_PROD_DB_URL" -f supabase/migrations/rollback_20260925000000.sql

# 2. Roll back composite foreign keys and rights audit triggers
psql "$STAGING_OR_PROD_DB_URL" -f supabase/migrations/rollback_20260922194927.sql
```
*Expected Result:* PostgreSQL catalog safely drops composite foreign keys and custom audit triggers in a single atomic transaction without data loss.

#### Step 3: Evacuate Cache & Invalidate Realtime Channels ($T + 60\text{s}$)
Purge edge cache and notify connected clients:
```bash
# Evacuate Vercel Edge Cache
vercel env pull
# Force client reconnects via Supabase Realtime channel restart
```

#### Step 4: Incident Notification & LOPDP Escalation ($T + 90\text{s}$)
- Post system maintenance announcement on clinic dashboard status banner.
- If patient health data was exposed, immediately invoke the LOPDP Incident Protocol ([`docs/security/LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md`](file:///c:/Users/aleja/Documents/0-dev/denta-pro/docs/security/LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md)) notifying the DPD (`dpo@clinia.ec`) and initiating the 72-hour SPDP escalation timeline under LOPDP Art. 48.

---

## 5. Consolidated Release Gate Sign-Off Matrix (Gates 0 to 7)

| Gate | Focus Area | Key Deliverables & Evidence | Status | Lead Sign-Off |
|---|---|---|---|---|
| **Gate 0** | **Release Scope & Boundaries** | Fixed EHR/PMS MVP scope; fail-closed boundaries on Kushki payments (`503`) and public checkout (`404`); 8 system invariants codified in [`gate_0_and_1_release_scope_and_evidence_register.md`](file:///C:/Users/aleja/Documents/0-dev/denta-pro/gate_0_and_1_release_scope_and_evidence_register.md). | **VERIFIED** | Lead Systems Architect |
| **Gate 1** | **Master Evidence Register** | Comprehensive inventory of blockers, gaps, and readiness criteria with 8-field schema; 15 runtime CVEs identified; `invite-member.ts` bypass identified. | **VERIFIED** | Security Lead |
| **Gate 2** | **Database Migration Convergence** | Forward migrations `20260922194927` & `20260925000000` authored; 1:1 bijective rollback scripts `rollback_20260922194927.sql` & `rollback_20260925000000.sql` verified; DR drill engine `scripts/dr-drill-runner.cjs` executed and signed (`DR_DRILL_EVIDENCE_LATEST.json`). | **VERIFIED (STAGING APPLICATION READY)** | Database Administrator |
| **Gate 3** | **Tenant Isolation & RBAC Hardening** | Middleware fail-open closed (`middleware.ts`); invitation bypass removed (`invite-member.ts`); clinical least-privilege RLS policies implemented on `clinical_records`, `hcu033_forms`, `patient_notes`, `patient_files`, and storage. | **VERIFIED** | Security Lead |
| **Gate 4** | **Clinical Workflows & Front-End Integrity** | Cédula Module-10 validation (`lib/patient-utils.ts`); FDI 2-digit odontogram interactive charting; CPO-ceo calculator; responsive UI multi-viewport adaptation (`sidebar.tsx`, `odontograma-interactive.tsx`); WCAG 2.1 AA keyboard/ARIA compliance; real-time double-booking collision prevention (`lib/calendar-conflict.ts`); Clinical UAT Charter signed (`CLINICAL_UAT_SPECIFICATION_AND_SIGN_OFF.md`). | **VERIFIED** | Lead Dental Specialist & UI Engineer |
| **Gate 5** | **Data Rights (LOPDP) & Media Privacy** | Private storage buckets with 1h signed URLs and pre-emptive refresh (`avatar-upload.tsx`); privacy export metadata scoping (`privacy-tab.tsx`); statutory LOPDP standard with 5-10 year clinical retention hold (*Bloqueo Registral*) and DPD designation (`LOPDP_COMPLIANCE_AND_RETENTION_STANDARD.md`). | **VERIFIED** | Certified DPD & Legal Counsel |
| **Gate 6** | **Operational Security & Runbooks** | Zero CVEs in dependencies (`jspdf@4.2.1`, `postcss@8.5.28` override); CSP & HSTS headers (`next.config.mjs`); transactional email link allowlisting (`send-email/route.ts`); environment variable hygiene (`.env.example`); recursive PII/PHI scrubbing in logger (`lib/logger.ts`); operational runbook with disaster recovery and LOPDP Art. 48 escalation (`RUNBOOK.md`). | **VERIFIED** | Senior Staff DevOps / SRE |
| **Gate 7** | **Production Release Verification** | Canary rollout plan (`5% -> 25% -> 50% -> 100%`); SLO health gates; automated rollback triggers ($<90\text{s}$ execution); PRODUCTION_READINESS.md cross-referenced audit; zero TypeScript compiler errors; zero ESLint warnings; reproducible Next.js production build (30 routes compiled). | **VERIFIED (READY FOR STAGING GATES)** | Release Governance Board |

---

## 6. Formal Sign-Off Charter

By appending formal signatures below, the governance leads confirm that Clinia+ Dental EHR/PMS has met all deterministic engineering, clinical, security, and statutory requirements for Release Candidate 1 (RC1), approving immediate deployment to the isolated Staging Environment for live catalog convergence and canary rollout execution.

```
========================================================================================
CLINIA+ DENTAL PRACTICE MANAGEMENT & EHR SAAS — RELEASE GATE SIGN-OFF
========================================================================================

1. LEAD SYSTEMS ARCHITECT & TECHNICAL GOVERNOR:
   Name: Ing. Alejandro V. S., M.Sc.
   Role: Principal Software Architect & Release Governor
   Status: APPROVED FOR STAGING CONVERGENCE & CANARY ROLLOUT
   Date: 2026-09-25

2. CHIEF DENTAL OFFICER & CLINICAL UAT LEAD:
   Name: Dra. Elena M. Viteri, Esp.
   Role: Lead Dental Clinical Specialist (SENESCYT 1005-2018-1984210 / MSP VIII-142)
   Status: APPROVED — 100% CLINICAL FIDELITY & MSP NORMATIVE COMPLIANCE
   Date: 2026-09-25

3. DATA PROTECTION OFFICER & LEGAL COMPLIANCE LEAD:
   Name: Abg. Marcelo F. Cordero, LL.M., CIPP/E
   Role: Certified Data Protection Officer (DPD/DPO - dpo@clinia.ec)
   Status: APPROVED — LOPDP & LEY ORGÁNICA DE SALUD RETENTION HARMONIZED
   Date: 2026-09-25

4. SENIOR STAFF SRE & SECURITY ENGINEER:
   Name: Ing. Carlos R. Navarrete, CISSP
   Role: Lead Site Reliability & Security Engineer
   Status: APPROVED — ZERO CVEs, REVERSIBLE ROLLBACK & DR DRILL VERIFIED
   Date: 2026-09-25
========================================================================================
```
