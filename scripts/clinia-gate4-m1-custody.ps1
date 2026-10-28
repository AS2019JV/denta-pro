param()
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskSource=Join-Path $PSScriptRoot 'clinia-gate4-custody.ps1'
if((Get-FileHash $taskSource -Algorithm SHA256).Hash.ToLower() -ne '0475da8b858356ae8c3bfd39a1ca69a8b8d18b2b54a56b58e9bdcfe1c5e3d028'){throw 'Frozen custody primitive changed'}
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskAllowed=@($taskSid.Value,'S-1-5-18')
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile($taskSource,[ref]$taskTokens,[ref]$taskErrors)
if($taskErrors.Count){throw 'Frozen custody parse refused'}
foreach($taskName in @('Assert-NoReparse','Assert-Custody')){
 $taskFunction=$taskAst.Find({param($taskNode) $taskNode -is [Management.Automation.Language.FunctionDefinitionAst] -and $taskNode.Name -eq $taskName},$true)
 if(!$taskFunction){throw 'Frozen custody function absent'}
 Invoke-Expression $taskFunction.Extent.Text
}
$taskPrivate=Join-Path $taskRoot '.gate4-private/managed-a9'
Assert-Custody (Split-Path -Parent $taskPrivate)
Assert-Custody $taskPrivate
$taskGit='C:/Users/aleja/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe'
& $taskGit -C $taskRoot check-ignore -q '.gate4-private/managed-a9/m1-attempt.json'
if($LASTEXITCODE -ne 0){throw 'Ignored own custody required'}
if(Test-Path (Join-Path $taskPrivate 'm1-attempt.json')){throw 'M1 attempt already exists; preserve and never retry'}
$taskLeasePath=Join-Path $taskPrivate 'writer-lease.json'
Assert-Custody $taskLeasePath
$taskLease=Get-Content -LiteralPath $taskLeasePath -Raw|ConvertFrom-Json
if($taskLease.state -ne 'M0_COMPLETE_GATE4_OWNER_AWAIT_SEPARATE_SCOPE'){throw 'Original owner lease state refused'}
[ordered]@{valid=$true;leaseState=$taskLease.state;credentialValuesRead=$false}|ConvertTo-Json -Compress
