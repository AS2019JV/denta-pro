# Storage origin adapter executable review

Date: 2026-10-06. Scope: local runtime contracts using the actual TypeScript adapter and route, fake provider clients, and real Node readable streams. No provider, browser, Git, or environment changes.

## Results

- Initial regression run: 10 tests, 5 passed / 5 failed. Preserved in `origin-runtime-before-fix-20261006.log`.
- Corrected adapter and existing actual document route: 24 tests passed. See `origin-runtime-after-fix-20261006.log`.
- Affected document, principal, private-media, limit, route and adapter tests: 64 tests passed / 0 failed. See `origin-affected-tests-20261006.log`.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit 0, no diagnostics. `origin-typecheck-20261006.log` is empty because the compiler emitted none.

## Reproduced and corrected

1. Declared ContentLength was checked, but empty/truncated/extra actual bytes could pass. The response stream now requires an exact byte count and enforces the shared 4,000,000-byte bound while reading.
2. Cleanup depended exclusively on the Node close event. Streams with `emitClose: false` retained the client and abort listener. EOF, failure, request abort and response cancellation now release resources idempotently.
3. Provider stream errors were observable by the adapter's consumer. Stream failures now carry generic errors with no original provider details.
4. Request abort after SDK completion could destroy a source before its error handler existed and cause an unhandled error. The web-stream adapter is attached before cancellation handling, and cancellation destroys without emitting a raw error.

The route test harness was already adapted at review time; its 14 tests continue to execute the actual route and preserve actor/session pinning, exact clinic/patient/file checks, protected delivery path selection, broker isolation, repeat authorization, revocation, and fail-closed audit behavior.

## Limits and residual review notes

These tests do not prove hosted RLS, CDN behavior, deployed configuration, browser behavior, or clinical production readiness. Existing staging evidence in this directory was left untouched. The helper intentionally accepts only hosted Supabase project origins and a project-matched legacy anon JWT; publishable keys, secret/service-role keys and missing region fail closed. JWT validity is enforced by the provider, not by unverified local claim parsing.

The application must continue buffering the complete guarded stream before publication and repeat live authorization; a generic streaming helper alone cannot retract earlier bytes after a late failure. Both delivery handlers retain that buffering contract.

References checked: [Supabase S3 session-token authentication](https://supabase.com/docs/guides/storage/s3/authentication), [Node 22 streams](https://nodejs.org/docs/latest-v22.x/api/stream.html). The Supabase markdown changelog endpoint was attempted but the browsing tool rejected its content type.
