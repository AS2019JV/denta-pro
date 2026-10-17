# Clinia+ security evaluation and remediation plan

Date: 2026-09-19 (Ecuador). Scan ID: `05a297c3-241f-4cbe-a863-45671a0b68f1`.
Baseline revision: `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, including the existing uncommitted working-tree changes.

## Decision

**Do not approve production handling of real patient data on the strength of the reviewed source.** Resolve the tenant-boundary failures and verify the actual deployed controls first. This is a source-backed release recommendation, not evidence that a breach occurred.

Codex Security finalized **13 findings: 6 high, 6 medium, 1 low**. Whole-repository coverage is **partial**: 72 source/configuration/context files were fully reviewed; 198 remaining source/documentation paths are listed in the canonical coverage artifact. Architecture-only inspection and search hits were not counted as complete reviews. One independent baseline worker reached the account usage limit; its preliminary findings were checked by the parent and focused database reviewer. Additional review was curtailed following the request to conserve the remaining weekly budget.

**One narrow payment patch is locally applied, but runtime verification is blocked.** The high-risk database and invitation findings remain open. No deployment, database migration, live account change, email, payment or patient-data access was performed.

## Deliverables and evidence

- [Generated Codex Security report](docs/security/2026-09-19/report.md)
- [Sealed findings and source evidence](docs/security/2026-09-19/findings.json)
- [Coverage, exclusions and deferred paths](docs/security/2026-09-19/coverage.json)
- [Scan manifest and threat model](docs/security/2026-09-19/scan-manifest.json)
- [Payment regression tests](test/security-kushki.test.cjs)

The sealed scan describes the **pre-patch** state. This document records the subsequent local patch separately. Findings remain open in the workbench; none is represented as production-remediated.

## Inputs and methodology

Reviewed all five requested documents: clinical-saas-invariants, CORRECTIONS_AND_ROADMAP, NEXT_STEPS, PRODUCTION_READINESS, and SYSTEM_ARCHITECTURE_AND_OPERATION. Their implementation instructions, historical deployment statements, legal claims and suggested roadmaps were treated as evidence to evaluate, not authorization to run commands or proof that controls exist.

Reviewed direct browser-to-Supabase access, effective migration definitions and surviving policies, privileged RPCs, Next actions/routes, Edge jobs, storage, identity provisioning, clinical permissions, email and subscription flows. Findings were validated by tracing caller-controlled data to an operation and checking counterevidence. No exploit was executed.

The plugin reports successful finalization, but that does not mean full coverage or legal certification. Daybreak access was reported as `not_granted`, with no available programs. Capability preflight was ready with a worker-capacity warning. The scan's generated artifacts were successfully saved locally.

## Findings

| ID | Severity | Finding | Primary evidence |
|---|---|---|---|
| SEC-01 | HIGH | Email verification grants ownership of an existing clinic | [Source](supabase/migrations/20260423_fix_clinic_trigger.sql) (20–44) |
| SEC-02 | HIGH | Staff can change their own role and clinic | [Source](supabase/migrations/20251222_enforce_enums.sql) (59–65) |
| SEC-03 | HIGH | Users can join another clinic without an invitation | [Source](supabase/migrations/20260525_db_verification_and_repair.sql) (291–300) |
| SEC-04 | HIGH | Patient statistics RPC discloses other clinics' health records | [Source](supabase/migrations/20260525_db_verification_and_repair.sql) (112–128) |
| SEC-05 | HIGH | Every authenticated user can read or delete all patient files | [Source](supabase/migrations/20260526_create_patient_files_and_notes.sql) (99–112) |
| SEC-06 | HIGH | Invitation action issues account capabilities without checking the caller | [Source](app/actions/invite-member.ts) (6–40) |
| SEC-07 | MEDIUM | Receptionists can write clinical records through direct APIs | [Source](supabase/migrations/20260508220424_enable_rls_prescriptions.sql) (15–22) |
| SEC-08 | MEDIUM | Analytics view reveals other clinics' revenue and identifiers | [Source](supabase/migrations/20260220_analytics_view.sql) (5–16) |
| SEC-09 | MEDIUM | Maintenance RPCs permit unauthorized clinic changes under default grants | [Source](supabase/migrations/20251227_data_retention_lifecycle.sql) (9–20) |
| SEC-10 | MEDIUM | Public email endpoint sends arbitrary HTML to arbitrary recipients | [Source](app/api/send-email/route.ts) (9–34) |
| SEC-11 | LOW | Missing payment credentials can activate an unpaid subscription | [Source](lib/kushki.ts) (73–83) |
| SEC-12 | MEDIUM | A clinic owner can insert services into another clinic | [Source](supabase/migrations/20260401_fix_admin_roles.sql) (37–41) |
| SEC-13 | MEDIUM | Authenticated users can change shared bank-payment configuration | [Source](supabase/migrations/20251214_billing_enhancements.sql) (56–61) |

Severity reflects impact, prerequisites and realistic reachability. Live migration state, owners, grants and external configuration are unknown; a confirmed source defect is not automatically confirmed production exposure.

### SEC-01 — Email verification grants ownership of an existing clinic

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

**Required fix:** Generate clinic identifiers in trusted code; never grant ownership after an ignored insert. Existing-clinic joins must consume an authorized invitation.

**Limits/counterevidence:** Fresh account with verified attacker-controlled email, known victim UUID, installed verification trigger. No custom token hook is needed for this path. The existing-profile guard blocks already assigned users, not fresh signups. clinics.owner_id is not overwritten; JWT-based authorization nevertheless grants owner capabilities.

### SEC-02 — Staff can change their own role and clinic

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

**Required fix:** Allow updates only to safe profile columns. Route role, tenant, membership and status changes through tenant-authorized server operations and revoke stale sessions.

**Limits/counterevidence:** Authenticated user; current policies and grants applied. JWT-based escalation additionally requires the documented Auth hook. Enums validate values, not authority. No protecting column revoke or trigger was found. The direct profile consumers remain relevant without the hook.

### SEC-03 — Users can join another clinic without an invitation

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

**Required fix:** Remove self-enrollment and consolidate patient policies. Create memberships through verified owner invitation acceptance with server-selected role/clinic.

**Limits/counterevidence:** Authenticated profile, victim UUID and effective INSERT table privilege; Supabase default grants must be confirmed live. Later JWT patient policies have different names; permissive policies combine with OR. Foreign keys prove existence only.

### SEC-04 — Patient statistics RPC discloses other clinics' health records

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

**Required fix:** Use SECURITY INVOKER with corrected RLS or enforce trusted membership and clinical role inside the function; restrict EXECUTE and bound pagination.

**Limits/counterevidence:** Authenticated caller, known tenant UUID, applied function and usual privileged migration owner. Search, pagination and soft-delete filtering are not tenant authorization. Earlier overloads are dropped; the secure profile RPC is a separate unused guard.

### SEC-05 — Every authenticated user can read or delete all patient files

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

**Required fix:** Bind objects to an authorized clinic and patient on every operation; use private signed downloads and retention-aware deletion with direct two-tenant Storage tests.

**Limits/counterevidence:** Applied policies and patient attachments in the bucket. Private bucket status requires authentication but does not establish tenant isolation; patient_files metadata RLS is a separate control.

### SEC-06 — Invitation action issues account capabilities without checking the caller

The current team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

**Required fix:** Authenticate the action, authorize immutable owner membership for the target clinic, allow only staff roles, deliver the capability to its intended recipient only, and check every persistence result.

**Limits/counterevidence:** Reachable Next server action with configured Supabase service key. An ordinary signed-in caller suffices to pass navigation guards. The separate Edge invite handler has checks but is not this action. Existing-user behavior and invalid profile status pending limit takeover claims; unauthorized account invitation and token disclosure are supported.

### SEC-07 — Receptionists can write clinical records through direct APIs

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

**Required fix:** Apply doctor/owner authorization at database write boundaries, validate prescriber identity and same-tenant patient/doctor relationships, and provide receptionist-safe read projections.

**Limits/counterevidence:** Valid same-clinic JWT and effective table grants. Clinical-role separation is an explicit product requirement. Owner-only prescription DELETE and clinical_records role checks do not protect these sibling tables. Impact is limited to the caller clinic absent separate escalation.

### SEC-08 — Analytics view reveals other clinics' revenue and identifiers

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

**Required fix:** Use security_invoker and corrected underlying tenant/role policies, or an explicitly authorized aggregate RPC.

**Limits/counterevidence:** Usual privileged migration owner; applied view and expected billing columns. January security_invoker migration changes only receptionist_patient_view and recall_queue, before this view is created.

### SEC-09 — Maintenance RPCs permit unauthorized clinic changes under default grants

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

**Required fix:** Revoke maintenance EXECUTE from PUBLIC/anon/authenticated, allow authorized service execution only, and enforce retention/legal hold inside purge. Separately authenticate scheduled Edge callers.

**Limits/counterevidence:** Effective attacker EXECUTE under default PostgreSQL PUBLIC function privileges; confirm actual ACLs and function owners. Purge does not reliably delete populated clinics because non-CASCADE FKs block it. JWT caching can delay archival effects. Explicit external grant hardening could remove reachability.

### SEC-10 — Public email endpoint sends arbitrary HTML to arbitrary recipients

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

**Required fix:** Require verified tenant/role, resolve recipients from authorized records, render bounded server templates and enforce tenant/user quotas; use a separately constrained public contact endpoint if needed.

**Limits/counterevidence:** Deployed route with configured Resend API key and sender. Missing key returns 503; no handler authentication, recipient ownership, template restriction or quota is present.

### SEC-11 — Missing payment credentials can activate an unpaid subscription

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

**Required fix:** Reject missing or placeholder merchant credentials before a request; never translate provider errors into successful subscriptions. Test invalid credentials, provider rejection and a valid response offline.

**Limits/counterevidence:** Authenticated caller with RLS-visible clinic; missing merchant credential while Supabase admin configuration is available. Configured real merchant credentials rethrow failures. This is configuration-dependent financial integrity impact; no payment fraud was executed.

### SEC-12 — A clinic owner can insert services into another clinic

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

**Required fix:** Replace global role-only policies with trusted target-clinic ownership checks and consolidate the policy set.

**Limits/counterevidence:** Owner profile, victim UUID and deployed services INSERT privilege. The tenant-bound FOR ALL policy does not restrict another permissive INSERT policy. Do not infer all cross-tenant UPDATE/DELETE operations without SELECT visibility.

### SEC-13 — Authenticated users can change shared bank-payment configuration

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

**Required fix:** Add tenant ownership with a reviewed backfill; restrict configuration writes to that clinic's owner, hide secrets server-side and verify patient payment rendering uses only authorized clinic methods.

**Limits/counterevidence:** Effective table grants and use of the payment_methods feature; live deployment is unverified. The later payments table replacement fixes a different table, not payment_methods. No proof of actual misdirected payments is claimed.

## Local remediation and verification

**SEC-11: locally patched; verification outcome blocked.**

Changed [lib/kushki.ts](lib/kushki.ts) to reject missing, blank or known placeholder merchant credentials before calling the provider. Removed synthetic successful subscriptions from the failure path and removed payment-payload logging. Configured UAT/production destination selection and successful response forwarding remain unchanged.

The only active consumer, `app/api/payments/subscribe/route.ts`, awaits this gateway before updating the clinic and inserting a successful payment. Static review shows that a thrown configuration/provider failure takes its error path before those mutations. This does not validate the correctness of the actual Kushki endpoint, provider response contract, webhook protocol, or whole payment integration.

[Eight offline regression cases](test/security-kushki.test.cjs) cover missing/blank/placeholder keys, provider denial, network failure, and valid UAT/production request/response contracts. They compile the real gateway into an isolated VM and mock all network calls.

| Check | Result |
|---|---|
| Focused TypeScript check of gateway | Passed |
| Security regression execution | Blocked: Node test worker returned `spawn EPERM`; escalation was declined |
| Proof that original failure no longer reproduces at runtime | Not obtained |
| Valid provider-flow runtime control | Not run; mocked tests prepared |
| Patch-only whitespace check | Passed |
| Regression test file syntax | Passed (`node --check`); this does not execute the tests |
| Repository-wide whitespace review | Existing unrelated whitespace issues found; preserved |
| Full build, full typecheck/lint, end-to-end journeys | Not run; no claim of application-wide correctness |

Commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2022 --module commonjs lib/kushki.ts
node --test test/security-kushki.test.cjs
git diff --check -- lib/kushki.ts
```

