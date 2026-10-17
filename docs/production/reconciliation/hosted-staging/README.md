# Hosted staging candidate

The pure compiler `scripts/prepare-clinia-hosted-staging.cjs` binds exclusively to
`cliniaplus-staging` / `phihonofwyerpfgqfekt` and explicitly denies production
`leqsrfyjvuxxdsubjjin`. It reads no environment files or credentials and calls no
database, Docker or HTTP tool.

`reviewed-baseline.json` is fresh read-only hosted metadata. Its catalog hash is
recomputed with the identical `catalog-query.sql` under an empty search path after
locking every application table plus Auth users/sessions and Storage buckets/objects.
The evidence contains metadata and hashed routine definitions only.

The compiler checks fixed SHA-256 pins for every original source. It removes only
each reviewed outer transaction wrapper, including the outer read-only verification
rollback, and rejects transaction boundaries inside the remaining SQL. One transaction
then rechecks empty rows and the exact four API-created private bucket configurations,
applies the unchanged canonical chain, verifies final authority/receipt/storage
contracts, and preserves managed callbacks, migration versions and existing extensions.
Only the reviewed btree_gist 1.7 addition is allowed.

Generate locally with `node scripts/prepare-clinia-hosted-staging.cjs phihonofwyerpfgqfekt`.
Test with `node --test test/production/hosted-staging-adapter.test.cjs`.
The generated candidate includes the pinned prospective agenda delta after live session
revocation. Local SQL validation and independent release review remain pending.
No SQL execution is authorized by a compatibility GUC:
the reviewed executor must send the complete unchanged candidate in one fixed MCP
`project_id` request. SQL success leaves ordinary JWT/API tests and production readiness
unverified.
