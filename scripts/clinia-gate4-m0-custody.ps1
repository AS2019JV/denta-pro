param(
 [Parameter(Mandatory)][ValidateSet('AssertAbsent','Create')][string]$Action,
 [string]$ApprovedContractSha,
 [string]$AuthorizationReference
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskSource=Join-Path $PSScriptRoot 'clinia-gate4-custody.ps1'
if ((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0475da8b858356ae8c3bfd39a1ca69a8b8d18b2b54a56b58e9bdcfe1c5e3d028') {throw 'Reviewed custody primitives changed'}
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile($taskSource,[ref]$taskTokens,[ref]$taskErrors)
if ($taskErrors.Count -ne 0) {throw 'Custody source parse refused'}
foreach ($taskName in @('Assert-NoReparse','Assert-Custody')) {
 $taskFunction=$taskAst.Find({param($taskNode) $taskNode -is [Management.Automation.Language.FunctionDefinitionAst] -and $taskNode.Name -eq $taskName},$true)
 if (-not $taskFunction) {throw 'Custody primitive missing'}
 Invoke-Expression $taskFunction.Extent.Text
}
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskAllowed=@($taskSid.Value,'S-1-5-18')
$taskParent=Join-Path $taskRoot '.gate4-private'
$taskTarget=Join-Path $taskParent 'managed-a9'
Assert-Custody $taskParent
& git -C $taskRoot check-ignore -q '.gate4-private/managed-a9/probe'
if ($LASTEXITCODE -ne 0) {throw 'Ignored private parent required'}
if ((& git -C $taskRoot branch --show-current).Trim() -ne 'codex/gate4-recovery-ops') {throw 'Own Gate4 branch required'}
if (Test-Path -LiteralPath $taskTarget) {throw 'M0 target directory already used; preserve and never retry'}
if ($Action -eq 'Create') {
 if ($ApprovedContractSha -ne '4c8b61e0c2df354d58be32f8f3d583aba17c2b7d5979ebe55f9e9cb57c8e20d7' -or $AuthorizationReference -notmatch '^human:[A-Za-z0-9_.:-]{1,160}$') {throw 'Exact approval binding required; flags do not provide human authority'}
 # Atomic create fails if another process won the same identity.
 New-Item -ItemType Directory -Path $taskTarget -ErrorAction Stop | Out-Null
 # Reuse the already-reviewed protected parent DACL before any secret write.
 Set-Acl -LiteralPath $taskTarget -AclObject (Get-Acl -LiteralPath $taskParent)
 Assert-Custody $taskTarget
}
[ordered]@{status='PASS_M0_CUSTODY_BOUNDARY';action=$Action;targetCreated=($Action -eq 'Create');secretValuesRead=$false} | ConvertTo-Json -Compress
