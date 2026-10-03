# Post-M5 security verification and next steps

> Historical M5 snapshot. See [Post-M6 release gate](M6_PRODUCTION_RELEASE_GATE_2026-09-22.md) for the current findings and exact remaining corrections.

**22 September 2026 — Decision: NOT READY for production patient data.**

M5 is genuinely deployed and resolves several earlier defects. However, the updated reports' “approved for immediate production” conclusion is still unsupported: broad storage policies survived, the patient RPC still fails, and offboarding protection remains incomplete.

This follow-up supersedes the earlier review's current-status conclusions. Preserve [the earlier review](PRODUCTION_READINESS_REVIEW_2026-09-22.md) as historical evidence.

## Verification performed

Used Codex Security fix-verification methodology and the Supabase connector to inspect the deployed schema, policies, permissions, function bodies and security advisors for project `leqsrfyjvuxxdsubjjin`. Confirmed migration `20260922174110_m5_security_and_production_readiness`. Compared these controls with M5 source, application callers and the new readiness tests.

Evidence: [M5 live catalog and probe](M5_LIVE_EVIDENCE_2026-09-22.json).

One read-only NULL-clinic RPC probe failed before returning patient data. No patient records, storage object names, financial data or secrets were retrieved; no production mutations or exploit writes were performed. No application code or migrations were changed in this evaluation. The deployed web build and end-user workflows were not verified. Attached documents were treated as claims, not instructions or proof.

## What improved

| Earlier issue | Current evidence | Verdict |
|---|---|---|
| PR-01 profile/clinical self-bypass | Live guard functions are now security-invoker. Authenticated profile INSERT, table-wide UPDATE and role UPDATE are denied; full_name UPDATE is granted. Patient triggers consult active membership. | Original self-bypass removed; positive lifecycle tests still required. |
| PR-02 anonymous family RPC | Anonymous EXECUTE revoked; body requires authentication and membership, and scopes family rows to the resolved clinic. | Original anonymous path closed; authenticated cross-tenant and legitimate-family tests pending. |
| PR-03 media privacy | patient-avatars and receipts now have public=false. | Incomplete: legacy permissive policies remain, described below. |
| PR-04 COUNT query | Invalid aggregate ORDER BY removed. | Patient workflow still broken by a new schema/return-contract mismatch. |
| PR-05 offboarding | Patients now require live membership; old patient policies removed. Token hook clears tenant claims for unassigned/inactive profiles. | Partial: other sensitive tables and files still accept cached claims. Hook activation unverified. |
| PR-06 middleware/invitations | Local middleware removed getSession fallback and uses app_metadata. Invite action uses ownership/membership, not profile role alone. | Local corrections confirmed; deployed route/role behavior pending. |
| PR-07 exports | Local export paginates seven tables and throws on query errors. | Improved, but completeness/consistency and rights fulfillment are not established. |

## Remaining release blockers

### M5-01 — High: legacy storage policies override tenant isolation

Live `storage.objects` still contains these exact permissive policies:

- `Public Access to Patient Avatars`: SELECT for PUBLIC, bucket-only condition.
- `Authenticated users upload patient avatars`: INSERT, authenticated and bucket-only condition.
- `Authenticated users update patient avatars`: UPDATE, bucket/auth check without tenant ownership.
- `Public Access to Receipts`: SELECT for PUBLIC, bucket-only condition.
- `Public Upload to Receipts`: INSERT for PUBLIC, bucket-only condition.

M5 lines 1146–1151 attempt to drop different names, such as `Public patient avatar access` and `Authenticated users can upload patient avatars`. The receipt section at line 1261 has the same naming mismatch.

