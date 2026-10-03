# M7 clinical SaaS production acceptance

**Decision: NOT READY for production clinical data.** This is an implementation checkpoint, not a security or LOPDP certification. The forward migration is prepared locally and **has not been applied** to the connected Supabase project. Do not enable clinical onboarding based on a source or build pass.

## Changes prepared

- [Forward migration](../../supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql): composite patient/clinic foreign keys on every live patient-linked base table (appointments, prescriptions, clinical records, notes, files, HCU forms, rights requests, billings and invoices); equivalent guard for an optional legacy loyalty table and family representatives. Existing patient delete behavior is preserved. Doctor assignments must have an active role in the same clinic.
- Rights requests start pending, are visible only to the requester or active clinic owner, keep original request fields immutable, require a documented terminal outcome, and emit one status-only audit event through a fixed-search-path trigger. Duplicate legacy validation triggers are removed. Direct client audit-table writes are revoked.
- Clinic purge now refuses to remove a clinic with patient, rights-request or audit evidence. Archive age alone is not evidence that clinical records may be destroyed.
- [Privacy UI](../../components/settings/privacy-tab.tsx): checks the live clinic-owner role and records a pending request before bulk read; download is no longer called a completed rights fulfillment. Failed inserts surface as errors. Unsupported fixed retention/deadline claims were removed.

Read-only live preflight on 22 September 2026: zero mismatched clinic/patient pairs in the seven original clinical/rights tables, billings, invoices and family representatives; zero null clinic IDs in patients, appointments, prescriptions, HCU forms, billings and invoices. No patient rows, credentials or financial values were extracted. TypeScript check and production build passed locally, with unrelated lint warnings. CI must repeat them for the exact release commit.

## Acceptance tests still required on isolated staging

| Gate | Test and pass condition |
| --- | --- |
| Migration | Apply all migrations to a clean database and upgrade a clone of the current schema. Both converge; all new FKs validate, old single-column FKs are removed, one rights validation trigger and one status audit trigger remain. Reconcile local and deployed migration versions first. |
| Tenant integrity | With synthetic clinics A/B, direct PostgREST INSERT and UPDATE for each patient-linked base table reject clinic-A rows pointing to a clinic-B patient. Same-clinic writes and intended patient-delete behavior succeed. Test family and doctor references too. |
| Rights audit | Synthetic active owner resolves a pending request with nonempty outcome; exactly one audit row appears. Receptionist, demoted member and foreign-clinic actors cannot resolve it. Forged completed INSERT, terminal rewrite and missing outcome fail. Make audit INSERT fail inside a disposable transaction and verify the status update rolls back. |
| Clinical flows | Real browser/provider tests cover signup, invite, role removal, intake, chart, prescription, file upload/download and rights request/resolution. Verify both allowed and denied paths against the deployed revision, including stale JWT and Storage policy behavior. |
| Export | Verify owner-only UI, lower API row cap, over 1,000 rows, concurrent writes, and failed table fetches. Current JSON contains metadata for files, not attachment bytes; define patient-specific scope, secure delivery and a consistent snapshot before calling this complete portability fulfillment. |
| Operations | Demonstrate a restore of database **and Storage**, privileged-user MFA, leaked-password protection, Auth hook activation, service-key isolation, alerts and incident response, plus repeatable CI build/typecheck/lint/integration results. |
| Privacy | Approve controller/processor roles, legal basis and purpose inventory, notices, rights handling, transfers, and record-specific retention/legal holds with Ecuador counsel or accountable privacy lead. Record evidence and responsible owner. |

The connected Supabase project has no staging branch and local Docker/Postgres are unavailable in this workspace. Running synthetic authorization tests or an untested DDL migration against its production clinical database would be an unsafe substitute. Provision an isolated staging project/branch, run the table above, then plan a reviewed production migration with backup and rollback. **No production migration or clinical-data mutation occurred in this checkpoint.**

The client still has broad clinic-member SELECT access to some clinical tables, so hiding the export button from nonowners does not enforce least privilege. Review the role-to-data matrix and narrow RLS without breaking required receptionist/doctor workflows. The existing browser JSON export also lacks a server-side consistent snapshot and secure attachment delivery. These are release blockers, not cosmetic follow-ups.

Use [OWASP ASVS 5.0](https://owasp.org/projects/asvs) as the verification baseline. Ecuador privacy obligations should be signed off against the [Registro Oficial's LOPDP guidance](https://www.registroficial.gob.ec/267223-2/) and current [SPDP resolutions](https://spdp.gob.ec/resoluciones2/), rather than assuming a universal medical retention period.
