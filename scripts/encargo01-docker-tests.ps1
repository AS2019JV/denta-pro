$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'encargo01-docker.ps1') -Action Verify
function Invoke-Sql([string]$Database, [string]$Sql, [bool]$ExpectFailure = $false) {
    $output = $Sql | & $docker exec -i $name psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -At 2>&1
    $code = $LASTEXITCODE
    $output | Out-File (Join-Path $evidence 'sql-tests.log') -Append -Encoding utf8
    "database=$Database exit=$code expectedFailure=$ExpectFailure" | Out-File (Join-Path $evidence 'sql-tests.log') -Append -Encoding utf8
    if (($ExpectFailure -and $code -eq 0) -or (!$ExpectFailure -and $code -ne 0)) { throw "SQL expectation failed: $output" }
    if ($ExpectFailure -and ($code -ne 3 -or ($output | Out-String) -notmatch 'permission denied')) { throw "Expected permission denial, received a different failure: $output" }
    return ($output | Out-String).Trim()
}
Invoke-Sql postgres 'CREATE ROLE probe_a NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE probe_b NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE probe_anon NOLOGIN NOSUPERUSER NOBYPASSRLS;'
foreach ($db in @('probe_clean','probe_upgrade','legacy_clean','legacy_schema')) { Invoke-Docker @('exec',$name,'createdb','-U','postgres',$db) }
$v1 = @'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA probe;
REVOKE ALL ON SCHEMA probe FROM PUBLIC;
CREATE TABLE probe.records(id integer PRIMARY KEY, tenant text NOT NULL, value text NOT NULL);
INSERT INTO probe.records VALUES (1,'A','synthetic-A'),(2,'B','synthetic-B');
ALTER TABLE probe.records ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA probe TO probe_a,probe_b;
GRANT SELECT ON probe.records TO probe_a,probe_b;
CREATE POLICY tenant_a ON probe.records TO probe_a USING (tenant='A');
CREATE POLICY tenant_b ON probe.records TO probe_b USING (tenant='B');
CREATE VIEW probe.demographics WITH (security_invoker=true) AS SELECT id,tenant FROM probe.records;
GRANT SELECT ON probe.demographics TO probe_a,probe_b;
'@
$v2 = 'ALTER TABLE probe.records ADD COLUMN revision integer NOT NULL DEFAULT 2;'
Invoke-Sql probe_clean ($v1 + "`n" + $v2)
Invoke-Sql probe_upgrade $v1
Invoke-Sql probe_upgrade $v2
$assert = @'
SET ROLE probe_a;
DO $$ BEGIN
 IF (SELECT count(*) FROM probe.records) <> 1 OR (SELECT min(tenant) FROM probe.records) <> 'A' THEN RAISE EXCEPTION 'tenant A isolation failed'; END IF;
 IF (SELECT count(*) FROM probe.demographics) <> 1 THEN RAISE EXCEPTION 'view isolation failed'; END IF;
END $$;
RESET ROLE;
SET ROLE probe_b;
DO $$ BEGIN
 IF (SELECT count(*) FROM probe.records) <> 1 OR (SELECT min(tenant) FROM probe.records) <> 'B' THEN RAISE EXCEPTION 'tenant B isolation failed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS tenant A/B and invoker view';
'@
foreach ($db in @('probe_clean','probe_upgrade')) {
    Invoke-Sql $db $assert
    Invoke-Sql $db 'SET ROLE probe_anon; SELECT * FROM probe.records;' $true
    Invoke-Sql $db "SET ROLE probe_a; INSERT INTO probe.records VALUES (3,'B','forged',2);" $true
    Invoke-Sql $db 'SET ROLE probe_a; CREATE TABLE public.forbidden(id int);' $true
}
$catalog = "SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='probe' ORDER BY table_name,ordinal_position; SELECT schemaname,tablename,policyname,roles,qual FROM pg_policies WHERE schemaname='probe' ORDER BY policyname; SELECT relname,relrowsecurity,reloptions FROM pg_class WHERE relnamespace='probe'::regnamespace ORDER BY relname; SELECT * FROM probe.records ORDER BY id;"
$clean = Invoke-Sql probe_clean $catalog
$upgrade = Invoke-Sql probe_upgrade $catalog
if ($clean -cne $upgrade) { throw 'Synthetic clean and upgrade differ.' }
$clean | Set-Content (Join-Path $evidence 'synthetic-convergence.txt') -Encoding utf8
# A real repository replay attempt, fail-fast and atomic, never applied to remote Supabase.
foreach ($attempt in @(@('legacy_clean','supabase/migrations/20231123_auto_create_profile.sql'),@('legacy_schema','supabase/schema.sql'))) {
    $path = Join-Path $PSScriptRoot ('../' + $attempt[1])
    $output = Get-Content -Raw $path | & $docker exec -i $name psql -X -U postgres -d $attempt[0] -1 -v ON_ERROR_STOP=1 2>&1
    $code = $LASTEXITCODE
    [pscustomobject]@{file=$attempt[1];sha256=(Get-FileHash $path -Algorithm SHA256).Hash;exit=$code;output=($output | Out-String).Trim()} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $evidence ($attempt[0] + '.json')) -Encoding utf8
    if ($code -eq 0) { throw 'Unexpected legacy replay success; review required.' }
    Invoke-Sql $attempt[0] "SELECT 'remaining_public_tables=' || count(*) FROM pg_tables WHERE schemaname='public';"
}
# Restart preserves the disposable named volume; this is not a PostgreSQL version upgrade.
Invoke-Docker @('restart',$name)
for ($i=0; $i -lt 20; $i++) {
    & $docker exec $name pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
}
Invoke-Sql probe_upgrade $assert
Invoke-Docker @('exec',$name,'sh','-c','test "$(id -u)" = 70 && test ! -e /var/run/docker.sock && test ! -e /host && grep -E "^(NoNewPrivs|CapEff):" /proc/1/status')
$output = & $docker exec $name sh -c 'touch /etc/encargo01-forbidden' 2>&1
if ($LASTEXITCODE -eq 0) { throw 'Root filesystem unexpectedly writable.' }
$output | Out-File (Join-Path $evidence 'runtime.log') -Append -Encoding utf8
[pscustomobject]@{capturedAt=(Get-Date).ToUniversalTime().ToString('o');syntheticCleanUpgrade='PASS';roleAndSchemaProbe='PASS';restartPersistence='PASS';readonlyRoot='PASS';legacyClean='BLOCKED';applicationUpgrade='BLOCKED';jwtApiStorageBrowser='BLOCKED';note='Probe schema is infrastructure evidence only, not the application baseline or Supabase authorization.'} | ConvertTo-Json | Set-Content (Join-Path $evidence 'results.json') -Encoding utf8
Write-Output 'PASS infrastructure tests; application baseline/upgrade and JWT/API/Storage/browser remain BLOCKED. See evidence.'