No independent post-patch worker was started after the usage-limit failure. A separate local review checked the sole consumer, success/error branches, alternate missing-key representations and preservation of configured provider behavior. Runtime tests are still required before closing SEC-11.

## Ordered remediation work

| Stage / owner | Work | Acceptance evidence |
|---|---|---|
| **Before real-data release — backend/security** | Fix SEC-01 through SEC-06 together: trusted onboarding, protected authority fields, authorized membership, tenant-bound RPCs/storage and invitation action. | Synthetic clinic A/B tests through direct Auth, REST, RPC and Storage APIs; unauthorized calls deny without side effects, authorized clinical work still succeeds. |
| **Before release — database lead** | Inventory live `pg_policies`, function ownership/ACLs, view options, column grants, trigger definitions, hook activation and applied migrations. Replace conflicting permissive policies in a new forward migration. | Reviewed catalog snapshot, repeatable clean setup, migration rehearsal and rollback/restore drill. No assumption that later policies override earlier ones. |
| **Before release — clinical/backend** | Implement SEC-07 role and authorship checks; bind every patient/doctor/clinic relationship with appropriate constraints. | Receptionist cannot alter diagnosis, chart or prescription via raw APIs; doctor can save/reopen/chart/prescribe; owner can administer only own clinic. |
| **Before release — platform/backend** | Repair SEC-08/09/12/13; secure scheduled Edge callers; restrict the email endpoint; validate SEC-11 patch. | View/RPC/maintenance/payment-setting denial tests, missing-key failures, provider UAT tests, job authentication and audit evidence. |
| **Next milestone — privacy owner and counsel** | Complete LOPDP governance and operational rights/retention work below. | Approved records, contracts, rights-request evidence, incident exercise and retention policy. |
| **Next milestone — QA/platform** | Restore meaningful type/lint/build gates, dependency review and browser smoke tests. | Passing CI, versioned dependency evidence, measured recovery and performance results. |

