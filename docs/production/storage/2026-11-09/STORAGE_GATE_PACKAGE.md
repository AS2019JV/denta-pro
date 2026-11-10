# Storage gate — bounded product containment and remaining strict revocation proof

Status: PARTIAL. This package does not close the original provider/CDN incident.
Scope: master prompt Task1 and Task4; synthetic data only. No Production, provider purge, object deletion, signing-key rotation, database migration or external opening is part of this application patch.

## Product identity and integration

Authoritative remote: https://github.com/AS2019JV/denta-pro.
The demo under tmp/clinia-mvp-synthetic is a Git worktree of this same repository, not a separately maintained demo application. Its .git resolves to the root repository common Git directory.
Base application candidate: c28dfaa5393145e3283f94b5e168886e21630135 on codex/clinia-mvp-synthetic.
Root main and merge-base: f96fbb898ec2a0615dec293ee3e5ce0a9b41b170. Main has unrelated owner changes and is preserved.
Implementation worktree: C:/Users/aleja/.codex/worktrees/clinia-storage-strict/denta-pro, branch codex/clinia-storage-gateway.
Integration target for this patch: the existing application release branch codex/clinia-mvp-synthetic and its authorized protected Preview. Main integration remains a later release operation; no claim of a main merge.

## Two different failures, preserved separately

1. Original strict revocation failure: staging project phihonofwyerpfgqfekt. A warmed provider request still returned 200/HIT and 70 fixture bytes after revocation/expiry while application authorization denied access. Primary historical references:
   - docs/production/evidence/2026-10-03-hosted-api/attempt-1/storage-revocation-1791067679417.json
   - provider-cache-adversarial-review.json and provider-cache-expiry-1791237476423.json (Coordinator holds exact custody locator).
   - docs/production/evidence/2026-10-06-legacy-storage-retirement/legacy-replay-replay-1791323646955-82ba27b8.json: 43 planned exact-path responses denied; signed-token/nonces/credential capture gaps preserved. This is PARTIAL, not universal CDN eviction or current proof.
2. Synthetic MVP postcheck deviation: authenticated SELECT storage.objects returns42501 on excluded public.billings instead of zero rows. Reproduced read-only on clinia-test. Primary reference:
   docs/production/mvp/2026-10-30-clinia-test-reuse/backend/STORAGE_EXECUTION_20261101.RESULT.json.
   A separate local-only proposal exists in codex/clinia-storage-strict commit9d8d4e93f8c62f4e3c1d956c78ea1bf22c38eee2. Its PostgreSQL rehearsal passed20 cases after two preserved harness failures. It is not integrated or applied by this package and cannot close failure1.

## Test target and observed contract

Only authorized hosted target: clinia-test, fbtlldubzomocuhpvweg, DBpostgres, PostgreSQL170011, system identifier7692130048193495360; executor/sessionpostgres, non-superuser.
Read-only metadata observed: 23 storage.objects policies including restrictive false closure; five buckets (four private, one public brand_public); four metadata objects (three private). No object names, contents or private credentials were exported.
Authenticated has no SELECT/INSERT table privilege on billings, patient_files or prescriptions; no document/private-media/prescription functions were found in public; deployed Edge Functions list is empty.
Consequently, positive document-gateway tests cannot be admitted merely by setting a frontend flag. The required file metadata, narrow RPC/role/policy contract must first be reconciled and separately reviewed.
Production website is identified by the owner/Coordinator as www.cliniaplus.com. Its Supabase binding is NOT VERIFIED; do not infer it from staging/test refs.

## Implementation

The existing gateway is retained: current identity and claims, active session, profile, current role and clinic entitlement, exact persisted resource ownership/path, bounded origin download, second authorization before publication, private/no-store intermediary headers, and rejection of ranges/conditional requests. Existing source and historical proof are reused within their actual scope.

This patch adds default closure outside pilot mode too:
- lib/pilot-policy.ts: shared closed capability, noncacheable denial headers and exact two-API path classifier.
- middleware.ts: server-side closure and explicit matchers for document paths including static-looking suffixes.
- app/api/clinical-documents/route.ts and app/api/private-media/route.ts: independent denial before credentials/provider effects.
- app/actions/save-prescription.ts: issuance closed before cookies/DB access.
- lib/pdf-client.ts: all four active PDF publication entry points closed before import/clinical reads.
- components/patient-files.tsx and components/avatar-upload.tsx: unavailable state, no file upload controls/effects when not opted in. These are UX guards, not a substitute for server/DB authorization.

QA admission requires ALL of:
NEXT_PUBLIC_CLINIA_FILES_QA=1, exact clinia-test URL, CLINIA_FILES_QA=1, VERCEL_ENV=preview.
These variables are not credentials. Defaults remain closed. No values are configured by this patch.
The narrow file-API exception can coexist with synthetic pilot mode; billing, payments, recipes, operational email and other exclusions remain blocked. PDF/issuance retain their synthetic guard. No flag may be treated as evidence or permission to expand the backend.
Production server responses remain closed even if these QA flags are mistakenly set.

## Execution-path inventory

