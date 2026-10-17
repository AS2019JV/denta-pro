# Original User Request

## 2026-09-20T18:41:01Z

Comprehensive remediation and verification of the 13 security vulnerabilities identified in the Codex Security evaluation (SECURITY_EVALUATION.md) across tenant isolation, database RLS policies, storage controls, clinical authorization, and backend APIs for DentaPro/Clinia+.

Working directory: c:/Users/aleja/Documents/0-dev/denta-pro
Integrity mode: development

Requested team: Full team of specialized agents with /boost for inspecting and executing the security remediation

## Verification Resources

- Security Evaluation & Threat Model: c:/Users/aleja/Documents/0-dev/denta-pro/SECURITY_EVALUATION.md
- Sealed Findings & Evidence: c:/Users/aleja/Documents/0-dev/denta-pro/docs/security/2026-09-19/findings.json
- Full Security Report: c:/Users/aleja/Documents/0-dev/denta-pro/docs/security/2026-09-19/report.md
- Scan Manifest: c:/Users/aleja/Documents/0-dev/denta-pro/docs/security/2026-09-19/scan-manifest.json
- Kushki Payment Regression Suite: c:/Users/aleja/Documents/0-dev/denta-pro/test/security-kushki.test.cjs

## Requirements

### R1. Tenant Boundary & Core Access Control Hardening (SEC-01 to SEC-06)
- SEC-01 & SEC-03: Secure clinic onboarding and membership enrollment so that new signups or uninvited users cannot claim ownership or membership of an existing clinic. Ensure clinic identifiers are generated in trusted code and joining an existing clinic strictly consumes an authorized, server-verified invitation.
- SEC-02: Restrict profile updates so users cannot self-assign privileged roles (clinic_owner, admin) or modify clinic_id.
- SEC-04: Secure the patient statistics RPC (p_clinic_id) to enforce caller clinic membership and clinical role authorization, preventing cross-tenant health record disclosure.
- SEC-05: Replace open storage bucket policies on patient-files with tenant- and patient-isolated policies (ensuring authenticated users can only read, write, or delete attachments belonging to their authorized clinic and patient).
- SEC-06: Authenticate and authorize the server invitation action (app/actions/invite-member.ts), validating that the caller is an active owner of the target clinic before issuing capabilities.

### R2. Clinical Privilege Separation & Multi-Tenant Data Integrity (SEC-07, SEC-12, SEC-13)
- SEC-07: Enforce clinical role boundaries on clinical record and prescription mutations, ensuring non-clinical roles (e.g. receptionists) cannot write prescriptions or alter clinical diagnoses.
- SEC-12: Correct service INSERT policies so that clinic owners can only insert services within their own clinic.
- SEC-13: Add tenant ownership and isolation to payment_methods, ensuring only authorized clinic owners can update bank and payment configurations for their specific clinic.

### R3. API, Maintenance, & Payment Hardening (SEC-08, SEC-09, SEC-10, SEC-11)
- SEC-08 & SEC-09: Secure the analytics view with security_invoker and tenant filtering, and revoke unauthenticated/unauthorized public execution privileges on maintenance RPCs (archive_clinic, purge_clinic_data, seed_default_services).
- SEC-10: Harden the email API route (app/api/send-email/route.ts) to require an authenticated session, recipient authorization, template restriction, and rate limiting.
- SEC-11: Finalize and verify the Kushki payment gateway patch (lib/kushki.ts) ensuring missing/placeholder credentials or provider errors never yield synthetic active subscriptions.

### R4. Migration Consolidation & LOPDP Alignment
- Consolidate database policies in forward migrations, avoiding permissive OR policy accumulation.
- Correct LOPDP statutory references (portability in Art. 17, elimination in Art. 15, automated decisions in Arts. 20–21) in privacy documentation and interfaces.

## Acceptance Criteria