Do not run a blanket SQL patch against production. The supplied schema/migrations disagree about columns and manual setup. For example, HCU consumers expect `clinic_id`, but the base HCU table does not define it; the service-seeding action queries `clinic_memberships` while migrations define `clinic_members`. Resolve the live schema before writing a coordinated forward migration.

## LOPDP: mandatory work and corrections

**Correct the legal references.** Published LOPDP identifies portability in Article **17**, elimination in Article **15**, and automated decisions in Articles **20–21**. The supplied files and privacy UI mislabel these provisions. A clinic-wide JSON backup is not automatically an individual patient's rights response. [LOPDP, official SPDP copy](https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf).

Do not treat a generic consent checkbox or an assumed “5–10 years” as legal sign-off. Establish the lawful basis, health-data conditions, purpose and retention for each processing activity with Ecuadorian counsel. Preserve medical custody and legal holds; separate account cancellation, restricted access and lawful destruction. The 90-day purge must not determine medical retention by itself.

| Priority | Repository evidence / gap | Required implementation and organizational evidence |
|---|---|---|
| Release blocker | Tenant and role failures expose sensitive health data. | Close access-control findings, document roles and access reviews, test revocation and recovery. |
| High | Patient intake stores a consent boolean; no complete versioned evidence workflow established. | Record applicable purpose/basis, notice version, representative authority where needed, timestamp and withdrawal/objection handling; distinguish care and marketing. |
| High | Privacy archive handler only shows a success toast; nothing is submitted. | Persist a rights/restriction request, give a reference, assign an owner, track response and lawful exceptions; stop claiming a request was registered until it was. |
| High | JSON export ignores Supabase query errors/pagination and omits prescriptions, notes/files and other relationships. | Build verified per-patient rights export separately from full clinic backup; authorize, paginate, check every result, include manifest/counts, protect delivery and audit downloads. |
| High | Purge SQL omits age enforcement; clinical storage permits hard deletion. | Approved record-specific retention matrix, legal holds, deletion approval/evidence, backup expiry and tested recovery. |
| High | Current patient screens bypass the audit-enforcing read RPC; logs duplicate full clinical rows. | Coverage for relevant reads, mutations, exports and privilege changes; trusted actor identity, minimal audit content, restricted access and retention. |
| High | Provider locations, contracts and roles were not reviewed. | Map clinic/platform/provider responsibilities, processing agreements, subprocessors, support access and actual international data flows. |
| High | DPD, risk assessment and breach process not evidenced. | Assess DPD/designation and large-scale rules, maintain a processing inventory and impact assessment, define incident triage and legally verified notification duties. |
| Medium | Loyalty automation records “sent” without delivering and returns names to its caller. | Secure job invocation; make delivery status truthful; minimize patient details; implement marketing preference and objection controls before activation. |