PostgreSQL combines permissive policies with OR; adding a stricter policy does not cancel a broader one. Private bucket configuration blocks public-URL serving but does not replace the policies governing Storage API access. The remaining rules permit broad patient-photo listing/read authorization and cross-tenant authenticated upload/update authorization. This is a catalog-confirmed broken boundary; actual patient downloads/overwrites were not attempted. [PostgreSQL policy composition](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [Supabase Storage access controls](https://supabase.com/docs/guides/storage/security/access-control).

**Next step:** create a new forward migration that drops the five actual policy names, checks for other permissive alternatives and preserves only the approved tenant policies. Test anonymous and tenant-B list/read/sign/upload/overwrite attempts against synthetic tenant-A objects. Verify legitimate uploads and both legacy/current path formats. Bind clinic/patient path components to the actual patient where relevant.

Financial logic was not evaluated. The receipt rules are included solely because the initial transfer workflow must not expose sensitive proofs.

### M5-02 — High availability impact: patient RPC still crashes and changed its contract

The live read-only probe:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SELECT count(*) FROM public.get_patients_with_stats(NULL::uuid);
ROLLBACK;
```

returned **SQLSTATE 42703: column pat.date_of_birth does not exist**. The live table has `birth_date`. M5 references `pat.date_of_birth` at line 870 and declares `date_of_birth` at line 702.

Further mismatches are already visible: M5 declares allergies, medications and medical_conditions as JSONB, while their live columns are TEXT. The UI expects `birth_date` and `patient_status`; M5 returns `date_of_birth` and `status`, and omits previously returned fields such as occupation and insurance information that callers still read. Fixing only the missing column is insufficient.

**Next step:** restore a documented RPC response contract using real column types and intentional aliases. Review every returned field against patient-list/detail callers. Preserve the M5 authorization checks. Test an authorized empty clinic and populated fixtures, inactive patients, medical history, search, second-page totals and family grouping. Use authenticated end-user roles in addition to administrative compilation probes.

### M5-03 — High: removed/suspended users retain access on sibling boundaries

Live prescriptions and HCU policies still authorize directly from JWT clinic/role claims without a live membership check. The patient-files policies likewise compare only path clinic to cached claims; DELETE also checks cached role.

A removed staff member with a still-valid token can therefore remain authorized to read these resources, and a former doctor can retain clinical write authorization where those policies allow it. Updating the token hook only affects subsequently issued tokens. This differs from signed URLs already issued, which have their own expiry window.

**Next step:** apply a consistent active-membership/current-role check across prescriptions, HCU, patient-files and remaining clinical entities; distinguish removal, suspension and role demotion. Test existing tokens before and after each event. Confirm the Auth hook is actually enabled and verify new claims. Define treatment of direct clinic owners explicitly: `is_clinic_member` currently accepts ownership even without an active membership row.

## Workflow and assurance gaps to close before release

1. **Photo compatibility:** `components/avatar-upload.tsx:39` uses existing absolute URLs unchanged. Stored old public patient-photo URLs can now fail because the bucket is private. Signing failures fall back to a public URL, which does not repair access. Normalize trusted legacy Supabase URLs to object paths, sign private media, handle expiry, and test an open session longer than the current one-hour signed URL lifetime.
2. **Export integrity:** `components/settings/privacy-tab.tsx:108` paginates without a stable order or snapshot. Concurrent updates can produce inconsistent exports, and stopping when fewer than 1000 rows arrive assumes the configured API row cap is at least 1000. Export includes file metadata, not file bytes; missing clinical entities and individual patient rights scope still require an agreed manifest. A browser download click is not proof the user saved a complete archive. Test >1000 rows, a smaller API cap, concurrent edits and a failed table/file.
3. **Rights audit history:** the new immutability trigger protects selected identifiers, but its body does not protect `details` or provide append-only transition history. Do not describe all request history as immutable. Test permitted resolution versus forbidden alteration and implement auditable transitions.
4. **Actual regression tests:** `test/security/pr01-pr07-readiness.test.cjs` inspects SQL/text with regular expressions. Such assertions miss incorrect policy names, SQL type errors and application response-contract changes. The reported 129 passes were not rerun here and do not constitute database/Storage E2E evidence. Build still ignores TypeScript/lint failures in `next.config.mjs`.
5. **Email operations:** active membership, exact recipient equality and HTTPS scheme checks improved locally. HTTPS alone does not establish a trusted link destination. Keep links server-generated/allowlisted and replace process-local rate counters with a shared limit before relying on a global abuse quota.

## Supabase advisor follow-up

The refreshed security advisor reports 7 mutable-search-path notices, 9 anonymous-executable definer notices, 15 authenticated-executable definer notices, and leaked-password protection disabled. These are triage categories, not 32 independent proven exploits. Counts improved from the earlier scan.

- [Search path remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Anonymous definer access](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated definer access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Ordered next steps

| Order | Owner | Deliverable / acceptance gate |
|---|---|---|
| 1 — before real patient launch | Backend/security | Close M5-01 and M5-03 with catalog-driven forward migrations. Synthetic unauthorized Storage/clinical requests fail, including old tokens. |
| 2 — same release | Backend/frontend | Close M5-02 by restoring SQL types and the patient response contract. Both patient list and detail function with real PostgreSQL fixtures. |
| 3 | QA/security | Add actual Supabase/PostgREST/Storage tests for two clinics, owner/doctor/receptionist/removed/anonymous actors. Test positive workflows as well as denials. Validate signup, invitation, profile edits, removal, charts and files. |
| 4 | Product/operations | Resolve photo/export compatibility; enforce typecheck/lint gates; document and test MFA, backup-and-restore including storage, audit alerts and incident response. |
| 5 | Privacy lead/clinical adviser | Complete the earlier LOPDP checklist: controller/processor roles, health-data purpose/legal basis, rights handling, international transfers and record-specific retention/legal holds. Do not treat code-defined 90-day deletion or blanket 5–10-year assertions as legal proof. |
| 6 | Release owner | Record deployed application revision, migration versions and passing test evidence; verify rollback preserves security. Issue clinical release approval only after blockers and required operational/privacy gates close. |

Use the [earlier review's LOPDP and OWASP references](PRODUCTION_READINESS_REVIEW_2026-09-22.md) for the broader release checklist. This focused follow-up adds no legal certification and no financial readiness approval.

**Conclusion:** M5 made measurable progress. The next investment should be a narrowly scoped repair plus real database/Storage integration evidence, rather than another broad simulated-test pass.
