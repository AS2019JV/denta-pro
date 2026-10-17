$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'encargo01-docker.ps1') -Action Verify
$container = Get-Content -Raw (Join-Path $evidence 'container.json') | ConvertFrom-Json
$net = Get-Content -Raw (Join-Path $evidence 'network.json') | ConvertFrom-Json
if ($container.privileged -or !$container.readonly -or $container.user -ne '70:70' -or !$net.internal -or $container.network -eq 'host' -or $container.ports.PSObject.Properties.Count -gt 0 -or $container.caps -notcontains 'ALL' -or $container.security -notcontains 'no-new-privileges:true' -or @($container.mounts | Where-Object Type -ne 'volume').Count -gt 0) { throw 'Isolation configuration failed.' }
Invoke-Docker @('exec',$name,'sh','-c','PGPASSWORD=$(cat /var/lib/postgresql/data/.encargo01-secret) psql -X -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -Atc "SELECT current_user;"')
$output = & $docker exec $name sh -c 'PGPASSWORD=incorrect psql -X -h 127.0.0.1 -U postgres -Atc "SELECT 1;"' 2>&1
$code = $LASTEXITCODE
$output | Out-File (Join-Path $evidence 'runtime.log') -Append -Encoding utf8
"wrong_password_exit=$code" | Out-File (Join-Path $evidence 'runtime.log') -Append -Encoding utf8
if ($code -ne 2 -or ($output | Out-String) -notmatch 'password authentication failed') { throw 'Wrong-password check did not fail for authentication.' }
Invoke-Docker @('exec',$name,'sh','-c','test "$(stat -c %a /var/lib/postgresql/data/.encargo01-secret)" = 600 && echo PASS-secret-mode-0600')
$results = Get-Content -Raw (Join-Path $evidence 'results.json') | ConvertFrom-Json
$results | Add-Member -NotePropertyName tcpScramPasswordPositiveNegative -NotePropertyValue 'PASS' -Force
$results | Add-Member -NotePropertyName isolationConfiguration -NotePropertyValue 'PASS' -Force
$results | ConvertTo-Json | Set-Content (Join-Path $evidence 'results.json') -Encoding utf8
# Stop only this experiment, retaining evidence and disposable volume for review.
Invoke-Docker @('stop',$name)
Invoke-Docker @('inspect',$name,'--format','{{.State.Status}}') | Set-Content (Join-Path $evidence 'final-state.txt') -Encoding utf8
Write-Output 'PASS final checks; disposable container stopped, volume retained.'
