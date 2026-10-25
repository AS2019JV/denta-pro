# Managed-only a9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after actual scoped approval. Inline execution only; the authorized single Luna review was already consumed. No new subagents or audit.

**Goal:** Prepare one NEW empty local DB/Auth/Storage cohort for Gate3; initialization remains unapproved.

**Architecture:** Gate4 owns Docker preparation/start/stop and the single writer turn. Derive only three managed services from the frozen template, retaining the native DB initializer and exact image digests. The resulting actual identity receipt grants no application write permission.

**Tech Stack:** PowerShell7, Node22, Docker Desktop Linux29.8.0/Compose5.5.1; pinned PG17.11, Auth2.197.0, Storage1.80.2.

**Spec:** docs/production/gate4-recovery-ops/managed-a9-2026-10-25/managed-only.contract.review.json

## Global Constraints

- Exact proposed project: clinia-gate3-20261020-a9. No prior target/p8/r8/volume reuse.
- Only db/auth/storage. No application SQL, M7, upgrade, opening, restore, ledger repair/import or additional grants.
- Internal network clinia-gate3-20261020-a9-private,10.253.9.0/24; no published ports.
- Gate4 owns the writer turn; it is NOT allocated by this plan or a coordination file.
- Service memory limits total640MiB; require actual current VM MemAvailable at least704MiB immediately before creation.
- No image pull, global Docker/resource change, shared/production/quarantined access, emails or other-chat resource mutation.
- Private material only in ignored .gate4-private/managed-a9 with current-user/SYSTEM ACL.
- RC95b059bea1d985c48a62e81d7237be7dcc19b228 has own success/Ready receipts but is not FINAL. The initial envelope/checksum inconsistency is preserved; final observation verifies v2.4-integrity-repaired. This does not allocate a turn.
- Proposed compose contains secret TOKENS and MUST NOT be launched directly.
- Frozen templates/guards remain unchanged; all derived files and receipts are new.

## File structure and interfaces

Prepared:
- docs/production/gate4-recovery-ops/managed-a9-2026-10-25/managed-only.compose.proposed.json: exact public three-service proposal, no instantiated credentials.
- Same folder/managed-only.contract.review.json: current review contract; initial proposed draft is preserved separately.
- docs/production/evidence/2026-10-25-gate4-managed-plan/physical-preflight.json: actual physical observation.
- Same folder/plan-validation.json: static checks and Compose parser result.
- Same folder/handoff-inconsistency-observed.json: initial input refusal.
- Same folder/receipt-schema-observation.json: actual v2 CI fields, without modifying the old v1 reader.

After actual approval only:
- .gate4-private/managed-a9/credentials.private.json
- .gate4-private/managed-a9/runtime.compose.json
- .gate4-private/managed-a9/db-pgsodium_root.key
- NEW public receipt docs/production/evidence/2026-10-25-gate4-managed-plan/managed-initialization.json

Consumes: exact public proposal, scoped approval, current admission, signingMaterial({project}) from scripts/prepare-clinia-clean-managed.cjs.
Produces: instantiated private compose and actual new PG sysid/version, effective ports/images/mounts and empty managed-state receipt.

## Task1: physical preflight and proposal

- [x] Local named pipe and target absence in containers/volumes/networks.
- [x] Three installed immutable image IDs; no pull.
- [x] MemAvailable through one ephemeral cat/proc probe, read-only/network-none; image-declared volumes use tmpfs; persistent volume inventory unchanged and probe removed.
- [x] Proposed subnet checked against Docker subnets and specific IPv4 routes, excluding only default route.
- [x] Point-in-time zero running containers; no claim of reservation/continuous exclusivity.
- [x] Derived exact three-service compose, explicit privileged=false/pull_policy=never, checked subnet; omitted unused disabled-S3 credential fields. Native DB command preserved.
- [x] docker compose config --quiet exit0. No managed start or secret generation.

## Task2: approval and private instantiation — NOT EXECUTED

- [ ] Actual exact managed-only approval and writer turn; require the verified current envelope and its recorded repair disposition.
- [ ] Recheck absence, installed digests, routes, MemAvailable and concurrent writers immediately before writing. Any conflict aborts.
- [ ] Validate ignored private parent and all ancestors against reparse points, then create target directory only if absent. Install protected owner/SYSTEM ACL before secrets.
- [ ] Use NEW signing material and the exact transformation below only after those gates. This is future specification, not execution authorization.

    const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
    const project='clinia-gate3-20261020-a9';
    const dir=path.join(process.cwd(),'.gate4-private/managed-a9');
    const spec=JSON.parse(fs.readFileSync('docs/production/gate4-recovery-ops/managed-a9-2026-10-25/managed-only.compose.proposed.json'));
    assert.ok(fs.existsSync(dir),'Restricted empty directory required');
    for(const name of ['credentials.private.json','runtime.compose.json','db-pgsodium_root.key'])
      assert.ok(!fs.existsSync(path.join(dir,name)),'No reuse of partially prepared target');
    const m=require('./scripts/prepare-clinia-clean-managed.cjs').signingMaterial({project});
    const uri=role=>'postgresql'+'://'+role+':'+m.password+'@supabase_db_'+project+':5432/postgres';
    const pairs=[
      ['__AUTH_DATABASE_URI__',uri('supabase_auth_admin')],
      ['__STORAGE_DATABASE_URI__',uri('supabase_storage_admin')],
      ['__PRIVATE_JWT_KEYS__',JSON.stringify([m.privateJwk])],
      ['__PUBLIC_JWT_KEYS__',JSON.stringify(m.jwks)],
      ['__DATABASE_PASSWORD__',m.password],['__JWT_SECRET__',m.secret],
      ['__ANON_JWT__',m.anon],['__SERVICE_JWT__',m.service]
    ];
    const convert=v=>typeof v==='string'?pairs.reduce((s,[a,b])=>s.replaceAll(a,b),v):
      Array.isArray(v)?v.map(convert):v&&typeof v==='object'?
      Object.fromEntries(Object.entries(v).map(([k,x])=>[k,convert(x)])):v;
    const result=convert(spec);
    assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(result)),'Unresolved token');
    assert.deepEqual(Object.keys(result.services).sort(),['auth','db','storage']);
    for(const s of Object.values(result.services)){assert.deepEqual(s.ports,[]);assert.equal(s.privileged,false);}
    fs.writeFileSync(path.join(dir,'credentials.private.json'),JSON.stringify(m),{flag:'wx'});
    fs.writeFileSync(path.join(dir,'db-pgsodium_root.key'),m.sodium,{flag:'wx'});
    fs.writeFileSync(path.join(dir,'runtime.compose.json'),JSON.stringify(result,null,2),{flag:'wx'});