Current SPDP materials include the [risk/impact assessment guide](https://spdp.gob.ec/resolucion-n-spdp-spd-2025-0003-r-guia-de-gestion-de-riesgos-y-evaluacion-de-impacto-del-tratamiento-de-datos-personales-con-su-anexo/) and [DPD regulation](https://spdp.gob.ec/resolucion_028/). The [official resolutions register](https://spdp.gob.ec/resoluciones2/) also lists 2026 rules for international communications/transfers, large-scale processing and AI. Review the final instruments applicable to the actual operation rather than relying on older project notes. The regulator's [2026 consultation material](https://spdp.gob.ec/consultas2026/) distinguishes processing arrangements from transfers; overseas hosting should therefore be legally classified, not automatically assigned a transfer mechanism. Consultation answers are guidance, not a substitute for the applicable rules.

Use LOPDP as the immediate legal baseline. Keep GDPR/HIPAA applicability as a separate market/contract assessment if expansion requires it; this evaluation does not certify either regime.

## OWASP alignment and security trends

Use **ASVS 5.0.0** as a versioned verification baseline; propose Level 2 across this authenticated healthcare app and stronger verification for privileged identity, clinical data and cryptographic controls. This is a recommendation, not an ASVS certification. [Official ASVS](https://owasp.org/projects/asvs).

Map the findings primarily to **A01:2025 Broken Access Control**, with configuration, insecure design and exceptional-condition handling concerns. OWASP's current release is [Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/); the Top 10 is an awareness taxonomy, not a complete test suite.

Recurring patterns to prevent:

1. **Policy accumulation:** permissive PostgreSQL policies OR together. Test the entire effective policy set after every migration.
2. **Authority from editable data:** profile/user metadata must not be the writable source of tenant or owner privileges.
3. **Privileged alternate paths:** a secure Edge endpoint does not secure a separate Next server action or direct RPC.
4. **UI claims outrunning implementation:** “private,” “audited,” “sent,” “backup complete” and “request registered” require backend evidence.
5. **Failure treated as success:** payment mocks, ignored query errors and partial writes must not become successful business state.
6. **Supply-chain verification:** installed Next is 15.5.12; a fresh dependency advisory audit was not performed. Pin/review lockfile changes, maintain an SBOM and fix applicable advisories through controlled upgrades. Do not run automatic force-upgrades.

## Smooth-operation release checks

Use synthetic records and two clinics, with owner, doctor and receptionist accounts. Test direct API denials as well as UI paths.

- Signup and email verification create a fresh clinic; invited users join only the authorized clinic.
- Receptionist registers a patient and books a visit; clinician charts HCU/odontogram and issues/reprints a prescription; authorized exports are complete.
- Tenant switching and logout clear relevant cached data; query keys include user/clinic where necessary.
- Concurrent appointment requests cannot double-book merely because both screens were stale; Realtime alone is not a database concurrency control.
- Private attachments use authenticated/signed downloads and remain recoverable under the retention policy.
- Query failures produce actionable errors, never empty-success exports; measure list/export latency at realistic volumes.
- Rehearse backup restoration, session revocation, expired subscriptions and network/provider outages without losing clinical work.

Unresolved follow-ups include unsafe `next` navigation handling in the confirmation page, middleware cookie-session fallback and user-metadata roles, webhook signing/replay/atomicity, direct audit insertion attribution, owner-writable subscription fields, avatar/receipt policies, and production secret/header/MFA configuration. These are **not additional validated findings** in this scan.

## Usage and limits

Plugin-reported scan usage: 7,125,676 aggregate tokens across 4 tasks, including 6,504,832 cached input tokens; source `codex_rollout`. This aggregation includes repeated/cached context and is not a measurement of remaining weekly quota. Post-scan report/patch work is outside that measurement.

The user’s existing changes were preserved. No claim is made that the whole app is secure, compliant, performant or fully tested. Close the release blockers using deployed-state evidence and the acceptance checks above.
