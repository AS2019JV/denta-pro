# Production release gate — post-M6 verification

**Verdict: NOT READY for production clinical data.** M6 fixes the previous three blockers at the inspected control level, but two additional concrete defects and missing release evidence prevent approval.

Date: 22 September 2026. Supabase project: `leqsrfyjvuxxdsubjjin`. Confirmed deployment: `20260922184028_m6_security_hardening_and_contract_fix`. This supersedes the previous M5 review's current-status conclusions and challenges the attached reports' blanket “28/28 / production ready” claim.

## Verified improvements

- All five broad patient-photo/receipt policies are absent from the live catalog.
- The patient RPC now executes successfully for a NULL-clinic administrative probe and returns zero rows. This confirms the previous SQL compilation failures are resolved, not that all patient workflows pass.
- Prescriptions and patient-file policies now use live membership/role checks. The inspected helpers deny explicitly inactive membership.
- Local export pagination uses ordered IDs and advances by actual returned rows; local build configuration enables TypeScript/lint gates.

Method: focused Codex Security fix verification plus live Supabase catalog review and one read-only RPC probe. No patient records, object names, credentials or financial data were retrieved. No application/database changes were applied. [Evidence](M6_RELEASE_GATE_EVIDENCE_2026-09-22.json).

## Exact corrections required

### R1 — High: bind child records to a patient in the same clinic

**Evidence:** live `appointments`, `prescriptions` and `clinical_records` have independent `clinic_id → clinics(id)` and `patient_id → patients(id)` foreign keys. There is no composite patient/clinic constraint. Appointments/prescriptions have no user trigger enforcing this relationship. Their RLS checks authorize the caller's clinic, not the referenced patient's clinic.

A clinic-A user who knows a clinic-B patient UUID can submit an appointment or prescription with clinic_id=A and patient_id=B. The clinic authorization and separate foreign keys do not reject that inconsistent relationship. This establishes a clinical integrity risk; no cross-tenant write was attempted. Local patient-statistics subqueries also associate appointments by patient_id without a clinic predicate, increasing the risk of mixed clinical results.

**Implement in a new forward migration:**

1. Inventory inconsistent child/patient relationships using counts initially; resolve any affected records through authorized clinical review. Do not silently reassign or delete records.
2. Add a unique constraint on `patients(id, clinic_id)`.
3. Add composite foreign keys `(patient_id, clinic_id) REFERENCES patients(id, clinic_id)` to appointments, prescriptions and clinical_records. Use NOT VALID during staged deployment if needed, then VALIDATE before release. Preserve each table's existing deletion behavior; do not introduce new cascades.
4. Require non-null clinic_id for tenant-owned clinical records. Preserve nullable patient_id only where the documented workflow permits it.
5. Apply the same relationship rule to patient_notes, patient_files and HCU forms after inspecting their existing constraints/triggers. Validate assigned doctor membership in the same clinic separately; a profile ID existing is insufficient.
6. Add explicit clinic predicates to child-record queries in `get_patients_with_stats` and `get_family_unit_with_stats` as defense in depth.

**Pass criterion:** direct PostgREST INSERT and UPDATE using an authorized clinic-A actor and clinic-B patient fail; valid same-clinic appointments/prescriptions succeed. Verify database rows and patient summaries, not just response codes.

[PostgreSQL multicolumn foreign-key constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) provide a database-enforced relationship; parent-table RLS does not substitute for this consistency rule.

### R2 — Medium / release-blocking: repair the rights-request audit path

Three live inconsistencies:

- Both `trg_protect_data_requests_immutability` and `trg_protect_data_rights_requests` run the same BEFORE UPDATE function, creating duplicate execution.
- `protect_data_rights_requests()` references `NEW.resolution_notes`, but the live table has no resolution_notes column. Its terminal-state branch will fail when that expression is reached.
- The function is SECURITY INVOKER and inserts into `logs.access_audit`. Authenticated has table INSERT but lacks USAGE on the logs schema, so ordinary-user status transitions cannot use that append path.

These conclusions come from live definitions/schema/grants; production rights requests were not mutated.

**Implement:**

1. Add `public.data_rights_requests.resolution_notes text` if retaining the intended resolution workflow.
2. Drop both old trigger names before creating exactly one validation trigger.
3. Keep field/terminal-state validation in the BEFORE trigger. Move audit append to one AFTER UPDATE trigger limited to `OLD.status IS DISTINCT FROM NEW.status`.
4. Give the audit trigger a dedicated SECURITY DEFINER function, fixed search_path and a narrowly privileged owner with access to the audit table. Derive actor identity from auth.uid(); never use function-owner identity to bypass authorization. Revoke direct client INSERT/UPDATE/DELETE on the audit table rather than exposing log writes to fix the permission error.
5. Enforce server-controlled initial request status/resolution fields as well as UPDATE transitions; block forged completed requests through direct INSERT.
6. Ensure audit failure aborts the status transition and that legitimate resolution is not blocked by schema/permission mismatches.

**Pass criterion:** an authenticated owner can resolve a pending synthetic request, exactly one audit event is created, foreign-clinic/receptionist resolution is denied, terminal fields cannot be rewritten, and an audit-write failure rolls back the transition.

## Required release evidence — not newly claimed vulnerabilities

The reported 503 passing assertions do not replace deployment tests. `test/security/m6-verification.test.cjs` checks migration/source strings. No real end-user integration evidence was established in this review.

| Gate | Exact deliverable before clinical launch |
|---|---|
| Real authorization tests | Staging with actual migrations, synthetic clinics A/B and owner/doctor/receptionist/removed/suspended/anonymous actors. Exercise PostgREST and Storage directly; test stale tokens, role demotion, protected profile columns, related-patient mismatches and legacy/new file paths. |
| Working clinical flows | Signup/confirmation, invite acceptance, member removal, patient intake/list/detail, charting, prescription, file upload/download and rights resolution. Both denial and positive paths must pass. |
| Export reliability | Test >1000 records, lower API row caps and concurrent updates. Use a defined consistent snapshot/export job if consistency is promised. Label metadata-only exports accurately; define attachment delivery and patient-specific rights scope. |
| Repeatable release | Reconcile local versus deployed migration versions; prove clean install and upgrade converge. Run strict typecheck/lint/build and real integration tests for the exact deployed revision. Record results in CI or an equivalent reproducible release script. |
| Account/operational security | Verify Auth hook activation, MFA for privileged users, leaked-password protection, service-key isolation, backup restore including Storage, alert ownership and incident response. Keep email quotas in shared storage rather than per-process Maps. |
| LOPDP readiness | Obtain documented controller/processor roles, purpose/legal-basis mapping, privacy notices, rights response procedure, international-transfer assessment and record-specific retention/legal holds. Code tests do not certify these. Reuse the earlier review's official references; do not infer a statutory retention period from a purge timer. |

Refreshed Supabase notices: 7 mutable search paths, 9 anonymous-executable definer notices, 16 authenticated-executable definer notices, and leaked-password protection disabled. Triage functions individually; these counts are not a count of proven vulnerabilities. [Search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Completion rule

Implement R1 and R2, pass their integration tests, then close the release-evidence gates against the actual deployment. That is the remaining scoped plan; another blanket “all fixed” report or source-string test pass is insufficient.

This is a focused reassessment, not an exhaustive security certification. Financial processing remains outside approval; transfer receipts still require private, tenant-scoped handling.