### Tenant Isolation & Access Control
- [ ] Synthetic cross-tenant access attempts (accessing another clinic's patient records, stats RPC, files, or services) return denial with zero unauthorized data exposure or side-effects.
- [ ] Profile updates attempting to alter role or clinic_id are rejected or ignored unless executed via authorized administrative workflows.
- [ ] Unauthenticated calls to invite-member and send-email fail with 401/403.
- [ ] Storage policies for patient-files prevent reading, listing, or deleting files belonging to another clinic or unauthorized patient.

### Clinical & Financial Integrity
- [ ] Non-clinical roles (receptionist) are prevented from inserting/updating prescriptions and clinical records.
- [ ] payment_methods and services tables enforce strict clinic isolation on insert, update, and delete.
- [ ] Payment regression test suite (test/security-kushki.test.cjs) executes and passes all test cases offline without mock-to-active bypass.

## 2026-09-25T19:05:03Z

Execute an exhaustive, high-rigor Senior Staff Engineer code review and adversarial security/correctness verification of the Clinia+ Dental EHR/PMS release candidate across all proposed changes, migrations, and components in `c:/Users/aleja/Documents/0-dev/denta-pro`.

Requested team: Full multi-agent team: Exhaustive architectural, security adversarial, database RLS, and clinical compliance review

Working directory: c:/Users/aleja/Documents/0-dev/denta-pro
Integrity mode: development

## Requirements

### R1. Threat Model & RBAC Boundary Review
Conduct an adversarial audit of authentication, session scoping, edge middleware (`middleware.ts`), server actions (`app/actions/invite-member.ts`), and route handlers (`app/api/send-email/route.ts`, `app/api/payments/subscribe/route.ts`). Verify that:
1. No unauthenticated or under-privileged caller can execute clinical or administrative actions.
2. Receptionists are strictly denied read/write access to diagnostic and charting tables (`clinical_records`, `hcu033_forms`, `patient_notes`, `patient_files`).
3. Out-of-scope financial processing (Kushki gateway) and public checkout (`/pay/[id]`) strictly fail closed (`503 Service Unavailable` / `404 Not Found`).
4. Transactional emails enforce recipient clinic membership, trusted domain allowlisting, and 64KB/2048-char payload limits.

### R2. Database Catalog Constraints & RLS Mathematical Invariants
Evaluate live PostgreSQL forward migrations (`20260922194927`, `20260925000000`) and backward rollback scripts (`rollback_20260922194927.sql`, `rollback_20260925000000.sql`). Verify that:
1. Cross-tenant child record insertion is mathematically impossible via composite foreign keys `(patient_id, clinic_id) REFERENCES patients(id, clinic_id)`.
2. Cross-tenant clinician assignment is prevented by `security_internal.enforce_clinician_assignment` triggers.
3. Rollback scripts guarantee zero data loss and bijective 1:1 constraint restoration without dropping tables.
4. Review the staging live migration convergence proof in `docs/security/STAGE_MIGRATION_CONVERGENCE_EVIDENCE.json`.

### R3. Clinical Standards & Ecuadorian LOPDP Compliance Review
Verify compliance with Ecuadorian healthcare regulations:
1. Cédula national identity validation strictly enforces the official Module-10 verification algorithm (`lib/patient-utils.ts`).
2. Odontogram interactive canvas adheres to FDI 2-digit notation (ISO 3950) and Formulario HCU-033 MSP diagnostics.
3. Data portability exports under LOPDP Art. 17 are appropriately scoped to structured clinical metadata, documenting binary asset transfer separately.
4. Statutory medical record custody retention (Ley Orgánica de Salud Art. 7, 5–10 years) blocks premature hard deletion under LOPDP Art. 15.

### R4. Zero-Destruction & Strict Production Isolation
1. Zero mutations against production database `leqsrfyjvuxxdsubjjin`.
2. Strictly preserve all 27 original uncommitted working tree files in the repository.

## Acceptance Criteria

### Objective Automated Verification
- [ ] TypeScript type safety passes with zero errors (`npx tsc --noEmit` exits with 0).
- [ ] Code hygiene and linter passes with zero errors (`npm run lint` exits with 0).
- [ ] Next.js 15 production build compiles all 30 routes successfully (`npm run build` exits with 0).
- [ ] Complete automated security test suite maintains 100% pass rate (`node --test test/security/*.test.cjs` passes 850/850 tests).

### Review Deliverable
- [ ] Deliver a structured Senior Staff Review Report covering:
  - Architecture & Modularity assessment.
  - Threat model & RBAC boundary verification.
  - Database schema, RLS, and migration reversibility analysis.
  - Clinical and regulatory compliance assessment (Ecuador LOPDP / MSP).
  - Explicit production deployment verdict (Approve / Request Changes / Block) aligned with `PRODUCTION_READINESS.md`.