| Capability/source | Current authority | Sink/access | Gate disposition |
|---|---|---|---|
| PatientFiles download / lib/clinical-document-client.mjs | Same-origin request, current-scope cancellation; server independently verifies caller | POST /api/clinical-documents -> ordinary metadata/RLS -> session-JWT S3 transport | Closed by default; positive hosted contract on clinia-test BLOCKED |
| Document gateway app/api/clinical-documents/route.ts | Auth getUser/getClaims, live session, active profile, clinician role, subscription, exact clinic/patient/file; repeat before publication; broker active and audit | lib/clinical-document-delivery.mjs -> lib/storage-origin.ts; no reusable provider URL returned | Existing gateway retained; its strict hosted matrix must be rerun on admitted candidate |
| Images/logos/previews hooks/use-private-media.ts and private-media-client.mjs | Current UI scope and cancellation; ordinaryPrivateMediaAuthority checks session/profile/role/entitlement and exact canonical reference | POST /api/private-media -> bounded session-JWT S3 -> checked PNG/JPEG/WebP blob | Closed by default; no direct provider retrieval in active client code |
| PrivateMedia server gateway | Ordinary authenticated caller, live DB entitlement/RLS; repeat authorization before bytes | private-media-delivery.mjs/private-media-transport.ts/storage-origin.ts | Existing behavior retained; denied requests must not publish clinical bytes |
| PatientFiles select and drag/drop upload | UI scope plus canonical backend table/Storage RLS | Direct SDK upload with upsertfalse -> patient_files metadata | Closed by default; test DB also denies. Nontransactional upload/registration orphan handling remains unverified |
| AvatarUpload patient/doctor/clinic branding | Current identity/clinic plus backend Storage RLS | Direct SDK upload with upsertfalse; path reference only | Closed by default; no signed/public URL generated |
| Saved prescription issuance | Server action authorization and canonical issuance policy/RPC | app/actions/save-prescription.ts -> lib/prescription-policy.mjs | Closed by default; synthetic exclusion retained |
| Saved prescription PDF and HCU033 PDF | Reload persisted rows after engine load, current identity/role checks | lib/pdf-client.ts -> pdf-generator client download | Closed by default; hosted preview/export after revocation NOT VERIFIED |
| Dormant budget PDF/family/legacy helpers | No active import/call site established in current routed app | lib/pdf-generator-budget.ts / legacy helper code | No hosted acceptance claimed; keep outside release availability until separately reviewed |
| Operational email prescription_ready links | Auth/role, template and destination/link validation; synthetic route excluded | app/api/send-email/route.ts; no Storage SDK or file attachment transport found in this route | Linked document must still pass closed gateway; email acceptance outside this gate |
| Supabase Edge Functions | Five repository functions; none deployed in clinia-test | No storage/download/PDF/attachment API call found by scoped source search | Repository inspection only; no Production inventory claim |
| Background jobs | Repository CI is offline verification, no clinical-file distribution found in scoped search | Provider jobs/cron inventory not established | NOT VERIFIED; do not infer absence on another project |
| Signed/authenticated/public legacy URLs | Historical independent provider capability, potentially cached independently of live RLS | Direct provider/CDN | Original strict failure remains OPEN; gateway patch cannot revoke already issued URLs or copies |
| brand_public public logo | Intentionally public nonclinical asset | Existing provider public endpoint | Explicitly not a private clinical guarantee; unchanged |

## Reproduction and validation

- Read-only hosted reproduction of separate42501: SET LOCAL ROLE authenticated; SELECT count(*) FROM storage.objects ->42501, public.billings. No grant was added.
- Actual Next.js15.5.28 matcher utility reproduced skipped /api/clinical-documents/fixture.json before correction, then matched document/media roots and nested json/png/svg paths after.
- Local tests exercise default closure, no provider/cookie/PDF effects, all seven HTTP methods, flags rejecting Production/wrong backend, and preservation of unrelated pilot exclusions.
- Existing transport/authorization regressions execute under an explicitly injected local QA profile; that test configuration grants no hosted authority.
- Windows checkout EOL-only transport differences caused an invalid initial full-suite run. Canonical Git bytes were restored only in this isolated worktree, preserving main and other worktrees. Original failures/logs are retained privately; they are not counted as product failures or successful proof.
- Native role tests, source tests, CI and Ready deployment are distinct from ordinary hosted Auth/CDN tests.

## Authorized deployment boundary

Only publish the reviewed application patch to codex/clinia-mvp-synthetic after its package review; require its own CI and Vercel Preview SHA binding. Preserve current variables/domain protection and do not enable file QA flags yet.
No hosted SQL, Storage object mutation, user/member revocation, email, configuration or Production change is included.
Independent reviewer must rerun default denial cases on the exact protected Preview with an authorized ordinary session and retain their own sanitized result. Vercel SSO redirect alone is BLOCKED, not an application denial.

## Remaining strict acceptance and escalation

Not yet executed on this successor: two-clinic/multi-role positive read/upload/download, cross-clinic denial, removed member, disabled account, revoked session, expired bearer, warmed original historical URL, preview/export after revocation, overwrite/list/delete, and clinical-payload hash exclusion on each denial.
Before a positive turn, seal a minimal compatible clinia-test document-contract/fixture operation with cleanup and restoration limits; do not use broad40-upgrade.sql or service_role as an ordinary actor.
Original replay belongs to phihon staging and requires a separate exact authorized scope/custodian locator. Do not recreate missing signed tokens or substitute new requests for historical requests. If required captures are unavailable, mark those cases BLOCKED and use a reviewed provider-supported containment strategy; never infer purge from token expiry or key rotation.
No next gate is advanced by this package. Storage remains PARTIAL / original strict failure OPEN until applicable independent hosted evidence is recorded.
