# Metadata-derived scoped Supabase fixtures

**Local synthetic preparation only. NOT pg_dump, a backup, a full remote clone, a migration for deployment, or clinical production approval. M7 remains NOT READY.** This agent generated artifacts and ran offline tests; it did not execute SQL or mutate any database.

## Inputs and results

Read-only expanded catalogs are under ../../evidence/2026-09-27. Production capture represents the current pre-M7 production contract; staging capture includes M7, compound indexes and the invoker demographic-view patch. Neither source is an approved complete canonical authorization model. Captures were separate queries, not one transaction across the projects.

- scripts/generate-scoped-supabase-baseline.cjs: offline SQL/manifest generator and scoped metadata verifier.
- test/production/scoped-baseline.test.cjs:13 direct node tests; passed, exit0. The added case accepts declared physical dropped-column compaction and rejects logical reordering.
- prod-deny.sql / stage-deny.sql: default artifacts; client privileges withheld, historical Storage policies explicitly omitted and historical public bucket configurations made private.
- prod-observed.sql / stage-observed.sql: explicitly acknowledged local historical fixtures; observed effective object and column ACLs/policies restored, including unsafe historical permissions. Global/schema automatic ACLs deliberately remain restrictive.
- Each SQL has its matching manifest.json with input hashes, SQL hash, identity-level coverage, exact source object hashes, expected scoped state and every deliberate difference.

All original function bodies are preserved. In particular, production logs.log_patient_view references columns absent from the actual logs.access_audit table. This is a known original defect to repair in a forward change, not conceal inside baseline reconstruction.

Current runtime uses prod-deny-v2/stage-deny-v2. SQL bytes are unchanged from v1; manifest2 compares logical live-column order and records staging resolution_notes physical slot16→15 after reconstruction. Original captures/v1 manifests/failed strict report remain preserved. Both actual secondary fixtures matched v2; see ../../evidence/2026-09-27/local-runtime-continued. M7 then retained two invented patients. Canonical convergence and remote restore remain unverified.

## Generation

Run from repository root. Output files must not exist; the CLI refuses overwrite. Defaults are deny-client. Generation writes files only and has no database connection code.

~~~powershell
node scripts/generate-scoped-supabase-baseline.cjs generate --input docs/production/evidence/2026-09-27/catalog-stage-scoped.metadata.json --dependencies docs/production/evidence/2026-09-27/catalog-stage-dependencies.metadata.json --output-prefix docs/production/reconciliation/scoped-baseline/review-stage --target local-synthetic
node scripts/generate-scoped-supabase-baseline.cjs generate --input docs/production/evidence/2026-09-27/catalog-prod-scoped.metadata.json --dependencies docs/production/evidence/2026-09-27/catalog-prod-dependencies.metadata.json --output-prefix docs/production/reconciliation/scoped-baseline/review-prod-observed --target local-synthetic --mode observed-fixture --acknowledge-observed-fixture
node test/production/scoped-baseline.test.cjs
~~~

The session marker app.scoped_fixture_authorized=local-synthetic is an execution intent check. Anyone with SQL privileges can set it; it does not prove that a connection is local. The executor must independently check the Docker resource, loopback endpoint and isolated target. Never run these artifacts through the remote MCP executor, db push, or a linked production checkout.

## Runtime installation order

Use genuine Supabase PostgreSQL 17 with managed auth.users, storage.objects and official service roles already initialized by the CLI in an independent project folder. Each fixture requires a separate fresh application target. It rejects existing relations/types/routines/triggers/policy/bucket identity collisions. It does not drop or overwrite application tables or data.

1. Pin/record runtime image versions and effective isolation; ensure Auth/Storage are real. No fake managed tables.
2. Review the exact selected SQL hash and manifest. For observed fixtures, block external access and use only invented users/files. This restores historical ACLs to characterize the source, not to authorize product access.
3. Set the session marker, then install the reviewed artifact atomically with stop-on-error. The SQL owns BEGIN/COMMIT, lock timeout and statement timeout. Failure before commit rolls back all fixture DDL.
4. Capture actual metadata using the saved expanded query. Use the same capture search_path to avoid formatter-only qualification changes. Save the actual JSON; do not use fake expected output as actual evidence.
5. Run the offline verifier below. It compares exact scoped schemas/types/relations/columns/constraints/indexes/sequences/functions/triggers/policies/bucket configurations and semantic ACLs. It also rejects broadened future-object defaults and requires global PUBLIC function/type defaults to have been explicitly removed.
6. Validate extension/managed-role/service differences separately, then execute genuine Auth/JWT/PostgREST/RPC/Storage tests. Metadata matching does not prove function execution, RLS permissions, stale-session revocation, browser flows or restore.