ACL and ancestry checks remain mandatory. A partial write preserves the attempt and forbids preparing it again. Never print m or the instantiated compose.

## Task3: empty managed startup and actual receipt — NOT EXECUTED

- [ ] Validate private compose, then start DB and native Auth/Storage dependencies only:

    $taskDocker='C:/Users/aleja/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
    $taskCompose=Join-Path (Get-Location) '.gate4-private/managed-a9/runtime.compose.json'
    & $taskDocker --context desktop-linux compose -p clinia-gate3-20261020-a9 -f $taskCompose config --quiet
    if ($LASTEXITCODE -ne 0) {throw 'Private compose refused'}
    & $taskDocker --context desktop-linux compose -p clinia-gate3-20261020-a9 -f $taskCompose up -d --pull never --wait --wait-timeout 180 db
    if ($LASTEXITCODE -ne 0) {throw 'Stop owned cohort, preserve target; no retry'}
    & $taskDocker --context desktop-linux compose -p clinia-gate3-20261020-a9 -f $taskCompose up -d --pull never --wait --wait-timeout 180 auth storage
    if ($LASTEXITCODE -ne 0) {throw 'Stop owned cohort, preserve target; no retry'}

- [ ] Inspect only selected Docker fields: names/images/private network/new volumes/no published ports, no privileged/OOM/unhealthy state. Never dump environment.
- [ ] Capture actual metadata with postgres in a READ ONLY transaction:

    BEGIN READ ONLY;
    SET LOCAL statement_timeout='15s';
    SELECT jsonb_build_object(
      'database',current_database(),'user',current_user,'sessionUser',session_user,
      'version',current_setting('server_version_num'),
      'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),
      'postgresSuperuser',(SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),
      'authMigrationRows',(SELECT count(*) FROM auth.schema_migrations),
      'storageMigrationRows',(SELECT count(*) FROM storage.migrations),
      'authUsers',(SELECT count(*) FROM auth.users),
      'mfaFactors',(SELECT count(*) FROM auth.mfa_factors),
      'buckets',(SELECT count(*) FROM storage.buckets),
      'objects',(SELECT count(*) FROM storage.objects),
      'applicationRelations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','logs','security_internal') AND c.relkind IN ('r','p','v','m','S','f')),
      'applicationLedgerAbsent',to_regclass('supabase_migrations.schema_migrations') IS NULL);
    ROLLBACK;

- [ ] Require170011, an ACTUAL NEW sysid, postgres without superuser, nativeAuth82/Storage74 and zero app/actor/object rows. Mismatch stops the phase without role/grant/history repair.
- [ ] Save actual sysid/version/images/effective ports/mounts/health/emptiness and declared start/end to managed-initialization.json. This is not recovery RTO, ordinary HTTP proof or Gate3 acceptance.
- [ ] Any failure stops only owned services, preserves volumes/private diagnostics/failure receipt, and forbids retry or app phases. No volume deletion.

## Task4: later PostgREST and Gate3 writes — separate approval

- [ ] Keep rest OUT now. The later approved ordinary-JWT phase may add frozen PostgREST image public.ecr.aws/supabase/postgrest@sha256:85258123312dc496ad4c2ed832154a65e9746f84df0d6d09b44229ff9230c08e,64MiB, no published ports.
- [ ] Four-service limits total704MiB; with64MiB headroom require768MiB current MemAvailable. Recheck image/network/admission; no automatic addition from this plan.
- [ ] Gate3 supplies its exact occupied baseline/upgrade/data-preservation contract and ordinary JWT own/foreign/anon cases. SET ROLE and service_role do not replace ordinary HTTP.
- [ ] App SQL, M7, opening and restore remain outside this plan and require their own exact approval, source fixtures, backup barrier and writer handoff.

## Self-review and execution handoff

Physical identity/digests/resources/network, private material boundary, native-only startup, actual identity/emptiness and failure preservation are covered. Approval, lease, actual sysid and managed outcomes are NOT present. No RC compatibility suite, p8,15tests or archive copy was repeated.

This assignment ends with the reviewable plan. If separately approved, execution is inline using executing-plans; no additional agent/review choice is needed or authorized.
