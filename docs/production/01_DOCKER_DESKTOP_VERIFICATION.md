# Encargo 01 — Docker Desktop disposable verification

Executed 26 September 2026, America/Guayaquil; evidence timestamps use UTC (27 September). Infrastructure experiment completed; **application reconciliation remains BLOCKED and M7 remains NOT READY**.

## Actual results

| Requirement | Result | Evidence / remaining dependency |
| --- | --- | --- |
| Docker connectivity | VERIFIED | Desktop 4.92.0, Engine/CLI 29.8.0, Compose 5.5.1. Local `desktop-linux`, `npipe:////./pipe/dockerDesktopLinuxEngine`. Initial sandbox denial resolved by scoped command approval; Full Access was never enabled. |
| Isolated disposable runtime | VERIFIED | Official PostgreSQL 17.11 Alpine, immutable digest in `image.txt`. Dedicated internal bridge and named volume, no published ports, no bind mounts/daemon socket, UID/GID 70, read-only root, all capabilities dropped, no-new-privileges, 512 MiB / 1 CPU / 128 PID limits. Effective settings and process capability checks recorded. |
| Daemon exposure | VERIFIED for checked endpoints | Named-pipe endpoint; no Windows listeners on 2375/2376. No daemon configuration changed. This is not an exhaustive host security audit or proof about arbitrary ports. |
| Clean PostgreSQL initialization | VERIFIED | Fresh disposable volume initialized PostgreSQL 17.11 and became healthy; SQL executed successfully. |
| Clean synthetic schema installation | VERIFIED | `probe_clean`, two invented tenants, rows, RLS and invoker view. Infrastructure probe only; not a reconstructed application baseline. |
| Synthetic upgrade behavior | VERIFIED | `probe_upgrade` v1→v2 retained both synthetic rows. Compared ordered column/default metadata, policies, relation RLS/options and rows with fresh v2; exact match. Does not establish application migration convergence or a PostgreSQL version upgrade. |
| Restart persistence | VERIFIED | Same container restarted; named-volume synthetic rows/RLS assertions passed again. |
| Permissions/schema access | VERIFIED for probe | A/B each read only their own row; invoker view respected RLS; anon schema read, tenant write and public schema CREATE denied with exit 3. Roles are NOLOGIN, NOSUPERUSER, NOBYPASSRLS; SQL SET ROLE tests are not JWT evidence. |
| TCP authentication | VERIFIED | Correct generated password succeeded over container-local TCP; wrong password failed with exit 2 and authentication error. SCRAM host rules; secret file mode 0600 inside disposable volume, not repo/chat/logs. Local Unix socket trust is reserved for Docker-admin test execution. |
| Actual application clean install | BLOCKED, attempted | Atomic first legacy migration and `supabase/schema.sql` both failed with missing `auth` schema, exit 3. Source SHA-256 and stderr saved; each transaction left zero public tables. Plain PostgreSQL lacks Supabase-managed schemas/services and the repository has no canonical reconciled baseline/config. Do not add fake Auth/Storage tables to claim success. |
| Actual application upgrade / M7 convergence | BLOCKED | No reviewed schema-only baseline/clone, roles/default ACL definitions and canonical forward history. Legacy duplicate date prefixes and rollback files remain unchanged; no db push/reset/repair performed. Need faithful, reviewed Supabase schema/roles snapshot plus a separate approved forward path, preserving M7. |
| Actual JWT/PostgREST/RPC/Storage authorization | BLOCKED | Probe has no Auth, PostgREST or Storage services. Need reviewed isolated Supabase configuration, two synthetic clinics and authority matrix, real Auth actors and positive/negative tests including inactive/stale sessions. Elevated metadata or SQL role probes do not close this gate. |
| Browser/provider and restore DB + Storage | BLOCKED | Need the reviewed application baseline/services, configured synthetic provider/browser flows and restorable synthetic DB plus object bytes. No actual data, external emails or provider calls used. |

Evidence directory: [docker-encargo01](evidence/docker-encargo01/). Primary result files: [results.json](evidence/docker-encargo01/results.json), [container.json](evidence/docker-encargo01/container.json), [network.json](evidence/docker-encargo01/network.json), [daemon-listeners.json](evidence/docker-encargo01/daemon-listeners.json), [legacy_clean.json](evidence/docker-encargo01/legacy_clean.json), [legacy_schema.json](evidence/docker-encargo01/legacy_schema.json). Logs preserve native errors/exit codes and final completion; no credentials are printed. Runtime capture reflects the healthy running test state; [final-state.txt](evidence/docker-encargo01/final-state.txt) records the final stopped state.

## Resources and repeatability

Only `denta-encargo01-disposable`, `denta-encargo01-internal`, and `denta-encargo01-pgdata` were created. The pre-existing `welcome-to-docker` container was not changed. The experiment container is **stopped**, restart policy `no`; volume and network retained for review. No resources were pruned or deleted. Disposable volume contains only synthetic rows and a local test secret; it is not a backup or production data.

Scripts:

- `scripts/encargo01-docker.ps1 -Action Provision`: fresh-resource creation only; rejects collisions. The official pinned tag must already have been pulled; resolves and runs its immutable digest. Temporary process PATH includes the official credential helper, without modifying system PATH.
- `scripts/encargo01-docker-tests.ps1`: one-shot assertions on a fresh initialized experiment; deliberately fails if fixture roles/databases already exist.
- `scripts/encargo01-docker-finalize.ps1`: checks effective isolation and password enforcement, records results, stops this container.
- `scripts/encargo01-docker.ps1 -Action Stop`: validates ownership label and stops this experiment only.

Run these using ordinary restricted Codex access with scoped Docker-command approval when the sandbox cannot access the named pipe. Do not enable Full Access, privileged mode or host networking. No TCP daemon exposure is required. Do not run scripts against another Docker context. Existing-resource reuse/removal requires inspecting that exact experiment and accounting for its contents first.

During the first run, restarting PostgreSQL revealed that regenerating an initialization password in tmpfs does not update an existing database password. The disposable admin password was synchronized without printing it and persisted as mode 0600 in the volume. The provisioning script now preserves that initialization secret for fresh future runs. The already-created container retains its original bootstrap command: after restart use the **volume secret**, not the newly generated unused `/tmp/pg-secret`, for TCP authentication. No remote credential was accessed.

PostgreSQL 17.11 is the current verified official image for this experiment, not a bit-for-bit Supabase 17.6 clone. Supabase extensions/owners/services and compatibility still require explicit testing. SQL failures here establish missing prerequisites, not defects in a properly bootstrapped Supabase deployment.

Official references consulted: [Docker security](https://docs.docker.com/engine/security/), [internal Compose networks](https://docs.docker.com/reference/compose-file/networks/), [official PostgreSQL image/init behavior](https://hub.docker.com/_/postgres), [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Supabase changelog](https://supabase.com/changelog). Existing Encargo 01 and M7 historical reports are preserved; their earlier statement that local Docker is unavailable is superseded only by this infrastructure evidence.