~~~powershell
node scripts/generate-scoped-supabase-baseline.cjs verify --manifest docs/production/reconciliation/scoped-baseline/stage-observed.manifest.json --actual PATH_TO_REAL_LOCAL_METADATA.json --output PATH_TO_NEW_VERIFICATION_REPORT.json
~~~

Verifier exit 0 means scoped metadata match; 2 means differences; 1 means malformed/unsupported input. A verification report file must not exist. No difference is silently accepted. Formatter-only differences must be reviewed or corrected in the capture process, not erased by lossy SQL whitespace normalization.

The sequence bounds are exact strings. Identity sequences are created through identity-column DDL; their ownership propagates from the table. The standalone profile audit sequence is created before its default is used; source OWNED BY differences are preserved.

## Security and coverage decisions

- PostgreSQL global default PUBLIC EXECUTE on functions and USAGE on types cannot be canceled by per-schema REVOKE. The generator revokes global and schema defaults before application DDL. It never restores the broad remote automatic grants, in either mode. This affects future objects in the synthetic target and must remain visible in the manifest.
- Roles/memberships, managed publications, extension versions and remote migration version/name history remain provenance. They are not fabricated/replayed to force counts. Only uuid-ossp and pgcrypto interfaces are ensured with CREATE EXTENSION IF NOT EXISTS; pg_cron, schedules, Vault settings and Realtime internals are not provisioned by this fixture.
- Catalog pg_depend edges are fully accounted (633 staging / 1189 production), including constraints, policies, defaults, triggers, types and indexes. PostgreSQL regenerates system/FK triggers from constraints. Dynamic or string dependencies inside PL/pgSQL require body review and runtime tests.
- Unknown relation kinds, partitions, domains/generated columns, unready indexes, unknown extensions/roles/dependency schemas, ambiguous ACL/grantors, duplicate/missing categories, file/network operations and obvious credential literals fail before output. This is a bounded metadata generator, not a general PostgreSQL dump engine.
- Managed buckets are only empty local configuration rows. No objects or object bytes are copied. Historical production bucket names/configuration do not enable finance, campaigns, WhatsApp or DICOM product workflows.
- Default generation restores no client schema/table/function/column grants. It omits historical Storage policies so a broad Storage policy cannot bypass the closed application ACL boundary. Every omission is identity-level and explicit.
- The coverage manifest includes historical objects even where the canonical pilot should keep them disabled. Baseline provenance must not be confused with scope for the final product.

## Minimal clean/upgrade route

1. Install stage source fixture in one fresh local target and verify its declared scoped shape.
2. Install prod source fixture in another fresh local target and verify its declared scoped shape. Keep historical bodies intact; characterize known failures.
3. Before seeding, define and test synthetic Auth bootstrap. Before the original M7 SQL, the production fixture must supply every referenced table/helper and its original simple patient FKs. Apply M7 exactly once to that pre-M7 synthetic fixture. Do not reapply its non-idempotent UNIQUE/FK additions to stage-M7.
4. Author a canonical forward path for missing registration/invitation/profile/listing/family/audit contracts, exact typmod/sequence ownership reconciliation and least privilege, while preserving M7. Resolve the owner/clinician authority matrix separately.
5. Seed two invented clinics and ordinary Auth roles into the upgrade target before forward changes. Check that successful migrations retain rows and that mismatch/invalid outcome fixtures fail atomically. Clean canonical install and the synthetic upgrade must converge in metadata and behavior.
6. Keep full remote clone upgrade and DB+Storage disaster recovery unverified until a true appropriate schema/archive/role/config capture and restore are performed. These local fixtures unblock engineering without pretending that metadata is a dump or that production is approved.

The old legacy migration directory remains untouched. Do not use duplicate date prefixes or rollback files for an automatic replay/push, and do not repair remote history just to make the fixtures appear deployed.
